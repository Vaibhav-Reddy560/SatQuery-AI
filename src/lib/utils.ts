import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Glossy steel bezel for CRT/data panels — a thin, dimensional silver
 * ring. Pure box-shadow, no `border` — the ring sits INSIDE the panel's
 * own edge rather than adding a rim outside it. A uniform silver hairline
 * plus a top-left light catch / bottom-right shadow reads as one lit,
 * rounded metal edge rather than a flat painted line. Dimmed down from an
 * earlier, brighter pass that read as flat white rather than steel.
 */
export const SCREEN_BEZEL =
  "inset 0 0 0 1px color-mix(in srgb, var(--color-silver) 55%, transparent), inset 1px 1px 0 0 rgba(255,255,255,0.22), inset -1px -1px 0 0 rgba(0,0,0,0.45)";

/**
 * Blue-chrome bezel for image/scene panels — used as a `border`, NOT a
 * `boxShadow` like `SCREEN_BEZEL` above. Every image panel has a full-
 * bleed `absolute inset-0` <img> as a direct child, and an absolutely-
 * positioned descendant paints in its own stacking layer ABOVE its
 * parent's background/box-shadow/outline regardless of DOM order — no
 * amount of colour or opacity tuning on an inset box-shadow (or even an
 * `outline`) ever became visible here, confirmed by direct testing. A
 * `border` doesn't have that problem: with this app's global border-box
 * sizing, the border occupies space the child's `inset-0` is computed to
 * exclude (offsets resolve against the padding edge, not the border
 * edge), so it renders flush against the image with no gap. Uses
 * `--color-atmos` rather than the muted `chrome-high` steel-blue —
 * `chrome-high` sat too close in hue/lightness to the surrounding
 * `chrome` shell to read as a distinct ring.
 */
export const IMAGE_BEZEL =
  "1px solid color-mix(in srgb, var(--color-atmos) 25%, var(--color-chrome-high))";

/**
 * Neutral chrome/steel bezel — same `border` mechanism and reasoning as
 * `IMAGE_BEZEL` above, but true silver rather than blue-tinted, for the
 * landing page's Earth console screen.
 */
export const STEEL_BEZEL =
  "1px solid color-mix(in srgb, var(--color-silver) 70%, var(--color-chrome-mid))";
