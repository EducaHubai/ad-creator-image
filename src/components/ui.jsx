import { useEffect, useState } from "react";
import { IcoExpand } from "./icons.jsx";
import { useTheme } from "../theme/tokens.js";

// ─── STATUS CHIP ────────────────────────────────────────────────────
export function Chip({ status }) {
  const T = useTheme();
  const map = { done: T.statusDone, running: T.statusRun, failed: T.statusFail, pending: T.statusPend, generating: T.statusRun, review: { bg: "#F8E8EE", text: "#963058" }, exported: T.statusDone, error: T.statusFail, cancelled: T.statusPend };
  const labels = { done:"Listo", running:"Ejecutando", failed:"Fallido", pending:"Pendiente", generating:"Generando", review:"Revisión", exported:"Exportado", error:"Error", cancelled:"Cancelado" };
  const c = map[status?.toLowerCase()] || T.statusPend;
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.01em" }}>
      {labels[status?.toLowerCase()] || status}
    </span>
  );
}

// ─── LIGHTBOX ───────────────────────────────────────────────────────
// Visor de imagen a pantalla completa. Escape o clic fuera cierran, ←/→
// navegan cuando hay varias imágenes, clic sobre la imagen alterna zoom 1:1
// (con scroll cuando la imagen no cabe). images: [{src, title, subtitle,
// downloadName}].
export function Lightbox({ images, index, onClose, onNav }) {
  const [zoomed, setZoomed] = useState(false);
  // Toda la navegación pasa por aquí para resetear el zoom al cambiar de imagen.
  const nav = i => { setZoomed(false); onNav(i); };
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && images.length > 1) { setZoomed(false); onNav((index + 1) % images.length); }
      else if (e.key === "ArrowLeft"  && images.length > 1) { setZoomed(false); onNav((index - 1 + images.length) % images.length); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onNav]);

  const img = images[index];
  if (!img) return null;

  const navBtnStyle = side => ({
    position: "absolute", top: "50%", [side]: 18, transform: "translateY(-50%)",
    width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)",
    color: "#fff", fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center",
    justifyContent: "center", border: "1px solid rgba(255,255,255,0.25)",
  });

  return (
    <div className="fade-in" onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(12,12,12,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <button onClick={onClose} aria-label="Cerrar"
        style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, border: "1px solid rgba(255,255,255,0.25)" }}>
        ✕
      </button>
      {images.length > 1 && (
        <>
          <button aria-label="Anterior" style={navBtnStyle("left")}
            onClick={e => { e.stopPropagation(); nav((index - 1 + images.length) % images.length); }}>‹</button>
          <button aria-label="Siguiente" style={navBtnStyle("right")}
            onClick={e => { e.stopPropagation(); nav((index + 1) % images.length); }}>›</button>
        </>
      )}
      <div onClick={e => e.stopPropagation()}
        style={{ maxWidth: "88vw", maxHeight: "80vh", overflow: zoomed ? "auto" : "hidden", display: "flex", alignItems: zoomed ? "flex-start" : "center", justifyContent: zoomed ? "flex-start" : "center", borderRadius: 8 }}>
        <img src={img.src} alt={img.title || "Creatividad"} onClick={() => setZoomed(z => !z)}
          style={zoomed
            ? { display: "block", cursor: "zoom-out" }
            : { display: "block", cursor: "zoom-in", maxWidth: "88vw", maxHeight: "80vh", objectFit: "contain" }} />
      </div>
      <div onClick={e => e.stopPropagation()} style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, maxWidth: "88vw" }}>
        <div style={{ minWidth: 0 }}>
          {img.title && <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.title}</div>}
          {img.subtitle && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.subtitle}</div>}
        </div>
        {images.length > 1 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>{index + 1} / {images.length}</span>
        )}
        <a href={img.src} download={img.downloadName || "creatividad.png"}
          style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#fff", padding: "5px 14px", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 999, textDecoration: "none", background: "rgba(255,255,255,0.1)" }}>
          PNG ↓
        </a>
      </div>
    </div>
  );
}

// Botón "ampliar" para superponer sobre miniaturas — para el stopPropagation
// para no disparar la selección/aprobación de la tarjeta que lo contiene.
export function ExpandBtn({ onClick, style }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title="Ampliar" aria-label="Ampliar imagen"
      style={{ position: "absolute", bottom: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(32,32,32,0.72)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.25)", ...style }}>
      <IcoExpand s={13} />
    </button>
  );
}

// Miniatura ampliable: clic abre el visor con esa única imagen.
export function ZoomableThumb({ src, title, style }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={src} alt={title || "Ampliar"} title="Ampliar" onClick={() => setOpen(true)}
        style={{ cursor: "zoom-in", ...style }} />
      {open && <Lightbox images={[{ src, title }]} index={0} onClose={() => setOpen(false)} onNav={() => {}} />}
    </>
  );
}

// Tira de miniaturas de referencia con visor integrado (clic amplía y permite
// navegar entre todas) y botón de añadir. La comparten el asistente de
// generación y el Estudio de marca.
export function RefImagesStrip({ images, onRemove, onAddClick, canAdd }) {
  const T = useTheme();
  const [lbIdx, setLbIdx] = useState(null);
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {images.map((img, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={img.data} alt={img.name} title="Ampliar" onClick={() => setLbIdx(i)}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.cardBorder}`, cursor: "zoom-in", display: "block" }} />
            <button onClick={() => onRemove(i)} aria-label={`Quitar ${img.name}`}
              style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#e53", color: "#fff", fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        ))}
        {canAdd && (
          <button onClick={onAddClick} aria-label="Añadir referencia"
            style={{ width: 72, height: 72, borderRadius: 8, border: `2px dashed ${T.cardBorder}`, background: T.card, fontSize: 22, color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        )}
      </div>
      {lbIdx !== null && (
        <Lightbox images={images.map(img => ({ src: img.data, title: img.name }))} index={lbIdx}
          onClose={() => setLbIdx(null)} onNav={setLbIdx} />
      )}
    </>
  );
}

// ─── TOP BAR ────────────────────────────────────────────────────────
// Chip para nombres de columnas/variables dentro de texto de ayuda — borde y
// color propios para que no se funda con el fondo (el <code> desnudo heredaba
// el gris del párrafo y el chip blanco desaparecía sobre la página blanca).
export function CodeChip({ children }) {
  const T = useTheme();
  return (
    <code style={{ background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text, padding: "1px 6px", borderRadius: 4, fontSize: 12, whiteSpace: "nowrap" }}>
      {children}
    </code>
  );
}
