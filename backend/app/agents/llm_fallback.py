"""
LLM Fallback — semantic intent classification for queries the deterministic
regex classifier (intent_detector.py) can't confidently handle.

Returns a real IntentResult, matching the exact schema the orchestrator
already expects, so it can be dropped straight in as a replacement for a
low-confidence/unknown regex result with no other code changes required.
"""

import os
import json
from typing import Optional

from dotenv import load_dotenv
from groq import Groq

from backend.app.schemas.ai import IntentResult, IntentType

load_dotenv()

_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY not found in environment. Add it to your .env file."
            )
        _client = Groq(api_key=api_key)
    return _client


# Every valid IntentType value, straight from the enum, so the prompt and
# the parser can never drift out of sync with the schema.
_VALID_INTENTS = {member.value for member in IntentType}

SYSTEM_PROMPT = """You are an intent classifier for a satellite remote-sensing assistant.
Given a user's natural language query, classify it into EXACTLY ONE of these intents:

- detect_objects: finding specific objects (buildings, ships, vehicles, aircraft, solar panels, roads, bridges)
- find_water: locating water bodies (lakes, rivers, ponds, reservoirs, flooding)
- land_cover: land cover / land use classification
- change_detection: comparing two time periods, before/after, what changed
- vegetation_analysis: forest/crop/vegetation health, loss, deforestation, NDVI
- measure_area: calculating area, extent, size, coverage
- measure_distance: calculating distance, length, perimeter, coastline
- visual_interpretation: asking what's visible in the actual image/scene
- general_satellite_question: general questions about satellites/imagery, not a specific analysis task
- unknown: doesn't fit any of the above

Also extract any of these entities that are clearly present in the query:
- location: a place name (or null)
- from_year / to_year: years mentioned (4-digit, e.g. 2023). If only one year appears, put it in from_year and leave to_year null. If two, from_year is the earlier one.
- targets: for detect_objects only — a list of object types being asked about, using these canonical names only: building, vehicle, ship, aircraft, solar_panel, road, bridge, tower, crane, runway
- water_type: for find_water only — one of: lake, river, pond, reservoir, canal, wetland, flood, water (generic)
- measurement_subtype: for measure_distance only — "perimeter" if the query asks about perimeter/boundary/coastline/shoreline, else null

Respond with ONLY valid JSON, no other text, in this exact shape:
{
  "intent": "one_of_the_values_above",
  "location": "place name or null",
  "from_year": "year or null",
  "to_year": "year or null",
  "targets": ["target1", "target2"] or [],
  "water_type": "water type or null",
  "measurement_subtype": "perimeter or null",
  "confidence": 0.0 to 1.0,
  "reasoning": "one short sentence explaining your choice"
}

Always make your best guess — only use "unknown" if truly nothing fits.
Only fill in entity fields that are actually relevant to the chosen intent; leave others null/empty.
"""


def classify_with_llm(text: str) -> IntentResult:
    """
    Sends the query to Groq's LLM and returns a real IntentResult.
    Raises on API failure or malformed response — callers should catch
    and keep the regex classifier's original result if this fails.
    """
    client = _get_client()

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.1,
        max_tokens=600,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    parsed = json.loads(raw)

    intent_str = parsed.get("intent", "unknown")
    if intent_str not in _VALID_INTENTS:
        intent_str = "unknown"

    entities = {}
    location = parsed.get("location")
    if location:
        entities["location"] = location

    from_year = parsed.get("from_year")
    to_year = parsed.get("to_year")
    if from_year:
        entities["from_year"] = str(from_year)
    if to_year:
        entities["to_year"] = str(to_year)
 
    targets = parsed.get("targets") or []
    if targets and intent_str == "detect_objects":
        entities["targets"] = targets
 
    water_type = parsed.get("water_type")
    if water_type and intent_str == "find_water":
        entities["water_type"] = water_type
 
    measurement_subtype = parsed.get("measurement_subtype")
    if measurement_subtype and intent_str == "measure_distance":
        entities["measurement_subtype"] = measurement_subtype
    elif intent_str == "measure_area":
        entities["measurement_subtype"] = "area"

    return IntentResult(
        intent=IntentType(intent_str),
        confidence=float(parsed.get("confidence", 0.6)),
        entities=entities,
        reasoning=f"[LLM fallback] {parsed.get('reasoning', '')}",
    )


if __name__ == "__main__":
    test_queries = [
        "Is there any greenery being cut down near the hills?",
        "Tell me what's happening around the coast lately",
    ]
    for q in test_queries:
        print(q)
        try:
            print(classify_with_llm(q))
        except Exception as e:
            print(f"Error: {e}")
        print()