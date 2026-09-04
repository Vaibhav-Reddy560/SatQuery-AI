/**
 * Typed bridge to the SatQuery backend API.
 *
 * The backend exposes one canonical taxonomy (see backend/app/schemas/ai.py);
 * this module is the ONLY place where backend snake_case payloads are mapped
 * onto the UI's camelCase types. No `as any`, no hardcoded tool ids, no
 * hardcoded centre: each backend kind/intent/tool is translated explicitly.
 *
 * When the backend is unreachable (or returns an error), the query pipeline
 * falls back to the local simulated engine (see queryEngine.ts).
 */

import type { GeoCoordinates } from "@/types";
import type {
  AnalysisOutput,
  AnalysisToolId,
  ChangeResult,
  DetectionResult,
  ImageryMetadata,
  IntentType,
  LandCoverResult,
  MeasurementKind,
  MeasurementResult,
  QueryIntent,
  QueryResponse,
  VegetationResult,
  VisualResult,
  WaterResult,
} from "@/types/query";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// ── Canonical (backend) -> UI mappings ────────────────────────────────────

/** Backend IntentType (backend/app/schemas/ai.py) -> frontend IntentType. */
const INTENT_MAP: Record<string, IntentType> = {
  detect_objects: "detect_objects",
  find_water: "find_water",
  land_cover: "classify_land_cover",
  change_detection: "detect_changes",
  vegetation_analysis: "detect_vegetation_loss",
  measure_area: "measure_area",
  measure_distance: "measure_distance",
  visual_interpretation: "visual_interpretation",
  general_satellite_question: "general_question",
  unknown: "general_question",
};

/** Backend tool id -> frontend AnalysisToolId (geospatial handled by kind). */
const TOOL_MAP: Record<string, AnalysisToolId> = {
  object_detector: "object_detector",
  water_detector: "water_finder",
  land_cover_classifier: "land_cover_classifier",
  change_detector: "change_detector",
  vegetation_analyzer: "vegetation_analyser",
  visual_analyzer: "visual_analyzer",
};

// ── Backend JSON shapes (mirror of the FastAPI response) ──────────────────

interface BackendAttachment {
  type?: string | null;
  label?: string | null;
  confidence?: number | null;
  url?: string | null;
}

interface BackendFeature {
  id?: string | null;
  label?: string | null;
  category?: string | null;
  confidence?: number | null;
  geometry?: { type?: string; coordinates?: number[] } | null;
  bbox?: number[] | null;
  area_km2?: number | null;
}

interface BackendLandClass {
  name?: string | null;
  code?: string | null;
  percentage?: number | null;
  area_km2?: number | null;
  color?: string | null;
}

interface BackendChange {
  id?: string | null;
  type?: string | null;
  description?: string | null;
  area_km2?: number | null;
  confidence?: number | null;
}

interface BackendZone {
  id?: string | null;
  status?: string | null;
  area_km2?: number | null;
  confidence?: number | null;
}

interface BackendNdviStats {
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  valid_pixel_percentage?: number | null;
  water_pixel_percentage?: number | null;
}

interface BackendImageryMetadata {
  provider?: string | null;
  satellite?: string | null;
  sensor?: string | null;
  acquisition_date?: string | null;
  resolution_m?: number | null;
  crs?: string | null;
  bands?: string[] | null;
  scene_id?: string | null;
  cloud_cover_percent?: number | null;
  processing_method?: string | null;
}

interface BackendRasterOverlay {
  image_data_url?: string | null;
  bounds?: number[] | null;
  label?: string | null;
  opacity?: number | null;
  colormap?: string | null;
}

interface BackendPayload {
  kind?: string | null;
  tool_id?: string | null;
  location?: string | null;
  centre?: number[] | null;
  confidence?: number | null;
  model?: string | null;
  model_version?: string | null;
  model_kind?: string | null;
  mode?: string | null;
  summary_text?: string | null;
  model_inputs?: string[] | null;
  ndvi_stats?: BackendNdviStats | null;
  ndwi_stats?: BackendNdviStats | null;
  thresholds?: Record<string, number> | null;
  imagery?: BackendImageryMetadata | null;
  overlay?: BackendRasterOverlay | null;
  total_features?: number | null;
  features?: BackendFeature[] | null;
  categories?: Record<string, number> | null;
  total_area_km2?: number | null;
  classes?: BackendLandClass[] | null;
  before_date?: string | null;
  after_date?: string | null;
  total_area_changed_km2?: number | null;
  changes?: BackendChange[] | null;
  change_method?: string | null;
  before_imagery?: BackendImageryMetadata | null;
  after_imagery?: BackendImageryMetadata | null;
  change_stats?: {
    valid_pixel_count?: number | null;
    unchanged_pixel_count?: number | null;
    changed_pixel_count?: number | null;
    loss_pixel_count?: number | null;
    gain_pixel_count?: number | null;
    unchanged_percentage?: number | null;
    changed_percentage?: number | null;
    loss_percentage?: number | null;
    gain_percentage?: number | null;
    total_area_km2?: number | null;
    changed_area_km2?: number | null;
    loss_area_km2?: number | null;
    gain_area_km2?: number | null;
  } | null;
  vegetation_lost_km2?: number | null;
  zones?: BackendZone[] | null;
  water_area_km2?: number | null;
  threshold?: number | null;
  measurement_type?: string | null;
  value?: number | null;
  unit?: string | null;
  points?: number[][] | null;
  // Visual (vision-language) results.
  answer?: string | null;
  question?: string | null;
  context_supplied?: boolean | null;
  context_source?: string | null;
  image_size?: string | null;
  inference_latency_ms?: number | null;
  device?: string | null;
  image_data_url?: string | null;
}

interface BackendIntent {
  type?: string | null;
  location?: string | null;
  centre?: number[] | null;
  confidence?: number | null;
}

interface BackendQueryResponse {
  intent?: BackendIntent | null;
  text_response?: string | null;
  attachments?: BackendAttachment[] | null;
  suggested_actions?: string[] | null;
  confidence?: number | null;
  analysis_kind?: string | null;
  analysis_payload?: BackendPayload | null;
  latency_ms?: number | null;
  trace?: string[] | null;
}

// ── Small mapping helpers ─────────────────────────────────────────────────

function toGeo(centre: number[] | null | undefined, fallback: [number, number]): GeoCoordinates {
  const c = centre && centre.length >= 2 ? centre : fallback;
  return { lat: Number(c[1]), lng: Number(c[0]) };
}

function str(value: string | null | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

function num(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Map a backend attachment onto the UI's attachment union. */
function mapAttachment(att: BackendAttachment): { type: "image" | "map_region" | "data"; label: string; confidence?: number } {
  const raw = att.type ?? "data";
  const type =
    raw === "image" || raw === "map_region" || raw === "map_overlay"
      ? raw === "map_overlay"
        ? "map_region"
        : raw
      : "data";
  return {
    type,
    label: str(att.label, "Attachment"),
    confidence: att.confidence ?? undefined,
  };
}

function measurementKind(value: string | null | undefined): MeasurementKind {
  return value === "distance" || value === "perimeter" || value === "area" ? value : "area";
}

/** Map backend imagery provenance onto the UI's ImageryMetadata shape. */
function mapImagery(imagery: BackendImageryMetadata | null | undefined): ImageryMetadata | undefined {
  if (!imagery) return undefined;
  return {
    provider: str(imagery.provider ?? null, "Unknown provider"),
    satellite: str(imagery.satellite ?? null, "Sentinel-2"),
    sensor: str(imagery.sensor ?? null, "MSI"),
    acquisitionDate: imagery.acquisition_date ?? undefined,
    resolutionM: imagery.resolution_m ?? undefined,
    crs: imagery.crs ?? undefined,
    bands: imagery.bands ?? [],
    sceneId: imagery.scene_id ?? undefined,
    cloudCoverPercent: imagery.cloud_cover_percent ?? undefined,
    processingMethod: str(imagery.processing_method ?? null, ""),
  };
}

// ── Result mappers (per backend kind) ─────────────────────────────────────

function toolIdFor(payload: BackendPayload, kind: string): AnalysisToolId {
  const tool = payload.tool_id;
  if (tool && TOOL_MAP[tool]) return TOOL_MAP[tool];
  // geospatial_measurement -> frontend split by measurement type.
  if (tool === "geospatial_measurement") {
    const mt = measurementKind(payload.measurement_type);
    return mt === "distance" ? "distance_measurer" : mt === "perimeter" ? "perimeter_measurer" : "area_measurer";
  }
  // Fall back by kind (defensive; backend always sends tool_id for analysis).
  if (kind === "change") return "change_detector";
  if (kind === "land_cover") return "land_cover_classifier";
  if (kind === "vegetation") return "vegetation_analyser";
  if (kind === "measurement") return "area_measurer";
  return "object_detector";
}

function mapResult(
  payload: BackendPayload,
  queryId: string,
  centreFallback: [number, number],
  locationName: string,
  confidence: number
): AnalysisOutput {
  const kind = payload.kind ?? "detection";
  const location = str(payload.location ?? null, locationName);
  const centre = toGeo(payload.centre, centreFallback);

  switch (kind) {
    case "change": {
      const overlay = payload.overlay;
      const overlayBounds = overlay?.bounds;
      const overlayCoords: [number, number, number, number] | undefined =
        overlayBounds && overlayBounds.length >= 4
          ? [overlayBounds[0], overlayBounds[1], overlayBounds[2], overlayBounds[3]]
          : undefined;
      const result: ChangeResult = {
        kind: "change",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        mode: payload.mode === "live" ? "live" : "mock",
        model: payload.model ?? undefined,
        modelVersion: payload.model_version ?? undefined,
        modelKind: payload.model_kind === "ml" ? "ml" : payload.model_kind === "algorithm" ? "algorithm" : undefined,
        changes: (payload.changes ?? []).map((c, i) => ({
          id: str(c.id ?? null, `chg-${i + 1}`),
          type: str(c.type ?? null, "modification"),
          description: str(c.description ?? null, "Change zone"),
          areaKm2: num(c.area_km2, 0),
          confidence: num(c.confidence, 0.8),
        })),
        totalAreaChangedKm2: num(payload.total_area_changed_km2, 0),
        beforeDate: str(payload.before_date ?? null, "—"),
        afterDate: str(payload.after_date ?? null, "—"),
        summaryText: str(payload.summary_text ?? null, "Change detection complete."),
        changeMethod: payload.change_method ?? undefined,
        beforeImagery: mapImagery(payload.before_imagery),
        afterImagery: mapImagery(payload.after_imagery),
        changeStats: payload.change_stats
          ? {
              validPixelCount: num(payload.change_stats.valid_pixel_count, 0),
              unchangedPixelCount: num(payload.change_stats.unchanged_pixel_count, 0),
              changedPixelCount: num(payload.change_stats.changed_pixel_count, 0),
              lossPixelCount: num(payload.change_stats.loss_pixel_count, 0),
              gainPixelCount: num(payload.change_stats.gain_pixel_count, 0),
              unchangedPercentage: num(payload.change_stats.unchanged_percentage, 0),
              changedPercentage: num(payload.change_stats.changed_percentage, 0),
              lossPercentage: num(payload.change_stats.loss_percentage, 0),
              gainPercentage: num(payload.change_stats.gain_percentage, 0),
              totalAreaKm2: num(payload.change_stats.total_area_km2, 0),
              changedAreaKm2: num(payload.change_stats.changed_area_km2, 0),
              lossAreaKm2: num(payload.change_stats.loss_area_km2, 0),
              gainAreaKm2: num(payload.change_stats.gain_area_km2, 0),
            }
          : undefined,
        threshold: payload.threshold ?? undefined,
        overlay:
          overlay && overlay.image_data_url && overlayCoords
            ? {
                imageDataUrl: overlay.image_data_url,
                bounds: overlayCoords,
                label: str(overlay.label ?? null, "Delta NDVI change"),
                opacity: num(overlay.opacity, 0.8),
                colormap: overlay.colormap === "classes" ? "classes" : "ndvi",
              }
            : undefined,
      };
      return result;
    }
    case "land_cover": {
      const overlay = payload.overlay;
      const overlayBounds = overlay?.bounds;
      const overlayCoords: [number, number, number, number] | undefined =
        overlayBounds && overlayBounds.length >= 4
          ? [overlayBounds[0], overlayBounds[1], overlayBounds[2], overlayBounds[3]]
          : undefined;
      const result: LandCoverResult = {
        kind: "land_cover",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        mode: payload.mode === "live" ? "live" : "mock",
        model: payload.model ?? undefined,
        modelVersion: payload.model_version ?? undefined,
        modelKind: payload.model_kind === "ml" ? "ml" : payload.model_kind === "algorithm" ? "algorithm" : undefined,
        classes: (payload.classes ?? []).map((c) => ({
          name: str(c.name ?? null, "Unknown class"),
          code: c.code ?? undefined,
          percentage: num(c.percentage, 0),
          areaKm2: num(c.area_km2, 0),
          color: str(c.color ?? null, "#6b7280"),
        })),
        totalAreaKm2: num(payload.total_area_km2, 0),
        summaryText: str(payload.summary_text ?? null, "Land cover classification complete."),
        modelInputs: payload.model_inputs ?? undefined,
        imagery: payload.imagery
          ? {
              provider: str(payload.imagery.provider ?? null, "Unknown provider"),
              satellite: str(payload.imagery.satellite ?? null, "Sentinel-2"),
              sensor: str(payload.imagery.sensor ?? null, "MSI"),
              acquisitionDate: payload.imagery.acquisition_date ?? undefined,
              resolutionM: payload.imagery.resolution_m ?? undefined,
              crs: payload.imagery.crs ?? undefined,
              bands: payload.imagery.bands ?? [],
              sceneId: payload.imagery.scene_id ?? undefined,
              cloudCoverPercent: payload.imagery.cloud_cover_percent ?? undefined,
              processingMethod: str(payload.imagery.processing_method ?? null, ""),
            }
          : undefined,
        overlay:
          overlay && overlay.image_data_url && overlayCoords
            ? {
                imageDataUrl: overlay.image_data_url,
                bounds: overlayCoords,
                label: str(overlay.label ?? null, "Land cover classification"),
                opacity: num(overlay.opacity, 1.0),
                colormap: overlay.colormap === "classes" ? "classes" : "ndvi",
              }
            : undefined,
      };
      return result;
    }
    case "vegetation": {
      const overlay = payload.overlay;
      const overlayBounds = overlay?.bounds;
      const overlayCoords: [number, number, number, number] | undefined =
        overlayBounds && overlayBounds.length >= 4
          ? [overlayBounds[0], overlayBounds[1], overlayBounds[2], overlayBounds[3]]
          : undefined;
      const result: VegetationResult = {
        kind: "vegetation",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        mode: payload.mode === "live" ? "live" : "mock",
        model: payload.model ?? undefined,
        modelVersion: payload.model_version ?? undefined,
        totalAreaKm2: num(payload.total_area_km2, 0),
        vegetationLostKm2: num(payload.vegetation_lost_km2, 0),
        zones: (payload.zones ?? []).map((z, i) => ({
          id: str(z.id ?? null, `zone-${i + 1}`),
          status:
            z.status === "healthy" || z.status === "stressed" || z.status === "degraded" || z.status === "loss"
              ? z.status
              : "stressed",
          areaKm2: num(z.area_km2, 0),
          confidence: num(z.confidence, 0.8),
        })),
        summaryText: str(payload.summary_text ?? null, "Vegetation analysis complete."),
        ndviStats: payload.ndvi_stats
          ? {
              min: num(payload.ndvi_stats.min, 0),
              max: num(payload.ndvi_stats.max, 0),
              mean: num(payload.ndvi_stats.mean, 0),
              median: num(payload.ndvi_stats.median, 0),
              std: payload.ndvi_stats.std ?? undefined,
              validPixelPercentage: num(payload.ndvi_stats.valid_pixel_percentage, 0),
            }
          : undefined,
        thresholds: payload.thresholds ?? undefined,
        imagery: payload.imagery
          ? {
              provider: str(payload.imagery.provider ?? null, "Unknown provider"),
              satellite: str(payload.imagery.satellite ?? null, "Sentinel-2"),
              sensor: str(payload.imagery.sensor ?? null, "MSI"),
              acquisitionDate: payload.imagery.acquisition_date ?? undefined,
              resolutionM: payload.imagery.resolution_m ?? undefined,
              crs: payload.imagery.crs ?? undefined,
              bands: payload.imagery.bands ?? [],
              sceneId: payload.imagery.scene_id ?? undefined,
              cloudCoverPercent: payload.imagery.cloud_cover_percent ?? undefined,
              processingMethod: str(payload.imagery.processing_method ?? null, ""),
            }
          : undefined,
        overlay:
          overlay && overlay.image_data_url && overlayCoords
            ? {
                imageDataUrl: overlay.image_data_url,
                bounds: overlayCoords,
                label: str(overlay.label ?? null, "NDVI overlay"),
                opacity: num(overlay.opacity, 0.75),
                colormap: overlay.colormap === "classes" ? "classes" : "ndvi",
              }
            : undefined,
      };
      return result;
    }
    case "water": {
      const overlay = payload.overlay;
      const overlayBounds = overlay?.bounds;
      const overlayCoords: [number, number, number, number] | undefined =
        overlayBounds && overlayBounds.length >= 4
          ? [overlayBounds[0], overlayBounds[1], overlayBounds[2], overlayBounds[3]]
          : undefined;
      const result: WaterResult = {
        kind: "water",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        mode: payload.mode === "live" ? "live" : "mock",
        model: payload.model ?? undefined,
        modelVersion: payload.model_version ?? undefined,
        waterAreaKm2: num(payload.water_area_km2, 0),
        totalAreaKm2: num(payload.total_area_km2, 0),
        summaryText: str(payload.summary_text ?? null, "Water detection complete."),
        threshold: num(payload.threshold, 0),
        ndwiStats: payload.ndwi_stats
          ? {
              min: num(payload.ndwi_stats.min, 0),
              max: num(payload.ndwi_stats.max, 0),
              mean: num(payload.ndwi_stats.mean, 0),
              median: num(payload.ndwi_stats.median, 0),
              std: payload.ndwi_stats.std ?? undefined,
              validPixelPercentage: num(payload.ndwi_stats.valid_pixel_percentage, 0),
              waterPixelPercentage: num(payload.ndwi_stats.water_pixel_percentage, 0),
            }
          : undefined,
        imagery: payload.imagery
          ? {
              provider: str(payload.imagery.provider ?? null, "Unknown provider"),
              satellite: str(payload.imagery.satellite ?? null, "Sentinel-2"),
              sensor: str(payload.imagery.sensor ?? null, "MSI"),
              acquisitionDate: payload.imagery.acquisition_date ?? undefined,
              resolutionM: payload.imagery.resolution_m ?? undefined,
              crs: payload.imagery.crs ?? undefined,
              bands: payload.imagery.bands ?? [],
              sceneId: payload.imagery.scene_id ?? undefined,
              cloudCoverPercent: payload.imagery.cloud_cover_percent ?? undefined,
              processingMethod: str(payload.imagery.processing_method ?? null, ""),
            }
          : undefined,
        overlay:
          overlay && overlay.image_data_url && overlayCoords
            ? {
                imageDataUrl: overlay.image_data_url,
                bounds: overlayCoords,
                label: str(overlay.label ?? null, "NDWI water mask"),
                opacity: num(overlay.opacity, 0.75),
                colormap: overlay.colormap === "ndwi" ? "ndwi" : overlay.colormap === "classes" ? "classes" : "ndvi",
              }
            : undefined,
      };
      return result;
    }
    case "measurement": {
      const result: MeasurementResult = {
        kind: "measurement",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        measurementType: measurementKind(payload.measurement_type),
        value: num(payload.value, 0),
        unit: str(payload.unit ?? null, "km"),
        points: (payload.points ?? []).map((p) => ({ lat: num(p?.[1], 0), lng: num(p?.[0], 0) })),
        summaryText: str(payload.summary_text ?? null, "Measurement complete."),
      };
      return result;
    }
    case "visual": {
      // Real vision-language interpretation (SmolVLM over actual Sentinel-2
      // RGB pixels). Preserve every backend field verbatim — never rebuild or
      // approximate the answer. A VLM has no calibrated confidence, so no
      // confidence is reported (backend sends null; we omit the field).
      const result: VisualResult = {
        kind: "visual",
        toolId: toolIdFor(payload, kind),
        queryId,
        location,
        centre,
        mode: "live",
        model: payload.model ?? undefined,
        modelVersion: payload.model_version ?? undefined,
        modelKind: payload.model_kind === "vlm" ? "vlm" : undefined,
        summaryText: str(payload.summary_text ?? null, ""),
        answer: str(payload.answer ?? null, ""),
        question: str(payload.question ?? null, ""),
        imagery: mapImagery(payload.imagery),
        contextSupplied: payload.context_supplied === true,
        contextSource: str(payload.context_source ?? null, "none"),
        imageSize: payload.image_size ?? undefined,
        inferenceLatencyMs: payload.inference_latency_ms ?? undefined,
        device: payload.device ?? undefined,
        imageDataUrl: payload.image_data_url ?? undefined,
      };
      return result;
    }
    case "detection":
    default: {
      // `general`/unknown responses also land here as an empty detection so
      // the chat keeps a valid typed result; the real answer is the text.
      const result: DetectionResult = {
        kind: "detection",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        features: (payload.features ?? []).map((f, i) => ({
          id: str(f.id ?? null, `feat-${i + 1}`),
          label: str(f.label ?? null, "Feature"),
          category: str(f.category ?? null, "Satellite Feature"),
          confidence: num(f.confidence, 0.9),
          areaKm2: f.area_km2 ?? undefined,
        })),
        totalFeatures: payload.total_features ?? payload.features?.length ?? 0,
        summaryText: str(payload.summary_text ?? null, "Analysis complete."),
      };
      return result;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function sendQueryToBackend(
  queryId: string,
  queryText: string,
  centre: [number, number],
  locationName: string
): Promise<QueryResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: queryText,
        centre,
        location_name: locationName,
        satellite_sources: ["Sentinel-1 SAR", "Sentinel-2 Multispectral"],
      }),
    });

    if (!res.ok) {
      console.warn(`Backend API returned HTTP status ${res.status}, falling back to local engine.`);
      return null;
    }

    const data = (await res.json()) as BackendQueryResponse;
    const intentRaw = data.intent ?? {};
    const payload = data.analysis_payload ?? {};
    const confidence = num(payload.confidence ?? data.confidence, 0.94);

    const intent: QueryIntent = {
      type: INTENT_MAP[str(intentRaw.type ?? null, "general_question")] ?? "general_question",
      location: intentRaw.location ?? undefined,
      centre: toGeo(intentRaw.centre ?? payload.centre, centre),
      confidence: num(intentRaw.confidence, confidence),
    };

    const result: AnalysisOutput = mapResult(
      payload,
      queryId,
      centre,
      str(intentRaw.location ?? payload.location ?? null, locationName),
      confidence
    );

    return {
      queryId,
      intent,
      result,
      responseText: str(data.text_response ?? null, result.summaryText),
      attachments: (data.attachments ?? []).map(mapAttachment),
      suggestedActions: data.suggested_actions ?? [],
      processingTimeMs: data.latency_ms ?? 400,
      trace: data.trace ?? undefined,
    };
  } catch (error) {
    console.warn("Backend FastAPI server not reached. Operating in client-side mode.", error);
    return null;
  }
}

export async function fetchBackendModelStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/models/status`);
    if (res.ok) return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBigEarthNetSamples() {
  try {
    const res = await fetch(`${API_BASE_URL}/datasets/bigearthnet/samples`);
    if (res.ok) return await res.json();
  } catch {
    return null;
  }
}
