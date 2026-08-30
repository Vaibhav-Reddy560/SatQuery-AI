import { useEffect, useRef } from "react";
import type { Map, GeoJSONSource } from "maplibre-gl";
import type { SelectedArea, CursorCoordinates } from "@/types/map";

interface SelectionOverlayProps {
  map: Map | null;
  selectedArea: SelectedArea | null;
  /** Points being drawn in real-time */
  drawingPoints: CursorCoordinates[];
  isDrawing: boolean;
}

const SOURCE_ID = "satquery-selection";
const FILL_LAYER_ID = "satquery-selection-fill";
const LINE_LAYER_ID = "satquery-selection-line";

/**
 * Manages a GeoJSON source + fill/line layers on the MapLibre map
 * to visualise the user's selected area or in-progress drawing.
 */
export function SelectionOverlay({
  map,
  selectedArea,
  drawingPoints,
  isDrawing,
}: SelectionOverlayProps) {
  const drawnRef = useRef(false);

  // Ensure source/layers exist once
  useEffect(() => {
    if (!map || drawnRef.current) return;
    if (map.getSource(SOURCE_ID)) {
      drawnRef.current = true;
      return;
    }

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: emptyFeature(),
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": "#3b82f6",
        "fill-opacity": 0.15,
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#3b82f6",
        "line-width": 2,
        "line-dasharray": [6, 3],
      },
    });

    drawnRef.current = true;
  }, [map]);

  // Update data when selection or drawing changes
  useEffect(() => {
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;

    let geojson: GeoJSONFeature;

    if (isDrawing && drawingPoints.length >= 2) {
      geojson = pointsToPolygonFeature(drawingPoints);
    } else if (selectedArea && selectedArea.coordinates.length >= 2) {
      geojson = pointsToPolygonFeature(selectedArea.coordinates);
    } else {
      geojson = emptyFeature();
    }

    source.setData(geojson);
  }, [map, selectedArea, drawingPoints, isDrawing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      drawnRef.current = false;
    };
  }, [map]);

  return null; // purely side-effect driven
}

// ── Helpers ───────────────────────────────────────────────

type GeoJSONFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: number[][][] };
  properties: Record<string, unknown>;
};

function emptyFeature(): GeoJSONFeature {
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} };
}

function pointsToPolygonFeature(pts: CursorCoordinates[]): GeoJSONFeature {
  // Close the ring if not already closed
  const ring = pts.map((p) => [p.lng, p.lat]);
  if (
    ring[0][0] !== ring[ring.length - 1][0] ||
    ring[0][1] !== ring[ring.length - 1][1]
  ) {
    ring.push([...ring[0]]);
  }

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: {},
  };
}
