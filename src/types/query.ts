// ── Query Pipeline Types ──────────────────────────────────
//
// User Query → Query Parser → Intent → Tool Selection → Analysis Tool → Result → Response
//
// Each layer is a pure data transformation. The mock engine swaps in
// deterministic fake data so the UI behaves identically to a real backend.

import type { GeoCoordinates, BoundingBox } from "@/types";

// ── 1. User Query ─────────────────────────────────────────

export interface Query {
  id: string;
  raw: string;
  timestamp: string;
}

// ── 2. Query Intent (output of parser) ────────────────────

export type IntentType =
  | "detect_objects"
  | "find_water"
  | "detect_changes"
  | "classify_land_cover"
  | "measure_area"
  | "measure_distance"
  | "measure_perimeter"
  | "detect_vegetation_loss"
  | "detect_deforestation"
  | "estimate_crop_health"
  | "visual_interpretation"
  | "general_question";

export interface QueryIntent {
  type: IntentType;
  /** Extracted location name, if any */
  location?: string;
  /** Extracted time range, if any */
  timeRange?: { from?: string; to?: string };
  /** Extracted bounding box, if any */
  bounds?: BoundingBox;
  /** Centre point (defaults to India if not extracted) */
  centre: GeoCoordinates;
  /** Confidence that this intent is correct (0–1) */
  confidence: number;
}

// ── 3. Analysis Tool (selector picks one) ─────────────────

export type AnalysisToolId =
  | "object_detector"
  | "water_finder"
  | "change_detector"
  | "land_cover_classifier"
  | "area_measurer"
  | "distance_measurer"
  | "perimeter_measurer"
  | "vegetation_analyser"
  | "crop_health_analyser"
  /** Real vision-language interpretation of an actual satellite image (SmolVLM). */
  | "visual_analyzer"
  /** Pure conversational reply from the live language model — no analysis tool ran. */
  | "conversational_assistant";

export interface AnalysisTool {
  id: AnalysisToolId;
  name: string;
  description: string;
  /** Intent types this tool can handle */
  supportedIntents: IntentType[];
}

// ── 4. Analysis Results ───────────────────────────────────

export type AnalysisResultKind =
  | "detection"
  | "change"
  | "land_cover"
  | "vegetation"
  | "water"
  | "measurement"
  | "visual";

export interface AnalysisResultBase {
  kind: AnalysisResultKind;
  toolId: AnalysisToolId;
  queryId: string;
  /** Confidence of the overall result (0–1) */
  confidence: number;
  /** Location label */
  location: string;
  /** Centre of the analysis area */
  centre: GeoCoordinates;
  /** Whether the result came from a live algorithm or a mock (backend results). */
  mode?: "mock" | "live";
  /**
   * Algorithm / model id that produced the result (backend results).
   * `algorithm` = radiometric math (NDVI/NDWI); `ml` = a trained model.
   */
  model?: string;
  /** Algorithm / model version (backend results). */
  modelVersion?: string;
  /** Honest processing kind: "algorithm" (NDVI/NDWI math), "ml" (trained
   *  model) or "vlm" (genuine vision-language model on real image pixels). */
  modelKind?: "algorithm" | "ml" | "vlm";
}

// ── Detection Result ──────────────────────────────────────

export interface DetectedFeature {
  id: string;
  label: string;
  category: string;
  confidence: number;
  areaKm2?: number;
}

export interface DetectionResult extends AnalysisResultBase {
  kind: "detection";
  features: DetectedFeature[];
  totalFeatures: number;
  summaryText: string;
}

// ── Change Result ─────────────────────────────────────────

export interface ChangeEntry {
  id: string;
  type: string;
  description: string;
  areaKm2: number;
  confidence: number;
}

export interface ChangeResult extends AnalysisResultBase {
  kind: "change";
  changes: ChangeEntry[];
  totalAreaChangedKm2: number;
  beforeDate: string;
  afterDate: string;
  summaryText: string;
  /** Provenance of the earlier observation (real bi-temporal results). */
  beforeImagery?: ImageryMetadata;
  /** Provenance of the later observation (real bi-temporal results). */
  afterImagery?: ImageryMetadata;
  /** Real statistics over pixels valid in BOTH observations. */
  changeStats?: ChangeStats;
  /** |delta NDVI| classification threshold used (default 0.15). */
  threshold?: number;
  /** Method id, e.g. "delta_ndvi" (radiometric, never ML). */
  changeMethod?: string;
  /** Georeferenced delta-NDVI change raster the map can draw. */
  overlay?: RasterOverlay;
}

export interface ChangeStats {
  validPixelCount: number;
  unchangedPixelCount: number;
  changedPixelCount: number;
  lossPixelCount: number;
  gainPixelCount: number;
  unchangedPercentage: number;
  changedPercentage: number;
  lossPercentage: number;
  gainPercentage: number;
  totalAreaKm2: number;
  changedAreaKm2: number;
  lossAreaKm2: number;
  gainAreaKm2: number;
}

// ── Land Cover Result ─────────────────────────────────────

export interface LandCoverClass {
  name: string;
  /** Machine class code (water, vegetation, built_up, bare) — backend results. */
  code?: string;
  percentage: number;
  areaKm2: number;
  color: string;
}

export interface LandCoverResult extends AnalysisResultBase {
  kind: "land_cover";
  classes: LandCoverClass[];
  totalAreaKm2: number;
  summaryText: string;
  /** Input features the classifier used (backend ML results). */
  modelInputs?: string[];
  /** Provenance of the imagery that was classified. */
  imagery?: ImageryMetadata;
  /** Georeferenced categorical classification raster the map can draw. */
  overlay?: RasterOverlay;
}

// ── Measurement Result ────────────────────────────────────

export type MeasurementKind = "area" | "distance" | "perimeter";

export interface MeasurementResult extends AnalysisResultBase {
  kind: "measurement";
  measurementType: MeasurementKind;
  value: number;
  unit: string;
  points: GeoCoordinates[];
  summaryText: string;
}

// ── Vegetation Result ───────────────────────────────────

export interface VegetationZone {
  id: string;
  status: "healthy" | "stressed" | "degraded" | "loss";
  areaKm2: number;
  confidence: number;
}

/** Real NDVI statistics over valid (non-masked) pixels only. */
export interface NdviStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std?: number;
  /** Share of the analysis window with usable surface pixels (0–100). */
  validPixelPercentage: number;
}

/**
 * Real NDWI statistics over valid (non-masked) pixels only.
 * `waterPixelPercentage` is the share of VALID pixels classified as water
 * (NDWI >= threshold).
 */
export interface NdwiStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std?: number;
  /** Share of the analysis window with usable surface pixels (0–100). */
  validPixelPercentage: number;
  /** Share of valid pixels classified as water (0–100). */
  waterPixelPercentage: number;
}

/** Provenance of the imagery an analysis ran on. */
export interface ImageryMetadata {
  provider: string;
  satellite: string;
  sensor: string;
  acquisitionDate?: string;
  resolutionM?: number;
  crs?: string;
  bands: string[];
  sceneId?: string;
  cloudCoverPercent?: number;
  processingMethod: string;
}

/**
 * A georeferenced raster overlay drawn on the MapLibre map as an image
 * source. `bounds` is [west, south, east, north] in lng/lat; the image is a
 * data URL produced by the backend, so no separate asset serving is needed.
 */
export interface RasterOverlay {
  imageDataUrl: string;
  bounds: [number, number, number, number];
  label: string;
  opacity: number;
  colormap: "ndvi" | "ndwi" | "classes";
}

export interface VegetationResult extends AnalysisResultBase {
  kind: "vegetation";
  totalAreaKm2: number;
  vegetationLostKm2: number;
  zones: VegetationZone[];
  summaryText: string;
  /** Real NDVI statistics (present when the backend ran the NDVI algorithm). */
  ndviStats?: NdviStats;
  /** NDVI class thresholds used by the health-zone classification. */
  thresholds?: Record<string, number>;
  /** Provenance of the imagery that was analysed. */
  imagery?: ImageryMetadata;
  /** Georeferenced NDVI raster the map can draw. */
  overlay?: RasterOverlay;
}

// ── Water Result (real Sentinel-2 NDWI) ───────────────────

export interface WaterResult extends AnalysisResultBase {
  kind: "water";
  /** Water area in km² (pixels with NDWI >= threshold). */
  waterAreaKm2: number;
  /** Total analysed surface area in km² (valid pixels). */
  totalAreaKm2: number;
  summaryText: string;
  /** Real NDWI statistics (present when the backend ran the NDWI algorithm). */
  ndwiStats?: NdwiStats;
  /** Water classification threshold used (default 0.0). */
  threshold: number;
  /** Provenance of the imagery that was analysed. */
  imagery?: ImageryMetadata;
  /** Georeferenced NDWI raster the map can draw. */
  overlay?: RasterOverlay;
}

// ── Visual Result (real vision-language interpretation) ───

/**
 * Real SmolVLM vision-language interpretation of an actual Sentinel-2 scene
 * (Phase 2G / 3B). Mirrors the backend `VisualResult` exactly: the answer is
 * produced by a real multimodal model that received the actual RGB pixels of
 * the image. It is general visual interpretation only — NOT a calibrated
 * measurement, which is why no confidence is reported (the backend sends
 * `confidence: null` and this type omits it). `imageDataUrl` is the
 * backend-rendered true-colour RGB preview; nothing here fabricates imagery.
 */
export interface VisualResult extends Omit<AnalysisResultBase, "confidence"> {
  kind: "visual";
  /** The vision-language model's actual answer text. */
  answer: string;
  /** The user's question as sent to the model. */
  question: string;
  /** Provenance of the imagery the model actually saw. */
  imagery?: ImageryMetadata;
  /** Whether structured analysis context was injected into the prompt. */
  contextSupplied: boolean;
  contextSource: string;
  /** Preview dimensions, e.g. "512x512" (backend-provided). */
  imageSize?: string;
  /** Backend-measured inference latency, if reported. */
  inferenceLatencyMs?: number;
  /** Backend-measured time to load the model weights for THIS request
   *  (absent when the model was already loaded — see `modelReused`). */
  modelLoadLatencyMs?: number;
  /** True when the model weights were already cached in memory (no reload). */
  modelReused?: boolean;
  /** Device the model ran on (e.g. "cpu"). */
  device?: string;
  /** True-colour RGB preview PNG data URL (backend-rendered from real bands). */
  imageDataUrl?: string;
  summaryText: string;
}

// ── Union of all results ──────────────────────────────────

export type AnalysisOutput =
  | DetectionResult
  | ChangeResult
  | LandCoverResult
  | VegetationResult
  | WaterResult
  | MeasurementResult
  | VisualResult;

// ── 5. Natural-language Response (engine output) ──────────

export interface QueryResponse {
  queryId: string;
  intent: QueryIntent;
  result: AnalysisOutput;
  /** Formatted markdown-like text for the chat UI */
  responseText: string;
  /** Attachments for the chat UI */
  attachments: {
    type: "image" | "map_region" | "data";
    label: string;
    confidence?: number;
  }[];
  /** Suggested follow-up actions */
  suggestedActions: string[];
  /** Processing time in ms (simulated) */
  processingTimeMs: number;
  /** Agent execution trace steps from the backend (optional) */
  trace?: string[];
}
