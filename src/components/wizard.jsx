import { useTheme } from "../theme/tokens.js";

export function StepIndicator({ step, total }) {
  const T = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: i < step ? 8 : i === step ? 22 : 8, height: 8, borderRadius: 4, background: i < step ? T.accent : i === step ? T.text : T.cardBorder, transition: "all 0.3s" }} />
          {i < total - 1 && <div style={{ width: 16, height: 1, background: T.cardBorder }} />}
        </div>
      ))}
      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>Paso {step + 1} de {total}</span>
    </div>
  );
}

export function SelectPill({ label, selected, onClick, accent }) {
  const T = useTheme();
  return (
    <button onClick={onClick} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${selected ? (accent ? T.accent : T.text) : T.cardBorder}`, background: selected ? (accent ? T.accent : T.text) : T.card, color: selected ? (accent ? T.accentDark : T.cream) : T.textMuted, fontSize: 12, fontWeight: selected ? 600 : 400, transition: "all 0.15s", cursor: "pointer" }}>
      {label}
    </button>
  );
}

// ─── GENERATE CHOICE ────────────────────────────────────────────────────
// Fork shown before the wizard: build from scratch off the brand's own
// rules (today's pilot: 5 AI-brainstormed directions to approve), or
// replicate one existing creative the user already has, straight across
// every course with no brainstorm/approval step.
export function GenerateChoice({ onChoose }) {
  const T = useTheme();
  const cards = [
    {
      path: "scratch",
      title: "Crear desde cero",
      desc: "La IA brainstormea 5 direcciones de diseño basadas en el brandbook de la marca. Elegís una y se replica en todos los cursos del CSV.",
    },
    {
      path: "replicate",
      title: "Replicar una creatividad existente",
      desc: "Subís una imagen de referencia (un anuncio ya hecho), la IA la analiza, y ese mismo diseño se replica en todos los cursos — solo cambian título, keywords e imagen.",
    },
    {
      path: "template",
      title: "Clonar con plantilla (beta)",
      desc: "Subís un anuncio y marcás sus zonas (foto, textos, CTA, logo). Cada fila del CSV genera un anuncio idéntico a la referencia: solo cambian la foto y los textos que mapees.",
    },
  ];
  return (
    <div className="fade-in content-area" style={{ flex: 1, padding: "40px 32px", maxWidth: 900 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>¿Cómo querés generar este lote?</h1>
      <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 32 }}>Elegí un camino — el resto del wizard se adapta según cuál elijas.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        {cards.map(c => (
          <button key={c.path} onClick={() => onChoose(c.path)}
            style={{ textAlign: "left", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 10, transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.text}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{c.title}</div>
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{c.desc}</div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: T.blueMid }}>Elegir →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
