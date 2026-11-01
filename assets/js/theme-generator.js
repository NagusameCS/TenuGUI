import { clamp, contrastRatio, parseColor, rgbToHex } from "./utils.js";

/* ------------------------------------------------------------------ colour */
function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) });
}

/** Nudge a colour's lightness until it clears a contrast floor on `background`. */
function readable(color, background, minimum = 4.5) {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [h, s, l] = rgbToHsl(rgb);
  for (let delta = 0; delta <= 100; delta += 1) {
    for (const candidateLight of [l + delta, l - delta]) {
      if (candidateLight < 0 || candidateLight > 100) continue;
      const candidate = hslToHex(h, s, candidateLight);
      if (contrastRatio(candidate, background) >= minimum) return candidate;
    }
  }
  return l > 50 ? "#FFFFFF" : "#000000";
}

function pair(baseHue, accentHue) {
  const lightCanvas = hslToHex(baseHue, 18 + Math.random() * 12, 93 + Math.random() * 3);
  const darkCanvas = hslToHex(baseHue, 12 + Math.random() * 5, 7 + Math.random() * 2);
  const lightText = readable(hslToHex(baseHue, 18, 14), lightCanvas, 12);
  const darkText = readable(hslToHex(baseHue, 20, 94), darkCanvas, 12);
  const lightSecondary = readable(hslToHex(baseHue, 12, 42), lightCanvas, 4.5);
  const darkSecondary = readable(hslToHex(baseHue, 14, 70), darkCanvas, 4.5);
  const lightAccent = readable(hslToHex(accentHue, 58 + Math.random() * 12, 42), lightCanvas, 4.5);
  const darkAccent = readable(hslToHex(accentHue, 68 + Math.random() * 10, 62), darkCanvas, 4.5);
  const lightAccentHover = readable(hslToHex(accentHue, 62, 34), lightCanvas, 5);
  const darkAccentHover = readable(hslToHex(accentHue, 72, 70), darkCanvas, 5);
  const lightAccentInk = readable(hslToHex(accentHue, 70, 96), lightAccent, 4.5);
  const darkAccentInk = readable(hslToHex(accentHue, 70, 9), darkAccent, 4.5);
  const lightSurface = hslToHex(baseHue, 20, 98);
  const darkSurface = hslToHex(baseHue, 14, 11 + Math.random() * 2);
  const lightElevated = hslToHex(baseHue, 18, 100);
  const darkElevated = hslToHex(baseHue, 14, 16 + Math.random() * 2);
  return {
    light: {
      canvas: lightCanvas,
      surface: lightSurface,
      elevated: lightElevated,
      text: lightText,
      secondary: lightSecondary,
      border: hslToHex(baseHue, 13, 82),
      accent: lightAccent,
      accentHover: lightAccentHover,
      accentInk: lightAccentInk,
      positive: readable(hslToHex(145, 44, 32), lightCanvas, 4.5),
      warning: readable(hslToHex(38, 68, 28), lightCanvas, 4.5),
      destructive: readable(hslToHex(2, 56, 38), lightCanvas, 4.5),
      placeholder: lightSecondary,
    },
    dark: {
      canvas: darkCanvas,
      surface: darkSurface,
      elevated: darkElevated,
      text: darkText,
      secondary: darkSecondary,
      border: hslToHex(baseHue, 11, 23),
      accent: darkAccent,
      accentHover: darkAccentHover,
      accentInk: darkAccentInk,
      positive: readable(hslToHex(145, 44, 68), darkCanvas, 4.5),
      warning: readable(hslToHex(38, 70, 72), darkCanvas, 4.5),
      destructive: readable(hslToHex(2, 58, 70), darkCanvas, 4.5),
      placeholder: darkSecondary,
    },
  };
}

/**
 * Coolors-style generator: choose a base hue, then a related accent hue and
 * derive every surface/text token from it. Contrast-dependent colours are
 * pushed toward readable lightness values rather than picked blindly.
 */
export function generateThemeTokens() {
  const base = Math.random() * 360;
  const accent = (base + 135 + Math.random() * 90) % 360;
  return pair(base, accent);
}
