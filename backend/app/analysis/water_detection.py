"""
Water body detection service.

Phase 1: deterministic MOCK implementation. Runs the mock water-detection
model backend for the planned AOI and composes a typed ``DetectionResult``
whose features are water-body categories. No real NDWI/imagery is used yet.
"""

from collections import Counter
from typing import Dict

from backend.app.analysis.base import AbstractAnalysisService
from backend.app.schemas.ai import (
    AnalysisRequest,
    DetectionFeature,
    DetectionResult,
)


class WaterDetectionService(AbstractAnalysisService):
    tool_id = "water_detector"
    model_task = "water_detection"
    OVERALL_CONFIDENCE = 0.93

    def analyze(self, request: AnalysisRequest) -> DetectionResult:
        model = self._model()
        payload = model.predict(request)  # DetectionPayload

        features: list[DetectionFeature] = payload.features
        categories: Dict[str, int] = dict(Counter(f.category for f in features))
        location = self._location_of(request)
        total_area_km2 = round(sum(f.area_km2 or 0.0 for f in features), 2)
        total = len(features)
        summary = (
            f"MOCK (demo mode) water-body detection over {location}: found "
            f"{total} water feature(s) covering approx {total_area_km2} km² "
            f"({', '.join(f'{name} x{n}' for name, n in sorted(categories.items()))}). "
            f"Deterministic mock output — not real NDWI analysis."
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
            total_features=len(features),
            features=features,
            categories=categories,
        )


water_detection_service = WaterDetectionService()
