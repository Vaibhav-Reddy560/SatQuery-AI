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
  osm: {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    type: "raster",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  cartoDark: {
    id: "cartoDark",
    name: "CartoDB Dark",
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    type: "raster",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  cartoLight: {
    id: "cartoLight",
    name: "CartoDB Light",
    url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    type: "raster",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
};

// ── Resolve active source ─────────────────────────────────

/**
 * Returns the tile source to use.
 * Prefers VITE_MAP_STYLE_URL if set (for production vector tiles),
 * otherwise falls back to CartoDB Dark (fits our dark-first UI).
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
  return TILE_SOURCES.cartoDark;
}
