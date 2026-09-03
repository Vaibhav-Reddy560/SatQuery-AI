/**
 * Tile-source registry and map view modes.
 *
 * Everything here is keyless. CARTO's legacy `basemaps.cartocdn.com/dark_all`
 * and `/light_all` endpoints used to be free and were the default, but CARTO
 * now serves them with an "API KEY REQUIRED" watermark tiled across every
 * image. That text is baked into the PNG bytes, so no CSS rule and no raster
 * paint property can hide it — the only fix is not to request those tiles.
 * Both entries are gone; do not reintroduce them.
 *
 * The base is Esri World Imagery, which is genuinely high-resolution and
 * serves well past zoom 19 across most populated areas. It has no `@2x`
 * retina variant, so `tileSize` is declared per source rather than assumed:
 * a 256 here means true 1x, where CARTO's `@2x` meant a 512px image packed
 * into a 256 logical tile.
 *
 * VITE_MAP_STYLE_URL still overrides everything, for a paid vector style.
 */

import type { TileSource } from "@/types/map";

export const TILE_SOURCES: Record<string, TileSource> = {
  esriImagery: {
    id: "esriImagery",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    type: "raster",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    // Esri serves deeper than the 19 this was previously capped at. The cap
    // meant zooming in past 19 just upscaled one tile instead of fetching
    // more detail, which is a large part of why the map looked soft.
    maxZoom: 21,
    tileSize: 256,
  },
  /** Place names, boundaries and roads, drawn over the imagery. Keyless. */
  esriReference: {
    id: "esriReference",
    name: "Labels",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    type: "raster",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
    tileSize: 256,
  },
  /** Not exposed in the UI — kept as a documented fallback. */
  osm: {
    id: "osm",
    name: "Street",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    type: "raster",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    tileSize: 256,
  },
};

export const DEFAULT_SOURCE_ID = "esriImagery";

/**
 * OpenFreeMap — a free, keyless, unmetered vector basemap built from
 * OpenStreetMap. Vector rather than raster, so it stays sharp at every zoom
 * instead of blurring on the way in, and it carries the full administrative
 * detail: state and district boundaries, city/town/village names, roads.
 *
 * Google's tiles are deliberately not an option here — the Maps Platform
 * terms only permit their map content through Google's own SDKs, so pulling
 * them into MapLibre would breach the licence (and still need a billed key).
 */
export const VECTOR_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * How the map is drawn.
 *
 * `map` is the OpenFreeMap vector basemap — a different MapLibre *style*, not
 * just different paint, so switching to or from it requires `setStyle`.
 * `satellite`/`ndvi`/`thermal` all share one raster style over the same Esri
 * imagery and differ only in `VIEW_MODE_PAINT`, so switching between those
 * three is a repaint with no refetch.
 *
 * NDVI and THERMAL are false-colour treatments of RGB imagery, not computed
 * spectral indices: there is no near-infrared or thermal band behind them.
 * They are a look, not a measurement — do not present their output as
 * analysis, and do not build anything on top of them that implies it is.
 */
export type ViewMode = "satellite" | "map" | "ndvi" | "thermal";

/** True when the mode needs the vector style rather than the raster one. */
export function isVectorMode(mode: ViewMode): boolean {
  return mode === "map";
}

/** MapLibre `raster` paint per raster view mode. `map` is absent — it is a
    vector style and has no base raster layer to paint. */
export const VIEW_MODE_PAINT: Partial<Record<ViewMode, Record<string, number>>> = {
  // Natural colour. An earlier pass desaturated this and laid a blue veil
  // over the canvas to pull the map onto the app palette; that was reverted
  // on direct instruction — the map reads as itself, and the blue chrome
  // around it does the theming.
  satellite: {},
  ndvi: {
    "raster-saturation": 0.55,
    "raster-hue-rotate": 65,
    "raster-contrast": 0.25,
    "raster-brightness-max": 0.95,
  },
  thermal: {
    "raster-saturation": 0.7,
    "raster-hue-rotate": 190,
    "raster-contrast": 0.5,
    "raster-brightness-min": 0.08,
  },
};

export const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "satellite", label: "Satellite" },
  { id: "map", label: "Map" },
  { id: "ndvi", label: "NDVI" },
  { id: "thermal", label: "Thermal" },
];

/** Look up a source by id, falling back to the default. */
export function getTileSource(id: string): TileSource {
  return TILE_SOURCES[id] ?? TILE_SOURCES[DEFAULT_SOURCE_ID];
}

/**
 * Returns the tile source to use.
 * Prefers VITE_MAP_STYLE_URL if set, otherwise Esri World Imagery.
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
      tileSize: 256,
    };
  }
  return TILE_SOURCES[DEFAULT_SOURCE_ID];
}
