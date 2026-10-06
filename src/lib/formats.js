import { getImageModel, imageModelInfo } from "./models.js";

// ─── IMAGE GENERATION ────────────────────────────────────────────────
// `api` is an aspect-ratio hint embedded in the prompt (gemini image models via
// LiteLLM chat/completions take no size param — same approach as
// course-cover-engine). compositeAd stretches to the exact w×h afterwards.
export const FORMAT_SIZES = {
  story:     { w: 1080, h: 1920, api: "9:16" },
  feed_4x5:  { w: 1080, h: 1350, api: "4:5" },
  square:    { w: 1080, h: 1080, api: "1:1" },
  landscape: { w: 1200, h: 628,  api: "16:9" },
};

export const AR_HINTS = {
  "1:1":  "square 1:1 aspect ratio",
  "9:16": "vertical 9:16 portrait aspect ratio",
  "4:5":  "vertical 4:5 portrait aspect ratio",
  "16:9": "horizontal 16:9 landscape aspect ratio",
  "3:2":  "3:2 landscape aspect ratio",
  "2:3":  "2:3 portrait aspect ratio",
};

// Accepts "1200x800", "1200×800", "1200 x 800", "1200×800px" — anything with
// two numbers separated by an x/×. Returns null (not a silent fallback) when
// unparseable, so the UI can show a real "esto no es válido" instead of
// quietly generating a default 1080×1080 the user never asked for.
export function parseCustomDim(dim) {
  const m = String(dim || "").match(/(\d+)\s*[×x]\s*(\d+)/i);
  if (!m) return null;
  const w = parseInt(m[1], 10), h = parseInt(m[2], 10);
  if (!w || !h) return null;
  return { w, h };
}

export function customDimToSize(dim) {
  const parsed = parseCustomDim(dim);
  if (!parsed) return { w: 1080, h: 1080, api: "1:1" };
  const { w, h } = parsed;
  const ratio = w / h;
  if (ratio > 1.3) return { w, h, api: "3:2" };
  if (ratio < 0.8) return { w, h, api: "2:3" };
  return { w, h, api: "1:1" };
}

// Image cost is driven purely by generateImage() calls, not by format count
// or variantCount — every format is compositeAd'd from the SAME generated
// image, and variantCount only repeats the (much cheaper) copy/text call.
// So: pilot flow = 5 (candidates) + 1 per remaining course; otherwise 1 per
// course. Los 5 candidatos del piloto van siempre en Rápido; el resto al
// precio del modo elegido. Precios por imagen de IMAGE_MODELS (ballpark).
export function estimateBatchCost(courseCount, usePilotFlowEstimate, modelId = getImageModel(), imgMode = "rapid") {
  const { usd, usdBatch } = imageModelInfo(modelId);
  const restPrice = imgMode === "batch" ? usdBatch : usd;
  if (usePilotFlowEstimate) {
    const rest = Math.max(0, courseCount - 1);
    return { imagesEstimate: 5 + rest, costEstimate: 5 * usd + rest * restPrice };
  }
  return { imagesEstimate: courseCount, costEstimate: courseCount * restPrice };
}
