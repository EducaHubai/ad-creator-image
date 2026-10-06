import { useTheme } from "../theme/tokens.js";

export function TopBar({ title, creditsLeft, onNewBatch, onMenuToggle }) {
  const T = useTheme();
  return (
    <div style={{ background: T.card, borderBottom: `1px solid ${T.cardBorder}`, flexShrink: 0, boxShadow: "0 1px 4px rgba(32,32,32,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 12px 24px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button className="hamburger-btn" onClick={onMenuToggle} style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: T.cream, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: "nowrap" }}>{creditsLeft} restantes</span>
          <button onClick={onNewBatch} style={{ background: T.text, color: T.white, fontSize: 12, fontWeight: 600, padding: "7px 18px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nuevo lote
          </button>
        </div>
      </div>
    </div>
  );
}
