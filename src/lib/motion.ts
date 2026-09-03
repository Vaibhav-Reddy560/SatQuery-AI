/**
 * Motion tokens.
 *
 * Curves are matched to Apple's system animations — `apple` is the iOS
 * sheet-presentation curve, which is what makes a panel feel like it was
 * *placed* rather than tweened.
 *
 * Everything here is consumed through `motion/react`.
 */

/** Cubic-bezier curves. */
export const ease = {
  apple: [0.32, 0.72, 0, 1],
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/** Spring presets. `snappy` for interaction feedback, `soft` for layout. */
export const spring = {
  snappy: { type: "spring", stiffness: 420, damping: 38, mass: 1 },
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  gentle: { type: "spring", stiffness: 160, damping: 24, mass: 1 },
} as const;

/** Durations in seconds. */
export const dur = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  cinematic: 0.7,
} as const;

// ── Reusable variants ──────────────────────────────────────

/** Fade up from 8px. The default entrance for almost everything. */
export const fadeRise = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: dur.slow, ease: ease.out },
  },
} as const;

/** Fade in with no movement — for things that shouldn't draw the eye. */
export const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base, ease: ease.out } },
} as const;

/** Scale in from 96%. For dialogs, popovers, the command palette. */
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: dur.base, ease: ease.apple },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: dur.fast, ease: ease.inOut },
  },
} as const;

/**
 * Parent for staggered children. Pair with `fadeRise` on each child.
 * 40ms feels deliberate; above ~70ms it starts to feel slow.
 */
export const stagger = (delayChildren = 0, staggerChildren = 0.04) =>
  ({
    hidden: {},
    show: {
      transition: { delayChildren, staggerChildren },
    },
  }) as const;

/** Standard `whileInView` config — animate once, slightly before fully visible. */
export const inView = {
  once: true,
  margin: "0px 0px -80px 0px",
} as const;

/**
 * `Element.scrollIntoView({ behavior: "smooth" })` ignores `prefers-reduced-
 * motion` entirely — it's a browser API, not CSS, so the global reduced-
 * motion stylesheet override in `index.css` can't reach it. Call sites that
 * animate a scroll should gate `behavior` through this instead of hardcoding
 * `"smooth"`.
 */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
