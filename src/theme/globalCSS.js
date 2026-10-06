export const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&family=Ubuntu:wght@400;700&display=swap');
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Light.ttf")   format("truetype"); font-weight:300; font-display:swap; }
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Regular.ttf") format("truetype"); font-weight:400; font-display:swap; }
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Medium.ttf")  format("truetype"); font-weight:500; font-display:swap; }
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Bold.ttf")    format("truetype"); font-weight:700; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Light.ttf")    format("truetype"); font-weight:300; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Regular.ttf")  format("truetype"); font-weight:400; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Italic.ttf")   format("truetype"); font-weight:400; font-style:italic; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Bold.ttf")     format("truetype"); font-weight:700; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-BoldItalic.ttf") format("truetype"); font-weight:700; font-style:italic; font-display:swap; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; }
  body { font-family: "Lato", "Calibri", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.3); border-radius: 2px; }
  button { cursor: pointer; border: none; outline: none; font-family: inherit; }
  input, textarea, select { font-family: inherit; outline: none; }

  /* ── Hover universal en botones y enlaces ──
     Velo con el color del propio texto (::after): oscurece ligeramente los
     botones claros y aclara los oscuros, sin tocar el estilo inline de cada
     botón. pointer-events:none para que el velo nunca capture clics. */
  button:not(:disabled) { position: relative; }
  button:not(:disabled)::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit;
    background: currentColor; opacity: 0; transition: opacity 0.15s; pointer-events: none;
  }
  button:not(:disabled):hover::after  { opacity: 0.08; }
  button:not(:disabled):active::after { opacity: 0.14; }
  a { transition: opacity 0.15s; }
  a:hover { opacity: 0.75; }
  .fade-in { animation: fadeIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .gradient-line { height: 3px; width: 100%; background: linear-gradient(90deg, #60BFB8 0%, #2E7ABE 25%, #244A80 50%, #963058 80%, #E96A73 100%); display: block; border: 0; }

  /* ── Sidebar nav hover ──
     El background activo va inline (gana al :hover), así que el hover solo
     se nota en items no activos — que es justo lo que queremos. */
  .side-nav-btn { background: transparent; transition: background 0.15s, color 0.15s; }
  .side-nav-light:hover { background: rgba(32,32,32,0.05); }
  .side-nav-dark:hover  { background: rgba(255,255,255,0.06); }

  /* ── Main content area ── */
  .dash-body { padding: 36px 40px; flex: 1; }
  .content-area { padding: 40px 40px; flex: 1; }
  @media (max-width: 767px) { .dash-body { padding: 24px 20px; } .content-area { padding: 24px 20px; } }
  @media (max-width: 479px) { .dash-body { padding: 20px 16px; } .content-area { padding: 20px 16px; } }

  /* ── Responsive layout ── */
  .app-shell   { display: flex; min-height: 100vh; }
  .app-content { flex: 1; display: flex; flex-direction: column; min-height: 100vh; min-width: 0; overflow: hidden; }
  .app-sidebar {
    width: 200px; flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
  }
  .app-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(32,32,32,0.45); z-index: 199; cursor: pointer;
  }
  .hamburger-btn { display: none; }

  /* Stats grid — 4 cols desktop, wraps down */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin-bottom: 36px;
  }

  /* Batch table — allow horizontal scroll on small screens */
  .batch-table-wrap { overflow-x: auto; }

  @media (max-width: 1023px) {
    .app-sidebar {
      position: fixed; top: 0; left: 0; height: 100vh;
      z-index: 200; transform: translateX(-100%);
    }
    .app-sidebar.sidebar-open  { transform: translateX(0); }
    .app-overlay.sidebar-open  { display: block; }
    .hamburger-btn { display: flex; }
  }

  @media (max-width: 767px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 479px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
`;
