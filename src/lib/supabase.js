// Capa de datos del front. Mismas firmas que cuando esto usaba supabase-js
// directamente, pero ahora todo pasa por los endpoints del server (/api/db y
// /api/storage) — el server habla con Supabase usando su SERVICE key y ninguna
// credencial llega al navegador (mismo esquema que course-cover-engine).
// Nombres de tablas/buckets: ver server.js y supabase/migrations/*.sql.

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

// Solo los usa el front para nombrar rutas de subida; los buckets reales los
// valida el server (ALLOWED_BUCKETS).
export const BUCKETS = {
  creatives:    "creatives",
  brandAssets:  "brand-assets",
};

// ─── BRANDS ────────────────────────────────────────────────────────────
export async function fetchBrands() {
  return (await api("/api/db/brands")) || [];
}

// Upsert por slug. `row` debe traer `slug` (identificador estable, no cambia
// aunque se edite el nombre) ademas del resto de columnas de brands.
export async function saveBrand(row) {
  return api("/api/db/brands", { method: "POST", body: row });
}

// ─── BATCHES ───────────────────────────────────────────────────────────
export async function fetchRecentBatches(limit = 50) {
  return (await api(`/api/db/batches?limit=${limit}`)) || [];
}

export async function fetchBatch(id) {
  return api(`/api/db/batches/${id}`);
}

export async function createBatch(row) {
  return api("/api/db/batches", { method: "POST", body: row });
}

export async function updateBatch(id, patch) {
  return api(`/api/db/batches/${id}`, { method: "PATCH", body: patch });
}

// ─── CREATIVES ─────────────────────────────────────────────────────────
export async function fetchCreatives(batchId) {
  return (await api(`/api/db/creatives?batch_id=${encodeURIComponent(batchId)}`)) || [];
}

export async function insertCreative(row) {
  return api("/api/db/creatives", { method: "POST", body: row });
}

// ─── STORAGE ───────────────────────────────────────────────────────────
// dataUrlOrBase64: either a full "data:<mime>;base64,<data>" string or a bare
// base64 string (mimeHint used for the latter). Returns the storage path — que
// puede diferir del pedido: el server recomprime creatividades a .webp.
export async function uploadFile(bucket, path, dataUrlOrBase64, mimeHint = "image/png") {
  const { path: storedPath } = await api("/api/storage/upload", { method: "POST", body: { bucket, path, data: dataUrlOrBase64, mimeHint } });
  return storedPath || path;
}

export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  const { signedUrl } = await api("/api/storage/signed-url", { method: "POST", body: { bucket, path, expiresIn } });
  return signedUrl || null;
}
