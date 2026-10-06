import { useEffect, useState } from "react";
import { SLOT_TYPES, renderTemplate } from "../lib/template.js";
import { useTheme } from "../theme/tokens.js";
import { ZoomableThumb } from "./ui.jsx";

// Mapea columnas del CSV a cada slot de la plantilla. Cada campo es texto
// libre con {{Columna}} — sirve igual para "columna tal cual", "texto fijo" o
// mezclas ("Desde {{Precio}}€"). Abajo, vista previa de las 3 primeras filas
// con la foto de la referencia (sin gastar imágenes).
export function TemplateMapping({ template, onChange, table, brand }) {
  const T = useTheme();
  const [previews, setPreviews] = useState([]);
  const fields = template.slots.filter(s => s.type === "text" || s.type === "cta" || s.type === "photo");

  function setField(id, key, value) {
    onChange({ ...template, slots: template.slots.map(s => s.id === id ? { ...s, [key]: value } : s) });
  }

  const sampleRows = table.rows.slice(0, 3);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const out = [];
      for (const row of sampleRows) {
        try { out.push(await renderTemplate(template, { row, brand })); }
        catch (err) { out.push({ error: err.message }); }
      }
      if (alive) setPreviews(out);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  // sampleRows deriva de table — basta con table como dependencia.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, table, brand]);

  const inputStyle = { flex: 1, minWidth: 0, padding: "7px 10px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text };

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>
          Columnas: {table.headers.map(h => <code key={h} style={{ fontSize: 11, background: T.cream, border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "1px 5px", marginRight: 4 }}>{h}</code>)}
        </div>
        {fields.map(s => {
          const key = s.type === "photo" ? "prompt" : "content";
          return (
            <div key={s.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: SLOT_TYPES[s.type]?.color }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{s.type === "photo" ? `${s.label} — tema de la foto generada` : s.label}</span>
                {s.sampleText && <span style={{ fontSize: 11, color: T.textLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>original: "{s.sampleText}"</span>}
              </div>
              <input value={s[key] || ""} onChange={e => setField(s.id, key, e.target.value)}
                placeholder={s.type === "photo" ? "ej. {{Título}} — profesional trabajando, temas: {{Keywords}}" : "{{Columna}} o texto fijo"}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box", fontFamily: "monospace" }} />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                {table.headers.map(h => (
                  <button key={h} onClick={() => setField(s.id, key, s.type === "photo" ? `${s[key] ? `${s[key]} ` : ""}{{${h}}}` : `{{${h}}}`)}
                    style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, color: T.textMuted }}>
                    {s.type === "photo" ? "+ " : ""}{h}
                  </button>
                ))}
                {s.type !== "photo" && s.sampleText && (
                  <button onClick={() => setField(s.id, key, s.sampleText)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, border: `1px dashed ${T.cardBorder}`, background: T.card, color: T.textMuted }}>
                    texto original fijo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Vista previa — primeras {sampleRows.length} filas <span style={{ fontWeight: 400, color: T.textMuted }}>(con la foto de la referencia; la foto nueva se genera al lanzar)</span></div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {previews.map((p, i) => (
          <div key={i} style={{ width: 180 }}>
            {p.error
              ? <div style={{ fontSize: 11, color: T.statusFail.text }}>{p.error}</div>
              : <ZoomableThumb src={p.dataUrl} title={`Fila ${i + 1}`} style={{ width: 180, height: 180 * template.height / template.width, objectFit: "cover", borderRadius: 8, border: `1px solid ${p.qaIssues?.length ? "#E0B84D" : T.cardBorder}` }} />}
            {p.qaIssues?.length > 0 && <div style={{ fontSize: 10, color: "#8A6300", marginTop: 4 }}>⚠ no entra: {[...new Set(p.qaIssues.map(q => q.label))].join(", ")}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
