import { useEffect, useRef, useState } from "react";
import { BrandField, SwatchRow, TagList } from "../components/brandFields.jsx";
import { RefImagesStrip, ZoomableThumb } from "../components/ui.jsx";
import { FORMATS } from "../lib/campaignOptions.js";
import { analyzeBrandPDF } from "../lib/copywriting.js";
import { analyzeRefImages, resizeImageFile } from "../lib/referenceImages.js";
import { useTheme } from "../theme/tokens.js";

// ─── BRAND STUDIO ────────────────────────────────────────────────────
const BRAND_TABS = ["Identidad", "Tokens", "Activos", "Tipografía", "Voz y reglas", "Config. anuncios", "Refs. visuales"];

// Keeps uploaded brandbook PDFs around for the tab's session (sessionStorage:
// survives a reload, gone when the tab closes) so testing the same PDF over
// and over doesn't mean re-picking it from disk each time. Not real
// persistence — per-browser-tab only, no sharing across users/devices.
function pdfSessionKey(brandId) { return `adbatch-pdfs-${brandId}`; }

function loadStoredPdfs(brandId) {
  try { return JSON.parse(sessionStorage.getItem(pdfSessionKey(brandId)) || "[]"); }
  catch { return []; }
}

function storePdfs(brandId, files) {
  try {
    if (files.length) sessionStorage.setItem(pdfSessionKey(brandId), JSON.stringify(files));
    else sessionStorage.removeItem(pdfSessionKey(brandId));
  } catch (err) {
    // Quota exceeded (PDFs are base64'd, ~33% bigger) — fine, just won't persist this time.
    console.warn("[session] No se pudo guardar el PDF para la sesión:", err.message);
  }
}

export function BrandsScreen({ brands, onSave }) {
  const T = useTheme();
  const [selectedBrand, setSelectedBrand] = useState(brands[0]?.id || "");
  const [activeTab, setActiveTab] = useState("Identidad");
  const brand = brands.find(b => b.id === selectedBrand) || brands[0];
  const [form, setForm] = useState(brand || {});
  const pdfRef = useRef();

  const [pdfFiles, setPdfFiles] = useState(() => loadStoredPdfs(brand?.id));
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false);

  useEffect(() => { setForm(brand || {}); setPdfFiles(loadStoredPdfs(selectedBrand)); setAnalyzeSuccess(false); setAnalyzeError(""); }, [selectedBrand]);

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // null | "saving" | "saved" | { error }
  const [saveStatus, setSaveStatus] = useState(null);
  async function save() {
    setSaveStatus("saving");
    try {
      const saved = await onSave({ ...form });
      // Al guardar una marca default por primera vez su id local ("b4") pasa
      // a ser el uuid de la BD — reapuntar la selección para no saltar de marca.
      if (saved?.id && saved.id !== selectedBrand) setSelectedBrand(saved.id);
      setSaveStatus("saved");
    } catch (err) {
      setSaveStatus({ error: err.message });
    }
  }

  async function handlePdfUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const loaded = await Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ name: file.name, base64: ev.target.result.split(",")[1], size: file.size });
      reader.readAsDataURL(file);
    })));
    setPdfFiles(prev => {
      const next = [...prev, ...loaded];
      storePdfs(selectedBrand, next);
      return next;
    });
    setAnalyzeSuccess(false);
    setAnalyzeError("");
  }

  async function runAnalysis() {
    if (!pdfFiles.length) return;
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalyzeSuccess(false);
    try {
      setAnalyzeProgress("Leyendo " + pdfFiles.length + " documento" + (pdfFiles.length > 1 ? "s" : "") + "...");
      const extracted = await analyzeBrandPDF(pdfFiles.map(p => p.base64), form.name || "");
      if (!extracted) throw new Error("No se pudo parsear la config de marca.");
      setForm(prev => ({ ...prev, ...extracted, id: prev.id || ("b_" + Date.now()) }));
      setAnalyzeSuccess(true);
      setAnalyzeProgress("");
      setActiveTab("Identidad");
    } catch (err) {
      setAnalyzeError(err.message || "Error en análisis. Intenta de nuevo.");
      setAnalyzeProgress("");
    }
    setAnalyzing(false);
  }

  const colors     = form.colors     || { primary: "#003a70", secondary: "#0070b8", accent: "#f5a623", background: "#f8f8f8", text_on_overlay: "#ffffff", cta_text: "#ffffff" };
  const voiceRules = form.voiceRules || { headline: [], body: [], forbidden: [] };
  const adRules    = form.adRules    || { formats: ["story", "feed_4x5"], ctas: ["Ver curso", "Empieza hoy"], mustInclude: ["course_title"], neverInclude: [] };

  const tabContent = {
    "Identidad": (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <BrandField label="Nombre de marca"  value={form.name}        onChange={v => f("name", v)} />
          <BrandField label="Idioma principal"  value={form.language}    onChange={v => f("language", v)} hint="es / en / pt" />
          <BrandField label="Tagline"           value={form.tagline}     onChange={v => f("tagline", v)} />
          <BrandField label="Sitio web"         value={form.website}     onChange={v => f("website", v)} />
        </div>
        <BrandField label="Posicionamiento" value={form.positioning} onChange={v => f("positioning", v)} hint="Una oración: qué hace esta marca y para quién." />
        <BrandField label="Audiencia objetivo" value={form.audience} onChange={v => f("audience", v)} />
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Etiquetas de personalidad</label>
          <TagList
            items={form.personality ? form.personality.split(",").map(s => s.trim()) : []}
            onRemove={i => { const a = form.personality?.split(",").map(s => s.trim()) || []; a.splice(i, 1); f("personality", a.join(", ")); }}
            onAdd={v => f("personality", [...(form.personality?.split(",").map(s => s.trim()) || []), v].join(", "))}
            placeholder="ej. authoritative" />
        </div>
      </div>
    ),
    "Tokens": (
      <div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>Los tokens de diseño se inyectan en cada plantilla de anuncio. Los colores son usados por el renderer para overlays, botones y acentos.</div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Paleta de colores</label>
          <SwatchRow colors={colors} onChange={v => f("colors", v)} />
        </div>
      </div>
    ),
    "Activos": (
      <div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>Los logos SVG/PNG se componen sobre cada anuncio vía Canvas. Se almacenan como datos en la config de marca.</div>
        {/* thumbBg: cada variante se previsualiza sobre el fondo para el que
            está pensada — un logo blanco sobre la tarjeta clara es invisible. */}
        {[
          { label: "Logo — blanco (sobre fondos oscuros)", key: "logoWhite",   accept: ".svg,.png", thumbBg: "#202020" },
          { label: "Logo — principal",                     key: "logoPrimary", accept: ".svg,.png", thumbBg: "#FFFFFF" },
          { label: "Logo — oscuro (sobre fondos claros)",  key: "logoDark",    accept: ".svg,.png", thumbBg: "#FFFFFF" },
        ].map(asset => {
          const aRef = useRef();
          const val = form[asset.key];
          const hasFile = val?.name || (typeof val === "string" && val);
          return (
            <div key={asset.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: `1px solid ${hasFile ? T.accent : T.cardBorder}`, borderRadius: 10, marginBottom: 8, background: T.card }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{asset.label}</div>
                <div style={{ fontSize: 11, color: hasFile ? T.tealText : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {val?.name || (typeof val === "string" && val) || "Sin archivo subido"}
                </div>
              </div>
              {/* .data es data URL (recién subido) o URL del proxy de storage
                  (cargado de la BD) — ambas renderizan en <img>. */}
              {val?.data && (
                <ZoomableThumb src={val.data} title={asset.label} style={{ height: 28, maxWidth: 80, objectFit: "contain", margin: "0 12px", background: asset.thumbBg, padding: 4, borderRadius: 6, border: `1px solid ${T.cardBorder}` }} />
              )}
              <button onClick={() => aRef.current?.click()} style={{ background: T.text, color: T.cream, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, flexShrink: 0 }}>Subir</button>
              <input ref={aRef} type="file" accept={asset.accept} style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => f(asset.key, { name: file.name, data: ev.target.result });
                reader.readAsDataURL(file);
              }} />
            </div>
          );
        })}
      </div>
    ),
    "Tipografía": (() => {
      const fontData = form.fontData || {};
      const setFontData = patch => f("fontData", { ...fontData, ...patch });
      const makeFontUpload = (label, dataKey, fileKey) => {
        const ref = useRef();
        const hasData = fontData[dataKey];
        return (
          <div style={{ background: T.card, border: `1px solid ${hasData ? T.accent : T.cardBorder}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => ref.current?.click()} style={{ background: T.text, color: T.cream, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, flexShrink: 0 }}>
                {hasData ? "Reemplazar .ttf" : "Subir .ttf"}
              </button>
              <span style={{ fontSize: 11, color: hasData ? T.tealText : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fontData[fileKey] || "Sin archivo — usa nombre CSS o URL del backend"}
              </span>
              <input ref={ref} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => setFontData({ [dataKey]: ev.target.result, [fileKey]: file.name });
                reader.readAsDataURL(file);
              }} />
            </div>
          </div>
        );
      };
      return (
        <div>
          <div style={{ padding: "10px 14px", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, marginBottom: 20, fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
            Canvas HTML estampa el copy usando las fuentes de marca. Sube .ttf directamente <em>o</em> proporciona la URL base del servidor de fuentes del backend.
          </div>
          <BrandField label="URL base servidor de fuentes (backend)" value={form.fontServerUrl} onChange={v => f("fontServerUrl", v)} hint="ej. https://assets.tu-backend.com/fonts" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <BrandField label="Nombre fuente display (CSS)" value={form.fonts?.display} onChange={v => f("fonts", { ...(form.fonts || {}), display: v })} hint="ej. Montserrat" />
            <BrandField label="Nombre fuente cuerpo (CSS)"  value={form.fonts?.body}    onChange={v => f("fonts", { ...(form.fonts || {}), body: v })}    hint="ej. Inter" />
          </div>
          {makeFontUpload("Fuente display (.ttf)", "displayData", "displayFile")}
          {makeFontUpload("Fuente cuerpo (.ttf)",  "bodyData",    "bodyFile")}
        </div>
      );
    })(),
    "Voz y reglas": (
      <div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reglas de titular</div>
          <TagList items={voiceRules.headline || []} onRemove={i => { const a = [...(voiceRules.headline || [])]; a.splice(i, 1); f("voiceRules", { ...voiceRules, headline: a }); }} onAdd={v => f("voiceRules", { ...voiceRules, headline: [...(voiceRules.headline || []), v] })} placeholder='ej. "Empieza con verbo de acción"' />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reglas de cuerpo de texto</div>
          <TagList items={voiceRules.body || []} onRemove={i => { const a = [...(voiceRules.body || [])]; a.splice(i, 1); f("voiceRules", { ...voiceRules, body: a }); }} onAdd={v => f("voiceRules", { ...voiceRules, body: [...(voiceRules.body || []), v] })} placeholder='ej. "Máx. 2-3 frases"' />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Palabras prohibidas</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Se inyectan como lista negra en el prompt. El modelo nunca las usará.</div>
          <TagList items={voiceRules.forbidden || []} onRemove={i => { const a = [...(voiceRules.forbidden || [])]; a.splice(i, 1); f("voiceRules", { ...voiceRules, forbidden: a }); }} onAdd={v => f("voiceRules", { ...voiceRules, forbidden: [...(voiceRules.forbidden || []), v] })} placeholder="Añadir palabra prohibida..." color="red" />
        </div>
        <div style={{ marginTop: 16 }}>
          <BrandField label="Tono general" value={form.tone} onChange={v => f("tone", v)} hint='Ej. "Seguro, directo. Nunca agresivo en ventas."' />
        </div>
      </div>
    ),
    "Config. anuncios": (
      <div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Formatos por defecto</label>
          {FORMATS.map(fmt => {
            const on = (adRules.formats || []).includes(fmt.id);
            return (
              <div key={fmt.id} onClick={() => { const cur = adRules.formats || []; f("adRules", { ...adRules, formats: on ? cur.filter(x => x !== fmt.id) : [...cur, fmt.id] }); }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = T.textMuted; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = T.cardBorder; }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: `1px solid ${on ? T.text : T.cardBorder}`, borderRadius: 8, marginBottom: 6, background: on ? "#F4F4F4" : T.card, cursor: "pointer", transition: "border-color 0.15s" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: on ? T.text : T.textMuted }}>{fmt.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>{fmt.dim}</span>
                  <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${on ? T.text : T.cardBorder}`, background: on ? T.text : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <span style={{ fontSize: 10, color: T.cream }}>✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>CTAs por defecto</label>
          <TagList items={adRules.ctas || []} onRemove={i => { const a = [...(adRules.ctas || [])]; a.splice(i, 1); f("adRules", { ...adRules, ctas: a }); }} onAdd={v => f("adRules", { ...adRules, ctas: [...(adRules.ctas || []), v] })} placeholder='ej. "Ver curso"' color="green" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Debe incluir</label>
            <TagList items={adRules.mustInclude || []} onRemove={i => { const a = [...(adRules.mustInclude || [])]; a.splice(i, 1); f("adRules", { ...adRules, mustInclude: a }); }} onAdd={v => f("adRules", { ...adRules, mustInclude: [...(adRules.mustInclude || []), v] })} placeholder="course_title" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Nunca incluir</label>
            <TagList items={adRules.neverInclude || []} onRemove={i => { const a = [...(adRules.neverInclude || [])]; a.splice(i, 1); f("adRules", { ...adRules, neverInclude: a }); }} onAdd={v => f("adRules", { ...adRules, neverInclude: [...(adRules.neverInclude || []), v] })} placeholder="competitor_names" color="red" />
          </div>
        </div>
      </div>
    ),
    "Refs. visuales": (() => {
      const refImgs = form.refImages || [];
      const refRef = useRef();
      const [analyzing, setAnalyzing] = useState(false);
      const [analyzeErr, setAnalyzeErr] = useState("");

      const addRefImages = e => {
        const files = Array.from(e.target.files);
        Promise.all(files.map(file => resizeImageFile(file).then(data => ({ name: file.name, data }))))
          .then(loaded => f("refImages", [...refImgs, ...loaded].slice(0, 8)));
      };

      const runRefAnalysis = async () => {
        if (!refImgs.length) return;
        setAnalyzing(true); setAnalyzeErr("");
        try {
          const descriptor = await analyzeRefImages(refImgs);
          f("brandImageStyle", descriptor);
        } catch (err) { setAnalyzeErr(err.message || "Error al analizar"); }
        setAnalyzing(false);
      };

      return (
        <div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
            Gemini analiza tus imágenes de referencia y extrae un descriptor visual de marca. Ese descriptor se inyecta en cada prompt de generación de imagen.
          </div>

          {/* Upload */}
          <div style={{ marginBottom: 16 }}>
            <RefImagesStrip images={refImgs}
              onRemove={i => f("refImages", refImgs.filter((_, j) => j !== i))}
              onAddClick={() => refRef.current?.click()}
              canAdd={refImgs.length < 8} />
          </div>
          <input ref={refRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addRefImages} />

          {/* Analyze button */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <button onClick={runRefAnalysis} disabled={analyzing || !refImgs.length}
              style={{ background: refImgs.length ? T.text : T.cardBorder, color: T.cream, fontSize: 12, fontWeight: 600, padding: "8px 18px", borderRadius: 999, opacity: analyzing ? 0.7 : 1 }}>
              {analyzing ? "Analizando…" : "✦ Analizar referencias con Gemini"}
            </button>
            {analyzeErr && <span style={{ fontSize: 11, color: T.statusFail.text }}>{analyzeErr}</span>}
          </div>

          {/* Style descriptor */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Descriptor visual de marca</label>
            <textarea
              value={form.brandImageStyle || ""}
              onChange={e => f("brandImageStyle", e.target.value)}
              placeholder="Se generará automáticamente al analizar las referencias. También puedes escribirlo manualmente."
              rows={4}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, fontSize: 12, lineHeight: 1.6, resize: "vertical", background: T.card, color: T.text, boxSizing: "border-box" }}
            />
          </div>
        </div>
      );
    })(),
  };

  return (
    <div className="fade-in content-area" style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Estudio de marca</h1>
        <button onClick={save} style={{ background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 700, padding: "8px 20px", borderRadius: 999 }}>✦ Publicar cambios</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>Marcas</div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            {brands.map((b, i) => (
              <button key={b.id} onClick={() => { setSelectedBrand(b.id); setActiveTab("Identidad"); setSaveStatus(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: selectedBrand === b.id ? T.text : "transparent", borderBottom: i < brands.length - 1 ? `1px solid ${T.cardBorder}` : "none", textAlign: "left" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.colors?.primary || (b.id === "b1" ? "#2672ea" : b.id === "b2" ? "#1b883c" : "#7f55e1"), flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: selectedBrand === b.id ? T.cream : T.text }}>{b.name}</div>
                  <div style={{ fontSize: 10, color: selectedBrand === b.id ? "rgba(255,255,255,0.5)" : T.textMuted }}>{b.language?.toUpperCase() || "ES"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <input ref={pdfRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={handlePdfUpload} />

          {pdfFiles.length === 0 ? (
            <div onClick={() => pdfRef.current?.click()}
              style={{ border: `1.5px dashed ${T.cardBorder}`, borderRadius: 12, padding: "20px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: T.cream, marginBottom: 20 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.textMuted}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
              <div style={{ width: 40, height: 48, borderRadius: 6, background: T.card, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📄</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Auto-rellenar desde documentos de marca</div>
                <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>Sube tu brandbook o guía de estilo en PDF. Claude leerá y pre-llenará todos los campos automáticamente.</div>
              </div>
              <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                <span style={{ background: T.text, color: T.cream, fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 999 }}>Subir PDF</span>
              </div>
            </div>
          ) : (
            <div style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 12, background: T.card, marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{pdfFiles.length} documento{pdfFiles.length > 1 ? "s" : ""} listo{pdfFiles.length > 1 ? "s" : ""} para analizar</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => pdfRef.current?.click()} style={{ background: "transparent", color: T.textMuted, fontSize: 11, border: `1px solid ${T.cardBorder}`, padding: "4px 10px", borderRadius: 999 }}>+ Agregar</button>
                    <button onClick={() => { setPdfFiles([]); storePdfs(selectedBrand, []); setAnalyzeSuccess(false); setAnalyzeError(""); }} style={{ background: "transparent", color: T.textMuted, fontSize: 11 }}>Limpiar ×</button>
                  </div>
                </div>
                {pdfFiles.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? `1px solid ${T.cardBorder}` : "none" }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <span style={{ fontSize: 12, flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{(p.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setPdfFiles(prev => {
                      const next = prev.filter((_, j) => j !== i);
                      storePdfs(selectedBrand, next);
                      return next;
                    })} style={{ background: "transparent", color: T.textMuted, fontSize: 13 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {analyzing && <div style={{ fontSize: 11, color: T.textMuted }}>{analyzeProgress}</div>}
                  {analyzeError && <div style={{ fontSize: 11, color: T.statusFail.text }}>{analyzeError}</div>}
                  {analyzeSuccess && <div style={{ fontSize: 11, color: T.statusDone.text }}>✓ Config extraída y aplicada — revisa cada pestaña y guarda.</div>}
                </div>
                <button onClick={runAnalysis} disabled={analyzing}
                  style={{ background: analyzing ? T.cardBorder : T.ctaDark, color: analyzing ? T.textMuted : T.accent, fontSize: 12, fontWeight: 700, padding: "9px 20px", borderRadius: 999, whiteSpace: "nowrap", cursor: analyzing ? "not-allowed" : "pointer" }}>
                  {analyzing ? "Analizando..." : "✦ Analizar documentos"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 24, gap: 0, overflowX: "auto" }}>
            {BRAND_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "8px 14px", background: "transparent", color: activeTab === tab ? T.text : T.textMuted, fontSize: 12, fontWeight: activeTab === tab ? 600 : 400, borderBottom: `2px solid ${activeTab === tab ? T.text : "transparent"}`, marginBottom: -1, whiteSpace: "nowrap" }}>
                {tab}
              </button>
            ))}
          </div>

          <div className="fade-in" key={activeTab}>
            {tabContent[activeTab]}
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {saveStatus && (
              <span role="status" style={{ fontSize: 12, marginRight: "auto", color: saveStatus === "saved" ? T.tealText : saveStatus === "saving" ? T.textMuted : T.coral }}>
                {saveStatus === "saving" ? "Guardando marca y assets…"
                  : saveStatus === "saved" ? "✓ Marca y assets guardados en Supabase"
                  : `No se pudo guardar: ${saveStatus.error}`}
              </span>
            )}
            <button onClick={() => { setForm(brand || {}); setSaveStatus(null); }} style={{ background: "transparent", color: T.textMuted, fontSize: 12, padding: "8px 16px", border: `1px solid ${T.cardBorder}`, borderRadius: 999 }}>Restablecer</button>
            <button onClick={save} disabled={saveStatus === "saving"} style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 600, padding: "8px 22px", borderRadius: 999, opacity: saveStatus === "saving" ? 0.6 : 1 }}>
              {saveStatus === "saving" ? "Guardando…" : "Guardar marca"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
