import { loadBrandFonts, loadImage } from "./composite.js";
import { NO_TEXT_IMAGE_RULE } from "./styleDirections.js";

// ─── AD TEMPLATE ─────────────────────────────────────────────────────
// Camino "replicate" v2: la referencia se convierte en una plantilla de
// slots (foto, textos, CTA, logo, zonas a conservar) y cada fila del CSV se
// renderiza por código encima de la propia referencia. El modelo de imagen
// solo genera la FOTO del slot — nunca el anuncio entero — así estructura,
// colores y posiciones quedan idénticos por construcción.
//
// Coordenadas en píxeles de la referencia (template.width × template.height).
//
// template = {
//   width, height,
//   referenceData,      // data URL (solo en memoria; no se persiste en config)
//   referencePath,      // ruta en el bucket brand-assets (para retomar)
//   styleDescriptor,    // estilo fotográfico de la referencia, para el prompt
//   slots: [slot],
// }

export const SLOT_TYPES = {
  photo: { label: "Foto",      color: "#2F80ED" },
  text:  { label: "Texto",     color: "#E0457B" },
  cta:   { label: "CTA",       color: "#F2994A" },
  logo:  { label: "Logo",      color: "#27AE60" },
  keep:  { label: "Conservar", color: "#9B51E0" },
};

export const ASPECTS = [
  { key: "1:1", r: 1 }, { key: "4:5", r: 4 / 5 }, { key: "2:3", r: 2 / 3 },
  { key: "9:16", r: 9 / 16 }, { key: "3:2", r: 3 / 2 }, { key: "16:9", r: 16 / 9 },
];

export function nearestAspect(w, h) {
  const r = w / Math.max(h, 1);
  return ASPECTS.reduce((best, a) => Math.abs(Math.log(a.r / r)) < Math.abs(Math.log(best.r / r)) ? a : best).key;
}

let slotSeq = 0;
export function newSlot(type, box, extra = {}) {
  const base = {
    id: `s${Date.now().toString(36)}${(slotSeq++).toString(36)}`,
    type,
    label: SLOT_TYPES[type]?.label || type,
    x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h),
  };
  if (type === "text" || type === "cta") {
    Object.assign(base, {
      content: "",
      sampleText: "",
      font: type === "cta" ? "body" : "display",
      fontFamily: "",
      weight: 700,
      color: "#FFFFFF",
      maxLines: type === "cta" ? 1 : 2,
      maxSize: 0, // 0 = automático según la altura del slot
      minSize: 12,
      lineHeight: 1.15,
      align: type === "cta" ? "center" : "left",
      valign: "middle",
      uppercase: false,
      erase: "auto", // "auto" | "none" | "#hex"
    });
  }
  if (type === "cta") Object.assign(base, { ctaBg: "#963058", ctaRadius: Math.round(box.h * 0.5), padX: Math.round(box.h * 0.45) });
  if (type === "photo") Object.assign(base, {
    prompt: "",
    useStyleReference: true,
    overlay: { type: "none", color: "#000000", opacity: 0.55 }, // none | gradient-bottom | gradient-top | gradient-left | tint
    radius: 0,
  });
  if (type === "logo") Object.assign(base, { mode: "keep" }); // keep | brand
  if (type === "keep") Object.assign(base, { shape: "auto", radius: 0 }); // auto | rect | rounded | ellipse
  return { ...base, ...extra };
}

// "{{Columna}}" → valor de la fila. Columnas inexistentes → "".
export function interpolate(str, row) {
  return String(str || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, col) => {
    const v = row?.[col];
    return v == null ? "" : String(v);
  });
}

export function slotText(slot, row) {
  const raw = row ? interpolate(slot.content, row) : (slot.content && !/\{\{/.test(slot.content) ? slot.content : slot.sampleText);
  const text = String(raw || "").trim();
  return slot.uppercase ? text.toUpperCase() : text;
}

function within(inner, outer) {
  const cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
  return cx >= outer.x && cx <= outer.x + outer.w && cy >= outer.y && cy <= outer.y + outer.h;
}

// ─── COLOR SAMPLING ──────────────────────────────────────────────────
const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
export const rgbToHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function medianColor(data) {
  const r = [], g = [], b = [];
  for (let p = 0; p < data.length; p += 4) { r.push(data[p]); g.push(data[p + 1]); b.push(data[p + 2]); }
  return [median(r), median(g), median(b)];
}

function clampBox(ctx, x, y, w, h) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const x0 = Math.max(0, Math.min(W - 1, Math.round(x)));
  const y0 = Math.max(0, Math.min(H - 1, Math.round(y)));
  return [x0, y0, Math.max(1, Math.min(W - x0, Math.round(w))), Math.max(1, Math.min(H - y0, Math.round(h)))];
}

// Colores de los bordes exteriores (franja de `t` px pegada al slot) — para
// borrar el texto viejo con un degradado que empalma con el fondo real.
export function sampleEdges(ctx, slot) {
  const t = Math.max(2, Math.round(Math.min(slot.w, slot.h) * 0.04));
  const get = (x, y, w, h) => medianColor(ctx.getImageData(...clampBox(ctx, x, y, w, h)).data);
  return {
    top:    get(slot.x, slot.y - t, slot.w, t),
    bottom: get(slot.x, slot.y + slot.h, slot.w, t),
    left:   get(slot.x - t, slot.y, t, slot.h),
    right:  get(slot.x + slot.w, slot.y, t, slot.h),
  };
}

// Color dominante del interior (p. ej. el fondo de un botón CTA): mediana del
// núcleo central del slot.
export function sampleInner(ctx, slot) {
  const insetX = slot.w * 0.08, insetY = slot.h * 0.15;
  return medianColor(ctx.getImageData(...clampBox(ctx, slot.x + insetX, slot.y + insetY, slot.w - insetX * 2, slot.h - insetY * 2)).data);
}

// Color del texto dentro del slot: los píxeles que más se alejan del fondo.
export function sampleTextColor(ctx, slot, bg) {
  const { data } = ctx.getImageData(...clampBox(ctx, slot.x, slot.y, slot.w, slot.h));
  const px = [];
  for (let p = 0; p < data.length; p += 16) { // 1 de cada 4 píxeles basta
    const d = Math.abs(data[p] - bg[0]) + Math.abs(data[p + 1] - bg[1]) + Math.abs(data[p + 2] - bg[2]);
    px.push([d, data[p], data[p + 1], data[p + 2]]);
  }
  px.sort((a, b) => b[0] - a[0]);
  // Solo el núcleo de las letras (5% más distinto) y mediana, no promedio: el
  // antialias de los bordes mezcla texto y fondo y ensucia el color.
  const top = px.slice(0, Math.max(1, Math.round(px.length * 0.05)));
  if (top[0][0] < 40) return null; // sin contraste: probablemente no hay texto
  return [1, 2, 3].map(i => median(top.map(p => p[i])));
}

function avgColor(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

// Rellena valores de color razonables para un slot recién creado/movido,
// leyendo la referencia. No pisa lo que el usuario ya ajustó a mano salvo
// que `force` sea true.
export function autoColorsForSlot(refCanvas, slot) {
  const ctx = refCanvas.getContext("2d", { willReadFrequently: true });
  const edges = sampleEdges(ctx, slot);
  const ring = avgColor(avgColor(edges.top, edges.bottom), avgColor(edges.left, edges.right));
  if (slot.type === "text") {
    const c = sampleTextColor(ctx, slot, ring);
    return c ? { color: rgbToHex(c) } : {};
  }
  if (slot.type === "cta") {
    const bg = sampleInner(ctx, slot);
    const fg = sampleTextColor(ctx, slot, bg);
    return { ctaBg: rgbToHex(bg), ...(fg ? { color: rgbToHex(fg) } : {}) };
  }
  return {};
}

export function imageToCanvas(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);
  return c;
}

// ─── TEXT FITTING ────────────────────────────────────────────────────
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Busca el cuerpo más grande (≤ maxSize) con el que el texto entra en el
// ancho, en ≤ maxLines líneas y en la altura del slot. Si ni con minSize
// entra, devuelve minSize con overflow=true (la QA lo marca).
export function fitText(ctx, text, { w, h }, { family, weight, maxSize, minSize, maxLines, lineHeight }) {
  const mk = s => `${weight} ${s}px ${family}`;
  const top = Math.max(minSize, Math.floor(maxSize || (h / Math.max(1, maxLines)) / lineHeight));
  const fits = s => {
    ctx.font = mk(s);
    const lines = wrap(ctx, text, w);
    const widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
    return { ok: lines.length <= maxLines && lines.length * s * lineHeight <= h * 1.02 && widest <= w * 1.01, lines };
  };
  let lo = minSize, hi = top, best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const r = fits(mid);
    if (r.ok) { best = { size: mid, lines: r.lines }; lo = mid + 1; } else hi = mid - 1;
  }
  if (best) return { ...best, overflow: false, font: mk(best.size) };
  const r = fits(minSize);
  return { size: minSize, lines: r.lines, overflow: true, font: mk(minSize) };
}

const googleFontsRequested = new Set();
async function ensureGoogleFont(name) {
  if (!name || googleFontsRequested.has(name)) return;
  googleFontsRequested.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
  await new Promise(r => { link.onload = r; link.onerror = r; });
}

async function slotFamily(slot, fonts) {
  if (slot.fontFamily) {
    await ensureGoogleFont(slot.fontFamily);
    const fam = `"${slot.fontFamily}", system-ui, sans-serif`;
    try { await document.fonts.load(`${slot.weight} 16px ${fam}`); } catch { /* fallback */ }
    return fam;
  }
  return slot.font === "body" ? fonts.body : fonts.display;
}

// ─── DRAWING ─────────────────────────────────────────────────────────
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  else ctx.rect(x, y, w, h);
}

function drawCover(ctx, img, box, radius) {
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.save();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, radius || 0);
  ctx.clip();
  ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawOverlay(ctx, slot) {
  const o = slot.overlay || {};
  if (!o.type || o.type === "none") return;
  const [r, g, b] = [1, 3, 5].map(i => parseInt((o.color || "#000000").slice(i, i + 2), 16));
  const solid = `rgba(${r},${g},${b},${o.opacity ?? 0.55})`;
  const clear = `rgba(${r},${g},${b},0)`;
  let fill = solid;
  if (o.type.startsWith("gradient")) {
    const { x, y, w, h } = slot;
    const grad = o.type === "gradient-top" ? ctx.createLinearGradient(0, y, 0, y + h)
      : o.type === "gradient-left" ? ctx.createLinearGradient(x, 0, x + w, 0)
      : ctx.createLinearGradient(0, y + h, 0, y);
    grad.addColorStop(0, solid);
    grad.addColorStop(0.65, clear);
    fill = grad;
  }
  ctx.save();
  roundRectPath(ctx, slot.x, slot.y, slot.w, slot.h, slot.radius || 0);
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
}

// ─── KEEP MASKS ──────────────────────────────────────────────────────
// Una zona "conservar" casi nunca es un rectángulo exacto: badges con
// esquinas redondeadas, círculos, formas montadas sobre el borde de la foto.
// Copiar la caja entera re-estampa también lo que hay detrás (la foto vieja
// asomando por las esquinas). La máscara separa la forma de su fondo:
// colores dominantes del centro de la caja → píxeles de esos colores
// conectados al centro → se rellenan los huecos (texto o iconos dentro del
// badge). Si el centro no es de color plano (p. ej. una foto), devuelve null
// y se conserva la caja entera.
const KEEP_TOL = 36;

// `core` = zona de la que se toma el color de la forma (por defecto, la mitad
// central de la imagen).
export function keepMask({ data, width: w, height: h }, core = { x0: w * 0.25, y0: h * 0.25, x1: w * 0.75, y1: h * 0.75 }) {
  const n = w * h;
  if (n < 16) return null;
  const cx0 = Math.floor(core.x0), cy0 = Math.floor(core.y0), cx1 = Math.ceil(core.x1), cy1 = Math.ceil(core.y1);
  // Paleta: colores (cuantizados a 4 bits por canal) que ocupan ≥10% del
  // núcleo.
  const buckets = new Map();
  let coreCount = 0;
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const p = (y * w + x) * 4;
      const key = (data[p] >> 4) << 8 | (data[p + 1] >> 4) << 4 | (data[p + 2] >> 4);
      const b = buckets.get(key) || { c: 0, r: 0, g: 0, b: 0 };
      b.c++; b.r += data[p]; b.g += data[p + 1]; b.b += data[p + 2];
      buckets.set(key, b);
      coreCount++;
    }
  }
  const palette = [...buckets.values()].filter(b => b.c >= coreCount * 0.1)
    .sort((a, b) => b.c - a.c).slice(0, 4);
  if (palette.reduce((s, b) => s + b.c, 0) < coreCount * 0.5) return null;
  const colors = palette.map(b => [b.r / b.c, b.g / b.c, b.b / b.c]);
  const dist = i => {
    let best = Infinity;
    for (const c of colors) {
      const d = (data[i * 4] - c[0]) ** 2 + (data[i * 4 + 1] - c[1]) ** 2 + (data[i * 4 + 2] - c[2]) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  // Píxeles del color de la forma conectados al núcleo.
  const shape = new Uint8Array(n);
  const stack = [];
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const i = y * w + x;
      if (!shape[i] && dist(i) <= KEEP_TOL) { shape[i] = 1; stack.push(i); }
    }
  }
  const flood = (mark, ok) => {
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < n && !mark[j] && ok(j)) { mark[j] = 1; stack.push(j); }
      }
    }
  };
  flood(shape, j => dist(j) <= KEEP_TOL);

  // Huecos: lo que no es forma y no se alcanza desde el borde de la caja
  // (letras, iconos) pertenece al badge.
  const outside = new Uint8Array(n);
  const seed = i => { if (!shape[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  flood(outside, j => !shape[j]);

  // Alfa: opaco dentro; el borde exterior (antialias de la forma mezclado
  // con el fondo viejo) se desvanece según lo parecido que sea a la forma.
  const alpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    if (!outside[i]) { alpha[i] = 255; continue; }
    const x = i % w;
    const touches = (x > 0 && !outside[i - 1]) || (x < w - 1 && !outside[i + 1]) || (i >= w && !outside[i - w]) || (i + w < n && !outside[i + w]);
    if (touches) alpha[i] = Math.round(255 * Math.max(0, 1 - (dist(i) - KEEP_TOL) / (KEEP_TOL * 2)));
  }
  return alpha;
}

// Re-estampa una zona "conservar" de la referencia según su forma.
function drawKeep(ctx, refCanvas, refCtx, s) {
  const [x, y, w, h] = clampBox(refCtx, s.x, s.y, s.w, s.h);
  const shape = s.shape || "auto";
  if (shape === "rounded" || shape === "ellipse") {
    ctx.save();
    if (shape === "ellipse") { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
    else roundRectPath(ctx, x, y, w, h, s.radius || 0);
    ctx.clip();
    ctx.drawImage(refCanvas, x, y, w, h, x, y, w, h);
    ctx.restore();
    return;
  }
  if (shape === "rect") { ctx.drawImage(refCanvas, x, y, w, h, x, y, w, h); return; }
  // Automática: se busca la forma también un poco fuera de la caja — si la
  // caja quedó justa, la foto nueva le comería el borde a la forma.
  const m = Math.max(4, Math.round(Math.min(w, h) * 0.12));
  const [ex, ey, ew, eh] = clampBox(refCtx, x - m, y - m, w + m * 2, h + m * 2);
  const img = refCtx.getImageData(ex, ey, ew, eh);
  const alpha = keepMask(img, { x0: x - ex + w * 0.25, y0: y - ey + h * 0.25, x1: x - ex + w * 0.75, y1: y - ey + h * 0.75 });
  if (!alpha) { ctx.drawImage(refCanvas, x, y, w, h, x, y, w, h); return; }
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
  const tmp = document.createElement("canvas");
  tmp.width = ew; tmp.height = eh;
  tmp.getContext("2d").putImageData(img, 0, 0);
  ctx.drawImage(tmp, ex, ey);
}

// ─── ERASE ───────────────────────────────────────────────────────────
// Las cajas de texto suelen quedar justas sobre las mayúsculas: tildes (Á,
// É), diéresis y descendentes (g, p, ,) se quedan fuera y, si solo se borra
// la caja, sobreviven flotando junto al texto nuevo. Cada lado se agranda
// mientras haya "tinta" (píxeles que no son el fondo) cerca, tolerando el
// hueco entre la tilde y su letra, sin invadir otros slots.
function inkBox(refCtx, slot, obstacles) {
  const unit = Math.min(slot.h, (slot.maxSize || slot.h) * (slot.lineHeight || 1.15));
  const reach = Math.max(3, Math.round(unit * 0.5));
  const gap = Math.max(2, Math.round(unit * 0.2));
  const W = refCtx.canvas.width, H = refCtx.canvas.height;
  const bg = sampleEdges(refCtx, slot);
  const rx = Math.max(0, slot.x - reach), ry = Math.max(0, slot.y - reach);
  const rw = Math.min(W, slot.x + slot.w + reach) - rx, rh = Math.min(H, slot.y + slot.h + reach) - ry;
  if (rw <= 0 || rh <= 0) return slot;
  const { data } = refCtx.getImageData(rx, ry, rw, rh);
  const ink = (x, y, c) => {
    const p = ((y - ry) * rw + (x - rx)) * 4;
    return Math.abs(data[p] - c[0]) + Math.abs(data[p + 1] - c[1]) + Math.abs(data[p + 2] - c[2]) > 96;
  };
  const blocked = (x0, x1, y0, y1) => obstacles.some(o => o.x < x1 && o.x + o.w > x0 && o.y < y1 && o.y + o.h > y0);
  // Avanza desde `from` hacia `to` línea a línea; devuelve la última con tinta.
  const grow = (from, to, lineHasInk, lineBlocked) => {
    const step = to > from ? 1 : -1;
    let last = from - step;
    for (let v = from; v !== to + step; v += step) {
      if (lineBlocked(v)) break;
      if (lineHasInk(v)) last = v;
      else if (Math.abs(v - last) > gap) break;
    }
    return last;
  };
  const x0 = Math.max(rx, slot.x), x1 = Math.min(rx + rw, slot.x + slot.w);
  const rowInk = c => y => { for (let x = x0; x < x1; x++) if (ink(x, y, c)) return true; return false; };
  // top/left inclusivos; bottom/right exclusivos.
  const top = grow(slot.y - 1, ry, rowInk(bg.top), y => blocked(x0, x1, y, y + 1));
  const bottom = grow(slot.y + slot.h, ry + rh - 1, rowInk(bg.bottom), y => blocked(x0, x1, y, y + 1)) + 1;
  const colInk = c => x => { for (let y = top; y < bottom; y++) if (ink(x, y, c)) return true; return false; };
  const left = grow(slot.x - 1, rx, colInk(bg.left), x => blocked(x, x + 1, top, bottom));
  const right = grow(slot.x + slot.w, rx + rw - 1, colInk(bg.right), x => blocked(x, x + 1, top, bottom)) + 1;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// Tapa el contenido viejo del slot (texto/botón/logo de la referencia) con un
// degradado vertical entre los colores de borde superior e inferior — empalma
// con fondos lisos y con degradados suaves. Se agranda un poco para cubrir
// el antialias de las letras viejas.
function eraseSlot(ctx, refCtx, slot, obstacles = null) {
  const pad = Math.round(Math.min(slot.w, slot.h) * 0.06);
  const area = obstacles ? inkBox(refCtx, slot, obstacles) : slot;
  const box = { x: area.x - pad, y: area.y - pad, w: area.w + pad * 2, h: area.h + pad * 2 };
  if (slot.erase && slot.erase.startsWith("#")) {
    ctx.fillStyle = slot.erase;
  } else {
    const e = sampleEdges(refCtx, box);
    const grad = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    grad.addColorStop(0, rgbToHex(avgColor(e.top, avgColor(e.left, e.right))));
    grad.addColorStop(1, rgbToHex(avgColor(e.bottom, avgColor(e.left, e.right))));
    ctx.fillStyle = grad;
  }
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

function drawLines(ctx, fit, slot, box, color) {
  const lh = fit.size * slot.lineHeight;
  const blockH = fit.lines.length * lh;
  let y = slot.valign === "top" ? box.y : slot.valign === "bottom" ? box.y + box.h - blockH : box.y + (box.h - blockH) / 2;
  ctx.font = fit.font;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  for (const line of fit.lines) {
    const lw = ctx.measureText(line).width;
    const x = slot.align === "center" ? box.x + (box.w - lw) / 2 : slot.align === "right" ? box.x + box.w - lw : box.x;
    // Compensa el hueco superior del em-box para centrar visualmente.
    ctx.fillText(line, x, y + (lh - fit.size) / 2);
    y += lh;
  }
}

// row: fila del CSV (null = textos de muestra de la propia referencia).
// photoSrc: data URL / URL de la foto nueva (null = se conserva la de la referencia).
// Devuelve { dataUrl, qaIssues, values } — values = textos efectivamente pintados.
export async function renderTemplate(template, { row = null, photoSrc = null, brand = {}, referenceImg = null } = {}) {
  const ref = referenceImg || await loadImage(template.referenceData);
  if (!ref) throw new Error("No se pudo cargar la imagen de referencia de la plantilla");
  const W = template.width, H = template.height;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(ref, 0, 0, W, H);
  const refCanvas = imageToCanvas(ref);
  const refCtx = refCanvas.getContext("2d", { willReadFrequently: true });

  const fonts = await loadBrandFonts(brand);
  const slots = template.slots || [];
  const photos = slots.filter(s => s.type === "photo");
  const qaIssues = [];
  const values = {};

  // 1) Foto nueva + overlay de contraste. Sin foto nueva (vista previa) se usa
  //    la foto de la propia referencia con sus textos viejos tapados.
  if (!photoSrc && photos.length) photoSrc = await photoStyleReference(template, photos[0], ref, 2048);
  const photoImg = photoSrc ? await loadImage(photoSrc) : null;
  for (const s of photos) {
    if (photoImg) drawCover(ctx, photoImg, s, s.radius);
    drawOverlay(ctx, s);
  }

  // 2) Zonas "conservar": se re-estampan los píxeles de la referencia
  //    (badges, stickers, formas que la foto nueva habría tapado), recortados
  //    a su forma para no traer de vuelta la foto vieja que tienen detrás.
  for (const s of slots.filter(s => s.type === "keep")) drawKeep(ctx, refCanvas, refCtx, s);

  // 3) Textos, CTA y logo.
  for (const s of slots) {
    if (s.type === "text" || s.type === "cta") {
      const text = slotText(s, row);
      values[s.id] = text;
      const overPhoto = photos.some(p => within(s, p));
      if (s.erase !== "none" && !overPhoto) eraseSlot(ctx, refCtx, s, slots.filter(o => o !== s));
      if (!text) continue;
      const family = await slotFamily(s, fonts);
      if (s.type === "cta") {
        // El botón conserva el tamaño exacto de la referencia; si el texto
        // nuevo es más largo, se achica el cuerpo de letra.
        const padX = s.padX ?? Math.round(s.h * 0.45);
        const fit = fitText(ctx, text, { w: s.w - padX * 2, h: s.h * 0.42 }, { family, weight: s.weight, maxSize: s.maxSize, minSize: s.minSize, maxLines: 1, lineHeight: 1 });
        ctx.fillStyle = s.ctaBg;
        roundRectPath(ctx, s.x, s.y, s.w, s.h, s.ctaRadius);
        ctx.fill();
        const inner = { x: s.x + padX, y: s.y, w: s.w - padX * 2, h: s.h };
        drawLines(ctx, fit, { ...s, valign: "middle", lineHeight: 1 }, inner, s.color);
        if (fit.overflow) qaIssues.push({ type: "overflow", label: s.label });
      } else {
        const fit = fitText(ctx, text, s, { family, weight: s.weight, maxSize: s.maxSize, minSize: s.minSize, maxLines: s.maxLines, lineHeight: s.lineHeight });
        drawLines(ctx, fit, s, s, s.color);
        if (fit.overflow) qaIssues.push({ type: "overflow", label: s.label });
      }
    } else if (s.type === "logo" && s.mode === "brand") {
      const src = brand.logoWhite?.data || brand.logoPrimary?.data || brand.logoDark?.data;
      const logo = src ? await loadImage(src) : null;
      if (!logo) continue;
      const overPhoto = photos.some(p => within(s, p));
      if (!overPhoto) eraseSlot(ctx, refCtx, s);
      const scale = Math.min(s.w / logo.naturalWidth, s.h / logo.naturalHeight);
      const lw = logo.naturalWidth * scale, lh = logo.naturalHeight * scale;
      ctx.drawImage(logo, s.x + (s.w - lw) / 2, s.y + (s.h - lh) / 2, lw, lh);
    }
  }

  return { dataUrl: canvas.toDataURL("image/png"), qaIssues, values };
}

// ─── PHOTO PROMPT ────────────────────────────────────────────────────
function zoneName(rel) {
  const cx = rel.x + rel.w / 2, cy = rel.y + rel.h / 2;
  const v = cy < 0.36 ? "top" : cy > 0.64 ? "bottom" : "middle";
  const h = cx < 0.36 ? "left" : cx > 0.64 ? "right" : "center";
  return v === "middle" && h === "center" ? "center" : `${v}-${h}`.replace("middle-", "").replace("-center", "");
}

// Prompt de la foto para una fila: tema (plantilla del slot con {{columnas}})
// + estilo de la referencia + zonas donde irá texto encima (deben quedar
// tranquilas, sin el sujeto) + la regla de "sin texto".
export function buildPhotoPrompt(template, photoSlot, row, { withStyleRef = false } = {}) {
  const subject = interpolate(photoSlot.prompt, row).trim();
  const overlaid = (template.slots || [])
    .filter(s => (s.type === "text" || s.type === "cta" || s.type === "logo") && within(s, photoSlot))
    .map(s => zoneName({ x: (s.x - photoSlot.x) / photoSlot.w, y: (s.y - photoSlot.y) / photoSlot.h, w: s.w / photoSlot.w, h: s.h / photoSlot.h }));
  const calm = [...new Set(overlaid)];
  return [
    `Fotografía publicitaria profesional. Tema / sujeto: ${subject || "una escena relacionada con el curso"}.`,
    withStyleRef ? "La imagen adjunta es SOLO una referencia de estilo (iluminación, paleta, tratamiento, encuadre y tipo de plano). Generá una fotografía NUEVA con un sujeto propio de este tema: no copies las personas, objetos ni la escena de la referencia, y no reproduzcas ninguna mancha o zona borrosa que veas en ella." : "",
    template.styleDescriptor ? `Estilo fotográfico a igualar (iluminación, paleta, tratamiento, encuadre — NO el sujeto): ${template.styleDescriptor}` : "",
    calm.length ? `Composición: el sujeto principal NO debe ocupar estas zonas, que deben quedar limpias y de poco detalle porque llevarán texto encima: ${calm.join(", ")}.` : "",
    NO_TEXT_IMAGE_RULE,
  ].filter(Boolean).join("\n\n");
}

// Recorte de la foto de la referencia con los textos que tenga encima
// tapados — se manda como guía de estilo SIN letras que el modelo copie.
export async function photoStyleReference(template, photoSlot, referenceImg, maxDim = 768) {
  const ref = referenceImg || await loadImage(template.referenceData);
  if (!ref) return null;
  const refCanvas = imageToCanvas(ref);
  const refCtx = refCanvas.getContext("2d", { willReadFrequently: true });
  const scale = Math.min(1, maxDim / Math.max(photoSlot.w, photoSlot.h));
  const c = document.createElement("canvas");
  c.width = Math.round(photoSlot.w * scale); c.height = Math.round(photoSlot.h * scale);
  const ctx = c.getContext("2d");
  ctx.drawImage(refCanvas, photoSlot.x, photoSlot.y, photoSlot.w, photoSlot.h, 0, 0, c.width, c.height);
  for (const s of template.slots.filter(s => s.type !== "photo" && s.type !== "keep" && within(s, photoSlot))) {
    const local = { x: (s.x - photoSlot.x) * scale, y: (s.y - photoSlot.y) * scale, w: s.w * scale, h: s.h * scale };
    const e = sampleEdges(refCtx, s);
    ctx.fillStyle = rgbToHex(avgColor(avgColor(e.top, e.bottom), avgColor(e.left, e.right)));
    ctx.filter = "blur(6px)";
    ctx.fillRect(local.x - 6, local.y - 6, local.w + 12, local.h + 12);
    ctx.filter = "none";
  }
  return c.toDataURL("image/jpeg", 0.85);
}

// Slots de texto ordenados por relevancia: el rol detectado manda (titular
// primero, etiquetas/precios al final) y después el cuerpo de letra.
const ROLE_RANK = { headline: 3, subheadline: 2, body: 1, other: 0, price: -1, tag: -2 };
export function textSlotsByProminence(template) {
  const size = s => s.maxSize || s.h / Math.max(1, s.maxLines);
  return (template.slots || []).filter(s => s.type === "text")
    .sort((a, b) => (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0) || size(b) - size(a));
}

// Sugerencia de mapeo columna → slot a partir de los nombres de columna.
export function autoMap(template, headers) {
  const find = re => headers.find(h => re.test(h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()));
  const titleCol = find(/titul|title|nombre|name|curso|course|headline/);
  const bodyCol = find(/desc|body|texto|subtit|copy|benefic/);
  const ctaCol = find(/cta|boton|button|accion/);
  const kwCol = find(/keyword|tema|topic|tag/);
  const priceCol = find(/precio|price/);
  const used = new Set();
  const pick = col => { if (col && !used.has(col)) { used.add(col); return `{{${col}}}`; } return null; };
  const slots = template.slots.map(s => ({ ...s }));
  // Título y descripción van a sus columnas; etiquetas ("NUEVO") y demás
  // textos quedan fijos con el texto original, salvo precios con su columna.
  const texts = textSlotsByProminence({ slots });
  const isFixed = s => s.role === "tag" || s.role === "price";
  const title = texts.find(s => !isFixed(s));
  const body = texts.find(s => s !== title && !isFixed(s));
  for (const s of texts) {
    if (s.content) continue;
    s.content = (s === title ? pick(titleCol) : s === body ? pick(bodyCol) : null)
      || (s.role === "price" || /\d+\s*[€$]|€|\$/.test(s.sampleText || "") ? pick(priceCol) : null)
      || s.sampleText || "";
  }
  for (const s of slots) {
    if (s.type === "cta" && !s.content) s.content = pick(ctaCol) || s.sampleText || "Saber más";
    if (s.type === "photo" && !s.prompt) {
      s.prompt = [titleCol ? `{{${titleCol}}}` : "", kwCol ? `temas: {{${kwCol}}}` : ""].filter(Boolean).join(" — ");
    }
  }
  return { ...template, slots, titleColumn: titleCol || headers[0] };
}
