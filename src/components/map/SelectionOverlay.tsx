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
  const dataRef = useRef<GeoJSONFeature>(emptyFeature());

  // Ensure source/layers exist, and keep putting them back. `map` arrives the
  // instant MapCanvas constructs the MapLibre instance (`onMapReady`), well
  // before its style finishes loading (that's an async fetch) — calling
  // `addSource` unconditionally threw "Style is not done loading" on load,
  // uncaught, which took down the whole app via the root ErrorBoundary.
  //
  // This also has to survive `map.setStyle()` — MapCanvas calls that when
  // switching to or from the OpenFreeMap vector basemap, and `setStyle`
  // discards every source/layer that isn't part of the incoming style
  // document, this one included. A one-shot `useEffect` on `[map]` would
  // only ever run once for the same `map` instance and never notice. Listen
  // on `styledata` instead, for the life of the component, and re-add
  // whenever the source is missing; `setData` below restores whatever was
  // being shown right before the style swapped it out.
  useEffect(() => {
    if (!map) return;

    const setup = () => {
      if (!map.isStyleLoaded() || map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: dataRef.current,
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "#6fb8ff",
          "fill-opacity": 0.15,
        },
      });

      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#6fb8ff",
          "line-width": 2,
          "line-dasharray": [6, 3],
        },
      });
    };

    setup();
    map.on("styledata", setup);
    return () => {
      map.off("styledata", setup);
    };
  }, [map]);

  // Update data when selection or drawing changes. Kept in `dataRef` too, so
  // the `styledata` handler above can restore the current shape rather than
  // an empty one after a style swap wipes the source out.
  useEffect(() => {
    let geojson: GeoJSONFeature;

    if (isDrawing && drawingPoints.length >= 2) {
      geojson = pointsToPolygonFeature(drawingPoints);
    } else if (selectedArea && selectedArea.coordinates.length >= 2) {
      geojson = pointsToPolygonFeature(selectedArea.coordinates);
    } else {
      geojson = emptyFeature();
    }
    dataRef.current = geojson;

    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(geojson);
  }, [map, selectedArea, drawingPoints, isDrawing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
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
