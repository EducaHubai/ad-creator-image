import { callOpenAI, callOpenAIResponsesPDF } from "./llm.js";

export async function analyzeBrandPDF(pdfBase64Array, existingBrandName = "") {
  const system = `You are a brand intelligence analyst. Extract brand configuration from brand documents. Return ONLY valid JSON — no markdown, no explanation.

CRITICAL LANGUAGE RULE: every extracted text value (name, tagline, positioning, audience, personality, tone, voiceRules, adRules, extracted_notes) MUST stay in the exact original language of the source document(s). Do NOT translate anything to English or any other language, even though this schema's field descriptions below are written in English purely to describe structure. Detect the document's real language and put it in "language" — then write every other value in that same language.

TYPOGRAPHY RULE: actively look for a typography/type-system page — often titled "Tipografía", "Typography", "Fuentes", or shown as a specimen spread with sample letterforms ("Aa Aa Aa") next to a font name, sometimes with separate entries for headline/display vs body/text weights. Read the font family name(s) from there even if they only appear as a visual caption next to letterform samples, not as a separate text mention elsewhere. If display and body use the same family, repeat it in both fields. Only leave a font field empty if the document truly never names one anywhere.

Schema (English text below = structural hints only, not example output language):
{
  "name": "brand display name",
  "tagline": "official tagline",
  "website": "website URL if mentioned",
  "positioning": "one sentence: what brand is and who for",
  "audience": "primary target audience",
  "personality": "comma-separated traits",
  "language": "es / en / pt / fr",
  "tone": "tone of voice in 1-2 sentences",
  "colors": { "primary": "#hexcode", "secondary": "#hexcode", "accent": "#hexcode", "background": "#hexcode", "text_on_overlay": "#ffffff", "cta_text": "#ffffff" },
  "fonts": { "display": "exact headline/display font family name from the document's typography page", "body": "exact body/text font family name from the document's typography page" },
  "voiceRules": { "headline": ["rule 1"], "body": ["rule 1"], "forbidden": ["word1"] },
  "adRules": { "ctas": ["CTA 1"], "logoPlacement": "bottom-right", "mustInclude": ["course_title"], "neverInclude": ["competitor_names"] },
  "borderRadius": "8px",
  "extracted_notes": "important nuances"
}`;

  const raw = await callOpenAIResponsesPDF(
    system,
    pdfBase64Array,
    `Extract brand config.${existingBrandName ? ` Brand: "${existingBrandName}".` : ""} Keep every text value in the document's original language — do not translate. Return only JSON.`,
    2000
  );
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

export async function researchCourse(courseData, url) {
  const system = `You are a course research assistant. Return ONLY valid JSON, no markdown, no explanation.`;
  const meta = [
    courseData.siglas ? `Acronym/Code: ${courseData.siglas}` : "",
    courseData.nivel  ? `Level: ${courseData.nivel}` : "",
    courseData.keywords5?.length ? `Keywords: ${courseData.keywords5.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  const user = `Course: "${courseData.name}"\n${meta}\nURL: ${url}\n\nReturn JSON: {"category":"string","instructor":"string","duration":"string","outcome":"string","differentiators":"string","accreditation":"string","level":"string"}`;
  const raw = await callOpenAI(system, user, 600);
  try { return JSON.parse(raw.replace(/```json|```/g, "")); }
  catch { return { category: "Education", instructor: "Expert Faculty", duration: "Online", outcome: `Master ${courseData.name}`, differentiators: "Flexible online learning", accreditation: "Certified", level: courseData.nivel || "Professional" }; }
}

export async function generateAdCopy(brandConfig, campaignConfig, courseData, research) {
  const allFormats = [
    ...(campaignConfig.formats || []),
    ...(campaignConfig.customDims || []).map(d => `custom_${d}`),
  ];
  // Goal/audience/painPoints/ctas are all optional in the wizard — when
  // skipped, tell the model to infer sensible ones from the course itself
  // rather than writing a prompt line that trails off into nothing.
  const campaignLines = [
    campaignConfig.ctas?.length ? `CTA must be one of: ${campaignConfig.ctas.join(" / ")}` : "CTA: not specified — infer a natural one from the course/outcome.",
    campaignConfig.goal ? `Goal: ${campaignConfig.goal}` : "Goal: not specified — infer from the course.",
    campaignConfig.audience?.length ? `Target audience: ${campaignConfig.audience.join(", ")}` : "Target audience: not specified — infer who this course is for.",
    campaignConfig.painPoints?.length ? `Pain points addressed: ${campaignConfig.painPoints.join(" / ")}` : "Pain points: not specified — infer a real, relevant one from the course topic.",
  ].join("\n");

  const system = `## BRAND
Brand: ${brandConfig.name}
Tone: ${brandConfig.tone}
Language: ${brandConfig.language}
Headline rules: ${brandConfig.headlineRules}
Forbidden: ${brandConfig.forbiddenWords}
${campaignLines}

## CAMPAIGN
Ad formats (dimensions): ${allFormats.join(", ")}
Variants requested: ${campaignConfig.variantCount || 1}

## COPY INSTRUCTIONS
Write copy that directly addresses the pain points and speaks to the target audience.
Adapt tone and register for the stated audience segments.
${campaignConfig.customDims?.length ? `Custom formats ${campaignConfig.customDims.join(", ")} — ensure copy fits non-standard dimensions.` : ""}

Return ONLY valid JSON: {"headline":"...","body":"...","benefit1":"...","benefit2":"...","cta":"...","painPoint":"..."}`;

  const courseMeta = [
    courseData.siglas ? `Code/Acronym: ${courseData.siglas}` : "",
    courseData.nivel  ? `Level: ${courseData.nivel}` : "",
    courseData.keywords5?.length ? `Keywords: ${courseData.keywords5.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  const user = `Course: ${courseData.name}\n${courseMeta}\nOutcome: ${research.outcome}\nDifferentiators: ${research.differentiators}`;
  const raw = await callOpenAI(system, user, 800);
  try { return JSON.parse(raw.replace(/```json|```/g, "")); }
  catch { return { headline: `Master ${courseData.name}`, body: `Transform your career.`, benefit1: "Flexible schedule", benefit2: "Industry certificate", cta: campaignConfig.ctas[0] || "Learn more", painPoint: campaignConfig.painPoints[0] || "Level up" }; }
}
