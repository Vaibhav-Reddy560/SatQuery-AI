import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIEW_MODES, isVectorMode, type ViewMode } from "@/lib/tileSources";
import { Tooltip } from "@/components/ui/Tooltip";

interface LayerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
  className?: string;
}

/**
 * Floating layer selector.
 *
 * `viewMode`/`showLabels` are owned by `Explore.tsx` and passed in rather
 * than kept here — the exact same state also renders as the inspector's
 * "Layers" chips (`InspectorPanels`), and two independent pieces of state
 * for one selection was the bug that made the dropdown and the chips fall
 * out of sync with each other.
 *
 * The old "Overlays" section (Terrain / Boundaries / Place Labels /
 * Satellite Imagery, toggled through a Zustand slice) is gone — nothing
 * ever read that state to change the map, so toggling those checkboxes was
 * a checkbox that did nothing.
 */
export function LayerPanel({
  open,
  onOpenChange,
  viewMode,
  onViewModeChange,
  showLabels,
  onShowLabelsChange,
  className,
}: LayerPanelProps) {
  return (
    <div className={cn("relative", className)}>
      <Tooltip content="Toggle layers" side="left">
        <button
          onClick={() => onOpenChange(!open)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150",
            open
              ? "bevel-in bg-accent-muted text-accent"
              : "bevel bg-bg-hover text-text-primary hover:bg-bg-hover/70 shadow-overlay"
          )}
          aria-label="Toggle layers panel"
          aria-expanded={open}
        >
          <Layers className="h-4 w-4" />
        </button>
      </Tooltip>

      {open && (
        // Opens `left-0` (aligned to the trigger's left edge, extending
        // right) — the trigger now sits in the left-hand control column, so
        // this is the direction with map underneath it, not the inspector
        // aside anchored to the right edge.
        <div className="absolute top-full left-0 mt-2 w-56 rounded-lg chrome shadow-overlay p-2 z-10">
          {/* `text-white/70`, not the standard `text-text-faint` eyebrow —
              that token is near-black and reads fine on near-black
              backgrounds, but this dropdown sits on the lighter blue-steel
              `chrome` gradient, where it was reported as invisible (same
              fix as the inspector's "Selection"/"Layers" headers). */}
          <div className="text-label uppercase text-white/70 px-2 py-1 mb-1">View</div>
          <div className="space-y-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onViewModeChange(mode.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-md text-body-sm text-left transition-colors duration-150",
                  viewMode === mode.id
                    ? "bevel-in bg-accent-muted text-accent"
                    : "bevel bg-bg-hover text-text-primary hover:bg-bg-hover/70"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="h-px bg-chrome-seam my-2" />

          <div className="text-label uppercase text-white/70 px-2 py-1 mb-1">Overlay</div>
          {/* `aria-disabled`, not the native `disabled` attribute — a truly
              disabled button stops firing pointer/focus events in most
              browsers, which would silently kill the Tooltip explaining WHY
              it's disabled right when it's most needed. */}
          <Tooltip
            content={isVectorMode(viewMode) ? "The map view already shows labels" : "Place names and boundaries"}
            side="left"
          >
            <button
              onClick={() => !isVectorMode(viewMode) && onShowLabelsChange(!showLabels)}
              aria-disabled={isVectorMode(viewMode)}
              aria-pressed={showLabels}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-md text-body-sm text-left transition-colors duration-150",
                isVectorMode(viewMode) && "opacity-40 cursor-not-allowed",
                showLabels
                  ? "bevel-in bg-accent-muted text-accent"
                  : "bevel bg-bg-hover text-text-primary hover:bg-bg-hover/70"
              )}
            >
              Labels
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
