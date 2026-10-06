import { appConfig } from "./config";

// ─── MODEL SELECTION ────────────────────────────────────────────────
// Mismo catálogo que course-cover-engine. Text and image models are
// user-selectable (dropdowns in the confirm step), persisted in localStorage
// so they survive reloads; un id guardado que ya no exista vuelve al default.
// En modo Rápido todo va por LiteLLM, que enruta por nombre.
export const TEXT_MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite - multimodal · rápido y económico" },
];

const DEFAULT_TEXT_MODEL = TEXT_MODELS[0].id;

const TEXT_MODEL_STORAGE_KEY = "adbatch_text_model";

// Los modelos de Gemini van por chat/completions con modalities; los de OpenAI
// (provider "openai") por la Images API. generateImage() bifurca según provider.
// En Batch: Gemini por la Batch API nativa de Google (GEMINI_API_KEY) y OpenAI
// por los managed batches de LiteLLM (misma LITELLM_API_KEY) — ver server.js.
// usd / usdBatch: $ por imagen de referencia (los de course-cover-engine), no
// una cotización en vivo.
export const IMAGE_MODELS = [
  { id: "gemini-3-pro-image",     label: "Gemini 3 Pro Image - Recomendado (máxima calidad)", provider: "gemini", usd: 0.134, usdBatch: 0.067 },
  { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image - Rápido y económico",       provider: "gemini", usd: 0.067, usdBatch: 0.034 },
  { id: "gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst (OpenAI) - Máxima calidad", provider: "openai", usd: 0.051, usdBatch: 0.026 },
];

const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].id;

const IMAGE_MODEL_STORAGE_KEY = "adbatch_image_model";

export const imageModelInfo = id => IMAGE_MODELS.find(m => m.id === id) || IMAGE_MODELS[0];

// ¿Puede el server lanzar un Batch con este modelo? OpenAI va por LiteLLM;
// Gemini necesita la key nativa de AI Studio.
export function batchAvailableFor(modelId) {
  return imageModelInfo(modelId).provider === "openai" ? !!appConfig.hasLlmKey : !!appConfig.hasBatchKey;
}

export const IMG_DELAY_MS = 2000;

export function getTextModel() {
  try {
    const stored = localStorage.getItem(TEXT_MODEL_STORAGE_KEY);
    if (TEXT_MODELS.some(m => m.id === stored)) return stored;
  } catch { /* localStorage unavailable (SSR/privacy mode) — use default */ }
  return DEFAULT_TEXT_MODEL;
}

export function setTextModel(id) {
  try { localStorage.setItem(TEXT_MODEL_STORAGE_KEY, id); } catch { /* ignore */ }
}

export function getImageModel() {
  try {
    const stored = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY);
    if (IMAGE_MODELS.some(m => m.id === stored)) return stored;
  } catch { /* localStorage unavailable (SSR/privacy mode) — use default */ }
  return DEFAULT_IMAGE_MODEL;
}

export function setImageModel(id) {
  try { localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, id); } catch { /* ignore */ }
}

// Selector Rápido/Batch para las imágenes (mismo patrón de course-cover-engine:
// dos botones lado a lado, persistido en localStorage). "Batch" envía todas las
// imágenes del lote de golpe — 50% más barato, asíncrono (normalmente
// 15min–2h): los modelos Gemini por la Google Batch API con la GEMINI_API_KEY
// del server, el de OpenAI por los managed batches de LiteLLM. Solo disponible
// si el server puede con el modelo elegido (batchAvailableFor).
const IMG_MODE_STORAGE_KEY = "adbatch_img_mode";

export function getImgMode() {
  try {
    const m = localStorage.getItem(IMG_MODE_STORAGE_KEY);
    return m === "batch" ? "batch" : "rapid";
  } catch { return "rapid"; }
}

export function setImgMode(id) {
  try { localStorage.setItem(IMG_MODE_STORAGE_KEY, id); } catch { /* ignore */ }
}
