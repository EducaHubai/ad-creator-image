-- ============================================================================
-- ad-creator-image (AdBatch) — persistir marcas y lotes de verdad
-- ============================================================================
-- 0001 dejaba `brands`/`batches`/`creatives` a medio camino de lo que la app
-- realmente necesita: faltan campos de marca (tagline, website, audience,
-- logos, voiceRules, adRules, refImages, fontData), y el modelo
-- campaigns -> batches no existe en la UI (cada corrida del wizard "Generar"
-- es un batch suelto, sin concepto de campana). Esta migration:
--   1. Extiende `brands` con los campos que faltan.
--   2. Desacopla `batches` de `campaigns` (columna queda, deja de ser obligatoria)
--      y le agrega brand_id / config / courses directos.
--   3. Alinea `formats` con los slugs reales de la app (story/feed_4x5/square/landscape).
--   4. Permite creatives sin `format_id` (formatos custom, sin fila en `formats`).
--   5. Actualiza las vistas de stats para leer brand_id desde `batches` directo.
--   6. Crea los buckets de Storage `creatives` y `brand-assets` (privados).
--
-- RLS: sigue desactivada (igual que 0001). Anon key para todo por ahora —
-- revisar cuando se agregue Supabase Auth (0003_auth_and_rls.sql, pendiente).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- brands: campos que la app usa y la tabla no tenia
-- ---------------------------------------------------------------------------
alter table public.brands
  add column if not exists tagline           text,
  add column if not exists website           text,
  add column if not exists audience          text,
  add column if not exists logos             jsonb not null default '{}'::jsonb,
  add column if not exists voice_rules       jsonb not null default '{}'::jsonb,
  add column if not exists ad_rules          jsonb not null default '{}'::jsonb,
  add column if not exists ref_images        jsonb not null default '[]'::jsonb,
  add column if not exists font_data         jsonb not null default '{}'::jsonb,
  add column if not exists font_server_url   text;

comment on column public.brands.logos is '{"white": "storage path", "dark": "storage path", "primary": "storage path"} — logo_url (columna vieja) queda sin usar, no se borra.';

-- ---------------------------------------------------------------------------
-- batches: ya no depende de campaigns, referencia brand + guarda el resto
-- ---------------------------------------------------------------------------
alter table public.batches
  alter column campaign_id drop not null;

alter table public.batches
  add column if not exists brand_id   uuid references public.brands(id) on delete set null,
  add column if not exists config     jsonb not null default '{}'::jsonb,
  add column if not exists courses    jsonb not null default '[]'::jsonb,
  add column if not exists ads_count  integer not null default 0;

comment on column public.batches.config is 'goal/audience/painPoints/ctas/formats/variantCount/customDim/winningStyleId/winningStyleLabel del wizard Generar.';
comment on column public.batches.courses is 'Filas parseadas del CSV de entrada (incluye keywords5 si el formato lo trae).';

alter table public.batches
  drop constraint if exists batches_status_check;
alter table public.batches
  add constraint batches_status_check
  check (status in ('pending','processing','done','failed','cancelled'));

create index if not exists batches_brand_id_idx on public.batches(brand_id);

-- ---------------------------------------------------------------------------
-- creatives: permitir formatos custom (sin fila en `formats`)
-- ---------------------------------------------------------------------------
alter table public.creatives
  alter column format_id drop not null;

alter table public.creatives
  add column if not exists width         integer,
  add column if not exists height        integer,
  add column if not exists format_label  text;

-- ---------------------------------------------------------------------------
-- formats: alinear slugs con el FORMATS real de src/App.jsx
-- ---------------------------------------------------------------------------
insert into public.formats (slug, name, width, height, baseline_minutes) values
  ('story',     'Stories / Reels',   1080, 1920, 5),
  ('feed_4x5',  'Feed priority',     1080, 1350, 4),
  ('square',    'Universal square',  1080, 1080, 4),
  ('landscape', 'Legacy landscape',  1200,  628, 6)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Vistas de stats: brand_id ahora sale directo de batches, no de campaigns
-- ---------------------------------------------------------------------------
create or replace view public.v_stats_weekly as
select
  date_trunc('week', c.created_at)                 as week_start,
  count(distinct b.id)                              as batches_created,
  count(c.id)                                       as creatives_generated,
  count(distinct b.brand_id)                        as brands_used,
  count(distinct c.format_id)                       as formats_used,
  round(coalesce(sum(f.baseline_minutes), 0) / 60.0, 1) as time_saved_hours
from public.creatives c
  join public.batches b        on b.id = c.batch_id
  left join public.formats f   on f.id = c.format_id
group by date_trunc('week', c.created_at)
order by week_start desc;

create or replace view public.v_stats_monthly as
select
  date_trunc('month', c.created_at)                as month_start,
  count(distinct b.id)                              as batches_created,
  count(c.id)                                       as creatives_generated,
  count(distinct b.brand_id)                        as brands_used,
  count(distinct c.format_id)                       as formats_used,
  round(coalesce(sum(f.baseline_minutes), 0) / 60.0, 1) as time_saved_hours
from public.creatives c
  join public.batches b        on b.id = c.batch_id
  left join public.formats f   on f.id = c.format_id
group by date_trunc('month', c.created_at)
order by month_start desc;

create or replace view public.v_stats_totals as
select
  (select count(*) from public.batches)             as batches_total,
  (select count(*) from public.creatives)           as creatives_total,
  (select count(*) from public.formats)             as formats_total,
  (select count(*) from public.brands)              as brands_total,
  round(coalesce((
    select sum(f.baseline_minutes)
    from public.creatives c
    left join public.formats f on f.id = c.format_id
  ), 0) / 60.0, 1)                                  as time_saved_hours;

-- ---------------------------------------------------------------------------
-- Storage: buckets privados para creatividades y assets de marca
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('creatives',    'creatives',    false),
  ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;
