import { useEffect, useRef, useState } from "react";
import { loadImage } from "../lib/composite.js";
import { detectTemplate } from "../lib/detectTemplate.js";
import { FORMATS } from "../lib/campaignOptions.js";
import { parseCustomDim } from "../lib/formats.js";
import { hasApiKey } from "../lib/llm.js";
import { SLOT_GROUPS, flattenTemplates, resolutionInfo, sizeMismatch, slotGroup } from "../lib/templateSets.js";
import { SLOT_TYPES, renderTemplate } from "../lib/template.js";
import { useTheme } from "../theme/tokens.js";
import { TemplateEditor } from "./TemplateEditor.jsx";
import { ZoomableThumb } from "./ui.jsx";

// Detección con IA de varias plantillas a la vez: como mucho 3 en paralelo.
const DETECT_CONCURRENCY = 3;
let detectRunning = 0;
const detectQueue = [];
function limitDetect(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      detectRunning++;
      fn().then(resolve, reject).finally(() => { detectRunning--; detectQueue.shift()?.(); });
    };
    if (detectRunning < DETECT_CONCURRENCY) run(); else detectQueue.push(run);
  });
}

function readTemplateFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async ev => {
      const data = ev.target.result;
      const img = await loadImage(data);
      if (!img) return resolve(null);
      resolve({
        id: crypto.randomUUID(),
        width: img.naturalWidth, height: img.naturalHeight,
        referenceData: data, referenceName: file.name,
        styleDescriptor: "", slots: [],
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// "9:16", "4:5", "1.91:1"… — la proporción en palabras de diseñador.
function ratioLabel({ w, h }) {
  const fmt = FORMATS.find(f => f.dim === `${w}×${h}`);
  if (fmt && fmt.ratio !== "1.9:1") return fmt.ratio;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(w, h);
  if (w / g <= 21 && h / g <= 21) return `${w / g}:${h / g}`;
  return w >= h ? `${(w / h).toFixed(2).replace(/0$/, "")}:1` : `1:${(h / w).toFixed(2).replace(/0$/, "")}`;
}

// Marco con la forma real de la resolución, dentro de una caja fija: con
// plantillas muestra la primera; sin ellas, la proporción escrita.
function RatioFrame({ res, src, dim, T }) {
  const box = 48;
  const s = box / Math.max(res.w, res.h);
  const w = Math.round(res.w * s), h = Math.round(res.h * s);
  return (
    <div aria-hidden style={{ width: box, height: box, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: w, height: h, borderRadius: 4, overflow: "hidden", border: `1.5px solid ${dim ? T.cardBorder : T.text}`, background: T.cream, display: "flex", alignItems: "center", justifyContent: "center", opacity: dim && src ? 0.55 : 1 }}>
        {src
          ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, letterSpacing: "-0.02em" }}>{ratioLabel(res)}</span>}
      </div>
    </div>
  );
}

// Interruptor accesible (role="switch"); no propaga el clic a la fila.
function Switch({ on, onChange, label, T }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={on ? "Se genera — clic para quitarla del lote" : "No se genera — clic para incluirla"}
      onClick={e => { e.stopPropagation(); onChange(); }} onKeyDown={e => e.stopPropagation()}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: 0, background: "transparent", flexShrink: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: on ? T.text : T.textLight, textAlign: "right" }}>Generar</span>
      <span style={{ position: "relative", width: 36, height: 20, borderRadius: 999, background: on ? T.accent : T.cardBorder, transition: "background 0.15s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.25)", transition: "left 0.15s" }} />
      </span>
    </button>
  );
}

// Paso "Resoluciones y plantillas". La casilla de cada resolución decide si
// se genera; el click en la tarjeta la abre para subir y editar sus
// plantillas. Estado en cfg: tplSelected, tplCustomDims, templateSets, table.
// `patch(fn)` aplica fn(cfgPrevio) → cambios parciales del cfg.
// mode "replicate": las plantillas son creatividades de referencia enteras —
// sin detección de cajas ni editor (la IA las replica como estilo).
export function TemplateSetsStep({ cfg, patch, brand, mode = "template" }) {
  const isReplicate = mode === "replicate";
  const T = useTheme();
  const [openKey, setOpenKey] = useState(cfg.tplSelected[0] || FORMATS[0].id);
  const [editingId, setEditingId] = useState(null);
  const [customInput, setCustomInput] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const keys = [...FORMATS.map(f => f.id), ...cfg.tplCustomDims];
  const openRes = resolutionInfo(openKey);
  const openList = cfg.templateSets[openKey] || [];
  const editing = openList.find(t => t.id === editingId) || openList[0] || null;

  function toggleSelected(key) {
    patch(p => ({ tplSelected: p.tplSelected.includes(key) ? p.tplSelected.filter(k => k !== key) : [...p.tplSelected, key] }));
  }
  function updateTemplate(key, id, changes) {
    patch(p => ({ templateSets: { ...p.templateSets, [key]: (p.templateSets[key] || []).map(t => t.id === id ? { ...t, ...(typeof changes === "function" ? changes(t) : changes) } : t) } }));
  }
  function removeTemplate(key, id) {
    patch(p => ({ templateSets: { ...p.templateSets, [key]: (p.templateSets[key] || []).filter(t => t.id !== id) } }));
    if (editingId === id) setEditingId(null);
  }

  async function detect(key, t) {
    updateTemplate(key, t.id, { _detecting: true, _detectError: "" });
    try {
      const d = await limitDetect(() => detectTemplate(t.referenceData));
      updateTemplate(key, t.id, { styleDescriptor: d.styleDescriptor, slots: d.slots, _detecting: false });
    } catch (err) {
      updateTemplate(key, t.id, { _detecting: false, _detectError: err.message || String(err) });
    }
  }

  async function addFiles(key, files) {
    const loaded = (await Promise.all(files.filter(f => f.type.startsWith("image/")).map(readTemplateFile))).filter(Boolean);
    if (!loaded.length) return;
    // Subir plantillas a una resolución la marca para generar.
    patch(p => ({
      templateSets: { ...p.templateSets, [key]: [...(p.templateSets[key] || []), ...loaded] },
      tplSelected: p.tplSelected.includes(key) ? p.tplSelected : [...p.tplSelected, key],
    }));
    setEditingId(loaded[0].id);
    if (hasApiKey() && !isReplicate) loaded.forEach(t => detect(key, t));
  }

  function addCustom() {
    const d = parseCustomDim(customInput);
    if (!d) return;
    const key = `${d.w}x${d.h}`;
    if (!cfg.tplCustomDims.includes(key)) patch(p => ({ tplCustomDims: [...p.tplCustomDims, key] }));
    setOpenKey(key);
    setCustomInput("");
    setAddingCustom(false);
  }
  function removeCustom(key) {
    patch(p => {
      const sets = { ...p.templateSets };
      delete sets[key];
      return { tplCustomDims: p.tplCustomDims.filter(k => k !== key), tplSelected: p.tplSelected.filter(k => k !== key), templateSets: sets };
    });
    if (openKey === key) setOpenKey(FORMATS[0].id);
  }

  const included = cfg.tplSelected.filter(k => resolutionInfo(k));
  const total = flattenTemplates(cfg.templateSets, cfg.tplSelected).length;
  const customParsed = parseCustomDim(customInput);
  const openIncluded = cfg.tplSelected.includes(openKey);
  const unit = isReplicate ? "curso" : "fila del CSV";

  function openResolution(key) { setOpenKey(key); setEditingId(null); }

  // Tamaño de las fichas del panel: la forma real de la resolución.
  const tileH = 168;
  const tileW = openRes ? Math.min(300, Math.round(tileH * openRes.w / openRes.h)) : tileH;

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Lista de resoluciones */}
        <div role="listbox" aria-label="Resoluciones" style={{ flex: "1 1 340px", maxWidth: "100%", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
          {keys.map(key => {
            const res = resolutionInfo(key);
            const list = cfg.templateSets[key] || [];
            const on = cfg.tplSelected.includes(key);
            const open = key === openKey;
            const custom = !FORMATS.some(f => f.id === key);
            const status = list.length
              ? { text: `${list.length} plantilla${list.length > 1 ? "s" : ""}`, color: on ? T.tealText : T.textMuted }
              : on ? { text: "Falta subir plantillas", color: T.accent } : { text: "Sin plantillas", color: T.textLight };
            return (
              <div key={key} role="option" aria-selected={open} tabIndex={0}
                onClick={() => openResolution(key)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openResolution(key); } }}
                className="res-row"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px 14px 13px", borderLeft: `3px solid ${open ? T.accent : "transparent"}`, borderBottom: `1px solid ${T.cardBorder}`, background: open ? T.cream : "transparent", cursor: "pointer" }}>
                <RatioFrame res={res} src={list[0]?.referenceData} dim={!on} T={T} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{res.label}</span>
                    {custom && (
                      <button onClick={e => { e.stopPropagation(); removeCustom(key); }} aria-label={`Quitar ${res.w} × ${res.h}`} title="Quitar resolución"
                        style={{ fontSize: 11, color: T.textLight, background: "transparent", padding: "0 2px" }}>Quitar</button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{res.w} × {res.h}</div>
                  <div style={{ fontSize: 12, color: status.color, marginTop: 3, fontWeight: list.length || on ? 500 : 400 }}>{status.text}</div>
                </div>
                <Switch on={on} onChange={() => toggleSelected(key)} label={`Generar ${res.label} ${res.w} × ${res.h}`} T={T} />
              </div>
            );
          })}
          {addingCustom ? (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Ancho × alto en píxeles</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus value={customInput} onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCustom(); if (e.key === "Escape") { setAddingCustom(false); setCustomInput(""); } }}
                  placeholder="1200 × 800" aria-label="Nueva resolución, ancho por alto"
                  style={{ flex: 1, minWidth: 0, padding: "7px 10px", border: `1px solid ${customInput && !customParsed ? T.accent : T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 13, color: T.text }} />
                <button onClick={addCustom} disabled={!customParsed} style={{ padding: "7px 14px", borderRadius: 8, background: customParsed ? T.text : T.cardBorder, color: customParsed ? T.card : T.textMuted, fontSize: 12, fontWeight: 600 }}>Añadir</button>
              </div>
              {customInput && !customParsed && <div style={{ fontSize: 11, color: T.accent, marginTop: 5 }}>Escribí dos números, por ejemplo 1200 × 800.</div>}
            </div>
          ) : (
            <button onClick={() => setAddingCustom(true)} style={{ width: "100%", textAlign: "left", padding: "13px 16px", background: "transparent", fontSize: 13, fontWeight: 600, color: T.blueMid }}>
              + Otra resolución
            </button>
          )}
        </div>

        {/* Panel de la resolución abierta */}
        {openRes && (
          <section aria-label={`Plantillas de ${openRes.label}`} style={{ flex: "999 1 420px", minWidth: 0, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: T.text, margin: 0 }}>{openRes.label}</h3>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{openRes.w} × {openRes.h} px, proporción {ratioLabel(openRes)}</div>
              </div>
              <Switch on={openIncluded} onChange={() => toggleSelected(openKey)} label={`Generar ${openRes.label}`} T={T} />
            </div>

            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(openKey, Array.from(e.dataTransfer.files)); }}
              style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start", padding: 4, margin: -4, borderRadius: 12, outline: dragOver ? `2px dashed ${T.accent}` : "none" }}>
              {openList.map((t, i) => {
                const mismatch = sizeMismatch(t, openRes);
                const sel = !isReplicate && editing?.id === t.id;
                const state = isReplicate ? null
                  : t._detecting ? { text: "Detectando elementos…", color: T.blueMid }
                  : t._detectError ? { text: "No se pudo detectar", color: T.statusFail.text }
                  : t.slots.length ? { text: `${t.slots.length} elementos marcados`, color: T.tealText }
                  : { text: "Sin elementos marcados", color: T.accent };
                return (
                  <figure key={t.id} style={{ width: tileW, margin: 0 }}>
                    <div onClick={() => !isReplicate && setEditingId(t.id)}
                      style={{ position: "relative", width: tileW, height: tileH, borderRadius: 8, overflow: "hidden", background: T.cream, cursor: isReplicate ? "default" : "pointer", boxShadow: sel ? `0 0 0 2px ${T.card}, 0 0 0 4px ${T.accent}` : `inset 0 0 0 1px ${T.cardBorder}` }}>
                      {isReplicate
                        ? <ZoomableThumb src={t.referenceData} title={`P${i + 1} · ${t.referenceName}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : <img src={t.referenceData} alt={t.referenceName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                      <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(32,32,32,0.82)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>P{i + 1}</span>
                      <button onClick={e => { e.stopPropagation(); removeTemplate(openKey, t.id); }} aria-label={`Quitar plantilla P${i + 1}`} title="Quitar plantilla"
                        style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(32,32,32,0.82)", color: "#fff", fontSize: 13, lineHeight: "22px", padding: 0 }}>×</button>
                    </div>
                    <figcaption style={{ marginTop: 6 }}>
                      <div title={t.referenceName} style={{ fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.referenceName}</div>
                      {state && <div style={{ fontSize: 11, color: state.color, marginTop: 1 }}>{state.text}</div>}
                      {mismatch && <div style={{ fontSize: 11, color: "#8A6300", marginTop: 1 }}>Mide {t.width} × {t.height}: {mismatch === "scale" ? "se escalará" : "se recortará al centro"}</div>}
                    </figcaption>
                  </figure>
                );
              })}
              <button onClick={() => fileRef.current?.click()}
                style={{ width: openList.length ? tileW : Math.max(tileW, 220), height: tileH, borderRadius: 8, border: `1.5px dashed ${dragOver ? T.accent : T.textLight}`, background: dragOver ? T.statusFail.bg : "transparent", color: T.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, textAlign: "center" }}>
                <span aria-hidden style={{ fontSize: 26, lineHeight: 1, color: T.accent }}>+</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{openList.length ? "Añadir plantillas" : "Subir plantillas"}</span>
                {!openList.length && <span style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>Arrastralas aquí o elegilas. Cada imagen es un diseño distinto.</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={e => { addFiles(openKey, Array.from(e.target.files)); e.target.value = ""; }} />
            </div>
            {!isReplicate && openList.length > 0 && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14 }}>Hacé clic en una plantilla para revisar sus elementos.</div>}
          </section>
        )}
      </div>

      {/* Resumen de lo que se va a generar */}
      <div aria-live="polite" style={{ marginTop: 16, padding: "14px 18px", borderRadius: 12, background: total ? T.statusDone.bg : T.statusPend.bg, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {total ? (
          <>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.statusDone.text }}>{total} anuncio{total === 1 ? "" : "s"} por {unit}</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {included.filter(k => (cfg.templateSets[k] || []).length).map(k => {
                const r = resolutionInfo(k);
                const n = cfg.templateSets[k].length;
                return <span key={k} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: T.card, color: T.text }}>{r.w} × {r.h}: {n} plantilla{n === 1 ? "" : "s"}</span>;
              })}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: T.textMuted }}>Activá al menos una resolución y subile plantillas para poder seguir.</span>
        )}
      </div>

      {editing && !isReplicate && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>P{openList.indexOf(editing) + 1} de {openRes.w} × {openRes.h}</span>
            <span style={{ fontSize: 12, color: T.textMuted }}>{editing.referenceName}</span>
            {editing._detecting && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.blueMid }}><span className="spin" style={{ width: 12, height: 12, border: `2px solid ${T.cardBorder}`, borderTopColor: T.blueMid, borderRadius: "50%", display: "inline-block" }} /> Detectando elementos…</span>}
            {hasApiKey() && !editing._detecting && <button onClick={() => detect(openKey, editing)} style={{ fontSize: 12, color: T.blueMid, background: "transparent" }}>Detectar de nuevo con IA</button>}
          </div>
          {editing._detectError && (
            <div style={{ padding: "10px 14px", background: T.statusFail.bg, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.statusFail.text }}>
              No se pudo detectar automáticamente: {editing._detectError}. Podés marcar los elementos a mano.
            </div>
          )}
          <TemplateEditor key={editing.id} template={editing} brand={brand}
            onChange={t => updateTemplate(openKey, editing.id, { slots: t.slots })} />
        </div>
      )}
    </div>
  );
}

// Mapeo del CSV agrupado por rol, aplicado a todas las plantillas marcadas, +
// vista previa de una fila en todas ellas (con la foto de la referencia).
export function TemplateSetMapping({ cfg, patch, brand }) {
  const T = useTheme();
  const table = cfg.table;
  const templates = flattenTemplates(cfg.templateSets, cfg.tplSelected);
  const [previewRow, setPreviewRow] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [previews, setPreviews] = useState({});

  function setSlotValue(members, key, value) {
    const ids = new Set(members.map(m => m.s.id));
    patch(p => {
      const sets = {};
      for (const [k, list] of Object.entries(p.templateSets)) {
        sets[k] = list.map(t => t.slots.some(s => ids.has(s.id)) ? { ...t, slots: t.slots.map(s => ids.has(s.id) ? { ...s, [key]: value } : s) } : t);
      }
      return { templateSets: sets };
    });
  }

  const groups = SLOT_GROUPS.map(([gk, label]) => ({
    gk, label,
    members: templates.flatMap(t => t.slots.filter(s => slotGroup(s) === gk).map(s => ({ t, s }))),
  })).filter(g => g.members.length);

  // Vista previa con debounce: N plantillas = N renders, no en cada tecla.
  const row = table.rows[previewRow];
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const out = {};
      for (const t of templates) {
        if (!alive) return;
        try { out[t.outLabel] = await renderTemplate(t, { row, brand }); }
        catch (err) { out[t.outLabel] = { error: err.message }; }
      }
      if (alive) setPreviews(out);
    }, 600);
    return () => { alive = false; clearTimeout(timer); };
  // templates deriva de cfg.templateSets/tplSelected.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.templateSets, cfg.tplSelected, row, brand]);

  const nTemplates = members => new Set(members.map(m => m.t.id)).size;
  const inputStyle = { flex: 1, minWidth: 0, padding: "7px 10px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text, fontFamily: "monospace", width: "100%", boxSizing: "border-box" };
  const chip = { fontSize: 10, padding: "2px 7px", borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, color: T.textMuted };

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>
          Un campo por tipo de elemento, aplicado a las {templates.length} plantillas. Columnas: {table.headers.map(h => <code key={h} style={{ fontSize: 11, background: T.cream, border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "1px 5px", marginRight: 4 }}>{h}</code>)}
        </div>
        {groups.map(({ gk, label, members }) => {
          const key = gk === "photo" ? "prompt" : "content";
          const values = [...new Set(members.map(m => m.s[key] || ""))];
          const mixed = values.length > 1;
          const color = SLOT_TYPES[members[0].s.type]?.color;
          return (
            <div key={gk} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: T.textLight }}>en {nTemplates(members)} plantilla{nTemplates(members) === 1 ? "" : "s"}</span>
                <button onClick={() => setExpanded(e => ({ ...e, [gk]: !e[gk] }))} style={{ marginLeft: "auto", fontSize: 11, color: T.blueMid, background: "transparent" }}>
                  {expanded[gk] ? "Ocultar detalle" : "Ver por plantilla"}
                </button>
              </div>
              <input value={mixed ? "" : values[0]} onChange={e => setSlotValue(members, key, e.target.value)}
                placeholder={mixed ? "Distinto en cada plantilla — escribí para unificar" : gk === "photo" ? "ej. {{Título}} — profesional trabajando, temas: {{Keywords}}" : "{{Columna}} o texto fijo"}
                style={inputStyle} />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                {table.headers.map(h => (
                  <button key={h} onClick={() => setSlotValue(members, key, gk === "photo" && !mixed && values[0] ? `${values[0]} {{${h}}}` : `{{${h}}}`)} style={chip}>
                    {gk === "photo" ? "+ " : ""}{h}
                  </button>
                ))}
              </div>
              {expanded[gk] && (
                <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${T.cardBorder}` }}>
                  {members.map(({ t, s }) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 150, flexShrink: 0, fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.sampleText ? `original: "${s.sampleText}"` : ""}>
                        {t.outLabel} · {s.label}
                      </span>
                      <input value={s[key] || ""} onChange={e => setSlotValue([{ t, s }], key, e.target.value)} style={inputStyle} />
                      {s.sampleText && <button onClick={() => setSlotValue([{ t, s }], key, s.sampleText)} title={`"${s.sampleText}"`} style={{ ...chip, border: `1px dashed ${T.cardBorder}`, whiteSpace: "nowrap" }}>original</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Vista previa</span>
        <select value={previewRow} onChange={e => setPreviewRow(Number(e.target.value))} style={{ padding: "4px 8px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, background: T.cream, fontSize: 12, color: T.text }}>
          {table.rows.slice(0, 10).map((_, i) => <option key={i} value={i}>Fila {i + 1}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.textMuted }}>con la foto de la referencia; la foto nueva se genera al lanzar</span>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        {templates.map(t => {
          const p = previews[t.outLabel];
          const w = 150, h = Math.min(260, w * t.outH / t.outW);
          return (
            <div key={t.id} style={{ width: w }}>
              {!p ? <div style={{ width: w, height: h, borderRadius: 8, background: T.cream }} />
                : p.error ? <div style={{ fontSize: 11, color: T.statusFail.text }}>{p.error}</div>
                : <ZoomableThumb src={p.dataUrl} title={t.outLabel} style={{ width: w, height: h, objectFit: "contain", borderRadius: 8, background: T.cream, border: `1px solid ${p.qaIssues?.length ? "#E0B84D" : T.cardBorder}` }} />}
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{t.outLabel}</div>
              {p?.qaIssues?.length > 0 && <div style={{ fontSize: 10, color: "#8A6300" }}>⚠ no entra: {[...new Set(p.qaIssues.map(q => q.label))].join(", ")}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
