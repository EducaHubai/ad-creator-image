-- ============================================================================
-- ad-creator-image (AdBatch) — activar RLS
-- ============================================================================
-- Desde que el acceso a Supabase va exclusivamente por server.js con la
-- SERVICE key (2026-09-08), la anon key ya no se usa en ninguna parte. Activar
-- RLS sin políticas para anon cierra la puerta a cualquiera que tuviera la
-- anon key antigua: no podrá leer ni escribir nada.
--
-- El rol service_role salta RLS por diseño, pero se crea la política explícita
-- igualmente (mismo patrón que course-cover-engine) como documentación y por
-- si algún día se consulta con un rol distinto.
-- ============================================================================

alter table public.brands    enable row level security;
alter table public.formats   enable row level security;
alter table public.campaigns enable row level security;
alter table public.batches   enable row level security;
alter table public.creatives enable row level security;

drop policy if exists "service_role_all" on public.brands;
drop policy if exists "service_role_all" on public.formats;
drop policy if exists "service_role_all" on public.campaigns;
drop policy if exists "service_role_all" on public.batches;
drop policy if exists "service_role_all" on public.creatives;

create policy "service_role_all" on public.brands
  for all to service_role using (true) with check (true);
create policy "service_role_all" on public.formats
  for all to service_role using (true) with check (true);
create policy "service_role_all" on public.campaigns
  for all to service_role using (true) with check (true);
create policy "service_role_all" on public.batches
  for all to service_role using (true) with check (true);
create policy "service_role_all" on public.creatives
  for all to service_role using (true) with check (true);

-- Storage: los buckets `creatives` y `brand-assets` ya son privados (0002).
-- storage.objects tiene RLS activa por defecto en Supabase; sin políticas para
-- anon/authenticated, solo el service_role (server.js) puede leer/escribir, y
-- el front accede a los ficheros únicamente vía URLs firmadas que genera el
-- server. No hace falta nada más aquí.

-- ---------------------------------------------------------------------------
-- Retención de creatividades (30 días) — job pg_cron, portado de
-- course-cover-engine. Borra el fichero del bucket cuando expira, pero
-- conserva la fila con image_path = null (la metadata es permanente, ver
-- comentario de la tabla en 0001). expires_at se rellena al insertar.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

create or replace function public.cleanup_expired_creatives()
returns void language plpgsql security definer as $$
begin
  delete from storage.objects
  where bucket_id = 'creatives'
    and name in (
      select image_path from public.creatives
      where expires_at < now() and image_path is not null
    );
  update public.creatives
    set image_path = null
    where expires_at < now() and image_path is not null;
end;
$$;

-- Diario a las 04:00 UTC (misma franja que planeaba el job de n8n del README).
select cron.schedule(
  'cleanup-expired-creatives',
  '0 4 * * *',
  'select public.cleanup_expired_creatives()'
);
