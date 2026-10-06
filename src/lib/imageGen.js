import { AR_HINTS } from "./formats.js";
import { callLLMChat, callLLMImages, callOpenAI } from "./llm.js";
import { getImageModel, imageModelInfo } from "./models.js";
import { NO_TEXT_IMAGE_RULE } from "./styleDirections.js";

export async function generateImagePrompt(brandConfig, courseData, research, copy) {
  const colors = brandConfig.colors || {};
  const colorPalette = [
    colors.primary   ? `Primary: ${colors.primary}`   : "",
    colors.secondary ? `Secondary: ${colors.secondary}` : "",
    colors.accent    ? `Accent: ${colors.accent}`     : "",
  ].filter(Boolean).join(" / ");

  const system = `You are a visual art director. Generate a background image prompt for a digital ad. Return ONLY the prompt text — no explanation, no markdown. Max 160 words.`;

  const user = `## BRAND VISUAL IDENTITY
Brand: ${brandConfig.name}
Tone: ${brandConfig.tone || ""}
Personality: ${brandConfig.personality || ""}
Positioning: ${brandConfig.positioning || ""}
Color palette: ${colorPalette}
Display typeface character: ${brandConfig.fonts?.display || "modern sans-serif"}
${brandConfig.brandImageStyle ? `Established visual aesthetic: ${brandConfig.brandImageStyle}` : ""}

## COURSE CONTEXT
Course: ${courseData.name}${courseData.nivel ? ` (${courseData.nivel})` : ""}
Category: ${research.category || "education"}
Outcome: ${research.outcome || ""}

## AD CONTEXT
Headline: ${copy.headline || ""}
Pain point: ${copy.painPoint || ""}

## INSTRUCTIONS
Create a cinematic photorealistic background that visually represents the transformation offered by this course, aligned with the brand's visual identity and color palette.
HARD RULES: NO text, NO logos, NO typography, NO people holding phones or signs, NO UI elements.
Color grading should harmonize with the brand palette above.
Specify: mood, lighting quality, composition, depth of field, photographic style.`;

  const authored = (await callOpenAI(system, user, 280)).trim();
  return `${authored}\n\n${NO_TEXT_IMAGE_RULE}`;
}

// referenceImageDataUrl (optional): when given, the model edits/recreates
// FROM that actual image instead of only a text description — Gemini image
// models take image+text multimodal input, same shape as vision analysis.
// Used by the replicate path to test exact-fidelity reproduction of the
// uploaded creative rather than relying only on the derived text analysis.
//
// gpt-image-2.5 acepta cualquier tamaño con lados múltiplos de 16 y ratio
// entre 1:3 y 3:1, así que cada AR se pide NATIVO (mismos tamaños que
// course-cover-engine). Se usa tanto en Rápido como en Batch (el server no
// tiene su propia tabla: recibe el size por item).
const OPENAI_IMAGE_QUALITY = "high";

const OPENAI_SIZE_FOR_AR = {
  "1:1":  "1024x1024",
  "9:16": "864x1536", "4:5": "1024x1280", "2:3": "1024x1536",
  "16:9": "1536x864", "3:2": "1536x1024",
};

export const openaiSizeForAr = ar => OPENAI_SIZE_FOR_AR[ar] || "1024x1024";

export async function generateImage(prompt, aspectRatio, referenceImageDataUrl) {
  const modelId = getImageModel();
  const arHint = AR_HINTS[aspectRatio] || `${aspectRatio} aspect ratio`;

  if (imageModelInfo(modelId).provider === "openai") {
    // OpenAI image models van por la Images API (no chat/completions): devuelven
    // el PNG en data[0].b64_json. gpt-image no admite response_format ni una
    // imagen de referencia por este endpoint, así que la ruta de replicar cae a
    // solo-texto (para fidelidad exacta desde una imagen, usa un modelo Gemini).
    const data = await callLLMImages({
      model: modelId,
      prompt,
      size: openaiSizeForAr(aspectRatio),
      quality: OPENAI_IMAGE_QUALITY,
      output_format: "png",
      n: 1,
    });
    const b64 = data.data?.[0]?.b64_json;
    return b64 ? b64.replace(/[\r\n\s]/g, "") : null;
  }

  // Gemini image models via LiteLLM go through chat/completions with the image
  // modality — /v1/images/generations no las soporta. max_tokens tiene que ser
  // enorme o el PNG base64 llega truncado (sin chunk IEND).
  const text = `${prompt}\n\nRender the image with ${arHint}.`;
  const content = referenceImageDataUrl
    ? [{ type: "image_url", image_url: { url: referenceImageDataUrl } }, { type: "text", text }]
    : text;
  const data = await callLLMChat({
    model: modelId,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    max_tokens: 32768,
  });
  // LiteLLM devuelve la imagen inline en choices[0].message.images[] como data URL.
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl || !imageUrl.startsWith("data:")) return null;
  return (imageUrl.split(",")[1] || "").replace(/[\r\n\s]/g, "");
}
