// Server fino (mismo esquema que course-cover-engine): sirve el build de Vite,
// proxya las llamadas LLM a LiteLLM y habla con Supabase usando la SERVICE key
// — ninguna credencial (ni siquiera la anon key) viaja al navegador. Todas las
// variables son de runtime: rotarlas en Coolify no requiere rebuild.
//
// Env: LITELLM_API_KEY, LITELLM_BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY,
//      SUPABASE_SCHEMA (OBLIGATORIA, sin default — el Supabase es compartido),
//      APP_USER + APP_PASSWORD (Basic Auth, opcional pero recomendado), PORT.
// El Supabase self-hosted (supabase-api.educahub.ai) sirve un certificado que
// no pasa verificación — sin esto, todos los fetch salientes fallan con
// "fetch failed" y no se persiste nada (mismo workaround que course-cover-engine).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import streamJson from "stream-json";
import Pick from "stream-json/filters/Pick.js";
import StreamArray from "stream-json/streamers/StreamArray.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const LITELLM_BASE_URL = (process.env.LITELLM_BASE_URL || "").trim().replace(/\/$/, "");
const LITELLM_API_KEY = (process.env.LITELLM_API_KEY || "").trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const APP_USER = process.env.APP_USER;
const APP_PASSWORD = process.env.APP_PASSWORD;
// Key nativa de Google AI Studio — solo para el modo Batch con modelos Gemini
// (50% más barato, asíncrono). El modo Rápido sigue yendo por LiteLLM, y el
// Batch del modelo de OpenAI también (managed batches con LITELLM_API_KEY).
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_BATCH_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// El Supabase es una instancia compartida entre apps: las tablas de esta app
// viven en un schema propio, no en el `public` compartido. SUPABASE_SCHEMA es
// OBLIGATORIA y SIN valor por defecto: preferimos fallar al arrancar antes que
// caer silenciosamente sobre el schema equivocado. Requisito de infra: el schema
// debe estar en PGRST_DB_SCHEMAS del contenedor `rest` (ver supabase/migrations/0005).
const SUPABASE_SCHEMA = (process.env.SUPABASE_SCHEMA ?? "").trim();
// Dentro del schema las tablas ya no llevan prefijo — el helper queda como
// identidad para no tocar los call sites (y por si algún día vuelve un prefijo).
const table = name => name;

// Fallo rápido: si Supabase está configurado, el schema es imprescindible.
if (SUPABASE_URL && SUPABASE_SERVICE_KEY && !SUPABASE_SCHEMA) {
  throw new Error("Falta SUPABASE_SCHEMA (obligatoria, sin valor por defecto). Defínela en el entorno del server.");
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: SUPABASE_SCHEMA } })
  : null;

if (!supabase) console.warn("⚠️  Supabase no configurado (SUPABASE_URL / SUPABASE_SERVICE_KEY) — persistencia desactivada.");
if (!LITELLM_BASE_URL || !LITELLM_API_KEY) console.warn("⚠️  LiteLLM no configurado (LITELLM_BASE_URL / LITELLM_API_KEY) — generación desactivada.");

const app = express();

// ── Basic Auth (igual que course-cover-engine): protege estáticos y /api ────
if (APP_USER && APP_PASSWORD) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Basic ")) {
      const [user, pass] = Buffer.from(auth.split(" ")[1], "base64").toString().split(":");
      if (user === APP_USER && pass === APP_PASSWORD) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="AdBatch"');
    return res.status(401).send("Autenticación requerida");
  });
}

// 50mb: PDFs de marca, imágenes de referencia y creatividades viajan en base64.
app.use(express.json({ limit: "50mb" }));

// Config pública para el front: solo flags, cero credenciales.
app.get("/api/config", (_req, res) => {
  res.json({
    hasLlmKey: !!(LITELLM_API_KEY && LITELLM_BASE_URL),
    hasSupabase: !!supabase,
    hasBatchKey: !!GEMINI_API_KEY, // Batch con modelos Gemini (el de OpenAI solo necesita LiteLLM)
  });
});

// Diagnóstico de conectividad con Supabase (portado de course-cover-engine):
// prueba la URL configurada y los hosts internos típicos de la red de Coolify.
// Útil porque la URL pública del Supabase self-hosted no siempre enruta.
app.get("/api/supabase-ping", async (_req, res) => {
  const probePath = `/rest/v1/${table("brands")}?select=slug&limit=1`;
  const candidates = [
    `${SUPABASE_URL}${probePath}`,
    `http://kong:8000${probePath}`,
    `http://supabase-kong:8000${probePath}`,
    `http://supabase_kong:8000${probePath}`,
    `http://rest:3001/${table("brands")}?select=slug&limit=1`,
    `http://supabase-rest:3001/${table("brands")}?select=slug&limit=1`,
  ];
  const results = {};
  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        // Accept-Profile: PostgREST lee de este schema en peticiones REST crudas
        // (supabase-js lo pone solo vía db.schema; aquí el fetch es manual).
        headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Accept-Profile": SUPABASE_SCHEMA },
      });
      results[url] = { status: r.status, body: (await r.text()).slice(0, 120) };
    } catch (e) {
      results[url] = { error: e.message.slice(0, 80) };
    }
  }

  // Inventario real: tablas expuestas por PostgREST (raíz OpenAPI) y buckets de
  // Storage — para detectar de un vistazo desajustes como que el schema
  // ad_creator_image no esté en PGRST_DB_SCHEMAS (saldría "tabla no expuesta").
  const inventory = { schema: SUPABASE_SCHEMA, tables: null, columns: null, buckets: null };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      signal: AbortSignal.timeout(3000),
      headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Accept-Profile": SUPABASE_SCHEMA },
    });
    const spec = await r.json();
    inventory.tables = Object.keys(spec?.paths || {}).filter(p => p !== "/").map(p => p.slice(1)).sort();
    // Columnas reales de las tablas de esta app: detecta esquemas desalineados
    // con las migraciones del repo sin necesidad de psql.
    const defs = spec?.definitions || {};
    inventory.columns = Object.fromEntries(["brands", "batches", "creatives"].map(t => [
      table(t),
      defs[table(t)] ? Object.keys(defs[table(t)].properties || {}).sort() : "tabla no expuesta",
    ]));
  } catch (e) {
    inventory.tables = `error: ${e.message.slice(0, 80)}`;
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      inventory.buckets = error ? `error: ${error.message.slice(0, 80)}` : (data || []).map(b => b.name).sort();
    } catch (e) {
      inventory.buckets = `error: ${e.message.slice(0, 80)}`;
    }
  }
  // Write-probe: los lotes "desaparecen" cuando un insert revienta y el front
  // solo hace console.warn — esto reproduce los inserts de createBatch e
  // insertCreative (mismas columnas) y devuelve el error exacto de PostgREST.
  let writeProbe = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(table("batches"))
        .insert({ name: "__supabase-ping__", status: "pending", brand_id: null, config: {}, courses: [], started_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) {
        writeProbe = { ok: false, table: table("batches"), error: error.message };
      } else {
        const { error: creativeErr } = await supabase
          .from(table("creatives"))
          .insert({ batch_id: data.id, image_path: null, width: 1080, height: 1080, format_label: "__probe__", params_json: {} })
          .select("id")
          .single();
        // El delete del batch arrastra la creative (FK on delete cascade).
        await supabase.from(table("batches")).delete().eq("id", data.id);
        writeProbe = creativeErr
          ? { ok: false, table: table("creatives"), error: creativeErr.message }
          : { ok: true };
      }
    } catch (e) {
      writeProbe = { ok: false, error: e.message.slice(0, 200) };
    }
  }

  res.json({ ...results, inventory, writeProbe });
});

// ── Modo Batch de imágenes (50% más barato, asíncrono hasta 24h) ─────────────
// Mismo esquema que course-cover-engine: un adaptador por proveedor con la
// tripleta submit / status / results, elegido por el modelo de imagen.
//   · Gemini (gemini-3-pro-image, gemini-3.1-flash-image): Batch API nativa de
//     Google con la key de AI Studio (GEMINI_API_KEY), NO LiteLLM.
//   · OpenAI (gpt-image-2.5-sunburst): Batch API de OpenAI a través de LiteLLM
//     ("managed batches": /v1/files + /v1/batches) con la misma LITELLM_API_KEY.
//     Requiere en el proxy un deployment con ese model_name y Postgres (managed
//     files) — ver .env.example.
// El cliente manda `model` en submit y en status/results (como query) para
// saber a qué proveedor hablar; el estado se normaliza a los JOB_STATE_* de
// Google para que el front no distinga.
//
// En la Batch API nativa 3 Pro Image lleva sufijo -preview; 3.1 Flash Image
// tiene el mismo id que en LiteLLM. Solo estos modelos están permitidos.
const GEMINI_BATCH_IMAGE_MODELS = {
  "gemini-3-pro-image": "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image": "gemini-3.1-flash-image",
};
const DEFAULT_GEMINI_BATCH_MODEL = "gemini-3-pro-image";
// Modelos de imagen de OpenAI: su id es el model_name del deployment en
// LiteLLM (mismo id en Rápido y en Batch). Calidad fija `high`.
const OPENAI_IMAGE_MODELS = new Set(["gpt-image-2.5-sunburst"]);
const OPENAI_IMAGE_QUALITY = "high";
const isOpenAIImageModel = m => OPENAI_IMAGE_MODELS.has(String(m || "").trim());

// Devuelve el adaptador del modelo o responde el error y devuelve null.
function batchProviderFor(model, res) {
  if (isOpenAIImageModel(model)) {
    if (LITELLM_API_KEY && LITELLM_BASE_URL) return openaiBatch;
    res.status(503).json({ error: "Faltan LITELLM_API_KEY / LITELLM_BASE_URL en el server" });
    return null;
  }
  if (model && !GEMINI_BATCH_IMAGE_MODELS[model]) {
    res.status(400).json({ error: `modelo de imagen no admitido en Batch: ${model}` });
    return null;
  }
  if (GEMINI_API_KEY) return geminiBatch;
  res.status(503).json({ error: "GEMINI_API_KEY no configurada en el server — el Batch con modelos Gemini no está disponible" });
  return null;
}

// Cache de resultados: si el cliente reintenta tras un timeout, se sirve de
// memoria en vez de volver a descargar cientos de MB del proveedor.
const batchResultsCache = new Map();
const BATCH_CACHE_TTL_MS = 60 * 60 * 1000;
const BATCH_CACHE_MAX = 5;
function batchCacheGet(name) {
  const hit = batchResultsCache.get(name);
  if (!hit) return null;
  if (Date.now() - hit.ts > BATCH_CACHE_TTL_MS) { batchResultsCache.delete(name); return null; }
  batchResultsCache.delete(name); batchResultsCache.set(name, hit); // LRU
  return hit;
}
function batchCacheSet(name, entries, processed, errors) {
  batchResultsCache.set(name, { entries, processed, errors, ts: Date.now() });
  while (batchResultsCache.size > BATCH_CACHE_MAX) {
    batchResultsCache.delete(batchResultsCache.keys().next().value);
  }
}

// Error de upstream con el status HTTP que se reenvía al cliente.
function upstreamError(status, message) {
  return Object.assign(new Error(message), { status });
}

// ── Adaptador Gemini (Batch API nativa de Google) ────────────────────────────
const geminiBatch = {
  validName: name => name.startsWith("batches/"),

  async submit(items, displayName, model) {
    const nativeModel = GEMINI_BATCH_IMAGE_MODELS[model || DEFAULT_GEMINI_BATCH_MODEL];
    const requests = items.map((it, i) => ({
      request: {
        contents: [{ parts: [{ text: String(it.prompt || "") }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: String(it.aspectRatio || "1:1") },
        },
      },
      metadata: { key: String(it.id ?? `req-${i}`) },
    }));
    const url = `${GEMINI_BATCH_BASE_URL}/models/${nativeModel}:batchGenerateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch: { displayName, inputConfig: { requests: { requests } } } }),
    });
    const data = await upstream.json();
    if (!upstream.ok) throw upstreamError(upstream.status, data?.error?.message || "batch submit failed");
    return { name: data.name, state: data.metadata?.state || data.state || "JOB_STATE_PENDING" };
  },

  // No se puede hacer GET del job directamente: cuando termina, la respuesta
  // incluye TODAS las imágenes en base64 (cientos de MB). El endpoint LIST solo
  // devuelve metadata (estado, contadores) — se busca el job ahí.
  async status(name) {
    let pageToken = null, found = null;
    for (let pages = 0; pages < 10 && !found; pages++) {
      const params = new URLSearchParams({ key: GEMINI_API_KEY, pageSize: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const upstream = await fetch(`${GEMINI_BATCH_BASE_URL}/batches?${params}`);
      const list = await upstream.json();
      if (!upstream.ok) throw upstreamError(upstream.status, list?.error?.message || "status fetch failed");
      found = (list.operations || []).find(op => op.name === name || op?.metadata?.name === name);
      pageToken = list.nextPageToken || null;
      if (!pageToken) break;
    }
    if (!found) throw upstreamError(404, "batch not found in recent list");
    const md = found.metadata || {};
    const stats = md.batchStats || {};
    return {
      name: found.name || name,
      state: md.state || "JOB_STATE_UNSPECIFIED",
      completedCount: Number(stats.completedRequestCount || 0),
      failedCount: Number(stats.failedRequestCount || 0),
      totalCount: Number(stats.requestCount || 0),
    };
  },

  // El body de Google (hasta ~500 MB con 100 imágenes) se procesa al vuelo con
  // stream-json — bufferizarlo entero revienta V8 (lección de course-cover-engine).
  async results(name, writeLine) {
    const upstream = await fetch(`${GEMINI_BATCH_BASE_URL}/${name}?key=${encodeURIComponent(GEMINI_API_KEY)}`);
    if (!upstream.ok) {
      const errText = await upstream.text();
      let errJson; try { errJson = JSON.parse(errText); } catch { errJson = { message: errText.slice(0, 300) }; }
      throw upstreamError(upstream.status, errJson?.error?.message || `upstream ${upstream.status}`);
    }
    const pipeline = Readable.fromWeb(upstream.body)
      .pipe(streamJson.parser())
      .pipe(Pick.pick({ filter: "metadata.output.inlinedResponses.inlinedResponses" }))
      .pipe(StreamArray.streamArray());
    for await (const { value: entry } of pipeline) {
      const key = entry?.metadata?.key || "";
      if (entry?.error) { writeLine({ key, error: entry.error.message || "unknown error" }); continue; }
      const parts = entry?.response?.candidates?.[0]?.content?.parts || [];
      const img = parts.find(p => p.inlineData?.data);
      if (!img) { writeLine({ key, error: "no image in response" }); continue; }
      let b64 = img.inlineData.data;
      // Gemini a veces rellena con padding uniforme — trim conservador.
      try {
        b64 = (await sharp(Buffer.from(b64, "base64")).trim({ threshold: 12 }).png().toBuffer()).toString("base64");
      } catch { /* si el trim falla, va la original */ }
      writeLine({ key, data: b64, mime: "image/png" });
    }
  },
};

// ── Adaptador OpenAI (Batch API de OpenAI vía LiteLLM managed batches) ───────
// Portado de course-cover-engine (jobs.js, openaiBatch*): el JSONL se sube a
// /v1/files con target_model_names=<modelo> (LiteLLM lo liga al deployment y
// el batch id que devuelve es "pegajoso" a él), el lote se crea en /v1/batches
// con endpoint /v1/images/generations y los resultados se leen de
// /v1/files/{output_file_id}/content (JSONL: una línea por request).
const litellmHeaders = (json = true) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  "Authorization": `Bearer ${LITELLM_API_KEY}`,
});

async function openaiBatchRetrieve(name) {
  const res = await fetch(`${LITELLM_BASE_URL}/v1/batches/${encodeURIComponent(name)}`, { headers: litellmHeaders(false) });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw upstreamError(res.status, `batch status ${res.status}: ${JSON.stringify(b).slice(0, 200)}`);
  return b;
}

// Lee un fichero JSONL de LiteLLM/OpenAI línea a línea (decenas de MB:
// imágenes en base64) sin acumularlo en memoria.
async function* openaiFileLines(fileId) {
  const res = await fetch(`${LITELLM_BASE_URL}/v1/files/${encodeURIComponent(fileId)}/content`, { headers: litellmHeaders(false) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw upstreamError(res.status, `batch file ${res.status}: ${t.slice(0, 200)}`);
  }
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    try { yield JSON.parse(s); } catch (e) { throw new Error(`invalid JSONL from OpenAI: ${e.message}`, { cause: e }); }
  }
}

const openaiBatch = {
  validName: name => /^[\w.=+/-]{1,512}$/.test(name),

  async submit(items, displayName, model) {
    const lines = items.map((it, i) => JSON.stringify({
      custom_id: String(it.id ?? `req-${i}`),
      method: "POST",
      url: "/v1/images/generations",
      body: {
        model, prompt: String(it.prompt || ""), n: 1,
        // Tamaño nativo del ratio (lo calcula el front: openaiSizeForAr).
        size: /^\d+x\d+$/.test(String(it.size || "")) ? it.size : "1024x1024",
        quality: OPENAI_IMAGE_QUALITY,
        // webp 90: el JSONL de salida pesa 5-10× menos que en PNG (pasa entero
        // por el proxy); results() lo reconvierte a PNG para el front.
        output_format: "webp",
        output_compression: 90,
      },
    }));
    const fd = new FormData();
    fd.append("purpose", "batch");
    fd.append("target_model_names", model);
    fd.append("file", new Blob([lines.join("\n") + "\n"], { type: "application/jsonl" }), `${displayName.replace(/[^\w.-]+/g, "_").slice(0, 80) || "adbatch"}.jsonl`);
    const up = await fetch(`${LITELLM_BASE_URL}/v1/files`, { method: "POST", headers: litellmHeaders(false), body: fd });
    const file = await up.json().catch(() => ({}));
    if (!up.ok) throw upstreamError(up.status, `batch file upload ${up.status}: ${JSON.stringify(file).slice(0, 200)}`);
    if (!file.id) throw new Error("batch file upload: respuesta sin id");
    const cr = await fetch(`${LITELLM_BASE_URL}/v1/batches`, {
      method: "POST", headers: litellmHeaders(),
      body: JSON.stringify({ input_file_id: file.id, endpoint: "/v1/images/generations", completion_window: "24h", metadata: { description: displayName.slice(0, 500) } }),
    });
    const batch = await cr.json().catch(() => ({}));
    if (!cr.ok) throw upstreamError(cr.status, `batch submit ${cr.status}: ${JSON.stringify(batch).slice(0, 200)}`);
    if (!batch.id) throw new Error("batch submit: respuesta sin id");
    return { name: batch.id, state: "JOB_STATE_PENDING" };
  },

  // Estados OpenAI (validating | in_progress | finalizing | completed | failed |
  // expired | cancelling | cancelled) → JOB_STATE_* de Google. Un lote
  // `completed` sin fichero de salida (todas las líneas rechazadas) cuenta
  // como FAILED.
  async status(name) {
    const b = await openaiBatchRetrieve(name);
    const rc = b.request_counts || {};
    const STATE = { validating: "JOB_STATE_PENDING", in_progress: "JOB_STATE_RUNNING", finalizing: "JOB_STATE_RUNNING", failed: "JOB_STATE_FAILED", expired: "JOB_STATE_EXPIRED", cancelling: "JOB_STATE_CANCELLED", cancelled: "JOB_STATE_CANCELLED" };
    const state = b.status === "completed"
      ? (b.output_file_id ? "JOB_STATE_SUCCEEDED" : "JOB_STATE_FAILED")
      : STATE[b.status] || "JOB_STATE_PENDING";
    return {
      name,
      state,
      completedCount: Number(rc.completed || 0),
      failedCount: Number(rc.failed || 0),
      totalCount: Number(rc.total || 0),
      message: b.errors?.data?.[0]?.message || null,
    };
  },

  async results(name, writeLine) {
    const b = await openaiBatchRetrieve(name);
    if (!b.output_file_id && !b.error_file_id) throw new Error(`batch results: el lote está en '${b.status}' sin ficheros de salida`);
    const lineErr = line => line?.error?.message || line?.response?.body?.error?.message || `HTTP ${line?.response?.status_code || "?"}`;
    // Fichero de salida: respuestas 200 (y errores por request que OpenAI deje
    // aquí con status_code ≠ 200).
    if (b.output_file_id) {
      for await (const line of openaiFileLines(b.output_file_id)) {
        const key = line?.custom_id || "";
        const body = line?.response?.body;
        if (line?.error || !body || Number(line?.response?.status_code || 200) !== 200) { writeLine({ key, error: lineErr(line) }); continue; }
        const img = Array.isArray(body.data) ? body.data.find(d => d?.b64_json) : null;
        if (!img) { writeLine({ key, error: "no image in response" }); continue; }
        let b64 = String(img.b64_json).replace(/[\r\n\s]/g, "");
        try {
          b64 = (await sharp(Buffer.from(b64, "base64")).png().toBuffer()).toString("base64");
        } catch (e) { writeLine({ key, error: `imagen ilegible: ${e.message}` }); continue; }
        writeLine({ key, data: b64, mime: "image/png" });
      }
    }
    // Fichero de errores: requests rechazadas (moderación, parámetros…).
    if (b.error_file_id) {
      for await (const line of openaiFileLines(b.error_file_id)) {
        writeLine({ key: line?.custom_id || "", error: lineErr(line) });
      }
    }
  },
};

// POST /api/batch/submit — {model, displayName, items: [{id, prompt, aspectRatio, size}]} (máx 100).
app.post("/api/batch/submit", async (req, res) => {
  const model = String(req.body?.model || DEFAULT_GEMINI_BATCH_MODEL).trim();
  const provider = batchProviderFor(model, res);
  if (!provider) return;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const displayName = String(req.body?.displayName || "adbatch").slice(0, 128);
  if (!items.length) return res.status(400).json({ error: "items array required" });
  if (items.length > 100) return res.status(400).json({ error: "max 100 items per batch" });
  try {
    const out = await provider.submit(items, displayName, model);
    res.json({ ...out, itemCount: items.length });
  } catch (err) {
    console.error(`[batch/submit] ${model} failed:`, err.message.slice(0, 400));
    res.status(err.status || 502).json({ error: err.message });
  }
});

// GET /api/batch/status?name=<id>&model=<modelo>
app.get("/api/batch/status", async (req, res) => {
  const model = String(req.query.model || DEFAULT_GEMINI_BATCH_MODEL).trim();
  const provider = batchProviderFor(model, res);
  if (!provider) return;
  const name = String(req.query.name || "").trim();
  if (!provider.validName(name)) return res.status(400).json({ error: "invalid batch name" });
  try {
    res.json(await provider.status(name));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// GET /api/batch/results?name=<id>&model=<modelo> — respuesta NDJSON en
// streaming: una línea {key, data, mime} o {key, error} por imagen, y {__done}
// al final (o {__error} si falla a mitad).
app.get("/api/batch/results", async (req, res) => {
  const model = String(req.query.model || DEFAULT_GEMINI_BATCH_MODEL).trim();
  const provider = batchProviderFor(model, res);
  if (!provider) return;
  const name = String(req.query.name || "").trim();
  if (!provider.validName(name)) return res.status(400).json({ error: "invalid batch name" });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders?.();
  const keepalive = setInterval(() => { try { res.write("\n"); } catch { /* closed */ } }, 10000);
  req.on("close", () => clearInterval(keepalive));

  const cached = batchCacheGet(name);
  if (cached) {
    clearInterval(keepalive);
    for (const line of cached.entries) res.write(line);
    res.write(JSON.stringify({ __done: true, processed: cached.processed, errors: cached.errors, cached: true }) + "\n");
    return res.end();
  }

  let processed = 0, errors = 0;
  const cacheLines = [];
  const writeLine = obj => {
    if (obj.error) errors++; else processed++;
    const line = JSON.stringify(obj) + "\n";
    cacheLines.push(line);
    res.write(line);
  };
  try {
    await provider.results(name, writeLine);
    clearInterval(keepalive);
    batchCacheSet(name, cacheLines, processed, errors);
    res.write(JSON.stringify({ __done: true, processed, errors }) + "\n");
    res.end();
  } catch (err) {
    clearInterval(keepalive);
    console.error("[batch/results] error:", err.message);
    try { res.write(JSON.stringify({ __error: err.message }) + "\n"); res.end(); } catch { /* closed */ }
  }
});

// ── LLM proxy ────────────────────────────────────────────────────────────────
app.post("/api/llm/chat", async (req, res) => {
  if (!LITELLM_API_KEY || !LITELLM_BASE_URL) {
    return res.status(500).json({ error: { message: "Faltan LITELLM_API_KEY / LITELLM_BASE_URL en el entorno del server" } });
  }
  try {
    const upstream = await fetch(`${LITELLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LITELLM_API_KEY}` },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: err.message } });
  }
});

// Proxy para modelos de imagen tipo OpenAI (gpt-image-2.5): usan la Images API,
// no chat/completions con modalities (eso es solo para los modelos de imagen de
// Gemini). Devuelven el PNG en data[0].b64_json.
app.post("/api/llm/images", async (req, res) => {
  if (!LITELLM_API_KEY || !LITELLM_BASE_URL) {
    return res.status(500).json({ error: { message: "Faltan LITELLM_API_KEY / LITELLM_BASE_URL en el entorno del server" } });
  }
  try {
    const upstream = await fetch(`${LITELLM_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LITELLM_API_KEY}` },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: err.message } });
  }
});

// ── Supabase: DB + Storage detrás del server ─────────────────────────────────
// El front llama a estos endpoints con las mismas semánticas que tenía con
// supabase-js; los nombres de tablas/buckets viven solo aquí.
function requireDb(res) {
  if (supabase) return true;
  res.status(503).json({ error: "Supabase no configurado en el server" });
  return false;
}

// Wraps a supabase query promise → JSON response with uniform error shape.
async function reply(res, promise) {
  try {
    const { data, error } = await promise;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get("/api/db/brands", (req, res) => {
  if (!requireDb(res)) return;
  reply(res, supabase.from(table("brands")).select("*").order("created_at"));
});

app.post("/api/db/brands", (req, res) => {
  if (!requireDb(res)) return;
  reply(res, supabase.from(table("brands")).upsert(req.body, { onConflict: "slug" }).select().single());
});

app.get("/api/db/batches", (req, res) => {
  if (!requireDb(res)) return;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  reply(res, supabase.from(table("batches")).select("*").order("created_at", { ascending: false }).limit(limit));
});

app.get("/api/db/batches/:id", (req, res) => {
  if (!requireDb(res)) return;
  reply(res, supabase.from(table("batches")).select("*").eq("id", req.params.id).single());
});

app.post("/api/db/batches", (req, res) => {
  if (!requireDb(res)) return;
  reply(res, supabase.from(table("batches")).insert(req.body).select().single());
});

app.patch("/api/db/batches/:id", (req, res) => {
  if (!requireDb(res)) return;
  reply(res, supabase.from(table("batches")).update(req.body).eq("id", req.params.id).select().single());
});

// Borra un lote y todo lo asociado: primero los archivos del bucket creatives
// (viven bajo el prefijo <batchId>/), después la fila — las filas de creatives
// caen solas por la FK on delete cascade. Si el borrado de Storage falla se
// sigue igualmente con la fila: mejor un huérfano en el bucket que un lote
// que no se puede eliminar.
app.delete("/api/db/batches/:id", async (req, res) => {
  if (!requireDb(res)) return;
  const id = req.params.id;
  try {
    for (;;) {
      const { data: files, error } = await supabase.storage.from("creatives").list(id, { limit: 100 });
      if (error || !files?.length) {
        if (error) console.warn(`[storage] No se pudieron listar creatividades de ${id}:`, error.message);
        break;
      }
      const { error: rmErr } = await supabase.storage.from("creatives").remove(files.map(f => `${id}/${f.name}`));
      if (rmErr) {
        console.warn(`[storage] No se pudieron borrar creatividades de ${id}:`, rmErr.message);
        break;
      }
      if (files.length < 100) break;
    }
    reply(res, supabase.from(table("batches")).delete().eq("id", id).select().maybeSingle());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Totales para las tarjetas del Dashboard. No usa la vista v_stats_totals:
// esa calcula tiempo ahorrado por creatives.format_id, que la app deja null
// (los formatos viajan en format_label) — aquí se casa format_label con
// formats.slug. Se traen los format_label de todas las creatividades (una
// columna text por fila); si esto crece a decenas de miles habría que moverlo
// a un RPC con agregación en SQL.
const STATS_DEFAULT_BASELINE_MIN = 5;
app.get("/api/db/stats", async (_req, res) => {
  if (!requireDb(res)) return;
  try {
    const [batches, brands, formats, creatives] = await Promise.all([
      supabase.from(table("batches")).select("id", { count: "exact", head: true }),
      supabase.from(table("brands")).select("id", { count: "exact", head: true }),
      supabase.from(table("formats")).select("slug,baseline_minutes"),
      supabase.from(table("creatives")).select("format_label"),
    ]);
    const err = batches.error || brands.error || formats.error || creatives.error;
    if (err) return res.status(500).json({ error: err.message });
    const baselines = new Map((formats.data || []).map(f => [f.slug, Number(f.baseline_minutes) || STATS_DEFAULT_BASELINE_MIN]));
    const minutes = (creatives.data || []).reduce((acc, c) => acc + (baselines.get(c.format_label) ?? STATS_DEFAULT_BASELINE_MIN), 0);
    res.json({
      batches_total: batches.count || 0,
      creatives_total: (creatives.data || []).length,
      formats_total: (formats.data || []).length,
      brands_total: brands.count || 0,
      time_saved_hours: Math.round((minutes / 60) * 10) / 10,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/db/creatives", (req, res) => {
  if (!requireDb(res)) return;
  if (!req.query.batch_id) return res.status(400).json({ error: "batch_id requerido" });
  reply(res, supabase.from(table("creatives")).select("*").eq("batch_id", req.query.batch_id));
});

app.post("/api/db/creatives", (req, res) => {
  if (!requireDb(res)) return;
  reply(res, supabase.from(table("creatives")).insert(req.body).select().single());
});

const ALLOWED_BUCKETS = new Set(["creatives", "brand-assets"]);

// El Supabase compartido no trae los buckets de esta app (el inventory del
// ping solo mostraba "covers", de course-cover-engine) — sin ellos, cada
// upload de creatividades/assets falla con "Bucket not found". Se crean al
// arrancar con la SERVICE key; idempotente.
async function ensureBuckets() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const existing = new Set((data || []).map(b => b.name));
    for (const name of ALLOWED_BUCKETS) {
      if (existing.has(name)) continue;
      const { error: createErr } = await supabase.storage.createBucket(name, { public: false });
      if (createErr) console.warn(`⚠️  No se pudo crear el bucket "${name}":`, createErr.message);
      else console.log(`Bucket "${name}" creado en Supabase Storage.`);
    }
  } catch (err) {
    console.warn("⚠️  No se pudieron verificar los buckets de Storage:", err.message);
  }
}

app.post("/api/storage/upload", async (req, res) => {
  if (!requireDb(res)) return;
  const { bucket, path: filePath, data, mimeHint } = req.body || {};
  if (!ALLOWED_BUCKETS.has(bucket) || !filePath || !data) {
    return res.status(400).json({ error: "bucket/path/data requeridos" });
  }
  const match = /^data:([^;]+);base64,(.*)$/s.exec(data);
  let mime = match ? match[1] : (mimeHint || "image/png");
  const base64 = match ? match[2] : data;
  // Sin este guard, cualquier string (p. ej. una URL firmada reenviada por
  // error) se decodificaría "como base64" y se subiría un archivo corrupto.
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64.slice(0, 256))) {
    return res.status(400).json({ error: "data debe ser un data URL base64 o base64 crudo" });
  }
  try {
    let bytes = Buffer.from(base64, "base64");
    let finalPath = filePath;
    // Las creatividades (PNG de canvas, ~2-3 MB) se recomprimen a WebP q85:
    // visualmente indistinguible en foto + texto, ~60-70% menos storage. Los
    // brand-assets (logos con alpha, fuentes ttf) se suben tal cual.
    if (bucket === "creatives" && /^image\/(png|jpeg)$/.test(mime)) {
      try {
        bytes = await sharp(bytes).webp({ quality: 85 }).toBuffer();
        mime = "image/webp";
        finalPath = filePath.replace(/\.(png|jpe?g)$/i, ".webp");
      } catch (e) {
        console.warn("[storage] WebP falló, subiendo original:", e.message);
      }
    }
    const { error } = await supabase.storage.from(bucket).upload(finalPath, bytes, { contentType: mime, upsert: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ path: finalPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy de lectura de Storage (patrón /api/img/* de course-cover-engine).
// Una signedURL generada aquí apuntaría a SUPABASE_URL (kong:8000), que el
// navegador no puede resolver — el Supabase solo es alcanzable desde la red
// interna de Coolify y su dominio público está roto a propósito. El server,
// que sí llega, descarga el objeto con la SERVICE key y lo sirve same-origin
// (bonus: los logos ya no contaminan el canvas del compositor).
app.get("/api/storage/file/:bucket/*path", async (req, res) => {
  if (!requireDb(res)) return;
  const { bucket } = req.params;
  const filePath = [].concat(req.params.path || []).join("/");
  if (!ALLOWED_BUCKETS.has(bucket) || !filePath) {
    return res.status(400).json({ error: "bucket/path requeridos" });
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) return res.status(404).json({ error: error.message });
    const buf = Buffer.from(await data.arrayBuffer());
    res.set("Content-Type", data.type || "application/octet-stream");
    // Las creatividades llevan uuid en el path (inmutables); los brand-assets
    // se reemplazan bajo el mismo nombre — caché corta para ver el cambio.
    res.set("Cache-Control", bucket === "creatives" ? "public, max-age=31536000, immutable" : "public, max-age=300");
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Estáticos + SPA fallback ─────────────────────────────────────────────────
const dist = path.join(__dirname, "dist");
// Los assets de Vite llevan hash en el nombre → cacheables para siempre.
app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "30d" }));
app.use(express.static(dist));
// SPA fallback (equivale al try_files de la config nginx anterior). Middleware
// en vez de app.get("*") — la sintaxis comodín cambió en Express 5.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: { message: "not found" } });
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`ad-creator-image escuchando en :${PORT}`);
  ensureBuckets();
});
