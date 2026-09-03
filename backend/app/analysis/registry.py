"""
Analysis service registry: canonical tool_id -> AnalysisService.

Canonical tool ids (single source of truth for tool selection and the
orchestrator). The frontend adapter maps these onto the UI's own tool names
in src/services/apiClient.ts.
"""

from typing import Dict, List

from backend.app.analysis.base import AnalysisService

TOOL_OBJECT_DETECTOR = "object_detector"
TOOL_WATER_DETECTOR = "water_detector"
TOOL_LAND_COVER_CLASSIFIER = "land_cover_classifier"
TOOL_CHANGE_DETECTOR = "change_detector"
TOOL_VEGETATION_ANALYZER = "vegetation_analyzer"
TOOL_VISUAL_ANALYZER = "visual_analyzer"
TOOL_MEASUREMENT = "geospatial_measurement"

# Intents that have no dedicated tool (handled without an analysis service).
NON_TOOL_INTENTS = ("general_satellite_question", "unknown")


class AnalysisServiceRegistry:
    """Maps canonical tool ids to analysis service instances."""

    def __init__(self) -> None:
        self._services: Dict[str, AnalysisService] = {}

    def register(self, service: AnalysisService) -> None:
        if service.tool_id in self._services:
            raise ValueError(f"An analysis service is already registered for '{service.tool_id}'")
        self._services[service.tool_id] = service

    def get(self, tool_id: str) -> AnalysisService:
        try:
            return self._services[tool_id]
        except KeyError:
            raise KeyError(
                f"No analysis service registered for tool '{tool_id}'. "
                f"Available tools: {sorted(self._services)}"
            ) from None

    def tool_ids(self) -> List[str]:
        return sorted(self._services)

    def has(self, tool_id: str) -> bool:
        return tool_id in self._services


analysis_service_registry = AnalysisServiceRegistry()


def _register_all() -> None:
    """Import every service module and register its singleton."""
    from backend.app.analysis import (  # local import avoids circular deps
        change_detection,
        land_cover,
        measurement,
        object_detection,
        vegetation,
        visual,
        water_detection,
    )

    for service in (
        object_detection.object_detection_service,
        water_detection.water_detection_service,
        land_cover.land_cover_service,
        change_detection.change_detection_service,
        vegetation.vegetation_analysis_service,
        visual.visual_analysis_service,
        measurement.measurement_service,
    ):
        analysis_service_registry.register(service)


_register_all()
