import { useEffect, useState } from "react";
import { Chip } from "../components/ui.jsx";
import { FORMATS } from "../lib/campaignOptions.js";
import { fetchStats } from "../lib/supabase";
import { useTheme } from "../theme/tokens.js";

// ─── DASHBOARD ──────────────────────────────────────────────────────
const TIME_SAVED_TOOLTIP =
  "Cada formato tiene una linea base de tiempo estimado que llevaria producir la creatividad manualmente. " +
  "Ese tiempo se multiplica por el numero de creatividades generadas.\n\n" +
  "Baselines actuales (editables): IG Feed 1:1 = 4 min, IG Story 9:16 = 5 min, Banner 16:9 = 6 min, Cover LinkedIn 4:1 = 5 min.";

export function Dashboard({ batches, onNewBatch, onNav }) {
  const T = useTheme();
  // Totales desde el server (/api/db/stats). Se refrescan al montar y cada
  // vez que un lote cambia de estado o suma creatividades, para que generar
  // un lote se refleje aquí sin recargar la página.
  const [dbTotals, setDbTotals] = useState(null);
  const batchesDigest = batches.map(b => `${b.id}:${b.status}:${b.adsCount || 0}`).join("|");
  useEffect(() => {
    let alive = true;
    fetchStats()
      .then(t => { if (alive) setDbTotals(t); })
      .catch(err => console.warn("[supabase] No se pudieron cargar los totales del dashboard:", err.message));
    return () => { alive = false; };
  }, [batchesDigest]);
  // Sin Supabase (dev local): computa de los lotes en memoria con la baseline
  // por defecto de 5 min/creatividad.
  const totals = dbTotals || {
    batches_total: batches.length,
    creatives_total: batches.reduce((a, b) => a + (b.adsCount || 0), 0),
    formats_total: FORMATS.length,
    brands_total: 0,
    time_saved_hours: Math.round((batches.reduce((a, b) => a + (b.adsCount || 0), 0) * 5 / 60) * 10) / 10,
  };

  const stats = [
    { v: totals.batches_total,                                         l: "Lotes creados" },
    { v: totals.creatives_total,                                       l: "Creatividades generadas" },
    { v: totals.formats_total,                                         l: "Formatos disponibles" },
    { v: `${totals.time_saved_hours}h`,                                l: "Tiempo ahorrado",           tip: TIME_SAVED_TOOLTIP },
  ];
  const recent = [...batches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  return (
    <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Hero banner */}
      <div style={{ background: T.gradient, padding: "40px 40px 36px" }}>
        <div style={{ maxWidth: 820 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>AdBatch · Generador de creatividades</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, color: T.white, marginBottom: 10, fontFamily: '"Rubik","Calibri",sans-serif' }}>
            Buenos días.
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)" }}>
            {batches.filter(b => b.status === "generating").length || 0} lotes procesando.
          </p>
        </div>
      </div>

      <div className="dash-body">

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 8px rgba(32,32,32,0.06)" }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.v.toLocaleString?.() ?? s.v}</div>
            <div style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              {s.l}
              {s.tip && (
                <span
                  title={s.tip}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 14, height: 14, borderRadius: "50%",
                    border: `1px solid ${T.cardBorder}`, color: T.textMuted,
                    fontSize: 9, fontWeight: 700, cursor: "help", lineHeight: 1,
                  }}
                >
                  i
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Lotes recientes</h2>
        <button onClick={() => onNav("batches")} style={{ background: "transparent", fontSize: 12, color: T.textMuted }}>Ver todos →</button>
      </div>

      <div className="batch-table-wrap" style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 8px rgba(32,32,32,0.06)" }}>
        {recent.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Sin lotes aún. Crea tu primer lote para comenzar.</div>
        ) : recent.map((b, i) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < recent.length - 1 ? `1px solid ${T.cardBorder}` : "none", gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.cream, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{b.brand} · {new Date(b.createdAt).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" })}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, marginRight: 16 }}>{b.adsCount || 0}</span>
            <Chip status={b.status} />
          </div>
        ))}
      </div>

      <div style={{ background: T.gradient, borderRadius: 16, padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.white, marginBottom: 6 }}>¿Listo para generar tu próximo lote?</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>Elige tus formatos y obtén todos los tamaños de una vez.</div>
        </div>
        <button onClick={onNewBatch} style={{ background: T.white, color: T.text, fontSize: 13, fontWeight: 700, padding: "10px 22px", borderRadius: 999, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
          + Generar
        </button>
      </div>
    </div>
    </div>
  );
}
