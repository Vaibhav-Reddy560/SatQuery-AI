"""
Object detection service.

Phase 1: deterministic MOCK implementation. Runs the mock object-detection
model backend for the planned AOI and composes a typed ``DetectionResult``.
No real model weights are involved; results are stamped ``mode="mock"``.
"""

from collections import Counter
from typing import Dict

from backend.app.analysis.base import AbstractAnalysisService
from backend.app.schemas.ai import (
    AnalysisRequest,
    DetectionFeature,
    DetectionResult,
)


class ObjectDetectionService(AbstractAnalysisService):
    tool_id = "object_detector"
    model_task = "object_detection"
    OVERALL_CONFIDENCE = 0.94

    def analyze(self, request: AnalysisRequest) -> DetectionResult:
        model = self._model()
        payload = model.predict(request)  # DetectionPayload

        features: list[DetectionFeature] = payload.features
        categories: Dict[str, int] = dict(Counter(f.category for f in features))
        location = self._location_of(request)
        total = len(features)
        cat_summary = ", ".join(f"{name} x{n}" for name, n in sorted(categories.items()))
        summary = (
            f"MOCK (demo mode) object detection over {location}: identified "
            f"{total} feature(s) across {len(categories)} categories "
            f"({cat_summary}). Deterministic mock output — not real satellite analysis."
        )

        return DetectionResult(
            kind="detection",
            tool_id=self.tool_id,
            location=location,
            centre=self._centre_of(request),
            confidence=self.OVERALL_CONFIDENCE,
            model=model.model_name,
            model_version=model.model_version,
            mode="mock",
            summary_text=summary,
            total_features=total,
            features=features,
            categories=categories,
        )


object_detection_service = ObjectDetectionService()
