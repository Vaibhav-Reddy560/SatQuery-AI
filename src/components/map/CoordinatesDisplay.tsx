import { Readout } from "@/components/ui/Readout";
import { cn, SCREEN_BEZEL } from "@/lib/utils";
import type { CursorCoordinates } from "@/types/map";

interface CoordinatesDisplayProps {
  cursorCoords: CursorCoordinates | null;
  zoom: number;
  className?: string;
}

/**
 * Bottom-left overlay showing cursor coordinates and current zoom level.
 *
 * A real CRT readout now — `crt` scanlines over a `bg-bg-primary` screen
 * with the same steel `SCREEN_BEZEL` every other instrument panel in the
 * app uses, not a grey hardware-key pill with phosphor text pasted on top
 * of it. The telemetry typography (`Readout`) is unchanged; only the
 * housing it sits in changed materials, from chrome button to CRT screen.
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

  const lat = cursorCoords ? formatCoord(cursorCoords.lat, "N", "S") : "—";
  const lng = cursorCoords ? formatCoord(cursorCoords.lng, "E", "W") : "—";

  return (
    <div
      className={cn("crt select-none rounded-md bg-bg-primary px-2.5 py-1.5", className)}
      style={{ boxShadow: SCREEN_BEZEL }}
    >
      <Readout
        items={[
          { label: "LAT", value: lat },
          { label: "LON", value: lng },
          { label: "Z", value: zoom.toFixed(1) },
        ]}
      />
    </div>
  );
}
