import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Draggable before/after wipe.
 *
 * Replaces two side-by-side cards, which forced the eye to hunt for
 * differences. The two scenes here are genuinely different acquisitions from
 * the Esri World Imagery Wayback archive, not one image processed twice.
 */
export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPct(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current) setFromClientX(e.clientX);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative select-none overflow-hidden rounded-lg bg-bg-primary aspect-[16/10] cursor-ew-resize",
        className
      )}
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
    >
      <img
        src={afterSrc}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 w-px bg-atmos pointer-events-none"
        style={{ left: `${pct}%`, boxShadow: "0 0 14px 1px rgba(111,184,255,0.7)" }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-bg-primary/85 backdrop-blur-sm border border-atmos/50 pointer-events-none"
        style={{ left: `${pct}%` }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-atmos" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 6 4 12l5 6M15 6l5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <span className="absolute left-4 top-4 rounded-full bg-bg-primary/75 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold text-text-secondary">
        {beforeLabel}
      </span>
      <span className="absolute right-4 top-4 rounded-full bg-bg-primary/75 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold text-text-secondary">
        {afterLabel}
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        aria-label="Compare before and after imagery"
        className="sr-only"
      />
    </div>
  );
}
