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
    {creative_id}.png

brand-assets/
  {brand_slug}/
    logo-white.png | logo-dark.png | logo-primary.png
    font-display.ttf | font-body.ttf
    ref-{n}.png
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

Desactivada por defecto en esta migration. Se activara cuando anadamos auth de usuario.

**Nota:** `ad-creator-image` es una SPA sin backend propio (Coolify solo sirve el build estatico via nginx), asi que a diferencia de lo planeado originalmente aca arriba (`service_role key` solo desde servidor), la app usa la **anon key** desde el cliente para leer y escribir estas tablas — igual que ya hacia para leer los stats del dashboard. Con RLS desactivada, cualquiera que llegue al bundle publicado tiene en teoria lectura/escritura completa via esa key. Aceptable mientras la herramienta sea de uso interno; revisar cuando se agregue Supabase Auth.

## Proxima migration

`0003_auth_and_rls.sql` (pendiente): activara RLS y anadira policies por rol cuando integremos Supabase Auth.
