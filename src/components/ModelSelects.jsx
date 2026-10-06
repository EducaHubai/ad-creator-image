import { useState } from "react";
import { IMAGE_MODELS, TEXT_MODELS, batchAvailableFor, getTextModel, imageModelInfo, setTextModel } from "../lib/models.js";
import { useTheme } from "../theme/tokens.js";

// Controlado por el paso de confirmación (Generate): la disponibilidad de
// Batch depende del modelo de imagen elegido, y el coste estimado de ambos.
export function ImageModeSelect({ mode, onChange, imageModel }) {
  const T = useTheme();
  const isOpenAI = imageModelInfo(imageModel).provider === "openai";
  const modes = [
    { id: "rapid", label: "Rápido", detail: "Síncrono vía LiteLLM · ves cada imagen al generarse", hint: "Genera las imágenes una a una, en tiempo real." },
    batchAvailableFor(imageModel)
      ? { id: "batch", label: "Batch · 50% más barato", detail: `Asíncrono vía ${isOpenAI ? "LiteLLM (OpenAI Batch API)" : "Google Batch API"} · normalmente 15min–2h`, hint: "Envía todas las imágenes del lote de golpe. Mantén la pestaña abierta hasta que termine." }
      : isOpenAI
        ? { id: "batch", label: "Batch · no disponible", detail: "Requiere LiteLLM configurado en el server", hint: "Configura LITELLM_BASE_URL y LITELLM_API_KEY en el entorno del server.", disabled: true }
        : { id: "batch", label: "Batch · no disponible", detail: "Requiere GEMINI_API_KEY en el server", hint: "Configura GEMINI_API_KEY (Google AI Studio) en el entorno del server para activarlo.", disabled: true },
  ];
  const pick = onChange;
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Modo de generación de imágenes</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {modes.map(o => {
          const active = mode === o.id;
          return (
            <button key={o.id} onClick={() => !o.disabled && pick(o.id)} disabled={o.disabled} title={o.hint}
              style={{
                padding: "10px 14px", borderRadius: 10, textAlign: "left",
                border: `1px solid ${active ? T.text : T.cardBorder}`,
                background: active ? T.cream : "transparent",
                cursor: o.disabled ? "not-allowed" : "pointer", opacity: o.disabled ? 0.6 : 1,
                display: "flex", flexDirection: "column", gap: 3, transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: T.text }}>{o.label}</span>
              <span style={{ fontSize: 10, color: T.textMuted }}>{o.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Selector del modelo de texto — vive en el paso de confirmación del wizard,
// pero la elección (localStorage) aplica globalmente vía getTextModel(): también
// a la extracción de PDFs y al análisis de referencias en Marcas.
export function TextModelSelect() {
  const T = useTheme();
  const [model, setModel] = useState(getTextModel());
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Modelo de texto</label>
      <select
        value={model}
        onChange={e => { setModel(e.target.value); setTextModel(e.target.value); }}
        style={{
          width: "100%", fontSize: 13, color: T.text, background: T.card,
          border: `1px solid ${T.cardBorder}`, borderRadius: 10,
          padding: "10px 12px", cursor: "pointer",
        }}
      >
        {TEXT_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <div style={{ fontSize: 11, color: T.textLight, marginTop: 6 }}>
        Se usa para investigar los cursos, generar los copys y los prompts de imagen.
      </div>
    </div>
  );
}

// Selector del modelo de imagen — como el de texto, la elección se guarda en
// localStorage y aplica globalmente vía getImageModel(), en Rápido y en Batch.
// Controlado por Generate (ver ImageModeSelect).
export function ImageModelSelect({ model, onChange }) {
  const T = useTheme();
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Modelo de imagen</label>
      <select
        value={model}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", fontSize: 13, color: T.text, background: T.card,
          border: `1px solid ${T.cardBorder}`, borderRadius: 10,
          padding: "10px 12px", cursor: "pointer",
        }}
      >
        {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label} · ${m.usd.toFixed(3)}/img (Batch ${m.usdBatch.toFixed(3)})</option>)}
      </select>
      {imageModelInfo(model).provider === "openai" && (
        <div style={{ fontSize: 11, color: T.textLight, marginTop: 6 }}>
          GPT Image no recibe la imagen de referencia: en «replicar» genera solo desde el texto.
        </div>
      )}
    </div>
  );
}
