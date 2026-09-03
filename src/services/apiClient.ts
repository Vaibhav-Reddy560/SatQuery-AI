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
  IntentType,
  LandCoverResult,
  MeasurementKind,
  MeasurementResult,
  QueryIntent,
  QueryResponse,
  VegetationResult,
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

interface BackendPayload {
  kind?: string | null;
  tool_id?: string | null;
  location?: string | null;
  centre?: number[] | null;
  confidence?: number | null;
  model?: string | null;
  model_version?: string | null;
  mode?: string | null;
  summary_text?: string | null;
  total_features?: number | null;
  features?: BackendFeature[] | null;
  categories?: Record<string, number> | null;
  total_area_km2?: number | null;
  classes?: BackendLandClass[] | null;
  before_date?: string | null;
  after_date?: string | null;
  total_area_changed_km2?: number | null;
  changes?: BackendChange[] | null;
  vegetation_lost_km2?: number | null;
  zones?: BackendZone[] | null;
  measurement_type?: string | null;
  value?: number | null;
  unit?: string | null;
  points?: number[][] | null;
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
      const result: ChangeResult = {
        kind: "change",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
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
      };
      return result;
    }
    case "land_cover": {
      const result: LandCoverResult = {
        kind: "land_cover",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
        classes: (payload.classes ?? []).map((c) => ({
          name: str(c.name ?? null, "Unknown class"),
          percentage: num(c.percentage, 0),
          areaKm2: num(c.area_km2, 0),
          color: str(c.color ?? null, "#6b7280"),
        })),
        totalAreaKm2: num(payload.total_area_km2, 0),
        summaryText: str(payload.summary_text ?? null, "Land cover classification complete."),
      };
      return result;
    }
    case "vegetation": {
      const result: VegetationResult = {
        kind: "vegetation",
        toolId: toolIdFor(payload, kind),
        queryId,
        confidence: num(payload.confidence, confidence),
        location,
        centre,
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
