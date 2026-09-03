"""
Model abstraction layer for SatQuery.

Defines the minimal contract every model backend must satisfy so that the
rest of the system (analysis services, agents, future /models endpoints)
never depends on a concrete model. Real backends (loaded from weights /
served remotely) will implement this same protocol in later phases; today
only deterministic mock backends are registered.
"""

from typing import Protocol, runtime_checkable

from backend.app.schemas.ai import AnalysisRequest, ModelStatus


@runtime_checkable
class ModelBackend(Protocol):
    """Contract implemented by every model backend (mock today, real later)."""

    task: str
    model_name: str
    model_version: str
    device: str

    def load(self) -> None:
        """Load model weights / connect to a remote endpoint. No-op for mocks."""
        ...

    def predict(self, request: AnalysisRequest) -> object:
        """
        Run inference for a planned analysis request.

        Returns the typed payload for this backend's task (e.g.
        ``DetectionPayload``, ``LandCoverPayload``). Concrete backends narrow
        the return type; the empty ``object`` keeps the protocol generic.
        """
        ...

    def health(self) -> ModelStatus:
        """Return current status (loaded or not, device, latency)."""
        ...
