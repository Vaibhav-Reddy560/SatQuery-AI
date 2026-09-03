"""
Geospatial measurement service (area / distance / perimeter).

Phase 1: MOCK geometry with real geodesic math. The mock measurement model
backend returns deterministic polygon/polyline points around the AOI centre;
this service computes the actual geodesic value from those points using
``gis_processor`` (the existing, real spherical math). The geometry is
synthetic, so the whole result is still stamped ``mode="mock"``.
"""

from backend.app.analysis.base import AbstractAnalysisService
from backend.app.services.gis_processor import (
    calculate_polygon_area_km2,
    calculate_polyline_distance_km,
)
from backend.app.schemas.ai import AnalysisRequest, MeasurementResult


class MeasurementService(AbstractAnalysisService):
    tool_id = "geospatial_measurement"
    model_task = "geospatial_measurement"
    OVERALL_CONFIDENCE = 0.98

    def analyze(self, request: AnalysisRequest) -> MeasurementResult:
        model = self._model()
        payload = model.predict(request)  # MeasurementPayload
        points = [[float(v) for v in p] for p in payload.points]

        # Real geodesic math over the (mock) geometry.
        if payload.measurement_type == "area":
            value = calculate_polygon_area_km2(points)
        elif payload.measurement_type == "perimeter":
            closed = points + [points[0]] if len(points) > 1 else points
            value = calculate_polyline_distance_km(closed)
        else:  # distance
            value = calculate_polyline_distance_km(points)

        location = self._location_of(request)
        type_label = payload.measurement_type.replace("_", " ")
        summary = (
            f"MOCK (demo mode) {type_label} measurement over {location}: "
            f"{value} {payload.unit} computed with real geodesic math over a "
            f"synthetic {len(points)}-point geometry. Not a real measurement."
        )

        return MeasurementResult(
            kind="measurement",
            tool_id=self.tool_id,
            location=location,
            centre=self._centre_of(request),
            confidence=self.OVERALL_CONFIDENCE,
            model=model.model_name,
            model_version=model.model_version,
            mode="mock",
            summary_text=summary,
            measurement_type=payload.measurement_type,
            value=value,
            unit=payload.unit,
            points=points,
        )


measurement_service = MeasurementService()
