// Config de runtime servida por server.js (/api/config) — sustituye a las
// variables VITE_* que antes se embebían en el bundle. Aquí solo llegan flags
// (hasLlmKey, hasSupabase): todas las credenciales, incluida la de Supabase,
// viven únicamente en el server.
export const appConfig = await fetch("/api/config")
  .then(r => (r.ok ? r.json() : {}))
  .catch(() => ({}));

if (!appConfig.hasSupabase) {
  console.warn("[supabase] El server no tiene SUPABASE_URL / SUPABASE_SERVICE_KEY configuradas — persistencia desactivada, el dashboard mostrará 0.");
}
