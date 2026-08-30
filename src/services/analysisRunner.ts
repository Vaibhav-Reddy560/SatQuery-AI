/**
 * Mock Analysis Runner — produces deterministic fake results.
 *
 * When real APIs are connected, replace these functions with actual
 * API calls. The return types stay the same so the rest of the
 * pipeline doesn't change.
 */

import type { QueryIntent, AnalysisOutput, DetectionResult, ChangeResult, LandCoverResult, MeasurementResult } from "@/types/query";
import { satelliteImages } from "@/data/mockData";

// ── Helpers ────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function nearestImage(lat: number, lng: number) {
  let best = satelliteImages[0];
  let bestDist = Infinity;
  for (const img of satelliteImages) {
    const d = Math.hypot(img.coordinates.lat - lat, img.coordinates.lng - lng);
    if (d < bestDist) { bestDist = d; best = img; }
  }
  return best;
}

// ── Detection Mock ─────────────────────────────────────────

const OBJECT_CATEGORIES = [
  { label: "Building Complex", category: "Building" },
  { label: "Residential Block", category: "Building" },
  { label: "Commercial Tower", category: "Building" },
  { label: "Industrial Facility", category: "Building" },
  { label: "Highway Segment", category: "Road" },
  { label: "Local Road Network", category: "Road" },
  { label: "Parking Lot", category: "Vehicle" },
  { label: "Tree Cluster", category: "Vegetation" },
  { label: "Agricultural Field", category: "Vegetation" },
  { label: "Storm Water Drain", category: "Water Body" },
  { label: "Solar Panel Array", category: "Solar Panel" },
  { label: "Railway Track", category: "Infrastructure" },
  { label: "Bridge Structure", category: "Infrastructure" },
  { label: "Stadium", category: "Building" },
  { label: "Airport Runway", category: "Infrastructure" },
];

const WATER_BODIES = [
  { label: "Matla River", category: "River" },
  { label: "Bidyadhari River", category: "River" },
  { label: "Ganges River", category: "River" },
  { label: "Backwater Channel", category: "Canal" },
  { label: "Reservoir", category: "Lake" },
  { label: "Tidal Creek", category: "Creek" },
  { label: "Storm Water Pond", category: "Pond" },
  { label: "Distributary Channel", category: "Channel" },
];

function runDetection(intent: QueryIntent): DetectionResult {
  const img = nearestImage(intent.centre.lat, intent.centre.lng);
  const count = Math.floor(6 + Math.random() * 15);
  const features = Array.from({ length: count }, (_, i) => {
    const template = pick(OBJECT_CATEGORIES);
    return {
      id: `feat-${i}`,
      label: template.label,
      category: template.category,
      confidence: randBetween(0.78, 0.98),
      areaKm2: randBetween(0.01, 2.5),
    };
  });

  return {
    kind: "detection",
    toolId: "object_detector",
    queryId: "",
    confidence: randBetween(0.85, 0.96),
    location: intent.location ?? img.location,
    centre: intent.centre,
    features,
    totalFeatures: features.length,
    summaryText: `Identified **${features.length} features** across ${img.name} (${img.resolution} resolution, ${img.source}). ` +
      `Categories include ${[...new Set(features.map((f) => f.category))].join(", ")}. ` +
      `Average confidence: **${Math.round(features.reduce((s, f) => s + f.confidence, 0) / features.length * 100)}%**.`,
  };
}

// ── Water Body Mock ────────────────────────────────────────

function runWaterFinder(intent: QueryIntent): DetectionResult {
  const img = nearestImage(intent.centre.lat, intent.centre.lng);
  const count = Math.floor(5 + Math.random() * 10);
  const features = Array.from({ length: count }, (_, i) => {
    const template = pick(WATER_BODIES);
    return {
      id: `water-${i}`,
      label: template.label,
      category: template.category,
      confidence: randBetween(0.82, 0.97),
      areaKm2: randBetween(0.3, 22),
    };
  });

  const totalArea = Math.round(features.reduce((s, f) => s + (f.areaKm2 ?? 0), 0) * 10) / 10;

  return {
    kind: "detection",
    toolId: "water_finder",
    queryId: "",
    confidence: randBetween(0.88, 0.95),
    location: intent.location ?? img.location,
    centre: intent.centre,
    features,
    totalFeatures: features.length,
    summaryText: `Found **${features.length} water bodies** covering approximately **${totalArea} km²**. ` +
      `Major features: ${features.slice(0, 3).map((f) => `**${f.label}** (${f.areaKm2} km²)`).join(", ")}. ` +
      `Water turbidity is ${pick(["elevated", "normal", "slightly elevated"])} across the region.`,
  };
}

// ── Change Detection Mock ──────────────────────────────────

const CHANGE_TYPES = [
  "new_construction",
  "demolition",
  "vegetation_change",
  "water_change",
  "land_use_change",
] as const;

const CHANGE_DESCRIPTIONS: Record<string, string[]> = {
  new_construction: [
    "New residential complex along the main road",
    "Commercial IT park expansion",
    "Industrial warehouse development",
    "High-rise apartment construction",
  ],
  demolition: [
    "Old industrial structures cleared",
    "Decommissioned facility removed",
  ],
  vegetation_change: [
    "Mangrove buffer zone reduced",
    "Tree canopy loss along riverbank",
    "New plantation area established",
    "Grassland converting to shrubland",
  ],
  water_change: [
    "Coastal silting observed",
    "River course shifted",
    "New pond formation",
    "Seasonal wetland drying",
  ],
  land_use_change: [
    "Agricultural land converted to industrial zone",
    "Forest reclassified as reserve",
    "Residential area expanded into farmland",
  ],
};

function runChangeDetection(intent: QueryIntent): ChangeResult {
  const img = nearestImage(intent.centre.lat, intent.centre.lng);
  const count = Math.floor(3 + Math.random() * 5);
  const changes = Array.from({ length: count }, (_, i) => {
    const type = pick([...CHANGE_TYPES]);
    return {
      id: `chg-${i}`,
      type,
      description: pick(CHANGE_DESCRIPTIONS[type]),
      areaKm2: randBetween(0.2, 8),
      confidence: randBetween(0.75, 0.96),
    };
  });

  const totalArea = Math.round(changes.reduce((s, c) => s + c.areaKm2, 0) * 10) / 10;

  return {
    kind: "change",
    toolId: "change_detector",
    queryId: "",
    confidence: randBetween(0.82, 0.94),
    location: intent.location ?? img.location,
    centre: intent.centre,
    changes,
    totalAreaChangedKm2: totalArea,
    beforeDate: "2024-03-15",
    afterDate: "2026-08-12",
    summaryText: `Compared imagery from **March 2024** to **August 2026** for ${intent.location ?? img.location}. ` +
      `Detected **${changes.length} significant changes** across **${totalArea} km²**. ` +
      `Key findings: ${changes.slice(0, 2).map((c) => c.description).join("; ")}.`,
  };
}

// ── Land Cover Mock ────────────────────────────────────────

const LAND_CLASSES = [
  { name: "Cropland", color: "#22c55e", basePct: 40 },
  { name: "Built-up Area", color: "#3b82f6", basePct: 15 },
  { name: "Water Bodies", color: "#06b6d4", basePct: 8 },
  { name: "Bare Soil", color: "#d97706", basePct: 10 },
  { name: "Tree Cover", color: "#15803d", basePct: 12 },
  { name: "Grassland", color: "#84cc16", basePct: 8 },
  { name: "Shrubland", color: "#a16207", basePct: 5 },
  { name: "Wetland", color: "#0891b2", basePct: 2 },
];

function runLandCover(intent: QueryIntent): LandCoverResult {
  const img = nearestImage(intent.centre.lat, intent.centre.lng);
  const totalArea = randBetween(800, 6000);

  // Randomize percentages but ensure they sum to ~100
  let raw = LAND_CLASSES.map((c) => ({
    ...c,
    rawPct: c.basePct + randBetween(-5, 5),
  }));
  const sum = raw.reduce((s, c) => s + c.rawPct, 0);
  const classes = raw.map((c) => ({
    name: c.name,
    color: c.color,
    percentage: Math.round((c.rawPct / sum) * 1000) / 10,
    areaKm2: Math.round((c.rawPct / sum) * totalArea),
  }));

  return {
    kind: "land_cover",
    toolId: "land_cover_classifier",
    queryId: "",
    confidence: randBetween(0.86, 0.95),
    location: intent.location ?? img.location,
    centre: intent.centre,
    classes,
    totalAreaKm2: totalArea,
    summaryText: `Land cover analysis for ${intent.location ?? img.location} over **${totalArea.toLocaleString()} km²**. ` +
      `Dominant class: **${classes[0].name}** (${classes[0].percentage}%). ` +
      `Built-up area accounts for **${classes[1].percentage}%** of the landscape.`,
  };
}

// ── Measurement Mocks ──────────────────────────────────────

function runAreaMeasurement(intent: QueryIntent): MeasurementResult {
  const value = randBetween(0.5, 45);
  return {
    kind: "measurement",
    toolId: "area_measurer",
    queryId: "",
    confidence: 0.99,
    location: intent.location ?? "Selected Region",
    centre: intent.centre,
    measurementType: "area",
    value,
    unit: "km²",
    points: [
      intent.centre,
      { lat: intent.centre.lat + 0.05, lng: intent.centre.lng + 0.03 },
      { lat: intent.centre.lat + 0.03, lng: intent.centre.lng - 0.04 },
      { lat: intent.centre.lat - 0.02, lng: intent.centre.lng - 0.02 },
    ],
    summaryText: `Measured area: **${value} km²** for the selected region near ${intent.location ?? "the query location"}. ` +
      `The area was calculated from 4 boundary points using planar approximation.`,
  };
}

function runDistanceMeasurement(intent: QueryIntent): MeasurementResult {
  const value = randBetween(0.8, 35);
  return {
    kind: "measurement",
    toolId: "distance_measurer",
    queryId: "",
    confidence: 0.99,
    location: intent.location ?? "Selected Route",
    centre: intent.centre,
    measurementType: "distance",
    value,
    unit: "km",
    points: [intent.centre, { lat: intent.centre.lat + 0.15, lng: intent.centre.lng + 0.1 }],
    summaryText: `Measured distance: **${value} km** between the two selected points near ${intent.location ?? "the query location"}.`,
  };
}

function runPerimeterMeasurement(intent: QueryIntent): MeasurementResult {
  const value = randBetween(3, 60);
  return {
    kind: "measurement",
    toolId: "perimeter_measurer",
    queryId: "",
    confidence: 0.99,
    location: intent.location ?? "Selected Boundary",
    centre: intent.centre,
    measurementType: "perimeter",
    value,
    unit: "km",
    points: [
      intent.centre,
      { lat: intent.centre.lat + 0.04, lng: intent.centre.lng + 0.06 },
      { lat: intent.centre.lat - 0.03, lng: intent.centre.lng + 0.05 },
      { lat: intent.centre.lat - 0.04, lng: intent.centre.lng - 0.03 },
    ],
    summaryText: `Measured perimeter: **${value} km** for the boundary near ${intent.location ?? "the query location"}.`,
  };
}

// ── Vegetation Loss Mock ───────────────────────────────────

function runVegetationLoss(intent: QueryIntent): ChangeResult {
  const img = nearestImage(intent.centre.lat, intent.centre.lng);
  const changes = [
    { id: "vl-1", type: "vegetation_change", description: "Mangrove/forest area reduced along waterway", areaKm2: randBetween(0.5, 4), confidence: randBetween(0.82, 0.95) },
    { id: "vl-2", type: "vegetation_change", description: "Tree canopy thinning observed in buffer zone", areaKm2: randBetween(0.2, 2), confidence: randBetween(0.78, 0.92) },
    { id: "vl-3", type: "land_use_change", description: "Agricultural land showing stress indicators", areaKm2: randBetween(1, 6), confidence: randBetween(0.7, 0.88) },
  ];

  const totalArea = Math.round(changes.reduce((s, c) => s + c.areaKm2, 0) * 10) / 10;

  return {
    kind: "change",
    toolId: "vegetation_analyser",
    queryId: "",
    confidence: randBetween(0.80, 0.93),
    location: intent.location ?? img.location,
    centre: intent.centre,
    changes,
    totalAreaChangedKm2: totalArea,
    beforeDate: "2025-01-01",
    afterDate: "2026-08-12",
    summaryText: `Vegetation loss analysis for ${intent.location ?? img.location}: ` +
      `**${totalArea} km²** of vegetation cover reduced. ` +
      `Primary cause: ${pick(["urban encroachment", "seasonal drought", "land conversion", "coastal erosion"])}. ` +
      `Net change: **-${totalArea} km²** over 19 months.`,
  };
}

// ── Crop Health Mock ───────────────────────────────────────

function runCropHealth(intent: QueryIntent): LandCoverResult {
  const img = nearestImage(intent.centre.lat, intent.centre.lng);
  const totalArea = randBetween(1000, 5000);

  const classes = [
    { name: "Healthy Crop (NDVI > 0.6)", color: "#22c55e", percentage: randBetween(35, 55), areaKm2: 0 },
    { name: "Moderate Health (NDVI 0.3–0.6)", color: "#f59e0b", percentage: randBetween(20, 35), areaKm2: 0 },
    { name: "Stressed Crop (NDVI < 0.3)", color: "#ef4444", percentage: randBetween(5, 15), areaKm2: 0 },
    { name: "Fallow / Bare Soil", color: "#a16207", percentage: randBetween(5, 15), areaKm2: 0 },
    { name: "Non-agricultural", color: "#6b7280", percentage: 0, areaKm2: 0 },
  ];

  // Normalise so total ≈ 100
  const sum = classes.reduce((s, c) => s + c.percentage, 0);
  for (const c of classes) {
    c.percentage = Math.round((c.percentage / sum) * 1000) / 10;
    c.areaKm2 = Math.round((c.percentage / 100) * totalArea);
  }
  // Fix rounding remainder
  const pctSum = classes.reduce((s, c) => s + c.percentage, 0);
  classes[0].percentage = Math.round((classes[0].percentage + (100 - pctSum)) * 10) / 10;

  return {
    kind: "land_cover",
    toolId: "crop_health_analyser",
    queryId: "",
    confidence: randBetween(0.84, 0.93),
    location: intent.location ?? img.location,
    centre: intent.centre,
    classes,
    totalAreaKm2: totalArea,
    summaryText: `Crop health assessment for ${intent.location ?? img.location} over **${totalArea.toLocaleString()} km²**: ` +
      `**${classes[0].percentage}%** healthy (NDVI > 0.6), ` +
      `**${classes[1].percentage}%** moderate, ` +
      `**${classes[2].percentage}%** stressed. ` +
      `Estimated yield impact: ${pick(["minimal", "moderate stress in low-lying areas", "局部 irrigation deficit detected"])}.`,
  };
}

// ── General Question Fallback ──────────────────────────────

function runGeneralQuestion(intent: QueryIntent): DetectionResult {
  return runDetection(intent);
}

// ── Public dispatcher ──────────────────────────────────────

export function runAnalysis(
  intent: QueryIntent,
  toolId: string
): AnalysisOutput {
  const dispatch: Record<string, () => AnalysisOutput> = {
    object_detector:     () => runDetection(intent),
    water_finder:        () => runWaterFinder(intent),
    change_detector:     () => runChangeDetection(intent),
    land_cover_classifier: () => runLandCover(intent),
    area_measurer:       () => runAreaMeasurement(intent),
    distance_measurer:   () => runDistanceMeasurement(intent),
    perimeter_measurer:  () => runPerimeterMeasurement(intent),
    vegetation_analyser: () => runVegetationLoss(intent),
    crop_health_analyser:() => runCropHealth(intent),
    general_question:    () => runGeneralQuestion(intent),
  };

  const runner = dispatch[toolId] ?? dispatch.general_question;
  return runner();
}
