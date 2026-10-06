import { useState } from "react";
import { ExpandBtn, Lightbox } from "./ui.jsx";
import { FORMATS } from "../lib/campaignOptions.js";
import { customDimToSize } from "../lib/formats.js";
import { useTheme } from "../theme/tokens.js";

// ─── AD PREVIEW GRID ─────────────────────────────────────────────────
// ─── IMAGE APPROVAL GRID ─────────────────────────────────────────────
export function ImageApprovalGrid({ items, approved, onToggle }) {
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
      const qaIssues = item.qaIssues?.[fmtKey] || [];
      cards.push({ itemIdx, item, fmtKey, dataURL, label, fmtSize, cardKey, qaIssues });
    });
  });

  const [lightboxIdx, setLightboxIdx] = useState(null);

  if (cards.length === 0) return null;

  const CARD_H = 180;
  const QA_LABELS = { overflow: "texto se sale del margen inferior", margin: "texto pegado al borde" };

  const lightboxImages = cards.map(({ item, dataURL, label, fmtKey }) => {
    const firstCopy = Array.isArray(item.copies) ? item.copies[0] : (item.copies || {});
    return {
      src: dataURL,
      title: `${item.siglas ? `[${item.siglas}] ` : ""}${item.name}`,
      subtitle: [label, firstCopy.headline].filter(Boolean).join(" · "),
      downloadName: `${(item.siglas || item.name || "ad").replace(/\s/g, "_")}_${fmtKey}.png`,
    };
  });

  return (
    <>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {cards.map(({ item, fmtKey, dataURL, label, fmtSize, cardKey, qaIssues }, cardIdx) => {
        const isApproved = approved.has(cardKey);
        const previewW = Math.max(90, Math.round(CARD_H * (fmtSize.w / fmtSize.h)));
        const firstCopy = Array.isArray(item.copies) ? item.copies[0] : (item.copies || {});
        return (
          <div key={cardKey} onClick={() => onToggle(cardKey)}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = ""}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", background: T.card, borderRadius: 12, overflow: "hidden", border: `2px solid ${isApproved ? T.teal : "#E96A73"}`, boxShadow: isApproved ? "0 0 0 3px rgba(96,191,184,0.15)" : "0 0 0 3px rgba(233,106,115,0.12)", transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s", width: previewW + 2 }}>
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
              {/* QA flag — doesn't block/filter anything, just flags what to check first */}
              {qaIssues.length > 0 && (
                <div title={qaIssues.map(i => QA_LABELS[i.type] || i.type).join(" · ")}
                  style={{ position: "absolute", bottom: 8, left: 8, background: "#F5A623", color: "#202020", fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                  ⚠
                </div>
              )}
              <ExpandBtn onClick={() => setLightboxIdx(cardIdx)} />
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
    {lightboxIdx !== null && (
      <Lightbox images={lightboxImages} index={lightboxIdx}
        onClose={() => setLightboxIdx(null)} onNav={setLightboxIdx} />
    )}
    </>
  );
}
