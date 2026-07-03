# EDUCA EDTECH Group — Design System

> *"Together our future is bright."*

A design system for **EDUCA EDTECH Group**, the international education group behind 20+ educational brands (Euroinnova, INESEM, INEAF, ESIBE, ENALDE, Educa Business School, Fundación Euroinnova, Educa University, Edtech Platforms, Editoriales, etc.) spanning higher education, continuous learning, and public-exam preparation. The group's mission is to democratize access to online education worldwide using its own AI/Machine-Learning platform (EDUCA LXP).

This system is intended to produce: **16:9 presentations, landing pages, web applications & dashboards, and visual artifacts** (posters, social, infographics, one-pagers).

---

## Sources

The materials below were provided by the client and stored in `uploads/`. Extracted text & assets live under `scraps/` and `assets/`.

| Source | Purpose | Notes |
|---|---|---|
| `Brand Book EDUCA EDTECH Group.pdf` | Brand philosophy, values, logo rules, color palette, typography | Spanish — extracted to `scraps/brand_book.txt` |
| `UI Kit EDUCA EDTECH Group.pdf` | Buttons, inputs, tabs, icon system, type ramp | Visual reference — extracted summary in `scraps/ui_kit.txt` |
| `Manual integración de nuevas marcas.pdf` | Co-branding rules ("By EDUCA EDTECH Group") | `scraps/manual_integracion.pdf` |
| `00. Presentación Corporativa v4 2025.pdf` | Corporate deck — content, tone, slide layout reference | `scraps/corp_pres.pdf` + `corp_pres.txt` |
| `EDUCA EDTECH Group HORIZONTAL.svg` (+negative, +cuadrado) | Master logos | Copied to `assets/logo-*.svg` |
| `Logo_By EDUCA EDTECH Group_*.svg` | Co-brand endorsement marks | Copied to `assets/by-educa-*.svg` |
| `Lato,Rubik.zip` + `Rubik.zip` | Brand typefaces | Extracted to `fonts/` (Rubik 300/400/500/700, Lato 300/400/700 + italics) |

---

## Brand essence

**Name** — always written `EDUCA EDTECH Group` (caps on EDUCA + EDTECH, Title-case on Group). Never `Educa Edtech Group`, never `EDUCA Edtech`. In the third person, "el grupo" is fine.

**Slogan** — *Together our future is bright.*

**Descriptor** — *El grupo educativo que lleva la educación online a todos los rincones del mundo.*

**Values** — Responsibility · Honesty · Excellence · Respect.

**Personality** — professional, honest, rigorous, warm, international, technological. The voice is corporate but human: it talks about "el alumnado" (the student body) with care, names its institutions with pride, and grounds technology talk in tangible educational outcomes.

---

## Content fundamentals

### Tone

Voice is **professional, warm, and quietly confident**. The brand speaks with the authority of 20+ years of experience but never lectures. It frames technology — AI, Machine Learning, NLP, Deep Learning — as *tools that serve the student*, never as the point.

Copy is bilingual-ready: Spanish is the primary language (the brand book, deck, and UI strings are in Spanish), English is used for the slogan and outward-facing claims. When writing English copy, lean slightly formal; never colloquial.

### Voice rules

- **Third person plural for the brand:** *"Creamos experiencias educativas"*, *"Ofrecemos contenidos de la más alta calidad"*. The collective "we / nosotros" is the default. "EDUCA EDTECH Group" is also referenced in third person ("el grupo lidera…").
- **Never refer to the user as "tú" in formal communications.** The deck uses an institutional voice; landing pages and apps may use "tú" only when the brand is speaking *to* a single student in product UI.
- **Capitalization** — Headings in the deck use ALL CAPS for short labels ("VALORES", "INSTITUCIONES", "MIRANDO HACIA EL FUTURO") and Title Case for sentence-level titles. Body never uses ALL CAPS.
- **No emoji.** None of the brand materials use emoji. Emoji feel inconsistent with the formal academic tone — substitute with line icons in teal.
- **No exclamations** in serious sections (mission, values, AI). One brief "¡Hola!" appears as the brand book greeting; that's the only place an exclamation belongs.

### Vocabulary

These phrases recur across the brand book and corporate deck — reuse them verbatim when relevant:

- *Democratizar el acceso a la educación*
- *Aprendizaje significativo, personalizado y aplicable a la vida real*
- *Llevar la educación online a todos los rincones del mundo*
- *Formación de calidad, flexible y adaptada a cada contexto*
- *Alumnado* (preferred over "estudiantes" in formal copy)
- *Experiencias educativas online a medida*
- *Inteligencia Artificial, Machine Learning, Deep Learning, NLP* — capitalized when first introduced
- *I+D+i* (research, development, innovation) — Spanish abbreviation, keep as-is

### Casing examples

- Brand: **EDUCA EDTECH Group** (never `EDUCA Edtech`, never `Educa Edtech Group`)
- Section labels in decks: **EDUCACIÓN SUPERIOR**, **EDUCACIÓN CONTINUA Y OPOSICIONES**, **B2C**, **EDTECH**, **B2B CONTENT**
- Sentence titles: *"Una misma manera de entender la educación"*
- Eyebrow / category labels: ALL CAPS, letter-spaced

### Numbers and stats

The brand earns trust through specifics. When it says "20+ años de experiencia" or "más de 30 universidades" it's stating fact, not marketing puff. Numbers are written as digits ("20+", "30+") and the qualifier "+" replaces the word "más de" in tight UI; in body copy, write "más de 30".

---

## Visual foundations

### Color

The system rests on **one primary** (`#202020`, the corporate near-black) and **five secondaries** that form the spectrum of the signature gradient:

| Token | Hex | Role |
|---|---|---|
| `--ee-black` | `#202020` | All text, dark surfaces. Never use pure `#000000`. |
| `--ee-burdeos` | `#963058` | Lead accent: titles, primary CTAs, table headers, highlights. |
| `--ee-coral` | `#E96A73` | Warm decorative secondary, illustrative accents. |
| `--ee-blue-d` | `#244A80` | Deep formal accent, gradient anchor. |
| `--ee-blue-m` | `#2E7ABE` | Links, interactive elements. |
| `--ee-teal` | `#60BFB8` | Success, line iconography, fresh accents — the "lead accent" on dark theme. |

Neutrals are tight: `#FFFFFF`, `#666666` (secondary text), `#E0E0E0` (hairline borders), `#BABABA` (the gray parallelogram inside the isologo).

**The signature brand gradient** is a recurring visual signature. It appears as:

- Thin (3px) lines beneath section titles
- Bottom-flush bars on slides (the deck does this on every content slide)
- Hero overlays on photography
- Accent borders on cards
- Bottom indicators on tabs

```css
linear-gradient(90deg, #60BFB8 0%, #2E7ABE 25%, #244A80 50%, #963058 80%, #E96A73 100%)
```

The gradient must always run **teal → blue → blue → burdeos → coral**, in that order. Never rearrange the stops.

### Typography

- **Rubik** (Medium 500, sometimes Bold 700) — display, slide titles, h1/h2 in display variants. Geometric, neutral, slightly humanist.
- **Lato** (Regular 400, Bold 700) — body copy, UI text, captions, web H1 (the deck's `Lato Bold 60px` is the largest type in the system).
- **Calibri** — fallback when Rubik / Lato can't load.

The two faces share a similar x-height and a calm, professional rhythm. Mixing any other family is a hard "no" — flagged explicitly in the brand book.

**Slide hierarchy** (16:9, 1920×1080):

| Role | Family | Size | Weight |
|---|---|---|---|
| Slide title | Rubik | 36–44pt | Medium 500 |
| Slide subtitle | Rubik | 20–24pt | Regular 400 — color `#963058` |
| Body | Lato | 18–22pt | Regular 400 |
| Bullets | Lato | 16–20pt | Regular 400 |
| Caption | Lato | 12–14pt | Regular 400 — color `#666666` |

**Web hierarchy:**

| Role | Family | Size |
|---|---|---|
| H1 (hero) | Lato Bold 60px **or** Rubik Medium 48px |
| H2 | Lato Bold 24px / Rubik Medium 26px |
| H3 | Lato Bold 18px |
| Body | Lato Regular 18px |
| Small | Lato Regular 14px |

### Layout

**Generous whitespace, never dense.** The corporate deck uses entire slides for a single title — empty space is a deliberate signal of confidence and academic rigor. The visual rule of thumb: if a slide has more than six bullets, it's wrong.

Web layouts alternate full-bleed light and dark sections with strong contrast. Cards sit on a neutral background with a soft shadow; the gradient line frequently caps the top of a section.

### The parallelogram motif

The isologo is two stacked parallelograms forming an "E". This skewed-rectangle silhouette **carries through the entire visual system**: image crops, decorative shapes, background motifs, button highlights, photo masks. The default skew is approximately `−20°`. Photography is often masked into a parallelogram or used full-bleed with a gradient overlay.

### Backgrounds and imagery

- **Photography** — usually full color, often **black-and-white with a brand-color gradient overlay**, or full color in a parallelogram crop. Photography is warm, human, and grounded in real student/teacher contexts (no stock-photo-of-arms-in-a-circle feel).
- **Color blocks** — full-bleed `#202020` and `#963058` are used as section dividers in the deck.
- **Repeating textures or hand-drawn illustrations** are **not** part of the system. Geometry (parallelograms, the gradient) is the signature.
- **Dark sections** — pure `#202020`, white type, gradient line for accent.

### Cards

- White background (or `#2A2A2A` on dark)
- Border-radius `8–12px` (`--r-md` = 12px is the default)
- Soft shadow: `0 2px 8px rgba(32,32,32,0.06)`
- **Optional thin gradient border** — when used, only one card per row; it's a lead-card signal, not chrome.

### Buttons

Three flavors, all **pill-shaped** (`border-radius: 999px`):

1. **Primary** — solid teal `#60BFB8` *or* gradient burdeos→azul, white **uppercase** label, generous padding.
2. **Secondary** — outline only, thin border in accent color, transparent background, same pill radius.
3. **Tertiary** — solid `#202020` background, white text, pill radius. Used for neutral-strong actions.

Hover: subtle lift (`translateY(-1px)`) + slightly stronger shadow. **No color shifts on hover** for primary/tertiary — the brand color stays put. Secondary fills with its border color on hover at 8–12% opacity.
Press: scale `0.98`, no color shift.

### Inputs

Underline only — no surrounding border. Floating gray label, focus state turns the underline teal `#60BFB8`. Error state turns it burdeos `#963058` and shows a small message in burdeos beneath. Padding is generous; inputs feel airy.

### Tabs

A row of tab labels with the **brand gradient** as a 3px bottom indicator on the active tab. Inactive tabs are gray. The transition between tabs is a 200ms slide of the indicator.

### Borders & shadows

Hairlines are `#E0E0E0` (light) / `#3A3A3A` (dark). Use them sparingly — the system prefers shadow + whitespace to dividing lines. The four-step shadow scale (`--elev-1`…`--elev-4`) covers cards, sticky headers, modals, and the rare hero overlay.

### Radii

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 4px | Icon frames |
| `--r-sm` | 8px | Inputs, small cards |
| `--r-md` | 12px | Default card |
| `--r-lg` | 20px | Hero cards, image masks |
| `--r-pill` | 999px | All buttons |

### Motion

- **Easing** — `cubic-bezier(0.22, 1, 0.36, 1)` for entrances (a soft overshoot-free ease-out), `cubic-bezier(0.65, 0, 0.35, 1)` for symmetric transitions.
- **Durations** — 120ms (micro), 200ms (default), 320ms (entrances).
- **Vibe** — calm and short. No bounces, no spring. Fades and small translations only. The gradient bar at the bottom of slides may fill in over 600ms on the first slide of a deck.

### Hover & press

- Buttons — `translateY(-1px)` + shadow shift, 120ms ease-out.
- Cards — same lift, slightly larger shadow. No scale.
- Links — underline appears on hover; color stays.
- Press — `scale(0.98)`, no color change.

### Transparency & blur

Used sparingly. The only common case is the **gradient overlay on photography** (linear gradient with `mix-blend-mode: multiply` or 60–80% opacity). Backdrop-blur is reserved for sticky app headers and modal scrims.

### Theme alternation

Both light and dark themes are first-class. They're not user toggles — they're **section-level decisions**. A landing page might alternate hero (dark) → values (light) → testimonials (dark) → CTA (gradient). On dark, **teal becomes the lead accent** because burdeos loses contrast.

---

## Iconography

The brand's icon system, per the UI Kit PDF, is:

- **Line style.** Uniform stroke weight, rounded ends. No filled glyphs in the primary set.
- **Primary icon color: teal `#60BFB8`** on light surfaces; white on dark.
- **Often contained in a soft squared frame** (small radius `4–8px`, light gray background) — but the icon itself is line-art.
- **Stroke**: ~1.5–2px at 24px nominal size.

**No proprietary icon font** ships in the brand materials; the UI Kit PDF demonstrates the *style* but not a coded set. We've adopted **Lucide icons** (CDN: `https://unpkg.com/lucide@latest`) as the closest free match — line style, rounded caps, same visual weight. **Substitution is flagged here**: if EDUCA EDTECH Group has its own line icon set, please share the source and we'll swap.

### Asset usage rules

- **No emoji**, anywhere. The brand voice is too formal.
- **No unicode geometric chars** as icons (no `▶`, `◆`, `★`).
- **PNG icons should be avoided** — SVG only, so they tint correctly with `currentColor`.
- The **parallelogram shape** functions as a graphic device, not an icon — used for crops, badges, and decorative shapes, never as a symbol-with-meaning.

### Logos

| File | Use |
|---|---|
| `assets/logo-horizontal.svg` | Default, **priority** version. Use everywhere unless space is square. |
| `assets/logo-horizontal-negative.svg` | Same, white-on-dark. |
| `assets/logo-square.svg` | Square-format placements (avatars, social profiles). |
| `assets/by-educa-horizontal.svg` (+ `-negative`, `-line`) | "By EDUCA EDTECH Group" endorsement mark for sub-brand co-branding. |
| `assets/by-educa-vertical.svg` (+ `-negative`) | Vertical lockup of the endorsement. |

**Logo rules** (from the brand book — these are non-negotiable):

- **Always preserve safety area** equal to the height of the wordmark on all sides.
- **Minimum sizes** — Horizontal: 121×29.7px web / 38×10mm print. Square isologo: 28.6×29.7px web / 9×9mm print.
- **Never** rotate, distort, recolor partially, add shadows, separate the isologo from the wordmark, or use the logo without the anagram.
- **Never** use an outline-only ("trazado") version.
- Use **positive** (dark) on light backgrounds; **negative** (white) on dark backgrounds (`#202020`).

---

## Index

```
EDUCA EDTECH Group Design System/
├── README.md                    ← you are here
├── SKILL.md                     ← skill manifest (Claude Code-compatible)
├── colors_and_type.css          ← all design tokens (CSS vars), font-faces
├── fonts/                       ← Rubik (300/400/500/700) + Lato (300/400/700 + italics)
├── assets/                      ← master logos (horizontal, square, by-educa endorsement)
├── preview/                     ← cards rendered in the Design System tab
├── slides/                      ← 16:9 sample slides (cover, content, section, closing, etc.)
│   ├── index.html
│   └── *.jsx
├── ui_kits/
│   ├── landing/                 ← Marketing landing page (hero, values, institutions, CTA)
│   └── dashboard/               ← Web app: EDUCA LXP-style learning dashboard
└── scraps/                      ← Extracted PDF text and copies of source PDFs
```

---

## Caveats

- **Icons are substituted** — Lucide stands in for the line-icon system shown in the UI Kit PDF. If a proprietary set exists, please share.
- **No screenshots** of an existing landing page or the EDUCA LXP product were provided. The UI kits are **interpretive recreations** built from the brand book, UI Kit PDF, and corporate deck. They follow every rule in the visual system but aren't pixel-matched to a specific live site.
- The **20+ sub-brand logos** (Euroinnova, INESEM, etc.) weren't included; only the parent EDUCA EDTECH Group marks. The "By EDUCA EDTECH Group" endorsement is in `assets/` for co-branding work.
- **Photography** placeholders use neutral parallelogram-cropped frames; the brand's actual photo style ("warm, human, real students/teachers") needs real photography to truly land.
