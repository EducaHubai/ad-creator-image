import { FORMATS } from "./campaignOptions.js";
import { FORMAT_SIZES, parseCustomDim } from "./formats.js";
import { nearestAspect } from "./template.js";

// ─── TEMPLATE SETS ───────────────────────────────────────────────────
// Camino plantilla con varias plantillas por resolución (como el ADN de marca
// de course-cover-engine: la casilla decide qué se genera, el click abre la
// resolución para subir y editar sus plantillas).
//
// sets = { [resolutionKey]: [template] }   resolutionKey = id de FORMATS o "WxH"
// Cada fila del CSV genera un anuncio por plantilla de cada resolución marcada.

export function resolutionInfo(key) {
  const fmt = FORMATS.find(f => f.id === key);
  if (fmt) return { key, label: fmt.label, w: FORMAT_SIZES[key].w, h: FORMAT_SIZES[key].h };
  const d = parseCustomDim(key);
  return d ? { key, label: "Personalizado", w: d.w, h: d.h } : null;
}

// Proporción de la imagen subida vs. la de la resolución: igual → se escala;
// distinta → se recorta al centro (y el editor avisa).
export function sizeMismatch(template, res) {
  if (!res || (template.width === res.w && template.height === res.h)) return null;
  const sameAspect = Math.abs(Math.log((template.width / template.height) / (res.w / res.h))) < 0.01;
  return sameAspect ? "scale" : "crop";
}

// Plantillas a generar, en orden de resolución, con su etiqueta de salida
// ("1080x1080-P2"): es la clave de `composited` y del nombre de archivo.
export function flattenTemplates(sets, selectedKeys) {
  const out = [];
  for (const key of selectedKeys) {
    const res = resolutionInfo(key);
    if (!res) continue;
    (sets[key] || []).forEach((t, i) => out.push({ ...t, resolutionKey: key, outW: res.w, outH: res.h, outLabel: `${res.w}x${res.h}-P${i + 1}` }));
  }
  return out;
}

// Con `share`, las plantillas cuya foto tiene la misma proporción reciben la
// misma foto generada para una fila (menos imágenes, y las plantillas se
// comparan con la misma foto); sin él, una foto por plantilla.
export function photoKey(template, share) {
  const p = template.slots.find(s => s.type === "photo");
  if (!p) return null;
  return share ? nearestAspect(p.w, p.h) : template.id;
}

export function countPhotosPerRow(templates, share) {
  return new Set(templates.map(t => photoKey(t, share)).filter(Boolean)).size;
}

// Problemas que impiden avanzar del paso de plantillas (texto para el usuario).
export function templateSetsIssues(cfg) {
  if (!cfg.tplSelected.length) return "Marcá al menos una resolución.";
  for (const key of cfg.tplSelected) {
    const res = resolutionInfo(key);
    const list = cfg.templateSets[key] || [];
    if (!list.length) return `${res.w}×${res.h} está marcada pero no tiene plantillas.`;
    if (list.some(t => t._detecting)) return "Esperando la detección con IA…";
    const i = list.findIndex(t => !t.slots.length);
    if (i >= 0) return `${res.w}×${res.h} · P${i + 1} no tiene cajas — marcá al menos un elemento.`;
  }
  return "";
}

// Mapeo CSV agrupado por rol: un campo para todos los títulos, otro para
// todos los CTA, etc. — con 16 plantillas no se mapea plantilla a plantilla.
export const SLOT_GROUPS = [
  ["photo", "Foto — tema de la foto generada"],
  ["headline", "Título"],
  ["subheadline", "Subtítulo"],
  ["body", "Descripción"],
  ["price", "Precio"],
  ["tag", "Etiqueta"],
  ["other", "Otros textos"],
  ["cta", "CTA"],
];

export function slotGroup(slot) {
  if (slot.type === "photo" || slot.type === "cta") return slot.type;
  if (slot.type === "text") return SLOT_GROUPS.some(([k]) => k === slot.role) ? slot.role : "other";
  return null;
}
