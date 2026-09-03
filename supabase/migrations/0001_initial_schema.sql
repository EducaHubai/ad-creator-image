-- ============================================================================
-- ad-creator-image (AdBatch) — esquema inicial
-- ============================================================================
-- Crea tablas para brands, formats, campaigns, batches y creatives.
-- Incluye seed de las 3 marcas actuales (Structuralia, EducaHub.ai, Phia) y
-- 4 formatos publicitarios con baseline de tiempo ahorrado.
--
-- RLS: se deja desactivada en esta migracion. Cuando anadamos auth de usuario
-- (Supabase Auth) se activara y crearan policies por rol.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: trigger para actualizar updated_at automaticamente
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table public.brands (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  tone                text,
  personality         text,
  positioning         text,
  language            text not null default 'es',
  headline_rules      text,
  body_rules          text,
  forbidden_words     text,
  colors              jsonb not null default '{}'::jsonb,
  fonts               jsonb not null default '{}'::jsonb,
  brand_image_style   text,
  logo_url            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

comment on table public.brands is 'Marcas del grupo EDUCA EDTECH con su configuracion de branding para generacion de creatividades.';

-- ---------------------------------------------------------------------------
-- formats
-- ---------------------------------------------------------------------------
create table public.formats (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  width               integer not null,
  height              integer not null,
  baseline_minutes    numeric(5,2) not null default 5.00,
  created_at          timestamptz not null default now()
);

comment on table public.formats is 'Formatos publicitarios soportados. baseline_minutes = tiempo estimado de produccion manual, usado para calcular tiempo ahorrado.';

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  brand_id            uuid not null references public.brands(id) on delete restrict,
  notes               text,
  status              text not null default 'active'
                      check (status in ('draft','active','archived')),
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create index campaigns_brand_id_idx on public.campaigns(brand_id);
create index campaigns_created_at_idx on public.campaigns(created_at desc);

comment on table public.campaigns is 'Campana publicitaria. Contiene 1..N lotes (batches). Nunca se borra: se archiva.';

-- ---------------------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------------------
create table public.batches (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  name                text,
  source_excel_url    text,
  status              text not null default 'pending'
                      check (status in ('pending','processing','done','failed')),
  error_message       text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index batches_campaign_id_idx on public.batches(campaign_id);
create index batches_created_at_idx on public.batches(created_at desc);
create index batches_status_idx on public.batches(status);

comment on table public.batches is 'Lote de generacion. Se procesa el Excel de entrada y produce N creativas.';

-- ---------------------------------------------------------------------------
-- creatives
-- ---------------------------------------------------------------------------
create table public.creatives (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid not null references public.batches(id) on delete cascade,
  format_id           uuid not null references public.formats(id) on delete restrict,
  image_path          text,
  params_json         jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '30 days')
);

create index creatives_batch_id_idx on public.creatives(batch_id);
create index creatives_format_id_idx on public.creatives(format_id);
create index creatives_created_at_idx on public.creatives(created_at desc);
create index creatives_expires_at_idx on public.creatives(expires_at) where image_path is not null;

comment on table public.creatives is 'Creatividad individual. image_path apunta al bucket "creatives" en Storage y se pone null cuando el job de retencion (30 dias) purga la imagen. La metadata (params_json, format, batch) se conserva indefinidamente.';

-- ---------------------------------------------------------------------------
-- Vista: estadisticas semanales
-- ---------------------------------------------------------------------------
create or replace view public.v_stats_weekly as
select
  date_trunc('week', c.created_at)                 as week_start,
  count(distinct b.id)                              as batches_created,
  count(c.id)                                       as creatives_generated,
  count(distinct cmp.brand_id)                      as brands_used,
  count(distinct c.format_id)                       as formats_used,
  round(sum(f.baseline_minutes) / 60.0, 1)          as time_saved_hours
from public.creatives c
  join public.batches b   on b.id = c.batch_id
  join public.campaigns cmp on cmp.id = b.campaign_id
  join public.formats f   on f.id = c.format_id
group by date_trunc('week', c.created_at)
order by week_start desc;

comment on view public.v_stats_weekly is 'Agregado semanal para el dashboard: lotes, creatividades, marcas, formatos y horas ahorradas.';

-- ---------------------------------------------------------------------------
-- Vista: estadisticas mensuales
-- ---------------------------------------------------------------------------
create or replace view public.v_stats_monthly as
select
  date_trunc('month', c.created_at)                as month_start,
  count(distinct b.id)                              as batches_created,
  count(c.id)                                       as creatives_generated,
  count(distinct cmp.brand_id)                      as brands_used,
  count(distinct c.format_id)                       as formats_used,
  round(sum(f.baseline_minutes) / 60.0, 1)          as time_saved_hours
from public.creatives c
  join public.batches b   on b.id = c.batch_id
  join public.campaigns cmp on cmp.id = b.campaign_id
  join public.formats f   on f.id = c.format_id
group by date_trunc('month', c.created_at)
order by month_start desc;

comment on view public.v_stats_monthly is 'Agregado mensual para el dashboard.';

-- ---------------------------------------------------------------------------
-- Vista: totales (para las tarjetas grandes del dashboard)
-- ---------------------------------------------------------------------------
create or replace view public.v_stats_totals as
select
  (select count(*) from public.batches)             as batches_total,
  (select count(*) from public.creatives)           as creatives_total,
  (select count(*) from public.formats)             as formats_total,
  (select count(*) from public.brands)              as brands_total,
  round(coalesce((
    select sum(f.baseline_minutes)
    from public.creatives c
    join public.formats f on f.id = c.format_id
  ), 0) / 60.0, 1)                                  as time_saved_hours;

comment on view public.v_stats_totals is 'Totales globales para las 4 tarjetas del dashboard.';

-- ---------------------------------------------------------------------------
-- Seed: formatos
-- ---------------------------------------------------------------------------
insert into public.formats (slug, name, width, height, baseline_minutes) values
  ('ig_feed_1x1',    'Instagram Feed 1:1',   1080, 1080, 4),
  ('ig_story_9x16',  'Instagram Story 9:16', 1080, 1920, 5),
  ('banner_16x9',    'Banner web 16:9',      1920, 1080, 6),
  ('cover_4x1',      'Cover LinkedIn 4:1',   1584,  396, 5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: marcas actuales (Structuralia, EducaHub.ai, Phia)
-- Sacadas de DEFAULT_BRANDS en src/App.jsx
-- ---------------------------------------------------------------------------
insert into public.brands (slug, name, tone, personality, language, headline_rules, body_rules, forbidden_words) values
  ('structuralia',
   'Structuralia',
   'Authoritative and precise',
   'Technical, trustworthy',
   'es',
   'Start with action verb, max 8 words',
   '2-3 sentences, lead with transformation',
   'revolutionary, amazing, world-class'),
  ('educahub-ai',
   'EducaHub.ai',
   'Warm and aspirational',
   'Innovative, approachable',
   'es',
   'Focus on outcome, conversational, max 10 words',
   'Lead with benefit, mention flexibility',
   'guaranteed, best, incredible'),
  ('phia',
   'Phia',
   'Bold and visionary',
   'Cutting-edge, empowering',
   'en',
   'Future-focused, action-oriented, punchy',
   'Short and direct, emphasize AI advantage',
   'traditional, basic, generic')
on conflict (slug) do nothing;
