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
  | "crop_health_analyser";

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
  | "measurement";

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
}

// ── Land Cover Result ─────────────────────────────────────

export interface LandCoverClass {
  name: string;
  percentage: number;
  areaKm2: number;
  color: string;
}

export interface LandCoverResult extends AnalysisResultBase {
  kind: "land_cover";
  classes: LandCoverClass[];
  totalAreaKm2: number;
  summaryText: string;
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

// ── Union of all results ──────────────────────────────────

export type AnalysisOutput =
  | DetectionResult
  | ChangeResult
  | LandCoverResult
  | MeasurementResult;

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
}
