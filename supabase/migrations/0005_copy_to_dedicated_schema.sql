-- 0005 — COPIAR las tablas de esta app a un schema dedicado (ad_creator_image).
--
-- NO DESTRUCTIVO. Las tablas originales public.ad_creator_* se quedan INTACTAS y
-- funcionando: esto crea copias fieles en el schema nuevo y copia los datos. Así
-- puedes verificar la app contra el schema nuevo mientras el viejo sigue de red
-- de seguridad. Cuando esté todo OK, se borra el viejo con 0006 (destructivo).
--
-- Fidelidad: CREATE TABLE (LIKE ... INCLUDING ALL) replica la estructura REAL de
-- cada tabla tal como esté ahora (columnas, defaults, NOT NULL, CHECK, índices,
-- PK/UNIQUE), sin depender de qué migraciones se aplicaron. Lo que LIKE NO copia
-- se añade a mano abajo: FKs, triggers updated_at, RLS/policies y grants.
--
-- Idempotente: re-ejecutable. La copia de datos usa ON CONFLICT (id) DO NOTHING,
-- así que re-correrlo solo rellena filas que falten (NO pisa lo ya escrito en el
-- schema nuevo). Ojo: por eso, si la app vieja sigue escribiendo en public entre
-- la copia y el cambio de código, esas filas tardías no llegarán al schema nuevo
-- — haz la copia en un momento tranquilo y despliega el código nuevo pronto.
--
-- ⚠️ REQUISITO DE INFRA (aparte): el schema debe estar en PGRST_DB_SCHEMAS del
-- contenedor `rest` de PostgREST, o supabase-js no lo verá (PGRST106). Hazlo
-- DESPUÉS de este script (el schema ya existirá) y reinicia el contenedor `rest`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Schema + función updated_at propia. Se crea DENTRO del schema (no en public)
--    porque en esta instancia compartida public.set_updated_at() puede no existir
--    — así el schema queda autocontenido y sin dependencias externas.
-- ---------------------------------------------------------------------------
create schema if not exists ad_creator_image;

create or replace function ad_creator_image.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2) Crear las tablas copiando la estructura viva + copiar los datos.
--    Guarda por tabla: solo si la de origen existe. Orden: padres antes que
--    hijos (por si luego los FKs validan datos).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ad_creator_brands') is not null then
    execute 'create table if not exists ad_creator_image.brands (like public.ad_creator_brands including all)';
    execute 'insert into ad_creator_image.brands    select * from public.ad_creator_brands    on conflict (id) do nothing';
  end if;

  if to_regclass('public.ad_creator_formats') is not null then
    execute 'create table if not exists ad_creator_image.formats (like public.ad_creator_formats including all)';
    execute 'insert into ad_creator_image.formats   select * from public.ad_creator_formats   on conflict (id) do nothing';
  end if;

  if to_regclass('public.ad_creator_batches') is not null then
    execute 'create table if not exists ad_creator_image.batches (like public.ad_creator_batches including all)';
    execute 'insert into ad_creator_image.batches   select * from public.ad_creator_batches   on conflict (id) do nothing';
  end if;

  if to_regclass('public.ad_creator_creatives') is not null then
    execute 'create table if not exists ad_creator_image.creatives (like public.ad_creator_creatives including all)';
    execute 'insert into ad_creator_image.creatives select * from public.ad_creator_creatives on conflict (id) do nothing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Foreign keys que la app necesita (LIKE no las copia). Se omiten a propósito
--    campaign_id y format_id: la app ya no los usa (0004 los dejó nullable) y sus
--    tablas no se migran. Guardas: solo si la columna existe y el FK no está ya.
--    creatives.batch_id ON DELETE CASCADE es CRÍTICO: deleteBatch confía en él.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='ad_creator_image' and table_name='batches' and column_name='brand_id')
     and not exists (select 1 from pg_constraint
             where conname='batches_brand_id_fkey' and conrelid='ad_creator_image.batches'::regclass) then
    alter table ad_creator_image.batches
      add constraint batches_brand_id_fkey foreign key (brand_id)
      references ad_creator_image.brands(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='ad_creator_image' and table_name='creatives' and column_name='batch_id')
     and not exists (select 1 from pg_constraint
             where conname='creatives_batch_id_fkey' and conrelid='ad_creator_image.creatives'::regclass) then
    alter table ad_creator_image.creatives
      add constraint creatives_batch_id_fkey foreign key (batch_id)
      references ad_creator_image.batches(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Trigger updated_at (LIKE no copia triggers). Se recrea en cada tabla que
--    tenga columna updated_at, apuntando a ad_creator_image.set_updated_at().
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['brands','batches','creatives','formats'] loop
    if exists (select 1 from information_schema.columns
               where table_schema='ad_creator_image' and table_name=t and column_name='updated_at') then
      execute format('drop trigger if exists %I on ad_creator_image.%I', t||'_set_updated_at', t);
      execute format('create trigger %I before update on ad_creator_image.%I for each row execute function ad_creator_image.set_updated_at()', t||'_set_updated_at', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Vistas de stats en el schema nuevo (la app calcula totales en /api/db/stats;
--    quedan para consultas manuales).
-- ---------------------------------------------------------------------------
create or replace view ad_creator_image.v_stats_weekly as
select
  date_trunc('week', c.created_at)                      as week_start,
  count(distinct b.id)                                  as batches_created,
  count(c.id)                                           as creatives_generated,
  count(distinct b.brand_id)                            as brands_used,
  count(distinct c.format_label)                        as formats_used,
  round(coalesce(sum(coalesce(f.baseline_minutes, 5)), 0) / 60.0, 1) as time_saved_hours
from ad_creator_image.creatives c
  join ad_creator_image.batches b       on b.id = c.batch_id
  left join ad_creator_image.formats f  on f.slug = c.format_label
group by date_trunc('week', c.created_at)
order by week_start desc;

create or replace view ad_creator_image.v_stats_monthly as
select
  date_trunc('month', c.created_at)                     as month_start,
  count(distinct b.id)                                  as batches_created,
  count(c.id)                                           as creatives_generated,
  count(distinct b.brand_id)                            as brands_used,
  count(distinct c.format_label)                        as formats_used,
  round(coalesce(sum(coalesce(f.baseline_minutes, 5)), 0) / 60.0, 1) as time_saved_hours
from ad_creator_image.creatives c
  join ad_creator_image.batches b       on b.id = c.batch_id
  left join ad_creator_image.formats f  on f.slug = c.format_label
group by date_trunc('month', c.created_at)
order by month_start desc;

create or replace view ad_creator_image.v_stats_totals as
select
  (select count(*) from ad_creator_image.batches)      as batches_total,
  (select count(*) from ad_creator_image.creatives)    as creatives_total,
  (select count(*) from ad_creator_image.formats)      as formats_total,
  (select count(*) from ad_creator_image.brands)       as brands_total,
  round(coalesce((
    select sum(coalesce(f.baseline_minutes, 5))
    from ad_creator_image.creatives c
    left join ad_creator_image.formats f on f.slug = c.format_label
  ), 0) / 60.0, 1)                                      as time_saved_hours;

-- ---------------------------------------------------------------------------
-- 6) Permisos: la app entra con la SERVICE key (rol service_role). Usage sobre
--    el schema + privilegios. NO se concede a anon/authenticated -> aislamiento.
-- ---------------------------------------------------------------------------
grant usage on schema ad_creator_image to service_role;
grant all privileges on all tables    in schema ad_creator_image to service_role;
grant all privileges on all sequences in schema ad_creator_image to service_role;
grant execute on all functions in schema ad_creator_image to service_role;
alter default privileges in schema ad_creator_image grant all     on tables    to service_role;
alter default privileges in schema ad_creator_image grant all     on sequences to service_role;
alter default privileges in schema ad_creator_image grant execute on functions to service_role;

-- ---------------------------------------------------------------------------
-- 7) RLS + policy service_role en cada tabla copiada.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['brands','batches','creatives','formats'] loop
    if to_regclass('ad_creator_image.'||t) is not null then
      execute format('alter table ad_creator_image.%I enable row level security', t);
      execute format('drop policy if exists "service_role_all" on ad_creator_image.%I', t);
      execute format('create policy "service_role_all" on ad_creator_image.%I for all to service_role using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8) Recargar la caché de esquema de PostgREST (no sustituye a exponer el schema
--    en PGRST_DB_SCHEMAS + reiniciar el contenedor `rest`).
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN (correr a mano tras el script; old y new deben coincidir):
--
--   select 'brands'    as t, (select count(*) from public.ad_creator_brands)    as old, (select count(*) from ad_creator_image.brands)    as new
--   union all select 'formats',   (select count(*) from public.ad_creator_formats),   (select count(*) from ad_creator_image.formats)
--   union all select 'batches',   (select count(*) from public.ad_creator_batches),   (select count(*) from ad_creator_image.batches)
--   union all select 'creatives', (select count(*) from public.ad_creator_creatives), (select count(*) from ad_creator_image.creatives);
-- ---------------------------------------------------------------------------
