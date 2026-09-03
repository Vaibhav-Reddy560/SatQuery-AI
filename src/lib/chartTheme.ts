/**
 * Chart tokens for Recharts, which takes colours as SVG props and inline
 * styles and so cannot read CSS custom properties. Mirrors the `@theme` block
 * in `src/index.css` — keep the two in sync.
 */

export const CHART = {
  accent: "#3d7fff",
  atmos: "#6fb8ff",
  warning: "#9db8e8",
  success: "#3d7fff",
  info: "#6fb8ff",
  danger: "#1f4fc4",

  grid: "#1a1a1d",
  // Was a neutral UI gray (`--color-text-muted`) — inside the Throughput
  // panel's CRT/phosphor treatment that read as the axis numbers and day/
  // month labels having been "greyed out" next to the blue bars and lines.
  // Matches `--color-phosphor-dim` (index.css) so axis text sits at the
  // same secondary-but-clearly-blue tone as every other de-emphasised
  // label inside a CRT panel.
  axis: "rgba(77, 238, 255, 0.75)",
  text: "#f2f2f4",
  surface: "#212124",
  border: "#2c2c30",
} as const;

/**
 * Ordered series colours — every stop is blue. A gray series sitting next
 * to blue ones read as an inconsistent, unrelated system; a ramp across
 * lightness/saturation of one hue still gives 5 distinguishable series.
 */
export const SERIES = [
  CHART.accent,
  "#91caff",
  "#1f4fc4",
  "#9db8e8",
  "#7fa8e8",
] as const;

/**
 * Shared tooltip styling. Recharts takes inline styles, not classes, so this
 * hand-mirrors --radius-md (12px) and --shadow-overlay from the theme —
 * keep both in sync if either changes.
 */
export const tooltipStyle = {
  background: "rgba(23,23,26,0.92)",
  backdropFilter: "blur(20px)",
  border: `1px solid ${CHART.border}`,
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 4px 12px 0 rgba(0,0,0,0.45), 0 24px 48px -16px rgba(0,0,0,0.7)",
} as const;

export const tickStyle = { fontSize: 11, fill: CHART.axis } as const;
