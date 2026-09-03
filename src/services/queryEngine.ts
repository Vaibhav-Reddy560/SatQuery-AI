/**
 * Query Engine — orchestrates the full pipeline:
 *
 *   User Query → Parser → Intent → Tool Selection → Analysis Runner → Result → Response
 *
 * This module is the single public entry point. Everything downstream
 * is replaceable (swap mock parser for LLM, swap mock runner for real APIs)
 * without touching the Query page.
 */

import type {
  Query,
  QueryIntent,
  QueryResponse,
  AnalysisOutput,
  DetectionResult,
  ChangeResult,
  LandCoverResult,
  MeasurementResult,
} from "@/types/query";
import { parseQuery, intentLabel } from "./queryParser";
import { findToolForIntent } from "./analysisTools";
import { runAnalysis } from "./analysisRunner";

// ── Response formatters ────────────────────────────────────

function formatDetectionResponse(r: DetectionResult): string {
  const cats = [...new Set(r.features.map((f) => f.category))];
  return (
    `Based on multi-spectral analysis of **${r.location}**, ` +
    `I identified **${r.totalFeatures} features** across ${cats.length} categories.\n\n` +
    r.features
      .slice(0, 6)
      .map((f) => `• **${f.label}** (${f.category}) — confidence ${Math.round(f.confidence * 100)}%`)
      .join("\n") +
    (r.features.length > 6 ? `\n• …and ${r.features.length - 6} more` : "") +
    `\n\nOverall confidence: **${Math.round(r.confidence * 100)}%**. ` +
    `Would you like me to show these on the map or generate a detailed report?`
  );
}

function formatChangeResponse(r: ChangeResult): string {
  return (
    `Comparing imagery from **${r.beforeDate}** to **${r.afterDate}** for **${r.location}**:\n\n` +
    r.changes
      .map((c) => `• **${c.areaKm2} km²** — ${c.description} (confidence ${Math.round(c.confidence * 100)}%)`)
      .join("\n") +
    `\n\nTotal changed area: **${r.totalAreaChangedKm2} km²**. ` +
    `Net change is ${r.totalAreaChangedKm2 > 10 ? "significant" : "moderate"} over this period. ` +
    `Would you like a change report or to zoom into specific areas?`
  );
}

function formatLandCoverResponse(r: LandCoverResult): string {
  return (
    `Land cover classification for **${r.location}** across **${r.totalAreaKm2.toLocaleString()} km²**:\n\n` +
    r.classes
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 6)
      .map((c) => `• **${c.name}** — ${c.percentage}% (${c.areaKm2.toLocaleString()} km²)`)
      .join("\n") +
    `\n\nDominant class: **${r.classes[0].name}**. ` +
    `Classification confidence: **${Math.round(r.confidence * 100)}%**. ` +
    `Would you like to explore specific classes on the map?`
  );
}

function formatMeasurementResponse(r: MeasurementResult): string {
  const typeLabel = r.measurementType.charAt(0).toUpperCase() + r.measurementType.slice(1);
  return (
    `**${typeLabel} measurement** for **${r.location}**:\n\n` +
    `• Value: **${r.value} ${r.unit}**\n` +
    `• Points used: ${r.points.length}\n` +
    `• Confidence: **${Math.round(r.confidence * 100)}%**\n\n` +
    `${r.summaryText}\n\n` +
    `Would you like to save this measurement or use it as input for another analysis?`
  );
}

function formatResponse(result: AnalysisOutput, intent: QueryIntent): string {
  switch (result.kind) {
    case "detection":
      return formatDetectionResponse(result);
    case "change":
      // Backend bi-temporal results carry a rich summary naming both
      // observations; the local mock engine formats its own response.
      if (result.beforeImagery || result.afterImagery || result.changeStats) {
        return result.summaryText;
      }
      return formatChangeResponse(result);
    case "land_cover":
      // Backend ML results carry a rich model + provenance summary; the
      // local mock engine formats its own deterministic response.
      if (result.model || result.imagery || result.mode === "live") {
        return result.summaryText;
      }
      return formatLandCoverResponse(result);
    case "vegetation":
    case "water":
      // Forward-compat: backend vegetation/water results carry their own
      // rich summary; the local mock engine never produces these kinds.
      return result.summaryText;
    case "measurement":
      return formatMeasurementResponse(result);
  }
}

function getAttachments(result: AnalysisOutput): QueryResponse["attachments"] {
  switch (result.kind) {
    case "detection":
      return [
        { type: "image", label: `${result.features.length} detected features overlay`, confidence: result.confidence },
        { type: "data", label: "Detection statistics" },
      ];
    case "change":
      return [
        {
          type: "map_region",
          label: result.overlay ? "Real delta-NDVI change overlay (Sentinel-2)" : "Change detection overlay",
          confidence: result.confidence,
        },
        { type: "data", label: `${result.changes.length} change classes` },
      ];
    case "land_cover":
      return [
        {
          type: "map_region",
          label: result.overlay ? "Real ML land-cover classification (Sentinel-2)" : "Land cover classification map",
          confidence: result.confidence,
        },
        { type: "data", label: `${result.classes.length} land classes` },
      ];
    case "vegetation":
      return [
        {
          type: "map_region",
          label: result.overlay ? "Real NDVI overlay (Sentinel-2)" : "Vegetation status zones",
          confidence: result.confidence,
        },
        { type: "data", label: "Vegetation health summary" },
      ];
    case "water":
      return [
        {
          type: "map_region",
          label: result.overlay ? "Real NDWI water mask (Sentinel-2)" : "Water body zones",
          confidence: result.confidence,
        },
        { type: "data", label: "Water statistics" },
      ];
    case "measurement":
      return [
        { type: "map_region", label: "Measurement overlay", confidence: result.confidence },
      ];
  }
}

function getSuggestedActions(intent: QueryIntent): string[] {
  const base = ["Show on map", "Export results"];
  const extras: Record<string, string[]> = {
    detect_objects: ["Compare with previous scan", "Filter by category"],
    find_water: ["Measure water area", "Compare with last month"],
    detect_changes: ["Generate change report", "Zoom to changes"],
    classify_land_cover: ["View class breakdown", "Compare regions"],
    measure_area: ["Measure perimeter", "Export GeoJSON"],
    measure_distance: ["Measure area between", "Export GeoJSON"],
    measure_perimeter: ["Measure enclosed area", "Export GeoJSON"],
    detect_vegetation_loss: ["Show on map", "Generate vegetation report"],
    detect_deforestation: ["Show on map", "Compare with baseline"],
    estimate_crop_health: ["View NDVI map", "Estimate yield"],
    general_question: ["Ask a follow-up"],
  };
  return [...(extras[intent.type] ?? []), ...base];
}

// ── Public API ─────────────────────────────────────────────

/**
 * Process a user query through the full pipeline.
 * Returns a QueryResponse ready for the chat UI.
 */
export function processQuery(userQuery: Query): QueryResponse {
  const startTime = performance.now();

  // 1. Parse
  const intent = parseQuery(userQuery.raw);

  // 2. Select tool
  const tool = findToolForIntent(intent.type);

  // 3. Run analysis
  const result: AnalysisOutput = runAnalysis(intent, tool?.id ?? "object_detector");

  // 4. Set queryId on result
  result.queryId = userQuery.id;

  // 5. Format response
  const responseText = formatResponse(result, intent);
  const attachments = getAttachments(result);
  const suggestedActions = getSuggestedActions(intent);

  const processingTimeMs = Math.round(performance.now() - startTime + 400 + Math.random() * 600);

  return {
    queryId: userQuery.id,
    intent,
    result,
    responseText,
    attachments,
    suggestedActions,
    processingTimeMs,
  };
}

import { sendQueryToBackend } from "./apiClient";

/**
 * Process query asynchronously via Backend FastAPI VLM service if available,
 * with fallback to the local simulated pipeline.
 */
export async function processQueryAsync(userQuery: Query): Promise<QueryResponse> {
  // Attempt backend API call first. Parse the text for a location/centre so
  // the backend receives real context instead of a hardcoded India default.
  const parsed = parseQuery(userQuery.raw);
  const centre: [number, number] = [parsed.centre.lng, parsed.centre.lat];
  const location = parsed.location ?? "Selected AOI";

  const backendResponse = await sendQueryToBackend(userQuery.id, userQuery.raw, centre, location);
  if (backendResponse) {
    return backendResponse;
  }

  // Local fallback execution
  const delay = 400 + Math.random() * 600;
  return new Promise((resolve) => {
    setTimeout(() => resolve(processQuery(userQuery)), delay);
  });
}


