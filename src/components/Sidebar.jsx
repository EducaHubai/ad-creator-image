import { IcoMoon, IcoSun } from "./icons.jsx";
import { useTheme, useThemeName, useThemeToggle } from "../theme/tokens.js";

// ─── SIDEBAR ────────────────────────────────────────────────────────
// Pantallas hijas mantienen resaltada su sección padre en el nav (p. ej.
// entrar al detalle de un lote no debe quitar el foco de "Lotes").
const SCREEN_PARENT = {
  "generate-choice": "generate",
  processing: "batches",
  "batch-detail": "batches",
};

export function Sidebar({ active, onNav, batches, isOpen, onClose }) {
  const T = useTheme();
  const themeName = useThemeName();
  const toggle = useThemeToggle();
  const pendingCount = batches.filter(b => b.status === "review").length;
  const navItems = [
    { id: "dashboard", label: "Tablero" },
    { id: "generate",  label: "Generar",  badge: "nuevo", navTo: "generate-choice" },
    { id: "batches",   label: "Lotes",    badge: pendingCount > 0 ? pendingCount : null },
    { id: "brands",    label: "Marcas" },
  ];
  const isLight = themeName === "light";
  const sidebarBg = isLight ? "#FFFFFF" : "#1A1A1A";
  const divider = isLight ? `1px solid #E0E0E0` : `1px solid rgba(255,255,255,0.08)`;
  const activeItemBg = isLight ? "rgba(32,32,32,0.06)" : "rgba(255,255,255,0.07)";
  const footerTextColor = isLight ? "rgba(32,32,32,0.55)" : "rgba(255,255,255,0.55)";
  return (
    <aside className={`app-sidebar${isOpen ? " sidebar-open" : ""}`} style={{ background: sidebarBg, display: "flex", flexDirection: "column", minHeight: "100vh", borderRight: divider }}>
      <div className="gradient-line" />
      <div style={{ padding: "18px 20px 20px" }}>
        <img
          src={isLight ? "/logo.svg" : "/logo-negative.svg"}
          alt="EDUCA EDTECH Group"
          style={{ width: "100%", maxWidth: 148, display: "block" }}
          onError={e => { e.target.src = "/logo-negative.svg"; }}
        />
      </div>
      <div style={{ padding: "0 20px 16px", borderBottom: divider }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.teal, letterSpacing: "0.12em", textTransform: "uppercase" }}>AdBatch</div>
        <div style={{ fontSize: 10, color: T.sidebarText, marginTop: 2 }}>Generador de creatividades</div>
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {navItems.map(item => {
          const isActive = (SCREEN_PARENT[active] || active) === item.id;
          return (
            <button key={item.id} onClick={() => { onNav(item.navTo || item.id); onClose?.(); }}
              className={`side-nav-btn ${isLight ? "side-nav-light" : "side-nav-dark"}`}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", ...(isActive ? { background: activeItemBg } : {}), color: isActive ? T.sidebarAct : T.sidebarText, fontSize: 13, fontWeight: isActive ? 600 : 400, letterSpacing: "0.01em", borderLeft: isActive ? `2px solid ${T.teal}` : "2px solid transparent" }}>
              <span>{item.label}</span>
              {item.badge && (
                <span style={{ background: T.accent, color: T.accentDark, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "12px 20px 16px", borderTop: divider }}>
        <button onClick={toggle}
          className={`side-nav-btn ${isLight ? "side-nav-light" : "side-nav-dark"}`}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: T.sidebarText, marginBottom: 12 }}>
          {isLight ? <IcoMoon s={13} /> : <IcoSun s={13} />}
          {isLight ? "Tema oscuro" : "Tema claro"}
        </button>
        <div style={{ fontSize: 9, fontWeight: 700, color: footerTextColor, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.5 }}>
          Together our future is bright.
        </div>
      </div>
    </aside>
  );
}
