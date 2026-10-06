import { useState } from "react";
import { Chip } from "../components/ui.jsx";
import { useTheme } from "../theme/tokens.js";

// ─── BATCHES LIST ────────────────────────────────────────────────────
export function Batches({ batches, onOpen, onNav, onDelete, processingId }) {
  const T = useTheme();
  const [deletingId, setDeletingId] = useState(null);
  const [deleteErr, setDeleteErr] = useState("");

  async function handleDelete(e, b) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar "${b.name}" con sus ${b.adsCount || 0} creatividades y sus imágenes? Esta acción no se puede deshacer.`)) return;
    setDeletingId(b.id); setDeleteErr("");
    try { await onDelete(b); }
    catch (err) { setDeleteErr(`No se pudo eliminar "${b.name}": ${err.message}`); }
    setDeletingId(null);
  }

  return (
    <div className="fade-in" style={{ padding: "40px 40px", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Lotes</h1>
        <button onClick={() => onNav("generate-choice")} style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 500, padding: "8px 18px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6 }}>+ Nuevo lote</button>
      </div>
      {deleteErr && (
        <div style={{ padding: "10px 16px", background: T.statusFail.bg, border: `1px solid ${T.accent}`, borderRadius: 10, marginBottom: 14, fontSize: 12, color: T.statusFail.text }}>{deleteErr}</div>
      )}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 120px 100px 44px", padding: "8px 20px", background: T.cream, borderBottom: `1px solid ${T.cardBorder}` }}>
          {["Lote", "Marca", "Anuncios", "Creado", "Estado", ""].map((h, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>)}
        </div>
        {batches.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Sin lotes aún.</div>
        ) : [...batches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((b, i, arr) => {
          // No se puede borrar el lote que se está procesando en esta sesión:
          // el pipeline seguiría escribiendo sobre una fila inexistente.
          const isProcessingNow = b.id === processingId;
          return (
          <div key={b.id} onClick={() => onOpen(b)} style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 120px 100px 44px", padding: "13px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none", cursor: "pointer", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = T.cream}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{b.config?.goal || "—"}</div>
            </div>
            <span style={{ fontSize: 12, color: T.textMuted }}>{b.brand}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{b.adsCount || 0}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>{new Date(b.createdAt).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" })}</span>
            <Chip status={b.status} />
            <button
              onClick={e => handleDelete(e, b)}
              disabled={deletingId === b.id || isProcessingNow}
              aria-label={`Eliminar ${b.name}`}
              title={isProcessingNow ? "No se puede eliminar mientras se procesa" : "Eliminar lote, creatividades e imágenes"}
              onMouseEnter={e => { if (!isProcessingNow) { e.currentTarget.style.background = T.statusFail.bg; e.currentTarget.style.color = T.accent; } }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}
              style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: T.textMuted, cursor: isProcessingNow ? "not-allowed" : "pointer", opacity: isProcessingNow ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center", justifySelf: "end", transition: "all 0.15s" }}>
              {deletingId === b.id
                ? <div className="spin" style={{ width: 12, height: 12, border: `2px solid ${T.cardBorder}`, borderTopColor: T.textMuted, borderRadius: "50%" }} />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>}
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
