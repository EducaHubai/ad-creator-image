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
8. Repite con `migrations/0004_align_prefixed_tables.sql` (alinea las tablas reales con prefijo `ad_creator_` con lo que la app escribe).
9. Repite con `migrations/0005_copy_to_dedicated_schema.sql` (**copia no destructiva** al schema dedicado `ad_creator_image`; las tablas viejas de `public` siguen intactas — ver sección "Schema dedicado" abajo, **requiere un cambio de infra**).
10. Solo tras verificar todo: `migrations/0006_drop_old_public_tables.sql` (**destructivo**, borra las tablas viejas `ad_creator_*` de `public`).

> ℹ️ En una instancia compartida donde las tablas ya existen con prefijo, en la práctica solo hay que correr `0004` (alinear columnas) y luego `0005` (mover a schema). `0001`–`0003` describen el esquema de una instancia dedicada hipotética.

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

## Schema dedicado (`ad_creator_image`)

Las tablas/vistas de esta app pasan a vivir en su propio schema `ad_creator_image`
(antes: schema `public` con prefijo `ad_creator_`). Se hace en **dos pasos** para
no perder datos:

- **`0005_copy_to_dedicated_schema.sql`** (no destructivo): crea copias fieles en
  el schema nuevo con `CREATE TABLE (LIKE ... INCLUDING ALL)` + `INSERT SELECT`,
  añade FKs/triggers/RLS y concede permisos a `service_role`. **Las tablas viejas
  de `public` quedan intactas** como red de seguridad. Idempotente (la copia usa
  `ON CONFLICT (id) DO NOTHING`).
- **`0006_drop_old_public_tables.sql`** (destructivo): borra las tablas viejas
  `public.ad_creator_*`. Correr **solo** tras verificar la app contra el schema
  nuevo (ver checklist dentro del propio fichero).

Verifica entre ambos pasos que los recuentos coinciden (query al final de `0005`).
Rollback antes de `0006`: apuntar la app a public+prefijo y
`drop schema ad_creator_image cascade;` — los datos originales siguen en `public`.

**⚠️ Requisito de infra (imprescindible).** PostgREST solo sirve los schemas de
una lista blanca. Hay que añadir el schema y **reiniciar** el contenedor `rest`:

```
PGRST_DB_SCHEMAS=public,storage,graphql_public,ad_creator_image
```

Sin esto, la app recibe `PGRST106: schema must be one of the following` aunque
las tablas existan. En Supabase *hosted* es Dashboard → Settings → API →
*Exposed schemas*; en self-hosted/Coolify es la env `PGRST_DB_SCHEMAS` del
servicio `rest`.

El código lo consume vía `SUPABASE_SCHEMA` (default `ad_creator_image`), que se
pasa a `createClient(..., { db: { schema } })` en `server.js`. Verifícalo tras
el deploy con `/api/supabase-ping` (campo `inventory.schema` + `writeProbe.ok`).

Orden de despliegue seguro: **(1)** correr la migración `0005` → **(2)** añadir
el schema a `PGRST_DB_SCHEMAS` y reiniciar `rest` → **(3)** desplegar el código
nuevo del server. Si se despliega el código antes de exponer el schema, la
persistencia falla hasta completar el paso 2.

## RLS (Row Level Security)

Activada en `0003_enable_rls.sql`. Desde 2026-09-08 la app tiene backend propio
(`server.js`) que habla con Supabase usando la **service key** — el navegador ya
no recibe ninguna credencial de Supabase. Con RLS activa y sin políticas para
`anon`, la anon key antigua queda inservible: nadie puede leer ni escribir con
ella. El `service_role` salta RLS por diseño (y además tiene política explícita,
mismo patrón que course-cover-engine).
