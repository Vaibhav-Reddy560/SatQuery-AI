import { useState, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import {
  Send,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Map } from "maplibre-gl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Num, Km2 } from "@/components/ui/Num";
import { HudFrame } from "@/components/ui/HudFrame";
import { Reticle } from "@/components/ui/Reticle";
import { ease, dur } from "@/lib/motion";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapControls } from "@/components/map/MapControls";
import { LayerPanel } from "@/components/map/LayerPanel";
import { DrawingToolbar } from "@/components/map/DrawingToolbar";
import { SearchBar } from "@/components/map/SearchBar";
import { CoordinatesDisplay } from "@/components/map/CoordinatesDisplay";
import { SelectionOverlay } from "@/components/map/SelectionOverlay";
import { useMapInteraction } from "@/hooks/useMapInteraction";
import { VIEW_MODES, isVectorMode, type ViewMode } from "@/lib/tileSources";
import type { CursorCoordinates, SelectedArea, DrawTool } from "@/types/map";

const suggestedQueries = [
  "Identify buildings",
  "Find water bodies",
  "Detect vegetation loss",
  "What changed since 2024?",
  "Estimate the area of this lake",
];

interface InspectorPanelsProps {
  queryInput: string;
  onQueryInputChange: (v: string) => void;
  selectedArea: SelectedArea | null;
  isDrawing: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
}

/**
 * The "Ask about this area" + "Selection" panels.
 *
 * Extracted so the exact same content renders both in the desktop floating
 * aside (>=xl) and inside the mobile/tablet sheet below xl — previously this
 * whole block was `hidden ... xl:flex`, so drawing an area on a tablet
 * produced no measurements and offered no query field at all.
 */
function InspectorPanels({
  queryInput,
  onQueryInputChange,
  selectedArea,
  isDrawing,
  viewMode,
  onViewModeChange,
  showLabels,
  onShowLabelsChange,
}: InspectorPanelsProps) {
  return (
    <>
      <div className="chrome rounded-lg p-5">
        <h3 className="text-subheading text-text-primary">Ask about this area</h3>
        <div className="mt-4 flex gap-2">
          {/* Recessed into the card, the same "screen sunk into the
              console" language as `SearchBar` — a flat `bg-bg-tertiary`
              fill on a `chrome` card read as floating on it, not set into
              it. */}
          <Input
            value={queryInput}
            onChange={(e) => onQueryInputChange(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Ask about the selected area"
            className="h-10 bg-bg-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
          />
          <Button variant="primary" size="md" iconOnly aria-label="Send query">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 space-y-1.5">
          {/* Solid `bg-bg-hover` + `hover:bg-bg-hover/70` — the standard
              hardware-key direction. This used to sit at `bg-bg-hover/40`
              and brighten ON hover, the one control on the page going the
              wrong way. */}
          {suggestedQueries.map((q) => (
            <button
              key={q}
              onClick={() => onQueryInputChange(q)}
              className="bevel flex w-full items-center gap-2 rounded-md bg-bg-hover px-2.5 py-2 text-left text-body-sm text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
            >
              <ChevronRight className="h-3 w-3 shrink-0" />
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="chrome rounded-lg p-5">
        {/* `text-white/70`, not the standard `text-text-faint` eyebrow —
            that token is near-black (#47474b) and reads fine on the
            near-black `bg-primary`/CRT panels it's normally used on, but
            this card's background is the lighter blue-steel `chrome`
            gradient, where it was reported as effectively invisible.
            Same reasoning applies to `LayerPanel`'s own "View"/"Overlay"
            headers below, on the identical `chrome` material. */}
        <div className="text-label uppercase text-white/70">Selection</div>
        {selectedArea ? (
          <dl className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm text-text-secondary">Area</dt>
              <dd className="text-[1.375rem] font-thin tracking-tight text-text-primary">
                <Km2 value={selectedArea.areaKm2} decimals={1} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm text-text-secondary">Centre</dt>
              <dd className="text-body-sm text-text-primary">
                <Num value={selectedArea.center.lat} decimals={3} suffix="°" />
                {", "}
                <Num value={selectedArea.center.lng} decimals={3} suffix="°" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm text-text-secondary">Vertices</dt>
              <dd className="text-body-sm text-text-primary">
                <Num value={selectedArea.coordinates.length} />
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-body-sm leading-relaxed text-text-secondary">
            {isDrawing
              ? "Click on the map to define your area."
              : "Use the drawing tools below to select an area."}
          </p>
        )}

        {/* Real controls now, not static `<Badge>` spans with no click
            handler — this is the same `viewMode`/`showLabels` state the
            floating `LayerPanel` dropdown reads and writes, so the two
            surfaces can never disagree about which layer is active.
            Section break is plain spacing now, not a `border-t` — on the
            `chrome` gradient that hairline rendered as a soft, blurred-
            looking dark smear rather than a crisp divider. */}
        <div className="mt-5 pt-4">
          <div className="text-label uppercase text-white/70 mb-2.5">Layers</div>
          <div className="flex flex-wrap gap-1.5">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onViewModeChange(mode.id)}
                aria-pressed={viewMode === mode.id}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold leading-none tracking-[0.01em] transition-colors duration-150",
                  viewMode === mode.id
                    ? "bevel-in bg-accent-muted text-accent"
                    : "bevel bg-bg-hover text-text-secondary hover:bg-bg-hover/70 hover:text-text-primary"
                )}
              >
                {mode.label}
              </button>
            ))}
            <button
              onClick={() => !isVectorMode(viewMode) && onShowLabelsChange(!showLabels)}
              aria-pressed={showLabels}
              aria-disabled={isVectorMode(viewMode)}
              title={isVectorMode(viewMode) ? "The map view already shows labels" : undefined}
              className={cn(
                "px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold leading-none tracking-[0.01em] transition-colors duration-150",
                isVectorMode(viewMode) && "opacity-40 cursor-not-allowed",
                showLabels
                  ? "bevel-in bg-accent-muted text-accent"
                  : "bevel bg-bg-hover text-text-secondary hover:bg-bg-hover/70 hover:text-text-primary"
              )}
            >
              Labels
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Mobile/tablet trigger + bottom sheet for the inspector, shown below `xl`
 * where the floating aside is hidden. Built on Radix Dialog for the focus
 * trap, Escape, and scroll lock the app's other overlays already get.
 */
function InspectorSheet(props: InspectorPanelsProps) {
  const [open, setOpen] = useState(false);
  const hasSelection = !!props.selectedArea;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="absolute bottom-4 right-4 z-10 flex xl:hidden items-center gap-2 h-11 px-4 rounded-full chrome shadow-overlay text-body-sm font-medium text-text-primary"
          aria-label="Open area inspector"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Inspect
          {hasSelection && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.fast }}
                className="fixed inset-0 z-[90] bg-bg-primary/70 backdrop-blur-sm xl:hidden"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: dur.base, ease: ease.apple }}
                className="fixed inset-x-0 bottom-0 z-[95] max-h-[80vh] overflow-y-auto rounded-t-xl glass shadow-modal p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 xl:hidden"
              >
                <div className="flex items-center justify-between mb-1">
                  <Dialog.Title className="text-subheading text-text-primary">Area inspector</Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="bevel flex items-center justify-center h-8 w-8 rounded-md bg-bg-hover text-text-primary transition-colors duration-150 hover:bg-bg-hover/70"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
                <InspectorPanels {...props} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default function Explore() {
  const [queryInput, setQueryInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("satellite");
  const [showLabels, setShowLabels] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);

  const interaction = useMapInteraction();
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setLayerPanelOpen(false);
  }, []);

  const handleLocationSelect = useCallback(
    (coords: CursorCoordinates) => {
      mapInstance?.flyTo({ center: [coords.lng, coords.lat], zoom: 12, duration: 800 });
    },
    [mapInstance]
  );

  const handleMapReady = useCallback((map: Map) => {
    setMapInstance(map);
  }, []);

  // ── Derived state ──────────────────────────────────────

  const selectedArea: SelectedArea | null = interaction.selectedArea;

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl bg-bg-primary">
      <h1 className="sr-only">Explore</h1>
      <div ref={mapContainerRef} className="absolute inset-0">
        <MapCanvas
          center={{ lat: 20.5937, lng: 78.9629 }}
          zoom={5}
          viewMode={viewMode}
          showLabels={showLabels}
          onCursorMove={handleCursorMove}
          onViewChange={handleViewChange}
          onClick={handleClick}
          onMapReady={handleMapReady}
          className="w-full h-full"
        />

        <SelectionOverlay
          map={mapInstance}
          selectedArea={selectedArea}
          drawingPoints={drawingPoints}
          isDrawing={interaction.isDrawing}
        />

        {/* HUD instrument frame over the whole map — the same treatment as
            Landing's Earth, since the map is this screen's imagery/
            instrument surface. Sits below the search/controls/toolbar
            layers (those are separate `z-10` siblings, this one has no
            z-index at all), and is itself pointer-events-none so it never
            intercepts map drag/click. */}
        <HudFrame label="LIVE MAP FEED" />
        <Reticle
          size={26}
          className="left-1/2 top-1/2"
          style={{ animation: "reticle-lock 0.6s cubic-bezier(0.32,0.72,0,1) both" }}
        />
      </div>

      {/* ── Search ── */}
      <div className="absolute top-4 left-4 z-10 w-[22rem] max-w-[calc(100%-2rem)]">
        <SearchBar onLocationSelect={handleLocationSelect} />
      </div>

      {/* ── Control cluster — one 38px-wide column (zoom in / zoom out /
          fullscreen / layers), not the old L-shape of a 3-key column next to
          a single button. Moved to the LEFT edge, under the search bar:
          on the right it overlapped the "Ask about this area" panel — the
          panel starts at `top-4`, and the old cluster's zoom-out/fullscreen
          keys sat inside that rect at a higher z-index, painting over it.
          Nothing else lives on the left below the search bar, so there is
          nothing left to collide with. `z-10` is now enough everywhere on
          this page — the old `z-20` here existed only to win against the
          aside it was overlapping. ── */}
      <div className="absolute top-[4.5rem] left-4 z-10 flex flex-col gap-2">
        <MapControls map={mapInstance} mapContainerRef={mapContainerRef} />
        <LayerPanel
          open={layerPanelOpen}
          onOpenChange={setLayerPanelOpen}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          showLabels={showLabels}
          onShowLabelsChange={setShowLabels}
        />
      </div>

      {/* `hidden sm:block` — below `sm` this shares the bottom-left corner
          with the drawing toolbar centred (and, under `xl`, biased further
          left to clear the Inspect trigger) close enough to run straight
          over it: same `bottom-4`, same z-index, later in the DOM, so it
          painted on top and the readout vanished behind it entirely rather
          than just crowding it. Same call the HudFrame label chip already
          makes for the same reason (`HudFrame.tsx`) — decorative telemetry
          gives way to a functional control on a phone, it doesn't fight it
          for the same few pixels. */}
      <CoordinatesDisplay
        cursorCoords={interaction.cursorCoords}
        zoom={interaction.zoom}
        className="absolute bottom-4 left-4 z-10 hidden sm:block"
      />

      {/* Centred bottom cluster (toolbar + drawing hint), reserving space on
          the right for the `xl:hidden` Inspect trigger below — true
          `left-1/2` centring put them on a collision course. That only
          actually happens on phone-width screens (toolbar half-width plus
          the trigger's own footprint only exceeds half the viewport under
          ~560px); at `sm` and up there's room to spare below `xl`, so the
          reservation is dropped there rather than leaving the toolbar
          permanently off-centre on a tablet for no reason. `pointer-events-
          none` on the positioning wrapper, `auto` on its child, so the
          reserved margin isn't a dead click zone. */}
      <div className="absolute inset-x-4 bottom-4 z-10 flex flex-col items-center gap-2 pr-36 sm:pr-0 pointer-events-none">
        {interaction.isDrawing && (
          <div className="pointer-events-auto rounded-full chrome px-3.5 py-1.5 font-mono text-mono-sm text-phosphor">
            Click to add points · double-click to finish
          </div>
        )}
        <div className="pointer-events-auto">
          <DrawingToolbar
            activeTool={interaction.activeDrawTool}
            onToolChange={handleToolChange}
            onClearSelection={handleClearSelection}
            hasSelection={!!selectedArea}
          />
        </div>
      </div>

      {/* ── Floating inspector, inside the map rect. Hidden below xl,
          where InspectorSheet below is the reachable equivalent. ── */}
      <aside className="absolute right-4 top-4 bottom-4 z-10 hidden w-[21rem] flex-col gap-3 overflow-y-auto xl:flex">
        <InspectorPanels
          queryInput={queryInput}
          onQueryInputChange={setQueryInput}
          selectedArea={selectedArea}
          isDrawing={interaction.isDrawing}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          showLabels={showLabels}
          onShowLabelsChange={setShowLabels}
        />
      </aside>

      <InspectorSheet
        queryInput={queryInput}
        onQueryInputChange={setQueryInput}
        selectedArea={selectedArea}
        isDrawing={interaction.isDrawing}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        showLabels={showLabels}
        onShowLabelsChange={setShowLabels}
      />
    </div>
  );
}
