import { useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  Send,
  ChevronRight,
} from "lucide-react";
import type { Map } from "maplibre-gl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapControls } from "@/components/map/MapControls";
import { LayerPanel } from "@/components/map/LayerPanel";
import { DrawingToolbar } from "@/components/map/DrawingToolbar";
import { SearchBar } from "@/components/map/SearchBar";
import { CoordinatesDisplay } from "@/components/map/CoordinatesDisplay";
import { SelectionOverlay } from "@/components/map/SelectionOverlay";
import { useMapInteraction } from "@/hooks/useMapInteraction";
import { getActiveTileSource } from "@/lib/tileSources";
import type { CursorCoordinates, TileSource, SelectedArea, DrawTool } from "@/types/map";

const suggestedQueries = [
  "Identify buildings",
  "Find water bodies",
  "Detect vegetation loss",
  "What changed since 2024?",
  "Estimate the area of this lake",
];

export default function Explore() {
  const [queryInput, setQueryInput] = useState("");
  const [activeTileSource] = useState(getActiveTileSource());

  const interaction = useMapInteraction();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  // Points being drawn in real-time
  const [drawingPoints, setDrawingPoints] = useState<CursorCoordinates[]>([]);

  // Refs to avoid stale closures in timeouts
  const isDrawingRef = useRef(false);
  const drawPointsRef = useRef<CursorCoordinates[]>([]);
  const lastClickTimeRef = useRef(0);
  const finishDrawingRef = useRef(interaction.finishDrawing);
  finishDrawingRef.current = interaction.finishDrawing;

  // Keep refs in sync
  isDrawingRef.current = interaction.isDrawing;
  drawPointsRef.current = drawingPoints;

  // ── Map event handlers ─────────────────────────────────

  const handleCursorMove = useCallback(
    (c: CursorCoordinates) => interaction.setCursorCoords(c),
    [interaction.setCursorCoords]
  );

  const handleViewChange = useCallback(
    (_c: CursorCoordinates, z: number) => interaction.setZoom(z),
    [interaction.setZoom]
  );

  const handleClick = useCallback(
    (c: CursorCoordinates) => {
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;
      lastClickTimeRef.current = now;

      // Double-click detection (≤ 350 ms between clicks)
      if (isDrawingRef.current && timeSinceLastClick < 350) {
        finishDrawingRef.current();
        setDrawingPoints([]);
        return;
      }

      if (interaction.activeDrawTool === "none") return;

      if (!isDrawingRef.current) {
        interaction.startDrawing();
        setDrawingPoints([c]);
      } else {
        setDrawingPoints((prev) => [...prev, c]);
      }
    },
    [interaction.activeDrawTool, interaction.isDrawing, interaction.startDrawing, interaction.finishDrawing]
  );

  const handleToolChange = useCallback(
    (tool: DrawTool) => {
      if (interaction.isDrawing) {
        interaction.cancelDrawing();
        setDrawingPoints([]);
      }
      interaction.setActiveDrawTool(tool);
    },
    [interaction]
  );

  const handleClearSelection = useCallback(() => {
    interaction.clearSelection();
    setDrawingPoints([]);
    interaction.cancelDrawing();
  }, [interaction]);

  const handleBaseLayerChange = useCallback((_src: TileSource) => {
    // Future: swap the raster source on the live map instance
  }, []);

  const handleLocationSelect = useCallback((coords: CursorCoordinates) => {
    const el = mapContainerRef.current;
    const helpers = (el as any)?.__satqueryMap;
    helpers?.flyTo?.(coords.lng, coords.lat, 12);
  }, []);

  const handleMapReady = useCallback((_map: Map) => {
    // Map instance is now available via mapContainerRef.__satqueryMap
  }, []);

  // ── Derived state ──────────────────────────────────────

  const selectedArea: SelectedArea | null = interaction.selectedArea;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 -m-6 p-0 min-h-0">
      {/* ── Map Area ─────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-bg-primary rounded-lg border border-border-subtle">
        <div ref={mapContainerRef} className="absolute inset-0">
          <MapCanvas
            center={{ lat: 20.5937, lng: 78.9629 }}
            zoom={5}
            onCursorMove={handleCursorMove}
            onViewChange={handleViewChange}
            onClick={handleClick}
            onMapReady={handleMapReady}
            className="w-full h-full"
          />

          <SelectionOverlay
            map={mapInstanceRef.current}
            selectedArea={selectedArea}
            drawingPoints={drawingPoints}
            isDrawing={interaction.isDrawing}
          />
        </div>

        {/* ── Floating Search ───────────────────────────── */}
        <div className="absolute top-4 left-4 right-4 md:right-auto md:w-80 z-10">
          <SearchBar onLocationSelect={handleLocationSelect} />
        </div>

        {/* ── Layer Selector ────────────────────────────── */}
        <div className="absolute top-4 right-4 z-10">
          <LayerPanel onBaseLayerChange={handleBaseLayerChange} />
        </div>

        {/* ── Zoom / Fullscreen Controls ────────────────── */}
        <div className="absolute top-4 right-14 z-10">
          <MapControls mapContainerRef={mapContainerRef} />
        </div>

        {/* ── Coordinates Display ───────────────────────── */}
        <CoordinatesDisplay
          cursorCoords={interaction.cursorCoords}
          zoom={interaction.zoom}
          className="absolute bottom-4 left-4 z-10"
        />

        {/* ── Drawing Toolbar ───────────────────────────── */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <DrawingToolbar
            activeTool={interaction.activeDrawTool}
            onToolChange={handleToolChange}
            onClearSelection={handleClearSelection}
            hasSelection={!!selectedArea}
          />
        </div>

        {/* ── Drawing hint ──────────────────────────────── */}
        {interaction.isDrawing && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 text-xs text-text-muted bg-bg-primary/80 px-3 py-1.5 rounded backdrop-blur-sm border border-border-subtle">
            Click to add points &middot; Double-click to finish
          </div>
        )}
      </div>

      {/* ── Right Analysis Panel ───────────────────────── */}
      <div className="w-80 flex-shrink-0 hidden xl:flex flex-col gap-4 overflow-y-auto">
        {/* Ask About Area */}
        <Card className="flex-shrink-0">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">Ask about this area</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Ask a question about the selected imagery..."
                className="flex-1 px-3 py-2 text-sm bg-bg-primary border border-border-default rounded-md text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
              />
              <button className="p-2 bg-accent rounded-md text-white hover:bg-accent-hover transition-colors" aria-label="Send query">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* Suggested Queries */}
        <Card className="flex-shrink-0">
          <div className="p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Suggested Queries</h4>
            <div className="space-y-1.5">
              {suggestedQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setQueryInput(q)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-text-secondary rounded-md hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <ChevronRight className="h-3 w-3 text-text-muted shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Selection Info */}
        <Card className="flex-shrink-0">
          <div className="p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Selection Info</h4>
            {selectedArea ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Selected area</span>
                  <span className="text-text-primary font-medium">{selectedArea.areaKm2.toLocaleString()} km²</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Centre</span>
                  <span className="text-text-primary font-mono text-xs">
                    {selectedArea.center.lat.toFixed(2)}°, {selectedArea.center.lng.toFixed(2)}°
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Points</span>
                  <span className="text-text-primary font-medium">{selectedArea.coordinates.length}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-muted">
                {interaction.isDrawing
                  ? "Click on the map to define your selection area."
                  : "Use the drawing tools to select an area on the map."}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <h5 className="text-xs text-text-muted mb-2">Available layers</h5>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="info">Satellite</Badge>
                <Badge>NDVI</Badge>
                <Badge>Thermal</Badge>
                <Badge>Labels</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
