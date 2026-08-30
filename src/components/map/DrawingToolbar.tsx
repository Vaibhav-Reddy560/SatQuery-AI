import { Pencil, Type, Circle, Square, Trash2, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrawTool } from "@/types/map";

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
        "flex items-center gap-1 bg-bg-secondary/90 border border-border-default rounded-lg p-1 backdrop-blur-sm",
        className
      )}
    >
      {/* Draw tools */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolChange(isActive ? "none" : tool.id)}
            className={cn(
              "p-2 rounded-md transition-colors",
              isActive
                ? "bg-accent-muted text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
            title={tool.label}
            aria-label={`Draw ${tool.label}`}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}

      <div className="w-px h-6 bg-border-default mx-1" aria-hidden="true" />

      {/* Measure (placeholder) */}
      <button
        className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        title="Measure"
        aria-label="Measure distance"
      >
        <Ruler className="h-4 w-4" />
      </button>

      {/* Clear selection */}
      {hasSelection && (
        <button
          onClick={onClearSelection}
          className="p-2 rounded-md text-danger hover:bg-danger-muted transition-colors"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
