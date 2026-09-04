from typing import List
from fastapi import APIRouter

router = APIRouter()

# NOTE (Phase 3A honesty hardening): the legacy /analysis/detection,
# /analysis/land-cover and /analysis/change-detection endpoints were REMOVED.
# They called vlm_engine.infer(), which generated random/fabricated scientific
# results (random feature positions/counts, random land-cover areas, random
# change zones) without stamping them as mock. The current architecture runs
# real analysis through the agent pipeline (POST /api/v1/query/ ->
# orchestrator -> analysis services), which stamps results with an honest
# mode/model_kind. Those three endpoints were unused by the frontend, so they
# were removed rather than kept returning misleading numbers.
#
# /analysis/measurement is kept: it computes REAL geodesic area/distance from
# the supplied coordinates (gis_processor) — no fabricated values.

@router.post("/measurement")
def run_measurement(
    points: List[List[float]],
    measurement_type: str = "area",
    location: str = "Drawn Polygon"
):
    from backend.app.services.gis_processor import calculate_polygon_area_km2, calculate_polyline_distance_km

    if measurement_type == "area":
        val = calculate_polygon_area_km2(points)
        unit = "km²"
        summary = f"Enclosed polygon area calculated for {location}."
    else:
        val = calculate_polyline_distance_km(points)
        unit = "km"
        summary = f"Polyline distance length measured for {location}."

    return {
        "kind": "measurement",
        "measurement_type": measurement_type,
        "location": location,
        "value": val,
        "unit": unit,
        "points": points,
        "summary_text": summary,
        "confidence": 0.98
    }