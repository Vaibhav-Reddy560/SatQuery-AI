from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.ml.vlm_engine import vlm_engine
from backend.app.schemas.ai import IntentType

router = APIRouter()

@router.post("/detection")
def run_object_detection(
    target_category: Optional[str] = "all",
    location: str = "Target Area",
    lng: float = 78.9629,
    lat: float = 20.5937
):
    query_str = f"detect {target_category} in {location}"
    # This endpoint IS the router for this flow: it resolves the request to
    # object detection before calling the VLM. Pass the resolved canonical
    # intent so infer() never re-classifies the query with its own regex.
    res = vlm_engine.infer(
        query=query_str,
        centre=[lng, lat],
        location_name=location,
        intent=IntentType.detect_objects,
    )
    return res["analysis_payload"]

@router.post("/land-cover")
def run_land_cover_classification(
    location: str = "Regional AOI",
    lng: float = 78.9629,
    lat: float = 20.5937
):
    query_str = f"land cover classification for {location}"
    res = vlm_engine.infer(
        query=query_str,
        centre=[lng, lat],
        location_name=location,
        intent=IntentType.land_cover,
    )
    return res["analysis_payload"]

@router.post("/change-detection")
def run_change_detection(
    before_date: str = "2024-01-01",
    after_date: str = "2026-01-01",
    location: str = "AOI Region",
    lng: float = 78.9629,
    lat: float = 20.5937
):
    query_str = f"change detection comparing {before_date} to {after_date} in {location}"
    res = vlm_engine.infer(
        query=query_str,
        centre=[lng, lat],
        location_name=location,
        intent=IntentType.change_detection,
    )
    return res["analysis_payload"]

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
