/**
 * Per-page configuration for the embedded AI assistants.
 *
 * Each analysis page renders an `<AssistantPanel>`; this module holds the
 * grounded context (the data the page displays), a short human `briefing`
 * used for offline-mode replies, and suggested starter prompts. Keeping
 * them here instead of inline keeps the copy consistent and reviewable.
 */

import {
  dashboardStats,
  recentActivities,
  weeklyActivityData,
  monthlyTrendData,
  objectDetectionResult,
  changeDetectionResult,
  landCoverResult,
  measurements,
} from "@/data/mockData";
import { PAGE_ASSISTANT_INTRO } from "@/services/aiPrompts";
import type { Project, Report } from "@/types";

const n = (v: number) => v.toLocaleString("en-US");

export interface PageAssistant {
  title: string;
  eyebrow: string;
  systemPrompt: string;
  context: string;
  briefing: string;
  prompts: string[];
}

// ── Overview / Dashboard ───────────────────────────────────

export const overviewAssistant: PageAssistant = {
  title: "Ask about your workspace",
  eyebrow: "Overview · AI",
  systemPrompt: PAGE_ASSISTANT_INTRO,
  context: [
    "SatQuery workspace — Overview page. All figures below are the totals shown on the dashboard.",
    "",
    `Headline metrics — images analysed: ${n(dashboardStats.totalImagesAnalyzed)} (+12.3%); areas covered: ${n(dashboardStats.areasAnalyzed)} (+8.1%); objects detected: ${n(dashboardStats.objectsDetected)} (+15.7%); changes flagged: ${n(dashboardStats.changesDetected)} (+22.4%).`,
    "",
    "Active area of interest: Navi Mumbai, Maharashtra — urban expansion and mangrove conservation. Scene readouts: resolution 0.5 m, 34 analyses, 1,284 objects.",
    "",
    "Weekly activity (images analysed / analyses run): " +
      weeklyActivityData.map((d) => `${d.day} ${d.images}/${d.analyses}`).join(", ") + ".",
    "",
    "Monthly trend (objects detected / changes flagged / images): " +
      monthlyTrendData.map((d) => `${d.month} ${n(d.objects)}/${d.changes}/${n(d.images)}`).join("; ") + ".",
    "",
    "Recent activity (most recent first):",
    ...recentActivities.slice(0, 6).map((a) => `- ${a.title}: ${a.description} (${a.status})`),
  ].join("\n"),
  briefing:
    "Your workspace totals: 12,847 images analysed, 3,240 areas covered, 89,412 objects detected and 1,563 changes flagged, with the Navi Mumbai coastline as the active area of interest.",
  prompts: [
    "Summarise what's on this dashboard",
    "Which metric is trending up fastest?",
    "What does the recent activity show?",
  ],
};

// ── Object Detection ───────────────────────────────────────

const detections = objectDetectionResult;

export const objectDetectionAssistant: PageAssistant = {
  title: "Ask about these detections",
  eyebrow: "Object Detection · AI",
  systemPrompt: PAGE_ASSISTANT_INTRO,
  context: [
    "Object Detection page. One analysed scene is shown.",
    "",
    `Scene: ${detections.imageName} (image ${detections.imageId}, processed ${detections.processedAt}).`,
    `Total objects detected: ${detections.totalObjects}. Categories (count, average confidence):`,
    ...detections.categories.map(
      (c) => `- ${c.name}: ${c.count} object(s), avg confidence ${c.avgConfidence.toFixed(3)}`
    ),
    "Detected objects:",
    ...detections.detectedObjects.map(
      (o) => `- ${o.label} (${o.category}) — confidence ${Math.round(o.confidence * 100)}%`
    ),
  ].join("\n"),
  briefing: `This page shows object detection on the ${detections.imageName} scene: ${detections.totalObjects} objects across ${detections.categories.length} categories, with the building category most represented (3 objects, average confidence 94.3%).`,
  prompts: [
    "What did this scan detect?",
    "Which detections are most confident?",
    "Summarise the detection statistics",
  ],
};

// ── Change Detection ───────────────────────────────────────

const changes = changeDetectionResult;

export const changeDetectionAssistant: PageAssistant = {
  title: "Ask about these changes",
  eyebrow: "Change Detection · AI",
  systemPrompt: PAGE_ASSISTANT_INTRO,
  context: [
    "Change Detection page — a bi-temporal comparison over one area.",
    "",
    `Area: ${changes.location}. Acquisitions compared: ${changes.beforeDate} (before) and ${changes.afterDate} (after). Status: ${changes.status}.`,
    "Statistics (km²):",
    `- Total area changed: ${changes.statistics.totalAreaChanged} km²`,
    `- New construction: ${changes.statistics.newConstruction} km²`,
    `- Demolished: ${changes.statistics.demolished} km²`,
    `- Vegetation loss: ${changes.statistics.vegetationLoss} km²`,
    `- Vegetation gain: ${changes.statistics.vegetationGain} km²`,
    "Detected changes:",
    ...changes.changes.map(
      (c) => `- ${c.type.replace(/_/g, " ")}: ${c.description} — ${c.area} km², confidence ${Math.round(c.confidence * 100)}%`
    ),
  ].join("\n"),
  briefing: `This page compares ${changes.beforeDate} and ${changes.afterDate} imagery over ${changes.location}: 14.2 km² changed in total — 6.3 km² of new construction, 1.8 km² of vegetation loss — across 5 flagged regions.`,
  prompts: [
    "What changed in this area?",
    "Which change is most significant?",
    "Summarise these change statistics",
  ],
};

// ── Land Cover ─────────────────────────────────────────────

const landCover = landCoverResult;
const landCoverTotal = landCover.classifications.reduce((s, c) => s + c.area, 0);

export const landCoverAssistant: PageAssistant = {
  title: "Ask about this classification",
  eyebrow: "Land Cover · AI",
  systemPrompt: PAGE_ASSISTANT_INTRO,
  context: [
    "Land Cover page — multi-spectral classification of one area.",
    "",
    `Location: ${landCover.location}. Analysed ${landCover.analyzedAt}. Total classified area: ${n(landCoverTotal)} km².`,
    "Classes (name — percentage — area):",
    ...landCover.classifications.map(
      (c) => `- ${c.name}: ${c.percentage.toFixed(1)}% (${n(c.area)} km²)`
    ),
  ].join("\n"),
  briefing: `This page classifies the ${landCover.location} scene across ${n(landCoverTotal)} km². Cropland dominates at 62.4% (3,244 km²), followed by built-up area at 14.8%.`,
  prompts: [
    "What is the dominant land cover?",
    "Which classes are smallest?",
    "Summarise this classification",
  ],
};

// ── Measurements ───────────────────────────────────────────

export const measurementsAssistant: PageAssistant = {
  title: "Ask about saved measurements",
  eyebrow: "Measurements · AI",
  systemPrompt: PAGE_ASSISTANT_INTRO,
  context: [
    "Measurements page — geodesic measurements drawn onto imagery.",
    "Saved measurements:",
    ...measurements.map(
      (m) =>
        `- ${m.type}: ${m.value.toFixed(1)} ${m.unit} — "${m.label}" (${m.coordinates.length} points, saved ${m.createdAt})`
    ),
  ].join("\n"),
  briefing: `This page lists ${measurements.length} saved measurements — distances (Odisha coastline 12.4 km, Ganges width 3.2 km), areas (Kerala flood extent 8.7 km², Assam deforestation zone 52.1 km²) and a 28.6 km lake perimeter in Rajasthan.`,
  prompts: [
    "What measurements are saved?",
    "Which saved area is the largest?",
    "Summarise the saved measurements",
  ],
};

// ── Projects (dynamic — reads live list + filter) ─────────

export function projectsAssistant(shown: Project[], filter: string): PageAssistant {
  return {
    title: "Ask about your projects",
    eyebrow: "Projects · AI",
    systemPrompt: PAGE_ASSISTANT_INTRO,
    context: [
      "Projects page — area-of-interest tracking projects.",
      `Filter applied: ${filter}. Showing ${shown.length} of the workspace's projects.`,
      shown.length
        ? [
            "Projects shown:",
            ...shown.map(
              (p) =>
                `- ${p.name} (${p.location}): status ${p.status}; ${p.analysisCount} analyses, ${p.imageCount} images; updated ${p.updatedAt}. Description: ${p.description}`
            ),
          ].join("\n")
        : "No projects match the current search/filter.",
    ].join("\n"),
    briefing: `This page lists your satellite-monitoring projects${filter !== "all" ? ` (currently filtered to ${filter})` : ""} — ${shown.length} shown, including active watches like Navi Mumbai Urban Growth and Sundarbans Ecosystem Watch.`,
    prompts: [
      "What projects am I running?",
      "Which project has the most analyses?",
      "What is the Navi Mumbai project tracking?",
    ],
  };
}

// ── Reports (dynamic — reads live list) ────────────────────

export function reportsAssistant(list: Report[]): PageAssistant {
  return {
    title: "Ask about your reports",
    eyebrow: "Reports · AI",
    systemPrompt: PAGE_ASSISTANT_INTRO,
    context: [
      "Reports page — generated analysis documents.",
      list.length
        ? [
            "Reports:",
            ...list.map(
              (r) =>
                `- "${r.title}" (project: ${r.projectName}; status: ${r.status}; ${r.pageCount} pages). Summary: ${r.summary}`
            ),
          ].join("\n")
        : "No reports yet.",
    ].join("\n"),
    briefing: `This page lists ${list.length} generated report${list.length === 1 ? "" : "s"} — for example the Navi Mumbai Urban Expansion Q3 2026 report (24 pages, generated) and the Sundarbans Mangrove Health annual assessment.`,
    prompts: [
      "What reports exist?",
      "Which reports are still drafts?",
      "Summarise the most recent report",
    ],
  };
}
