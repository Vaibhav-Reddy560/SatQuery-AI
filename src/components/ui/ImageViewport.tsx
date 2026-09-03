import { HudFrame } from "@/components/ui/HudFrame";
import { cn } from "@/lib/utils";

/**
 * A real satellite scene with an optional SVG annotation layer.
 *
 * Replaces the flat coloured rectangles that stood in for imagery. Annotations
 * are drawn in SVG user space (0-100 on both axes) so boxes and labels scale
 * with the image instead of being absolutely positioned in CSS — which is what
 * made the old labels wrap and collide at narrow widths.
 */

export interface Box {
  id: string;
  /** All in 0-100 percentage space. */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  color?: string;
}

export function ImageViewport({
  src,
  alt,
  boxes = [],
  showLabels = true,
  aspect = "aspect-[4/3]",
  overlay,
  className,
  children,
}: {
  src: string;
  alt: string;
  boxes?: Box[];
  showLabels?: boolean;
  aspect?: string;
  /** Extra SVG drawn in the same 0-100 user space, under the boxes. */
  overlay?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-bg-primary", aspect, className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Grades the scene into the palette and keeps overlay text legible. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,6,7,0.30) 0%, rgba(6,6,7,0.05) 35%, rgba(6,6,7,0.55) 100%)",
        }}
      />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full pointer-events-none"
        aria-hidden="true"
      >
        {overlay}
        {boxes.map((b) => (
          <g key={b.id}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={b.color ?? "#6fb8ff"}
              fillOpacity={0.10}
              stroke={b.color ?? "#6fb8ff"}
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
              rx={0.6}
            />
          </g>
        ))}
      </svg>

      {/* Labels live in HTML, not SVG, so text is not distorted by
          preserveAspectRatio="none" on the viewBox. */}
      {showLabels &&
        boxes.filter((b) => b.label).map((b) => (
          <span
            key={b.id}
            className="absolute -translate-y-full whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-bg-primary"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              marginTop: -3,
              background: b.color ?? "#6fb8ff",
            }}
          >
            {b.label}
          </span>
        ))}

      {/* HUD instrument frame — corner brackets + edge tick rulers, straight
          from the reference mood board's sci-fi scan-panel framing. Marks
          this as an instrument reading, not a photograph. Shared with the
          map canvas and the Earth hero via the same `HudFrame` component
          instead of four separate hand-rolled bracket implementations. */}
      <HudFrame />

      {children}
    </div>
  );
}
