/* Colour maths for readable pages. Inputs are #rgb or #rrggbb strings. */

export const INK_DARK = '#0a0a23';
export const INK_LIGHT = '#ffffff';

function parse(hex) {
  if (typeof hex !== 'string') throw new TypeError(`Not a colour: ${String(hex)}`);
  let h = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(h)) h = `#${[...h.slice(1)].map((c) => c + c).join('')}`;
  if (!/^#[0-9a-f]{6}$/.test(h)) throw new TypeError(`Not a colour: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex) {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The ink (dark or light) that reads best on the given background. */
export function readableOn(background) {
  return contrastRatio(INK_DARK, background) >= contrastRatio(INK_LIGHT, background) ? INK_DARK : INK_LIGHT;
}
