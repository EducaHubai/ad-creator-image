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

function MiniFrame({ w, h, sel, T }) {
  const s = 26 / Math.max(w, h);
  return <div style={{ width: Math.round(w * s), height: Math.round(h * s), border: `1.5px solid ${sel ? T.cream : T.cardBorder}`, borderRadius: 3, opacity: sel ? 0.6 : 1 }} />;
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
  }
  function removeCustom(key) {
    patch(p => {
      const sets = { ...p.templateSets };
      delete sets[key];
      return { tplCustomDims: p.tplCustomDims.filter(k => k !== key), tplSelected: p.tplSelected.filter(k => k !== key), templateSets: sets };
    });
    if (openKey === key) setOpenKey(FORMATS[0].id);
  }

  const total = flattenTemplates(cfg.templateSets, cfg.tplSelected).length;
  const customParsed = parseCustomDim(customInput);

  return (
    <div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
        <b>Casilla</b>: se genera esa resolución · <b>clic en la tarjeta</b>: {isReplicate ? "subir sus plantillas" : "subir y editar sus plantillas"}. Cada {isReplicate ? "curso" : "fila del CSV"} genera un anuncio por plantilla.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
        {keys.map(key => {
          const res = resolutionInfo(key);
          const list = cfg.templateSets[key] || [];
          const checked = cfg.tplSelected.includes(key);
          const open = key === openKey;
          const custom = !FORMATS.some(f => f.id === key);
          return (
            <div key={key} role="button" tabIndex={0} onClick={() => { setOpenKey(key); setEditingId(null); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenKey(key); setEditingId(null); } }}
              style={{ position: "relative", padding: 12, border: `${open ? 2 : 1.5}px solid ${open ? T.text : T.cardBorder}`, borderRadius: 12, background: T.card, cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <label onClick={e => e.stopPropagation()} title="Generar esta resolución" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSelected(key)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                </label>
                <MiniFrame w={res.w} h={res.h} T={T} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{res.label}</div>
              <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>{res.w}×{res.h}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8, minHeight: 22 }}>
                {list.slice(0, 5).map(t => <img key={t.id} src={t.referenceData} alt="" style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 3, border: `1px solid ${T.cardBorder}` }} />)}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, color: list.length ? T.text : (checked ? T.coral : T.textLight) }}>
                {list.length ? `${list.length} plantilla${list.length > 1 ? "s" : ""}` : checked ? "Sin plantillas" : "Sin plantillas · no se genera"}
              </div>
              {custom && (
                <button onClick={e => { e.stopPropagation(); removeCustom(key); }} title="Quitar resolución"
                  style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: T.cream, color: T.textMuted, fontSize: 11, lineHeight: "18px", padding: 0 }}>×</button>
              )}
            </div>
          );
        })}
        <div style={{ padding: 12, border: `1.5px dashed ${T.cardBorder}`, borderRadius: 12, background: T.card }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Otra resolución</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={customInput} onChange={e => setCustomInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCustom(); }} placeholder="1200×800"
              style={{ flex: 1, minWidth: 0, padding: "4px 6px", border: `1px solid ${customInput && !customParsed ? "#963058" : T.cardBorder}`, borderRadius: 5, background: T.cream, fontSize: 11, color: T.text, fontFamily: "monospace" }} />
            <button onClick={addCustom} disabled={!customParsed} style={{ width: 24, borderRadius: 5, background: customParsed ? T.text : T.cardBorder, color: T.cream, fontWeight: 700 }}>+</button>
          </div>
        </div>
      </div>

      {openRes && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{openRes.label} · {openRes.w}×{openRes.h}</span>
            <span style={{ fontSize: 12, color: T.textMuted }}>{openList.length} plantilla{openList.length === 1 ? "" : "s"}{cfg.tplSelected.includes(openKey) ? "" : " · no se genera (marcá la casilla)"}</span>
            <button onClick={() => fileRef.current?.click()} style={{ marginLeft: "auto", background: T.text, color: T.cream, fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 999 }}>+ Subir plantillas</button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={e => { addFiles(openKey, Array.from(e.target.files)); e.target.value = ""; }} />
          </div>

          {openList.length === 0 ? (
            <div onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(openKey, Array.from(e.dataTransfer.files)); }}
              style={{ border: `1.5px dashed ${T.cardBorder}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Soltá aquí las plantillas de {openRes.w}×{openRes.h}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Una o varias imágenes — cada una es un diseño distinto para esta resolución</div>
            </div>
          ) : (
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(openKey, Array.from(e.dataTransfer.files)); }}
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {openList.map((t, i) => {
                const mismatch = sizeMismatch(t, openRes);
                const sel = editing?.id === t.id;
                return (
                  <div key={t.id} onClick={() => setEditingId(t.id)} style={{ width: 120, cursor: "pointer", border: `${sel ? 2 : 1}px solid ${sel ? T.text : T.cardBorder}`, borderRadius: 10, padding: 6, background: sel ? T.cream : T.card, position: "relative" }}>
                    {isReplicate
                      ? <ZoomableThumb src={t.referenceData} title={t.referenceName} style={{ width: "100%", height: 90, objectFit: "contain", borderRadius: 6, background: T.cream, display: "block" }} />
                      : <img src={t.referenceData} alt={t.referenceName} style={{ width: "100%", height: 90, objectFit: "contain", borderRadius: 6, background: T.cream, display: "block" }} />}
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>P{i + 1}</div>
                    <div title={t.referenceName} style={{ fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.referenceName}</div>
                    {!isReplicate && <div style={{ fontSize: 10, marginTop: 2, color: t._detectError ? T.statusFail.text : t._detecting ? T.blueMid : t.slots.length ? T.tealText : "#8A6300" }}>
                      {t._detecting ? "Detectando…" : t._detectError ? "Error al detectar" : t.slots.length ? `✓ ${t.slots.length} elementos` : "Sin cajas"}
                    </div>}
                    {mismatch && <div style={{ fontSize: 10, color: "#8A6300" }}>{t.width}×{t.height} · {mismatch === "scale" ? "se escala" : "se recorta"}</div>}
                    <button onClick={e => { e.stopPropagation(); removeTemplate(openKey, t.id); }} title="Quitar plantilla"
                      style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, lineHeight: "18px", padding: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {editing && !isReplicate && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>P{openList.indexOf(editing) + 1}</span>
            <span style={{ fontSize: 12, color: T.textMuted }}>{editing.referenceName} · {editing.width}×{editing.height}px</span>
            {editing._detecting && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.blueMid }}><span className="spin" style={{ width: 12, height: 12, border: `2px solid ${T.cardBorder}`, borderTopColor: T.blueMid, borderRadius: "50%", display: "inline-block" }} /> Detectando elementos…</span>}
            {hasApiKey() && !editing._detecting && <button onClick={() => detect(openKey, editing)} style={{ fontSize: 11, color: T.blueMid, background: "transparent" }}>↺ Detectar de nuevo con IA</button>}
          </div>
          {editing._detectError && (
            <div style={{ padding: "10px 14px", background: T.statusFail.bg, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.statusFail.text }}>
              No se pudo detectar automáticamente: {editing._detectError}. Podés agregar las cajas a mano.
            </div>
          )}
          <TemplateEditor key={editing.id} template={editing} brand={brand}
            onChange={t => updateTemplate(openKey, editing.id, { slots: t.slots })} />
        </div>
      )}

      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 12 }}>
        Total: <b style={{ color: T.text }}>{total} plantilla{total === 1 ? "" : "s"}</b> en {cfg.tplSelected.length} resolución{cfg.tplSelected.length === 1 ? "" : "es"} marcada{cfg.tplSelected.length === 1 ? "" : "s"} → {total} anuncios por {isReplicate ? "curso" : "fila del CSV"}.
      </div>
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
