import { callOpenAIVision } from "./llm.js";
import { autoColorsForSlot, imageToCanvas, newSlot } from "./template.js";
import { loadImage } from "./composite.js";

// ─── TEMPLATE DETECTION ──────────────────────────────────────────────
// Un único análisis de visión que devuelve las cajas de cada elemento del
// anuncio (formato box_2d de Gemini: [ymin, xmin, ymax, xmax] normalizado a
// 0-1000) + el estilo fotográfico. Solo pre-rellena el editor: el usuario
// revisa y corrige las cajas antes de lanzar nada.
const SYSTEM = `You are an ad layout analyst. Detect every layout element of this ad creative and return ONLY valid JSON (no markdown):
{
  "elements": [
    {
      "type": "photo" | "text" | "cta" | "logo" | "decoration",
      "box_2d": [ymin, xmin, ymax, xmax],   // integers normalized 0-1000, TIGHT around the element
      "text": "exact visible text (text/cta only, original language and casing)",
      "role": "headline" | "subheadline" | "body" | "price" | "tag" | "other",
      "lines": 1,                           // number of text lines it occupies
      "align": "left" | "center" | "right",
      "weight": 400 | 500 | 700 | 800 | 900,
      "uppercase": false,
      "textColor": "#RRGGBB",
      "buttonColor": "#RRGGBB"              // cta only: the button fill
    }
  ],
  "photoOverlay": "none" | "gradient-bottom" | "gradient-top" | "gradient-left" | "tint",
  "photoStyle": "lighting, color grading, lens/depth of field, framing and photographic treatment — STYLE ONLY, never describe the specific people/objects/subject"
}
Rules:
- "photo" = the main photograph area (usually one). If the photo fills the whole ad, its box is the full canvas.
- Each separate text block is its own element (headline, subheadline, body, price, tag...). A CTA button is ONE "cta" element covering the whole button shape.
- Any text printed directly on the photo (e.g. a "NEW" tag with no shape of its own) is a "text" element (role "tag" if it is a label), NOT a decoration.
- "decoration" = badges, stickers, icons, illustrations or shapes (with their own background/shape) that sit ON the photo and must be preserved pixel-for-pixel.
- Do not include plain flat background color blocks — they stay as they are.`;

function toBox(b, W, H) {
  if (!Array.isArray(b) || b.length !== 4) return null;
  const [y0, x0, y1, x1] = b.map(Number);
  if ([y0, x0, y1, x1].some(n => !Number.isFinite(n))) return null;
  const box = { x: (x0 / 1000) * W, y: (y0 / 1000) * H, w: ((x1 - x0) / 1000) * W, h: ((y1 - y0) / 1000) * H };
  return box.w > 4 && box.h > 4 ? box : null;
}

const HEX = /^#[0-9a-f]{6}$/i;

export async function detectTemplate(referenceData) {
  const img = await loadImage(referenceData);
  if (!img) throw new Error("No se pudo leer la imagen de referencia");
  const W = img.naturalWidth, H = img.naturalHeight;

  const raw = await callOpenAIVision(SYSTEM, [
    { type: "image_url", image_url: { url: referenceData, detail: "high" } },
    { type: "text", text: "Detect the layout elements as JSON." },
  ], 2500);

  let d;
  try { d = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { throw new Error("La IA no devolvió un JSON válido — dibujá las cajas a mano o reintentá"); }

  const refCanvas = imageToCanvas(img);
  const slots = [];
  const roleLabel = { headline: "Título", subheadline: "Subtítulo", body: "Descripción", price: "Precio", tag: "Etiqueta" };
  for (const el of d.elements || []) {
    const box = toBox(el.box_2d, W, H);
    if (!box) continue;
    const type = el.type === "decoration" ? "keep" : el.type;
    if (!["photo", "text", "cta", "logo", "keep"].includes(type)) continue;
    const extra = {};
    if (type === "text" || type === "cta") {
      Object.assign(extra, {
        sampleText: String(el.text || ""),
        role: ["headline", "subheadline", "body", "price", "tag", "other"].includes(el.role) ? el.role : "other",
        label: type === "cta" ? "CTA" : roleLabel[el.role] || "Texto",
        maxLines: Math.max(1, Math.min(6, parseInt(el.lines) || 1)) + (type === "text" && el.role !== "price" ? 1 : 0),
        align: ["left", "center", "right"].includes(el.align) ? el.align : (type === "cta" ? "center" : "left"),
        weight: [300, 400, 500, 600, 700, 800, 900].includes(Number(el.weight)) ? Number(el.weight) : 700,
        uppercase: !!el.uppercase && el.text === String(el.text || "").toUpperCase(),
        font: el.role === "headline" || el.role === "subheadline" || type === "cta" ? "display" : "body",
      });
    }
    let slot = newSlot(type, box, extra);
    // Texto con 1 línea extra de margen: altura por línea según lo detectado.
    if (type === "text") slot.maxSize = Math.round(box.h / Math.max(1, parseInt(el.lines) || 1) / slot.lineHeight);
    // Colores medidos en píxeles reales; el del modelo solo como respaldo.
    const sampled = autoColorsForSlot(refCanvas, slot);
    slot = {
      ...slot,
      ...(HEX.test(el.textColor || "") ? { color: el.textColor } : {}),
      ...(type === "cta" && HEX.test(el.buttonColor || "") ? { ctaBg: el.buttonColor } : {}),
      ...sampled,
    };
    if (type === "photo" && d.photoOverlay && d.photoOverlay !== "none") {
      slot.overlay = { ...slot.overlay, type: d.photoOverlay, opacity: d.photoOverlay === "tint" ? 0.3 : 0.55 };
    }
    slots.push(slot);
  }
  // Fotos primero (se pintan debajo); el resto en el orden detectado.
  slots.sort((a, b) => (a.type === "photo" ? -1 : 0) - (b.type === "photo" ? -1 : 0));
  return { width: W, height: H, styleDescriptor: String(d.photoStyle || ""), slots };
}
