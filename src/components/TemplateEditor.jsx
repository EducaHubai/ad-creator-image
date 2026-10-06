import { useEffect, useRef, useState } from "react";
import { loadImage } from "../lib/composite.js";
import { SLOT_TYPES, autoColorsForSlot, imageToCanvas, newSlot, renderTemplate } from "../lib/template.js";
import { useTheme } from "../theme/tokens.js";

const MAX_W = 520, MAX_H = 640;
const HANDLES = ["nw", "ne", "sw", "se"];

function Row({ label, children }) {
  const T = useTheme();
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ width: 92, flexShrink: 0, fontSize: 11, color: T.textMuted }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, alignItems: "center" }}>{children}</div>
    </label>
  );
}

function useInputStyle() {
  const T = useTheme();
  return { flex: 1, minWidth: 0, padding: "5px 8px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, background: T.cream, fontSize: 12, color: T.text };
}

function Num({ value, onChange, min = 0, max = 9999 }) {
  const style = useInputStyle();
  return <input type="number" value={value ?? 0} min={min} max={max} onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} style={{ ...style, width: 70, flex: "none" }} />;
}

function Color({ value, onChange }) {
  const style = useInputStyle();
  return (
    <>
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000"} onChange={e => onChange(e.target.value)} style={{ width: 30, height: 26, padding: 0, border: "none", background: "transparent" }} />
      <input value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...style, fontFamily: "monospace" }} />
    </>
  );
}

function Select({ value, onChange, options }) {
  const style = useInputStyle();
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// Editor de plantilla: cajas arrastrables sobre la referencia + panel de
// propiedades del slot elegido + vista previa renderizada por código.
// `template` es controlado: cada cambio sube por onChange.
export function TemplateEditor({ template, onChange, brand, previewRow = null }) {
  const T = useTheme();
  const inputStyle = useInputStyle();
  const [selectedId, setSelectedId] = useState(template.slots[0]?.id || null);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const refCanvasRef = useRef(null);
  const dragRef = useRef(null);
  const stageRef = useRef(null);

  const scale = Math.min(MAX_W / template.width, MAX_H / template.height, 1);
  const selected = template.slots.find(s => s.id === selectedId) || null;

  useEffect(() => {
    let alive = true;
    loadImage(template.referenceData).then(img => { if (alive && img) refCanvasRef.current = imageToCanvas(img); });
    return () => { alive = false; };
  }, [template.referenceData]);

  // Vista previa con debounce — se re-renderiza al tocar cualquier slot.
  useEffect(() => {
    if (!showPreview) return;
    let alive = true;
    const t = setTimeout(() => {
      renderTemplate(template, { row: previewRow, brand })
        .then(r => { if (alive) { setPreview(r); setPreviewError(""); } })
        .catch(err => { if (alive) setPreviewError(err.message); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [template, showPreview, brand, previewRow]);

  function updateSlot(id, patch) {
    onChange({ ...template, slots: template.slots.map(s => s.id === id ? { ...s, ...patch } : s) });
  }
  function removeSlot(id) {
    onChange({ ...template, slots: template.slots.filter(s => s.id !== id) });
    setSelectedId(null);
  }
  function addSlot(type) {
    const w = template.width * (type === "photo" ? 0.6 : type === "cta" ? 0.32 : type === "logo" ? 0.2 : 0.5);
    const h = template.height * (type === "photo" ? 0.5 : type === "cta" ? 0.07 : type === "logo" ? 0.07 : 0.12);
    let slot = newSlot(type, { x: (template.width - w) / 2, y: (template.height - h) / 2, w, h }, { _autoColor: true });
    if (refCanvasRef.current) slot = { ...slot, ...autoColorsForSlot(refCanvasRef.current, slot) };
    // Las fotos van al fondo de la pila (se pintan primero).
    onChange({ ...template, slots: type === "photo" ? [slot, ...template.slots] : [...template.slots, slot] });
    setSelectedId(slot.id);
  }

  function onPointerDown(e, slot, mode) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(slot.id);
    stageRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { id: slot.id, mode, sx: e.clientX, sy: e.clientY, orig: { x: slot.x, y: slot.y, w: slot.w, h: slot.h } };
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
    const o = d.orig;
    let { x, y, w, h } = o;
    if (d.mode === "move") { x = o.x + dx; y = o.y + dy; }
    else {
      if (d.mode.includes("w")) { x = o.x + dx; w = o.w - dx; }
      if (d.mode.includes("e")) { w = o.w + dx; }
      if (d.mode.includes("n")) { y = o.y + dy; h = o.h - dy; }
      if (d.mode.includes("s")) { h = o.h + dy; }
    }
    w = Math.max(8, w); h = Math.max(8, h);
    x = Math.max(0, Math.min(template.width - w, x));
    y = Math.max(0, Math.min(template.height - h, y));
    updateSlot(d.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  }
  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const slot = template.slots.find(s => s.id === d.id);
    if (slot?._autoColor && refCanvasRef.current) updateSlot(slot.id, autoColorsForSlot(refCanvasRef.current, slot));
  }

  useEffect(() => {
    function onKey(e) {
      if (!selectedId || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSlot(selectedId); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const set = patch => selected && updateSlot(selected.id, { ...patch, ...(("color" in patch || "ctaBg" in patch) ? { _autoColor: false } : {}) });
  const isText = selected && (selected.type === "text" || selected.type === "cta");

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {Object.entries(SLOT_TYPES).map(([type, meta]) => (
            <button key={type} onClick={() => addSlot(type)} style={{ padding: "5px 10px", borderRadius: 999, border: `1.5px solid ${meta.color}`, background: T.card, color: T.text, fontSize: 11, fontWeight: 600 }}>
              + {meta.label}
            </button>
          ))}
          <button onClick={() => setShowPreview(v => !v)} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 999, background: showPreview ? T.text : T.card, color: showPreview ? T.cream : T.text, border: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600 }}>
            {showPreview ? "← Editar cajas" : "Ver resultado"}
          </button>
        </div>

        <div ref={stageRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerDown={() => setSelectedId(null)}
          style={{ position: "relative", width: template.width * scale, height: template.height * scale, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.cardBorder}`, touchAction: "none", userSelect: "none", background: T.cream }}>
          <img src={showPreview && preview ? preview.dataUrl : template.referenceData} alt="Referencia" draggable={false}
            style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
          {!showPreview && template.slots.map(s => {
            const meta = SLOT_TYPES[s.type] || {};
            const sel = s.id === selectedId;
            return (
              <div key={s.id} onPointerDown={e => onPointerDown(e, s, "move")}
                style={{ position: "absolute", left: s.x * scale, top: s.y * scale, width: s.w * scale, height: s.h * scale, border: `${sel ? 2 : 1.5}px ${sel ? "solid" : "dashed"} ${meta.color}`, background: sel ? `${meta.color}22` : "transparent", cursor: "move", boxSizing: "border-box" }}>
                <span style={{ position: "absolute", top: -1, left: -1, background: meta.color, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: "0 0 4px 0", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                {sel && HANDLES.map(hd => (
                  <div key={hd} onPointerDown={e => onPointerDown(e, s, hd)}
                    style={{ position: "absolute", width: 10, height: 10, background: "#fff", border: `2px solid ${meta.color}`, borderRadius: 2, cursor: `${hd}-resize`, top: hd.includes("n") ? -6 : undefined, bottom: hd.includes("s") ? -6 : undefined, left: hd.includes("w") ? -6 : undefined, right: hd.includes("e") ? -6 : undefined }} />
                ))}
              </div>
            );
          })}
        </div>
        {showPreview && previewError && <div style={{ fontSize: 11, color: T.statusFail.text, marginTop: 6 }}>{previewError}</div>}
        {showPreview && preview?.qaIssues?.length > 0 && (
          <div style={{ fontSize: 11, color: "#8A6300", marginTop: 6 }}>⚠ El texto no entra en: {[...new Set(preview.qaIssues.map(q => q.label))].join(", ")} — agrandá la caja o subí las líneas máximas.</div>
        )}
        <div style={{ fontSize: 11, color: T.textLight, marginTop: 6 }}>{template.width}×{template.height}px · arrastrá para mover, esquinas para redimensionar, Supr para borrar.</div>
      </div>

      <div style={{ flex: 1, minWidth: 260, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16 }}>
        {!selected ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Elementos ({template.slots.length})</div>
            {template.slots.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Agregá cajas con los botones de arriba.</div>}
            {template.slots.map(s => (
              <button key={s.id} onClick={() => setSelectedId(s.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, background: "transparent", fontSize: 12, color: T.text }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: SLOT_TYPES[s.type]?.color, flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}{s.sampleText ? ` — "${s.sampleText}"` : ""}</span>
              </button>
            ))}
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 14, lineHeight: 1.5 }}>
              <b>Foto</b>: se reemplaza por una imagen nueva por fila. <b>Texto/CTA</b>: se borra el original y se escribe el del CSV. <b>Logo</b>: se conserva o se cambia por el de la marca. <b>Conservar</b>: badges o formas sobre la foto que deben quedar igual.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SLOT_TYPES[selected.type]?.color }} />
              <input value={selected.label} onChange={e => set({ label: e.target.value })} style={{ ...inputStyle, fontWeight: 600 }} />
              <button onClick={() => removeSlot(selected.id)} title="Borrar" style={{ fontSize: 11, color: T.coral, background: "transparent" }}>Borrar</button>
              <button onClick={() => setSelectedId(null)} title="Cerrar" style={{ fontSize: 14, color: T.textMuted, background: "transparent" }}>×</button>
            </div>
            <Row label="Posición"><Num value={selected.x} onChange={x => set({ x })} /><Num value={selected.y} onChange={y => set({ y })} /></Row>
            <Row label="Tamaño"><Num value={selected.w} onChange={w => set({ w })} min={8} /><Num value={selected.h} onChange={h => set({ h })} min={8} /></Row>

            {isText && (
              <>
                {selected.type === "text" && (
                  <Row label="Rol">
                    <Select value={selected.role || "other"} onChange={role => set({ role })} options={[["headline", "Título"], ["subheadline", "Subtítulo"], ["body", "Descripción"], ["price", "Precio"], ["tag", "Etiqueta"], ["other", "Otro"]]} />
                  </Row>
                )}
                {selected.sampleText && <Row label="Texto original"><span style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>"{selected.sampleText}"</span></Row>}
                <Row label="Fuente">
                  <Select value={selected.font} onChange={font => set({ font })} options={[["display", `Display de marca${brand?.fonts?.display ? ` (${brand.fonts.display})` : ""}`], ["body", `Texto de marca${brand?.fonts?.body ? ` (${brand.fonts.body})` : ""}`]]} />
                </Row>
                <Row label="Google Font"><input value={selected.fontFamily} placeholder="opcional, ej. Montserrat" onChange={e => set({ fontFamily: e.target.value })} style={inputStyle} /></Row>
                <Row label="Peso">
                  <Select value={String(selected.weight)} onChange={w => set({ weight: Number(w) })} options={[300, 400, 500, 600, 700, 800, 900].map(w => [String(w), String(w)])} />
                  <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><input type="checkbox" checked={selected.uppercase} onChange={e => set({ uppercase: e.target.checked })} /> MAYÚS</label>
                </Row>
                <Row label="Color texto"><Color value={selected.color} onChange={color => set({ color })} /></Row>
                {selected.type === "cta" && (
                  <>
                    <Row label="Color botón"><Color value={selected.ctaBg} onChange={ctaBg => set({ ctaBg })} /></Row>
                    <Row label="Radio / margen"><Num value={selected.ctaRadius} onChange={ctaRadius => set({ ctaRadius })} /><Num value={selected.padX} onChange={padX => set({ padX })} /></Row>
                  </>
                )}
                <Row label="Cuerpo máx/mín"><Num value={selected.maxSize} onChange={maxSize => set({ maxSize })} /><Num value={selected.minSize} onChange={minSize => set({ minSize })} min={6} /></Row>
                {selected.type === "text" && <Row label="Líneas máx"><Num value={selected.maxLines} onChange={maxLines => set({ maxLines })} min={1} max={12} /></Row>}
                <Row label="Alineación">
                  <Select value={selected.align} onChange={align => set({ align })} options={[["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]]} />
                  {selected.type === "text" && <Select value={selected.valign} onChange={valign => set({ valign })} options={[["top", "Arriba"], ["middle", "Medio"], ["bottom", "Abajo"]]} />}
                </Row>
                <Row label="Borrar original">
                  <Select value={selected.erase?.startsWith("#") ? "color" : selected.erase} onChange={v => set({ erase: v === "color" ? "#FFFFFF" : v })} options={[["auto", "Automático (fondo)"], ["color", "Color fijo"], ["none", "No borrar"]]} />
                  {selected.erase?.startsWith("#") && <input type="color" value={selected.erase} onChange={e => set({ erase: e.target.value })} style={{ width: 30, height: 26, padding: 0, border: "none" }} />}
                </Row>
                <button onClick={() => refCanvasRef.current && set({ ...autoColorsForSlot(refCanvasRef.current, selected), _autoColor: true })} style={{ fontSize: 11, color: T.blueMid, background: "transparent", padding: 0 }}>↺ Medir colores de la referencia</button>
              </>
            )}

            {selected.type === "photo" && (
              <>
                <Row label="Overlay">
                  <Select value={selected.overlay?.type || "none"} onChange={type => set({ overlay: { ...selected.overlay, type } })} options={[["none", "Ninguno"], ["gradient-bottom", "Degradado abajo"], ["gradient-top", "Degradado arriba"], ["gradient-left", "Degradado izquierda"], ["tint", "Tinte uniforme"]]} />
                </Row>
                {selected.overlay?.type !== "none" && (
                  <>
                    <Row label="Color overlay"><Color value={selected.overlay?.color} onChange={color => set({ overlay: { ...selected.overlay, color } })} /></Row>
                    <Row label="Opacidad">
                      <input type="range" min={0} max={1} step={0.05} value={selected.overlay?.opacity ?? 0.55} onChange={e => set({ overlay: { ...selected.overlay, opacity: Number(e.target.value) } })} style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, width: 32 }}>{Math.round((selected.overlay?.opacity ?? 0.55) * 100)}%</span>
                    </Row>
                  </>
                )}
                <Row label="Radio esquinas"><Num value={selected.radius} onChange={radius => set({ radius })} /></Row>
                <Row label="Guía de estilo">
                  <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={selected.useStyleReference} onChange={e => set({ useStyleReference: e.target.checked })} /> mandar la foto original (sin textos) como referencia de estilo</label>
                </Row>
                <div style={{ fontSize: 11, color: T.textMuted }}>El tema de la foto se define en el paso del CSV.</div>
              </>
            )}

            {selected.type === "keep" && (
              <>
                <Row label="Forma">
                  <Select value={selected.shape || "auto"} onChange={shape => set({ shape })} options={[["auto", "Automática (recorta el fondo)"], ["rounded", "Rectángulo redondeado"], ["ellipse", "Círculo / elipse"], ["rect", "Caja entera"]]} />
                </Row>
                {selected.shape === "rounded" && <Row label="Radio esquinas"><Num value={selected.radius} onChange={radius => set({ radius })} /></Row>}
                <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>Automática detecta la forma por su color y no copia lo que hay detrás (p. ej. la foto vieja asomando por las esquinas). Si el badge es una foto o un degradado, elegí la forma a mano.</div>
              </>
            )}

            {selected.type === "logo" && (
              <Row label="Logo">
                <Select value={selected.mode} onChange={mode => set({ mode })} options={[["keep", "Conservar el de la referencia"], ["brand", `Usar el logo de ${brand?.name || "la marca"}`]]} />
              </Row>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
