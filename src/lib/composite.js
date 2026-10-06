async function loadFontFace(name, src) {
  try {
    const face = new FontFace(name, `url(${src})`);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch { return false; }
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Luminancia media (0-255) de los píxeles NO transparentes de una imagen —
// se usa para saber si un logo es claro u oscuro y detectar cuándo se funde
// con el fondo. null si no se puede medir (canvas contaminado por CORS).
function imageMeanLuminance(img) {
  try {
    const s = 48;
    const c = document.createElement("canvas");
    c.width = s; c.height = s;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0, s, s);
    const { data } = cx.getImageData(0, 0, s, s);
    let sum = 0, n = 0;
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] < 40) continue;
      sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      n++;
    }
    return n ? sum / n : null;
  } catch { return null; }
}

// layoutOverride (solo path replicate — ver analyzeReferenceCreative): fuerza
// la posición/colores del bloque de texto y del logo a los de la referencia
// subida, en vez de la plantilla fija abajo-izquierda con colores de marca.
// undefined ⇒ comportamiento idéntico al de siempre (path scratch).
export async function compositeAd(imageB64, copy, brandConfig, width, height, layoutOverride) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");

  const titleCorner = layoutOverride?.titleCorner || "bottom-left";
  const isTop = titleCorner.startsWith("top");
  const isRight = titleCorner.endsWith("right");

  // Brand colors — layoutOverride pisa los de marca cuando viene de la referencia.
  const colors = brandConfig.colors || {};
  const textOverlay  = layoutOverride?.textColor || colors.text_on_overlay || "#ffffff";
  const ctaBgColor   = layoutOverride?.ctaColor   || colors.accent          || "#963058";
  const ctaFgColor   = colors.cta_text        || "#FFFFFF";

  // Background image — "cover" fit: scale proportionally to fill the canvas
  // (cropping overflow) instead of stretching, since the generated image's
  // aspect ratio rarely matches every target format exactly.
  if (imageB64) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
        resolve();
      };
      img.onerror = resolve;
      img.src = `data:image/png;base64,${imageB64}`;
    });
  } else {
    ctx.fillStyle = colors.primary || "#202020"; ctx.fillRect(0, 0, width, height);
  }

  // (El degradado inferior se pinta más abajo, una vez calculado dónde
  // arranca el bloque de texto — su altura ahora es dinámica.)

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

  // Force-load web fonts (e.g. Exo 2 / Ubuntu via Google Fonts @import) — canvas text
  // ignores @font-face rules until the font has actually been used/loaded once.
  try {
    await Promise.all([
      document.fonts.load(`700 16px ${displayFont}`),
      document.fonts.load(`400 16px ${bodyFontFam}`),
      document.fonts.load(`700 16px ${bodyFontFam}`),
    ]);
  } catch { /* best effort — falls back to system font */ }

  const pad = Math.round(width * 0.07);
  ctx.textBaseline = "top";

  // Parte el texto en líneas por ancho. Nunca recorta: el ajuste se hace
  // bajando el cuerpo de letra en fitLines.
  function computeLines(text, maxW) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Los títulos de curso largos salían cortados con "…" — ahora se reduce el
  // cuerpo de letra hasta que el texto completo cabe en maxLines (con un
  // mínimo legible; si aun así excede, se pintan todas las líneas y el bloque
  // entero se desplaza hacia arriba más abajo).
  function fitLines(text, maxW, baseSize, minSize, maxLines, mkFont) {
    let size = baseSize;
    ctx.font = mkFont(size);
    let lines = computeLines(text, maxW);
    while (lines.length > maxLines && size > minSize) {
      size = Math.max(minSize, size - Math.max(1, Math.round(size * 0.08)));
      ctx.font = mkFont(size);
      lines = computeLines(text, maxW);
    }
    return { size, lines };
  }

  const maxTextW = width - pad * 2;
  const hl = fitLines(copy.headline, maxTextW, Math.round(height * 0.052), Math.round(height * 0.032), 3, s => `bold ${s}px ${displayFont}`);
  const bd = fitLines(copy.body,     maxTextW, Math.round(height * 0.027), Math.round(height * 0.02),  3, s => `${s}px ${bodyFontFam}`);

  const hlLineH = hl.size * 1.25;
  const bdLineH = bd.size * 1.45;
  const hlH = hl.lines.length * hlLineH;
  const bdBlockH = bd.lines.length ? hl.size * 0.5 + bd.lines.length * bdLineH : 0;
  const ctaSize = Math.round(height * 0.03);
  const ctaPadX = ctaSize * 1.2, ctaPadY = ctaSize * 0.65;
  const ctaBoxH = ctaSize + ctaPadY * 2;
  const ctaStr = copy.cta || "";
  const ctaBlockH = ctaStr ? ctaSize * 1.2 + ctaBoxH : 0;

  // El bloque arranca en 0.58h como antes (o pegado arriba si titleCorner
  // dice "top-*"), pero sube/baja lo que haga falta para que headline + body
  // + CTA quepan enteros sobre el margen correspondiente.
  const totalBlockH = hlH + bdBlockH + ctaBlockH;
  const hlStartY = isTop
    ? pad
    : Math.max(height * 0.34, Math.min(height * 0.58, height - pad - totalBlockH));

  // Gradiente de contraste — del lado del texto (abajo por default, arriba si
  // titleCorner es "top-*"), para que el texto siga siendo legible.
  let grad;
  if (isTop) {
    const gradBottom = Math.max(height * 0.67, hlStartY + totalBlockH + hl.size * 1.5);
    grad = ctx.createLinearGradient(0, 0, 0, gradBottom);
    grad.addColorStop(0, "rgba(0,0,0,0.85)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    const gradTop = Math.min(height * 0.33, hlStartY - hl.size * 1.5);
    grad = ctx.createLinearGradient(0, gradTop, 0, height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.85)");
  }
  ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

  // Headline — alineado a la izquierda por default, a la derecha si
  // titleCorner termina en "-right" (cada línea se mide y ancla por separado).
  ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 12;
  ctx.font = `bold ${hl.size}px ${displayFont}`; ctx.fillStyle = textOverlay;
  let textY = hlStartY;
  for (const line of hl.lines) {
    const x = isRight ? width - pad - ctx.measureText(line).width : pad;
    ctx.fillText(line, x, textY); textY += hlLineH;
  }
  const hlEndY = textY;

  // Body
  ctx.font = `${bd.size}px ${bodyFontFam}`; ctx.fillStyle = `${textOverlay}dd`; ctx.shadowBlur = 6;
  const bdStartY = hlEndY + hl.size * 0.5;
  textY = bdStartY;
  for (const line of bd.lines) {
    const x = isRight ? width - pad - ctx.measureText(line).width : pad;
    ctx.fillText(line, x, textY); textY += bdLineH;
  }
  const bdEndY = textY;

  // CTA pill
  ctx.shadowBlur = 0;
  ctx.font = `bold ${ctaSize}px ${bodyFontFam}`;
  const ctaTextW = ctx.measureText(ctaStr).width;
  const ctaBoxW = ctaTextW + ctaPadX * 2;
  const ctaBoxX = isRight ? width - pad - ctaBoxW : pad;
  const ctaBoxY = isTop
    ? bdEndY + ctaSize * 1.2
    : Math.min(bdEndY + ctaSize * 1.2, height - ctaBoxH - pad);
  if (ctaStr) {
    ctx.fillStyle = ctaBgColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ctaBoxX, ctaBoxY, ctaBoxW, ctaBoxH, ctaBoxH / 2);
    else ctx.rect(ctaBoxX, ctaBoxY, ctaBoxW, ctaBoxH);
    ctx.fill();
    ctx.fillStyle = ctaFgColor;
    ctx.fillText(ctaStr, ctaBoxX + ctaPadX, ctaBoxY + ctaPadY);
  }

  // Logo overlay — pick white/dark version by sampling mean luminance under the
  // logo's bbox (spec: L = 0.299R + 0.587G + 0.114B, white logo if L < 140).
  const resolveLogoSrc = asset => asset?.data || (fontServerBase && asset?.name ? `${fontServerBase}/${asset.name}` : null);
  const logoWhiteSrc = resolveLogoSrc(brandConfig.logoWhite);
  const logoDarkSrc  = resolveLogoSrc(brandConfig.logoDark || brandConfig.logoPrimary);
  const refLogoSrc = logoWhiteSrc || logoDarkSrc;

  if (refLogoSrc) {
    const refLogoImg = await loadImage(refLogoSrc);
    if (refLogoImg) {
      const lh = Math.round(height * 0.042);
      const margin = Math.round(width * 0.055);
      const placement = layoutOverride?.logoCorner || brandConfig.adRules?.logoPlacement || "bottom-right";
      const refLw = Math.round(refLogoImg.naturalWidth * lh / Math.max(refLogoImg.naturalHeight, 1));
      const ly = placement.includes("top") ? margin : height - lh - margin;

      // Luminancia del fondo bajo el bbox del logo — se mide SIEMPRE (antes
      // solo con dos versiones de logo), porque también decide la placa de
      // contraste de abajo.
      const sx = Math.max(0, Math.min(Math.round(placement.includes("right") ? width - refLw - margin : margin), width - 1));
      const sy = Math.max(0, Math.min(Math.round(ly), height - 1));
      const sw = Math.max(1, Math.min(Math.round(refLw), width - sx));
      const sh = Math.max(1, Math.min(Math.round(lh), height - sy));
      let bgLuminance = 128;
      try {
        const { data } = ctx.getImageData(sx, sy, sw, sh);
        let sum = 0;
        for (let p = 0; p < data.length; p += 4) sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        bgLuminance = sum / (data.length / 4);
      } catch { /* canvas contaminado (imagen cross-origin) — asumir fondo medio */ }

      let chosenSrc = refLogoSrc;
      if (logoWhiteSrc && logoDarkSrc) chosenSrc = bgLuminance < 140 ? logoWhiteSrc : logoDarkSrc;

      const logoImg = chosenSrc === refLogoSrc ? refLogoImg : await loadImage(chosenSrc);
      if (logoImg) {
        // Medidas con el logo elegido (blanco y oscuro pueden tener proporciones distintas).
        const lw = Math.round(logoImg.naturalWidth * lh / Math.max(logoImg.naturalHeight, 1));
        const lx = placement.includes("right") ? width - lw - margin : margin;

        // Placa de contraste: si el logo se funde con el fondo (p. ej. solo
        // hay logo oscuro y el fondo también es oscuro), se pinta detrás una
        // pastilla del tono opuesto al logo para que siempre sea visible.
        const logoLuminance = imageMeanLuminance(logoImg) ?? (chosenSrc === logoWhiteSrc ? 255 : 40);
        if (Math.abs(logoLuminance - bgLuminance) < 60) {
          const platePad = lh * 0.32;
          ctx.fillStyle = logoLuminance < 128 ? "rgba(255,255,255,0.92)" : "rgba(20,20,20,0.6)";
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(lx - platePad, ly - platePad, lw + platePad * 2, lh + platePad * 2, platePad);
          else ctx.rect(lx - platePad, ly - platePad, lw + platePad * 2, lh + platePad * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 0.92; ctx.drawImage(logoImg, lx, ly, lw, lh); ctx.globalAlpha = 1;
      }
    }
  }

  const qaIssues = qaCheckComposite([
    { label: "headline", x: pad,   y: hlStartY, w: width - pad * 2, h: Math.max(0, hlEndY - hlStartY) },
    { label: "body",     x: pad,   y: bdStartY, w: width - pad * 2, h: Math.max(0, bdEndY - bdStartY) },
    { label: "cta",      x: ctaBoxX, y: ctaBoxY, w: ctaBoxW,         h: ctaBoxH },
  ], width, height);

  return { dataUrl: canvas.toDataURL("image/png"), qaIssues };
}

// Pure bbox check against each text block drawn by compositeAd above —
// doesn't block/reject anything, just flags cards worth a closer look in
// manual review (ImageApprovalGrid). No contrast heuristic: that'd false-
// positive constantly against arbitrary generated photo backgrounds.
function qaCheckComposite(boxes, width, height) {
  const safeMargin = width * 0.03;
  const issues = [];
  for (const box of boxes) {
    if (box.h <= 0) continue;
    if (box.y + box.h > height - safeMargin) issues.push({ type: "overflow", label: box.label });
    if (box.x < safeMargin || box.x + box.w > width - safeMargin) issues.push({ type: "margin", label: box.label });
  }
  return issues;
}
