import { useCallback, useRef, useState } from "react";
import type {
  CursorCoordinates,
  DrawTool,
  SelectedArea,
} from "@/types/map";

/**
 * Manages map interaction state: cursor position, draw tools, area selection.
 *
 * This hook is *state-only* — it does not touch the MapLibre instance.
 * The MapCanvas component reads its setters to wire up map events.
 */
export function useMapInteraction() {
  const [cursorCoords, setCursorCoords] = useState<CursorCoordinates | null>(null);
  const [zoom, setZoom] = useState(5);
  const [activeDrawTool, setActiveDrawTool] = useState<DrawTool>("none");
  const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Accumulated points while user is drawing
  const drawPointsRef = useRef<CursorCoordinates[]>([]);

  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    drawPointsRef.current = [];
  }, []);

  const addDrawPoint = useCallback((point: CursorCoordinates) => {
    drawPointsRef.current.push(point);
  }, []);

  const finishDrawing = useCallback((): SelectedArea | null => {
    const pts = drawPointsRef.current;
    setIsDrawing(false);
    drawPointsRef.current = [];

    if (pts.length < 2) return null;

    // Compute bounding box
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const north = Math.max(...lats);
    const south = Math.min(...lats);
    const east = Math.max(...lngs);
    const west = Math.min(...lngs);

    // Approximate centre
    const center: CursorCoordinates = {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    };

    // Approximate area via Haversine on bounding box
    const areaKm2 = approximateAreaKm2(north, south, east, west);

    const area: SelectedArea = {
      coordinates: pts,
      areaKm2: Math.round(areaKm2 * 100) / 100,
      center,
    };

    setSelectedArea(area);
    setActiveDrawTool("none");
    return area;
  }, []);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    drawPointsRef.current = [];
    setActiveDrawTool("none");
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedArea(null);
  }, []);

  return {
    cursorCoords,
    setCursorCoords,
    zoom,
    setZoom,
    activeDrawTool,
    setActiveDrawTool,
    selectedArea,
    setSelectedArea,
    isDrawing,
    startDrawing,
    addDrawPoint,
    finishDrawing,
    cancelDrawing,
    clearSelection,
  };
}

// ── Helpers ───────────────────────────────────────────────

/** Very rough area via Haversine on bounding-box corners. Good enough for UI. */
function approximateAreaKm2(
  north: number,
  south: number,
  east: number,
  west: number
): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(north - south);
  const dLng = toRad(east - west);
  const avgLat = toRad((north + south) / 2);

  const h = dLat * R;
  const w = dLng * R * Math.cos(avgLat);

  return Math.abs(h * w);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
