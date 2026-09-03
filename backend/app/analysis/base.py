"""
Analysis service layer.

An ``AnalysisService`` turns a planned ``AnalysisRequest`` into a typed
structured ``AnalysisResult``. Today every registered service runs the
corresponding deterministic mock model backend and composes the result
envelope (location, centre, model metadata, summary text); later phases keep
the same interface while delegating real computation to real model backends.
"""

from abc import ABC, abstractmethod
from typing import Protocol

from backend.app.ml.base import ModelBackend
from backend.app.ml.registry import model_registry
from backend.app.schemas.ai import (
    AnalysisRequest,
    AnalysisResult,
)

DEFAULT_LOCATION = "Selected AOI"
DEFAULT_CENTRE = [78.9629, 20.5937]  # India


class AnalysisServiceError(Exception):
    """
    Structured failure raised by analysis services (e.g. imagery unavailable,
    no valid pixels). Carries a stable ``code`` the API/frontend can surface.
    """

    def __init__(self, code: str, user_message: str):
        super().__init__(user_message)
        self.code = code
        self.user_message = user_message


class AnalysisService(Protocol):
    """Common interface every analysis service implements."""

    tool_id: str
    model_task: str

    def analyze(self, request: AnalysisRequest) -> AnalysisResult:
        ...


class AbstractAnalysisService(ABC):
    """Shared helpers for the concrete analysis services."""

    tool_id: str = ""
    model_task: str = ""

    def _model(self) -> ModelBackend:
        return model_registry.get(self.model_task)

    def _location_of(self, request: AnalysisRequest) -> str:
        return (request.location or DEFAULT_LOCATION).strip() or DEFAULT_LOCATION

    def _centre_of(self, request: AnalysisRequest) -> list:
        return [float(v) for v in (request.centre or DEFAULT_CENTRE)]

    @abstractmethod
    def analyze(self, request: AnalysisRequest) -> AnalysisResult:
        """Run the analysis for the planned request and return a typed result."""
        ...
