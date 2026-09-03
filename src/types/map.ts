// ── Map Tile Source ───────────────────────────────────────

export interface TileSource {
  id: string;
  name: string;
  /** Raster tile URL template (supports {z}/{x}/{y}) or vector style URL */
  url: string;
  type: "raster" | "vector";
  /** Attribution string shown on the map */
  attribution: string;
  /** Max zoom level */
  maxZoom?: number;
  /** Logical tile size. 256 for true 1x tiles; 512-into-256 for `@2x` retina
      variants. Declared per source — assuming one value for all of them is
      what made non-retina sources render soft. */
  tileSize?: number;
}

// ── Map Cursor Coordinates ────────────────────────────────

export interface CursorCoordinates {
  lat: number;
  lng: number;
}

// ── Drawing / Selection ───────────────────────────────────

export type DrawTool = "none" | "rectangle" | "polygon" | "circle" | "freehand";

export interface SelectedArea {
  /** GeoJSON-like coordinates of the selection */
  coordinates: CursorCoordinates[];
  /** Area in square kilometres (approximate) */
  areaKm2: number;
  /** Centre of the selection */
  center: CursorCoordinates;
}

// ── Map Interaction State ─────────────────────────────────

export interface MapInteractionState {
  cursorCoords: CursorCoordinates | null;
  zoom: number;
  activeDrawTool: DrawTool;
  selectedArea: SelectedArea | null;
  isDrawing: boolean;
}

// ── Map Component Props ───────────────────────────────────

export interface MapCanvasProps {
  /** Initial centre of the map */
  center?: CursorCoordinates;
  /** Initial zoom level */
  zoom?: number;
  /** Tile source id to use as the base layer */
  baseLayerId?: string;
  /** Called whenever the map view (centre/zoom) changes */
  onViewChange?: (center: CursorCoordinates, zoom: number) => void;
  /** Called when a selection is completed */
  onAreaSelect?: (area: SelectedArea) => void;
  /** Additional CSS class on the container */
  className?: string;
}
