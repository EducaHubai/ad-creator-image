import { callOpenAIVision } from "./llm.js";

export function resizeImageFile(file, maxDim = 768, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── BRAND VISUAL ANALYSIS ───────────────────────────────────────────
// Las imágenes cargadas de la BD llevan .data = URL del proxy de storage
// (same-origin, tras Basic Auth) — el LLM no puede descargarla. Antes de
// enviar cualquier imagen al modelo hay que materializarla como data URL.
async function srcToDataUrl(src) {
  if (!src || src.startsWith("data:")) return src || null;
  const blob = await (await fetch(src)).blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`No se pudo leer la imagen: ${src}`));
    reader.readAsDataURL(blob);
  });
}

export async function analyzeRefImages(refImages) {
  if (!refImages?.length) return "";
  const urls = await Promise.all(refImages.slice(0, 4).map(img => srcToDataUrl(img.data || img)));
  const imageBlocks = urls.filter(Boolean).map(url => ({
    type: "image_url",
    image_url: { url, detail: "low" },
  }));
  const result = await callOpenAIVision(
    "You are a visual brand analyst. Analyze the reference images and return a concise 2-3 sentence visual aesthetic descriptor: color mood, lighting style, composition, photographic feel. Use concrete visual language suitable for image generation prompts. Return only the descriptor text.",
    [...imageBlocks, { type: "text", text: "Describe the visual aesthetic for ad image generation prompts." }],
    250
  );
  return result.trim();
}

// Richer than analyzeRefImages above — this has to stand in directly for a
// STYLE_VARIANTS-style direction.description with no brainstorm step to
// refine it, so it needs to be detailed and concrete enough to hand straight
// to an image generation model, not just a mood blurb.
// Structured analysis, not a free-text blurb — forces the model to actually
// nail down each dimension (photo type, where the title/logo sit, palette,
// other elements) instead of a vague summary that tends to miss the layout
// details needed to replicate it consistently across every course/format.
const CORNERS = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);

const HEX_RE = /^#[0-9a-f]{6}$/i;

// Devuelve { description, layout }: `description` es la prosa que ya se
// mandaba al prompt de generación de imagen (fondo); `layout` son los datos
// normalizados (esquina/color) que compositeAd usa para posicionar el texto
// y el logo REALES — sin esto, el paso de composición ignoraba por completo
// dónde estaba el título/logo en la referencia y siempre pintaba su propia
// plantilla fija abajo-izquierda con los colores de marca.
export async function analyzeReferenceCreative(imageSrc) {
  if (!imageSrc) return { description: "", layout: null };
  const imageDataUrl = await srcToDataUrl(imageSrc);
  const raw = await callOpenAIVision(
    `You are a visual art director. Analyze this ad creative's design system and return ONLY valid JSON (no markdown, no preamble) with this exact shape:
{
  "photoType": "individual" | "group" | "product" | "other",
  "photoTypeDetail": "brief shot description — framing/crop, e.g. close-up upper body, wide full-body, flat-lay product",
  "titleZone": "where the title/headline block sits, e.g. 'top-left, on a solid dark band covering ~40% width'",
  "titleCorner": "top-left" | "top-right" | "bottom-left" | "bottom-right",
  "logoZone": "where the logo sits, e.g. 'top-left corner, small, over the title band'",
  "logoCorner": "top-left" | "top-right" | "bottom-left" | "bottom-right",
  "colorPalette": ["#hex or short color name", "..."],
  "textColor": "#hex — the exact color of the title/body TEXT itself (not the background band behind it)",
  "ctaColor": "#hex — background color of the CTA button/pill, if there is one (omit/empty if none)",
  "otherElements": [{"element": "short name, e.g. CTA pill / keyword tags / corner accent shape", "position": "where it sits"}],
  "photographicMood": "lighting/treatment/style only — warmth, contrast, depth of field, framing style"
}

CRITICAL — two things you must NOT do:
1. Do not describe the specific photographic subject (who/what is depicted — the actual people, objects, actions in the shot). That subject belongs to THIS reference only and must NOT carry over; the regenerated version needs its own subject matching a different course. photographicMood/photoTypeDetail describe STYLE only (e.g. "warm, soft-lit close-up lifestyle photography"), never literal content.
2. titleZone/logoZone/otherElements are ONLY metadata for code to position text afterward — they are NEVER instructions to paint anything. Do not describe them as a solid box, panel, band, plate, or shape of any kind, and never suggest the regenerated image should contain a rectangle, empty frame, or color block standing in for them. The regenerated image must be a plain, uninterrupted photograph with no text, no letters, and no placeholder shapes anywhere.`,
    [
      { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
      { type: "text", text: "Analyze this creative's design system as the JSON schema described. No text/lettering in any zone description, no specific subject matter." },
    ],
    500
  );

  try {
    const d = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const palette = Array.isArray(d.colorPalette) ? d.colorPalette.join(", ") : "";
    const otherElements = Array.isArray(d.otherElements)
      ? d.otherElements.map(e => `${e.element} (${e.position})`).join("; ")
      : "";
    const description = [
      d.photoType ? `Tipo de foto: ${d.photoType}${d.photoTypeDetail ? ` — ${d.photoTypeDetail}` : ""}.` : "",
      d.photographicMood ? `Tratamiento fotográfico: ${d.photographicMood}.` : "",
      d.titleZone ? `Zona reservada para el título (NO pintar ninguna caja/panel/rectángulo ahí — mantenerla visualmente simple, sin sujeto principal, es solo espacio para texto agregado después por código): ${d.titleZone}.` : "",
      d.logoZone ? `Zona reservada para el logo (NO pintar ninguna caja/forma ahí, mismo criterio): ${d.logoZone}.` : "",
      palette ? `Paleta: ${palette}.` : "",
      otherElements ? `Otros elementos de referencia (no pintarlos como formas/paneles — son solo metadata de posición): ${otherElements}.` : "",
    ].filter(Boolean).join(" ");
    // El modelo no siempre devuelve titleCorner/logoCorner en el enum exacto —
    // si falla, se infiere de las palabras de la zona en prosa (que sí suele
    // acertar) antes de caer al default; evita el mismatch entre "la foto
    // reserva arriba" (texto libre, va al prompt de imagen) y "el texto real
    // se pinta abajo" (layout, va a compositeAd) que rompía el resultado.
    function inferCorner(explicit, zoneText, fallback) {
      if (CORNERS.has(explicit)) return explicit;
      const t = String(zoneText || "").toLowerCase();
      const vert = /top|upper/.test(t) ? "top" : /bottom|lower/.test(t) ? "bottom" : null;
      const horiz = /right/.test(t) ? "right" : /left/.test(t) ? "left" : null;
      return vert && horiz ? `${vert}-${horiz}` : fallback;
    }
    const layout = {
      titleCorner: inferCorner(d.titleCorner, d.titleZone, "bottom-left"),
      logoCorner: inferCorner(d.logoCorner, d.logoZone, "bottom-right"),
      textColor: HEX_RE.test(d.textColor || "") ? d.textColor : null,
      ctaColor: HEX_RE.test(d.ctaColor || "") ? d.ctaColor : null,
    };
    return { description, layout };
  } catch {
    // Model didn't return valid JSON — fall back to the raw text as-is for
    // the description; sin layout normalizado, compositeAd usa sus defaults.
    return { description: raw.trim(), layout: null };
  }
}
