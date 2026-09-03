import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

/**
 * The SatQuery AI lockup: mark left, wordmark right.
 *
 * The wordmark is the ONLY place "Zrnic" is used in the app. Casing is
 * fixed: `SatQuery AI`. Both the mark and the wordmark carry the same
 * brand gradient (`--gradient-brand`, atmosphere blue fading to white) by
 * default — `holo` swaps both to the logo's own light-cyan gradient
 * (`--gradient-logo`, shades around #00F2FF only, no deep blue) for the
 * landing page's chrome nav. STATIC, not animated — this is a distinct,
 * simpler treatment from the generic `holo`/`holo-text` utilities used
 * elsewhere (the hero headline), which do still animate.
 */

type LogoSize = "compact" | "nav" | "hero";

interface LogoProps {
  size?: LogoSize;
  markOnly?: boolean;
  /** The logo's static light-cyan gradient instead of the brand gradient. */
  holo?: boolean;
  /** Plain white, no gradient — overrides `holo`. Temporary flat treatment
      while the nav look is being reconsidered. */
  white?: boolean;
  className?: string;
}

const SIZES: Record<
  LogoSize,
  { mark: number; text: string; tracking: string; gap: string }
> = {
  // Zrnic is a tight display face — it needs positive tracking to breathe,
  // and more of it as the size drops.
  compact: { mark: 22, text: "1rem", tracking: "0.06em", gap: "0.625rem" },
  // The top bar is the lockup's only home now — it needs to dominate the
  // bar, not sit level with search/notifications/account. Mark sized down
  // from 40 — at that size it read visually heavier/taller than the
  // wordmark's actual glyph height, throwing off the vertical centering
  // flexbox alone (`items-center` on the wrapper below) couldn't fix,
  // since that centers the two boxes, not their optical weight.
  nav: { mark: 32, text: "1.875rem", tracking: "0.045em", gap: "0.875rem" },
  hero: { mark: 72, text: "3.25rem", tracking: "0.045em", gap: "1.375rem" },
};

export function Logo({ size = "nav", markOnly = false, holo = false, white = false, className }: LogoProps) {
  const s = SIZES[size];

  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: markOnly ? undefined : s.gap }}
      role="img"
      aria-label="SatQuery AI"
    >
      <LogoMark size={s.mark} holo={holo} white={white} />
      {!markOnly && (
        <span
          className={cn(
            "font-display leading-none whitespace-nowrap select-none",
            white ? "text-white" : holo ? "logo-text" : "bg-clip-text text-transparent"
          )}
          style={{
            fontSize: s.text,
            letterSpacing: s.tracking,
            backgroundImage: white ? undefined : holo ? undefined : "var(--gradient-brand)",
          }}
          aria-hidden="true"
        >
          SatQuery AI
        </span>
      )}
    </span>
  );
}
