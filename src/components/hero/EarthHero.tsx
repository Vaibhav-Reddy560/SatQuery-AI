import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { EarthFallback } from "./EarthFallback";
import { cn } from "@/lib/utils";

// three + R3F + drei are ~225KB gz and live in their own chunk. Nothing about
// them enters the entry graph.
const EarthScene = lazy(() => import("./EarthScene"));

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function EarthHero({
  className,
  userPaused = false,
  speed = 1,
  zoom = 1,
}: {
  className?: string;
  /** Console play/pause control. Deliberately NOT ORed into the `paused`
      prop below (which stops the R3F render loop entirely via
      `frameloop: "never"`) — that would also freeze the camera-dolly
      `useFrame` loop the zoom control depends on, so pausing would make
      zoom stop responding too. Zeroing `speed` instead freezes the visible
      rotation/orbit while leaving the frame loop (zoom, pointer parallax)
      running. */
  userPaused?: boolean;
  /** Rotation/orbit speed multiplier — the console's speed control. */
  speed?: number;
  /** Camera dolly multiplier (>1 = closer) — the console's zoom control. */
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Lazy initialiser: evaluated once, on the client, before first paint.
  const [webgl] = useState<boolean>(() => hasWebGL());
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Honour the OS reduced-motion setting, and react if it changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Stop rendering when scrolled away.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Stop rendering when the tab is backgrounded.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {webgl ? (
        <Suspense fallback={<EarthFallback animated={false} />}>
          <div className="absolute inset-0">
            <EarthScene
              paused={!visible || hidden}
              reducedMotion={reduced}
              speed={userPaused ? 0 : speed}
              zoom={zoom}
            />
          </div>
        </Suspense>
      ) : (
        <EarthFallback animated={!reduced && !userPaused} />
      )}
    </div>
  );
}
