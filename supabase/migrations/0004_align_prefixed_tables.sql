-- 0004 — Alinear las tablas REALES (prefijo ad_creator_) con lo que la app escribe.
--
-- Contexto: el Supabase de producción es compartido y las tablas de esta app
-- viven con prefijo ad_creator_. Se crearon con el esquema de 0001, pero los
-- cambios de 0002 nunca se aplicaron a las tablas prefijadas — el writeProbe
-- de /api/supabase-ping lo confirmó (2026-09-10): "Could not find the
-- 'brand_id' column of 'ad_creator_batches'". Sin esas columnas, el insert de
-- createBatch falla entero y los lotes desaparecen al recargar.
--
-- A diferencia de 0001–0003 (nombres sin prefijo, para una instancia dedicada
-- hipotética), este script usa los nombres REALES. Es idempotente: se puede
-- ejecutar varias veces en el SQL editor de Supabase Studio sin romper nada.

-- ---------------------------------------------------------------------------
-- brands: campos que brandToRow envía y la tabla real no tiene (0002 §brands)
-- — sin esto, el upsert de saveBrand falla entero y ni el seeding ni el
-- Estudio de marca persisten nada
-- ---------------------------------------------------------------------------
alter table public.ad_creator_brands
  add column if not exists tagline           text,
  add column if not exists website           text,
  add column if not exists audience          text,
  add column if not exists logos             jsonb not null default '{}'::jsonb,
  add column if not exists voice_rules       jsonb not null default '{}'::jsonb,
  add column if not exists ad_rules          jsonb not null default '{}'::jsonb,
  add column if not exists ref_images        jsonb not null default '[]'::jsonb,
  add column if not exists font_data         jsonb not null default '{}'::jsonb,
  add column if not exists font_server_url   text;

comment on column public.ad_creator_brands.logos is '{"white": "storage path", "dark": "storage path", "primary": "storage path"} — logo_url (columna vieja) queda sin usar, no se borra.';

-- ---------------------------------------------------------------------------
-- batches: columnas que usa createBatch/updateBatch (0002 §batches)
-- ---------------------------------------------------------------------------
alter table public.ad_creator_batches
  add column if not exists brand_id   uuid references public.ad_creator_brands(id) on delete set null,
  add column if not exists config     jsonb not null default '{}'::jsonb,
  add column if not exists courses    jsonb not null default '[]'::jsonb,
  add column if not exists ads_count  integer not null default 0;

-- campaign_id era NOT NULL en 0001 y la app ya no manda campañas.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ad_creator_batches' and column_name = 'campaign_id'
  ) then
    alter table public.ad_creator_batches alter column campaign_id drop not null;
  end if;
end $$;

-- El check de status de 0001 no admite 'cancelled'.
alter table public.ad_creator_batches
  drop constraint if exists batches_status_check;
alter table public.ad_creator_batches
  drop constraint if exists ad_creator_batches_status_check;
alter table public.ad_creator_batches
  add constraint ad_creator_batches_status_check
  check (status in ('pending','processing','done','failed','cancelled'));

create index if not exists ad_creator_batches_brand_id_idx on public.ad_creator_batches(brand_id);

-- ---------------------------------------------------------------------------
-- creatives: la app no usa format_id (formatos custom) y guarda label + medidas
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ad_creator_creatives' and column_name = 'format_id'
  ) then
    alter table public.ad_creator_creatives alter column format_id drop not null;
  end if;
end $$;

alter table public.ad_creator_creatives
  add column if not exists width         integer,
  add column if not exists height        integer,
  add column if not exists format_label  text;

-- ---------------------------------------------------------------------------
-- formats: slugs alineados con el FORMATS de src/App.jsx — /api/db/stats casa
-- creatives.format_label con estos slugs para calcular el tiempo ahorrado
-- ---------------------------------------------------------------------------
insert into public.ad_creator_formats (slug, name, width, height, baseline_minutes) values
  ('story',     'Stories / Reels',   1080, 1920, 5),
  ('feed_4x5',  'Feed priority',     1080, 1350, 4),
  ('square',    'Universal square',  1080, 1080, 4),
  ('landscape', 'Legacy landscape',  1200,  628, 6)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Vistas de stats: recrear leyendo brand_id/format_label de las tablas reales
-- (la app calcula los totales en /api/db/stats; las vistas quedan para
-- consultas manuales, alineadas para no confundir)
-- ---------------------------------------------------------------------------
drop view if exists public.ad_creator_v_stats_weekly;
create view public.ad_creator_v_stats_weekly as
select
  date_trunc('week', c.created_at)                      as week_start,
  count(distinct b.id)                                  as batches_created,
  count(c.id)                                           as creatives_generated,
  count(distinct b.brand_id)                            as brands_used,
  count(distinct c.format_label)                        as formats_used,
  round(coalesce(sum(coalesce(f.baseline_minutes, 5)), 0) / 60.0, 1) as time_saved_hours
from public.ad_creator_creatives c
  join public.ad_creator_batches b       on b.id = c.batch_id
  left join public.ad_creator_formats f  on f.slug = c.format_label
group by date_trunc('week', c.created_at)
order by week_start desc;

drop view if exists public.ad_creator_v_stats_monthly;
create view public.ad_creator_v_stats_monthly as
select
  date_trunc('month', c.created_at)                     as month_start,
  count(distinct b.id)                                  as batches_created,
  count(c.id)                                           as creatives_generated,
  count(distinct b.brand_id)                            as brands_used,
  count(distinct c.format_label)                        as formats_used,
  round(coalesce(sum(coalesce(f.baseline_minutes, 5)), 0) / 60.0, 1) as time_saved_hours
from public.ad_creator_creatives c
  join public.ad_creator_batches b       on b.id = c.batch_id
  left join public.ad_creator_formats f  on f.slug = c.format_label
group by date_trunc('month', c.created_at)
order by month_start desc;

drop view if exists public.ad_creator_v_stats_totals;
create view public.ad_creator_v_stats_totals as
select
  (select count(*) from public.ad_creator_batches)      as batches_total,
  (select count(*) from public.ad_creator_creatives)    as creatives_total,
  (select count(*) from public.ad_creator_formats)      as formats_total,
  (select count(*) from public.ad_creator_brands)       as brands_total,
  round(coalesce((
    select sum(coalesce(f.baseline_minutes, 5))
    from public.ad_creator_creatives c
    left join public.ad_creator_formats f on f.slug = c.format_label
  ), 0) / 60.0, 1)                                      as time_saved_hours;

-- ---------------------------------------------------------------------------
-- RLS (0003 adaptado): la app entra con la SERVICE key (bypasa RLS); esto
-- solo evita que la anon key de otras apps del Supabase compartido lea/escriba
-- estas tablas.
-- ---------------------------------------------------------------------------
alter table public.ad_creator_brands    enable row level security;
alter table public.ad_creator_batches   enable row level security;
alter table public.ad_creator_creatives enable row level security;
alter table public.ad_creator_formats   enable row level security;

drop policy if exists "service_role_all" on public.ad_creator_brands;
create policy "service_role_all" on public.ad_creator_brands
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all" on public.ad_creator_batches;
create policy "service_role_all" on public.ad_creator_batches
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all" on public.ad_creator_creatives;
create policy "service_role_all" on public.ad_creator_creatives
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all" on public.ad_creator_formats;
create policy "service_role_all" on public.ad_creator_formats
  for all to service_role using (true) with check (true);
