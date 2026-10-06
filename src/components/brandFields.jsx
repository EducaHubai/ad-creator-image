import { useState } from "react";
import { useTheme } from "../theme/tokens.js";

export function BrandField({ label, value, onChange, type = "text", hint }) {
  const T = useTheme();
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{label}</label>
      {type === "textarea" ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} rows={3}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text, resize: "vertical", lineHeight: 1.5 }} />
      ) : (
        <input type="text" value={value || ""} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
      )}
      {hint && <div style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function TagList({ items, onRemove, onAdd, placeholder, color }) {
  const T = useTheme();
  const [val, setVal] = useState("");
  const bg   = color === "red" ? "#fde8e8" : color === "green" ? T.statusDone.bg : T.card;
  const text = color === "red" ? T.statusFail.text : color === "green" ? T.statusDone.text : T.text;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {items.map((it, i) => (
          <span key={i} style={{ background: bg, color: text, border: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5 }}>
            {it}
            <button onClick={() => onRemove(i)} style={{ background: "transparent", color: text, fontSize: 12, lineHeight: 1, opacity: 0.85 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
          style={{ flex: 1, padding: "7px 10px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
        <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
          style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
      </div>
    </div>
  );
}

export function SwatchRow({ colors, onChange }) {
  const T = useTheme();
  const keys = ["primary", "secondary", "accent", "background", "text_on_overlay", "cta_text"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
      {keys.map(k => (
        <div key={k}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>{k.replace("_", " ")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: colors?.[k] || "#cccccc", border: `1px solid ${T.cardBorder}`, flexShrink: 0 }} />
            <input value={colors?.[k] || ""} onChange={e => onChange({ ...colors, [k]: e.target.value })}
              style={{ flex: 1, padding: "5px 8px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, background: T.cream, fontSize: 11, fontFamily: "monospace", color: T.text }} />
          </div>
        </div>
      ))}
    </div>
  );
}
