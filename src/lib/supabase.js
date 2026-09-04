import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[supabase] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
    "Las tarjetas del dashboard mostraran 0 hasta que estas variables esten configuradas."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");

// Nombres reales de tablas/vistas — deben calzar con supabase/migrations/*.sql
// (sin prefijo "ad_creator_": las tablas viven en el schema public de esta
// instancia de Supabase, que ya es especifica de este proyecto).
export const TABLES = {
  brands:     "brands",
  formats:    "formats",
  campaigns:  "campaigns",
  batches:    "batches",
  creatives:  "creatives",
};

export const VIEWS = {
  totals:  "v_stats_totals",
  weekly:  "v_stats_weekly",
  monthly: "v_stats_monthly",
};

export const BUCKETS = {
  creatives:    "creatives",
  brandAssets:  "brand-assets",
};

// ─── BRANDS ────────────────────────────────────────────────────────────
export async function fetchBrands() {
  const { data, error } = await supabase.from(TABLES.brands).select("*").order("created_at");
  if (error) throw error;
  return data || [];
}

// Upsert por slug. `row` debe traer `slug` (identificador estable, no cambia
// aunque se edite el nombre) ademas del resto de columnas de brands.
export async function saveBrand(row) {
  const { data, error } = await supabase
    .from(TABLES.brands)
    .upsert(row, { onConflict: "slug" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── BATCHES ───────────────────────────────────────────────────────────
export async function fetchRecentBatches(limit = 50) {
  const { data, error } = await supabase
    .from(TABLES.batches)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function createBatch(row) {
  const { data, error } = await supabase.from(TABLES.batches).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateBatch(id, patch) {
  const { data, error } = await supabase.from(TABLES.batches).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// ─── CREATIVES ─────────────────────────────────────────────────────────
export async function fetchCreatives(batchId) {
  const { data, error } = await supabase.from(TABLES.creatives).select("*").eq("batch_id", batchId);
  if (error) throw error;
  return data || [];
}

export async function insertCreative(row) {
  const { data, error } = await supabase.from(TABLES.creatives).insert(row).select().single();
  if (error) throw error;
  return data;
}

// ─── STORAGE ───────────────────────────────────────────────────────────
// dataUrlOrBase64: either a full "data:<mime>;base64,<data>" string or a bare
// base64 string (mimeHint used for the latter). Returns the storage path.
export async function uploadFile(bucket, path, dataUrlOrBase64, mimeHint = "image/png") {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrlOrBase64);
  const mime = match ? match[1] : mimeHint;
  const base64 = match ? match[2] : dataUrlOrBase64;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}
