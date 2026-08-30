import { Plus, Minus, Maximize2, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Map } from "maplibre-gl";

interface MapControlsProps {
  /** Ref to the MapLibre instance (from MapCanvas's container.__satqueryMap) */
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

/**
 * Floating map controls: zoom in, zoom out, fullscreen.
 * Reads the MapLibre instance from the container's __satqueryMap helper.
 */
export function MapControls({ mapContainerRef, className }: MapControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getMap = useCallback((): Map | null => {
    const el = mapContainerRef.current;
    return (el as any)?.__satqueryMap?.getMap?.() ?? null;
  }, [mapContainerRef]);

  const zoomIn = useCallback(() => getMap()?.zoomIn(), [getMap]);
  const zoomOut = useCallback(() => getMap()?.zoomOut(), [getMap]);

  const toggleFullscreen = useCallback(() => {
    const mapEl = mapContainerRef.current?.parentElement;
    if (!mapEl) return;

    if (!document.fullscreenElement) {
      mapEl.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, [mapContainerRef]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const btnClass =
    "p-2 bg-bg-secondary/90 border border-border-default rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors backdrop-blur-sm";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button onClick={zoomIn} className={btnClass} title="Zoom in" aria-label="Zoom in">
        <Plus className="h-4 w-4" />
      </button>
      <button onClick={zoomOut} className={btnClass} title="Zoom out" aria-label="Zoom out">
        <Minus className="h-4 w-4" />
      </button>
      <button
        onClick={toggleFullscreen}
        className={btnClass}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Maximize className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
