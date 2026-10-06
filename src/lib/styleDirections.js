import { callOpenAI } from "./llm.js";

// ─── PILOT STYLE DIRECTIONS (pilot → replicate) ────────────────────────
// Used only if the AI brainstorm below fails/is unparseable — a safe,
// generic fallback set, not brand-specific.
export const FALLBACK_STYLE_VARIANTS = [
  { label: "Producto",          description: "Un color de marca fuerte cubre ~65% del encuadre, panel liso vacío en el resto, foto profesional evocando los temas del curso." },
  { label: "Split diagonal",    description: "Mosaico geométrico diagonal con fotos recortadas representando cada tema del curso." },
  { label: "Minimalista",       description: "Fondo sólido oscuro, bloque de color de marca inferior, foto en blanco y negro de alto contraste." },
  { label: "Editorial dúotono", description: "Foto tratada enteramente en dúotono con los colores de marca." },
  { label: "Grid de iconos",    description: "Chips redondeados con iconos representando cada tema del curso, sobre fondo de color de marca." },
];

// Repeated verbatim, last, in every image-generation prompt below — image
// models otherwise regularly ignore a single mild "no text" instruction and
// bake in fake headline/title mockups (observed in production output).
// OJO: nunca decir "pintá un panel/caja vacía ahí" — el modelo lo toma literal
// y hornea un rectángulo de color sólido en la foto (bug real, visto en
// producción: caja negra + caja crema + barra rosa horneadas en la imagen).
// La zona reservada para título/logo tiene que quedar como parte normal de
// la fotografía, sin ninguna forma que la delate.
export const NO_TEXT_IMAGE_RULE = `REGLA ABSOLUTA E INNEGOCIABLE: la imagen NO debe contener NINGÚN texto, letra, palabra, número, logotipo ni tipografía de ningún tipo, en ningún idioma — ni siquiera como mockup, marca de agua, cartel de fondo, o texto ilegible/decorativo. Tampoco debe contener NINGUNA caja, panel, rectángulo, marco, placa ni bloque de color sólido simulando dónde iría el texto — eso también es un resultado inválido. Cualquier zona que en otro momento se describió como "bloque de título" o "área de texto" es SOLO una referencia de posición para código: en la imagen debe verse como parte normal y continua de la fotografía (sin sujeto principal ahí, nada más), jamás como una forma o silueta reconocible. El titular, el copy y el logo se superponen aparte, después, por código — si la imagen generada contiene aunque sea una sola letra, palabra, o caja/panel simulado, es un resultado inválido.`;

function buildGenericImageRules(brand) {
  const colors = brand.colors || {};
  const palette = [colors.primary, colors.secondary, colors.accent].filter(Boolean).join(", ") || "colores neutros de marca";
  return `Paleta: ${palette}. Sin degradados ni formas orgánicas — composición limpia y geométrica. Dejar una esquina completamente limpia y de color plano para superponer el logo.`;
}

// Brainstorms 5 DISTINCT visual style directions for the pilot course, bound
// to the selected brand's own colors/tone/image rules — regenerated every
// batch instead of a fixed list, so the pilot always offers fresh options
// within the brandbook.
export async function generateStyleDirections(brand, course, keywords5, refImageDescriptor = "") {
  const colors = brand.colors || {};
  const palette = [colors.primary, colors.secondary, colors.accent, colors.background].filter(Boolean).join(", ");
  const kw = (keywords5 || []).join(", ") || "formación online";
  const system = `Eres un director de arte publicitario. Genera 5 direcciones de diseño de fondo DISTINTAS entre sí para un anuncio, respetando estrictamente las reglas de marca dadas. Devuelve SOLO JSON válido, sin explicación ni markdown: un array de exactamente 5 objetos {"label":"nombre corto, 2-4 palabras","description":"1-2 frases: composición, tratamiento fotográfico, uso de color/bloques"}.`;
  const user = `## MARCA
Nombre: ${brand.name}
Tono/personalidad: ${[brand.tone, brand.personality].filter(Boolean).join(" · ") || "neutro"}
Paleta: ${palette || "sin paleta definida — usar colores neutros"}
Reglas visuales de marca: ${brand.brandImageStyle || "sin degradados, composición limpia y geométrica"}
${refImageDescriptor ? `Referencia visual aportada por el usuario para este lote — las 5 direcciones deben inspirarse en esta estética, no solo en las reglas de marca: ${refImageDescriptor}` : ""}

## CURSO PILOTO
Título: ${course.name}
Keywords: ${kw}

## INSTRUCCIONES
Cada una de las 5 direcciones debe ser claramente distinta de las otras (varía composición, tratamiento fotográfico, uso de bloques de color, iconografía, etc.) pero todas deben respetar la paleta y las reglas visuales de marca de arriba. No describir texto ni logotipos — se añaden aparte por separado. Reservar siempre una esquina limpia y de color plano para el logo.`;

  const raw = await callOpenAI(system, user, 700);
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 5).map((d, i) => ({ id: `style_${i + 1}`, label: d.label || `Estilo ${i + 1}`, description: d.description || "" }));
    }
  } catch { /* fall through to static fallback below */ }
  return FALLBACK_STYLE_VARIANTS.map((s, i) => ({ id: `style_${i + 1}`, label: s.label, description: s.description }));
}

export function buildStyleVariantPrompt(direction, brand, course, keywords5) {
  const kw = (keywords5 || []).join(", ") || "formación online";
  const commonRules = brand.brandImageStyle || buildGenericImageRules(brand);

  if (direction.id === "replicated") {
    // La imagen de referencia real se manda además de este texto (ver
    // generateImage's referenceImageDataUrl). Framing de "editar pixel-exacto"
    // se probó y falló: la referencia es un anuncio YA TERMINADO con su propio
    // texto/botón horneados en la foto, y pedir "todo igual" hacía que el
    // modelo preservara también ese texto viejo. Agregar una excepción sobre
    // eso lo rompió más (prompt largo, instrucciones que se pisan → el modelo
    // ignoraba la referencia entera). Framing corto de "referencia de ESTILO,
    // no copia literal" en su lugar — un solo mensaje claro, sin parches.
    // commonRules (estilo genérico de marca) queda afuera: la referencia real
    // ya ES el estilo, sumar reglas genéricas solo compite con ella.
    return `Generá una foto publicitaria NUEVA para este curso: "${course.name}". Temas: ${kw}.

La imagen adjunta es el anuncio YA TERMINADO de otro curso (tiene su propio título, texto y botón dibujados). Usala solo como referencia de ESTILO — paleta de colores, iluminación, composición y encuadre — nunca como algo a copiar literalmente pixel por pixel.

La foto que generes debe: (1) verse en el mismo estilo fotográfico que la referencia, (2) mostrar un sujeto fotográfico propio de este curso — distinto al de la referencia, y (3) no contener el título/texto/botón de la referencia ni ningún otro texto (ver regla final).

${direction.description ? `Contexto de estilo de la referencia (paleta, tratamiento, zonas reservadas para título/logo): ${direction.description}\n\n` : ""}${NO_TEXT_IMAGE_RULE}`;
  }

  return `Dirección "${direction.label}": ${direction.description}

Curso: "${course.name}". Temas: ${kw}. El contenido fotográfico (personas, objetos, escena, acción) debe representar visualmente ESTE curso y estos temas específicamente — nunca reutilizar literalmente el sujeto/escena de otra referencia o curso anterior, aunque la composición y paleta se mantengan iguales.

${commonRules}

${NO_TEXT_IMAGE_RULE}`;
}
