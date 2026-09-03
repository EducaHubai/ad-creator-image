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

// Nombres de tablas/vistas centralizados por si cambia el prefijo mas adelante.
export const TABLES = {
  brands:     "ad_creator_brands",
  formats:    "ad_creator_formats",
  campaigns:  "ad_creator_campaigns",
  batches:    "ad_creator_batches",
  creatives:  "ad_creator_creatives",
};

export const VIEWS = {
  totals:  "ad_creator_v_stats_totals",
  weekly:  "ad_creator_v_stats_weekly",
  monthly: "ad_creator_v_stats_monthly",
};
