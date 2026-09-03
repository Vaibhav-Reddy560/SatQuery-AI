import { cn } from "@/lib/utils";

/**
 * HUD telemetry line — `LAT 19.076° · LON 72.877° · Z 12`.
 *
 * Terminal-layer typography (mono, wide tracking, uppercase, phosphor)
 * applied to short data points rather than prose. Backs `CoordinatesDisplay`,
 * `AgentTrace` rows, and any metric caption that wants to read as an
 * instrument reading rather than UI copy.
 */

export interface ReadoutItem {
  label?: string;
  value: React.ReactNode;
}

export function Readout({
  items,
  separator = "·",
  className,
}: {
  items: ReadoutItem[];
  separator?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-readout uppercase text-phosphor",
        className
      )}
    >
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-x-2.5">
          <span className="inline-flex items-center gap-1.5">
            {/* Label dim and un-glowed, value bright and glowing — the
                hierarchy the terminal layer was missing: everything used to
                read at the same flat weight. */}
            {it.label && <span className="text-phosphor-dim [text-shadow:none]">{it.label}</span>}
            <span className="phosphor-glow">{it.value}</span>
          </span>
          {i < items.length - 1 && (
            <span aria-hidden="true" className="text-phosphor-dim [text-shadow:none]">
              {separator}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
