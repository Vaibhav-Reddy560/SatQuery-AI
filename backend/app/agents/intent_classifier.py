"""
Intent Classifier — Agent / Query Intelligence module.

Takes a raw user text query and figures out:
  1. Which tool(s) it needs (detection, land_cover, change_detection, measurement)
  2. What location it's talking about
  3. How confident we are in that guess

This is deliberately kept separate from vlm_engine.py so the "thinking"
step (query -> intent) is owned by this module, and the "doing" step
(intent -> fake/real results) stays owned by the VLM engine / GIS processor.
"""

import re
from typing import Dict, Any, List


# Each tool has a set of trigger patterns. Order matters only as a tiebreaker
# when multiple tools match with equal keyword weight.
TOOL_PATTERNS = {
    "land_cover": [
        r"\b(land cover|land use|classification|corine|bigearthnet)\b",
    ],
    "change_detection": [
        r"\b(change|compare|difference|before|after|temporal|over time)\b",
    ],
    "measurement": [
        r"\b(measure|distance|perimeter|length|how (big|far|large))\b",
        r"\b(area|size|km2|square km)\b",
    ],
        "detection": [
        r"\b(ships?|vessels?|boats?|ports?|harbors?|docks?)\b",
        r"\b(solar|panels?|photovoltaic|renewable|wind turbines?)\b",
        r"\b(airplanes?|aircraft|runways?|airports?|tarmac)\b",
        r"\b(buildings?|houses?|structures?|roofs?|urban|construction)\b",
        r"\b(water|rivers?|lakes?|reservoirs?|flood|ponds?|dams?)\b",
        r"\b(forests?|trees?|deforestation|tree loss|canopy|woodlands?)\b",
        r"\b(crops?|farms?|agriculture|fields?|ndvi|crop health|harvest)\b",
    ],
}

# Sub-type labels used only for "detection" queries, so downstream code
# knows *what kind* of object to look for.
DETECTION_SUBTYPES = [
    (r"\b(ships?|vessels?|boats?|ports?|harbors?|docks?)\b", "ship_detection", "Ships & Maritime Features"),
    (r"\b(solar|panels?|photovoltaic|renewable|wind turbines?)\b", "solar_panel_detection", "Renewable Energy Assets"),
    (r"\b(airplanes?|aircraft|runways?|airports?|tarmac)\b", "airport_detection", "Airport Infrastructure"),
    (r"\b(buildings?|houses?|structures?|roofs?|urban|construction)\b", "building_detection", "Urban Structures"),
    (r"\b(water|rivers?|lakes?|reservoirs?|flood|ponds?|dams?)\b", "water_detection", "Water Bodies & Reservoirs"),
    (r"\b(forests?|trees?|deforestation|tree loss|canopy|woodlands?)\b", "deforestation_detection", "Forest & Vegetation Cover"),
    (r"\b(crops?|farms?|agriculture|fields?|ndvi|crop health|harvest)\b", "crop_health", "Agricultural Crops"),
]

LOCATION_PATTERN = re.compile(
    r"\b(?:in|at|near|over|around|for)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)"
)


def extract_location(text: str) -> str:
    """Pull a place name out of the query, or fall back to a generic label."""
    match = LOCATION_PATTERN.search(text)
    if match:
        return match.group(1)
    return "Selected Area of Interest"


def detect_tools(text: str) -> List[str]:
    """
    Return every tool whose patterns match the query, in a fixed priority order.
    Supports multi-intent queries, e.g. "show buildings and classify land cover"
    will return ["land_cover", "detection"].
    """
    text_lower = text.lower()
    matched_tools = []

    # Fixed priority order: land_cover and change_detection are checked first
    # because their keywords are more specific than generic detection nouns.
    priority_order = ["land_cover", "change_detection", "measurement", "detection"]

    for tool in priority_order:
        patterns = TOOL_PATTERNS[tool]
        if any(re.search(p, text_lower) for p in patterns):
            matched_tools.append(tool)

    if not matched_tools:
        matched_tools = ["detection"]  # safe default, matches old "general_analysis" fallback

    return matched_tools


def detect_subtype(text: str) -> Dict[str, str]:
    """For detection queries, figure out *which* object class is being asked about."""
    text_lower = text.lower()
    for pattern, subtype, label in DETECTION_SUBTYPES:
        if re.search(pattern, text_lower):
            return {"subtype": subtype, "target_name": label}
    return {"subtype": "general_analysis", "target_name": "Remote Sensing Features"}


def score_confidence(text: str, matched_tools: List[str]) -> float:
    """
    Rough confidence heuristic: more keyword hits and a detected location
    both push confidence up. This replaces the old random.uniform() placeholder
    with something that at least responds to the actual query content.
    """
    text_lower = text.lower()
    hits = 0
    for tool in matched_tools:
        for pattern in TOOL_PATTERNS[tool]:
            hits += len(re.findall(pattern, text_lower))

    base = 0.6
    hit_bonus = min(hits * 0.1, 0.3)
    location_bonus = 0.05 if extract_location(text) != "Selected Area of Interest" else 0.0

    return round(min(base + hit_bonus + location_bonus, 0.99), 2)


def classify(text: str) -> Dict[str, Any]:
    """
    Main entry point. Given a raw query, returns a structured intent object:

    {
        "tools": ["land_cover", "detection"],
        "primary_tool": "land_cover",
        "subtype": "building_detection",       # only meaningful if "detection" is in tools
        "target_name": "Urban Structures",
        "location": "Bengaluru",
        "confidence": 0.85
    }
    """
    tools = detect_tools(text)
    subtype_info = detect_subtype(text) if "detection" in tools else {
        "subtype": None, "target_name": None
    }
    location = extract_location(text)
    confidence = score_confidence(text, tools)

    return {
        "tools": tools,
        "primary_tool": tools[0],
        "subtype": subtype_info["subtype"],
        "target_name": subtype_info["target_name"],
        "location": location,
        "confidence": confidence,
    }


if __name__ == "__main__":
    # Quick manual test — run this file directly to sanity-check the classifier.
    test_queries = [
        "Show me buildings in Bengaluru",
        "Compare forest cover before and after 2023 near Shimla",
        "What is the land use classification for this area?",
        "How large is this region in square km?",
        "Detect ships and classify land cover near Mumbai port",
    ]
    for q in test_queries:
        print(q)
        print(classify(q))
        print()