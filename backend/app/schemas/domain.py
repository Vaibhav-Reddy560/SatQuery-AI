from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

# Auth Schemas
class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Project Schemas
class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location_name: Optional[str] = "Global AOI"
    centre_lat: Optional[float] = 20.5937
    centre_lng: Optional[float] = 78.9629
    zoom_level: Optional[int] = 12
    aoi_geojson: Optional[Dict[str, Any]] = None

class ProjectOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    owner_id: str
    status: str
    location_name: Optional[str]
    centre_lat: Optional[float]
    centre_lng: Optional[float]
    zoom_level: int
    aoi_geojson: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Query & VLM Schemas
class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    project_id: Optional[str] = None
    centre: Optional[List[float]] = Field(default=[78.9629, 20.5937], description="[lng, lat]")
    location_name: Optional[str] = "Selected Region"
    satellite_sources: Optional[List[str]] = Field(default=["Sentinel-1 SAR", "Sentinel-2 Multispectral"])
    # Optional AOI / workspace context passed through to the query planner so
    # a drawn map selection or selected imagery can scope the analysis.
    aoi_geometry: Optional[Dict[str, Any]] = Field(
        default=None, description="GeoJSON geometry of the drawn AOI"
    )
    image_ids: Optional[List[str]] = Field(default=None, description="Imagery to analyse")
    from_date: Optional[str] = Field(default=None, description="Start of analysis window (ISO)")
    to_date: Optional[str] = Field(default=None, description="End of analysis window (ISO)")

class QueryIntentOut(BaseModel):
    type: str
    location: Optional[str] = None
    centre: Optional[List[float]] = None
    confidence: float
    detected_target: Optional[str] = None
    spectral_indices: Optional[List[str]] = None

class QueryAttachment(BaseModel):
    type: str  # image, map_overlay, data, table
    label: str
    confidence: Optional[float] = None
    url: Optional[str] = None

class QueryResponse(BaseModel):
    session_id: str
    query_id: str
    intent: QueryIntentOut
    text_response: str
    attachments: List[QueryAttachment] = []
    suggested_actions: List[str] = []
    confidence: float
    analysis_kind: str  # detection, change, land_cover, vegetation, measurement, general
    analysis_payload: Dict[str, Any]
    latency_ms: Optional[float] = None
    trace: Optional[List[str]] = Field(default=None, description="Agent execution trace steps")

# Analysis Specs
class DetectionFeature(BaseModel):
    id: str
    label: str
    category: str
    confidence: float
    coords: List[float]  # [lng, lat]
    bbox: Optional[List[float]] = None
    area_m2: Optional[float] = None

class DetectionResultOut(BaseModel):
    kind: str = "detection"
    location: str
    total_features: int
    features: List[DetectionFeature]
    categories: Dict[str, int]
    confidence: float

class LandCoverClass(BaseModel):
    name: str
    code: str
    area_km2: float
    percentage: float
    color: str

class LandCoverResultOut(BaseModel):
    kind: str = "land_cover"
    location: str
    total_area_km2: float
    classes: List[LandCoverClass]
    confidence: float

class ChangeItem(BaseModel):
    id: str
    type: str  # gain, loss, modification
    description: str
    area_km2: float
    confidence: float
    coords: List[float]

class ChangeResultOut(BaseModel):
    kind: str = "change"
    location: str
    before_date: str
    after_date: str
    total_area_changed_km2: float
    changes: List[ChangeItem]
    confidence: float

class MeasurementResultOut(BaseModel):
    kind: str = "measurement"
    measurement_type: str  # distance, area, perimeter
    location: str
    value: float
    unit: str
    points: List[List[float]]
    summary_text: str
    confidence: float

# Dataset Schemas
class BigEarthNetSampleOut(BaseModel):
    sample_key: str
    sentinel_1_polarizations: List[str]
    sentinel_2_bands: List[str]
    corine_classes: List[str]
    spatial_coords: List[float]

class VRSBenchSampleOut(BaseModel):
    sample_key: str
    question: str
    answer: str
    task_type: str  # VQA, Captioning, Object Grounding
    confidence_target: float

class ModelStatusOut(BaseModel):
    model_name: str
    status: str
    device: str
    supported_tasks: List[str]
    bigearthnet_finetuned: bool
    vrsbench_evaluated: bool
    gpu_memory_used_gb: Optional[float] = 0.0
    inference_latency_ms: float
