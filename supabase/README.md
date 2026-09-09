# Supabase — ad-creator-image

Estructura de datos y storage para AdBatch en Supabase self-hosted.

## Como aplicar

### Opcion A: Studio (recomendada)

1. Abre Supabase Studio.
2. Ve a **SQL Editor**.
3. Copia el contenido de `migrations/0001_initial_schema.sql`.
4. Pega y click en **Run**.
5. Verifica en **Table Editor** que aparezcan las 5 tablas y las 3 vistas.
6. Repite los pasos 3-4 con `migrations/0002_persist_brands_and_batches.sql` (agrega columnas que faltaban en `brands`/`batches`/`creatives`, alinea `formats` con los slugs reales de la app, y crea los buckets `creatives` + `brand-assets`).
7. Repite con `migrations/0003_enable_rls.sql` (activa RLS — requiere que la app ya use el server con `SUPABASE_SERVICE_KEY`, ver abajo).

### Opcion B: psql (si te gusta la terminal)

```bash
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" \
  -f supabase/migrations/0001_initial_schema.sql
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" \
  -f supabase/migrations/0002_persist_brands_and_batches.sql
```

## Que crea la migration

**Tablas** (5):

- `brands` — marcas del grupo con toda la config de branding.
- `formats` — formatos publicitarios y sus baselines de tiempo.
- `campaigns` — campana publicitaria (contiene 1..N lotes).
- `batches` — lote de generacion.
- `creatives` — cada imagen individual.

**Vistas** (3):

- `v_stats_totals` — 5 numeros para las tarjetas del dashboard (totales globales).
- `v_stats_weekly` — agregado semanal (12 semanas para grafico).
- `v_stats_monthly` — agregado mensual.

**Seed data:**

- 3 marcas: Structuralia, EducaHub.ai, Phia.
- 4 formatos: IG Feed 1:1, IG Story 9:16, Banner 16:9, Cover LinkedIn 4:1.

## Storage buckets

`0002_persist_brands_and_batches.sql` ya crea los buckets `creatives` y `brand-assets` (ambos privados) via SQL (`insert into storage.buckets`). Si por lo que sea no aparecen en **Storage** despues de correr la migration, crealos a mano ahi mismo con el mismo nombre y `Public: No`.

Estructura de rutas:

```
creatives/
  {batch_id}/
    {courseIndex}-{formato}-{uuid}.webp   (el server recomprime los PNG a WebP q85)

brand-assets/
  {brand_slug}/
    logo-white.png | logo-dark.png | logo-primary.png
    font-display.ttf | font-body.ttf
    ref-{n}.png
```

## Retencion de imagenes (30 dias)

La tabla `creatives` ya tiene columna `expires_at` que se rellena automaticamente a 30 dias vista al insertar.

**Job de limpieza:** lo hace `pg_cron` dentro del propio Postgres (migracion
`0003_enable_rls.sql`, mismo patron que course-cover-engine): la funcion
`cleanup_expired_creatives()` corre a diario a las 04:00 UTC, borra del bucket
`creatives` los ficheros expirados y pone `image_path = null` en la fila
(la metadata se conserva). No hace falta n8n.

De momento la retencion es 30 dias. Ajustable cambiando el default en la tabla:

```sql
alter table public.creatives
  alter column expires_at set default (now() + interval '7 days');
```

## RLS (Row Level Security)

Activada en `0003_enable_rls.sql`. Desde 2026-09-08 la app tiene backend propio
(`server.js`) que habla con Supabase usando la **service key** — el navegador ya
no recibe ninguna credencial de Supabase. Con RLS activa y sin políticas para
`anon`, la anon key antigua queda inservible: nadie puede leer ni escribir con
ella. El `service_role` salta RLS por diseño (y además tiene política explícita,
mismo patrón que course-cover-engine).
