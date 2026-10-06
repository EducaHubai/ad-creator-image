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

// Una fila del CSV → un anuncio: foto nueva (si hay slot de foto y modelo de
// imagen disponible) + render determinista de la plantilla.
export async function renderTemplateRow(template, row, { brand, referenceImg, generatePhoto }) {
  const photoSlot = template.slots.find(s => s.type === "photo");
  let photoSrc = null, imagePrompt = "";
  if (photoSlot && generatePhoto) {
    // Los modelos de OpenAI no reciben imagen de referencia (Images API):
    // con ellos el prompt no debe hablar de una imagen adjunta.
    const acceptsReference = imageModelInfo(getImageModel()).provider !== "openai";
    const styleRef = photoSlot.useStyleReference && acceptsReference ? await photoStyleReference(template, photoSlot, referenceImg) : null;
    imagePrompt = buildPhotoPrompt(template, photoSlot, row, { withStyleRef: !!styleRef });
    const b64 = await generateImage(imagePrompt, nearestAspect(photoSlot.w, photoSlot.h), styleRef || undefined);
    if (!b64) throw new Error("El modelo de imagen no devolvió ninguna foto");
    photoSrc = `data:image/png;base64,${b64}`;
  }
  const result = await renderTemplate(template, { row, photoSrc, brand, referenceImg });
  const texts = textSlotsByProminence(template).map(s => result.values[s.id] || "");
  const cta = template.slots.find(s => s.type === "cta");
  const copy = { headline: texts[0] || "", body: texts[1] || "", cta: cta ? result.values[cta.id] || "" : "" };
  return { ...result, copy, imagePrompt };
}
