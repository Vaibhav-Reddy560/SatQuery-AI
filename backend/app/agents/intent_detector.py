"""
Intent detection (Phase 1: deterministic rule-based classifier).

Returns a typed ``IntentResult``: intent (canonical ``IntentType``),
confidence (0..1), extracted ``entities`` and a ``reasoning`` string.

The classifier is intentionally modular: it implements the
``IntentClassifier`` protocol, so a later phase can add an LLM/VLM
implementation behind the same interface. No randomness is used -- the same
query always yields the same result.
"""

import re
from typing import Dict, List, Optional, Tuple

from backend.app.agents.base import IntentClassifier  # noqa: F401  (re-export)
from backend.app.schemas.ai import IntentResult, IntentType

# Sentinel location names that mean "no explicit location was given".
_LOCATION_SENTINELS = {"", "selected region", "selected aoi", "target area", "selected area of interest"}

# ── Detection targets (plural-friendly keywords -> canonical category) ────

_TARGET_KEYWORDS: List[Tuple[str, str]] = [
    ("buildings", "building"), ("building", "building"), ("houses", "building"),
    ("house", "building"), ("structures", "building"), ("structure", "building"),
    ("vehicles", "vehicle"), ("vehicle", "vehicle"), ("cars", "vehicle"),
    ("car", "vehicle"), ("trucks", "vehicle"), ("truck", "vehicle"),
    ("ships", "ship"), ("ship", "ship"), ("vessels", "ship"), ("vessel", "ship"),
    ("boats", "ship"), ("boat", "ship"),
    ("aircraft", "aircraft"), ("airplanes", "aircraft"), ("airplane", "aircraft"),
    ("planes", "aircraft"), ("plane", "aircraft"),
    ("solar panels", "solar_panel"), ("solar panel", "solar_panel"),
    ("solar farms", "solar_panel"), ("solar farm", "solar_panel"),
    ("roads", "road"), ("road", "road"), ("bridges", "bridge"), ("bridge", "bridge"),
    ("towers", "tower"), ("tower", "tower"), ("cranes", "crane"), ("crane", "crane"),
    ("runways", "runway"), ("runway", "runway"),
]

_WATER_WORDS = [
    "water bodies", "water body", "waterbody", "waterbodies",
    "lake", "lakes", "river", "rivers", "pond", "ponds",
    "reservoir", "reservoirs", "canal", "canals", "wetland", "wetlands",
    "estuary", "estuaries",
]
_WATER_TYPE_KEYWORDS = [
    ("lake", "lake"), ("lakes", "lake"), ("river", "river"), ("rivers", "river"),
    ("pond", "pond"), ("ponds", "pond"), ("reservoir", "reservoir"),
    ("reservoirs", "reservoir"), ("canal", "canal"), ("canals", "canal"),
    ("wetland", "wetland"), ("wetlands", "wetland"),
]

_PERIMETER_WORDS = re.compile(
    r"\b(perimeter|circumference|boundary|outline|shoreline|coastline)\b", re.IGNORECASE
)
_LOCATION_RE = re.compile(
    r"\b(?:in|at|near|over|around|for|of)\s+([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+)*)"
)
_YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")


class _Rule:
    def __init__(self, intent: IntentType, name: str, confidence: float, patterns: List[str]):
        self.intent = intent
        self.name = name
        self.confidence = confidence
        self.patterns = [re.compile(p, re.IGNORECASE) for p in patterns]


# Order matters: earlier rules win when several could match.
_RULES: List[_Rule] = [
    _Rule(
        IntentType.change_detection, "change_detection", 0.92,
        [
            r"\b(what|what's|what has|what have|how has|how have)\b[^.!?]*\b(changed|change|changes)\b",
            r"\b(change\s*detection|bi[- ]?temporal|compare|comparison)\b",
            r"\bbetween\s+(?:19|20)\d{2}\s+and\s+(?:19|20)\d{2}\b",
            r"\b(new\s+construction|urban\s+(?:growth|expansion|sprawl))\b",
        ],
    ),
    _Rule(
        IntentType.find_water, "find_water", 0.93,
        [
            r"\b(find|detect|locate|identify|map|show|count|track)\b.*\b(water\s*bodies?|waterbody|waterbodies|lake|lakes|river|rivers|pond|ponds|reservoir|reservoirs|canal|canals|wetland|wetlands)\b",
            r"\b(flood|inundat|submerg)\b",
            r"\bwater\s*bod(?:y|ies)\b",
        ],
    ),
    _Rule(
        IntentType.detect_objects, "detect_objects", 0.94,
        [
            r"\b(detect|identify|find|count|locate|spot|search\s+for|look\s+for)\b.*\b(buildings?|houses?|structures?|vehicles?|cars?|trucks?|ships?|vessels?|boats?|aircraft|airplanes?|planes?|solar\s+panels?|solar\s+farms?|roads?|bridges?|towers?|cranes?|runways?)\b",
            r"\bhow\s+many\b.*\b(buildings?|houses?|structures?|vehicles?|cars?|ships?|vessels?|aircraft|planes?)\b",
            r"\b(number|count|total)\s+of\b.*\b(buildings?|ships?|vehicles?|planes?|houses?)\b",
        ],
    ),
    _Rule(
        IntentType.land_cover, "land_cover", 0.93,
        [
            r"\b(land\s*cover|land\s*use|landcover|land\s*classification)\b",
            r"\b(classify|classification)\b",
            r"\b(what|which)\b.*\b(land|terrain|ground|surface)\b.*\b(type|class|cover|use)\b",
        ],
    ),
    _Rule(
        IntentType.vegetation_analysis, "vegetation_analysis", 0.9,
        [
            r"\b(vegetation|forest|tree\s*cover|green\s*cover|canopy|crops?|agriculture|ndvi)\b.*\b(loss|lost|health|healthy|stress|stressed|declin|degrad|clear(?:ing)?|reduc|remov|deforest)\b",
            r"\b(loss|lost|health|healthy|deforest|degradation|stress)\b.*\b(vegetation|forest|trees?|green\s*cover|canopy|crops?)\b",
            r"\b(deforest|vegetation\s*loss|tree\s*loss|forest\s*loss)\b",
            r"\b(ndvi|vegetation\s*index)\b",
            r"\b(analy[sz]e|assess|map|monitor|check|survey)\b.*\b(vegetation|forest|trees?|green\s*cover|crops?|canopy)\b",
            r"\b(low|no|less|sparse|poor|reduced|minimal|unhealthy|healthy|dense|vigorous|stressed)\s+(vegetation|tree\s*cover|forest|green\s*cover|canopy|crops?|greenery)\b",
        ],
    ),
    _Rule(
        IntentType.measure_area, "measure_area", 0.95,
        [
            r"\b(measure|estimate|calculate|compute)\b.*\b(area|extent|coverage|size|footprint)\b",
            r"\bhow\s+(big|large)\b",
            r"\b(area|extent|coverage)\s+of\b",
        ],
    ),
    _Rule(
        IntentType.measure_distance, "measure_distance", 0.95,
        [
            r"\b(measure|estimate|calculate|compute)\b.*\b(distance|length|width|span|perimeter|circumference|coastline|shoreline|boundary)\b",
            r"\bhow\s+(far|long|wide)\b",
        ],
    ),
    _Rule(
        IntentType.general_satellite_question, "general_satellite_question", 0.62,
        [
            r"\b(analy|analyse|describe|overview|summari)\w*\b.*\b(satellite|imagery|region|area|scene|image|earth)\b",
            r"\b(what\s+can\s+you\s+tell|what\s+do\s+you\s+see|what\s+is\s+this)\b.*\b(region|area|scene|image)\b",
            r"\bsatellite\b|\bremote\s+sensing\b",
        ],
    ),
]


class DeterministicIntentClassifier:
    """Rule-based intent classification. Deterministic; no ML dependencies."""

    def classify(self, raw_query: str) -> IntentResult:
        text = raw_query.strip()
        entities: Dict[str, object] = {}

        for rule in _RULES:
            for pattern in rule.patterns:
                if pattern.search(text):
                    self._extract_entities(text, rule.intent, entities)
                    return IntentResult(
                        intent=rule.intent,
                        confidence=rule.confidence,
                        entities=entities,
                        reasoning=(
                            f"Matched rule '{rule.name}' (pattern '{pattern.pattern}'). "
                            f"Extracted entities: {sorted(entities)}."
                        ),
                    )

        # No rule matched -> unknown (not a satellite-analysis request).
        return IntentResult(
            intent=IntentType.unknown,
            confidence=0.4,
            entities=entities,
            reasoning="No known intent pattern matched the query.",
        )

    # ── Entity extraction ────────────────────────────────────────────────

    def _extract_entities(self, text: str, intent: IntentType, entities: Dict[str, object]) -> None:
        # Location: capitalized name(s) after a preposition.
        loc_match = _LOCATION_RE.search(text)
        if loc_match:
            name = loc_match.group(1).strip()
            if name.lower() not in _LOCATION_SENTINELS:
                entities["location"] = name

        # Years (used by change detection / vegetation loss).
        years = [y for y in _YEAR_RE.findall(text)]
        if len(years) >= 2:
            entities["from_year"] = min(years)
            entities["to_year"] = max(years)
        elif len(years) == 1 and intent == IntentType.change_detection:
            entities["from_year"] = years[0]

        # Detection targets (kept in the order they appear in the query).
        if intent == IntentType.detect_objects:
            matched: List[Tuple[int, str]] = []
            for keyword, canonical in _TARGET_KEYWORDS:
                m = re.search(rf"\b{re.escape(keyword)}\b", text, re.IGNORECASE)
                if m:
                    matched.append((m.start(), canonical))
            if matched:
                entities["targets"] = list(dict.fromkeys(c for _, c in sorted(matched)))

        # Water kind.
        if intent == IntentType.find_water:
            for keyword, canonical in _WATER_TYPE_KEYWORDS:
                if re.search(rf"\b{re.escape(keyword)}\b", text, re.IGNORECASE):
                    entities["water_type"] = canonical
                    break
            else:
                entities["water_type"] = "water"
            if re.search(r"\b(flood|inundat|submerg)\b", text, re.IGNORECASE):
                entities["water_type"] = "flood"

        # Measurement subtype (perimeter -> distance-family measurement).
        if intent == IntentType.measure_distance and _PERIMETER_WORDS.search(text):
            entities["measurement_subtype"] = "perimeter"
        elif intent == IntentType.measure_area:
            entities["measurement_subtype"] = "area"


# Canonical singleton used by the rest of the app.
intent_detector = DeterministicIntentClassifier()
