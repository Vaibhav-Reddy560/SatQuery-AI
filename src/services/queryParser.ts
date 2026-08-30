/**
 * Query Parser — converts raw user text into a structured QueryIntent.
 *
 * Uses keyword/pattern matching (no ML). When a real LLM is integrated,
 * replace this module's `parseQuery` with an API call; the downstream
 * pipeline stays identical because it only depends on QueryIntent.
 */

import type { QueryIntent, IntentType } from "@/types/query";

// ── Keyword → Intent mapping (order matters: first match wins) ──

interface IntentRule {
  intent: IntentType;
  /** Regex patterns tested against lowercased input */
  patterns: RegExp[];
}

const RULES: IntentRule[] = [
  {
    intent: "detect_objects",
    patterns: [
      /\b(identify|detect|find|count)\b.*\b(building|structure|house|vehicle|car|solar|panel|tower|road|bridge)\b/i,
      /\b(building|structure|vehicle|solar panel|road)\b.*\b(detect|identify|find|count)\b/i,
      /\bhow many\b.*\b(building|vehicle|structure|house)\b/i,
    ],
  },
  {
    intent: "find_water",
    patterns: [
      /\b(find|locate|identify|detect|show)\b.*\b(water|lake|river|pond|reservoir|ocean|sea|creek|stream)\b/i,
      /\bwater\s+(body|bodies|bod(?:y|ies))\b/i,
      /\b(flood|inundat|submerg)\b/i,
    ],
  },
  {
    intent: "detect_changes",
    patterns: [
      /\b(what|what's|what has|what have)\b.*\b(changed|change|difference|difference|delta)\b/i,
      /\b(change\s+detect|compare|comparison|before.*(after|vs)|after.*before)\b/i,
      /\bsince\b.*\b(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      /\bnew\s+(construction|building|development|urban)\b/i,
      /\burgan\s+(growth|expansion|sprawl)\b/i,
    ],
  },
  {
    intent: "classify_land_cover",
    patterns: [
      /\b(land\s*cover|classify|classification|land\s*use)\b/i,
      /\b(what|which)\b.*\b(land|terrain|ground)\b.*\b(type|cover|use|class)\b/i,
      /\b(vegetation|cropland|forest|urban|barren|shrub)\b.*\b(classify|percentage|proportion|area)\b/i,
    ],
  },
  {
    intent: "detect_vegetation_loss",
    patterns: [
      /\b(deforest|vegetation\s+loss|tree\s+loss|forest\s+loss|green\s+cover\s+loss)\b/i,
      /\b(vegetation|forest|tree|green)\b.*\b(decrease|reduc|declin|loss|lost|remov|clear)\b/i,
    ],
  },
  {
    intent: "detect_deforestation",
    patterns: [
      /\b(deforest)\b/i,
    ],
  },
  {
    intent: "measure_area",
    patterns: [
      /\b(measure|estimate|calculate|compute)\b.*\b(area|size|extent|coverage)\b/i,
      /\bhow\s+(big|large|much)\b.*\b(area|lake|forest|region)\b/i,
      /\b(area|extent)\b.*\b(of|in)\b.*\b(this|that|the)\b/i,
    ],
  },
  {
    intent: "measure_distance",
    patterns: [
      /\b(measure|estimate|calculate)\b.*\b(distance|length|width|span)\b/i,
      /\bhow\s+(far|long|wide)\b/i,
    ],
  },
  {
    intent: "measure_perimeter",
    patterns: [
      /\b(measure|estimate|calculate)\b.*\b(perimeter|boundary|coastline|shoreline|outline)\b/i,
    ],
  },
  {
    intent: "estimate_crop_health",
    patterns: [
      /\b(crop|wheat|rice|paddy|harvest|yield|agriculture|ndvi)\b.*\b(health|condition|status|yield)\b/i,
      /\b(ndvi|vegetation\s+index)\b/i,
      /\b(crop\s+health|field\s+health)\b/i,
    ],
  },
];

// ── Location extraction ────────────────────────────────────

const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  mumbai:       { lat: 19.076,  lng: 72.8777 },
  delhi:        { lat: 28.6139, lng: 77.209 },
  bangalore:    { lat: 12.9716, lng: 77.5946 },
  bengaluru:    { lat: 12.9716, lng: 77.5946 },
  chennai:      { lat: 13.0827, lng: 80.2707 },
  kolkata:      { lat: 22.5726, lng: 88.3639 },
  hyderabad:    { lat: 17.385,  lng: 78.4867 },
  pune:         { lat: 18.5204, lng: 73.8567 },
  ahmedabad:    { lat: 23.0225, lng: 72.5714 },
  jaipur:       { lat: 26.9124, lng: 75.7873 },
  lucknow:      { lat: 26.8467, lng: 80.9462 },
  chandigarh:   { lat: 30.7333, lng: 76.7794 },
  ludhiana:     { lat: 30.901,  lng: 75.8573 },
  kochi:        { lat: 9.9312,  lng: 76.2673 },
  goa:          { lat: 15.2993, lng: 74.124 },
  sundarbans:   { lat: 21.9497, lng: 89.1833 },
  "sundarban":  { lat: 21.9497, lng: 89.1833 },
  kerala:       { lat: 10.8505, lng: 76.2711 },
  punjab:       { lat: 31.1471, lng: 75.3412 },
  rajasthan:    { lat: 27.0238, lng: 74.2179 },
  assam:        { lat: 26.2006, lng: 92.9376 },
  odisha:       { lat: 20.9517, lng: 85.0985 },
  "navi mumbai": { lat: 19.037, lng: 73.0297 },
  indi:         { lat: 20.5937, lng: 78.9629 },
  india:        { lat: 20.5937, lng: 78.9629 },
};

function extractLocation(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const name of Object.keys(KNOWN_LOCATIONS)) {
    if (lower.includes(name)) {
      // Capitalize first letter of each word
      return name.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return undefined;
}

function getLocationCoords(location?: string): { lat: number; lng: number } | undefined {
  if (!location) return undefined;
  return KNOWN_LOCATIONS[location.toLowerCase()];
}

// ── Public API ─────────────────────────────────────────────

export function parseQuery(raw: string): QueryIntent {
  const lower = raw.toLowerCase();

  // Find first matching intent
  let matchedIntent: IntentType = "general_question";
  let matchedConfidence = 0.4;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(lower)) {
        matchedIntent = rule.intent;
        matchedConfidence = 0.75 + Math.random() * 0.2; // 0.75–0.95
        break;
      }
    }
    if (matchedIntent !== "general_question") break;
  }

  const location = extractLocation(raw);
  const centre = getLocationCoords(location);

  return {
    type: matchedIntent,
    location,
    centre: centre ?? { lat: 20.5937, lng: 78.9629 }, // default: India
    confidence: Math.round(matchedConfidence * 100) / 100,
  };
}

// ── Utility: get a human-readable intent label ────────────

export function intentLabel(intent: IntentType): string {
  const LABELS: Record<IntentType, string> = {
    detect_objects:          "Object Detection",
    find_water:              "Water Body Detection",
    detect_changes:          "Change Detection",
    classify_land_cover:     "Land Cover Classification",
    measure_area:            "Area Measurement",
    measure_distance:        "Distance Measurement",
    measure_perimeter:       "Perimeter Measurement",
    detect_vegetation_loss:  "Vegetation Loss Detection",
    detect_deforestation:    "Deforestation Detection",
    estimate_crop_health:    "Crop Health Estimation",
    general_question:        "General Analysis",
  };
  return LABELS[intent];
}
