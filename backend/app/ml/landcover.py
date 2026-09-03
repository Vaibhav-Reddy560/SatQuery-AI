"""
Real land-cover classifier backend (Phase 2D).

Wraps the trained scikit-learn RandomForestClassifier artifact shipped under
``backend/app/ml/models/``. The artifact was fitted on real open data
(ESA WorldCover 2021 labels + Sentinel-2 L2A reflectance; see
``scripts/train_landcover_classifier.py`` for full provenance). This is a
genuine trained ML model — not NDVI/NDWI-style radiometric math, and not a
hand-written rule system.

The backend exposes ``predict_classes(X)``: the analysis service prepares the
per-pixel feature matrix (B03/B04/B08 reflectance + NDVI + NDWI over
cloud-masked valid pixels) and receives back a per-pixel class label array.
The generic ``predict(request)`` protocol method is intentionally not
implemented here — imagery access lives in the analysis layer, so the
service, not the backend, drives the full pipeline.
"""

import json
import os
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np

from backend.app.ml.base import ModelBackend
from backend.app.schemas.ai import AnalysisRequest, ModelStatus

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_ARTIFACT = "landcover_rf_v1.joblib"
MODEL_CARD = "landcover_v1.json"

MODEL_NAME = "satquery-landcover-randomforest-v1"
MODEL_VERSION = "1.0.0"

# The four coarse classes the model was trained to separate (order matches
# the shipped legend/overlay palette).
CLASS_NAMES: List[str] = ["water", "vegetation", "built_up", "bare"]

FEATURE_NAMES = ["B03 green", "B04 red", "B08 nir", "NDVI", "NDWI"]


class LandCoverClassifierBackend(ModelBackend):
    """Scikit-learn random-forest land-cover classifier (offline, CPU)."""

    task = "land_cover"
    model_name = MODEL_NAME
    model_version = MODEL_VERSION
    device = "cpu"

    def __init__(self, artifact_path: Optional[Path] = None) -> None:
        self.artifact_path = Path(artifact_path) if artifact_path else MODELS_DIR / MODEL_ARTIFACT
        self._clf = None
        self._meta: Optional[dict] = None
        self._load_error: Optional[str] = None

    def load(self) -> None:
        """Load the trained classifier and its model card from disk."""
        if self._clf is not None:
            return
        if not self.artifact_path.exists():
            self._load_error = (
                f"Land-cover model artifact not found at {self.artifact_path}. "
                f"Run: python scripts/train_landcover_classifier.py"
            )
            raise FileNotFoundError(self._load_error)
        try:
            self._clf = joblib.load(self.artifact_path)
        except Exception as exc:  # noqa: BLE001 - surface a clear load error
            self._load_error = f"Failed to load land-cover model artifact: {exc}"
            raise RuntimeError(self._load_error) from exc
        card_path = self.artifact_path.with_name(MODEL_CARD)
        if card_path.exists():
            try:
                with open(card_path, "r", encoding="utf-8") as fh:
                    self._meta = json.load(fh)
            except (OSError, ValueError):
                self._meta = None

    def is_loaded(self) -> bool:
        return self._clf is not None

    def model_card(self) -> Optional[dict]:
        return self._meta

    def predict_classes(self, X: np.ndarray) -> np.ndarray:
        """
        Classify a per-pixel feature matrix.

        ``X`` is (n_valid_pixels, 5) float32 in feature order
        [B03, B04, B08, NDVI, NDWI] (see FEATURE_NAMES). Returns an array of
        class-name strings (subset of CLASS_NAMES). Deterministic: the forest
        is CPU-single-threaded with a fixed seed.
        """
        if self._clf is None:
            self.load()
        return np.asarray(self._clf.predict(np.asarray(X, dtype=np.float32)))

    # ── ModelBackend protocol (not used by the analysis service) ──────────

    def predict(self, request: AnalysisRequest) -> object:  # pragma: no cover
        raise NotImplementedError(
            "LandCoverClassifierBackend.predict(request) is not used: the "
            "land-cover analysis service prepares imagery features and calls "
            "predict_classes(X) instead."
        )

    def health(self) -> ModelStatus:
        return ModelStatus(
            model_name=self.model_name,
            model_version=self.model_version,
            task=self.task,
            status="ready" if self._clf is not None else "not_loaded",
            device=self.device,
        )


land_cover_classifier_backend = LandCoverClassifierBackend()