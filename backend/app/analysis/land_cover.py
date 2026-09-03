"""
Land cover classification service.

Phase 1: deterministic MOCK implementation. Runs the mock land-cover model
backend and composes a typed ``LandCoverResult``. No real multi-spectral
classification is performed yet.
"""

from backend.app.analysis.base import AbstractAnalysisService
from backend.app.schemas.ai import AnalysisRequest, LandCoverResult


class LandCoverService(AbstractAnalysisService):
    tool_id = "land_cover_classifier"
    model_task = "land_cover"
    OVERALL_CONFIDENCE = 0.91

    def analyze(self, request: AnalysisRequest) -> LandCoverResult:
        model = self._model()
        payload = model.predict(request)  # LandCoverPayload

        location = self._location_of(request)
        dominant = max(payload.classes, key=lambda c: c.percentage)
        breakdown = ", ".join(
            f"{c.name} {c.percentage}%" for c in sorted(
                payload.classes, key=lambda c: c.percentage, reverse=True
            )
        )
        summary = (
            f"MOCK (demo mode) land cover over {location}: {len(payload.classes)} "
            f"classes across {payload.total_area_km2} km²; dominant class "
            f"{dominant.name} ({dominant.percentage}%). Breakdown: {breakdown}. "
            f"Deterministic mock output — not real spectral classification."
        )

        return LandCoverResult(
            kind="land_cover",
            tool_id=self.tool_id,
            location=location,
            centre=self._centre_of(request),
            confidence=self.OVERALL_CONFIDENCE,
            model=model.model_name,
            model_version=model.model_version,
            mode="mock",
            summary_text=summary,
            total_area_km2=payload.total_area_km2,
            classes=payload.classes,
        )


land_cover_service = LandCoverService()
