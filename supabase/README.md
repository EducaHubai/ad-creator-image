# Supabase — ad-creator-image

Estructura de datos y storage para AdBatch en Supabase self-hosted.

## Como aplicar

### Opcion A: Studio (recomendada)

1. Abre Supabase Studio.
2. Ve a **SQL Editor**.
3. Copia el contenido de `migrations/0001_initial_schema.sql`.
4. Pega y click en **Run**.
5. Verifica en **Table Editor** que aparezcan las 5 tablas y las 3 vistas.

### Opcion B: psql (si te gusta la terminal)

```bash
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" \
  -f supabase/migrations/0001_initial_schema.sql
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

## Storage bucket

Despues de correr la migration, crea el bucket para las imagenes:

1. En Studio → **Storage** → **New bucket**.
2. Nombre: `creatives`.
3. Public: **No** (privado, se accede con URLs firmadas).
4. Click **Save**.

Estructura de rutas dentro del bucket:

```
creatives/
  {batch_id}/
    {creative_id}.png
```

## Retencion de imagenes (30 dias)

La tabla `creatives` ya tiene columna `expires_at` que se rellena automaticamente a 30 dias vista al insertar.

**Job de limpieza:** se implementara en n8n con schedule diario a las 04:00. Query base:

```sql
-- Lista imagenes expiradas que aun tienen path (no purgadas)
select id, image_path
from public.creatives
where expires_at < now()
  and image_path is not null
limit 1000;
```

El job:
1. Lista los `image_path` expirados.
2. Los borra del bucket `creatives` via Storage API.
3. Actualiza `image_path = null` en la tabla (mantiene metadata).

De momento la retencion es 30 dias. Ajustable cambiando el default en la tabla:

```sql
alter table public.creatives
  alter column expires_at set default (now() + interval '7 days');
```

## RLS (Row Level Security)

Desactivada por defecto en esta migration. Se activara cuando anadamos auth de usuario. Hasta entonces la app usa la `service_role key` para todas las operaciones (solo desde el servidor, nunca desde cliente).

## Proxima migration

`0002_auth_and_rls.sql` (pendiente): activara RLS y anadira policies por rol cuando integremos Supabase Auth.
