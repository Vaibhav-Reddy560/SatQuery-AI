import { cn } from "@/lib/utils";

/**
 * Scrolling stock-ticker-style strip of sci-fi telemetry flavour text —
 * fills the dead space under the chrome nav with dynamic-feeling detail.
 * Purely decorative (`aria-hidden`): the values are flavour, not live data.
 *
 * `ticker-scroll` (in `index.css`) translates the track by exactly -50%,
 * which only loops seamlessly if ONE COPY of the track is already at
 * least as wide as the viewport — otherwise the translate runs past the
 * end of the real content before the animation resets, and you see empty
 * space at the right edge for the rest of that cycle. `unit` repeats the
 * source list twice so a single copy comfortably outruns even an
 * ultra-wide monitor; `loop` then duplicates THAT for the actual -50%
 * seam. Four copies of a real, relevant list reads as one continuous
 * stream — it does not read as "the same 18 words," the way it would if
 * this padded a short list with filler instead.
 *
 * The animation duration has to scale with that same `unit` length — a
 * fixed duration here once made the strip visibly speed up the moment the
 * content got longer, since the same distance now had to cover 2x the
 * pixels in the same time.
 *
 * No `bevel` — that utility is a highlight on the top+left edge and a
 * dark shadow on bottom+right (a "raised" look for a small, discrete
 * control), which is exactly backwards for a strip that runs the full
 * width of the screen: it read as a stray bright line at the true left
 * edge of the viewport with nothing to match it on the right. `border-y`
 * instead, in the same phosphor blue as the text.
 */
export function TelemetryTicker({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const unit = [...items, ...items];
  const loop = [...unit, ...unit];

  return (
    <div
      aria-hidden="true"
      className={cn("group relative overflow-hidden border-y border-phosphor/30 bg-bg-secondary/80", className)}
    >
      <div
        className="flex w-max items-center gap-10 whitespace-nowrap py-2 font-mono text-mono-sm uppercase text-phosphor-dim [animation:ticker-scroll_110s_linear_infinite] group-hover:[animation-play-state:paused]"
        style={{ textShadow: "none" }}
      >
        {loop.map((t, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2">
            <span className="h-1 w-1 shrink-0 rounded-full bg-phosphor" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
