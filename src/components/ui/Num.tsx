import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Fixed-width numeric display.
 *
 * Maxima Nouva ships no `tnum` feature and its digit advances range from 231
 * units ('1') to 554 ('7') — a 2.4x spread. `font-variant-numeric: tabular-nums`
 * is therefore a no-op on this face, and any live-updating number (coordinates,
 * counters, table columns) visibly jitters as digits change.
 *
 * This lays each digit out in a fixed 0.56em cell — 0.546em is the advance of
 * '0', rounded up — while leaving punctuation at its natural width. Same
 * glyphs, true column alignment.
 */

const DIGIT_CELL = "0.56em";

interface NumProps {
  value: number;
  decimals?: number;
  /** `compact` renders 12480 as 12.5K. */
  format?: "plain" | "compact";
  prefix?: string;
  suffix?: string;
  /** Count up from zero the first time it scrolls into view. */
  animate?: boolean;
  className?: string;
}

function formatValue(v: number, decimals: number, format: "plain" | "compact") {
  if (format === "compact") {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  }
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function Num({
  value,
  decimals = 0,
  format = "plain",
  prefix,
  suffix,
  animate = false,
  className,
}: NumProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const mv = useMotionValue(value);
  const sp = useSpring(mv, { stiffness: 60, damping: 20, mass: 1 });
  const startedRef = useRef(false);

  // Only tracks the spring's animated value — when `animate` is off, `shown`
  // below reads `value` directly during render instead, so that path needs
  // no state or effect of its own at all.
  const [animatedShown, setAnimatedShown] = useState(value);

  // Subscribed for the component's whole lifetime, independent of whether
  // or when the count-up below actually starts. It used to live inside
  // that effect instead, torn down (`return unsub`) and never resubscribed
  // the moment `value` changed after the first count-up — so a later prop
  // change (e.g. a filtered count) stopped reaching the display at all and
  // it froze at whatever it first counted up to.
  useEffect(() => {
    return sp.on("change", setAnimatedShown);
  }, [sp]);

  useEffect(() => {
    if (!animate || !inView || startedRef.current) return;
    startedRef.current = true;
    // `.jump` sets the value with no interpolation, so the spring's anchor
    // becomes 0 without ever rendering it; `.set` right after is what
    // actually animates back up to the real value.
    mv.jump(0);
    mv.set(value);
  }, [animate, inView, value, mv]);

  // Keep in sync with value changes after the initial count-up, animated
  // through the spring. Value changes while animation is off, or before
  // the first count-up starts, are handled by reading `value` directly
  // below instead — nothing to do here for those cases.
  useEffect(() => {
    if (animate && startedRef.current) mv.set(value);
  }, [animate, value, mv]);

  // `inView` (not `startedRef.current`) gates which value render sees:
  // `useInView`'s own state is what the count-up effect's guard keys off
  // of too, so once it flips true the two are equivalent for this
  // purpose — but `inView` is a proper reactive value safe to read during
  // render, where a ref's `.current` is not.
  const shown = animate && inView ? animatedShown : value;
  const text = formatValue(shown, decimals, format);

  return (
    <span ref={ref} className={cn("inline-flex items-baseline", className)}>
      {prefix && <span>{prefix}</span>}
      <span className="inline-flex items-baseline" aria-label={text}>
        {text.split("").map((ch, i) =>
          ch >= "0" && ch <= "9" ? (
            <span
              key={i}
              aria-hidden="true"
              className="inline-block text-center"
              style={{ width: DIGIT_CELL }}
            >
              {ch}
            </span>
          ) : (
            <span key={i} aria-hidden="true">
              {ch}
            </span>
          )
        )}
      </span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

/**
 * `km²` with a real superscript.
 *
 * Maxima Nouva has no U+00B2 glyph, and the string appears 40 times across the
 * app — including inside `src/services/`, which is off-limits. The font stack
 * substitutes it per-glyph so nothing breaks, but where the unit is prominent
 * this renders it properly in-face instead.
 */
export function Km2({
  value,
  decimals = 1,
  animate,
  className,
}: {
  value: number;
  decimals?: number;
  animate?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <Num value={value} decimals={decimals} animate={animate} />
      <span className="ml-1">
        km
        <sup className="text-[0.62em] relative -top-[0.34em] ml-[0.04em]">2</sup>
      </span>
    </span>
  );
}
