"""
Tool selection: canonical intent -> analysis tool (+ parameters).

Phase 1 mapping (tool ids match the analysis service registry):

    detect_objects         -> object_detector
    find_water             -> water_detector
    land_cover             -> land_cover_classifier
    change_detection       -> change_detector
    vegetation_analysis    -> vegetation_analyzer
    visual_interpretation  -> visual_analyzer (real vision-language model)
    measure_area           -> geospatial_measurement (parameters: area)
    measure_distance       -> geospatial_measurement (parameters: distance/perimeter)

The selector never hardcodes one tool for every request; intents without a
dedicated tool (general questions, unknown) yield ``None`` so the
orchestrator answers without running an analysis.
"""

from typing import Dict, List, Optional

from backend.app.agents.base import IntentClassifier  # noqa: F401  (interface import)
from backend.app.schemas.ai import IntentResult, IntentType, ToolSelection

# Single source of truth for the canonical mapping.
_INTENT_TO_TOOL: Dict[IntentType, str] = {
    IntentType.detect_objects: "object_detector",
    IntentType.find_water: "water_detector",
    IntentType.land_cover: "land_cover_classifier",
    IntentType.change_detection: "change_detector",
    IntentType.vegetation_analysis: "vegetation_analyzer",
    IntentType.visual_interpretation: "visual_analyzer",
    IntentType.measure_area: "geospatial_measurement",
    IntentType.measure_distance: "geospatial_measurement",
}

_NON_ANALYSIS_INTENTS = (
    IntentType.general_satellite_question,
    IntentType.unknown,
)


class ToolSelector:
    """Maps a detected intent to an analysis tool with parameters."""

    def select(self, intent_result: IntentResult) -> Optional[ToolSelection]:
        intent = intent_result.intent
        if intent in _NON_ANALYSIS_INTENTS or intent not in _INTENT_TO_TOOL:
            return None

        tool_id = _INTENT_TO_TOOL[intent]
        parameters: Dict[str, object] = {}
        entities = intent_result.entities

        if intent == IntentType.detect_objects:
            targets = entities.get("targets")
            parameters["targets"] = targets if isinstance(targets, list) else []
        elif intent == IntentType.find_water:
            water_type = entities.get("water_type")
            if water_type:
                parameters["water_type"] = water_type
        elif intent == IntentType.measure_area:
            parameters["measurement_type"] = "area"
        elif intent == IntentType.measure_distance:
            subtype = entities.get("measurement_subtype")
            parameters["measurement_type"] = (
                subtype if subtype in ("perimeter", "distance") else "distance"
            )

        return ToolSelection(tool_id=tool_id, intent=intent, parameters=parameters)


tool_selector = ToolSelector()
