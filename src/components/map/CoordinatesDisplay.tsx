import { cn } from "@/lib/utils";
import type { CursorCoordinates } from "@/types/map";

interface CoordinatesDisplayProps {
  cursorCoords: CursorCoordinates | null;
  zoom: number;
  className?: string;
}

/**
 * Bottom-left overlay showing cursor coordinates and current zoom level.
 */
export function CoordinatesDisplay({
  cursorCoords,
  zoom,
  className,
}: CoordinatesDisplayProps) {
  const formatCoord = (val: number, pos: string, neg: string) => {
    const dir = val >= 0 ? pos : neg;
    return `${Math.abs(val).toFixed(4)}°${dir}`;
  };

  const lat = cursorCoords
    ? formatCoord(cursorCoords.lat, "N", "S")
    : "—";
  const lng = cursorCoords
    ? formatCoord(cursorCoords.lng, "E", "W")
    : "—";

  return (
    <div
      className={cn(
        "text-[10px] text-text-muted font-mono bg-bg-primary/80 px-2 py-1 rounded backdrop-blur-sm border border-border-subtle select-none",
        className
      )}
    >
      {lat}, {lng} &middot; Zoom: {zoom.toFixed(1)}
    </div>
  );
}
