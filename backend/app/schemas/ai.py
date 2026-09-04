"""
Canonical typed models for the SatQuery AI/ML pipeline (Phase 1).

These models describe the flow:

    User Query -> Intent Detection -> Query Planning -> Tool Selection
               -> Analysis Service -> Structured Result -> NL Explanation

Conventions
-----------
- All spatial coordinates follow GeoJSON ordering: ``[lng, lat]``.
- Every result carries a ``kind`` discriminator so the union can be
  validated/serialised unambiguously (mirrors the frontend's
  ``AnalysisResultKind`` union in ``src/types/query.ts``).
- Results expose GeoJSON-compatible geometry wherever spatial output exists.
- ``mode`` distinguishes live model output (later phases) from the current
  deterministic mock implementations -- the UI must never present mock
  output as real satellite analysis.

This module deliberately does NOT import ``backend.app.models.domain`` (the
SQLAlchemy ORM). The two layers are kept separate on purpose.
"""

from enum import Enum
from typing import Annotated, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


# ── Canonical intent taxonomy ──────────────────────────────────────────────
#
# Single source of truth shared by backend agents and the (mapped) frontend.
# These names are the canonical backend ids; the frontend adapter in
# src/services/apiClient.ts maps them onto the UI's own IntentType values.

class IntentType(str, Enum):
    detect_objects = "detect_objects"
    find_water = "find_water"
    land_cover = "land_cover"
    change_detection = "change_detection"
    vegetation_analysis = "vegetation_analysis"
    measure_area = "measure_area"
    measure_distance = "measure_distance"
    # Phase 2G: questions that ask the assistant to look AT actual image
    # pixels ("what do you see / describe the visible landscape / does the
    # image contain …"). Routed to the vision-language model, NOT the canned
    # general-answer path (which keeps ``general_satellite_question``).
    visual_interpretation = "visual_interpretation"
    general_satellite_question = "general_satellite_question"
    unknown = "unknown"


# ── GeoJSON-compatible geometry ────────────────────────────────────────────

class PointGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(..., description="[lng, lat]")


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    # GeoJSON polygon: list of linear rings, each a list of [lng, lat] nodes.
    coordinates: List[List[List[float]]]


AoiGeometry = Union[PointGeometry, PolygonGeometry]


# ── Agent inputs ───────────────────────────────────────────────────────────

class DateRange(BaseModel):
    """Optional bi-temporal window (ISO strings)."""
    from_date: Optional[str] = None
    to_date: Optional[str] = None


class AgentContext(BaseModel):
    """
    Everything the frontend knows about the current workspace/AOI that is not
    part of the raw query text. The frontend may later supply ``aoi_geometry``
    from the map drawing tools; every field is optional so a bare text query
    still works.
    """
    location_name: Optional[str] = None
    centre: Optional[List[float]] = Field(default=None, description="[lng, lat]")
    aoi_geometry: Optional[AoiGeometry] = None
    image_ids: List[str] = Field(default_factory=list)
    from_date: Optional[str] = None
    to_date: Optional[str] = None


class IntentResult(BaseModel):
    """Output of the intent detector."""
    intent: IntentType
    confidence: float = Field(..., ge=0.0, le=1.0)
    entities: Dict[str, object] = Field(default_factory=dict)
    reasoning: str = ""


class ToolSelection(BaseModel):
    """Output of the tool selector: which analysis tool to run, with params."""
    tool_id: str
    intent: IntentType
    parameters: Dict[str, object] = Field(default_factory=dict)


class AnalysisRequest(BaseModel):
    """The full plan the orchestrator hands to an analysis service."""
    query: str
    intent: IntentType
    tool_id: str
    location: Optional[str] = None
    centre: Optional[List[float]] = Field(default=None, description="[lng, lat]")
    aoi_geometry: Optional[AoiGeometry] = None
    date_range: Optional[DateRange] = None
    image_ids: List[str] = Field(default_factory=list)
    thresholds: Dict[str, float] = Field(default_factory=dict)
    parameters: Dict[str, object] = Field(default_factory=dict)


# ── Model layer ────────────────────────────────────────────────────────────

class ModelStatus(BaseModel):
    model_name: str
    model_version: str
    task: str
    status: Literal["not_loaded", "ready"] = "not_loaded"
    device: str = "cpu"


class ModelResponse(BaseModel):
    """Generic envelope a model backend may return around raw predictions."""
    ok: bool
    model: str
    model_version: str
    task: str
    latency_ms: float = 0.0
    error: Optional[str] = None
    data: Optional[Dict[str, object]] = None


# ── Per-kind payloads (what a model backend predicts) ──────────────────────

class DetectionFeature(BaseModel):
    id: str
    label: str
    category: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    geometry: PointGeometry
    bbox: Optional[List[float]] = Field(
        default=None, description="[west, south, east, north] in lng/lat"
    )
    area_km2: Optional[float] = None


class DetectionPayload(BaseModel):
    features: List[DetectionFeature]


class LandCoverClass(BaseModel):
    name: str
    code: Optional[str] = None
    percentage: float
    area_km2: float
    color: str


class LandCoverPayload(BaseModel):
    total_area_km2: float
    classes: List[LandCoverClass]


class ChangeItem(BaseModel):
    id: str
    type: Literal["gain", "loss", "modification"]
    description: str
    area_km2: float
    confidence: float = Field(..., ge=0.0, le=1.0)
    geometry: Optional[PointGeometry] = None


# Default |delta_NDVI| change threshold (NDVI units) for bi-temporal change
# detection — conservative NDVI-differencing breakpoint, documented in
# backend/app/analysis/change.py and configurable per request.
DEFAULT_CHANGE_THRESHOLD = 0.15


class ChangePayload(BaseModel):
    before_date: str
    after_date: str
    total_area_changed_km2: float
    changes: List[ChangeItem]


class ChangeStats(BaseModel):
    """
    Real statistics over the valid comparison pixels of a bi-temporal change
    analysis (pixels cloud-free in BOTH observations).

    Percentages are shares of the valid comparison pixels; areas use the
    raster's actual resolution.
    """
    valid_pixel_count: int
    unchanged_pixel_count: int
    changed_pixel_count: int
    loss_pixel_count: int
    gain_pixel_count: int
    unchanged_percentage: float = Field(..., ge=0.0, le=100.0)
    changed_percentage: float = Field(..., ge=0.0, le=100.0)
    loss_percentage: float = Field(..., ge=0.0, le=100.0)
    gain_percentage: float = Field(..., ge=0.0, le=100.0)
    total_area_km2: float
    changed_area_km2: float
    loss_area_km2: float
    gain_area_km2: float


class VegetationZone(BaseModel):
    id: str
    status: Literal["healthy", "stressed", "degraded", "loss"]
    area_km2: float
    # Fraction of valid pixels in this zone (mock backends may report a model
    # confidence instead; real NDVI zones report the observed fraction).
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class VegetationPayload(BaseModel):
    total_area_km2: float
    vegetation_lost_km2: float
    zones: List[VegetationZone]


# ── NDVI / imagery metadata (Phase 2 real vegetation analysis) ─────────────

class NdviStats(BaseModel):
    """Real statistics over valid (non-masked) NDVI pixels only."""
    min: float
    max: float
    mean: float
    median: float
    std: Optional[float] = None
    valid_pixel_percentage: float = Field(..., ge=0.0, le=100.0)


class NdwiStats(BaseModel):
    """
    Real statistics over valid (non-masked) NDWI pixels only.

    ``water_pixel_percentage`` is the share of VALID pixels classified as
    water (NDWI >= threshold), mirroring how vegetation zone fractions are
    reported.
    """
    min: float
    max: float
    mean: float
    median: float
    std: Optional[float] = None
    valid_pixel_percentage: float = Field(..., ge=0.0, le=100.0)
    water_pixel_percentage: float = Field(..., ge=0.0, le=100.0)


class ImageryMetadata(BaseModel):
    """Provenance of the imagery an analysis ran on."""
    provider: str
    satellite: str = "Sentinel-2"
    sensor: str = "MSI"
    acquisition_date: Optional[str] = None
    resolution_m: Optional[float] = None
    crs: Optional[str] = None
    bands: List[str] = Field(default_factory=list)
    scene_id: Optional[str] = None
    cloud_cover_percent: Optional[float] = None
    processing_method: str = ""


class RasterOverlay(BaseModel):
    """
    A georeferenced raster overlay the frontend can draw on the MapLibre map
    as an image source (bounds are [west, south, east, north] in lng/lat).
    """
    image_data_url: str
    bounds: List[float] = Field(..., description="[west, south, east, north]")
    label: str = "Analysis overlay"
    opacity: float = Field(0.75, ge=0.0, le=1.0)
    colormap: Literal["ndvi", "ndwi", "classes"] = "ndvi"


class MeasurementPayload(BaseModel):
    measurement_type: Literal["area", "distance", "perimeter"]
    value: float
    unit: str
    points: List[List[float]]  # list of [lng, lat]


# ── Structured results (one envelope per kind) ─────────────────────────────
#
# Field names mirror the frontend's camelCase types as closely as snake_case
# allows (see src/types/query.ts). The frontend adapter performs the explicit
# key mapping -- nothing is passed through with `as any`.

class AnalysisResultBase(BaseModel):
    tool_id: str
    location: str
    centre: List[float] = Field(..., description="[lng, lat]")
    model: str
    model_version: str
    mode: Literal["mock", "live"] = "mock"
    summary_text: str
    # ``confidence`` is OPTIONAL and defaults to None: radiometric/ML
    # services always set a real confidence, but a VLM has no calibrated
    # confidence, so visual results honestly omit the field.
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    # Honest processing-method label: "algorithm" for radiometric math
    # (NDVI/NDWI), "ml" for trained models, "vlm" for a genuine multimodal
    # vision-language model that received image pixels, None when unknown.
    model_kind: Optional[Literal["algorithm", "ml", "vlm"]] = None


class DetectionResult(AnalysisResultBase):
    kind: Literal["detection"] = "detection"
    total_features: int
    features: List[DetectionFeature]
    categories: Dict[str, int]


class LandCoverResult(AnalysisResultBase):
    kind: Literal["land_cover"] = "land_cover"
    total_area_km2: float
    classes: List[LandCoverClass]
    # Phase 2D real ML classification outputs.
    model_inputs: List[str] = Field(default_factory=list, description="Input features")
    imagery: Optional[ImageryMetadata] = None
    overlay: Optional[RasterOverlay] = None


class ChangeDetectionResult(AnalysisResultBase):
    kind: Literal["change"] = "change"
    before_date: str
    after_date: str
    total_area_changed_km2: float
    changes: List[ChangeItem]
    # Phase 2E real multi-temporal outputs (all optional so mock output stays
    # valid). The algorithm is delta-NDVI radiometric math — never ML.
    before_imagery: Optional[ImageryMetadata] = None
    after_imagery: Optional[ImageryMetadata] = None
    change_stats: Optional[ChangeStats] = None
    threshold: float = DEFAULT_CHANGE_THRESHOLD
    change_method: str = "delta_ndvi"
    overlay: Optional[RasterOverlay] = None


class VegetationResult(AnalysisResultBase):
    kind: Literal["vegetation"] = "vegetation"
    total_area_km2: float
    vegetation_lost_km2: Optional[float] = None  # requires a time series; None in Phase 2
    zones: List[VegetationZone]
    # Phase 2 real NDVI outputs (all optional so mock output stays valid).
    ndvi_stats: Optional[NdviStats] = None
    thresholds: Optional[Dict[str, float]] = None
    imagery: Optional[ImageryMetadata] = None
    overlay: Optional[RasterOverlay] = None


class WaterResult(AnalysisResultBase):
    """
    Real Sentinel-2 water analysis (Phase 2C).

    NDWI = (GREEN - NIR) / (GREEN + NIR) with GREEN = B03, NIR = B08;
    pixels with NDWI >= ``threshold`` are classified as water. The
    algorithm is radiometric (not an ML model); ``mode`` stays "live" for
    both the bundled sample and the live STAC provider.
    """
    kind: Literal["water"] = "water"
    water_area_km2: float
    total_area_km2: float
    ndwi_stats: Optional[NdwiStats] = None
    threshold: float = 0.0
    imagery: Optional[ImageryMetadata] = None
    overlay: Optional[RasterOverlay] = None


class MeasurementResult(AnalysisResultBase):
    kind: Literal["measurement"] = "measurement"
    measurement_type: Literal["area", "distance", "perimeter"]
    value: float
    unit: str
    points: List[List[float]]


class VisualResult(AnalysisResultBase):
    """
    Genuine vision-language interpretation of an actual satellite image
    (Phase 2G).

    The answer is produced by a real multimodal model that received the
    actual RGB pixels of the scene — never by metadata, NDVI values or a
    text-only model. It is general visual interpretation only: it is NOT a
    calibrated remote-sensing measurement, which is exactly why no
    ``confidence`` is reported (no calibrated confidence exists) and why the
    deterministic/ML analysis services stay authoritative for quantitative
    questions. ``context_supplied`` records whether structured analysis
    context was injected into the prompt.
    """
    kind: Literal["visual"] = "visual"
    answer: str
    question: str = ""
    imagery: Optional[ImageryMetadata] = None
    context_supplied: bool = False
    context_source: str = "none"
    image_size: Optional[str] = None
    inference_latency_ms: Optional[float] = None
    # Wall time spent loading the model weights into memory for THIS request
    # (None when the model was already loaded — see ``model_reused``).
    model_load_latency_ms: Optional[float] = None
    # True when the model weights were already in memory (cached from an
    # earlier request in this process) instead of being re-read from disk.
    model_reused: bool = False
    device: Optional[str] = None
    # Optional true-colour RGB preview of the exact pixels the model saw
    # (data URL), so the chat UI can display the analysed scene.
    image_data_url: Optional[str] = None


AnalysisResult = Annotated[
    Union[
        DetectionResult,
        LandCoverResult,
        ChangeDetectionResult,
        VegetationResult,
        WaterResult,
        MeasurementResult,
        VisualResult,
    ],
    Field(discriminator="kind"),
]


# ── Orchestrator output ────────────────────────────────────────────────────

class AgentRun(BaseModel):
    """
    The complete record of one agent execution. Exposes every field the
    frontend AgentTrace panel needs (intent, confidence, tool, steps), plus
    the structured result and the natural-language explanation.
    """
    query: str
    intent: IntentType
    intent_confidence: float = Field(..., ge=0.0, le=1.0)
    entities: Dict[str, object] = Field(default_factory=dict)
    reasoning: str = ""
    plan: Optional[AnalysisRequest] = None
    selected_tool: Optional[ToolSelection] = None
    result: Optional[AnalysisResult] = None
    explanation: str = ""
    trace: List[str] = Field(default_factory=list)
    latency_ms: float = 0.0
