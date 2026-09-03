"""
Satellite analysis service layer.

Exposes ``analysis_service_registry`` (tool_id -> AnalysisService). Every
Phase 1 service is a deterministic mock: it runs the task's mock model
backend and composes a typed, ``mode="mock"`` result. Real open-source
analyses replace these implementations in later phases behind the same
tool ids.
"""

from backend.app.analysis.base import (
    AnalysisService,
    AbstractAnalysisService,
    DEFAULT_CENTRE,
    DEFAULT_LOCATION,
)
from backend.app.analysis.registry import (
    analysis_service_registry,
    TOOL_OBJECT_DETECTOR,
    TOOL_WATER_DETECTOR,
    TOOL_LAND_COVER_CLASSIFIER,
    TOOL_CHANGE_DETECTOR,
    TOOL_VEGETATION_ANALYZER,
    TOOL_MEASUREMENT,
)

__all__ = [
    "AnalysisService",
    "AbstractAnalysisService",
    "analysis_service_registry",
    "DEFAULT_CENTRE",
    "DEFAULT_LOCATION",
    "TOOL_OBJECT_DETECTOR",
    "TOOL_WATER_DETECTOR",
    "TOOL_LAND_COVER_CLASSIFIER",
    "TOOL_CHANGE_DETECTOR",
    "TOOL_VEGETATION_ANALYZER",
    "TOOL_MEASUREMENT",
]
