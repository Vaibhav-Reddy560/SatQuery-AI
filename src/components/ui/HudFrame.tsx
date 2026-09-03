import { cn } from "@/lib/utils";

/**
 * HUD instrument frame — corner brackets, edge tick rulers, an optional
 * top label chip, and optional small readouts pinned to each corner.
 *
 * Extracted from the corner brackets that were previously hardcoded inside
 * `ImageViewport.tsx` so the map canvas, charts and the Earth hero can all
 * carry the same treatment instead of four ad-hoc ones. Purely decorative —
 * `aria-hidden` throughout, the same way the original brackets were: this
 * marks a surface as "an instrument reading," it never carries content a
 * screen reader needs.
 */

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const CORNER_POS: Record<Corner, string> = {
  "top-left": "top-0 left-0 border-t-2 border-l-2 rounded-tl-[3px]",
  "top-right": "top-0 right-0 border-t-2 border-r-2 rounded-tr-[3px]",
  "bottom-left": "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[3px]",
  "bottom-right": "bottom-0 right-0 border-b-2 border-r-2 rounded-br-[3px]",
};

const READOUT_POS: Record<Corner, string> = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4 text-right",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4 text-right",
};

export function HudFrame({
  className,
  label,
  ticks = true,
  readouts,
}: {
  className?: string;
  /** Small uppercase chip centred on the top edge, e.g. "LIVE FEED". */
  label?: string;
  /** Fine tick marks along the top and bottom edges. */
  ticks?: boolean;
  /** Small mono readouts pinned to one or more corners. */
  readouts?: Partial<Record<Corner, React.ReactNode>>;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="absolute inset-2.5">
        {(Object.keys(CORNER_POS) as Corner[]).map((corner) => (
          <span key={corner} className={cn("absolute h-3.5 w-3.5 border-atmos/70", CORNER_POS[corner])} />
        ))}
      </div>

      {ticks && (
        <>
          <div className="absolute inset-x-7 top-0 flex h-2 justify-between">
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="h-full w-px bg-atmos/20" />
            ))}
          </div>
          <div className="absolute inset-x-7 bottom-0 flex h-2 justify-between">
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="h-full w-px bg-atmos/20" />
            ))}
          </div>
        </>
      )}

      {/* Hidden below `sm:` — a decorative top-centre label has nowhere to
          go on a narrow phone without colliding with whatever functional
          control (a search bar, a page header) also anchors near the top
          of the same surface; on a phone screen the surface is small
          enough that the frame itself still reads as an instrument
          without it. */}
      {label && (
        <span className="absolute left-1/2 top-2.5 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-bg-primary/70 px-2 py-0.5 font-mono text-mono-sm uppercase text-atmos/80 sm:block">
          {label}
        </span>
      )}

      {readouts &&
        (Object.entries(readouts) as [Corner, React.ReactNode][]).map(
          ([corner, content]) =>
            content && (
              <div key={corner} className={cn("absolute font-mono text-mono-sm uppercase text-phosphor/80", READOUT_POS[corner])}>
                {content}
              </div>
            )
        )}
    </div>
  );
}
