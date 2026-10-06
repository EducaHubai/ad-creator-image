import { FORMATS } from "./campaignOptions.js";
import { parseCustomDim } from "./formats.js";

// ─── EXPORT ZIP ──────────────────────────────────────────────────────
export async function exportBatchZip(batch, approvedKeys = null) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const allFormats = [
    ...(batch.config?.formats || []).map(f => FORMATS.find(x => x.id === f)?.label || f),
    ...(batch.config?.customDims || []).filter(d => parseCustomDim(d)).map(d => `Custom_${d}`),
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

  // Imágenes compuestas, filtradas por approvedKeys si se pasa. Recién
  // generadas son data URLs PNG; en lotes retomados de la BD son URLs del
  // proxy de storage (webp) — esas se descargan como blob.
  const imgFolder = zip.folder("images");
  await Promise.all((batch.items || []).flatMap((item, itemIdx) => {
    if (!item.composited) return [];
    const safeName = (item.siglas || item.name || "item").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    return Object.entries(item.composited).map(async ([fmtKey, src]) => {
      if (!src) return;
      const cardKey = `${itemIdx}-${fmtKey}`;
      if (approvedKeys && !approvedKeys.has(cardKey)) return;
      const safeFmt = String(fmtKey).replace(/[^a-z0-9]/gi, "_");
      if (src.startsWith("data:")) {
        imgFolder.file(`${safeName}__${safeFmt}.png`, src.split(",")[1], { base64: true });
      } else {
        try {
          const blob = await (await fetch(src)).blob();
          const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
          imgFolder.file(`${safeName}__${safeFmt}.${ext}`, blob);
        } catch (err) {
          console.warn("No se pudo incluir en el ZIP:", src, err.message);
        }
      }
    });
  }));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${batch.name.replace(/[^a-z0-9]/gi, "_")}_ads.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
