import { useEffect, useRef, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getActiveTileSource } from "@/lib/tileSources";
import type { CursorCoordinates } from "@/types/map";

interface MapCanvasProps {
  center?: CursorCoordinates;
  zoom?: number;
  baseLayerId?: string;
  onCursorMove?: (c: CursorCoordinates) => void;
  onViewChange?: (c: CursorCoordinates, z: number) => void;
  onClick?: (c: CursorCoordinates) => void;
  onMapReady?: (map: maplibregl.Map) => void;
  className?: string;
}

/**
 * Core MapLibre GL JS canvas.
 * Loads raster tiles, fires pointer/view events, and exposes the map instance via onMapReady.
 */
export function MapCanvas({
  center = { lat: 20.5937, lng: 78.9629 },
  zoom = 5,
  onCursorMove,
  onViewChange,
  onClick,
  onMapReady,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // ── Initialise map (once) ────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const tileSource = getActiveTileSource();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [tileSource.url],
            tileSize: 256,
            maxzoom: tileSource.maxZoom ?? 19,
            attribution: tileSource.attribution,
          },
        },
        layers: [
          {
            id: "base-layer",
            type: "raster",
            source: "base",
          },
        ],
      },
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false,
      doubleClickZoom: false,
    });

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

  // ── Expose flyTo via container DOM ─────────────────────
  const flyTo = useCallback((lng: number, lat: number, z?: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: z ?? 12, duration: 800 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) (el as any).__satqueryMap = { flyTo, getMap: () => mapRef.current };
  }, [flyTo]);

  return (
    <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />
  );
}
