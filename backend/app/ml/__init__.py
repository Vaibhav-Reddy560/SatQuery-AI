"""
ML model-serving layer: model protocol (``base.py``) and the task -> model
registry with deterministic mock backends (``registry.py``).

Phase 1 registers only mock backends. Real (open-source / free-tier) models
plug in behind the same task keys in later phases.
"""

from backend.app.ml.base import ModelBackend
from backend.app.ml.registry import (
    model_registry,
    TASK_OBJECT_DETECTION,
    TASK_WATER_DETECTION,
    TASK_LAND_COVER,
    TASK_CHANGE_DETECTION,
    TASK_VEGETATION,
    TASK_MEASUREMENT,
)

__all__ = [
    "ModelBackend",
    "model_registry",
    "TASK_OBJECT_DETECTION",
    "TASK_WATER_DETECTION",
    "TASK_LAND_COVER",
    "TASK_CHANGE_DETECTION",
    "TASK_VEGETATION",
    "TASK_MEASUREMENT",
]
