import { EUROINNOVA_IMAGE_RULES } from "./campaignOptions.js";
import { BUCKETS, getSignedUrl, uploadFile } from "./supabase";

// Las marcas por defecto llevan ids locales ("b1".."b4") hasta que su fila en
// Supabase existe; batches.brand_id es uuid, así que un id local colaría un
// valor inválido y tumbaría el insert entero del lote.
export const isUuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const DEFAULT_BRANDS = [
  { id: "b1", slug: "structuralia", name: "Structuralia", tone: "Authoritative and precise", personality: "Technical, trustworthy", language: "es", headlineRules: "Start with action verb, max 8 words", bodyRules: "2-3 sentences, lead with transformation", forbiddenWords: "revolutionary, amazing, world-class" },
  { id: "b2", slug: "educahub-ai", name: "EducaHub.ai",  tone: "Warm and aspirational",     personality: "Innovative, approachable", language: "es", headlineRules: "Focus on outcome, conversational, max 10 words", bodyRules: "Lead with benefit, mention flexibility", forbiddenWords: "guaranteed, best, incredible" },
  { id: "b3", slug: "phia", name: "Phia",         tone: "Bold and visionary",         personality: "Cutting-edge, empowering", language: "en", headlineRules: "Future-focused, action-oriented, punchy", bodyRules: "Short and direct, emphasize AI advantage", forbiddenWords: "traditional, basic, generic" },
  {
    id: "b4", slug: "euroinnova", name: "Euroinnova",
    tone: "Cercano, directo, amable, enérgico",
    personality: "Cercano, directo, enérgico, práctico",
    language: "es",
    headlineRules: "Nombra el curso de forma directa, sin imperativos, sin MAYÚSCULAS SOSTENIDAS, frases cortas.",
    bodyRules: "Frase de dolor/alivio: nombra un problema real y ofrece alivio a través del curso. Máx. 18 palabras. Sin imperativos, sin mayúsculas sostenidas, sin tecnicismos sin explicar.",
    forbiddenWords: "imperativos, MAYÚSCULAS SOSTENIDAS, tecnicismos sin explicar, revolucionario, único en el mercado",
    colors: { primary: "#B0263E", secondary: "#202020", accent: "#B0263E", background: "#FFFFFF", text_on_overlay: "#FFFFFF", cta_text: "#FFFFFF" },
    fonts: { display: "Exo 2", body: "Ubuntu" },
    brandImageStyle: EUROINNOVA_IMAGE_RULES,
    adRules: { formats: ["feed_4x5", "story"], ctas: ["Solicitar información"], logoPlacement: "top-left", mustInclude: ["course_title"], neverInclude: ["degradados", "formas orgánicas"] },
  },
];

// ─── SUPABASE BRAND MAPPING ─────────────────────────────────────────────
// Bridges the client brand shape (used throughout the wizard/compositor)
// and the `brands` table row shape. Logo/font/ref-image assets are stored
// in Storage as paths; on load we resolve each to a signed URL and put it
// back in the same `.data` field the compositor/UI already reads — so
// compositeAd, loadFontFace, and the Refs. visuales preview need no changes.
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "brand";
}

const BRAND_ASSET_URL_TTL = 60 * 60 * 24; // 1 day — used all session long, unlike per-view creative URLs

async function resolveBrandAssetUrl(path) {
  if (!path) return null;
  try { return await getSignedUrl(BUCKETS.brandAssets, path, BRAND_ASSET_URL_TTL); }
  catch (err) { console.warn("[supabase] No se pudo firmar URL de asset:", path, err.message); return null; }
}

export async function rowToBrand(row) {
  const logos = row.logos || {};
  const fontData = row.font_data || {};
  const refImages = row.ref_images || [];
  const [logoWhiteUrl, logoDarkUrl, logoPrimaryUrl, displayFontUrl, bodyFontUrl, refUrls] = await Promise.all([
    resolveBrandAssetUrl(logos.white),
    resolveBrandAssetUrl(logos.dark),
    resolveBrandAssetUrl(logos.primary),
    resolveBrandAssetUrl(fontData.displayPath),
    resolveBrandAssetUrl(fontData.bodyPath),
    Promise.all(refImages.map(r => resolveBrandAssetUrl(r.path))),
  ]);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || "",
    website: row.website || "",
    positioning: row.positioning || "",
    audience: row.audience || "",
    personality: row.personality || "",
    language: row.language || "es",
    tone: row.tone || "",
    headlineRules: row.headline_rules || "",
    bodyRules: row.body_rules || "",
    forbiddenWords: row.forbidden_words || "",
    colors: row.colors || {},
    fonts: row.fonts || {},
    brandImageStyle: row.brand_image_style || "",
    fontServerUrl: row.font_server_url || "",
    adRules: row.ad_rules || {},
    voiceRules: row.voice_rules || {},
    logoWhite:   logos.white   ? { name: "logo-white",   path: logos.white,   data: logoWhiteUrl }   : undefined,
    logoDark:    logos.dark    ? { name: "logo-dark",    path: logos.dark,    data: logoDarkUrl }    : undefined,
    logoPrimary: logos.primary ? { name: "logo-primary", path: logos.primary, data: logoPrimaryUrl } : undefined,
    fontData: {
      displayFile: fontData.displayFile || "",
      bodyFile: fontData.bodyFile || "",
      displayPath: fontData.displayPath || "",
      bodyPath: fontData.bodyPath || "",
      displayData: displayFontUrl || "",
      bodyData: bodyFontUrl || "",
    },
    refImages: refImages.map((r, i) => ({ name: r.name || `ref-${i + 1}`, path: r.path, data: refUrls[i] })),
  };
}

export function brandToRow(brand) {
  const slug = brand.slug || slugify(brand.name);
  return {
    slug,
    name: brand.name || slug,
    tagline: brand.tagline || null,
    website: brand.website || null,
    positioning: brand.positioning || null,
    audience: brand.audience || null,
    personality: brand.personality || null,
    language: brand.language || "es",
    tone: brand.tone || null,
    headline_rules: brand.headlineRules || null,
    body_rules: brand.bodyRules || null,
    forbidden_words: brand.forbiddenWords || null,
    colors: brand.colors || {},
    fonts: brand.fonts || {},
    brand_image_style: brand.brandImageStyle || null,
    font_server_url: brand.fontServerUrl || null,
    ad_rules: brand.adRules || {},
    voice_rules: brand.voiceRules || {},
    logos: {
      white: brand.logoWhite?.path || null,
      dark: brand.logoDark?.path || null,
      primary: brand.logoPrimary?.path || null,
    },
    font_data: {
      displayFile: brand.fontData?.displayFile || null,
      bodyFile: brand.fontData?.bodyFile || null,
      displayPath: brand.fontData?.displayPath || null,
      bodyPath: brand.fontData?.bodyPath || null,
    },
    ref_images: (brand.refImages || []).map(r => ({ name: r.name, path: r.path })),
  };
}

// Uploads any freshly-picked (base64 `data:` URI) brand assets to Storage,
// returning a brand object with `.path` set on each. Assets that already
// have a `.path` (loaded from DB, untouched this session) are left alone.
// El accept de logos admite .svg y .png — la extensión debe salir del mime
// real del data URL: un SVG guardado como .png rompe el preview del bucket y
// cualquier cliente que confíe en la extensión.
function dataUrlExt(dataUrl) {
  const m = /^data:image\/(svg\+xml|png|jpeg|webp)/.exec(dataUrl || "");
  if (!m) return "png";
  return m[1] === "svg+xml" ? "svg" : m[1] === "jpeg" ? "jpg" : m[1];
}

export async function persistBrandAssets(brand) {
  const slug = brand.slug || slugify(brand.name);
  const next = { ...brand };

  async function uploadIfFresh(asset, basename) {
    if (!asset?.data || asset.path) return asset;
    const path = `${slug}/${basename}.${dataUrlExt(asset.data)}`;
    await uploadFile(BUCKETS.brandAssets, path, asset.data);
    return { ...asset, path };
  }

  next.logoWhite   = await uploadIfFresh(brand.logoWhite,   "logo-white");
  next.logoDark    = await uploadIfFresh(brand.logoDark,    "logo-dark");
  next.logoPrimary = await uploadIfFresh(brand.logoPrimary, "logo-primary");

  if (brand.fontData?.displayData?.startsWith("data:") && !brand.fontData?.displayPath) {
    const path = `${slug}/font-display.ttf`;
    await uploadFile(BUCKETS.brandAssets, path, brand.fontData.displayData, "font/ttf");
    next.fontData = { ...next.fontData, displayPath: path };
  }
  if (brand.fontData?.bodyData?.startsWith("data:") && !brand.fontData?.bodyPath) {
    const path = `${slug}/font-body.ttf`;
    await uploadFile(BUCKETS.brandAssets, path, brand.fontData.bodyData, "font/ttf");
    next.fontData = { ...next.fontData, bodyPath: path };
  }

  if (brand.refImages?.length) {
    next.refImages = await Promise.all(brand.refImages.map(async (r, i) => {
      if (r.path || !r.data) return r;
      const path = `${slug}/ref-${i + 1}.${dataUrlExt(r.data)}`;
      await uploadFile(BUCKETS.brandAssets, path, r.data);
      return { ...r, path };
    }));
  }

  return next;
}
