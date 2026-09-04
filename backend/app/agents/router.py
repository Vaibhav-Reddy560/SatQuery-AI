"""
Query Router — the "tool selection + execution" half of
query -> intent -> tool -> result.

This module is the single entry point the rest of the backend should call.
It takes a raw user query, classifies it, decides which underlying
engine/tool should handle it, calls that tool, and returns one
consistent response shape regardless of which path was taken.
"""

from typing import Dict, Any, List

from backend.app.agents.intent_classifier import classify
from backend.app.agents.llm_fallback import classify_with_llm
from backend.app.ml.vlm_engine import vlm_engine
from backend.app.services.gis_processor import (
    calculate_polygon_area_km2,
    calculate_polyline_distance_km,
)

# Below this confidence, the cheap regex classifier is considered "unsure"
# and we escalate to the LLM for a real semantic read of the query.
CONFIDENCE_ESCALATION_THRESHOLD = 0.75


def _handle_measurement(intent: Dict[str, Any], points: List[List[float]] = None) -> Dict[str, Any]:
    """
    Pure-math path for measurement queries. If the user has actually drawn
    a shape on the map (points provided), compute a REAL area/distance
    instead of delegating to the VLM's fake random number.

    Falls back to the VLM's mocked measurement response if no geometry
    was provided yet (e.g. user asked "how big is this area" before drawing).
    """
    if not points or len(points) < 2:
        return vlm_engine.infer(query=intent["location"], centre=None, location_name=intent["location"])

    if len(points) >= 3:
        value = calculate_polygon_area_km2(points)
        unit = "km2"
        measurement_type = "area"
    else:
        value = calculate_polyline_distance_km(points)
        unit = "km"
        measurement_type = "distance"

    return {
        "intent": {
            "type": "measurement",
            "location": intent["location"],
            "confidence": intent["confidence"],
            "detected_target": "Geospatial Measurement",
        },
        "text_response": (
            f"**Geospatial Measurement for {intent['location']}:**\n\n"
            f"• Measurement type: {measurement_type}\n"
            f"• Value: **{value} {unit}**\n"
            f"• Calculated from {len(points)} drawn coordinate points using geodesic math "
            f"(not simulated — this is a real calculation)."
        ),
        "attachments": [
            {"type": "data", "label": "Geodesic Measurement Result", "confidence": 1.0}
        ],
        "suggested_actions": ["Save Measurement to Project", "Run Land Cover over AOI", "Clear selection"],
        "confidence": 1.0,
        "analysis_kind": "measurement",
        "analysis_payload": {
            "kind": "measurement",
            "measurement_type": measurement_type,
            "location": intent["location"],
            "value": value,
            "unit": unit,
            "points": points,
        },
        "latency_ms": 0.0,
    }


def route_query(
    query: str,
    centre: List[float] = None,
    location_name: str = None,
    drawn_points: List[List[float]] = None,
) -> Dict[str, Any]:
    """
    Main entry point for the whole "query -> intent -> tool -> result" pipeline.
    """
    intent = classify(query)

    if intent["confidence"] < CONFIDENCE_ESCALATION_THRESHOLD:
        try:
            llm_intent = classify_with_llm(query)
            intent = {
                "tools": llm_intent["tools"],
                "primary_tool": llm_intent["primary_tool"],
                "subtype": intent.get("subtype"),
                "target_name": intent.get("target_name"),
                "location": llm_intent["location"],
                "confidence": llm_intent["confidence"],
                "source": "llm_escalation",
            }
        except Exception as e:
            intent["source"] = f"regex_fallback (llm_error: {e})"

    tool = intent["primary_tool"]

    if tool == "measurement":
        result = _handle_measurement(intent, drawn_points)
    else:
        result = vlm_engine.infer(
            query=query,
            centre=centre,
            location_name=location_name or intent["location"],
        )

    result["router_intent"] = intent
    return result


if __name__ == "__main__":
    print(route_query("Show me buildings in Bengaluru"))
    print()
    print(route_query(
        "How big is this area?",
        drawn_points=[[77.59, 12.97], [77.60, 12.97], [77.60, 12.98], [77.59, 12.98]],
    ))