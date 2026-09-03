"""
Model registry + deterministic MOCK model backends.

Registry maps ``task -> ModelBackend``. The mock backends registered below
produce *deterministic* typed payloads derived from the request (centre,
query, parameters) -- no ``random`` module, no network, no weights. This lets
the full agent -> service -> model architecture run and be tested while
keeping the output honest: every result is stamped ``mode="mock"`` and the
mock models clearly describe themselves as mock.

Phase 2+ replaces individual backends with real implementations behind the
same task keys; nothing upstream needs to change.
"""

import math
import zlib
from random import Random
from typing import Dict, List, Optional

from backend.app.ml.base import ModelBackend
from backend.app.ml.landcover import LandCoverClassifierBackend
from backend.app.services.gis_processor import (
    calculate_polygon_area_km2,
    calculate_polyline_distance_km,
)
from backend.app.schemas.ai import (
    AnalysisRequest,
    ChangeItem,
    ChangePayload,
    DetectionFeature,
    DetectionPayload,
    LandCoverClass,
    LandCoverPayload,
    MeasurementPayload,
    ModelStatus,
    PointGeometry,
    VegetationPayload,
    VegetationZone,
)

# Canonical task ids used across analysis services and the registry.
TASK_OBJECT_DETECTION = "object_detection"
TASK_WATER_DETECTION = "water_detection"
TASK_LAND_COVER = "land_cover"
TASK_CHANGE_DETECTION = "change_detection"
TASK_VEGETATION = "vegetation_analysis"
TASK_MEASUREMENT = "geospatial_measurement"

DEFAULT_CENTRE = [78.9629, 20.5937]  # India


# ── Deterministic helpers ──────────────────────────────────────────────────
#
# A stable seed is derived from the request inputs so identical requests
# always produce identical results (no true randomness anywhere).

def _seed(request: AnalysisRequest, salt: str = "") -> int:
    key = "|".join(
        [
            request.query,
            salt,
            ",".join(str(c) for c in (request.centre or DEFAULT_CENTRE)),
            ",".join(request.parameters.get("targets", []) or []),
            request.parameters.get("measurement_type", ""),
        ]
    )
    return zlib.crc32(key.encode("utf-8"))


def _rng(request: AnalysisRequest, salt: str = "") -> Random:
    return Random(_seed(request, salt))


def _round(value: float, ndigits: int = 5) -> float:
    return round(float(value), ndigits)


def _centre_of(request: AnalysisRequest) -> List[float]:
    return [float(v) for v in (request.centre or DEFAULT_CENTRE)]


def _category_names(request: AnalysisRequest) -> List[str]:
    """Resolve the requested detection targets to display categories."""
    synonyms = {
        "building": "Building", "house": "Building", "structure": "Building",
        "ship": "Ship", "vessel": "Ship", "boat": "Ship",
        "vehicle": "Vehicle", "car": "Vehicle", "truck": "Vehicle",
        "aircraft": "Aircraft", "airplane": "Aircraft", "plane": "Aircraft",
        "solar": "Solar Panel", "panel": "Solar Panel", "photovoltaic": "Solar Panel",
        "road": "Road", "bridge": "Bridge",
    }
    targets = request.parameters.get("targets", [])
    if isinstance(targets, list) and targets:
        resolved = [synonyms.get(str(t).lower(), str(t).title()) for t in targets]
        return list(dict.fromkeys(resolved))
    return ["Building", "Vehicle", "Ship", "Road", "Solar Panel", "Bridge"]


def _water_category_names(request: AnalysisRequest) -> List[str]:
    synonyms = {
        "lake": "Lake", "river": "River", "reservoir": "Reservoir",
        "pond": "Pond", "canal": "Canal", "water": "Water Body",
        "waterbody": "Water Body", "flood": "Flood Water",
        "wetland": "Wetland", "sea": "Sea", "ocean": "Sea",
    }
    water_type = request.parameters.get("water_type")
    if water_type:
        return [synonyms.get(str(water_type).lower(), str(water_type).title())]
    return ["Lake", "River", "Reservoir", "Pond", "Canal"]


# ── Mock backends ───────────────────────────────────────────────────────────

class MockModelBackend:
    """Base for the deterministic mock backends (task metadata + health)."""

    task: str = ""
    model_name: str = ""
    model_version: str = "0.1.0"
    device: str = "cpu"

    def __init__(self) -> None:
        self._loaded = False

    def load(self) -> None:
        self._loaded = True

    def health(self) -> ModelStatus:
        return ModelStatus(
            model_name=self.model_name,
            model_version=self.model_version,
            task=self.task,
            status="ready" if self._loaded else "not_loaded",
            device=self.device,
        )


class ObjectDetectionMockBackend(MockModelBackend):
    """Deterministic mock object detector: features scattered around centre."""

    task = TASK_OBJECT_DETECTION
    model_name = "satquery-mock-object-detector"
    model_version = "0.1.0"

    def predict(self, request: AnalysisRequest) -> DetectionPayload:
        rng = _rng(request, "object_detection")
        centre = _centre_of(request)
        categories = _category_names(request)
        count = 4 + rng.randrange(0, 5)  # 4..8 features
        features: List[DetectionFeature] = []
        for i in range(count):
            category = rng.choice(categories)
            # Deterministic scatter around the AOI centre.
            d_lng = rng.uniform(-0.02, 0.02)
            d_lat = rng.uniform(-0.02, 0.02)
            lng = _round(centre[0] + d_lng)
            lat = _round(centre[1] + d_lat)
            pad = rng.uniform(0.001, 0.004)
            features.append(
                DetectionFeature(
                    id=f"feat-{i + 1}",
                    label=f"{category} #{i + 1}",
                    category=category,
                    confidence=_round(rng.uniform(0.88, 0.97), 2),
                    geometry=PointGeometry(type="Point", coordinates=[lng, lat]),
                    bbox=[_round(lng - pad), _round(lat - pad), _round(lng + pad), _round(lat + pad)],
                    area_km2=_round(rng.uniform(0.01, 0.6), 4),
                )
            )
        return DetectionPayload(features=features)


class WaterDetectionMockBackend(MockModelBackend):
    """Deterministic mock water finder: larger-area features around centre."""

    task = TASK_WATER_DETECTION
    model_name = "satquery-mock-water-detector"
    model_version = "0.1.0"

    def predict(self, request: AnalysisRequest) -> DetectionPayload:
        rng = _rng(request, "water_detection")
        centre = _centre_of(request)
        categories = _water_category_names(request)
        count = 3 + rng.randrange(0, 4)  # 3..6 water bodies
        features: List[DetectionFeature] = []
        for i in range(count):
            category = rng.choice(categories)
            d_lng = rng.uniform(-0.025, 0.025)
            d_lat = rng.uniform(-0.025, 0.025)
            lng = _round(centre[0] + d_lng)
            lat = _round(centre[1] + d_lat)
            pad = rng.uniform(0.002, 0.008)
            features.append(
                DetectionFeature(
                    id=f"water-{i + 1}",
                    label=f"{category} #{i + 1}",
                    category=category,
                    confidence=_round(rng.uniform(0.86, 0.96), 2),
                    geometry=PointGeometry(type="Point", coordinates=[lng, lat]),
                    bbox=[_round(lng - pad), _round(lat - pad), _round(lng + pad), _round(lat + pad)],
                    area_km2=_round(rng.uniform(0.4, 18.0), 2),
                )
            )
        return DetectionPayload(features=features)


_CHANGE_DESCRIPTIONS: Dict[str, List[str]] = {
    "gain": ["New construction footprint", "Urban infrastructure expansion", "New plantation area"],
    "loss": ["Vegetation cover decrease", "Forest clearing detected", "Wetland area reduction"],
    "modification": ["Land-use conversion", "Water course shift", "Surface texture change"],
}


class ChangeDetectionMockBackend(MockModelBackend):
    """Deterministic mock bi-temporal change detector."""

    task = TASK_CHANGE_DETECTION
    model_name = "satquery-mock-change-detector"
    model_version = "0.1.0"

    def predict(self, request: AnalysisRequest) -> ChangePayload:
        rng = _rng(request, "change_detection")
        centre = _centre_of(request)
        date_range = request.date_range
        before = date_range.from_date if date_range and date_range.from_date else "2024-01-01"
        after = date_range.to_date if date_range and date_range.to_date else "2026-01-01"

        count = 2 + rng.randrange(0, 3)  # 2..4 change zones
        changes: List[ChangeItem] = []
        for i in range(count):
            kind = rng.choice(["gain", "loss", "modification"])
            d_lng = rng.uniform(-0.015, 0.015)
            d_lat = rng.uniform(-0.015, 0.015)
            changes.append(
                ChangeItem(
                    id=f"chg-{i + 1}",
                    type=kind,
                    description=rng.choice(_CHANGE_DESCRIPTIONS[kind]),
                    area_km2=_round(rng.uniform(0.3, 6.0), 2),
                    confidence=_round(rng.uniform(0.78, 0.94), 2),
                    geometry=PointGeometry(
                        type="Point",
                        coordinates=[_round(centre[0] + d_lng), _round(centre[1] + d_lat)],
                    ),
                )
            )
        total = _round(sum(c.area_km2 for c in changes), 2)
        return ChangePayload(
            before_date=before,
            after_date=after,
            total_area_changed_km2=total,
            changes=changes,
        )


_VEGETATION_STATUSES = ["healthy", "stressed", "degraded", "loss"]


class VegetationMockBackend(MockModelBackend):
    """Deterministic mock vegetation status / loss analyser."""

    task = TASK_VEGETATION
    model_name = "satquery-mock-vegetation-analyzer"
    model_version = "0.1.0"

    def predict(self, request: AnalysisRequest) -> VegetationPayload:
        rng = _rng(request, "vegetation")
        total_area = _round(rng.uniform(80.0, 400.0), 1)
        weights = [0.55 + rng.uniform(-0.1, 0.1), 0.18, 0.1, 0.06]
        weights = [max(w, 0.0) for w in weights]
        scale = total_area / sum(weights)
        zones: List[VegetationZone] = []
        for i, status in enumerate(_VEGETATION_STATUSES):
            zones.append(
                VegetationZone(
                    id=f"veg-{i + 1}",
                    status=status,
                    area_km2=_round(weights[i] * scale, 2),
                    confidence=_round(rng.uniform(0.8, 0.94), 2),
                )
            )
        loss = next(z.area_km2 for z in zones if z.status == "loss")
        return VegetationPayload(
            total_area_km2=total_area,
            vegetation_lost_km2=loss,
            zones=zones,
        )


class MeasurementMockBackend(MockModelBackend):
    """Deterministic mock geodesic measurement (area/distance/perimeter)."""

    task = TASK_MEASUREMENT
    model_name = "satquery-mock-geospatial-measurement"
    model_version = "0.1.0"

    def predict(self, request: AnalysisRequest) -> MeasurementPayload:
        """
        Deterministic synthetic geometry + REAL geodesic math (gis_processor).

        The polygons/polylines are synthetic (centred on the AOI centre), so
        the payload is still a mock -- but the reported value is the true
        spherical measurement of that geometry, not a random number.
        """
        centre = _centre_of(request)
        measurement_type = str(request.parameters.get("measurement_type") or "area")
        if measurement_type not in ("area", "distance", "perimeter"):
            measurement_type = "area"

        if measurement_type == "area":
            points = [
                [centre[0] - 0.02, centre[1] - 0.02],
                [centre[0] + 0.02, centre[1] - 0.02],
                [centre[0] + 0.02, centre[1] + 0.02],
                [centre[0] - 0.02, centre[1] + 0.02],
            ]
            value = calculate_polygon_area_km2(points)
            unit = "km²"
        elif measurement_type == "perimeter":
            points = [
                [centre[0] - 0.015, centre[1] - 0.01],
                [centre[0] + 0.015, centre[1] - 0.01],
                [centre[0] + 0.02, centre[1] + 0.015],
                [centre[0] - 0.01, centre[1] + 0.02],
            ]
            closed = points + [points[0]]
            value = calculate_polyline_distance_km(closed)
            unit = "km"
        else:  # distance
            points = [[centre[0] - 0.01, centre[1]], [centre[0] + 0.01, centre[1]]]
            value = calculate_polyline_distance_km(points)
            unit = "km"

        # ``_round`` here only affects formatting.
        value = _round(value, 3)
        return MeasurementPayload(
            measurement_type=measurement_type,
            value=value,
            unit=unit,
            points=points,
        )


# ── Registry ───────────────────────────────────────────────────────────────

class ModelRegistry:
    """Maps canonical task ids to model backends."""

    def __init__(self) -> None:
        self._backends: Dict[str, ModelBackend] = {}

    def register(self, backend: ModelBackend) -> None:
        if backend.task in self._backends:
            raise ValueError(f"A model is already registered for task '{backend.task}'")
        self._backends[backend.task] = backend

    def get(self, task: str) -> ModelBackend:
        try:
            return self._backends[task]
        except KeyError:
            raise KeyError(
                f"No model registered for task '{task}'. "
                f"Available tasks: {sorted(self._backends)}"
            ) from None

    def tasks(self) -> List[str]:
        return sorted(self._backends)

    def all(self) -> Dict[str, ModelBackend]:
        return dict(self._backends)


model_registry = ModelRegistry()

# Register the deterministic mock backends (this is the "mock model backend"
# seam of Phase 1: load/health work, predict returns typed deterministic
# payloads, and no weights or network are involved).
model_registry.register(ObjectDetectionMockBackend())
model_registry.register(WaterDetectionMockBackend())
model_registry.register(LandCoverClassifierBackend())
model_registry.register(ChangeDetectionMockBackend())
model_registry.register(VegetationMockBackend())
model_registry.register(MeasurementMockBackend())
