import { createContext, useContext } from "react";

// ─── DESIGN TOKENS — EDUCA EDTECH Group ───────────────────────────────
export const LIGHT = {
  sidebar:    "#FFFFFF",
  sidebarText:"#666666",
  sidebarAct: "#202020",
  sidebarBorder: "1px solid #E0E0E0",
  cream:      "#F4F4F4",
  card:       "#FFFFFF",
  cardBorder: "#E0E0E0",
  text:       "#202020",
  textMuted:  "#666666",
  // 4.5:1 sobre card/cream — #BABABA (el valor de marca original) quedaba en
  // ~2.3:1 y las etiquetas "opcional" y textos de ayuda eran ilegibles.
  textLight:  "#767676",
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

export const DARK = {
  sidebar:    "#1A1A1A",
  sidebarText:"#BABABA",
  sidebarAct: "#FFFFFF",
  sidebarBorder: "none",
  cream:      "#202020",
  card:       "#2A2A2A",
  cardBorder: "#3A3A3A",
  text:       "#FFFFFF",
  textMuted:  "#BABABA",
  // #5A5A5A daba ~1.5:1 sobre los fondos oscuros — texto fantasma.
  textLight:  "#9A9A9A",
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
export const ThemeContext = createContext({ tokens: LIGHT, themeName: "light", toggle: () => {} });

export function useTheme() { return useContext(ThemeContext).tokens; }

export function useThemeName() { return useContext(ThemeContext).themeName; }

export function useThemeToggle() { return useContext(ThemeContext).toggle; }
