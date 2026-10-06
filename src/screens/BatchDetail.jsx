import { useEffect, useState } from "react";
import { ImageApprovalGrid } from "../components/ImageApprovalGrid.jsx";
import { Chip } from "../components/ui.jsx";
import { FORMATS } from "../lib/campaignOptions.js";
import { exportBatchZip } from "../lib/exportZip.js";
import { BUCKETS, fetchCreatives, getSignedUrl } from "../lib/supabase";
import { useTheme } from "../theme/tokens.js";

// ─── BATCH DETAIL ────────────────────────────────────────────────────
export function BatchDetail({ batch, onBack }) {
  const T = useTheme();

  // Batches opened straight from the wizard already have `items` in memory.
  // Batches loaded from the Supabase list (a previous session / another
  // user) start with empty `items` and a `dbId` — hydrate them lazily from
  // `creatives` rows, resolving each image to a signed URL.
  const [hydratedItems, setHydratedItems] = useState([]);
  useEffect(() => {
    if (batch.items?.length || !batch.dbId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchCreatives(batch.dbId);
        if (!rows.length || cancelled) return;
        const byCourseIndex = {};
        for (const row of rows) {
          const idx = row.params_json?.courseIndex ?? 0;
          if (!byCourseIndex[idx]) {
            byCourseIndex[idx] = {
              name: row.params_json?.name || "Curso",
              siglas: row.params_json?.siglas || "",
              nivel: row.params_json?.nivel || "",
              url: row.params_json?.url || "",
              keywords5: row.params_json?.keywords5 || [],
              status: "imaged",
              copies: [row.params_json?.copy || {}],
              composited: {},
            };
          }
          if (row.image_path) {
            try {
              byCourseIndex[idx].composited[row.format_label || row.id] = await getSignedUrl(BUCKETS.creatives, row.image_path);
            } catch (err) {
              console.warn("[supabase] No se pudo firmar creatividad:", row.image_path, err.message);
            }
          }
        }
        if (!cancelled) {
          const ordered = Object.keys(byCourseIndex).map(Number).sort((a, b) => a - b).map(k => byCourseIndex[k]);
          setHydratedItems(ordered);
        }
      } catch (err) {
        console.warn("[supabase] No se pudieron cargar creatividades del lote:", err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [batch.dbId, batch.items]);

  const effectiveItems = batch.items?.length ? batch.items : hydratedItems;

  // Build all card keys from composited images
  const allKeys = [];
  (effectiveItems || []).forEach((item, idx) => {
    if (!item.composited) return;
    Object.keys(item.composited).forEach(fmtKey => {
      allKeys.push(`${idx}-${fmtKey}`);
    });
  });

  const [approved, setApproved] = useState(() => new Set(allKeys));

  // Sync when items change (e.g. after live processing, or hydration lands)
  useEffect(() => {
    setApproved(prev => {
      const next = new Set(prev);
      allKeys.forEach(k => { if (!next.has(k) && !prev.has(`__rejected__${k}`)) next.add(k); });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveItems]);

  function toggleKey(key) {
    setApproved(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const approvedCount = allKeys.filter(k => approved.has(k)).length;
  const hasImages = allKeys.length > 0;

  return (
    <div className="fade-in" style={{ padding: "36px 32px", maxWidth: 1100, flex: 1 }}>
      <button onClick={onBack} style={{ background: "transparent", fontSize: 12, color: T.textMuted, marginBottom: 20, display: "flex", alignItems: "center", gap: 4 }}>← Volver a lotes</button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{batch.name}</h1>
          <p style={{ fontSize: 13, color: T.textMuted }}>{batch.brand} · {batch.adsCount || 0} anuncios · <Chip status={batch.status} /></p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => exportBatchZip({ ...batch, items: effectiveItems }, null)} style={{ background: T.cream, color: T.text, fontSize: 12, fontWeight: 500, padding: "8px 16px", borderRadius: 999, border: `1px solid ${T.cardBorder}` }}>
            ZIP completo
          </button>
          {hasImages && (
            <button onClick={() => exportBatchZip({ ...batch, items: effectiveItems }, approved)} style={{ background: T.text, color: T.white, fontSize: 12, fontWeight: 600, padding: "8px 18px", borderRadius: 999 }}>
              Exportar aprobadas ({approvedCount})
            </button>
          )}
        </div>
      </div>

      {/* Config summary */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 20px", marginBottom: 24, boxShadow: "0 2px 8px rgba(32,32,32,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            ["Objetivo",        batch.config?.goal],
            ["Audiencia",       batch.config?.audience?.join(", ")],
            ["Puntos de dolor", batch.config?.painPoints?.join(" · ")],
            ["CTAs",            batch.config?.ctas?.join(" / ")],
            ["Formatos",        batch.config?.formats?.map(f => FORMATS.find(x => x.id === f)?.label).join(", ")],
            ["Cursos",          `${batch.config?.courses?.length || 0} cargados`],
            ...(batch.config?.winningStyleLabel ? [["Diseño", batch.config.winningStyleLabel]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Image approval grid */}
      {hasImages && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Creatividades</span>
              <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 8 }}>{approvedCount} de {allKeys.length} aprobadas</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setApproved(new Set(allKeys))} style={{ fontSize: 11, color: T.tealText, background: "#EAF7F6", border: `1px solid ${T.teal}`, padding: "4px 12px", borderRadius: 999 }}>Aprobar todas</button>
              <button onClick={() => setApproved(new Set())} style={{ fontSize: 11, color: "#963058", background: "#FFE6E8", border: "1px solid #963058", padding: "4px 12px", borderRadius: 999 }}>Rechazar todas</button>
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 16 }}>Clic en imagen para aprobar / rechazar. Solo las aprobadas se incluyen en el export.</p>
          <ImageApprovalGrid items={effectiveItems} approved={approved} onToggle={toggleKey} />
        </div>
      )}

      {/* Courses list (when no images) */}
      {!hasImages && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 12, fontWeight: 600 }}>Cursos ({batch.config?.courses?.length || 0})</div>
          {(effectiveItems.length ? effectiveItems : (batch.config?.courses || [])).slice(0, 20).map((c, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none", gap: 12 }}>
              <span style={{ fontSize: 11, color: T.textMuted, width: 24 }}>{i + 1}</span>
              {c.siglas && <span style={{ fontSize: 11, fontWeight: 700, color: T.tealText, background: "#EAF7F6", border: `1px solid ${T.teal}`, borderRadius: 6, padding: "1px 7px", flexShrink: 0 }}>{c.siglas}</span>}
              {c.nivel  && <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{c.nivel}</span>}
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{c.name}</span>
              {c.url && <span style={{ fontSize: 11, color: T.blueMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{c.url}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
