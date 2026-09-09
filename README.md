# AdBatch — ad-creator-image

Herramienta interna de EDUCA EDTECH para generar lotes de creatividades publicitarias:
sube un CSV/Excel de cursos, la IA investiga cada URL, genera copys y una imagen de
fondo por curso (diseño piloto opcional para fijar la dirección de arte), y compone
los anuncios en todos los formatos con logo y tipografías de la marca.

## Arquitectura

- **Frontend**: React + Vite (`src/App.jsx`). Sin credenciales: se compila una sola
  vez y toda la configuración le llega en runtime.
- **Server** (`server.js`, Express): sirve el build, proxya las llamadas LLM a
  LiteLLM (`POST /api/llm/chat`) y habla con Supabase usando la service key
  (`/api/db/*`, `/api/storage/*`). Mismo esquema que `course-cover-engine`.
- **Modelos** (vía proxy LiteLLM): texto con Gemini 2.5 (selector en la barra
  superior), imágenes con `gemini-3-pro-image` por chat/completions con
  `modalities: ["image","text"]`.
- **Persistencia**: Supabase (tablas `brands`/`batches`/`creatives` + buckets
  `creatives`/`brand-assets`). Migraciones en `supabase/migrations/`.

## Variables de entorno (runtime, sin prefijo VITE_)

```bash
LITELLM_API_KEY=       # key virtual de LiteLLM
LITELLM_BASE_URL=https://litellm-hel.hawkings.educaedtech.tools
SUPABASE_URL=
SUPABASE_SERVICE_KEY=  # service_role — solo la ve el server
GEMINI_API_KEY=        # key nativa de AI Studio — habilita el modo Batch (50% dto.)
APP_USER=              # opcional: Basic Auth delante de toda la app
APP_PASSWORD=
# PORT=3000
```

Ninguna llega al bundle del navegador; rotarlas en Coolify no requiere rebuild.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellena las variables
npm run server               # terminal 1 — API en :3000 (lee .env/.env.local)
npm run dev                  # terminal 2 — Vite en :5173 (proxy /api → :3000)
```

## Despliegue

`Dockerfile` multi-stage: compila Vite y arranca `node server.js` en el puerto 3000.
En Coolify, configurar las variables de arriba como variables de **runtime**.
