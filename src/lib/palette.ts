/**
 * Legacy colour remap.
 *
 * Category and classification colours are baked into the data as raw hex in
 * two places: `src/data/mockData.ts` (editable) and `src/services/
 * analysisRunner.ts` (NOT editable — teammates own it). Fixing only the former
 * would make mock and live results visibly disagree.
 *
 * So the remap happens at render time instead. Every site that consumes a
 * `.color` off a domain object passes it through `brandColor()`, and both
 * sources land on the space palette without touching any service.
 */

/*
 * v4 palette is strictly black / white / metal-gray / blue — no green,
 * amber, purple or red anywhere. First cut of this remap spread categories
 * across blue AND the metal-gray family; seeing it rendered, a gray
 * category swatch sitting next to blue ones read as an unrelated, broken
 * palette rather than "the same system, more values." Metal-gray is
 * chrome-only now (panels, dividers) — every category below is a stop on
 * ONE blue ramp, palest to darkest navy, which still gives 12 genuinely
 * distinct, unique values for legends/donut charts with many simultaneous
 * categories — same contrast budget, one hue instead of two.
 */
const REMAP: Record<string, string> = {
  // blues -> the app's own blues, brightest end of the ramp
  "#3b82f6": "#3d7fff",
  "#06b6d4": "#6fb8ff",
  "#0891b2": "#91caff",
  // greens -> pale-to-mid blue
  "#22c55e": "#a8c8f5",
  "#15803d": "#5f97ff",
  "#84cc16": "#d6e6ff",
  // ambers -> mid-saturated blue
  "#f59e0b": "#2d6ae8",
  "#d97706": "#3563d6",
  "#a16207": "#163e9e",
  // purple/red -> deep navy (was "danger"/"rare accent"; now the
  // saturated-fill blue reserved for anything that needs to read as urgent)
  "#a855f7": "#1f4fc4",
  "#ef4444": "#0f2e78",
  // grey -> darkest navy, still blue, never neutral
  "#6b7280": "#0a2158",
};

/** Map a legacy hex onto the space palette. Unknown values pass through. */
export function brandColor(hex: string | undefined): string {
  if (!hex) return "#6fb8ff";
  return REMAP[hex.toLowerCase()] ?? hex;
}
