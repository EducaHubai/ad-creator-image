import { loadImage } from "./composite.js";
import { generateImage } from "./imageGen.js";
import { getImageModel, imageModelInfo } from "./models.js";
import { getSignedUrl, BUCKETS } from "./supabase";
import { buildPhotoPrompt, nearestAspect, photoStyleReference, renderTemplate, textSlotsByProminence } from "./template.js";

// ─── TEMPLATE PIPELINE ───────────────────────────────────────────────
// Lotes retomados desde la BD no traen la referencia en memoria (es un data
// URL de MBs, no se persiste en config) — se sirve por el proxy de storage.
export async function resolveTemplate(template) {
  if (template.referenceData || !template.referencePath) return template;
  return { ...template, referenceData: await getSignedUrl(BUCKETS.brandAssets, template.referencePath) };
}

// Plantillas del lote. Lotes anteriores a "varias plantillas por resolución"
// guardaban una sola en config.template, con salida al tamaño de la referencia.
export function batchTemplates(config) {
  if (config.templates?.length) return config.templates;
  const t = config.template;
  return t ? [{ ...t, outW: t.width, outH: t.height, outLabel: `${t.width}x${t.height}` }] : [];
}

// Foto nueva para el slot de foto de una plantilla y una fila del CSV.
export async function generateTemplatePhoto(template, row, referenceImg) {
  const photoSlot = template.slots.find(s => s.type === "photo");
  if (!photoSlot) return null;
  // Los modelos de OpenAI no reciben imagen de referencia (Images API):
  // con ellos el prompt no debe hablar de una imagen adjunta.
  const acceptsReference = imageModelInfo(getImageModel()).provider !== "openai";
  const styleRef = photoSlot.useStyleReference && acceptsReference ? await photoStyleReference(template, photoSlot, referenceImg) : null;
  const imagePrompt = buildPhotoPrompt(template, photoSlot, row, { withStyleRef: !!styleRef });
  const b64 = await generateImage(imagePrompt, nearestAspect(photoSlot.w, photoSlot.h), styleRef || undefined);
  if (!b64) throw new Error("El modelo de imagen no devolvió ninguna foto");
  return { photoSrc: `data:image/png;base64,${b64}`, imagePrompt };
}

// La plantilla se renderiza a su tamaño nativo; si la resolución de salida es
// otra, se escala (misma proporción) o se recorta al centro (proporción distinta).
async function fitToSize(dataUrl, w, h) {
  const img = await loadImage(dataUrl);
  if (!img || (img.naturalWidth === w && img.naturalHeight === h)) return dataUrl;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c.toDataURL("image/png");
}

// Una fila del CSV × una plantilla → un anuncio. `photo` = foto ya generada
// (null = se conserva la de la referencia).
export async function renderTemplateRow(template, row, { brand, referenceImg, photo = null }) {
  const result = await renderTemplate(template, { row, photoSrc: photo?.photoSrc || null, brand, referenceImg });
  const dataUrl = template.outW ? await fitToSize(result.dataUrl, template.outW, template.outH) : result.dataUrl;
  const texts = textSlotsByProminence(template).map(s => result.values[s.id] || "");
  const cta = template.slots.find(s => s.type === "cta");
  const copy = { headline: texts[0] || "", body: texts[1] || "", cta: cta ? result.values[cta.id] || "" : "" };
  return { ...result, dataUrl, copy, imagePrompt: photo?.imagePrompt || "" };
}
