import { Pencil, Type, Circle, Square, Trash2, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrawTool } from "@/types/map";
import { Tooltip } from "@/components/ui/Tooltip";

interface DrawingToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  onClearSelection?: () => void;
  hasSelection?: boolean;
  className?: string;
}

interface ToolDef {
  id: DrawTool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const tools: ToolDef[] = [
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "polygon", icon: Pencil, label: "Polygon" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "freehand", icon: Type, label: "Freehand" },
];

/**
 * Bottom-center floating toolbar for drawing selections and measuring.
 */
export function DrawingToolbar({
  activeTool,
  onToolChange,
  onClearSelection,
  hasSelection,
  className,
}: DrawingToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg chrome shadow-overlay p-1",
        className
      )}
    >
      {/* Draw tools — the same rest/active pair as every segmented control
          in the app (`Measurements.tsx`'s tool selector, the sidebar's
          current-page pill): `bevel` raised at rest, `bevel-in` pressed. The
          active tool used to be a flat `bg-accent-muted` tint with no
          `bevel-in` at all — the one segmented control on the whole app that
          didn't read as a pressed key. */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <Tooltip key={tool.id} content={tool.label}>
            <button
              onClick={() => onToolChange(isActive ? "none" : tool.id)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150",
                isActive
                  ? "bevel-in bg-accent-muted text-accent"
                  : "bevel bg-bg-hover text-text-primary hover:bg-bg-hover/70"
              )}
              aria-label={`Draw ${tool.label}`}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
            </button>
          </Tooltip>
        );
      })}

      <div className="w-px h-6 bg-chrome-seam mx-1" aria-hidden="true" />

      {/* Measure (placeholder) */}
      <Tooltip content="Measure">
        <button
          className="bevel flex h-9 w-9 items-center justify-center rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
          aria-label="Measure distance"
        >
          <Ruler className="h-4 w-4" />
        </button>
      </Tooltip>

      {/* Clear selection — kept off the hardware-key language on purpose:
          danger is a distinct, rare action and shouldn't read as just
          another key in the row. */}
      {hasSelection && (
        <Tooltip content="Clear selection">
          <button
            onClick={onClearSelection}
            className="flex h-9 w-9 items-center justify-center rounded-md text-danger hover:bg-danger-muted transition-colors duration-150"
            aria-label="Clear selection"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
