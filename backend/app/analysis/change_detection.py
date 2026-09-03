"""
Bi-temporal change detection service.

Phase 1: deterministic MOCK implementation. Runs the mock change-detection
model backend and composes a typed ``ChangeDetectionResult``. No real
before/after imagery is compared yet.
"""

from backend.app.analysis.base import AbstractAnalysisService
from backend.app.schemas.ai import AnalysisRequest, ChangeDetectionResult


class ChangeDetectionService(AbstractAnalysisService):
    tool_id = "change_detector"
    model_task = "change_detection"
    OVERALL_CONFIDENCE = 0.9

    def analyze(self, request: AnalysisRequest) -> ChangeDetectionResult:
        model = self._model()
        payload = model.predict(request)  # ChangePayload

        location = self._location_of(request)
        top = ", ".join(
            c.description.lower() for c in payload.changes[:3]
        )
        summary = (
            f"MOCK (demo mode) change detection over {location} between "
            f"{payload.before_date} and {payload.after_date}: {len(payload.changes)} "
            f"change zone(s), {payload.total_area_changed_km2} km² total "
            f"({top or 'no zones'}). Deterministic mock output — not real "
            f"bi-temporal imagery analysis."
        )

        return ChangeDetectionResult(
            kind="change",
            tool_id=self.tool_id,
            location=location,
            centre=self._centre_of(request),
            confidence=self.OVERALL_CONFIDENCE,
            model=model.model_name,
            model_version=model.model_version,
            mode="mock",
            summary_text=summary,
            before_date=payload.before_date,
            after_date=payload.after_date,
            total_area_changed_km2=payload.total_area_changed_km2,
            changes=payload.changes,
        )


change_detection_service = ChangeDetectionService()
