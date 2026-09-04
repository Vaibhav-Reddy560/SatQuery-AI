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


def _education_patterns() -> List[str]:
    """
    Patterns for conceptual/definition questions ("What is NDVI?", "Explain
    what Sentinel-2 is."). These MUST NOT capture analysis asks ("What is the
    NDVI of this scene?"), which keep routing to their analysis tools, nor
    "describe this image" asks, which are visual intents.
    """
    concepts = [
        "ndvi", "ndwi", "sentinel[- ]?2", "landsat", "remote\\s+sensing",
        "sar", "satellite\\s+imagery", "spectral\\s+index(?:es)?",
        "land\\s*cover", "gis",
    ]
    patterns: List[str] = []
    # 1) Sentence-final "what is X?" / "what are X?" (optionally with an
    #    article). Analysis asks have a tail ("...of this scene?"), so the
    #    end anchor keeps them out.
    for c in concepts:
        patterns.append(
            r"\b(?:what|what'?s)\s+(?:is|are)\s+(?:an?\s+|the\s+)?" + c + r"\s*[?.!]?$"
        )
    # 2) "what does X mean/stand for", "X is used for"
    for c in concepts:
        patterns.append(r"\bwhat\s+does\s+" + c + r"\s+(?:mean|stand\s+for)\b")
        patterns.append(r"\bwhat\s+is\s+(?:an?\s+|the\s+)+" + c + r"\s+used\s+for\b")
        patterns.append(r"\b" + c + r"\s+(?:means?|stands\s+for)\b")
    # 3) "define / explain / explain what ... is" — but never when the query
    #    asks about a concrete image/scene in view (visual intent) or asks
    #    "what is visible".
    not_visual = (
        r"(?s)^(?!.*\bvisible\b)"
        r"(?!.*\b(?:this|the|that)\s+(?:satellite\s+)?"
        r"(?:image|scene|imagery|picture|photo|region|area)\b).*"
    )
    for c in concepts:
        patterns.append(
            not_visual + r"\b(?:define|explain)\b[^.!?]{0,80}\b" + c + r"\b"
        )
    return patterns


# Order matters: earlier rules win when several could match.
_RULES: List[_Rule] = [
    _Rule(
        IntentType.general_satellite_question, "education_concepts", 0.88,
        _education_patterns(),
    ),
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
            r"\b(find|detect|locate|identify|map|show|count|track|search)\b.*\b(water\s*bodies?|waterbody|waterbodies|lake|lakes|river|rivers|pond|ponds|reservoir|reservoirs|canal|canals|wetland|wetlands)\b",
            r"\b(flood|inundat|submerg)\b",
            r"\bwater\s*bod(?:y|ies)\b",
            # Bare "water" after an action word ("find water around Delhi")
            # or a place-scoped "water ..." form is a water-detection ask.
            r"\b(find|detect|locate|identify|map|show|count|track|search)\b[^.!?]{0,40}\bwater\b",
            r"\b(how\s+much|how\s+many)\s+water\b",
            r"\bwater\s+(?:around|near|in|at|over|across|within)\b",
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
        IntentType.visual_interpretation, "visual_interpretation", 0.9,
        [
            r"\b(what\s+do\s+(?:you|i|we)\s+see|what\s+(?:can|does)\s+you\s+see|describe|describe\s+what)\b.*\b(image|imagery|scene|satellite|aerial|photo|picture|region|area)\b",
            r"\b(image|scene|satellite\s*imagery)\b.*\b(show|depict|contain|appear|look)\b",
            r"\bdoes\s+the\s+image\b.*\b(contain|show|appear|look)\b",
            r"\b(describe|tell\s+me\s+about)\b.*\b(landscape|terrain|land\s*cover|appearance)\b",
            r"\b(what|how)\b.*\b(look|appear|see)\b.*\b(from\s+above|in\s+this|visible)\b",
            r"\b(describe|interpret|analyse|analyze)\b.*\b(what\s+is\s+visible|the\s+scene|this\s+image)\b",
            # Narrow "what is visible in the image?" family: requires BOTH the
            # "what('s) is visible" opener (expanded form "what is visible" or
            # contracted "what's/whats visible") AND an imagery noun, so
            # ordinary questions containing "visible" or "image" alone are
            # not routed to the VLM.
            r"\b(?:what\s+is|what'?s)\s+visible\b.*\b(image|imagery|scene|satellite|aerial|photo|picture)\b",
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
