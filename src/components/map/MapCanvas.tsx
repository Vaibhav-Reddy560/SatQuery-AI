import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPinOff } from "lucide-react";
import {
  getTileSource,
  DEFAULT_SOURCE_ID,
  TILE_SOURCES,
  VIEW_MODE_PAINT,
  VECTOR_STYLE_URL,
  isVectorMode,
  type ViewMode,
} from "@/lib/tileSources";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
import type { CursorCoordinates, TileSource } from "@/types/map";

/** The raster style document shared by satellite/ndvi/thermal — one source,
    one layer, differing only in paint. */
function buildRasterStyle(source: TileSource, viewMode: ViewMode): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: [source.url],
        tileSize: source.tileSize ?? 256,
        maxzoom: source.maxZoom ?? 19,
        attribution: source.attribution,
      },
    },
    layers: [
      { id: "base-layer", type: "raster", source: "base", paint: VIEW_MODE_PAINT[viewMode] ?? {} },
    ],
  };
}

/** Repaint the raster base in place — resets every property any view mode
    might set, so switching modes never leaves the previous one's hue-rotate
    or contrast behind. */
function applyViewPaint(map: maplibregl.Map, viewMode: ViewMode) {
  if (!map.getLayer("base-layer")) return;
  const paint: Record<string, number> = VIEW_MODE_PAINT[viewMode] ?? {};
  const allProps = new Set<string>();
  Object.values(VIEW_MODE_PAINT).forEach((p) => p && Object.keys(p).forEach((k) => allProps.add(k)));
  // `setPaintProperty`'s overloads are keyed to a specific layer type per
  // property name, which collapses to `never` once the property name is
  // only known as a generic `string` — cast the call itself to a permissive
  // signature rather than fighting that per property.
  const setPaint = map.setPaintProperty.bind(map) as (layerId: string, name: string, value: unknown) => void;
  allProps.forEach((prop) => {
    setPaint("base-layer", prop, paint[prop] ?? undefined);
  });
}

interface MapCanvasProps {
  center?: CursorCoordinates;
  zoom?: number;
  baseLayerId?: string;
  /** How the base imagery is coloured. See `VIEW_MODE_PAINT`. */
  viewMode?: ViewMode;
  /** Draw the Esri place-names/boundaries raster over the imagery. */
  showLabels?: boolean;
  onCursorMove?: (c: CursorCoordinates) => void;
  onViewChange?: (c: CursorCoordinates, z: number) => void;
  onClick?: (c: CursorCoordinates) => void;
  onMapReady?: (map: maplibregl.Map) => void;
  className?: string;
}

const LABELS_SOURCE = "labels";
const LABELS_LAYER = "labels-layer";

/**
 * Core MapLibre GL JS canvas.
 * Loads raster tiles, fires pointer/view events, and exposes the map instance via onMapReady.
 */
export function MapCanvas({
  center = { lat: 20.5937, lng: 78.9629 },
  zoom = 5,
  baseLayerId = DEFAULT_SOURCE_ID,
  viewMode = "satellite",
  showLabels = false,
  onCursorMove,
  onViewChange,
  onClick,
  onMapReady,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  // Which style DOCUMENT is currently mounted — "vector" or a raster source
  // id — so the style-switching effect below only pays for a `setStyle`
  // rebuild when crossing that boundary, not on every view-mode repaint.
  const styleKeyRef = useRef<string>(
    isVectorMode(viewMode) ? "vector" : `raster:${baseLayerId}`
  );

  // ── Initialise map (once) ────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!hasWebGL()) {
      setFailed(true);
      return;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: isVectorMode(viewMode)
          ? VECTOR_STYLE_URL
          : buildRasterStyle(getTileSource(baseLayerId), viewMode),
        center: [center.lng, center.lat],
        zoom,
        attributionControl: false,
        doubleClickZoom: false,
      });
    } catch (err) {
      // Some drivers pass the getContext probe above but still throw during
      // the library's own GL initialisation. Degrade to the fallback rather
      // than letting this propagate — uncaught, it would unmount everything
      // above this component too, not just the map.
      console.error("SatQuery: map failed to initialise", err);
      setFailed(true);
      return;
    }

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    mapRef.current = map;
    onMapReady?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Style switching ────────────────────────────────────
  //
  // Two style families live here. `satellite`/`ndvi`/`thermal` are one raster
  // style over the same Esri imagery, differing only in paint — switching
  // among them must NOT refetch tiles. `map` is the OpenFreeMap vector style,
  // a genuinely different style document, so crossing that boundary needs a
  // full `setStyle`. `styleKeyRef` tracks which document is mounted so we only
  // pay for a rebuild when the family actually changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const key = isVectorMode(viewMode) ? "vector" : `raster:${baseLayerId}`;

    if (styleKeyRef.current === key) {
      // Same document — repaint in place.
      applyViewPaint(map, viewMode);
      return;
    }

    styleKeyRef.current = key;
    map.setStyle(
      isVectorMode(viewMode)
        ? VECTOR_STYLE_URL
        : buildRasterStyle(getTileSource(baseLayerId), viewMode)
    );
  }, [viewMode, baseLayerId]);

  // ── Place-name / boundary overlay ──────────────────────
  //
  // Re-applied on `styledata` as well as on prop changes: `setStyle` discards
  // every source and layer that isn't part of the incoming document, so after
  // a family switch this has to put itself back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;

      // The vector basemap already draws its own boundaries and place names,
      // so the overlay is only meaningful over imagery.
      const want = showLabels && !isVectorMode(viewMode);
      const present = !!map.getLayer(LABELS_LAYER);
      if (want === present) return;

      if (want) {
        const ref = TILE_SOURCES.esriReference;
        if (!map.getSource(LABELS_SOURCE)) {
          map.addSource(LABELS_SOURCE, {
            type: "raster",
            tiles: [ref.url],
            tileSize: ref.tileSize ?? 256,
            maxzoom: ref.maxZoom ?? 19,
            attribution: ref.attribution,
          });
        }
        // Directly above the base, so drawn selections stay on top of it.
        const layers = map.getStyle().layers ?? [];
        const baseIdx = layers.findIndex((l) => l.id === "base-layer");
        map.addLayer(
          {
            id: LABELS_LAYER,
            type: "raster",
            source: LABELS_SOURCE,
            paint: { "raster-opacity": 0.9 },
          },
          layers[baseIdx + 1]?.id
        );
      } else {
        map.removeLayer(LABELS_LAYER);
        if (map.getSource(LABELS_SOURCE)) map.removeSource(LABELS_SOURCE);
      }
    };

    apply();
    map.on("styledata", apply);
    return () => {
      map.off("styledata", apply);
    };
  }, [showLabels, viewMode]);

  // ── Map events ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMove = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      onViewChange?.({ lat: c.lat, lng: c.lng }, z);
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      onCursorMove?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      onClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };

    map.on("move", handleMove);
    map.on("mousemove", handleMouseMove);
    map.on("click", handleClick);

    return () => {
      map.off("move", handleMove);
      map.off("mousemove", handleMouseMove);
      map.off("click", handleClick);
    };
  }, [onViewChange, onCursorMove, onClick]);

  if (failed) {
    return (
      <div
        className={className}
        style={{ width: "100%", height: "100%" }}
        role="alert"
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg-tertiary text-center px-8">
          <MapPinOff className="h-6 w-6 text-text-faint" />
          <p className="text-body text-text-secondary">
            The map couldn't start — this browser has no WebGL available.
          </p>
          <p className="text-xs text-text-faint max-w-xs">
            Try a different browser, or enable hardware acceleration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />
  );
}
