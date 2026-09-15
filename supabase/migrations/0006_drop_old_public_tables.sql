-- 0006 — BORRAR las tablas viejas de public (ad_creator_*) — DESTRUCTIVO.
--
-- ⚠️⚠️ NO CORRER hasta haber verificado que la app funciona contra el schema
-- nuevo `ad_creator_image` (0005 dejó las viejas intactas a propósito como red
-- de seguridad). Esto es IRREVERSIBLE: elimina las tablas originales y sus datos.
--
-- Checklist ANTES de correr esto:
--   1. Ejecutaste 0005 (copia) y los recuentos old == new coincidían.
--   2. Añadiste `ad_creator_image` a PGRST_DB_SCHEMAS y reiniciaste `rest`.
--   3. Desplegaste el código nuevo del server (usa db.schema = ad_creator_image).
--   4. /api/supabase-ping -> inventory.schema OK y writeProbe.ok:true.
--   5. Probaste crear/leer/borrar un lote real en la app sin errores.
--
-- Rollback (si algo fue mal y AÚN NO corriste este 0006): apunta la app de
-- vuelta a public+prefijo, y borra el schema nuevo con
--   drop schema if exists ad_creator_image cascade;
-- Los datos originales seguirán intactos en public.
-- ============================================================================

-- Vistas viejas primero (dependen de las tablas).
drop view if exists public.ad_creator_v_stats_weekly;
drop view if exists public.ad_creator_v_stats_monthly;
drop view if exists public.ad_creator_v_stats_totals;

-- Tablas: hijos antes que padres. CASCADE arrastra FKs/índices/vistas residuales
-- que aún apunten a ellas (solo objetos de esta app).
drop table if exists public.ad_creator_creatives cascade;
drop table if exists public.ad_creator_batches   cascade;
drop table if exists public.ad_creator_formats   cascade;
drop table if exists public.ad_creator_brands    cascade;

-- Nota: public.ad_creator_campaigns (si existiera) NO se toca — la app no la usa
-- y podría tener datos históricos. Descomenta si quieres eliminarla también:
-- drop table if exists public.ad_creator_campaigns cascade;

notify pgrst, 'reload schema';
