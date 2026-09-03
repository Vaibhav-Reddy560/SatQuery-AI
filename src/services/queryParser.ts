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
      /\b(crop|wheat|rice|paddy|harvest|yield|agriculture|ndvi|wdvi)\b.*\b(health|condition|status|yield)\b/i,
      /\b(ndvi|wdvi|vegetation\s+index)\b/i,
      /\b(crop\s+health|field\s+health)\b/i,
    ],
  },
];

// ── Location extraction ────────────────────────────────────

const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // ── Maharashtra ─────────────────────────────────────────────
  mumbai:             { lat: 19.076,  lng: 72.8777 },
  "navi mumbai":      { lat: 19.037,  lng: 73.0297 },
  pune:               { lat: 18.5204, lng: 73.8567 },
  nagpur:             { lat: 21.1458, lng: 79.0882 },
  nashik:             { lat: 19.9975, lng: 73.7898 },
  aurangabad:         { lat: 19.8762, lng: 75.3433 },
  thane:              { lat: 19.2183, lng: 72.9781 },
  maharashtra:        { lat: 19.7515, lng: 75.7139 },

  // ── Rajasthan ────────────────────────────────────────────────
  jaipur:             { lat: 26.9124, lng: 75.7873 },
  jodhpur:            { lat: 26.2389, lng: 73.0243 },
  udaipur:            { lat: 24.5854, lng: 73.7125 },
  kota:               { lat: 25.2138, lng: 75.8648 },
  bikaner:            { lat: 28.0229, lng: 73.3119 },
  ajmer:              { lat: 26.4499, lng: 74.6399 },
  "thar desert":      { lat: 27.0238, lng: 70.9000 },
  rajasthan:          { lat: 27.0238, lng: 74.2179 },

  // ── Karnataka ────────────────────────────────────────────────
  bengaluru:          { lat: 12.9716, lng: 77.5946 },
  bangalore:          { lat: 12.9716, lng: 77.5946 },
  mysuru:             { lat: 12.2958, lng: 76.6394 },
  mysore:             { lat: 12.2958, lng: 76.6394 },
  hubli:              { lat: 15.3647, lng: 75.1240 },
  mangaluru:          { lat: 12.9141, lng: 74.8560 },
  belagavi:           { lat: 15.8497, lng: 74.4977 },
  "western ghats":    { lat: 13.5000, lng: 75.5000 },
  karnataka:          { lat: 15.3173, lng: 75.7139 },

  // ── Kerala ──────────────────────────────────────────────────
  thiruvananthapuram: { lat: 8.5241,  lng: 76.9366 },
  trivandrum:         { lat: 8.5241,  lng: 76.9366 },
  kochi:              { lat: 9.9312,  lng: 76.2673 },
  kozhikode:          { lat: 11.2588, lng: 75.7804 },
  calicut:            { lat: 11.2588, lng: 75.7804 },
  thrissur:           { lat: 10.5276, lng: 76.2144 },
  alleppey:           { lat: 9.4981,  lng: 76.3388 },
  alappuzha:          { lat: 9.4981,  lng: 76.3388 },
  "wayanad":          { lat: 11.6030, lng: 76.0834 },
  kerala:             { lat: 10.8505, lng: 76.2711 },

  // ── Punjab ──────────────────────────────────────────────────
  ludhiana:           { lat: 30.901,  lng: 75.8573 },
  amritsar:           { lat: 31.6340, lng: 74.8723 },
  jalandhar:          { lat: 31.3260, lng: 75.5762 },
  patiala:            { lat: 30.3398, lng: 76.3869 },
  chandigarh:         { lat: 30.7333, lng: 76.7794 },
  "wheat belt":       { lat: 30.9010, lng: 75.8573 },
  punjab:             { lat: 31.1471, lng: 75.3412 },

  // ── West Bengal ─────────────────────────────────────────────
  kolkata:            { lat: 22.5726, lng: 88.3639 },
  calcutta:           { lat: 22.5726, lng: 88.3639 },
  sundarbans:         { lat: 21.9497, lng: 89.1833 },
  "sundarban":        { lat: 21.9497, lng: 89.1833 },
  siliguri:           { lat: 26.7271, lng: 88.3953 },
  howrah:             { lat: 22.5958, lng: 88.2636 },
  darjeeling:         { lat: 27.0410, lng: 88.2663 },
  "west bengal":      { lat: 22.9868, lng: 87.8550 },

  // ── Other major cities (pre-existing) ────────────────────────
  delhi:              { lat: 28.6139, lng: 77.2090 },
  hyderabad:          { lat: 17.385,  lng: 78.4867 },
  ahmedabad:          { lat: 23.0225, lng: 72.5714 },
  lucknow:            { lat: 26.8467, lng: 80.9462 },
  goa:                { lat: 15.2993, lng: 74.1240 },
  assam:              { lat: 26.2006, lng: 92.9376 },
  odisha:             { lat: 20.9517, lng: 85.0985 },
  chennai:            { lat: 13.0827, lng: 80.2707 },

  // ── Generic India fallback ───────────────────────────────────
  indi:               { lat: 20.5937, lng: 78.9629 },
  india:              { lat: 20.5937, lng: 78.9629 },
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
