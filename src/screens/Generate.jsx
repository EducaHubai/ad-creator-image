import { useRef, useState } from "react";
import { ImageModeSelect, ImageModelSelect, TextModelSelect } from "../components/ModelSelects.jsx";
import { TemplateSetMapping, TemplateSetsStep } from "../components/TemplateSets.jsx";
import { CodeChip, RefImagesStrip, ZoomableThumb } from "../components/ui.jsx";
import { SelectPill, StepIndicator } from "../components/wizard.jsx";
import { ALL_CTAS, AUDIENCES, CTAS_BY_GOAL, FORMATS, GOALS, PAINS } from "../lib/campaignOptions.js";
import { estimateBatchCost, parseCustomDim } from "../lib/formats.js";
import { hasApiKey } from "../lib/llm.js";
import { batchAvailableFor, getImageModel, getImgMode, setImageModel, setImgMode } from "../lib/models.js";
import { parseFile, parseTable } from "../lib/parseFile.js";
import { analyzeRefImages, analyzeReferenceCreative } from "../lib/referenceImages.js";
import { BUCKETS, uploadFile } from "../lib/supabase";
import { autoMap, interpolate, textSlotsByProminence } from "../lib/template.js";
import { countPhotosPerRow, flattenTemplates, resolutionInfo, templateSetsIssues } from "../lib/templateSets.js";
import { useTheme } from "../theme/tokens.js";

const initialCfg = brands => ({
  brandId: brands[0]?.id || "",
  goal: "",
  audience: [],
  painPoints: [],
  ctas: [],
  formats: ["story", "feed_4x5"],
  csvText: "",
  courses: [],
  variantCount: 1,
  customDim: "",
  customDims: [],
  refImages: [],
  // Camino plantilla: resoluciones marcadas, resoluciones custom y plantillas
  // por resolución ({ [clave]: [plantilla] }).
  tplSelected: [],
  tplCustomDims: [],
  templateSets: {},
  sharePhoto: true,
  table: null,
});

const newBatchId = () => Date.now().toString();

// Aplica el mapeo automático de columnas a todas las plantillas (solo rellena
// lo que esté vacío: no pisa lo que el usuario ya mapeó).
function autoMapSets(sets, headers) {
  return Object.fromEntries(Object.entries(sets).map(([k, list]) => [k, list.map(t => t.slots.length ? autoMap(t, headers) : t)]));
}

export function Generate({ brands, onBatchCreated, onSaveBrand, path }) {
  const T = useTheme();
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState(() => initialCfg(brands));
  const patchCfg = fn => setCfg(p => ({ ...p, ...fn(p) }));
  const [customAudience, setCustomAudience] = useState("");
  const [customPain, setCustomPain] = useState("");
  const [customCta, setCustomCta] = useState("");
  const [uploadError, setUploadError] = useState("");

  const brand = brands.find(b => b.id === cfg.brandId) || brands[0];
  const suggestedCTAs = CTAS_BY_GOAL[cfg.goal] || ALL_CTAS.slice(0, 4);

  function toggle(key, val) {
    setCfg(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val] }));
  }
  function set(key, val) { setCfg(p => ({ ...p, [key]: val })); }

  // Shared between step 2 (scratch path) and step 4 (replicate path, next to
  // the uploaded reference creative) — same grid, same cfg.formats/customDim.
  function renderFormatsPicker() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
        {FORMATS.map(f => {
          const sel = cfg.formats.includes(f.id);
          const w = f.ratio === "9:16" ? 18 : f.ratio === "4:5" ? 22 : f.ratio === "1:1" ? 26 : 36;
          const h = f.ratio === "1.9:1" ? 18 : 26;
          return (
            <button key={f.id} onClick={() => toggle("formats", f.id)} style={{ padding: 12, border: `1.5px solid ${sel ? T.text : T.cardBorder}`, borderRadius: 12, background: sel ? T.text : T.card, textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ width: w, height: h, border: `1.5px solid ${sel ? T.cream : T.cardBorder}`, borderRadius: 3, marginBottom: 8, opacity: sel ? 0.6 : 1 }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: sel ? T.cream : T.text, marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 10, color: sel ? T.cream : T.textMuted, opacity: sel ? 0.8 : 1 }}>{f.dim}</div>
            </button>
          );
        })}
        {/* Custom formats — cada tamaño agregado es su propio chip, mismo
            estilo negro-seleccionado que los botones estándar. La card con
            "+" es solo la adición: escribir, Enter o click en "+" lo suma a
            la lista; se pueden agregar varios tamaños custom distintos. */}
        {cfg.customDims.map(d => (
          <div key={d} style={{ padding: 12, border: `1.5px solid ${T.text}`, borderRadius: 12, background: T.text, textAlign: "left", position: "relative" }}>
            <button
              onClick={() => set("customDims", cfg.customDims.filter(x => x !== d))}
              title="Quitar"
              style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.2)", color: T.cream, fontSize: 10, lineHeight: "16px", cursor: "pointer", padding: 0 }}
            >×</button>
            <div style={{ width: 28, height: 20, border: `1.5px solid ${T.cream}`, borderRadius: 3, marginBottom: 8, opacity: 0.6 }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: T.cream, marginBottom: 2 }}>Personalizado</div>
            <div style={{ fontSize: 10, color: T.cream, opacity: 0.8, fontFamily: "monospace" }}>{d}</div>
          </div>
        ))}
        {(() => {
          const typed = cfg.customDim.trim().length > 0;
          const parsed = parseCustomDim(cfg.customDim);
          const invalid = typed && !parsed;
          const normalized = parsed ? `${parsed.w}x${parsed.h}` : null;
          const dup = normalized && cfg.customDims.includes(normalized);
          const accent = "#963058";
          const canAdd = !!parsed && !dup;

          function addCustomDim() {
            if (!canAdd) return;
            setCfg(p => ({ ...p, customDims: [...p.customDims, normalized], customDim: "" }));
          }

          return (
            <div style={{ padding: 12, border: `1.5px solid ${invalid ? accent : T.cardBorder}`, borderRadius: 12, background: T.card, textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ width: 28, height: 20, border: `1.5px dashed ${T.cardBorder}`, borderRadius: 3, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700 }}>+</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 5 }}>Personalizado</div>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  value={cfg.customDim}
                  onChange={e => set("customDim", e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomDim(); } }}
                  placeholder="1200×800"
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, minWidth: 0, padding: "3px 6px", border: `1px solid ${invalid ? accent : T.cardBorder}`, borderRadius: 5, background: T.cream, fontSize: 10, color: T.text, fontFamily: "monospace" }}
                />
                <button
                  onClick={addCustomDim}
                  disabled={!canAdd}
                  title="Agregar tamaño"
                  style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: canAdd ? T.text : T.cardBorder, color: T.cream, fontSize: 13, fontWeight: 700, cursor: canAdd ? "pointer" : "not-allowed", flexShrink: 0 }}
                >+</button>
              </div>
              {dup && (
                <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>Ya está en la lista</div>
              )}
              {invalid && (
                <div style={{ fontSize: 9, color: accent, marginTop: 4 }}>Formato inválido — usá Anchoxalto, ej. 1200x800</div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  const logoRef = useRef();
  function handleLogoUpload(e) {
    const file = e.target.files[0]; if (!file || !brand) return;
    const reader = new FileReader();
    reader.onload = ev => Promise.resolve(onSaveBrand?.({ ...brand, logoPrimary: { name: file.name, data: ev.target.result } }))
      .catch(err => console.warn("[supabase] No se pudo guardar el logo:", err.message));
    reader.readAsDataURL(file);
  }

  const refImgRef = useRef();
  function handleRefImagesUpload(e) {
    const files = Array.from(e.target.files);
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ name: file.name, data: ev.target.result });
      reader.readAsDataURL(file);
    }))).then(loaded => set("refImages", [...cfg.refImages, ...loaded].slice(0, 6)));
  }

  const tableRef = useRef();
  async function handleTableFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploadError("");
    try {
      const table = await parseTable(file);
      if (!table.rows.length) { setUploadError("El archivo no tiene filas con datos."); return; }
      setCfg(p => ({ ...p, table, csvText: file.name, templateSets: autoMapSets(p.templateSets, table.headers) }));
    } catch (err) {
      setUploadError("Error al leer el archivo: " + (err.message || "formato no soportado"));
    }
  }

  const fileRef = useRef();
  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploadError("");
    try {
      const courses = await parseFile(file);
      if (courses.length === 0) {
        setUploadError("No se encontraron cursos. Verifica que el archivo tenga columnas 'name' y 'url'.");
        return;
      }
      set("courses", courses);
      set("csvText", file.name);
    } catch (err) {
      setUploadError("Error al leer el archivo: " + (err.message || "formato no soportado"));
    }
  }

  // A custom size only counts once it actually parses — typing garbage
  // used to silently fall back to a 1080×1080 default at generation time.
  const hasFormats = cfg.formats.length > 0 || cfg.customDims.length > 0;
  const usePilotFlowEstimate = path !== "replicate" && hasApiKey() && cfg.courses.length > 0 && cfg.courses.some(c => c.keywords5?.length);
  const [imageModel, setImageModelState] = useState(getImageModel);
  const [imgModeChoice, setImgModeChoice] = useState(getImgMode);
  // Un "batch" guardado no vale si el server no puede con el modelo actual.
  const imgMode = imgModeChoice === "batch" && batchAvailableFor(imageModel) ? "batch" : "rapid";
  // Camino plantilla: textos del CSV, 1 foto por fila, siempre en modo Rápido.
  const isTemplate = path === "template";
  const rowCount = isTemplate ? (cfg.table?.rows.length || 0) : cfg.courses.length;
  // Camino replicar: también plantillas por resolución (creatividades enteras,
  // sin cajas) — cada curso genera una imagen por plantilla.
  const isReplicate = path === "replicate";
  const tplList = isTemplate || isReplicate ? flattenTemplates(cfg.templateSets, cfg.tplSelected) : [];
  const photosPerRow = countPhotosPerRow(tplList, cfg.sharePhoto);
  const tplIssue = isTemplate ? templateSetsIssues(cfg) : isReplicate ? templateSetsIssues(cfg, { requireSlots: false }) : "";
  const { imagesEstimate, costEstimate } = isTemplate
    ? estimateBatchCost(rowCount * photosPerRow, false, imageModel, "rapid")
    : isReplicate
    ? estimateBatchCost(cfg.courses.length * tplList.length, false, imageModel, "rapid")
    : estimateBatchCost(cfg.courses.length, usePilotFlowEstimate, imageModel, imgMode);
  const adsTotal = isTemplate || isReplicate ? rowCount * tplList.length : cfg.courses.length * (cfg.formats.length + cfg.customDims.length) * cfg.variantCount;
  const [showCostConfirm, setShowCostConfirm] = useState(false);

  // Objetivo, audiencia, puntos de dolor y CTAs son opcionales — solo marca,
  // formatos y cursos son obligatorios para poder generar algo. Mismo orden
  // que el array `steps` armado más abajo — debe tener la misma longitud.
  const canProceedList = isTemplate
    ? [!!cfg.brandId, !tplIssue, rowCount > 0, true]
    : path === "replicate"
    ? [!!cfg.brandId, !tplIssue, cfg.courses.length > 0, true]
    : [!!cfg.brandId, true, hasFormats, cfg.courses.length > 0, true, true];
  const canProceed = canProceedList[step];

  const [launching, setLaunching] = useState(false);

  async function launchBatch() {
    setLaunching(true);
    let extraConfig = { path };
    if (isTemplate) {
      // Las plantillas ya están armadas y revisadas en el editor: cada fila
      // del CSV se vuelve un "curso" con su fila cruda y genera un anuncio por
      // plantilla de cada resolución marcada. Las referencias se suben a
      // storage para poder retomar el lote tras un reload (best-effort).
      const { table } = cfg;
      const templates = await Promise.all(tplList.map(async ({ _detecting, _detectError, ...t }) => {
        void _detecting; void _detectError;
        let referencePath = null;
        try {
          referencePath = await uploadFile(BUCKETS.brandAssets, `templates/${crypto.randomUUID()}.png`, t.referenceData);
        } catch (err) { console.warn("[supabase] No se pudo subir la referencia de la plantilla:", err.message); }
        return { ...t, referencePath };
      }));
      const first = templates[0];
      const titleSlot = textSlotsByProminence(first)[0];
      extraConfig = {
        ...extraConfig,
        templates,
        sharePhoto: cfg.sharePhoto,
        formats: [],
        customDims: templates.map(t => t.outLabel),
        courses: table.rows.map((row, i) => ({
          name: (titleSlot ? interpolate(titleSlot.content, row) : "") || row[first.titleColumn] || `Fila ${i + 1}`,
          row,
        })),
        table: undefined,
        templateSets: undefined,
      };
    } else if (path === "replicate") {
      // Analiza cada plantilla UNA vez acá — reemplaza por completo el
      // brainstorm de 5 direcciones + revisión: cada plantilla es un diseño
      // y cada curso genera una imagen por plantilla, en su resolución, con
      // la plantilla como referencia real (BatchProcessor: config.replicateRefs).
      // Se suben a storage para poder retomar el lote tras un reload.
      const replicateRefs = [];
      for (let o = 0; o < tplList.length; o += 3) {
        replicateRefs.push(...await Promise.all(tplList.slice(o, o + 3).map(async t => {
          let styleDescriptor = "", layout = null, referencePath = null;
          try { ({ description: styleDescriptor, layout } = await analyzeReferenceCreative(t.referenceData)); }
          catch (err) { console.warn("No se pudo analizar la plantilla:", t.referenceName, err.message); }
          try { referencePath = await uploadFile(BUCKETS.brandAssets, `replicate/${crypto.randomUUID()}.png`, t.referenceData); }
          catch (err) { console.warn("[supabase] No se pudo subir la plantilla:", err.message); }
          return { id: t.id, name: t.referenceName, outLabel: t.outLabel, outW: t.outW, outH: t.outH, data: t.referenceData, referencePath, styleDescriptor, layout };
        })));
      }
      extraConfig.replicateRefs = replicateRefs;
      extraConfig.formats = [];
      extraConfig.customDims = replicateRefs.map(r => r.outLabel);
      extraConfig.templateSets = undefined;
    } else {
      // Referencias visuales del lote (si las hay) se resumen una sola vez acá,
      // en un descriptor de texto que guía las 5 direcciones del piloto —
      // evita repetir el análisis de imagen en cada corrida del pipeline.
      let refImageDescriptor = "";
      if (cfg.refImages.length && hasApiKey()) {
        try { refImageDescriptor = await analyzeRefImages(cfg.refImages); }
        catch (err) { console.warn("No se pudieron analizar las referencias visuales:", err.message); }
      }
      extraConfig.refImageDescriptor = refImageDescriptor;
    }
    const batch = {
      id: newBatchId(),
      name: cfg.goal ? `${cfg.goal} — ${brand?.name}` : (brand?.name || "Lote"),
      brand: brand?.name || "Brand",
      brandId: cfg.brandId,
      status: "generating",
      createdAt: new Date().toISOString(),
      adsCount: 0,
      config: { ...cfg, ...extraConfig },
      items: [],
    };
    onBatchCreated(batch);
    setLaunching(false);
    setStep(0);
    setCfg(initialCfg(brands));
  }

  // Paso: Marca + Objetivo — shared by both paths.
  const stepBrand = (
    <div key="brand" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Configuración de campaña</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>{path === "replicate" || isTemplate ? "Elige tu marca." : "Elige tu marca y define el objetivo de campaña."}</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Marca</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {brands.map(b => (
            <button key={b.id} onClick={() => set("brandId", b.id)} style={{ padding: "8px 18px", borderRadius: 10, border: `1.5px solid ${cfg.brandId === b.id ? T.text : T.cardBorder}`, background: cfg.brandId === b.id ? T.text : T.card, color: cfg.brandId === b.id ? T.cream : T.text, fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {path !== "replicate" && !isTemplate && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
            Objetivo de campaña <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>opcional</span>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {GOALS.map(g => <SelectPill key={g} label={g} selected={cfg.goal === g} onClick={() => set("goal", g)} />)}
          </div>
        </div>
      )}

    </div>
  );

  // Paso: Audiencia + Puntos de dolor — scratch path only (replicate infers these).
  const stepAudience = (
    <div key="audience" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Audiencia y puntos de dolor <span style={{ color: T.textLight, fontWeight: 400, fontSize: 14 }}>(opcional)</span></h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>¿A quién te diriges y qué tensión resuelve esta campaña? Podés saltear este paso.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Audiencia objetivo <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>opcional — selecciona todas las que apliquen</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {AUDIENCES.map(a => <SelectPill key={a} label={a} selected={cfg.audience.includes(a)} onClick={() => toggle("audience", a)} />)}
        </div>
        {cfg.audience.filter(a => !AUDIENCES.includes(a)).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {cfg.audience.filter(a => !AUDIENCES.includes(a)).map(a => (
              <button key={a} onClick={() => toggle("audience", a)} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${T.accent}`, background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {a} <span style={{ opacity: 0.9, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={customAudience} onChange={e => setCustomAudience(e.target.value)} placeholder="Audiencia personalizada..."
            onKeyDown={e => { if (e.key === "Enter" && customAudience.trim()) { toggle("audience", customAudience.trim()); setCustomAudience(""); } }}
            style={{ flex: 1, padding: "7px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
          <button onClick={() => { if (customAudience.trim()) { toggle("audience", customAudience.trim()); setCustomAudience(""); } }}
            style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Principales puntos de dolor <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>opcional — hasta 3</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {PAINS.map(p => <SelectPill key={p} label={p} selected={cfg.painPoints.includes(p)} onClick={() => { if (cfg.painPoints.includes(p) || cfg.painPoints.length < 3) toggle("painPoints", p); }} />)}
        </div>
        {cfg.painPoints.filter(p => !PAINS.includes(p)).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {cfg.painPoints.filter(p => !PAINS.includes(p)).map(p => (
              <button key={p} onClick={() => toggle("painPoints", p)} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${T.accent}`, background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {p} <span style={{ opacity: 0.9, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={customPain} onChange={e => setCustomPain(e.target.value)} placeholder="Punto de dolor personalizado..."
            onKeyDown={e => { if (e.key === "Enter" && customPain.trim() && cfg.painPoints.length < 3) { toggle("painPoints", customPain.trim()); setCustomPain(""); } }}
            style={{ flex: 1, padding: "7px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
          <button onClick={() => { if (customPain.trim() && cfg.painPoints.length < 3) { toggle("painPoints", customPain.trim()); setCustomPain(""); } }}
            style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
        </div>
      </div>
    </div>
  );

  // Paso: CTAs + Formatos — scratch path only (replicate picks formats
  // alongside the reference creative instead, no CTAs step at all).
  const stepCtasFormats = (
    <div key="ctas-formats" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>CTAs y formatos</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Elige llamadas a la acción y formatos de salida para este lote.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          CTAs <span style={{ background: T.accent, color: T.accentDark, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: "1px 6px", textTransform: "none", marginLeft: 4 }}>inteligente</span>
          <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none", marginLeft: 6 }}>opcional — hasta 3, recomendadas para tu objetivo</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {suggestedCTAs.map(c => <SelectPill key={c} label={c} selected={cfg.ctas.includes(c)} onClick={() => { if (cfg.ctas.includes(c) || cfg.ctas.length < 3) toggle("ctas", c); }} accent />)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {ALL_CTAS.filter(c => !suggestedCTAs.includes(c)).map(c => <SelectPill key={c} label={c} selected={cfg.ctas.includes(c)} onClick={() => { if (cfg.ctas.includes(c) || cfg.ctas.length < 3) toggle("ctas", c); }} />)}
        </div>
        {cfg.ctas.filter(c => !ALL_CTAS.includes(c) && !suggestedCTAs.includes(c)).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {cfg.ctas.filter(c => !ALL_CTAS.includes(c) && !suggestedCTAs.includes(c)).map(c => (
              <button key={c} onClick={() => toggle("ctas", c)} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${T.accent}`, background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {c} <span style={{ opacity: 0.9, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={customCta} onChange={e => setCustomCta(e.target.value)} placeholder="CTA personalizado..."
            onKeyDown={e => { if (e.key === "Enter" && customCta.trim() && cfg.ctas.length < 3) { toggle("ctas", customCta.trim()); setCustomCta(""); } }}
            style={{ flex: 1, padding: "7px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
          <button onClick={() => { if (customCta.trim() && cfg.ctas.length < 3) { toggle("ctas", customCta.trim()); setCustomCta(""); } }}
            style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Formatos de anuncio</label>
        {renderFormatsPicker()}
      </div>
    </div>
  );

  // Paso: Cargar cursos — shared by both paths.
  const stepCourses = (
    <div key="courses" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Cargar cursos</h2>
      <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.8, marginBottom: 6 }}>
        Sube un CSV o Excel con al menos las columnas <CodeChip>course_name</CodeChip> y <CodeChip>url</CodeChip> — la IA hace el resto.
      </p>
      <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.8, marginBottom: 28 }}>
        También se acepta el formato Euroinnova <CodeChip>Título;Keywords Curso;Precio;Page URL</CodeChip> (delimitado por <CodeChip>;</CodeChip>): de cada curso se toman las 5 primeras keywords para el diseño piloto.
      </p>

      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods" onChange={handleFile} style={{ display: "none" }} />

      {uploadError && (
        <div style={{ padding: "10px 14px", background: T.statusFail.bg, border: `1px solid #f5c0c0`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.statusFail.text }}>
          {uploadError}
        </div>
      )}

      {cfg.courses.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.text; }}
          onDragLeave={e => e.currentTarget.style.borderColor = T.cardBorder}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.cardBorder; const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}
          style={{ border: `1.5px dashed ${T.cardBorder}`, borderRadius: 16, padding: "48px 32px", textAlign: "center", cursor: "pointer", background: T.card, transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.textMuted}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>↑</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Suelta tu CSV aquí</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>o haz clic para explorar — archivos .csv o .xlsx</div>
          <button style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 500, padding: "8px 20px", borderRadius: 999 }} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Explorar archivo</button>
          <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>↓ Descargar plantilla CSV</div>
        </div>
      ) : (() => {
        const hasKw = cfg.courses.some(c => c.keywords5?.length);
        const cols = hasKw ? "32px 70px 60px 1fr 1fr 1fr" : "32px 70px 80px 1fr 1fr";
        const heads = hasKw ? ["#", "Siglas", "Nivel", "Nombre del curso", "Keywords (top 5)", "URL"] : ["#", "Siglas", "Nivel", "Nombre del curso", "URL"];
        return (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{cfg.courses.length} cursos detectados{hasKw ? " · con keywords" : ""}</span>
            <button onClick={() => { set("courses", []); set("csvText", ""); }} style={{ fontSize: 11, color: T.textMuted, background: "transparent" }}>Limpiar ×</button>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, padding: "8px 16px", background: T.cream, borderBottom: `1px solid ${T.cardBorder}` }}>
              {heads.map(h => <span key={h} style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>)}
            </div>
            {cfg.courses.slice(0, 6).map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", borderBottom: i < Math.min(cfg.courses.length, 6) - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>{i + 1}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.accentDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.siglas || "—"}</span>
                <span style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.nivel || "—"}</span>
                <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{c.name}</span>
                {hasKw && <span style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{c.keywords5?.join(", ") || "—"}</span>}
                <span style={{ fontSize: 11, color: T.blueMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.url || "—"}</span>
              </div>
            ))}
            {cfg.courses.length > 6 && <div style={{ padding: "8px 16px", fontSize: 11, color: T.textMuted, background: T.cream }}>+ {cfg.courses.length - 6} más cursos</div>}
          </div>
        </div>
        );
      })()}
    </div>
  );

  // Shared logo block — used both in the replicate path's creative step and
  // the scratch path's refs+logo step.
  const logoBlock = (
    <div style={{ marginBottom: 28 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
        Logo de {brand?.name || "la marca"}
      </label>
      {(brand?.logoWhite || brand?.logoDark || brand?.logoPrimary) ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: `1px solid ${T.cardBorder}`, borderRadius: 10, background: T.card }}>
          {/* Preferir las variantes visibles sobre fondo claro; si solo hay
              logo blanco, previsualizarlo sobre fondo oscuro. */}
          {(brand.logoDark || brand.logoPrimary || brand.logoWhite)?.data && (
            <ZoomableThumb src={(brand.logoDark || brand.logoPrimary || brand.logoWhite).data} title={`Logo de ${brand?.name || "la marca"}`} style={{ height: 28, maxWidth: 100, objectFit: "contain", background: (brand.logoDark || brand.logoPrimary) ? "#FFFFFF" : "#202020", borderRadius: 4, padding: 4, border: `1px solid ${T.cardBorder}` }} />
          )}
          <span style={{ fontSize: 12, color: T.tealText }}>✓ Logo cargado — se usa en las creatividades generadas.</span>
          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>Para más versiones (blanco/oscuro): Estudio de marca → Activos</span>
        </div>
      ) : (
        <div>
          <div style={{ padding: "10px 14px", background: "#FFF6E0", border: "1px solid #E0B84D", borderRadius: 10, marginBottom: 10, fontSize: 12, color: "#8A6300" }}>
            Esta marca todavía no tiene logo — las creatividades se generan sin logo hasta que subas uno.
          </div>
          <input ref={logoRef} type="file" accept=".svg,.png" style={{ display: "none" }} onChange={handleLogoUpload} />
          <button onClick={() => logoRef.current?.click()} style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 500, padding: "8px 18px", borderRadius: 999 }}>
            Subir logo
          </button>
        </div>
      )}
    </div>
  );

  // Paso (replicate only): plantillas por resolución + logo.
  const stepReplicateCreative = (
    <div key="replicate-creative" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Resoluciones y plantillas</h2>
      <p style={{ fontSize: 14, color: T.textMuted, maxWidth: 640, margin: "0 auto 24px", lineHeight: 1.6 }}>Elegí en qué resoluciones generar y subí a cada una sus plantillas: anuncios ya hechos, de esta marca o de otra. Cada plantilla se replica en todos los cursos cambiando título, keywords e imagen.</p>
      <TemplateSetsStep cfg={cfg} patch={patchCfg} brand={brand} mode="replicate" />
      <div style={{ marginTop: 28 }}>{logoBlock}</div>
    </div>
  );

  // Paso (template only): resoluciones + plantillas por resolución.
  const stepTemplateCreative = (
    <div key="template-creative" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Resoluciones y plantillas</h2>
      <p style={{ fontSize: 14, color: T.textMuted, maxWidth: 640, margin: "0 auto 24px", lineHeight: 1.6 }}>Elegí en qué resoluciones generar y subí a cada una sus plantillas. La IA marca en cada plantilla la foto, los textos, el CTA y el logo; solo esas zonas cambian por fila y el resto del diseño queda idéntico.</p>
      <TemplateSetsStep cfg={cfg} patch={patchCfg} brand={brand} />
    </div>
  );

  // Paso (template only): CSV → mapeo de columnas a cada slot + vista previa.
  const stepTemplateCsv = (
    <div key="template-csv" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Datos del CSV</h2>
      <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7, marginBottom: 20 }}>
        Una fila = un anuncio. Asigná a cada elemento una columna con <CodeChip>{"{{Columna}}"}</CodeChip>, un texto fijo, o una mezcla.
      </p>
      <input ref={tableRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods" onChange={handleTableFile} style={{ display: "none" }} />
      {uploadError && (
        <div style={{ padding: "10px 14px", background: T.statusFail.bg, border: `1px solid #f5c0c0`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.statusFail.text }}>{uploadError}</div>
      )}
      {!cfg.table ? (
        <div onClick={() => tableRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleTableFile({ target: { files: [f] } }); }}
          style={{ border: `1.5px dashed ${T.cardBorder}`, borderRadius: 16, padding: "40px 32px", textAlign: "center", cursor: "pointer", background: T.card }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Suelta tu CSV o Excel aquí</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>o haz clic para explorar</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{cfg.table.rows.length} filas · {cfg.csvText}</span>
            <button onClick={() => setCfg(p => ({ ...p, table: null, csvText: "" }))} style={{ fontSize: 11, color: T.textMuted, background: "transparent" }}>Cambiar archivo ×</button>
          </div>
          <TemplateSetMapping cfg={cfg} patch={patchCfg} brand={brand} />
        </>
      )}
    </div>
  );

  // Paso (scratch only): referencias visuales + logo, opcional.
  const stepRefsLogo = (
    <div key="refs-logo" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Referencias visuales y logo <span style={{ color: T.textLight, fontWeight: 400, fontSize: 14 }}>(opcional)</span></h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Guían las 5 opciones de diseño del piloto. Podés saltear este paso.</p>

      {logoBlock}

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Referencias visuales <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>opcional — hasta 6</span>
        </label>
        <div style={{ marginBottom: 12 }}>
          <RefImagesStrip images={cfg.refImages}
            onRemove={i => set("refImages", cfg.refImages.filter((_, j) => j !== i))}
            onAddClick={() => refImgRef.current?.click()}
            canAdd={cfg.refImages.length < 6} />
        </div>
        <input ref={refImgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleRefImagesUpload} />
        <p style={{ fontSize: 11, color: T.textLight }}>Ej. moodboard, fotos de campañas anteriores, referencias de estilo. Se analizan una vez al lanzar el lote.</p>
      </div>
    </div>
  );
  // Paso: Confirmar — shared by both paths.
  const stepConfirm = (
    <div key="confirm" className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Listo para generar</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Revisa la configuración antes de lanzar.</p>

      {!hasApiKey() && (
        <div style={{ padding: "12px 16px", background: "#FFF6E0", border: "1px solid #E0B84D", borderRadius: 10, marginBottom: 20, fontSize: 12, color: "#8A6300", lineHeight: 1.5 }}>
          <strong>Aviso:</strong> sin LiteLLM key configurada — el lote generará solo copy, sin imágenes ni diseño piloto. Configura <CodeChip>LITELLM_API_KEY</CodeChip> en el entorno del server (Coolify) antes de lanzar si quieres imágenes.
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        {[
          ["Marca", brand?.name],
          ...(isTemplate
            ? [
                ["Plantillas", cfg.tplSelected.map(k => { const r = resolutionInfo(k); return `${r.w}×${r.h} (${(cfg.templateSets[k] || []).length})`; }).join(" · ")],
                ["Fotos nuevas por fila", photosPerRow ? `${photosPerRow}${cfg.sharePhoto ? " (compartidas entre plantillas con la misma proporción)" : " (una por plantilla)"}` : "ninguna — sin foto a reemplazar"],
                ["Filas", `${rowCount} filas × ${tplList.length} plantillas → ${adsTotal} anuncios`],
              ]
            : path === "replicate"
            ? [["Plantillas", cfg.tplSelected.map(k => { const r = resolutionInfo(k); return `${r.w}×${r.h} (${(cfg.templateSets[k] || []).length})`; }).join(" · ")]]
            : [
                ["Objetivo", cfg.goal || "—"],
                ["Audiencia", cfg.audience.join(", ") || "—"],
                ["Puntos de dolor", cfg.painPoints.join(" · ") || "—"],
                ["CTAs", cfg.ctas.join(" / ") || "—"],
              ]),
          ...(isTemplate ? [] : isReplicate ? [["Cursos", `${cfg.courses.length} cursos × ${tplList.length} plantillas → ${adsTotal} anuncios`]] : [["Formatos", [...cfg.formats.map(f => FORMATS.find(x => x.id === f)?.label).filter(Boolean), ...cfg.customDims.map(d => `Custom ${d}`)].join(", ")],
          ["Cursos", `${cfg.courses.length} cursos → ${cfg.courses.length * (cfg.formats.length + cfg.customDims.length)} anuncios`]]),
          ...(cfg.refImages.length ? [["Referencias visuales", `${cfg.refImages.length} imagen(es)`]] : []),
        ].map(([k, v], i, arr) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{k}</span>
            <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
          </div>
        ))}
      </div>

      {isTemplate && photosPerRow > 0 && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 16px", border: `1px solid ${T.cardBorder}`, borderRadius: 10, background: T.card, marginBottom: 16, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={cfg.sharePhoto} onChange={e => set("sharePhoto", e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            <b>Misma foto en todas las plantillas de una fila</b> (por proporción del hueco de foto)
            <span style={{ display: "block", color: T.textMuted, marginTop: 2 }}>Menos imágenes y las plantillas se comparan con la misma foto. Desmarcado: una foto distinta por plantilla ({rowCount * countPhotosPerRow(tplList, false)} imágenes).</span>
          </span>
        </label>
      )}
      {!isTemplate && <TextModelSelect />}
      <ImageModelSelect model={imageModel} onChange={id => { setImageModelState(id); setImageModel(id); }} />
      {!isTemplate && !isReplicate && <ImageModeSelect mode={imgMode} imageModel={imageModel} onChange={id => { setImgModeChoice(id); setImgMode(id); }} />}

      <div style={{ background: T.ctaDark, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 3 }}>Estimado: {adsTotal} creatividades · ~{imagesEstimate} imágenes (≈${costEstimate.toFixed(2)})</div>
          <div style={{ fontSize: 11, color: T.white, opacity: 0.75 }}>{isTemplate ? "Textos del CSV · la IA solo genera la foto de cada fila" : "La IA investigará cada URL y generará copy + prompts de imagen"}</div>
        </div>
        <button onClick={() => setShowCostConfirm(true)} disabled={launching} style={{ background: T.accent, color: T.accentDark, fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 999, whiteSpace: "nowrap", opacity: launching ? 0.7 : 1, cursor: launching ? "wait" : "pointer" }}>
          {launching ? "Analizando referencias…" : "✦ Lanzar lote"}
        </button>
      </div>

      {showCostConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setShowCostConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 16, padding: "28px 26px", maxWidth: 380, width: "90%", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>¿Lanzar este lote?</div>
            <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, marginBottom: 22 }}>
              Este lote generará <strong>~{imagesEstimate} imágenes</strong> (≈<strong>${costEstimate.toFixed(2)}</strong> estimado). Esta acción no se puede pausar a mitad de camino sin costo ya incurrido.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowCostConfirm(false)} style={{ background: "transparent", color: T.textMuted, fontSize: 13, fontWeight: 500, padding: "9px 18px", border: `1px solid ${T.cardBorder}`, borderRadius: 999 }}>Cancelar</button>
              <button onClick={() => { setShowCostConfirm(false); launchBatch(); }} style={{ background: T.accent, color: T.accentDark, fontSize: 13, fontWeight: 700, padding: "9px 20px", borderRadius: 999 }}>Continuar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Replicate has real fewer variables to set than scratch — brand, the
  // reference creative + its formats, then courses. No objetivo/audiencia/
  // dolor/CTAs step at all (copy generation infers those when unset).
  const steps = isTemplate
    ? [stepBrand, stepTemplateCreative, stepTemplateCsv, stepConfirm]
    : path === "replicate"
    ? [stepBrand, stepReplicateCreative, stepCourses, stepConfirm]
    : [stepBrand, stepAudience, stepCtasFormats, stepCourses, stepRefsLogo, stepConfirm];

  return (
    <div className="fade-in content-area" style={{ flex: 1 }}>
      <StepIndicator step={step} total={steps.length} />
      {steps[step]}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} style={{ background: "transparent", color: step === 0 ? T.textLight : T.textMuted, fontSize: 13, padding: "8px 0", opacity: step === 0 ? 0.55 : 1 }} disabled={step === 0}>← Atrás</button>
        {(isTemplate || isReplicate) && step === 1 && tplIssue && <span style={{ marginLeft: "auto", marginRight: 14, alignSelf: "center", fontSize: 12, color: T.textMuted }}>{tplIssue}</span>}
        {step < steps.length - 1 && <button onClick={() => {
          // Plantillas agregadas después de cargar el CSV: se mapean al entrar al paso del CSV.
          if (isTemplate && step === 1 && cfg.table) setCfg(p => ({ ...p, templateSets: autoMapSets(p.templateSets, p.table.headers) }));
          setStep(s => s + 1);
        }} disabled={!canProceed} style={{ background: canProceed ? T.text : T.cardBorder, color: canProceed ? T.cream : T.textMuted, fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 999, transition: "all 0.15s", cursor: canProceed ? "pointer" : "not-allowed" }}>Continuar →</button>}
      </div>
    </div>
  );
}
