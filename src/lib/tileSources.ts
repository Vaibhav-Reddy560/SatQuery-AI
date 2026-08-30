/**
 * Tile-source registry.
 *
 * The DEFAULT_SOURCE is used when no environment variable is set.
 * For production, set VITE_MAP_STYLE_URL to a vector style (MapTiler, Stadia, etc.).
 *
 * The dev fallback uses a free raster tile from OpenStreetMap — no token required.
 */

import type { TileSource } from "@/types/map";

// ── Available tile sources ────────────────────────────────

export const TILE_SOURCES: Record<string, TileSource> = {
  esriDark: {
    id: "esriDark",
    name: "Esri Dark Canvas",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    type: "raster",
    attribution:
      'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
  esriSatellite: {
    id: "esriSatellite",
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    type: "raster",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
    maxZoom: 19,
  },
  osm: {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    type: "raster",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

// ── Resolve active source ─────────────────────────────────

/**
 * Returns the tile source to use.
 * Prefers VITE_MAP_STYLE_URL if set (for production vector tiles),
 * otherwise falls back to Esri Dark Canvas (fits our dark-first UI).
 */
export function getActiveTileSource(): TileSource {
  const envUrl = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
  if (envUrl) {
    return {
      id: "env",
      name: "Custom Style",
      url: envUrl,
      type: envUrl.includes("style") ? "vector" : "raster",
      attribution: "",
      maxZoom: 22,
    };
  }
  return TILE_SOURCES.esriDark;
}
