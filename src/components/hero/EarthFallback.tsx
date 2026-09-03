import { cn } from "@/lib/utils";

/**
 * CSS-only Earth. No WebGL, no JS, ~0 KB.
 *
 * Serves three jobs: the Suspense fallback while the three.js chunk loads (so
 * there is never a flash of nothing), the reduced-motion rendering, and the
 * hard fallback when WebGL is unavailable.
 */
export function EarthFallback({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <div className={cn("relative aspect-square w-full max-w-[560px]", className)}>
      {/* Outer atmospheric bloom */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 47%, rgba(111,184,255,0.28) 50%, rgba(61,127,255,0.10) 58%, transparent 70%)",
          filter: "blur(18px)",
        }}
      />

      {/* The globe */}
      <div
        aria-hidden="true"
        className="absolute inset-[8%] rounded-full bg-cover bg-center"
        style={{
          backgroundImage: "url('/textures/earth-day.jpg')",
          // Raking terminator, matching the scene's sun direction.
          maskImage:
            "linear-gradient(105deg, transparent 0 30%, rgba(0,0,0,0.55) 52%, #000 74%)",
          WebkitMaskImage:
            "linear-gradient(105deg, transparent 0 30%, rgba(0,0,0,0.55) 52%, #000 74%)",
          boxShadow:
            "0 0 70px 6px rgba(111,184,255,0.30), inset -24px -12px 70px rgba(0,0,0,0.92)",
        }}
      />

      {/* Cyan limb */}
      <div
        aria-hidden="true"
        className="absolute inset-[8%] rounded-full"
        style={{ boxShadow: "inset 0 0 22px 1px rgba(111,184,255,0.42)" }}
      />

      {/* Orbit path + satellite */}
      <div
        aria-hidden="true"
        className="absolute inset-[-6%] rounded-full border border-atmos/20"
        style={{ transform: "rotate(-27deg) scaleY(0.34)" }}
      >
        <span
          className="absolute top-0 left-1/2 h-1.5 w-1.5 rounded-full bg-atmos"
          style={{
            boxShadow: "0 0 10px 2px rgba(111,184,255,0.7)",
            animation: animated ? "drift 18s linear infinite" : undefined,
          }}
        />
      </div>
    </div>
  );
}
