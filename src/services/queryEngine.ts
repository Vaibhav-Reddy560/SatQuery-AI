/**
 * Query Engine — orchestrates the full pipeline:
 *
 *   User Query → Parser → Intent → Tool Selection → Analysis Runner → Result → Response
 *
 * Since the "AI is live" work, the engine is hybrid:
 *
 * - **Analysis intents** (detect water, classify land cover, …) run the real
 *   pipeline (backend satellite algorithms when reachable, else the local
 *   mock engine) so the typed result, overlays and panels stay grounded.
 *   When the backend produced a live result, the live language model then
 *   *writes the prose* — with the structured result as grounding context —
 *   so the chat reply reads naturally without inventing numbers.
 * - **General/conversational questions** are answered directly by the live
 *   language model with full conversation history, ChatGPT-style. If no AI
 *   is reachable they degrade to the deterministic engine.
 *
 * Nothing here depends on the model being configured: every path returns a
 * valid QueryResponse, exactly as before.
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
import type { GeoCoordinates } from "@/types";
import { parseQuery } from "./queryParser";
import { findToolForIntent } from "./analysisTools";
import { runAnalysis } from "./analysisRunner";
import { sendQueryToBackend } from "./apiClient";
import { chatWithAi, type AiTurn } from "./aiClient";
import { SATQUERY_SYSTEM_PROMPT } from "./aiPrompts";

// ── Process options ───────────────────────────────────────

export interface ProcessQueryOptions {
  /** Human-readable summary of the user's workspace/AOI (drawn area…). */
  aoi?: string;
  /** Centre of the drawn AOI — used when the query text has no location. */
  aoiCentre?: GeoCoordinates;
  /** Location name for the AOI (shown in results + sent to the backend). */
  aoiName?: string;
  /** Prior conversation turns (oldest first), for follow-up coherence. */
  history?: AiTurn[];
}

/** System prompt used to rewrite analysis summaries into chat prose. */
const ANALYSIS_WRITER_PROMPT = `You are the response writer for SatQuery, a satellite-intelligence platform. A structured satellite analysis just ran; its result JSON is supplied as grounded context.

Write the chat reply the user sees. Rules:
- Lead with the single most important finding, then the supporting detail.
- ONLY cite figures that appear in the grounded result JSON. Never round or extrapolate numbers that aren't there; if a requested figure is absent, say it isn't available.
- Use light markdown: **bold** for key numbers, bullet lists for enumerations.
- Keep it to roughly 6–12 lines; finish with one concrete next step or question.
- Stay factual and neutral — this is an analysis report, not marketing.`;

// ── Response formatters (local mock engine) ───────────────

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

function formatResponse(result: AnalysisOutput): string {
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
    case "visual":
      // Real VLM results always come from the live backend; the answer is the
      // model's actual output, never rewritten or approximated.
      return result.answer || result.summaryText;
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
    case "visual":
      return [
        { type: "image", label: "Analysed Sentinel-2 scene (true-colour RGB)" },
        { type: "data", label: "Vision-language interpretation" },
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
    visual_interpretation: ["Analyze vegetation over this scene", "Detect water here"],
    general_question: ["Ask a follow-up"],
  };
  return [...(extras[intent.type] ?? []), ...base];
}

// ── Live-AI helpers ───────────────────────────────────────

/**
 * Compact, lossy summary of an AnalysisOutput used ONLY as grounding for the
 * prose writer. Explicitly excludes imagery metadata and raster overlays
 * (which may embed large data URLs) so nothing huge is shipped to the model.
 */
function summarizeResultForAi(result: AnalysisOutput): string {
  // A VLM has no calibrated confidence, so visual results carry none.
  const confidence = result.kind === "visual" ? null : result.confidence;
  const head = `kind=${result.kind}; tool=${result.toolId}; location=${result.location}; ` +
    `confidence=${confidence}${result.mode ? `; mode=${result.mode}` : ""}` +
    (result.model ? `; model=${result.model}${result.modelVersion ? ` (${result.modelVersion})` : ""}` : "");
  switch (result.kind) {
    case "detection":
      return `${head}; total_features=${result.totalFeatures}; features=${JSON.stringify(
        result.features.map((f) => ({ label: f.label, category: f.category, confidence: f.confidence, area_km2: f.areaKm2 }))
      )}`;
    case "change":
      return `${head}; before=${result.beforeDate}; after=${result.afterDate}; ` +
        `total_area_changed_km2=${result.totalAreaChangedKm2}; changes=${JSON.stringify(
          result.changes.map((c) => ({ type: c.type, description: c.description, area_km2: c.areaKm2, confidence: c.confidence }))
        )}${result.changeStats ? `; stats=${JSON.stringify(result.changeStats)}` : ""}`;
    case "land_cover":
      return `${head}; total_area_km2=${result.totalAreaKm2}; classes=${JSON.stringify(
        result.classes.map((c) => ({ name: c.name, percentage: c.percentage, area_km2: c.areaKm2 }))
      )}`;
    case "vegetation":
      return `${head}; total_area_km2=${result.totalAreaKm2}; vegetation_lost_km2=${result.vegetationLostKm2}; ` +
        `zones=${JSON.stringify(result.zones)}` +
        (result.ndviStats ? `; ndvi_stats=${JSON.stringify(result.ndviStats)}` : "");
    case "water":
      return `${head}; water_area_km2=${result.waterAreaKm2}; total_area_km2=${result.totalAreaKm2}; ` +
        `threshold=${result.threshold}` +
        (result.ndwiStats ? `; ndwi_stats=${JSON.stringify(result.ndwiStats)}` : "");
    case "measurement":
      return `${head}; measurement_type=${result.measurementType}; value=${result.value}; unit=${result.unit}; points=${result.points.length}`;
    case "visual":
      // Not normally sent to the prose writer (real VLM answers are preserved
      // verbatim), but kept for type completeness.
      return `${head}; question=${result.question}; answer=${result.answer}`;
  }
}

/** Wrap a pure conversational model reply in the typed QueryResponse shape. */
function buildConversationalResponse(
  userQuery: Query,
  intent: QueryIntent,
  text: string,
  model: string
): QueryResponse {
  const result: DetectionResult = {
    kind: "detection",
    toolId: "conversational_assistant",
    queryId: userQuery.id,
    confidence: intent.confidence,
    location: intent.location ?? "Conversation",
    centre: intent.centre,
    features: [],
    totalFeatures: 0,
    summaryText: text,
    mode: "live",
    model,
    modelKind: undefined,
  };
  return {
    queryId: userQuery.id,
    intent,
    result,
    responseText: text,
    attachments: [],
    suggestedActions: ["Ask a follow-up", "Try an analysis: e.g. \u201Cdetect water bodies near Mumbai\u201D"],
    processingTimeMs: 400,
    trace: [
      "No analysis tool needed — routed to the conversational model",
      `Answered by ${model} (live)`,
    ],
  };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Process a user query through the (local, deterministic) mock pipeline.
 * Returns a QueryResponse ready for the chat UI. `opts` may override the
 * centre/location the parser found (e.g. from a drawn AOI).
 */
export function processQuery(userQuery: Query, opts: ProcessQueryOptions = {}): QueryResponse {
  const startTime = performance.now();

  // 1. Parse
  const intent = parseQuery(userQuery.raw);
  if (opts.aoiCentre) intent.centre = opts.aoiCentre;
  if (opts.aoiName && !intent.location) intent.location = opts.aoiName;

  // Visual interpretation is a REAL live-backend capability (SmolVLM over
  // actual Sentinel-2 RGB pixels). The local mock engine must NEVER fabricate
  // a visual answer: offline, return an honest mock-stamped unavailable result.
  if (intent.type === "visual_interpretation") {
    const unavailable: DetectionResult = {
      kind: "detection",
      toolId: "visual_analyzer",
      queryId: userQuery.id,
      mode: "mock",
      confidence: 0,
      location: intent.location ?? "Selected AOI",
      centre: intent.centre,
      features: [],
      totalFeatures: 0,
      summaryText:
        "Visual interpretation is unavailable offline: it requires the live " +
        "backend running the real vision-language model (SmolVLM) over real " +
        "Sentinel-2 imagery. No visual result was fabricated.",
    };
    return {
      queryId: userQuery.id,
      intent,
      result: unavailable,
      responseText: unavailable.summaryText,
      attachments: [],
      suggestedActions: ["Ask a follow-up"],
      processingTimeMs: 0,
      trace: ["Visual interpretation needs the live backend — not available offline (mock)"],
    };
  }

  // 2. Select tool
  const tool = findToolForIntent(intent.type);

  // 3. Run analysis
  const result: AnalysisOutput = runAnalysis(intent, tool?.id ?? "object_detector");

  // 4. Set queryId on result
  result.queryId = userQuery.id;

  // 5. Format response
  const responseText = formatResponse(result);
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

/**
 * Process a query with the live AI available:
 *
 * 1. Conversational questions → answered by the LLM with history + AOI
 *    context; falls back to the mock engine when no AI is reachable.
 * 2. Analysis questions → real backend analysis (or mock fallback); when the
 *    backend produced the result, the LLM rewrites the prose grounded in the
 *    structured result JSON.
 */
export async function processQueryAsync(
  userQuery: Query,
  opts: ProcessQueryOptions = {}
): Promise<QueryResponse> {
  const parsed = parseQuery(userQuery.raw);
  const isAnalysis = parsed.type !== "general_question";

  const aiMessages: AiTurn[] = [...(opts.history ?? []), { role: "user", content: userQuery.raw }];
  const aoiNote = opts.aoi ?? "";
  const aoiContext = [aoiNote, parsed.location ? `Mentioned location: ${parsed.location}` : ""]
    .filter(Boolean)
    .join("\n");

  // ── 1. Pure conversation → live model first ─────────────
  if (!isAnalysis) {
    const ai = await chatWithAi({
      messages: aiMessages,
      systemPrompt: SATQUERY_SYSTEM_PROMPT,
      context: aoiContext || undefined,
      maxTokens: 1024,
    });
    if (ai) {
      return buildConversationalResponse(userQuery, parsed, ai.reply, ai.model);
    }
    // Offline: local deterministic pipeline (same cadence as before).
    return new Promise((resolve) => {
      const delay = 400 + Math.random() * 600;
      setTimeout(() => resolve(processQuery(userQuery, opts)), delay);
    });
  }

  // ── 2. Analysis intent → backend (real) or mock ─────────
  const centre: [number, number] = opts.aoiCentre
    ? [opts.aoiCentre.lng, opts.aoiCentre.lat]
    : [parsed.centre.lng, parsed.centre.lat];
  const location = parsed.location ?? opts.aoiName ?? "Selected AOI";

  let response: QueryResponse | null = null;
  let liveResult = false;
  try {
    response = await sendQueryToBackend(userQuery.id, userQuery.raw, centre, location);
    liveResult = response !== null;
  } catch {
    response = null;
  }

  if (!response) {
    const delay = 400 + Math.random() * 600;
    response = await new Promise<QueryResponse>((resolve) => {
      setTimeout(() => resolve(processQuery(userQuery, opts)), delay);
    });
  }

  // ── 3. Live-model prose over REAL backend results only —─
  // (Mock fallback results keep their honest, deterministic summaries.
  // Real VLM visual answers are the model's own words and are preserved
  // verbatim — never rewritten by a second model.)
  if (liveResult && response.result.kind !== "visual") {
    const ai = await chatWithAi({
      messages: aiMessages,
      systemPrompt: ANALYSIS_WRITER_PROMPT,
      context: `${summarizeResultForAi(response.result)}\n${aoiContext}`.trim(),
      maxTokens: 700,
    });
    if (ai) {
      response.responseText = ai.reply;
      response.trace = [
        ...(response.trace ?? []),
        `Answer written by live AI (${ai.model}), grounded in the structured ${response.result.kind} result`,
      ];
    }
  }

  return response;
}
