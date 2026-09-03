/**
 * Analysis Tools — registry of available tools.
 *
 * Each tool declares which intents it supports. The query engine uses
 * this registry to select the right tool for a parsed intent.
 *
 * Tool *implementations* (the mock runners) live in analysisRunner.ts.
 */

import type { AnalysisTool, AnalysisToolId, IntentType } from "@/types/query";

export const ANALYSIS_TOOLS: AnalysisTool[] = [
  {
    id: "object_detector",
    name: "Object Detector",
    description: "Identifies and counts objects (buildings, vehicles, roads, etc.) in satellite imagery",
    supportedIntents: ["detect_objects"],
  },
  {
    id: "water_finder",
    name: "Water Finder",
    description: "Detects and delineates water bodies in multi-spectral imagery",
    supportedIntents: ["find_water"],
  },
  {
    id: "change_detector",
    name: "Change Detector",
    description: "Compares two satellite images to identify land-use changes over time",
    supportedIntents: ["detect_changes"],
  },
  {
    id: "land_cover_classifier",
    name: "Land Cover Classifier",
    description: "Classifies terrain into land cover categories with percentage breakdown",
    supportedIntents: ["classify_land_cover"],
  },
  {
    id: "vegetation_analyser",
    name: "Vegetation Analyser",
    description: "Analyses vegetation health and detects loss or deforestation",
    supportedIntents: ["detect_vegetation_loss", "detect_deforestation"],
  },
  {
    id: "area_measurer",
    name: "Area Measurer",
    description: "Measures the area of a selected region or feature",
    supportedIntents: ["measure_area"],
  },
  {
    id: "distance_measurer",
    name: "Distance Measurer",
    description: "Measures linear distance between two points",
    supportedIntents: ["measure_distance"],
  },
  {
    id: "perimeter_measurer",
    name: "Perimeter Measurer",
    description: "Measures the perimeter of a polygon or boundary",
    supportedIntents: ["measure_perimeter"],
  },
  {
    id: "crop_health_analyser",
    name: "Crop Health Analyser",
    description: "Estimates crop health using NDVI and multi-spectral analysis",
    supportedIntents: ["estimate_crop_health"],
  },
  {
    id: "conversational_assistant",
    name: "AI Assistant (Gemini)",
    description: "Direct conversational answer from the live language model — no analysis tool runs",
    supportedIntents: ["general_question"],
  },
];

// ── Lookup helpers ─────────────────────────────────────────

export function findToolForIntent(intent: IntentType): AnalysisTool | undefined {
  return ANALYSIS_TOOLS.find((t) => t.supportedIntents.includes(intent));
}

export function getToolById(id: AnalysisToolId): AnalysisTool | undefined {
  return ANALYSIS_TOOLS.find((t) => t.id === id);
}
