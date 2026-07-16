
import { useState, useEffect, useRef, createContext, useContext } from "react";

// ─── DESIGN TOKENS — EDUCA EDTECH Group ───────────────────────────────
const LIGHT = {
  sidebar:    "#FFFFFF",
  sidebarText:"#666666",
  sidebarAct: "#202020",
  sidebarBorder: "1px solid #E0E0E0",
  cream:      "#F4F4F4",
  card:       "#FFFFFF",
  cardBorder: "#E0E0E0",
  text:       "#202020",
  textMuted:  "#666666",
  textLight:  "#BABABA",
  accent:     "#963058",
  accentDark: "#FFFFFF",
  teal:       "#60BFB8",
  tealText:   "#2A7A73",
  coral:      "#E96A73",
  blueDark:   "#244A80",
  blueMid:    "#2E7ABE",
  ctaDark:    "#202020",
  white:      "#FFFFFF",
  gradient:   "linear-gradient(90deg, #60BFB8 0%, #2E7ABE 25%, #244A80 50%, #963058 80%, #E96A73 100%)",
  statusDone: { bg: "#EAF7F6", text: "#2A7A73" },
  statusRun:  { bg: "#EAF3FB", text: "#2E7ABE" },
  statusFail: { bg: "#FFE6E8", text: "#963058" },
  statusPend: { bg: "#F4F4F4", text: "#666666" },
};

const DARK = {
  sidebar:    "#1A1A1A",
  sidebarText:"#BABABA",
  sidebarAct: "#FFFFFF",
  sidebarBorder: "none",
  cream:      "#202020",
  card:       "#2A2A2A",
  cardBorder: "#3A3A3A",
  text:       "#FFFFFF",
  textMuted:  "#BABABA",
  textLight:  "#5A5A5A",
  accent:     "#963058",
  accentDark: "#FFFFFF",
  teal:       "#60BFB8",
  tealText:   "#60BFB8",
  coral:      "#E96A73",
  blueDark:   "#244A80",
  blueMid:    "#60BFB8",
  ctaDark:    "#F4F4F4",
  white:      "#202020",
  gradient:   "linear-gradient(90deg, #60BFB8 0%, #2E7ABE 25%, #244A80 50%, #963058 80%, #E96A73 100%)",
  statusDone: { bg: "#1A3330", text: "#60BFB8" },
  statusRun:  { bg: "#1A2A3A", text: "#60BFB8" },
  statusFail: { bg: "#3A1A1E", text: "#E96A73" },
  statusPend: { bg: "#2A2A2A", text: "#BABABA" },
};

// ─── THEME CONTEXT ────────────────────────────────────────────────────
const ThemeContext = createContext({ tokens: LIGHT, themeName: "light", toggle: () => {} });
function useTheme() { return useContext(ThemeContext).tokens; }
function useThemeName() { return useContext(ThemeContext).themeName; }
function useThemeToggle() { return useContext(ThemeContext).toggle; }

function IcoSun({ s = 14 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IcoMoon({ s = 14 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

const globalCSS = `
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Light.ttf")   format("truetype"); font-weight:300; font-display:swap; }
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Regular.ttf") format("truetype"); font-weight:400; font-display:swap; }
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Medium.ttf")  format("truetype"); font-weight:500; font-display:swap; }
  @font-face { font-family:"Rubik"; src:url("/fonts/Rubik-Bold.ttf")    format("truetype"); font-weight:700; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Light.ttf")    format("truetype"); font-weight:300; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Regular.ttf")  format("truetype"); font-weight:400; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Italic.ttf")   format("truetype"); font-weight:400; font-style:italic; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-Bold.ttf")     format("truetype"); font-weight:700; font-display:swap; }
  @font-face { font-family:"Lato";  src:url("/fonts/Lato-BoldItalic.ttf") format("truetype"); font-weight:700; font-style:italic; font-display:swap; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { font-family: "Lato", "Calibri", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.3); border-radius: 2px; }
  button { cursor: pointer; border: none; outline: none; font-family: inherit; }
  input, textarea, select { font-family: inherit; outline: none; }
  .fade-in { animation: fadeIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .gradient-line { height: 3px; width: 100%; background: linear-gradient(90deg, #60BFB8 0%, #2E7ABE 25%, #244A80 50%, #963058 80%, #E96A73 100%); display: block; border: 0; }

  /* ── Main content area ── */
  .dash-body { padding: 36px 40px; flex: 1; }
  .content-area { padding: 40px 40px; flex: 1; }
  @media (max-width: 767px) { .dash-body { padding: 24px 20px; } .content-area { padding: 24px 20px; } }
  @media (max-width: 479px) { .dash-body { padding: 20px 16px; } .content-area { padding: 20px 16px; } }

  /* ── Responsive layout ── */
  .app-shell   { display: flex; min-height: 100vh; }
  .app-content { flex: 1; display: flex; flex-direction: column; min-height: 100vh; min-width: 0; overflow: hidden; }
  .app-sidebar {
    width: 200px; flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
  }
  .app-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(32,32,32,0.45); z-index: 199; cursor: pointer;
  }
  .hamburger-btn { display: none; }

  /* Stats grid — 4 cols desktop, wraps down */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin-bottom: 36px;
  }

  /* Batch table — allow horizontal scroll on small screens */
  .batch-table-wrap { overflow-x: auto; }

  @media (max-width: 1023px) {
    .app-sidebar {
      position: fixed; top: 0; left: 0; height: 100vh;
      z-index: 200; transform: translateX(-100%);
    }
    .app-sidebar.sidebar-open  { transform: translateX(0); }
    .app-overlay.sidebar-open  { display: block; }
    .hamburger-btn { display: flex; }
  }

  @media (max-width: 767px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 479px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
`;

// ─── API HELPERS ────────────────────────────────────────────────────
function getLiteLLMKey() {
  return window.__LITELLM_KEY__ || import.meta.env.VITE_LITELLM_API_KEY || "";
}
function getLiteLLMBase() {
  const base = window.__LITELLM_BASE__ || import.meta.env.VITE_LITELLM_BASE_URL || "";
  if (!base) throw new Error("Sin LiteLLM base URL. Configura VITE_LITELLM_BASE_URL en Coolify.");
  return base.replace(/\/$/, "");
}

async function callLiteLLM(systemPrompt, userMessage, maxTokens = 1000, model = "gemini-2.5-flash") {
  const key = getLiteLLMKey();
  if (!key) throw new Error("Sin LiteLLM key. Configura VITE_LITELLM_API_KEY en Coolify.");
  const res = await fetch(`${getLiteLLMBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LiteLLM ${res.status}: ${err.error?.message || "request failed"}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callLiteLLMVision(systemPrompt, contentBlocks, maxTokens = 1000, model = "gemini-2.5-flash") {
  const key = getLiteLLMKey();
  if (!key) throw new Error("Sin LiteLLM key. Configura VITE_LITELLM_API_KEY en Coolify.");
  const res = await fetch(`${getLiteLLMBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: contentBlocks },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LiteLLM ${res.status}: ${err.error?.message || "request failed"}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function analyzeBrandPDF(pdfBase64Array, existingBrandName = "") {
  const system = `You are a brand intelligence analyst. Extract brand configuration from brand documents. Return ONLY valid JSON — no markdown, no explanation.
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
  "fonts": { "display": "heading font family", "body": "body font family" },
  "voiceRules": { "headline": ["rule 1"], "body": ["rule 1"], "forbidden": ["word1"] },
  "adRules": { "ctas": ["CTA 1"], "logoPlacement": "bottom-right", "mustInclude": ["course_title"], "neverInclude": ["competitor_names"] },
  "borderRadius": "8px",
  "extracted_notes": "important nuances"
}`;

  const fileBlocks = pdfBase64Array.map((b64) => ({
    type: "image_url",
    image_url: { url: `data:application/pdf;base64,${b64}` },
  }));

  const raw = await callLiteLLMVision(
    system,
    [...fileBlocks, { type: "text", text: `Extract brand config.${existingBrandName ? ` Brand: "${existingBrandName}".` : ""} Return only JSON.` }],
    2000
  );
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

async function researchCourse(courseData, url) {
  const system = `You are a course research assistant. Return ONLY valid JSON, no markdown, no explanation.`;
  const meta = [
    courseData.siglas ? `Acronym/Code: ${courseData.siglas}` : "",
    courseData.nivel  ? `Level: ${courseData.nivel}` : "",
  ].filter(Boolean).join("\n");
  const user = `Course: "${courseData.name}"\n${meta}\nURL: ${url}\n\nReturn JSON: {"category":"string","instructor":"string","duration":"string","outcome":"string","differentiators":"string","accreditation":"string","level":"string"}`;
  const raw = await callLiteLLM(system, user, 600);
  try { return JSON.parse(raw.replace(/```json|```/g, "")); }
  catch { return { category: "Education", instructor: "Expert Faculty", duration: "Online", outcome: `Master ${courseData.name}`, differentiators: "Flexible online learning", accreditation: "Certified", level: courseData.nivel || "Professional" }; }
}

async function generateAdCopy(brandConfig, campaignConfig, courseData, research) {
  const allFormats = [
    ...(campaignConfig.formats || []),
    ...(campaignConfig.customDim ? [`custom_${campaignConfig.customDim}`] : []),
  ];
  const system = `## BRAND
Brand: ${brandConfig.name}
Tone: ${brandConfig.tone}
Language: ${brandConfig.language}
Headline rules: ${brandConfig.headlineRules}
Forbidden: ${brandConfig.forbiddenWords}
CTA must be one of: ${campaignConfig.ctas.join(" / ")}

## CAMPAIGN
Goal: ${campaignConfig.goal}
Target audience: ${campaignConfig.audience.join(", ")}
Pain points addressed: ${campaignConfig.painPoints.join(" / ")}
Ad formats (dimensions): ${allFormats.join(", ")}
Variants requested: ${campaignConfig.variantCount || 1}

## COPY INSTRUCTIONS
Write copy that directly addresses the pain points and speaks to the target audience.
Adapt tone and register for the stated audience segments.
${campaignConfig.customDim ? `Custom format ${campaignConfig.customDim} — ensure copy fits non-standard dimensions.` : ""}

Return ONLY valid JSON: {"headline":"...","body":"...","benefit1":"...","benefit2":"...","cta":"...","painPoint":"..."}`;

  const courseMeta = [
    courseData.siglas ? `Code/Acronym: ${courseData.siglas}` : "",
    courseData.nivel  ? `Level: ${courseData.nivel}` : "",
  ].filter(Boolean).join("\n");
  const user = `Course: ${courseData.name}\n${courseMeta}\nOutcome: ${research.outcome}\nDifferentiators: ${research.differentiators}`;
  const raw = await callLiteLLM(system, user, 800);
  try { return JSON.parse(raw.replace(/```json|```/g, "")); }
  catch { return { headline: `Master ${courseData.name}`, body: `Transform your career.`, benefit1: "Flexible schedule", benefit2: "Industry certificate", cta: campaignConfig.ctas[0] || "Learn more", painPoint: campaignConfig.painPoints[0] || "Level up" }; }
}

function resizeImageFile(file, maxDim = 768, quality = 0.75) {
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
async function analyzeRefImages(refImages) {
  if (!refImages?.length) return "";
  const imageBlocks = refImages.slice(0, 4).map(img => ({
    type: "image_url",
    image_url: { url: img.data || img, detail: "low" },
  }));
  const result = await callLiteLLMVision(
    "You are a visual brand analyst. Analyze the reference images and return a concise 2-3 sentence visual aesthetic descriptor: color mood, lighting style, composition, photographic feel. Use concrete visual language suitable for image generation prompts. Return only the descriptor text.",
    [...imageBlocks, { type: "text", text: "Describe the visual aesthetic for ad image generation prompts." }],
    250
  );
  return result.trim();
}

// ─── IMAGE GENERATION ────────────────────────────────────────────────
const FORMAT_SIZES = {
  story:     { w: 1080, h: 1920, api: "1024x1792" },
  feed_4x5:  { w: 1080, h: 1350, api: "1024x1792" },
  square:    { w: 1080, h: 1080, api: "1024x1024" },
  landscape: { w: 1200, h: 628,  api: "1792x1024" },
};

function customDimToSize(dim) {
  const m = String(dim || "").match(/(\d+)[×x](\d+)/i);
  if (!m) return { w: 1080, h: 1080, api: "1024x1024" };
  const w = parseInt(m[1]), h = parseInt(m[2]);
  const ratio = w / h;
  if (ratio > 1.3) return { w, h, api: "1792x1024" };
  if (ratio < 0.8) return { w, h, api: "1024x1792" };
  return { w, h, api: "1024x1024" };
}

async function generateImagePrompt(brandConfig, courseData, research, copy) {
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

  return (await callLiteLLM(system, user, 280)).trim();
}

async function generateImage(prompt, apiSize) {
  const key = getLiteLLMKey();
  if (!key) throw new Error("Sin LiteLLM key. Configura VITE_LITELLM_API_KEY en Coolify.");
  const res = await fetch(`${getLiteLLMBase()}/v1/images/generations`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, n: 1, size: apiSize, response_format: "b64_json" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LiteLLM ${res.status}: ${err.error?.message || "image generation failed"}`);
  }
  const data = await res.json();
  return data.data?.[0]?.b64_json || null;
}

async function loadFontFace(name, src) {
  try {
    const face = new FontFace(name, `url(${src})`);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch { return false; }
}

async function compositeAd(imageB64, copy, brandConfig, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Brand colors
  const colors = brandConfig.colors || {};
  const textOverlay  = colors.text_on_overlay || "#ffffff";
  const ctaBgColor   = colors.accent          || "#963058";
  const ctaFgColor   = colors.cta_text        || "#FFFFFF";

  // Background image
  if (imageB64) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, width, height); resolve(); };
      img.onerror = resolve;
      img.src = `data:image/png;base64,${imageB64}`;
    });
  } else {
    ctx.fillStyle = colors.primary || "#202020"; ctx.fillRect(0, 0, width, height);
  }

  // Bottom gradient
  const grad = ctx.createLinearGradient(0, height * 0.33, 0, height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

  // Fonts — try to load brand .ttf from backend URL or data URI
  let displayFontName = "BrandDisplay_" + (brandConfig.id || "x");
  let bodyFontName    = "BrandBody_"    + (brandConfig.id || "x");
  let displayFont = `"${brandConfig.fonts?.display || "system-ui"}", system-ui, sans-serif`;
  let bodyFontFam = `"${brandConfig.fonts?.body    || "system-ui"}", system-ui, sans-serif`;

  const fontServerBase = brandConfig.fontServerUrl?.replace(/\/$/, "") || "";
  const displaySrc = brandConfig.fontData?.displayData
    || (fontServerBase && brandConfig.fontData?.displayFile ? `${fontServerBase}/${brandConfig.fontData.displayFile}` : null);
  const bodySrc = brandConfig.fontData?.bodyData
    || (fontServerBase && brandConfig.fontData?.bodyFile ? `${fontServerBase}/${brandConfig.fontData.bodyFile}` : null);

  if (displaySrc && await loadFontFace(displayFontName, displaySrc))
    displayFont = `"${displayFontName}", system-ui, sans-serif`;
  if (bodySrc && await loadFontFace(bodyFontName, bodySrc))
    bodyFontFam = `"${bodyFontName}", system-ui, sans-serif`;

  const pad = Math.round(width * 0.07);
  ctx.textBaseline = "top";

  function wrapText(text, x, startY, maxW, lineH, maxLines) {
    const words = String(text || "").split(" ");
    let line = "", y = startY, count = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        if (count >= maxLines - 1) { ctx.fillText(line + "…", x, y); return y + lineH; }
        ctx.fillText(line, x, y); line = word; y += lineH; count++;
      } else { line = test; }
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineH;
  }

  // Headline
  ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 12;
  const hlSize = Math.round(height * 0.052);
  ctx.font = `bold ${hlSize}px ${displayFont}`; ctx.fillStyle = textOverlay;
  const hlEndY = wrapText(copy.headline, pad, height * 0.58, width - pad * 2, hlSize * 1.25, 3);

  // Body
  const bdSize = Math.round(height * 0.027);
  ctx.font = `${bdSize}px ${bodyFontFam}`; ctx.fillStyle = `${textOverlay}dd`; ctx.shadowBlur = 6;
  const bdEndY = wrapText(copy.body, pad, hlEndY + hlSize * 0.5, width - pad * 2, bdSize * 1.45, 3);

  // CTA pill
  ctx.shadowBlur = 0;
  const ctaSize = Math.round(height * 0.03);
  ctx.font = `bold ${ctaSize}px ${bodyFontFam}`;
  const ctaStr = copy.cta || "";
  const ctaTextW = ctx.measureText(ctaStr).width;
  const ctaPadX = ctaSize * 1.2, ctaPadY = ctaSize * 0.65;
  const ctaBoxW = ctaTextW + ctaPadX * 2, ctaBoxH = ctaSize + ctaPadY * 2;
  const ctaBoxY = Math.min(bdEndY + ctaSize * 1.2, height - ctaBoxH - pad);
  ctx.fillStyle = ctaBgColor;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(pad, ctaBoxY, ctaBoxW, ctaBoxH, ctaBoxH / 2);
  else ctx.rect(pad, ctaBoxY, ctaBoxW, ctaBoxH);
  ctx.fill();
  ctx.fillStyle = ctaFgColor;
  ctx.fillText(ctaStr, pad + ctaPadX, ctaBoxY + ctaPadY);

  // Logo overlay (use white logo on dark bg, primary otherwise)
  const logoAsset = brandConfig.logoWhite || brandConfig.logoPrimary;
  const logoSrc = logoAsset?.data || (fontServerBase && logoAsset?.name ? `${fontServerBase}/${logoAsset.name}` : null);
  if (logoSrc) {
    await new Promise(resolve => {
      const logoImg = new Image();
      logoImg.onload = () => {
        const lh = Math.round(height * 0.042);
        const lw = Math.round(logoImg.naturalWidth * lh / Math.max(logoImg.naturalHeight, 1));
        const margin = Math.round(width * 0.055);
        const placement = brandConfig.adRules?.logoPlacement || "bottom-right";
        const lx = placement.includes("right") ? width - lw - margin : margin;
        const ly = placement.includes("top")   ? margin : height - lh - margin;
        ctx.globalAlpha = 0.92; ctx.drawImage(logoImg, lx, ly, lw, lh); ctx.globalAlpha = 1;
        resolve();
      };
      logoImg.onerror = resolve;
      logoImg.src = logoSrc;
    });
  }

  return canvas.toDataURL("image/png");
}

// ─── CSV / XLSX PARSER ──────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const siglasIdx = header.findIndex(h => /sigla|acronym|abbr|código|codigo/i.test(h));
  const nivelIdx  = header.findIndex(h => /nivel|level|grado/i.test(h));
  const nameIdx   = header.findIndex(h => /course|name|nombre|title/i.test(h));
  const urlIdx    = header.findIndex(h => /url|link|href/i.test(h));
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
    return {
      siglas: siglasIdx >= 0 ? (cols[siglasIdx] || "") : "",
      nivel:  nivelIdx  >= 0 ? (cols[nivelIdx]  || "") : "",
      name:   cols[nameIdx >= 0 ? nameIdx : (siglasIdx >= 0 || nivelIdx >= 0 ? -1 : 0)] || cols[0] || "",
      url:    cols[urlIdx  >= 0 ? urlIdx  : 1] || "",
    };
  }).filter(r => r.name);
}

async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(parseCSV(e.target.result));
      reader.readAsText(file);
    });
  }
  if (ext === "xlsx" || ext === "xls" || ext === "ods") {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const rows = await readXlsxFile(file);
    if (rows.length < 2) return [];
    const header = rows[0].map(h => String(h || "").toLowerCase());
    const siglasIdx = header.findIndex(h => /sigla|acronym|abbr|código|codigo/i.test(h));
    const nivelIdx  = header.findIndex(h => /nivel|level|grado/i.test(h));
    const nameIdx   = header.findIndex(h => /course|name|nombre|title/i.test(h));
    const urlIdx    = header.findIndex(h => /url|link|href/i.test(h));
    return rows.slice(1).map(row => ({
      siglas: siglasIdx >= 0 ? String(row[siglasIdx] || "") : "",
      nivel:  nivelIdx  >= 0 ? String(row[nivelIdx]  || "") : "",
      name:   String(row[nameIdx >= 0 ? nameIdx : 0] || ""),
      url:    String(row[urlIdx  >= 0 ? urlIdx  : 1] || ""),
    })).filter(r => r.name);
  }
  return [];
}

// ─── STATUS CHIP ────────────────────────────────────────────────────
function Chip({ status }) {
  const T = useTheme();
  const map = { done: T.statusDone, running: T.statusRun, failed: T.statusFail, pending: T.statusPend, generating: T.statusRun, review: { bg: "#F8E8EE", text: "#963058" }, exported: T.statusDone };
  const labels = { done:"Listo", running:"Ejecutando", failed:"Fallido", pending:"Pendiente", generating:"Generando", review:"Revisión", exported:"Exportado" };
  const c = map[status?.toLowerCase()] || T.statusPend;
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.01em" }}>
      {labels[status?.toLowerCase()] || status}
    </span>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────────────
function Sidebar({ active, onNav, batches, isOpen, onClose }) {
  const T = useTheme();
  const themeName = useThemeName();
  const toggle = useThemeToggle();
  const pendingCount = batches.filter(b => b.status === "review").length;
  const navItems = [
    { id: "dashboard", label: "Tablero" },
    { id: "generate",  label: "Generar",  badge: "nuevo" },
    { id: "batches",   label: "Lotes",    badge: pendingCount > 0 ? pendingCount : null },
    { id: "brands",    label: "Marcas" },
  ];
  const isLight = themeName === "light";
  const sidebarBg = isLight ? "#FFFFFF" : "#1A1A1A";
  const divider = isLight ? `1px solid #E0E0E0` : `1px solid rgba(255,255,255,0.08)`;
  const activeItemBg = isLight ? "rgba(32,32,32,0.06)" : "rgba(255,255,255,0.07)";
  const footerTextColor = isLight ? "rgba(32,32,32,0.25)" : "rgba(255,255,255,0.25)";
  return (
    <aside className={`app-sidebar${isOpen ? " sidebar-open" : ""}`} style={{ background: sidebarBg, display: "flex", flexDirection: "column", minHeight: "100vh", borderRight: divider }}>
      <div className="gradient-line" />
      <div style={{ padding: "18px 20px 20px" }}>
        <img
          src={isLight ? "/logo-primary.svg" : "/logo-negative.svg"}
          alt="EDUCA EDTECH Group"
          style={{ width: "100%", maxWidth: 148, display: "block" }}
          onError={e => { e.target.src = "/logo-negative.svg"; }}
        />
      </div>
      <div style={{ padding: "0 20px 16px", borderBottom: divider }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.teal, letterSpacing: "0.12em", textTransform: "uppercase" }}>AdBatch</div>
        <div style={{ fontSize: 10, color: T.sidebarText, marginTop: 2 }}>Generador de creatividades</div>
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {navItems.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => { onNav(item.id); onClose?.(); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", background: isActive ? activeItemBg : "transparent", color: isActive ? T.sidebarAct : T.sidebarText, fontSize: 13, fontWeight: isActive ? 600 : 400, letterSpacing: "0.01em", transition: "all 0.15s", borderLeft: isActive ? `2px solid ${T.teal}` : "2px solid transparent" }}>
              <span>{item.label}</span>
              {item.badge && (
                <span style={{ background: T.accent, color: T.accentDark, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "12px 20px 16px", borderTop: divider }}>
        <button onClick={toggle}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "transparent", border: `1px solid ${T.cardBorder}`, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: T.sidebarText, marginBottom: 12 }}>
          {isLight ? <IcoMoon s={13} /> : <IcoSun s={13} />}
          {isLight ? "Tema oscuro" : "Tema claro"}
        </button>
        <div style={{ fontSize: 9, fontWeight: 700, color: footerTextColor, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.5, marginBottom: 10 }}>
          Together our future is bright.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.accentDark, flexShrink: 0 }}>A</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.sidebarAct }}>Alex Rivera</div>
            <div style={{ fontSize: 10, color: T.sidebarText }}>Pro Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── TOP BAR ────────────────────────────────────────────────────────
function TopBar({ title, creditsLeft, onNewBatch, onMenuToggle }) {
  const T = useTheme();
  return (
    <div style={{ background: T.card, borderBottom: `1px solid ${T.cardBorder}`, flexShrink: 0, boxShadow: "0 1px 4px rgba(32,32,32,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 12px 24px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button className="hamburger-btn" onClick={onMenuToggle} style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: T.cream, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: "nowrap" }}>{creditsLeft} restantes</span>
          <button onClick={onNewBatch} style={{ background: T.text, color: T.white, fontSize: 12, fontWeight: 600, padding: "7px 18px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nuevo lote
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────
function Dashboard({ batches, onNewBatch, onNav }) {
  const T = useTheme();
  const stats = [
    { v: batches.length || 142,                                         l: "Lotes creados" },
    { v: batches.reduce((a, b) => a + (b.adsCount || 0), 0) || 3847,   l: "Creatividades generadas" },
    { v: 12,                                                             l: "Formatos disponibles" },
    { v: "4.2h",                                                         l: "Tiempo ahorrado (prom.)" },
  ];
  const recent = [...batches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  return (
    <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Hero banner */}
      <div style={{ background: T.gradient, padding: "40px 40px 36px" }}>
        <div style={{ maxWidth: 820 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>AdBatch · Generador de creatividades</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, color: T.white, marginBottom: 10, fontFamily: '"Rubik","Calibri",sans-serif' }}>
            Buenos días, Alex.
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
            {batches.filter(b => b.status === "generating").length || 0} lotes procesando · 847 creatividades restantes este mes.
          </p>
        </div>
      </div>

      <div className="dash-body">

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 8px rgba(32,32,32,0.06)" }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.v.toLocaleString?.() ?? s.v}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Lotes recientes</h2>
        <button onClick={() => onNav("batches")} style={{ background: "transparent", fontSize: 12, color: T.textMuted }}>Ver todos →</button>
      </div>

      <div className="batch-table-wrap" style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 8px rgba(32,32,32,0.06)" }}>
        {recent.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Sin lotes aún. Crea tu primer lote para comenzar.</div>
        ) : recent.map((b, i) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < recent.length - 1 ? `1px solid ${T.cardBorder}` : "none", gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.cream, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{b.brand} · {new Date(b.createdAt).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" })}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, marginRight: 16 }}>{b.adsCount || 0}</span>
            <Chip status={b.status} />
          </div>
        ))}
      </div>

      <div style={{ background: T.gradient, borderRadius: 16, padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.white, marginBottom: 6 }}>¿Listo para generar tu próximo lote?</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>Elige tus formatos y obtén todos los tamaños de una vez.</div>
        </div>
        <button onClick={onNewBatch} style={{ background: T.white, color: T.text, fontSize: 13, fontWeight: 700, padding: "10px 22px", borderRadius: 999, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
          + Generar
        </button>
      </div>
    </div>
    </div>
  );
}

// ─── GENERATE WIZARD ────────────────────────────────────────────────
const GOALS = ["Reconocimiento de marca","Tráfico / visitas","Generación de leads","Reservar demo","Descargar brochure","Prueba gratuita","Inicio de solicitud","Matrícula / compra","Retargeting / nurture"];
const PAINS = ["Quiero un mejor trabajo o ascenso","Necesito mejorar mis habilidades rápido","Estoy suspendiendo exámenes","No sé qué curso elegir","Me falta tiempo","Me falta confianza o estructura","Quiero habilidades prácticas, no teoría","Quiero prueba de que valdrá la pena","Necesito aprendizaje online flexible","Me abruman las opciones"];
const AUDIENCES = ["Profesionales en activo","Estudiantes universitarios","Personas en transición de carrera","Managers y líderes de equipo","Profesionales en etapa inicial","Padres que compran para sus hijos","Compradores de RRHH / formación","Aprendices continuos"];
const CTAS_BY_GOAL = {
  "Matrícula / compra": ["Inscríbete ahora","Empieza hoy","Reserva tu plaza","Comenzar"],
  "Generación de leads": ["Descargar brochure","Reservar demo","Hablar con un asesor","Empezar"],
  "Reconocimiento de marca": ["Saber más","Explorar cursos","Ver qué es posible","Descubrir"],
  "Tráfico / visitas": ["Ver temario","Ver el programa","Explorar","Saber más"],
  "Reservar demo": ["Reservar demo","Hablar con un asesor","Programar llamada","Reserva plaza"],
  "Prueba gratuita": ["Prueba gratis","Ver clase gratuita","Probar gratis","Acceso de muestra"],
  "Inicio de solicitud": ["Solicitar ahora","Iniciar solicitud","Reserva tu plaza","Hacer el test"],
  "Retargeting / nurture": ["Continuar aprendiendo","Retomar donde lo dejaste","Inscríbete ahora","Reserva plaza"],
};
const ALL_CTAS = ["Saber más","Ver temario","Descargar brochure","Ver clase gratis","Prueba gratis","Reservar demo","Reserva tu plaza","Hacer el test","Hablar con asesor","Solicitar ahora","Inscríbete ahora"];
const FORMATS = [
  { id: "story",     label: "Stories / Reels",   dim: "1080×1920", ratio: "9:16" },
  { id: "feed_4x5",  label: "Feed priority",      dim: "1080×1350", ratio: "4:5"  },
  { id: "square",    label: "Universal square",   dim: "1080×1080", ratio: "1:1"  },
  { id: "landscape", label: "Legacy landscape",   dim: "1200×628",  ratio: "1.9:1" },
];
const DEFAULT_BRANDS = [
  { id: "b1", name: "Structuralia", tone: "Authoritative and precise", personality: "Technical, trustworthy", language: "es", headlineRules: "Start with action verb, max 8 words", bodyRules: "2-3 sentences, lead with transformation", forbiddenWords: "revolutionary, amazing, world-class" },
  { id: "b2", name: "EducaHub.ai",  tone: "Warm and aspirational",     personality: "Innovative, approachable", language: "es", headlineRules: "Focus on outcome, conversational, max 10 words", bodyRules: "Lead with benefit, mention flexibility", forbiddenWords: "guaranteed, best, incredible" },
  { id: "b3", name: "Phia",         tone: "Bold and visionary",         personality: "Cutting-edge, empowering", language: "en", headlineRules: "Future-focused, action-oriented, punchy", bodyRules: "Short and direct, emphasize AI advantage", forbiddenWords: "traditional, basic, generic" },
];

function StepIndicator({ step, total }) {
  const T = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: i < step ? 8 : i === step ? 22 : 8, height: 8, borderRadius: 4, background: i < step ? T.accent : i === step ? T.text : T.cardBorder, transition: "all 0.3s" }} />
          {i < total - 1 && <div style={{ width: 16, height: 1, background: T.cardBorder }} />}
        </div>
      ))}
      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>Paso {step + 1} de {total}</span>
    </div>
  );
}

function SelectPill({ label, selected, onClick, accent }) {
  const T = useTheme();
  return (
    <button onClick={onClick} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${selected ? (accent ? T.accent : T.text) : T.cardBorder}`, background: selected ? (accent ? T.accent : T.text) : T.card, color: selected ? (accent ? T.accentDark : T.cream) : T.textMuted, fontSize: 12, fontWeight: selected ? 600 : 400, transition: "all 0.15s", cursor: "pointer" }}>
      {label}
    </button>
  );
}

function Generate({ brands, onBatchCreated }) {
  const T = useTheme();
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState({
    brandId: brands[0]?.id || "",
    goal: "",
    audience: [],
    painPoints: [],
    ctas: [],
    formats: ["story", "feed_4x5"],
    csvText: "",
    courses: [],
    variantCount: 1,
    customDim: "",
  });
  const [customAudience, setCustomAudience] = useState("");
  const [customPain, setCustomPain] = useState("");
  const [customCta, setCustomCta] = useState("");
  const [uploadError, setUploadError] = useState("");

  const brand = brands.find(b => b.id === cfg.brandId) || brands[0];
  const suggestedCTAs = CTAS_BY_GOAL[cfg.goal] || ALL_CTAS.slice(0, 4);

  function toggle(key, val) {
    setCfg(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val] }));
  }
  function set(key, val) { setCfg(p => ({ ...p, [key]: val })); }

  const fileRef = useRef();
  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploadError("");
    try {
      const courses = await parseFile(file);
      if (courses.length === 0) {
        setUploadError("No se encontraron cursos. Verifica que el archivo tenga columnas 'name' y 'url'.");
        return;
      }
      set("courses", courses);
      set("csvText", file.name);
    } catch (err) {
      setUploadError("Error al leer el archivo: " + (err.message || "formato no soportado"));
    }
  }

  const canProceed = [
    cfg.brandId && cfg.goal,
    cfg.audience.length > 0 && cfg.painPoints.length > 0,
    cfg.ctas.length > 0 && (cfg.formats.length > 0 || cfg.customDim.trim().length > 0),
    cfg.courses.length > 0,
    true,
  ][step];

  async function launchBatch() {
    const batch = {
      id: Date.now().toString(),
      name: `${cfg.goal} — ${brand?.name}`,
      brand: brand?.name || "Brand",
      brandId: cfg.brandId,
      status: "generating",
      createdAt: new Date().toISOString(),
      adsCount: 0,
      config: { ...cfg },
      items: [],
    };
    onBatchCreated(batch);
    setStep(0);
    setCfg({ brandId: brands[0]?.id || "", goal: "", audience: [], painPoints: [], ctas: [], formats: ["story", "feed_4x5"], csvText: "", courses: [], variantCount: 1, customDim: "" });
  }

  const steps = [
    // Paso 0: Marca + Objetivo + Variantes
    <div key={0} className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Configuración de campaña</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Elige tu marca y define el objetivo de campaña.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Marca</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {brands.map(b => (
            <button key={b.id} onClick={() => set("brandId", b.id)} style={{ padding: "8px 18px", borderRadius: 10, border: `1.5px solid ${cfg.brandId === b.id ? T.text : T.cardBorder}`, background: cfg.brandId === b.id ? T.text : T.card, color: cfg.brandId === b.id ? T.cream : T.text, fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Objetivo de campaña</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {GOALS.map(g => <SelectPill key={g} label={g} selected={cfg.goal === g} onClick={() => set("goal", g)} />)}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Variantes por curso <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>elige cuántas versiones generar</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => set("variantCount", n)} style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${cfg.variantCount === n ? T.text : T.cardBorder}`, background: cfg.variantCount === n ? T.text : T.card, color: cfg.variantCount === n ? T.cream : T.textMuted, fontSize: 15, fontWeight: 600, transition: "all 0.15s", flexShrink: 0 }}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Paso 1: Audiencia + Puntos de dolor
    <div key={1} className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Audiencia y puntos de dolor</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>¿A quién te diriges y qué tensión resuelve esta campaña?</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Audiencia objetivo <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>selecciona todas las que apliquen</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {AUDIENCES.map(a => <SelectPill key={a} label={a} selected={cfg.audience.includes(a)} onClick={() => toggle("audience", a)} />)}
        </div>
        {cfg.audience.filter(a => !AUDIENCES.includes(a)).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {cfg.audience.filter(a => !AUDIENCES.includes(a)).map(a => (
              <button key={a} onClick={() => toggle("audience", a)} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${T.accent}`, background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {a} <span style={{ opacity: 0.6, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={customAudience} onChange={e => setCustomAudience(e.target.value)} placeholder="Audiencia personalizada..."
            onKeyDown={e => { if (e.key === "Enter" && customAudience.trim()) { toggle("audience", customAudience.trim()); setCustomAudience(""); } }}
            style={{ flex: 1, padding: "7px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
          <button onClick={() => { if (customAudience.trim()) { toggle("audience", customAudience.trim()); setCustomAudience(""); } }}
            style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Principales puntos de dolor <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none" }}>hasta 3</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {PAINS.map(p => <SelectPill key={p} label={p} selected={cfg.painPoints.includes(p)} onClick={() => { if (cfg.painPoints.includes(p) || cfg.painPoints.length < 3) toggle("painPoints", p); }} />)}
        </div>
        {cfg.painPoints.filter(p => !PAINS.includes(p)).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {cfg.painPoints.filter(p => !PAINS.includes(p)).map(p => (
              <button key={p} onClick={() => toggle("painPoints", p)} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${T.accent}`, background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {p} <span style={{ opacity: 0.6, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={customPain} onChange={e => setCustomPain(e.target.value)} placeholder="Punto de dolor personalizado..."
            onKeyDown={e => { if (e.key === "Enter" && customPain.trim() && cfg.painPoints.length < 3) { toggle("painPoints", customPain.trim()); setCustomPain(""); } }}
            style={{ flex: 1, padding: "7px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
          <button onClick={() => { if (customPain.trim() && cfg.painPoints.length < 3) { toggle("painPoints", customPain.trim()); setCustomPain(""); } }}
            style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
        </div>
      </div>
    </div>,

    // Paso 2: CTAs + Formatos
    <div key={2} className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>CTAs y formatos</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Elige llamadas a la acción y formatos de salida para este lote.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          CTAs <span style={{ background: T.accent, color: T.accentDark, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: "1px 6px", textTransform: "none", marginLeft: 4 }}>inteligente</span>
          <span style={{ color: T.textLight, fontWeight: 400, textTransform: "none", marginLeft: 6 }}>hasta 3 — recomendadas para tu objetivo</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {suggestedCTAs.map(c => <SelectPill key={c} label={c} selected={cfg.ctas.includes(c)} onClick={() => { if (cfg.ctas.includes(c) || cfg.ctas.length < 3) toggle("ctas", c); }} accent />)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {ALL_CTAS.filter(c => !suggestedCTAs.includes(c)).map(c => <SelectPill key={c} label={c} selected={cfg.ctas.includes(c)} onClick={() => { if (cfg.ctas.includes(c) || cfg.ctas.length < 3) toggle("ctas", c); }} />)}
        </div>
        {cfg.ctas.filter(c => !ALL_CTAS.includes(c) && !suggestedCTAs.includes(c)).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {cfg.ctas.filter(c => !ALL_CTAS.includes(c) && !suggestedCTAs.includes(c)).map(c => (
              <button key={c} onClick={() => toggle("ctas", c)} style={{ padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${T.accent}`, background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {c} <span style={{ opacity: 0.6, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={customCta} onChange={e => setCustomCta(e.target.value)} placeholder="CTA personalizado..."
            onKeyDown={e => { if (e.key === "Enter" && customCta.trim() && cfg.ctas.length < 3) { toggle("ctas", customCta.trim()); setCustomCta(""); } }}
            style={{ flex: 1, padding: "7px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
          <button onClick={() => { if (customCta.trim() && cfg.ctas.length < 3) { toggle("ctas", customCta.trim()); setCustomCta(""); } }}
            style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Formatos de anuncio</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {FORMATS.map(f => {
            const sel = cfg.formats.includes(f.id);
            const w = f.ratio === "9:16" ? 18 : f.ratio === "4:5" ? 22 : f.ratio === "1:1" ? 26 : 36;
            const h = f.ratio === "1.9:1" ? 18 : 26;
            return (
              <button key={f.id} onClick={() => toggle("formats", f.id)} style={{ padding: 12, border: `1.5px solid ${sel ? T.text : T.cardBorder}`, borderRadius: 12, background: sel ? T.text : T.card, textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ width: w, height: h, border: `1.5px solid ${sel ? T.cream : T.cardBorder}`, borderRadius: 3, marginBottom: 8, opacity: sel ? 0.6 : 1 }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: sel ? T.cream : T.text, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: sel ? "#888" : T.textMuted }}>{f.dim}</div>
              </button>
            );
          })}
          {/* Custom format */}
          {(() => {
            const hasCustom = cfg.customDim.trim().length > 0;
            return (
              <div style={{ padding: 12, border: `1.5px solid ${hasCustom ? T.accent : T.cardBorder}`, borderRadius: 12, background: hasCustom ? "#EAF7F6" : T.card, textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ width: 28, height: 20, border: `1.5px dashed ${hasCustom ? T.accentDark : T.cardBorder}`, borderRadius: 3, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 9, color: hasCustom ? T.accentDark : T.textMuted, fontWeight: 700 }}>+</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 5 }}>Personalizado</div>
                <input
                  value={cfg.customDim}
                  onChange={e => set("customDim", e.target.value)}
                  placeholder="1200×800"
                  onClick={e => e.stopPropagation()}
                  style={{ width: "100%", padding: "3px 6px", border: `1px solid ${T.cardBorder}`, borderRadius: 5, background: T.cream, fontSize: 10, color: T.text, fontFamily: "monospace" }}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>,

    // Paso 3: Cargar cursos
    <div key={3} className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Cargar cursos</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Solo dos columnas: <code style={{ background: T.card, padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>course_name</code> y <code style={{ background: T.card, padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>url</code>. La IA hace el resto.</p>

      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods" onChange={handleFile} style={{ display: "none" }} />

      {uploadError && (
        <div style={{ padding: "10px 14px", background: T.statusFail.bg, border: `1px solid #f5c0c0`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.statusFail.text }}>
          {uploadError}
        </div>
      )}

      {cfg.courses.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.text; }}
          onDragLeave={e => e.currentTarget.style.borderColor = T.cardBorder}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.cardBorder; const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}
          style={{ border: `1.5px dashed ${T.cardBorder}`, borderRadius: 16, padding: "48px 32px", textAlign: "center", cursor: "pointer", background: T.card, transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.textMuted}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>↑</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Suelta tu CSV aquí</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>o haz clic para explorar — archivos .csv o .xlsx</div>
          <button style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 500, padding: "8px 20px", borderRadius: 999 }} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Explorar archivo</button>
          <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>↓ Descargar plantilla CSV</div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{cfg.courses.length} cursos detectados</span>
            <button onClick={() => { set("courses", []); set("csvText", ""); }} style={{ fontSize: 11, color: T.textMuted, background: "transparent" }}>Limpiar ×</button>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "32px 70px 80px 1fr 1fr", padding: "8px 16px", background: T.cream, borderBottom: `1px solid ${T.cardBorder}` }}>
              {["#", "Siglas", "Nivel", "Nombre del curso", "URL"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>)}
            </div>
            {cfg.courses.slice(0, 6).map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 70px 80px 1fr 1fr", padding: "10px 16px", borderBottom: i < Math.min(cfg.courses.length, 6) - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>{i + 1}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.accentDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.siglas || "—"}</span>
                <span style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.nivel || "—"}</span>
                <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{c.name}</span>
                <span style={{ fontSize: 11, color: T.blueMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.url || "—"}</span>
              </div>
            ))}
            {cfg.courses.length > 6 && <div style={{ padding: "8px 16px", fontSize: 11, color: T.textMuted, background: T.cream }}>+ {cfg.courses.length - 6} más cursos</div>}
          </div>
        </div>
      )}
    </div>,

    // Paso 4: Confirmar
    <div key={4} className="fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Listo para generar</h2>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>Revisa la configuración antes de lanzar.</p>

      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        {[
          ["Marca", brand?.name],
          ["Objetivo", cfg.goal],
          ["Audiencia", cfg.audience.join(", ") || "—"],
          ["Puntos de dolor", cfg.painPoints.join(" · ") || "—"],
          ["CTAs", cfg.ctas.join(" / ") || "—"],
          ["Formatos", [...cfg.formats.map(f => FORMATS.find(x => x.id === f)?.label).filter(Boolean), ...(cfg.customDim ? [`Custom ${cfg.customDim}`] : [])].join(", ")],
          ["Variantes por curso", `${cfg.variantCount}`],
          ["Cursos", `${cfg.courses.length} cursos → ${cfg.courses.length * (cfg.formats.length + (cfg.customDim ? 1 : 0)) * cfg.variantCount} anuncios`],
        ].map(([k, v], i, arr) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{k}</span>
            <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ background: T.ctaDark, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 3 }}>Estimado: {cfg.courses.length * (cfg.formats.length + (cfg.customDim ? 1 : 0)) * cfg.variantCount} creatividades</div>
          <div style={{ fontSize: 11, color: "#888" }}>La IA investigará cada URL y generará copy + prompts de imagen</div>
        </div>
        <button onClick={launchBatch} style={{ background: T.accent, color: T.accentDark, fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 999, whiteSpace: "nowrap" }}>
          ✦ Lanzar lote
        </button>
      </div>
    </div>,
  ];

  return (
    <div className="fade-in content-area" style={{ flex: 1 }}>
      <StepIndicator step={step} total={5} />
      {steps[step]}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} style={{ background: "transparent", color: step === 0 ? T.textLight : T.textMuted, fontSize: 13, padding: "8px 0", opacity: step === 0 ? 0.3 : 1 }} disabled={step === 0}>← Atrás</button>
        {step < 4 && <button onClick={() => setStep(s => s + 1)} disabled={!canProceed} style={{ background: canProceed ? T.text : T.cardBorder, color: canProceed ? T.cream : T.textMuted, fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 999, transition: "all 0.15s", cursor: canProceed ? "pointer" : "not-allowed" }}>Continuar →</button>}
      </div>
    </div>
  );
}

// ─── BATCH PROCESSOR ────────────────────────────────────────────────
function BatchProcessor({ batch, brands, onUpdate }) {
  const T = useTheme();
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("researching");
  const [progress, setProgress] = useState(0);
  const [ctrl, setCtrl] = useState("running"); // "running"|"paused"|"cancelled"|"done"
  const [runKey, setRunKey] = useState(0);
  const brand = brands.find(b => b.id === batch.config.brandId) || brands[0] || DEFAULT_BRANDS[0];
  const isPausedRef   = useRef(false);
  const isCancelledRef = useRef(false);

  async function waitIfPaused() {
    while (isPausedRef.current && !isCancelledRef.current) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  function pause()   { isPausedRef.current = true;  setCtrl("paused"); }
  function resume()  { isPausedRef.current = false; setCtrl("running"); }
  function cancel()  { isCancelledRef.current = true; isPausedRef.current = false; setCtrl("cancelled"); }
  function restart() {
    isPausedRef.current   = false;
    isCancelledRef.current = false;
    setItems([]);
    setPhase("researching");
    setProgress(0);
    setCtrl("running");
    setRunKey(k => k + 1);
  }

  useEffect(() => {
    runPipeline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  async function runPipeline() {
    const courses = batch.config.courses || [];
    const total = courses.length;
    const researched = [];

    setPhase("researching");
    for (let i = 0; i < total; i++) {
      await waitIfPaused();
      if (isCancelledRef.current) return;
      const c = courses[i];
      setItems(prev => [...prev, { ...c, status: "researching", research: null }]);
      const research = await researchCourse(c, c.url);
      if (isCancelledRef.current) return;
      researched.push({ ...c, research });
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "researched", research } : it));
      setProgress(Math.round(((i + 1) / total) * 35));
    }

    await waitIfPaused();
    if (isCancelledRef.current) return;

    setPhase("generating");
    const variantCount = batch.config.variantCount || 1;
    for (let i = 0; i < researched.length; i++) {
      await waitIfPaused();
      if (isCancelledRef.current) return;
      const c = researched[i];
      const variants = [];
      for (let v = 0; v < variantCount; v++) {
        await waitIfPaused();
        if (isCancelledRef.current) return;
        const copy = await generateAdCopy(brand, batch.config, c, c.research);
        variants.push(copy);
      }
      researched[i] = { ...c, status: "generated", copies: variants };
      setItems(prev => prev.map((it, idx) => idx === i ? researched[i] : it));
      setProgress(35 + Math.round(((i + 1) / researched.length) * 35));
    }

    await waitIfPaused();
    if (isCancelledRef.current) return;

    // Image generation (requires VITE_LITELLM_API_KEY env or window.__LITELLM_KEY__)
    if (getLiteLLMKey()) {
      setPhase("imaging");
      const selectedFormats = batch.config.formats || [];
      const customDim = batch.config.customDim;
      const formatList = [
        ...selectedFormats.map(fid => ({ key: fid, ...(FORMAT_SIZES[fid] || { w: 1080, h: 1080, api: "1024x1024" }) })),
        ...(customDim ? [{ key: customDim, ...customDimToSize(customDim) }] : []),
      ];
      const primaryApiSize = formatList[0]?.api || "1024x1024";

      for (let i = 0; i < researched.length; i++) {
        await waitIfPaused();
        if (isCancelledRef.current) return;
        const item = researched[i];
        const firstCopy = Array.isArray(item.copies) ? item.copies[0] : {};
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "imaging" } : it));
        try {
          const imagePrompt = await generateImagePrompt(brand, item, item.research || {}, firstCopy);
          if (isCancelledRef.current) return;
          const imageB64 = await generateImage(imagePrompt, primaryApiSize);
          if (isCancelledRef.current) return;
          const composited = {};
          for (const fmt of formatList) {
            composited[fmt.key] = await compositeAd(imageB64, firstCopy, brand, fmt.w, fmt.h);
            setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "imaging", composited: { ...composited } } : it));
          }
          researched[i] = { ...item, status: "imaged", imagePrompt, composited };
        } catch (err) {
          researched[i] = { ...item, status: "imageFailed", imageError: err.message };
        }
        setItems(prev => prev.map((it, idx) => idx === i ? researched[i] : it));
        setProgress(70 + Math.round(((i + 1) / researched.length) * 30));
      }
    }

    setCtrl("done");
    setPhase("done");
    setProgress(100);
    const allFormats = [...(batch.config.formats || []), ...(batch.config.customDim ? [batch.config.customDim] : [])];
    onUpdate(batch.id, { status: "review", adsCount: researched.length * allFormats.length * variantCount, items: researched });
  }

  const done = items.filter(it => ["generated","imaged","imageFailed"].includes(it.status)).length;
  const total = batch.config.courses?.length || 0;
  const barColor = ctrl === "cancelled" ? T.coral : ctrl === "paused" ? T.textMuted : phase === "done" ? T.teal : T.text;
  const phaseLabel = ctrl === "cancelled" ? "Cancelado" : ctrl === "paused" ? "En pausa" : phase === "researching" ? "Investigando cursos..." : phase === "generating" ? "Generando copy..." : phase === "imaging" ? "Generando imágenes..." : "Completado";

  return (
    <div className="fade-in content-area" style={{ flex: 1 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Procesando</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{batch.name}</h2>
        {/* Control buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 2 }}>
          {ctrl === "running" && (
            <>
              <button onClick={pause} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: T.cream, color: T.text, border: `1px solid ${T.cardBorder}` }}>
                ⏸ Pausar
              </button>
              <button onClick={cancel} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: "#FFE6E8", color: T.accent, border: `1px solid ${T.accent}` }}>
                ✕ Cancelar
              </button>
            </>
          )}
          {ctrl === "paused" && (
            <>
              <button onClick={resume} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: T.teal, color: T.white, border: "none" }}>
                ▶ Reanudar
              </button>
              <button onClick={cancel} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: "#FFE6E8", color: T.accent, border: `1px solid ${T.accent}` }}>
                ✕ Cancelar
              </button>
            </>
          )}
          {(ctrl === "cancelled" || ctrl === "done") && (
            <button onClick={restart} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: T.text, color: T.white, border: "none" }}>
              ↺ Repetir
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>{brand?.name} · {total} cursos · {batch.config.formats?.length || 1} formato{batch.config.formats?.length !== 1 ? "s" : ""}</p>

      <div style={{ background: T.cardBorder, borderRadius: 999, height: 6, marginBottom: 8 }}>
        <div style={{ width: `${progress}%`, height: 6, borderRadius: 999, background: barColor, transition: "width 0.4s ease, background 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <span style={{ fontSize: 11, color: ctrl === "paused" ? T.blueMid : ctrl === "cancelled" ? T.coral : T.textMuted, fontWeight: ctrl === "paused" || ctrl === "cancelled" ? 600 : 400 }}>{phaseLabel}</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>{done}/{total} listos</span>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
        {items.map((it, i) => {
          const isImaging   = it.status === "imaging";
          const isImaged    = it.status === "imaged";
          const isFailed    = it.status === "imageFailed";
          const isGenerated = it.status === "generated";
          const isResearching = it.status === "researching";
          const dotBg = isImaged ? T.teal : isFailed ? T.coral : isImaging ? T.blueMid : isGenerated ? T.accent : isResearching ? T.blueMid : T.cardBorder;
          const firstThumb = it.composited ? Object.values(it.composited)[0] : null;
          const statusLabel = isImaged ? "Imagen lista" : isFailed ? `Error: ${it.imageError?.slice(0,40)}` : isImaging ? "Generando imagen…" : isGenerated ? "Copy listo" : it.status === "researched" ? "Investigado" : isResearching ? "Investigando…" : "En cola";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 18px", borderBottom: i < items.length - 1 ? `1px solid ${T.cardBorder}` : "none", gap: 12 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: dotBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {(isImaged || isGenerated) && <span style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>✓</span>}
                {(isImaging || isResearching) && <div className="spin" style={{ width: 8, height: 8, border: "1.5px solid transparent", borderTopColor: "#fff", borderRadius: "50%" }} />}
              </div>
              {firstThumb
                ? <img src={firstThumb} style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", border: `1px solid ${T.cardBorder}`, flexShrink: 0 }} alt="" />
                : <div style={{ width: 36, height: 36, borderRadius: 4, background: T.cream, flexShrink: 0 }} />
              }
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: isImaged ? T.text : T.textMuted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
              <span style={{ fontSize: 10, color: isFailed ? T.coral : T.textMuted, flexShrink: 0 }}>{statusLabel}</span>
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, total - items.length) }, (_, i) => (
          <div key={`q${i}`} style={{ display: "flex", alignItems: "center", padding: "11px 18px", borderBottom: `1px solid ${T.cardBorder}`, gap: 12, opacity: 0.4 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: T.cardBorder, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.textMuted }}>{batch.config.courses?.[items.length + i]?.name || "..."}</span>
            <span style={{ fontSize: 10, color: T.textMuted }}>En cola</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BATCHES LIST ────────────────────────────────────────────────────
function Batches({ batches, onOpen, onNav }) {
  const T = useTheme();
  return (
    <div className="fade-in" style={{ padding: "40px 40px", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Lotes</h1>
        <button onClick={() => onNav("generate")} style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 500, padding: "8px 18px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6 }}>+ Nuevo lote</button>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 120px 100px", padding: "8px 20px", background: T.cream, borderBottom: `1px solid ${T.cardBorder}` }}>
          {["Lote", "Marca", "Anuncios", "Creado", "Estado"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>)}
        </div>
        {batches.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Sin lotes aún.</div>
        ) : [...batches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((b, i, arr) => (
          <div key={b.id} onClick={() => onOpen(b)} style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 120px 100px", padding: "13px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none", cursor: "pointer", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = T.cream}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{b.config?.goal || "—"}</div>
            </div>
            <span style={{ fontSize: 12, color: T.textMuted }}>{b.brand}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{b.adsCount || 0}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>{new Date(b.createdAt).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" })}</span>
            <Chip status={b.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BRAND STUDIO ────────────────────────────────────────────────────
const BRAND_TABS = ["Identidad", "Tokens", "Activos", "Tipografía", "Voz y reglas", "Config. anuncios", "Refs. visuales"];

function BrandField({ label, value, onChange, type = "text", hint }) {
  const T = useTheme();
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{label}</label>
      {type === "textarea" ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} rows={3}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text, resize: "vertical", lineHeight: 1.5 }} />
      ) : (
        <input type="text" value={value || ""} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
      )}
      {hint && <div style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function TagList({ items, onRemove, onAdd, placeholder, color }) {
  const T = useTheme();
  const [val, setVal] = useState("");
  const bg   = color === "red" ? "#fde8e8" : color === "green" ? T.statusDone.bg : T.card;
  const text = color === "red" ? T.statusFail.text : color === "green" ? T.statusDone.text : T.text;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {items.map((it, i) => (
          <span key={i} style={{ background: bg, color: text, border: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5 }}>
            {it}
            <button onClick={() => onRemove(i)} style={{ background: "transparent", color: text, fontSize: 12, lineHeight: 1, opacity: 0.5 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
          style={{ flex: 1, padding: "7px 10px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, background: T.cream, fontSize: 12, color: T.text }} />
        <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
          style={{ padding: "7px 14px", background: T.text, color: T.cream, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>Añadir</button>
      </div>
    </div>
  );
}

function SwatchRow({ colors, onChange }) {
  const T = useTheme();
  const keys = ["primary", "secondary", "accent", "background", "text_on_overlay", "cta_text"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
      {keys.map(k => (
        <div key={k}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>{k.replace("_", " ")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: colors?.[k] || "#cccccc", border: `1px solid ${T.cardBorder}`, flexShrink: 0 }} />
            <input value={colors?.[k] || ""} onChange={e => onChange({ ...colors, [k]: e.target.value })}
              style={{ flex: 1, padding: "5px 8px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, background: T.cream, fontSize: 11, fontFamily: "monospace", color: T.text }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandsScreen({ brands, onSave }) {
  const T = useTheme();
  const [selectedBrand, setSelectedBrand] = useState(brands[0]?.id || "");
  const [activeTab, setActiveTab] = useState("Identidad");
  const brand = brands.find(b => b.id === selectedBrand) || brands[0];
  const [form, setForm] = useState(brand || {});
  const pdfRef = useRef();

  const [pdfFiles, setPdfFiles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false);

  useEffect(() => { setForm(brand || {}); setPdfFiles([]); setAnalyzeSuccess(false); setAnalyzeError(""); }, [selectedBrand]);

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  function save() { onSave({ ...form }); }

  async function handlePdfUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const loaded = await Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ name: file.name, base64: ev.target.result.split(",")[1], size: file.size });
      reader.readAsDataURL(file);
    })));
    setPdfFiles(prev => [...prev, ...loaded]);
    setAnalyzeSuccess(false);
    setAnalyzeError("");
  }

  async function runAnalysis() {
    if (!pdfFiles.length) return;
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalyzeSuccess(false);
    try {
      setAnalyzeProgress("Leyendo " + pdfFiles.length + " documento" + (pdfFiles.length > 1 ? "s" : "") + "...");
      const extracted = await analyzeBrandPDF(pdfFiles.map(p => p.base64), form.name || "");
      if (!extracted) throw new Error("No se pudo parsear la config de marca.");
      setForm(prev => ({ ...prev, ...extracted, id: prev.id || ("b_" + Date.now()) }));
      setAnalyzeSuccess(true);
      setAnalyzeProgress("");
      setActiveTab("Identidad");
    } catch (err) {
      setAnalyzeError(err.message || "Error en análisis. Intenta de nuevo.");
      setAnalyzeProgress("");
    }
    setAnalyzing(false);
  }

  const colors     = form.colors     || { primary: "#003a70", secondary: "#0070b8", accent: "#f5a623", background: "#f8f8f8", text_on_overlay: "#ffffff", cta_text: "#ffffff" };
  const voiceRules = form.voiceRules || { headline: [], body: [], forbidden: [] };
  const adRules    = form.adRules    || { formats: ["story", "feed_4x5"], ctas: ["Ver curso", "Empieza hoy"], mustInclude: ["course_title"], neverInclude: [] };

  const tabContent = {
    "Identidad": (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <BrandField label="Nombre de marca"  value={form.name}        onChange={v => f("name", v)} />
          <BrandField label="Idioma principal"  value={form.language}    onChange={v => f("language", v)} hint="es / en / pt" />
          <BrandField label="Tagline"           value={form.tagline}     onChange={v => f("tagline", v)} />
          <BrandField label="Sitio web"         value={form.website}     onChange={v => f("website", v)} />
        </div>
        <BrandField label="Posicionamiento" value={form.positioning} onChange={v => f("positioning", v)} hint="Una oración: qué hace esta marca y para quién." />
        <BrandField label="Audiencia objetivo" value={form.audience} onChange={v => f("audience", v)} />
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Etiquetas de personalidad</label>
          <TagList
            items={form.personality ? form.personality.split(",").map(s => s.trim()) : []}
            onRemove={i => { const a = form.personality?.split(",").map(s => s.trim()) || []; a.splice(i, 1); f("personality", a.join(", ")); }}
            onAdd={v => f("personality", [...(form.personality?.split(",").map(s => s.trim()) || []), v].join(", "))}
            placeholder="ej. authoritative" />
        </div>
      </div>
    ),
    "Tokens": (
      <div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>Los tokens de diseño se inyectan en cada plantilla de anuncio. Los colores son usados por el renderer para overlays, botones y acentos.</div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Paleta de colores</label>
          <SwatchRow colors={colors} onChange={v => f("colors", v)} />
        </div>
      </div>
    ),
    "Activos": (
      <div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>Los logos SVG/PNG se componen sobre cada anuncio vía Canvas. Se almacenan como datos en la config de marca.</div>
        {[
          { label: "Logo — blanco (sobre fondos oscuros)", key: "logoWhite",   accept: ".svg,.png" },
          { label: "Logo — principal",                     key: "logoPrimary", accept: ".svg,.png" },
          { label: "Logo — oscuro (sobre fondos claros)",  key: "logoDark",    accept: ".svg,.png" },
        ].map(asset => {
          const aRef = useRef();
          const val = form[asset.key];
          const hasFile = val?.name || (typeof val === "string" && val);
          return (
            <div key={asset.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: `1px solid ${hasFile ? T.accent : T.cardBorder}`, borderRadius: 10, marginBottom: 8, background: T.card }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{asset.label}</div>
                <div style={{ fontSize: 11, color: hasFile ? T.accentDark : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {val?.name || (typeof val === "string" && val) || "Sin archivo subido"}
                </div>
              </div>
              {val?.data && val.data.startsWith("data:image") && (
                <img src={val.data} style={{ height: 28, maxWidth: 80, objectFit: "contain", margin: "0 12px" }} alt="preview" />
              )}
              <button onClick={() => aRef.current?.click()} style={{ background: T.text, color: T.cream, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, flexShrink: 0 }}>Subir</button>
              <input ref={aRef} type="file" accept={asset.accept} style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => f(asset.key, { name: file.name, data: ev.target.result });
                reader.readAsDataURL(file);
              }} />
            </div>
          );
        })}
      </div>
    ),
    "Tipografía": (() => {
      const fontData = form.fontData || {};
      const setFontData = patch => f("fontData", { ...fontData, ...patch });
      const makeFontUpload = (label, dataKey, fileKey) => {
        const ref = useRef();
        const hasData = fontData[dataKey];
        return (
          <div style={{ background: T.card, border: `1px solid ${hasData ? T.accent : T.cardBorder}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => ref.current?.click()} style={{ background: T.text, color: T.cream, fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 999, flexShrink: 0 }}>
                {hasData ? "Reemplazar .ttf" : "Subir .ttf"}
              </button>
              <span style={{ fontSize: 11, color: hasData ? T.accentDark : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fontData[fileKey] || "Sin archivo — usa nombre CSS o URL del backend"}
              </span>
              <input ref={ref} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => setFontData({ [dataKey]: ev.target.result, [fileKey]: file.name });
                reader.readAsDataURL(file);
              }} />
            </div>
          </div>
        );
      };
      return (
        <div>
          <div style={{ padding: "10px 14px", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, marginBottom: 20, fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
            Canvas HTML estampa el copy usando las fuentes de marca. Sube .ttf directamente <em>o</em> proporciona la URL base del servidor de fuentes del backend.
          </div>
          <BrandField label="URL base servidor de fuentes (backend)" value={form.fontServerUrl} onChange={v => f("fontServerUrl", v)} hint="ej. https://assets.tu-backend.com/fonts" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <BrandField label="Nombre fuente display (CSS)" value={form.fonts?.display} onChange={v => f("fonts", { ...(form.fonts || {}), display: v })} hint="ej. Montserrat" />
            <BrandField label="Nombre fuente cuerpo (CSS)"  value={form.fonts?.body}    onChange={v => f("fonts", { ...(form.fonts || {}), body: v })}    hint="ej. Inter" />
          </div>
          {makeFontUpload("Fuente display (.ttf)", "displayData", "displayFile")}
          {makeFontUpload("Fuente cuerpo (.ttf)",  "bodyData",    "bodyFile")}
        </div>
      );
    })(),
    "Voz y reglas": (
      <div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reglas de titular</div>
          <TagList items={voiceRules.headline || []} onRemove={i => { const a = [...(voiceRules.headline || [])]; a.splice(i, 1); f("voiceRules", { ...voiceRules, headline: a }); }} onAdd={v => f("voiceRules", { ...voiceRules, headline: [...(voiceRules.headline || []), v] })} placeholder='ej. "Empieza con verbo de acción"' />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reglas de cuerpo de texto</div>
          <TagList items={voiceRules.body || []} onRemove={i => { const a = [...(voiceRules.body || [])]; a.splice(i, 1); f("voiceRules", { ...voiceRules, body: a }); }} onAdd={v => f("voiceRules", { ...voiceRules, body: [...(voiceRules.body || []), v] })} placeholder='ej. "Máx. 2-3 frases"' />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Palabras prohibidas</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Se inyectan como lista negra en el prompt. El modelo nunca las usará.</div>
          <TagList items={voiceRules.forbidden || []} onRemove={i => { const a = [...(voiceRules.forbidden || [])]; a.splice(i, 1); f("voiceRules", { ...voiceRules, forbidden: a }); }} onAdd={v => f("voiceRules", { ...voiceRules, forbidden: [...(voiceRules.forbidden || []), v] })} placeholder="Añadir palabra prohibida..." color="red" />
        </div>
        <div style={{ marginTop: 16 }}>
          <BrandField label="Tono general" value={form.tone} onChange={v => f("tone", v)} hint='Ej. "Seguro, directo. Nunca agresivo en ventas."' />
        </div>
      </div>
    ),
    "Config. anuncios": (
      <div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Formatos por defecto</label>
          {FORMATS.map(fmt => {
            const on = (adRules.formats || []).includes(fmt.id);
            return (
              <div key={fmt.id} onClick={() => { const cur = adRules.formats || []; f("adRules", { ...adRules, formats: on ? cur.filter(x => x !== fmt.id) : [...cur, fmt.id] }); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: `1px solid ${on ? T.text : T.cardBorder}`, borderRadius: 8, marginBottom: 6, background: on ? "#F4F4F4" : T.card, cursor: "pointer" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: on ? T.text : T.textMuted }}>{fmt.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>{fmt.dim}</span>
                  <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${on ? T.text : T.cardBorder}`, background: on ? T.text : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <span style={{ fontSize: 10, color: T.cream }}>✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>CTAs por defecto</label>
          <TagList items={adRules.ctas || []} onRemove={i => { const a = [...(adRules.ctas || [])]; a.splice(i, 1); f("adRules", { ...adRules, ctas: a }); }} onAdd={v => f("adRules", { ...adRules, ctas: [...(adRules.ctas || []), v] })} placeholder='ej. "Ver curso"' color="green" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Debe incluir</label>
            <TagList items={adRules.mustInclude || []} onRemove={i => { const a = [...(adRules.mustInclude || [])]; a.splice(i, 1); f("adRules", { ...adRules, mustInclude: a }); }} onAdd={v => f("adRules", { ...adRules, mustInclude: [...(adRules.mustInclude || []), v] })} placeholder="course_title" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Nunca incluir</label>
            <TagList items={adRules.neverInclude || []} onRemove={i => { const a = [...(adRules.neverInclude || [])]; a.splice(i, 1); f("adRules", { ...adRules, neverInclude: a }); }} onAdd={v => f("adRules", { ...adRules, neverInclude: [...(adRules.neverInclude || []), v] })} placeholder="competitor_names" color="red" />
          </div>
        </div>
      </div>
    ),
    "Refs. visuales": (() => {
      const refImgs = form.refImages || [];
      const refRef = useRef();
      const [analyzing, setAnalyzing] = useState(false);
      const [analyzeErr, setAnalyzeErr] = useState("");

      const addRefImages = e => {
        const files = Array.from(e.target.files);
        Promise.all(files.map(file => resizeImageFile(file).then(data => ({ name: file.name, data }))))
          .then(loaded => f("refImages", [...refImgs, ...loaded].slice(0, 8)));
      };

      const runRefAnalysis = async () => {
        if (!refImgs.length) return;
        setAnalyzing(true); setAnalyzeErr("");
        try {
          const descriptor = await analyzeRefImages(refImgs);
          f("brandImageStyle", descriptor);
        } catch (err) { setAnalyzeErr(err.message || "Error al analizar"); }
        setAnalyzing(false);
      };

      return (
        <div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
            Gemini analiza tus imágenes de referencia y extrae un descriptor visual de marca. Ese descriptor se inyecta en cada prompt de generación de imagen.
          </div>

          {/* Upload */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {refImgs.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img.data} alt={img.name} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.cardBorder}` }} />
                <button onClick={() => f("refImages", refImgs.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#e53", color: "#fff", fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            ))}
            {refImgs.length < 8 && (
              <button onClick={() => refRef.current?.click()}
                style={{ width: 72, height: 72, borderRadius: 8, border: `2px dashed ${T.cardBorder}`, background: T.card, fontSize: 22, color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            )}
          </div>
          <input ref={refRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addRefImages} />

          {/* Analyze button */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <button onClick={runRefAnalysis} disabled={analyzing || !refImgs.length}
              style={{ background: refImgs.length ? T.text : T.cardBorder, color: T.cream, fontSize: 12, fontWeight: 600, padding: "8px 18px", borderRadius: 999, opacity: analyzing ? 0.7 : 1 }}>
              {analyzing ? "Analizando…" : "✦ Analizar referencias con Gemini"}
            </button>
            {analyzeErr && <span style={{ fontSize: 11, color: T.statusFail.text }}>{analyzeErr}</span>}
          </div>

          {/* Style descriptor */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Descriptor visual de marca</label>
            <textarea
              value={form.brandImageStyle || ""}
              onChange={e => f("brandImageStyle", e.target.value)}
              placeholder="Se generará automáticamente al analizar las referencias. También puedes escribirlo manualmente."
              rows={4}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 8, fontSize: 12, lineHeight: 1.6, resize: "vertical", background: T.card, color: T.text, boxSizing: "border-box" }}
            />
          </div>
        </div>
      );
    })(),
  };

  return (
    <div className="fade-in content-area" style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Estudio de marca</h1>
        <button onClick={save} style={{ background: T.accent, color: T.accentDark, fontSize: 12, fontWeight: 700, padding: "8px 20px", borderRadius: 999 }}>✦ Publicar cambios</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>Marcas</div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            {brands.map((b, i) => (
              <button key={b.id} onClick={() => { setSelectedBrand(b.id); setActiveTab("Identidad"); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: selectedBrand === b.id ? T.text : "transparent", borderBottom: i < brands.length - 1 ? `1px solid ${T.cardBorder}` : "none", textAlign: "left" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.id === "b1" ? "#2672ea" : b.id === "b2" ? "#1b883c" : "#7f55e1", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: selectedBrand === b.id ? T.cream : T.text }}>{b.name}</div>
                  <div style={{ fontSize: 10, color: selectedBrand === b.id ? "rgba(255,255,255,0.5)" : T.textMuted }}>{b.language?.toUpperCase() || "ES"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <input ref={pdfRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={handlePdfUpload} />

          {pdfFiles.length === 0 ? (
            <div onClick={() => pdfRef.current?.click()}
              style={{ border: `1.5px dashed ${T.cardBorder}`, borderRadius: 12, padding: "20px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: T.cream, marginBottom: 20 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.textMuted}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
              <div style={{ width: 40, height: 48, borderRadius: 6, background: T.card, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📄</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Auto-rellenar desde documentos de marca</div>
                <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>Sube tu brandbook o guía de estilo en PDF. Claude leerá y pre-llenará todos los campos automáticamente.</div>
              </div>
              <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                <span style={{ background: T.text, color: T.cream, fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 999 }}>Subir PDF</span>
              </div>
            </div>
          ) : (
            <div style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 12, background: T.card, marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{pdfFiles.length} documento{pdfFiles.length > 1 ? "s" : ""} listo{pdfFiles.length > 1 ? "s" : ""} para analizar</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => pdfRef.current?.click()} style={{ background: "transparent", color: T.textMuted, fontSize: 11, border: `1px solid ${T.cardBorder}`, padding: "4px 10px", borderRadius: 999 }}>+ Agregar</button>
                    <button onClick={() => { setPdfFiles([]); setAnalyzeSuccess(false); setAnalyzeError(""); }} style={{ background: "transparent", color: T.textMuted, fontSize: 11 }}>Limpiar ×</button>
                  </div>
                </div>
                {pdfFiles.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? `1px solid ${T.cardBorder}` : "none" }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <span style={{ fontSize: 12, flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{(p.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setPdfFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "transparent", color: T.textMuted, fontSize: 13 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {analyzing && <div style={{ fontSize: 11, color: T.textMuted }}>{analyzeProgress}</div>}
                  {analyzeError && <div style={{ fontSize: 11, color: T.statusFail.text }}>{analyzeError}</div>}
                  {analyzeSuccess && <div style={{ fontSize: 11, color: T.statusDone.text }}>✓ Config extraída y aplicada — revisa cada pestaña y guarda.</div>}
                </div>
                <button onClick={runAnalysis} disabled={analyzing}
                  style={{ background: analyzing ? T.cardBorder : T.ctaDark, color: analyzing ? T.textMuted : T.accent, fontSize: 12, fontWeight: 700, padding: "9px 20px", borderRadius: 999, whiteSpace: "nowrap", cursor: analyzing ? "not-allowed" : "pointer" }}>
                  {analyzing ? "Analizando..." : "✦ Analizar documentos"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 24, gap: 0, overflowX: "auto" }}>
            {BRAND_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "8px 14px", background: "transparent", color: activeTab === tab ? T.text : T.textMuted, fontSize: 12, fontWeight: activeTab === tab ? 600 : 400, borderBottom: `2px solid ${activeTab === tab ? T.text : "transparent"}`, marginBottom: -1, whiteSpace: "nowrap" }}>
                {tab}
              </button>
            ))}
          </div>

          <div className="fade-in" key={activeTab}>
            {tabContent[activeTab]}
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.cardBorder}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setForm(brand || {})} style={{ background: "transparent", color: T.textMuted, fontSize: 12, padding: "8px 16px", border: `1px solid ${T.cardBorder}`, borderRadius: 999 }}>Restablecer</button>
            <button onClick={save} style={{ background: T.text, color: T.cream, fontSize: 12, fontWeight: 600, padding: "8px 22px", borderRadius: 999 }}>Guardar marca</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT ZIP ──────────────────────────────────────────────────────
async function exportBatchZip(batch, approvedKeys = null) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const allFormats = [
    ...(batch.config?.formats || []).map(f => FORMATS.find(x => x.id === f)?.label || f),
    ...(batch.config?.customDim ? [`Custom_${batch.config.customDim}`] : []),
  ];

  const escCSV = v => `"${String(v || "").replace(/"/g, '""')}"`;

  const headers = ["siglas","nivel","curso","url","formato","variante","headline","body","benefit1","benefit2","cta","pain_point"];
  const rows = [headers.join(",")];

  for (const item of (batch.items || [])) {
    const variants = Array.isArray(item.copies) ? item.copies : (item.copies ? [item.copies] : [{}]);
    for (const fmt of allFormats) {
      variants.forEach((copy, vi) => {
        rows.push([
          item.siglas || "", item.nivel || "", item.name || "", item.url || "",
          fmt, vi + 1,
          copy.headline || "", copy.body || "", copy.benefit1 || "", copy.benefit2 || "",
          copy.cta || "", copy.painPoint || "",
        ].map(escCSV).join(","));
      });
    }
  }

  zip.file("ads.csv", rows.join("\n"));
  zip.file("campaign.json", JSON.stringify({ name: batch.name, brand: batch.brand, config: batch.config }, null, 2));

  // PNGs — composited images, filtered by approvedKeys if provided
  const imgFolder = zip.folder("images");
  (batch.items || []).forEach((item, itemIdx) => {
    if (!item.composited) return;
    const safeName = (item.siglas || item.name || "item").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    for (const [fmtKey, dataURL] of Object.entries(item.composited)) {
      if (!dataURL) continue;
      const cardKey = `${itemIdx}-${fmtKey}`;
      if (approvedKeys && !approvedKeys.has(cardKey)) continue;
      const b64 = dataURL.replace(/^data:image\/png;base64,/, "");
      const safeFmt = String(fmtKey).replace(/[^a-z0-9]/gi, "_");
      imgFolder.file(`${safeName}__${safeFmt}.png`, b64, { base64: true });
    }
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${batch.name.replace(/[^a-z0-9]/gi, "_")}_ads.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── AD PREVIEW GRID ─────────────────────────────────────────────────
// ─── IMAGE APPROVAL GRID ─────────────────────────────────────────────
function ImageApprovalGrid({ items, approved, onToggle }) {
  const T = useTheme();
  // Flatten: one card per (item × format)
  const cards = [];
  (items || []).forEach((item, itemIdx) => {
    if (!item.composited) return;
    Object.entries(item.composited).forEach(([fmtKey, dataURL]) => {
      if (!dataURL) return;
      const fmt = FORMATS.find(f => f.id === fmtKey);
      const label = fmt?.label || fmtKey;
      const fmtSize = fmt
        ? { w: parseInt(fmt.dim), h: parseInt(fmt.dim.split("×")[1]) }
        : customDimToSize(fmtKey);
      const cardKey = `${itemIdx}-${fmtKey}`;
      cards.push({ itemIdx, item, fmtKey, dataURL, label, fmtSize, cardKey });
    });
  });

  if (cards.length === 0) return null;

  const CARD_H = 180;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {cards.map(({ item, fmtKey, dataURL, label, fmtSize, cardKey }) => {
        const isApproved = approved.has(cardKey);
        const previewW = Math.max(90, Math.round(CARD_H * (fmtSize.w / fmtSize.h)));
        const firstCopy = Array.isArray(item.copies) ? item.copies[0] : (item.copies || {});
        return (
          <div key={cardKey} onClick={() => onToggle(cardKey)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", background: T.card, borderRadius: 12, overflow: "hidden", border: `2px solid ${isApproved ? T.teal : "#E96A73"}`, boxShadow: isApproved ? "0 0 0 3px rgba(96,191,184,0.15)" : "0 0 0 3px rgba(233,106,115,0.12)", transition: "border-color 0.15s, box-shadow 0.15s", width: previewW + 2 }}>
            {/* Image */}
            <div style={{ position: "relative" }}>
              <img src={dataURL} alt={label} style={{ width: previewW, height: CARD_H, objectFit: "cover", display: "block" }} />
              {/* Approval badge */}
              <div style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: isApproved ? T.teal : "#E96A73", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                {isApproved ? "✓" : "✕"}
              </div>
              {/* Format pill */}
              <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(32,32,32,0.7)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: "0.05em" }}>
                {label}
              </div>
            </div>
            {/* Info */}
            <div style={{ padding: "8px 10px", borderTop: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.siglas ? `[${item.siglas}] ` : ""}{item.name}
              </div>
              {firstCopy.headline && (
                <div style={{ fontSize: 9, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {firstCopy.headline}
                </div>
              )}
              <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                <a href={dataURL} download={`${(item.siglas || item.name || "ad").replace(/\s/g,"_")}_${fmtKey}.png`}
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 9, color: T.blueMid, padding: "2px 7px", border: `1px solid ${T.cardBorder}`, borderRadius: 999, background: T.cream, textDecoration: "none" }}>
                  PNG ↓
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── BATCH DETAIL ────────────────────────────────────────────────────
function BatchDetail({ batch, onBack }) {
  const T = useTheme();
  // Build all card keys from composited images
  const allKeys = [];
  (batch.items || []).forEach((item, idx) => {
    if (!item.composited) return;
    Object.keys(item.composited).forEach(fmtKey => {
      allKeys.push(`${idx}-${fmtKey}`);
    });
  });

  const [approved, setApproved] = useState(() => new Set(allKeys));

  // Sync when batch.items changes (e.g. after live processing)
  useEffect(() => {
    setApproved(prev => {
      const next = new Set(prev);
      allKeys.forEach(k => { if (!next.has(k) && !prev.has(`__rejected__${k}`)) next.add(k); });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.items]);

  function toggleKey(key) {
    setApproved(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const approvedCount = allKeys.filter(k => approved.has(k)).length;
  const hasImages = allKeys.length > 0;

  return (
    <div className="fade-in" style={{ padding: "36px 32px", maxWidth: 1100, flex: 1 }}>
      <button onClick={onBack} style={{ background: "transparent", fontSize: 12, color: T.textMuted, marginBottom: 20, display: "flex", alignItems: "center", gap: 4 }}>← Volver a lotes</button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{batch.name}</h1>
          <p style={{ fontSize: 13, color: T.textMuted }}>{batch.brand} · {batch.adsCount || 0} anuncios · <Chip status={batch.status} /></p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => exportBatchZip(batch, null)} style={{ background: T.cream, color: T.text, fontSize: 12, fontWeight: 500, padding: "8px 16px", borderRadius: 999, border: `1px solid ${T.cardBorder}` }}>
            ZIP completo
          </button>
          {hasImages && (
            <button onClick={() => exportBatchZip(batch, approved)} style={{ background: T.text, color: T.white, fontSize: 12, fontWeight: 600, padding: "8px 18px", borderRadius: 999 }}>
              Exportar aprobadas ({approvedCount})
            </button>
          )}
        </div>
      </div>

      {/* Config summary */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "16px 20px", marginBottom: 24, boxShadow: "0 2px 8px rgba(32,32,32,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            ["Objetivo",        batch.config?.goal],
            ["Audiencia",       batch.config?.audience?.join(", ")],
            ["Puntos de dolor", batch.config?.painPoints?.join(" · ")],
            ["CTAs",            batch.config?.ctas?.join(" / ")],
            ["Formatos",        batch.config?.formats?.map(f => FORMATS.find(x => x.id === f)?.label).join(", ")],
            ["Cursos",          `${batch.config?.courses?.length || 0} cargados`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Image approval grid */}
      {hasImages && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Creatividades</span>
              <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 8 }}>{approvedCount} de {allKeys.length} aprobadas</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setApproved(new Set(allKeys))} style={{ fontSize: 11, color: T.tealText, background: "#EAF7F6", border: `1px solid ${T.teal}`, padding: "4px 12px", borderRadius: 999 }}>Aprobar todas</button>
              <button onClick={() => setApproved(new Set())} style={{ fontSize: 11, color: "#963058", background: "#FFE6E8", border: "1px solid #963058", padding: "4px 12px", borderRadius: 999 }}>Rechazar todas</button>
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 16 }}>Clic en imagen para aprobar / rechazar. Solo las aprobadas se incluyen en el export.</p>
          <ImageApprovalGrid items={batch.items} approved={approved} onToggle={toggleKey} />
        </div>
      )}

      {/* Courses list (when no images) */}
      {!hasImages && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 12, fontWeight: 600 }}>Cursos ({batch.config?.courses?.length || 0})</div>
          {(batch.items || batch.config?.courses || []).slice(0, 20).map((c, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : "none", gap: 12 }}>
              <span style={{ fontSize: 11, color: T.textMuted, width: 24 }}>{i + 1}</span>
              {c.siglas && <span style={{ fontSize: 11, fontWeight: 700, color: T.tealText, background: "#EAF7F6", border: `1px solid ${T.teal}`, borderRadius: 6, padding: "1px 7px", flexShrink: 0 }}>{c.siglas}</span>}
              {c.nivel  && <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{c.nivel}</span>}
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{c.name}</span>
              {c.url && <span style={{ fontSize: 11, color: T.blueMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{c.url}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [batches, setBatches] = useState([]);
  const [brands, setBrands] = useState(DEFAULT_BRANDS);
  const [activeBatch, setActiveBatch] = useState(null);
  const [processingBatch, setProcessingBatch] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem("adbatch-theme") || "light"; } catch { return "light"; }
  });
  function toggleTheme() {
    setThemeName(prev => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem("adbatch-theme", next); } catch {}
      return next;
    });
  }
  const tokens = themeName === "dark" ? DARK : LIGHT;

  function onBatchCreated(batch) {
    setBatches(prev => [batch, ...prev]);
    setProcessingBatch(batch);
    setScreen("processing");
  }
  function onBatchUpdate(id, updates) {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    if (processingBatch?.id === id) setProcessingBatch(p => p ? { ...p, ...updates } : null);
    if (updates.status === "review") {
      setTimeout(() => { setScreen("batches"); setProcessingBatch(null); }, 1200);
    }
  }
  function onSaveBrand(updated) {
    setBrands(prev => prev.map(b => b.id === updated.id ? updated : b));
  }
  function openBatch(b) { setActiveBatch(b); setScreen("batch-detail"); }

  const creditsLeft = Math.max(0, 847 - batches.reduce((a, b) => a + (b.adsCount || 0), 0));
  const titleMap = { dashboard: "resumen", generate: "nuevo lote", batches: "todos los lotes", brands: "estudio de marca", processing: "procesando", "batch-detail": "detalle del lote" };

  return (
    <ThemeContext.Provider value={{ tokens, themeName, toggle: toggleTheme }}>
      <style>{globalCSS}</style>
      <div className="app-shell" style={{ background: tokens.cream, color: tokens.text }}>
        <div className={`app-overlay${sidebarOpen ? " sidebar-open" : ""}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar active={screen} onNav={setScreen} batches={batches} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="app-content">
          <TopBar title={titleMap[screen] || screen} creditsLeft={creditsLeft} onNewBatch={() => setScreen("generate")} onMenuToggle={() => setSidebarOpen(o => !o)} />
          <main style={{ flex: 1, overflowY: "auto", display: "flex" }}>
            {screen === "dashboard"    && <Dashboard batches={batches} onNewBatch={() => setScreen("generate")} onNav={setScreen} />}
            {screen === "generate"     && <Generate brands={brands} onBatchCreated={onBatchCreated} />}
            {screen === "processing"   && processingBatch && <BatchProcessor batch={processingBatch} brands={brands} onUpdate={onBatchUpdate} />}
            {screen === "batches"      && <Batches batches={batches} onOpen={openBatch} onNav={setScreen} />}
            {screen === "brands"       && <BrandsScreen brands={brands} onSave={onSaveBrand} />}
            {screen === "batch-detail" && activeBatch && <BatchDetail batch={activeBatch} onBack={() => setScreen("batches")} />}
          </main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
