---
name: educa-edtech-design
description: Use this skill to generate well-branded interfaces and assets for EDUCA EDTECH Group — the international education group behind Euroinnova, INESEM, Educa Business School, Educa University, and 20+ educational brands. Produces presentations (16:9), landing pages, web/dashboard UIs, and visual artifacts (posters, social, infographics, one-pagers). Contains the brand book, color tokens, Rubik + Lato fonts, master logos, UI kit components, and slide templates.
user-invocable: true
---

Read `README.md` for the full brand context, content fundamentals, and visual foundations.

Key files in this skill:

- `colors_and_type.css` — drop-in design tokens (colors, signature gradient, type scale, spacing, radii, shadows, motion). Includes `@font-face` declarations for Rubik + Lato.
- `fonts/` — Rubik (300/400/500/700) and Lato (300/400/700 + italics) TTFs.
- `assets/` — Master logos: horizontal (priority), square, negative variants, "By EDUCA EDTECH Group" endorsement marks.
- `slides/` — 16:9 slide templates: cover, content, section divider, big-stat, closing.
- `ui_kits/landing/` — Marketing landing page kit with hero, values, institutions, CTA.
- `ui_kits/dashboard/` — EDUCA LXP-style learning dashboard kit.
- `preview/` — Per-token preview cards.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out of this skill and create static HTML files for the user to view. If working on production code, copy the assets and read the rules in README.md to become an expert in designing with the EDUCA EDTECH Group brand.

If the user invokes this skill without other guidance, ask them what they want to build, ask focused questions about audience (B2C student / B2B institution / internal), tone (formal corporate / warmer marketing), and surface (slide / web / app / artifact), then act as an expert designer producing HTML artifacts or production code.

**Non-negotiables** when designing:
- Brand name is exactly `EDUCA EDTECH Group` — never `Educa Edtech Group`, never `EDUCA Edtech`.
- Use `#202020` for "black" — never `#000000`.
- The signature gradient must read teal → blue → blue → burdeos → coral, never rearranged.
- Type system is Rubik (display) + Lato (body) only. No other families.
- Logos: never rotate, distort, partially recolor, separate isologo from wordmark, or use outline-only.
- No emoji.
