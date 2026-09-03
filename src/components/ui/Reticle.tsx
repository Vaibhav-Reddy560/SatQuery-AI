import { cn } from "@/lib/utils";

/**
 * HUD target-lock crosshair — overshoots in, then settles on its mark.
 * Positions itself by its own centre, so a caller just sets `top`/`left`
 * (percent or px) via `style` on this element.
 */

export function Reticle({
  className,
  size = 28,
  label,
  style,
}: {
  className?: string;
  size?: number;
  /** Small mono tag under the crosshair, e.g. a confidence score. */
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-1/2", className)}
      style={{
        width: size,
        height: size,
        animation: "reticle-lock 0.5s cubic-bezier(0.32,0.72,0,1) both",
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <circle cx="50" cy="50" r="34" fill="none" stroke="var(--color-atmos)" strokeWidth="2" strokeOpacity="0.85" />
        <line x1="50" y1="0" x2="50" y2="18" stroke="var(--color-atmos)" strokeWidth="2" />
        <line x1="50" y1="82" x2="50" y2="100" stroke="var(--color-atmos)" strokeWidth="2" />
        <line x1="0" y1="50" x2="18" y2="50" stroke="var(--color-atmos)" strokeWidth="2" />
        <line x1="82" y1="50" x2="100" y2="50" stroke="var(--color-atmos)" strokeWidth="2" />
        <circle cx="50" cy="50" r="2.5" fill="var(--color-atmos)" />
      </svg>
      {label && (
        <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-bg-primary/80 px-1.5 py-0.5 font-mono text-mono-sm uppercase text-atmos">
          {label}
        </span>
      )}
    </div>
  );
}
