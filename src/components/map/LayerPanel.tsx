import { useState } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { TILE_SOURCES, getActiveTileSource } from "@/lib/tileSources";
import type { TileSource } from "@/types/map";

interface LayerPanelProps {
  /** Called when the user picks a different base tile source */
  onBaseLayerChange?: (source: TileSource) => void;
  className?: string;
}

/**
 * Floating layer selector.
 * - Base layers: swap the raster tile source
 * - Overlays: toggle via Zustand store
 */
export function LayerPanel({ onBaseLayerChange, className }: LayerPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeBaseId, setActiveBaseId] = useState(getActiveTileSource().id);
  const mapLayers = useAppStore((s) => s.mapLayers);
  const toggleMapLayer = useAppStore((s) => s.toggleMapLayer);

  const handleBaseSelect = (src: TileSource) => {
    setActiveBaseId(src.id);
    onBaseLayerChange?.(src);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "p-2.5 rounded-lg border backdrop-blur-sm transition-colors",
          open
            ? "bg-bg-secondary border-accent text-accent"
            : "bg-bg-secondary/90 border-border-default text-text-secondary hover:text-text-primary"
        )}
        title="Toggle layers"
        aria-label="Toggle layers panel"
        aria-expanded={open}
      >
        <Layers className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-bg-secondary border border-border-default rounded-lg shadow-xl p-2 z-10">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 py-1 mb-1">
            Base Layers
          </div>
          {Object.values(TILE_SOURCES).map((src) => (
            <button
              key={src.id}
              onClick={() => handleBaseSelect(src)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm text-left rounded-md hover:bg-bg-hover transition-colors"
            >
              <div
                className={cn(
                  "w-3 h-3 rounded-full border-2",
                  activeBaseId === src.id
                    ? "border-accent bg-accent"
                    : "border-border-default bg-bg-primary"
                )}
              />
              <span
                className={cn(
                  activeBaseId === src.id ? "text-text-primary" : "text-text-secondary"
                )}
              >
                {src.name}
              </span>
            </button>
          ))}

          <div className="h-px bg-border-subtle my-2" />

          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 py-1 mb-1">
            Overlays
          </div>
          {mapLayers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => toggleMapLayer(layer.id)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm text-left rounded-md hover:bg-bg-hover transition-colors"
            >
              <div
                className={cn(
                  "w-3 h-3 rounded-sm border",
                  layer.visible
                    ? "bg-accent border-accent"
                    : "border-border-default bg-bg-primary"
                )}
              />
              <span className={cn(layer.visible ? "text-text-primary" : "text-text-muted")}>
                {layer.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
