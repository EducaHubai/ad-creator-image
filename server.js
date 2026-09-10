// Server fino (mismo esquema que course-cover-engine): sirve el build de Vite,
// proxya las llamadas LLM a LiteLLM y habla con Supabase usando la SERVICE key
// — ninguna credencial (ni siquiera la anon key) viaja al navegador. Todas las
// variables son de runtime: rotarlas en Coolify no requiere rebuild.
//
// Env: LITELLM_API_KEY, LITELLM_BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY,
//      SUPABASE_TABLE_PREFIX (default "ad_creator_" — el Supabase es compartido),
//      APP_USER + APP_PASSWORD (Basic Auth, opcional pero recomendado), PORT.
// El Supabase self-hosted (supabase-api.educahub.ai) sirve un certificado que
// no pasa verificación — sin esto, todos los fetch salientes fallan con
// "fetch failed" y no se persiste nada (mismo workaround que course-cover-engine).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import path from "node:path";
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
// Key nativa de Google AI Studio — solo para el modo Batch (50% más barato,
// asíncrono). El modo Rápido sigue yendo por LiteLLM.
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_BATCH_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_BATCH_IMAGE_MODEL = "gemini-3-pro-image-preview";

// El Supabase es una instancia compartida entre apps: las tablas de esta app
// viven con prefijo (ad_creator_brands, ad_creator_batches, ad_creator_creatives).
const TABLE_PREFIX = (process.env.SUPABASE_TABLE_PREFIX ?? "ad_creator_").trim();
const table = name => `${TABLE_PREFIX}${name}`;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
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
    hasBatchKey: !!GEMINI_API_KEY,
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
        headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      results[url] = { status: r.status, body: (await r.text()).slice(0, 120) };
    } catch (e) {
      results[url] = { error: e.message.slice(0, 80) };
    }
  }

  // Inventario real: tablas expuestas por PostgREST (raíz OpenAPI) y buckets de
  // Storage — para detectar de un vistazo desajustes de nombres como el del
  // prefijo ad_creator_.
  const inventory = { tablePrefix: TABLE_PREFIX, tables: null, columns: null, buckets: null };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      signal: AbortSignal.timeout(3000),
      headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const spec = await r.json();
    inventory.tables = Object.keys(spec?.paths || {}).filter(p => p !== "/").map(p => p.slice(1)).sort();
    // Columnas reales de las tablas de esta app: detecta esquemas desalineados
    // con las migraciones del repo (que siguen sin prefijo) sin acceso a psql.
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

// ── Gemini Batch API (modo Batch: 50% más barato, asíncrono hasta 24h) ───────
// Portado de course-cover-engine. Usa la key nativa de AI Studio, NO LiteLLM.
function requireBatchKey(res) {
  if (GEMINI_API_KEY) return true;
  res.status(503).json({ error: "GEMINI_API_KEY no configurada en el server" });
  return false;
}

// Cache de resultados: si el cliente reintenta tras un timeout, se sirve de
// memoria en vez de volver a descargar cientos de MB de Google.
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

// POST /api/batch/submit — items: [{id, prompt, aspectRatio}] (máx 100).
app.post("/api/batch/submit", async (req, res) => {
  if (!requireBatchKey(res)) return;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const displayName = String(req.body?.displayName || "adbatch").slice(0, 128);
  if (!items.length) return res.status(400).json({ error: "items array required" });
  if (items.length > 100) return res.status(400).json({ error: "max 100 items per batch" });

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

  const url = `${GEMINI_BATCH_BASE_URL}/models/${GEMINI_BATCH_IMAGE_MODEL}:batchGenerateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch: { displayName, inputConfig: { requests: { requests } } } }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("[batch/submit] failed:", JSON.stringify(data).slice(0, 400));
      return res.status(upstream.status).json({ error: data?.error?.message || "batch submit failed" });
    }
    res.json({
      name: data.name,
      state: data.metadata?.state || data.state || "JOB_STATE_PENDING",
      itemCount: items.length,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/batch/status?name=batches/xxx
// No se puede hacer GET del job directamente: cuando termina, la respuesta
// incluye TODAS las imágenes en base64 (cientos de MB). El endpoint LIST solo
// devuelve metadata (estado, contadores) — se busca el job ahí.
app.get("/api/batch/status", async (req, res) => {
  if (!requireBatchKey(res)) return;
  const name = String(req.query.name || "").trim();
  if (!name.startsWith("batches/")) return res.status(400).json({ error: "invalid batch name" });
  try {
    let pageToken = null, found = null;
    for (let pages = 0; pages < 10 && !found; pages++) {
      const params = new URLSearchParams({ key: GEMINI_API_KEY, pageSize: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const upstream = await fetch(`${GEMINI_BATCH_BASE_URL}/batches?${params}`);
      const list = await upstream.json();
      if (!upstream.ok) return res.status(upstream.status).json({ error: list?.error?.message || "status fetch failed" });
      found = (list.operations || []).find(op => op.name === name || op?.metadata?.name === name);
      pageToken = list.nextPageToken || null;
      if (!pageToken) break;
    }
    if (!found) return res.status(404).json({ error: "batch not found in recent list" });
    const md = found.metadata || {};
    const stats = md.batchStats || {};
    res.json({
      name: found.name || name,
      state: md.state || "JOB_STATE_UNSPECIFIED",
      completedCount: Number(stats.completedRequestCount || 0),
      failedCount: Number(stats.failedRequestCount || 0),
      totalCount: Number(stats.requestCount || 0),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/batch/results?name=batches/xxx — respuesta NDJSON en streaming:
// una línea {key, data, mime} o {key, error} por imagen, y {__done} al final.
// El body de Google (hasta ~500 MB con 100 imágenes) se procesa al vuelo con
// stream-json — bufferizarlo entero revienta V8 (lección de course-cover-engine).
app.get("/api/batch/results", async (req, res) => {
  if (!requireBatchKey(res)) return;
  const name = String(req.query.name || "").trim();
  if (!name.startsWith("batches/")) return res.status(400).json({ error: "invalid batch name" });

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

  try {
    const upstream = await fetch(`${GEMINI_BATCH_BASE_URL}/${name}?key=${encodeURIComponent(GEMINI_API_KEY)}`);
    if (!upstream.ok) {
      clearInterval(keepalive);
      const errText = await upstream.text();
      let errJson; try { errJson = JSON.parse(errText); } catch { errJson = { message: errText.slice(0, 300) }; }
      res.write(JSON.stringify({ __error: errJson?.error?.message || `upstream ${upstream.status}` }) + "\n");
      return res.end();
    }
    const pipeline = Readable.fromWeb(upstream.body)
      .pipe(streamJson.parser())
      .pipe(Pick.pick({ filter: "metadata.output.inlinedResponses.inlinedResponses" }))
      .pipe(StreamArray.streamArray());

    let processed = 0, errors = 0;
    const cacheLines = [];
    const writeLine = obj => {
      const line = JSON.stringify(obj) + "\n";
      cacheLines.push(line);
      res.write(line);
    };
    for await (const { value: entry } of pipeline) {
      const key = entry?.metadata?.key || "";
      if (entry?.error) {
        writeLine({ key, error: entry.error.message || "unknown error" });
        errors++;
        continue;
      }
      const parts = entry?.response?.candidates?.[0]?.content?.parts || [];
      const img = parts.find(p => p.inlineData?.data);
      if (!img) {
        writeLine({ key, error: "no image in response" });
        errors++;
        continue;
      }
      let b64 = img.inlineData.data;
      // Gemini a veces rellena con padding uniforme — trim conservador.
      try {
        b64 = (await sharp(Buffer.from(b64, "base64")).trim({ threshold: 12 }).png().toBuffer()).toString("base64");
      } catch { /* si el trim falla, va la original */ }
      writeLine({ key, data: b64, mime: "image/png" });
      processed++;
    }
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

app.post("/api/storage/signed-url", async (req, res) => {
  if (!requireDb(res)) return;
  const { bucket, path: filePath, expiresIn } = req.body || {};
  if (!ALLOWED_BUCKETS.has(bucket) || !filePath) {
    return res.status(400).json({ error: "bucket/path requeridos" });
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn || 3600);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ signedUrl: data?.signedUrl || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
