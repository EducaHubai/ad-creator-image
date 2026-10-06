import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { GenerateChoice } from "./components/wizard.jsx";
import { DEFAULT_BRANDS, brandToRow, persistBrandAssets, rowToBrand } from "./lib/brands.js";
import { deleteBatch, fetchBrands, fetchRecentBatches, saveBrand } from "./lib/supabase";
import { BatchDetail } from "./screens/BatchDetail.jsx";
import { BatchProcessor } from "./screens/BatchProcessor.jsx";
import { Batches } from "./screens/Batches.jsx";
import { BrandsScreen } from "./screens/BrandsScreen.jsx";
import { Dashboard } from "./screens/Dashboard.jsx";
import { Generate } from "./screens/Generate.jsx";
import { globalCSS } from "./theme/globalCSS.js";
import { DARK, LIGHT, ThemeContext } from "./theme/tokens.js";

// ─── ROOT APP ────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [generatePath, setGeneratePath] = useState(null); // "scratch" | "replicate"
  const [batches, setBatches] = useState([]);
  const [brands, setBrands] = useState(DEFAULT_BRANDS);
  const [activeBatch, setActiveBatch] = useState(null);
  const [processingBatch, setProcessingBatch] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem("adbatch-theme") || "light"; } catch { return "light"; }
  });
  function toggleTheme() {
    setThemeName(prev => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem("adbatch-theme", next); } catch {}
      return next;
    });
  }
  const tokens = themeName === "dark" ? DARK : LIGHT;

  // Load brands from Supabase on mount, merged with the hardcoded defaults:
  // a DB row wins for any slug that has one; a default not yet in the DB
  // stays visible locally AND gets seeded in the background (so Euroinnova,
  // added after the 0001 seed, shows up for everyone once persisted). Any
  // brand that exists only in the DB (created via the UI previously) is
  // appended too. Never blocks the app — falls back to defaults on failure.
  useEffect(() => {
    (async () => {
      let rows;
      try { rows = await fetchBrands(); }
      catch (err) { console.warn("[supabase] No se pudieron cargar marcas, usando defaults:", err.message); return; }
      if (!rows.length) return;

      const bySlug = new Map(rows.map(r => [r.slug, r]));
      const merged = await Promise.all(DEFAULT_BRANDS.map(async def => {
        const row = bySlug.get(def.slug);
        if (row) { bySlug.delete(def.slug); return rowToBrand(row); }
        // Sembrar y adoptar el id (uuid) de la fila creada: si la marca se
        // queda con su id local ("b2"...), el brand_id del lote sería inválido.
        try {
          const saved = await saveBrand(brandToRow(def));
          return { ...def, id: saved.id, slug: saved.slug };
        } catch (err) {
          console.warn("[supabase] No se pudo sembrar marca:", def.slug, err.message);
          return def;
        }
      }));
      const extra = await Promise.all([...bySlug.values()].map(rowToBrand));
      setBrands([...merged, ...extra]);
    })();
  }, []);

  // Recent batches list, so "Lotes"/Dashboard survive a reload. Only
  // metadata — creatives (images) for a given batch load lazily when opened
  // (BatchDetail), not all up front.
  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchRecentBatches(50);
        setBatches(prev => {
          const localIds = new Set(prev.map(b => b.id));
          const fromDb = rows.filter(r => !localIds.has(r.id)).map(r => ({
            id: r.id,
            dbId: r.id,
            name: r.name || "Lote",
            brandId: r.brand_id,
            brand: DEFAULT_BRANDS.find(b => b.id === r.brand_id || b.slug === r.brand_id)?.name || "Marca",
            status: r.status === "done" ? "review" : r.status === "processing" || r.status === "pending" ? "generating" : r.status,
            createdAt: r.created_at,
            adsCount: r.ads_count || 0,
            // courses vive en su columna propia (config persistido ya no las
            // duplica); los lotes viejos aún las llevan dentro de config.
            config: { ...(r.config || {}), courses: r.config?.courses || r.courses || [] },
            items: [],
          }));
          return [...prev, ...fromDb];
        });
      } catch (err) {
        console.warn("[supabase] No se pudieron cargar lotes recientes:", err.message);
      }
    })();
  }, []);

  function onBatchCreated(batch) {
    setBatches(prev => [batch, ...prev]);
    setProcessingBatch(batch);
    setScreen("processing");
  }
  function onBatchUpdate(id, updates) {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    if (processingBatch?.id === id) setProcessingBatch(p => p ? { ...p, ...updates } : null);
    if (updates.status === "review") {
      setTimeout(() => { setScreen("batches"); setProcessingBatch(null); }, 1200);
    }
  }
  // Async y sin catch propio: el llamante (BrandStudio) muestra el estado de
  // guardado — antes los fallos morían en un console.warn y el usuario no
  // sabía si la marca se había guardado o no. Devuelve la marca final para
  // que la selección sobreviva al cambio de id local ("b4") → uuid de la BD.
  async function onSaveBrand(updated) {
    setBrands(prev => prev.map(b => b.id === updated.id ? updated : b));
    const withAssets = await persistBrandAssets(updated);
    const saved = await saveBrand(brandToRow(withAssets));
    const final = { ...withAssets, id: saved.id, slug: saved.slug };
    setBrands(prev => prev.map(b => b.id === updated.id ? final : b));
    return final;
  }
  // Borra el lote en la BD (fila + creatividades + bucket) y del estado local.
  // Lanza si la BD falla, para que Batches muestre el error y no desaparezca
  // de la lista un lote que sigue existiendo.
  async function onDeleteBatch(b) {
    if (b.dbId) await deleteBatch(b.dbId);
    setBatches(prev => prev.filter(x => x.id !== b.id));
    if (activeBatch?.id === b.id) { setActiveBatch(null); setScreen("batches"); }
  }
  function openBatch(b) {
    // A batch reopened from the DB list mid-generation (reload/closed tab,
    // status still "generating") resumes the pipeline instead of showing a
    // static detail view — BatchProcessor's persistBatchStart detects
    // batch.dbId + no in-memory items and picks up from imaged_course_ids.
    if (b.status === "generating" && b.dbId && !b.items?.length) {
      setProcessingBatch(b);
      setScreen("processing");
      return;
    }
    setActiveBatch(b);
    setScreen("batch-detail");
  }

  const creditsLeft = Math.max(0, 847 - batches.reduce((a, b) => a + (b.adsCount || 0), 0));
  const titleMap = { dashboard: "resumen", "generate-choice": "nuevo lote", generate: "nuevo lote", batches: "todos los lotes", brands: "estudio de marca", processing: "procesando", "batch-detail": "detalle del lote" };

  return (
    <ThemeContext.Provider value={{ tokens, themeName, toggle: toggleTheme }}>
      <style>{globalCSS}</style>
      <div className="app-shell" style={{ background: tokens.cream, color: tokens.text }}>
        <div className={`app-overlay${sidebarOpen ? " sidebar-open" : ""}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar active={screen} onNav={setScreen} batches={batches} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="app-content">
          <TopBar title={titleMap[screen] || screen} creditsLeft={creditsLeft} onNewBatch={() => setScreen("generate-choice")} onMenuToggle={() => setSidebarOpen(o => !o)} />
          <main style={{ flex: 1, overflowY: "auto", display: "flex" }}>
            {screen === "dashboard"    && <Dashboard batches={batches} onNewBatch={() => setScreen("generate-choice")} onNav={setScreen} />}
            {screen === "generate-choice" && <GenerateChoice onChoose={p => { setGeneratePath(p); setScreen("generate"); }} />}
            {screen === "generate"     && <Generate brands={brands} onBatchCreated={onBatchCreated} onSaveBrand={onSaveBrand} path={generatePath} />}
            {screen === "processing"   && processingBatch && <BatchProcessor batch={processingBatch} brands={brands} onUpdate={onBatchUpdate} />}
            {screen === "batches"      && <Batches batches={batches} onOpen={openBatch} onNav={setScreen} onDelete={onDeleteBatch} processingId={processingBatch?.id} />}
            {screen === "brands"       && <BrandsScreen brands={brands} onSave={onSaveBrand} />}
            {screen === "batch-detail" && activeBatch && <BatchDetail batch={activeBatch} onBack={() => setScreen("batches")} />}
          </main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
