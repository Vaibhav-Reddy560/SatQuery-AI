import { Plus, Minus, Maximize2, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import type { Map } from "maplibre-gl";
import { Tooltip } from "@/components/ui/Tooltip";

interface MapControlsProps {
  /** The live MapLibre instance — `null` until `MapCanvas`'s `onMapReady`
      fires. Zoom in/out are no-ops until then. */
  map: Map | null;
  /** Ref to the DOM element to fullscreen — the whole map area (canvas +
      HUD overlays), not just the raw MapLibre canvas, so the fullscreen
      view keeps its instrument frame. */
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

/**
 * Floating map controls: zoom in, zoom out, fullscreen.
 *
 * Reads the MapLibre instance directly from the `map` prop now — it used to
 * fish it out of a `__satqueryMap` object `MapCanvas` stashed on a DOM node,
 * but that node was `MapCanvas`'s own internal container div, a CHILD of
 * the `mapContainerRef` element this component was actually looking on. The
 * lookup always missed, silently: zoom in/out and "fly to search result"
 * did nothing, with no error anywhere. `Explore.tsx` already tracks the
 * instance via `onMapReady` — passing it straight through as a prop needs
 * no DOM side-channel and can't drift out of sync with the real map.
 */
export function MapControls({ map, mapContainerRef, className }: MapControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const zoomIn = useCallback(() => map?.zoomIn(), [map]);
  const zoomOut = useCallback(() => map?.zoomOut(), [map]);

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

  // The sidebar's hardware-key language, not the map's old chrome-capsule +
  // `bg-chrome-mid/50` hover — this page is getting the same treatment every
  // other one already has. White icon throughout, no hover colour shift
  // (per the standing rule: the icon reads a state, the background does the
  // hover feedback) — only the `bevel`/`hover:bg-bg-hover/70` responds.
  const btnClass =
    "bevel flex items-center justify-center h-9 w-9 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70";

  return (
    // The `chrome` shell stays — it's the housing every other cluster on
    // this page sits in (`DrawingToolbar`, `LayerPanel`). Each key gets its
    // own `bevel` now, so the old hairline seams between them are gone —
    // a bevel border next to a divider line was one edge too many.
    <div className={cn("flex flex-col gap-1 chrome rounded-lg p-1 shadow-overlay", className)}>
      <Tooltip content="Zoom in" side="left">
        <button onClick={zoomIn} className={btnClass} aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip content="Zoom out" side="left">
        <button onClick={zoomOut} className={btnClass} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"} side="left">
        <button
          onClick={toggleFullscreen}
          className={btnClass}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Maximize className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </Tooltip>
    </div>
  );
}
