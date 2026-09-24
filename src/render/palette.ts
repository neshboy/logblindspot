/**
 * Shared color palette for both renderers (terminal + HTML).
 *
 * Design note: coverage (covered vs. blind-spot) is a *status* - a state with a
 * reserved meaning - not a series identity, so it gets the fixed good/critical
 * status pair rather than a cycled categorical hue. Tactic identity is already
 * carried by the tactic's text label (its name/header), so tactics are never
 * distinguished by hue alone: with 15 real ATT&CK tactics on screen at once
 * (effectively an all-pairs comparison, since every row is visible
 * simultaneously), no 15-color categorical set can stay pairwise
 * distinguishable under color-vision deficiency - the categorical palette
 * this method ships only clears that bar for its first 3 slots. So color here
 * is reserved for the one channel that actually needs it (status), and every
 * status color is additionally paired with a distinct glyph/icon shape so
 * meaning survives in grayscale, --no-color terminals, and NO_COLOR mode.
 */

export const STATUS = {
  good: "#0ca30c",
  critical: "#d03b3b",
} as const;

export const INK = {
  primaryLight: "#0b0b0b",
  primaryDark: "#ffffff",
  secondaryLight: "#52514e",
  secondaryDark: "#c3c2b7",
  muted: "#898781",
  accent: "#2a78d6",
} as const;

export const SURFACE = {
  light: "#fcfcfb",
  dark: "#1a1a19",
} as const;

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a 6-digit hex color: ${hex}`);
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
