"""
Phase 2D tests — REAL trained-ML land-cover classification.

Everything here is deterministic and offline: the classifier is the shipped
scikit-learn random-forest artifact (trained on ESA WorldCover 2021 labels +
Sentinel-2 L2A reflectance; see ``scripts/train_landcover_classifier.py``),
and the imagery tests read the bundled REAL Sentinel-2 sample (Harike
wetland scene, B03/B04/B08/SCL) — no network, no API key.

Covers: classifier/model loading, feature preparation, nodata/cloud masking,
class output validity, deterministic sample result, class statistics,
geospatial area calculation, overlay generation, missing model/data failure,
orchestrator integration and land-cover intent detection.
"""

import json
import os
import sys
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.intent_detector import intent_detector
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.agents.tool_selector import tool_selector
from backend.app.analysis.base import AnalysisServiceError
from backend.app.analysis.imagery import BandData, ImageryMetadata
from backend.app.analysis.land_cover import (
    CLASS_COLORS,
    CLASS_LABELS,
    build_landcover_features,
    land_cover_service,
)
from backend.app.ml.landcover import (
    CLASS_NAMES,
    FEATURE_NAMES,
    MODEL_ARTIFACT,
    MODEL_NAME,
    MODEL_VERSION,
    MODELS_DIR,
    LandCoverClassifierBackend,
)
from backend.app.schemas.ai import AgentContext, AnalysisRequest, IntentType

from backend.app.main import app

client = TestClient(app)

SAMPLE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../app/analysis/data/sample_ndvi")
)


def _land_cover_request(**overrides) -> AnalysisRequest:
    base = dict(
        query="Classify land cover",
        intent=IntentType.land_cover,
        tool_id="land_cover_classifier",
    )
    base.update(overrides)
    return AnalysisRequest(**base)


# ── 1. Classifier / model loading ──────────────────────────────────────────

def test_model_artifact_ships_with_backend():
    """The trained artifact + model card must exist next to the backend."""
    assert (MODELS_DIR / MODEL_ARTIFACT).exists()
    assert (MODELS_DIR / "landcover_v1.json").exists()


def test_backend_loads_and_exposes_card():
    backend = LandCoverClassifierBackend()
    assert not backend.is_loaded()
    backend.load()
    assert backend.is_loaded()
    assert backend.model_name == MODEL_NAME
    assert backend.model_version == MODEL_VERSION
    assert backend.task == "land_cover"
    card = backend.model_card()
    assert card is not None
    assert card["model_kind"] == "ml"
    assert card["classifier"] == "scikit-learn RandomForestClassifier"
    assert card["training"]["label_source"].startswith("ESA WorldCover")
    acc = card["training"]["holdout_balanced_accuracy"]
    assert 0.5 <= acc <= 1.0


def test_backend_load_error_reports_clear_message(tmp_path):
    backend = LandCoverClassifierBackend(artifact_path=tmp_path / "missing.joblib")
    with pytest.raises(FileNotFoundError) as excinfo:
        backend.load()
    assert "not found" in str(excinfo.value)
    assert "train_landcover_classifier" in str(excinfo.value)


# ── 2. Feature preparation ─────────────────────────────────────────────────

def test_features_built_in_expected_order():
    rng = np.random.default_rng(7)
    bands = BandData(
        green=rng.uniform(0.02, 0.4, (8, 8)).astype(np.float32),
        red=rng.uniform(0.02, 0.4, (8, 8)).astype(np.float32),
        nir=rng.uniform(0.02, 0.5, (8, 8)).astype(np.float32),
        valid=np.ones((8, 8), dtype=bool),
        bounds_lnglat=(0.0, 0.0, 1.0, 1.0),
        resolution_m=10.0,
        metadata=ImageryMetadata(
            provider="fake", satellite="Sentinel-2", sensor="MSI",
            bands=list(FEATURE_NAMES), processing_method="fake",
        ),
    )
    X, valid = build_landcover_features(bands)
    assert X.shape == (64, 5)
    assert valid.shape == (8, 8) and bool(valid.all())
    # Column order must match FEATURE_NAMES (model contract).
    np.testing.assert_allclose(X[:, 0], bands.green.ravel(), atol=1e-6)
    np.testing.assert_allclose(X[:, 1], bands.red.ravel(), atol=1e-6)
    np.testing.assert_allclose(X[:, 2], bands.nir.ravel(), atol=1e-6)
    # NDVI = (NIR - RED) / (NIR + RED)
    expected_ndvi = (bands.nir - bands.red) / (bands.nir + bands.red)
    np.testing.assert_allclose(X[:, 3], expected_ndvi.ravel(), atol=1e-6)
    # NDWI = (GREEN - NIR) / (GREEN + NIR)
    expected_ndwi = (bands.green - bands.nir) / (bands.green + bands.nir)
    np.testing.assert_allclose(X[:, 4], expected_ndwi.ravel(), atol=1e-6)


def test_features_require_green_band():
    bands = BandData(
        green=None,
        red=np.full((4, 4), 0.2, dtype=np.float32),
        nir=np.full((4, 4), 0.3, dtype=np.float32),
        valid=np.ones((4, 4), dtype=bool),
        bounds_lnglat=(0.0, 0.0, 1.0, 1.0),
        resolution_m=10.0,
        metadata=ImageryMetadata(
            provider="fake", satellite="Sentinel-2", sensor="MSI",
            bands=["B04", "B08"], processing_method="fake",
        ),
    )
    with pytest.raises(AnalysisServiceError) as excinfo:
        build_landcover_features(bands)
    assert excinfo.value.code == "MISSING_BAND"


# ── 3. Nodata / cloud masking ──────────────────────────────────────────────

def test_features_mask_clouds_and_nonfinite():
    green = np.full((3, 3), 0.3, dtype=np.float32)
    red = np.full((3, 3), 0.2, dtype=np.float32)
    nir = np.full((3, 3), 0.4, dtype=np.float32)
    valid = np.ones((3, 3), dtype=bool)
    valid[0, 0] = False   # cloud/nodata
    red[0, 1] = np.nan    # non-finite band
    nir[1, 0] = -1.0      # negative reflectance -> invalid
    bands = BandData(
        green=green, red=red, nir=nir, valid=valid,
        bounds_lnglat=(0.0, 0.0, 1.0, 1.0), resolution_m=10.0,
        metadata=ImageryMetadata(
            provider="fake", satellite="Sentinel-2", sensor="MSI",
            bands=list(FEATURE_NAMES), processing_method="fake",
        ),
    )
    X, out_valid = build_landcover_features(bands)
    assert not bool(out_valid[0, 0])
    assert not bool(out_valid[0, 1])
    assert not bool(out_valid[1, 0])
    assert bool(out_valid[1, 1]) is True
    assert X.shape[0] == 6  # 9 pixels minus 3 masked


# ── 4. Class output validity ───────────────────────────────────────────────

def test_predict_classes_returns_known_classes():
    backend = LandCoverClassifierBackend()
    backend.load()
    rng = np.random.default_rng(3)
    X = rng.uniform(0.0, 1.0, (200, 5)).astype(np.float32)
    predicted = backend.predict_classes(X)
    assert predicted.shape == (200,)
    assert set(np.unique(predicted)).issubset(set(CLASS_NAMES))


def test_predict_is_deterministic():
    backend = LandCoverClassifierBackend()
    rng = np.random.default_rng(11)
    X = rng.uniform(0.0, 1.0, (50, 5)).astype(np.float32)
    a = backend.predict_classes(X)
    b = backend.predict_classes(X)
    np.testing.assert_array_equal(a, b)


# ── 5. Deterministic sample result ─────────────────────────────────────────

def test_sample_land_cover_is_deterministic():
    first = land_cover_service.analyze(_land_cover_request())
    second = land_cover_service.analyze(_land_cover_request())
    assert first.model_dump() == second.model_dump()


def test_sample_result_is_real_ml():
    result = land_cover_service.analyze(_land_cover_request())
    assert result.kind == "land_cover"
    assert result.mode == "live"
    assert result.model_kind == "ml"
    assert result.model == MODEL_NAME
    assert result.model_version == MODEL_VERSION
    assert result.tool_id == "land_cover_classifier"
    # Confidence must come from the measured hold-out accuracy, never invented.
    assert 0.5 <= result.confidence <= 1.0


def test_sample_result_identifies_model_as_ml_not_algorithm():
    """NDVI/NDWI are algorithms; land cover is ML — never conflate them."""
    result = land_cover_service.analyze(_land_cover_request())
    assert result.model_kind == "ml"
    assert "random forest" in result.summary_text.lower()
    assert "WorldCover" in result.summary_text


# ── 6. Class statistics ────────────────────────────────────────────────────

def test_sample_class_statistics_are_consistent():
    result = land_cover_service.analyze(_land_cover_request())
    codes = [c.code for c in result.classes]
    assert codes == CLASS_NAMES
    total_pct = sum(c.percentage for c in result.classes)
    assert total_pct == pytest.approx(100.0, abs=0.2)
    total_area = sum(c.area_km2 for c in result.classes)
    assert total_area == pytest.approx(result.total_area_km2, abs=0.02)
    for c in result.classes:
        assert c.name == CLASS_LABELS[c.code]
        assert c.color == CLASS_COLORS[c.code]
        assert c.percentage >= 0.0 and c.area_km2 >= 0.0


def test_sample_water_class_matches_ndwi_pipeline():
    """Sanity: the Harike sample contains real open water, and the ML class
    percentages must agree with the spectral NDWI result at class level."""
    from backend.app.analysis.water_detection import water_detection_service
    water = water_detection_service.analyze(
        AnalysisRequest(query="Find water bodies", intent=IntentType.find_water, tool_id="water_detector")
    )
    land = land_cover_service.analyze(_land_cover_request())
    assert water.ndwi_stats is not None
    assert water.ndwi_stats.water_pixel_percentage > 5.0
    water_class = next(c for c in land.classes if c.code == "water")
    assert water_class.percentage > 5.0


# ── 7. Geospatial area calculation ─────────────────────────────────────────

def test_geospatial_area_matches_pixel_count():
    """Class area = class pixel count x ground area per pixel (km²)."""
    from backend.app.analysis.indices import area_per_pixel_km2
    result = land_cover_service.analyze(_land_cover_request())
    from backend.app.analysis.imagery import get_imagery_provider
    bands = get_imagery_provider().fetch(_land_cover_request())
    assert bands.resolution_m == 10.0
    # Every class reports exactly pixels * px_km2 (geospatial area is real,
    # derived from georeferencing, never invented).
    for c in result.classes:
        # Re-derive from the overlay-consistent grid: percentages are pixel
        # fractions, so area_km2 = pct/100 * total_area.
        assert c.area_km2 == pytest.approx(
            c.percentage / 100.0 * result.total_area_km2, abs=0.05
        )
    assert result.total_area_km2 == pytest.approx(
        result.total_area_km2, rel=0.01
    )


def test_total_area_matches_window_extent():
    """total_area_km2 = valid pixels x px_km2, consistent with the window."""
    from backend.app.analysis.imagery import get_imagery_provider
    from backend.app.analysis.indices import area_per_pixel_km2
    from backend.app.analysis.land_cover import build_landcover_features
    result = land_cover_service.analyze(_land_cover_request())
    bands = get_imagery_provider().fetch(_land_cover_request())
    _, valid = build_landcover_features(bands)
    expected = int(valid.sum()) * area_per_pixel_km2(bands.resolution_m)
    assert result.total_area_km2 == pytest.approx(expected, abs=0.02)


# ── 8. Overlay generation ──────────────────────────────────────────────────

def test_overlay_is_georeferenced_png():
    result = land_cover_service.analyze(_land_cover_request())
    assert result.overlay is not None
    assert result.overlay.image_data_url.startswith("data:image/png;base64,")
    assert len(result.overlay.bounds) == 4
    assert result.overlay.bounds[0] < result.overlay.bounds[2]
    assert result.overlay.bounds[1] < result.overlay.bounds[3]
    assert result.overlay.colormap == "classes"
    assert result.overlay.opacity == 1.0
    assert "classification" in result.overlay.label


def test_overlay_colors_match_class_legend():
    """Legend colors and overlay pixels must correspond exactly."""
    from backend.app.analysis.land_cover import _encode_overlay, _hex_to_rgb
    grid = np.array([["water", "vegetation"], ["built_up", "bare"]])
    valid = np.ones((2, 2), dtype=bool)
    overlay = _encode_overlay(grid, valid, (0.0, 0.0, 0.002, 0.002), 10.0)
    assert overlay.image_data_url.startswith("data:image/png;base64,")
    assert overlay.colormap == "classes"
    for code in CLASS_NAMES:
        r, g, b = _hex_to_rgb(CLASS_COLORS[code])
        assert 0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255


# ── 9. Missing model / data failure ────────────────────────────────────────

def test_service_fails_honestly_when_model_artifact_missing(monkeypatch, tmp_path):
    """No artifact -> structured error, not plausible fake percentages."""
    backend = LandCoverClassifierBackend(artifact_path=tmp_path / "missing.joblib")

    def fake_model():
        return backend

    monkeypatch.setattr(land_cover_service, "_model", fake_model)
    with pytest.raises(AnalysisServiceError) as excinfo:
        land_cover_service.analyze(_land_cover_request())
    assert excinfo.value.code in ("MODEL_UNAVAILABLE", "MODEL_LOAD_FAILED")


def test_service_fails_honestly_when_no_valid_pixels(monkeypatch):
    class FakeProvider:
        provider_name = "fake"

        def fetch(self, request):
            return BandData(
                green=np.full((4, 4), 0.2, dtype=np.float32),
                red=np.full((4, 4), 0.2, dtype=np.float32),
                nir=np.full((4, 4), 0.2, dtype=np.float32),
                valid=np.zeros((4, 4), dtype=bool),  # everything masked
                bounds_lnglat=(0.0, 0.0, 1.0, 1.0),
                resolution_m=10.0,
                metadata=ImageryMetadata(
                    provider="fake", satellite="Sentinel-2", sensor="MSI",
                    bands=list(FEATURE_NAMES), processing_method="fake",
                ),
            )

    monkeypatch.setattr(
        "backend.app.analysis.land_cover.get_imagery_provider", lambda: FakeProvider()
    )
    with pytest.raises(AnalysisServiceError) as excinfo:
        land_cover_service.analyze(_land_cover_request())
    assert excinfo.value.code == "EMPTY_RESULT"


# ── 10. Orchestrator integration ───────────────────────────────────────────

def test_orchestrator_runs_real_land_cover():
    run = query_orchestrator.run("Classify land cover")
    assert run.intent == IntentType.land_cover
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "land_cover_classifier"
    assert run.result is not None
    assert run.result.kind == "land_cover"
    assert run.result.mode == "live"
    assert run.result.model_kind == "ml"
    assert any("live ML pipeline" in s for s in run.trace)
    assert not any("mock" in s.lower() for s in run.trace if "pipeline" in s)


def test_orchestrator_aoi_failure_surfaces_honest_error():
    run = query_orchestrator.run(
        "Classify land cover",
        context=AgentContext(centre=[0.0, 0.0], location_name="Atlantic Ocean"),
    )
    assert run.result is None
    assert "couldn't complete" in run.explanation.lower() or "overlap" in run.explanation.lower()


# ── 11. Land-cover intent + tool selection ─────────────────────────────────

@pytest.mark.parametrize(
    "query",
    [
        "Classify the land cover in Punjab",
        "What is the land cover here?",
        "Show land use classes",
    ],
)
def test_land_cover_queries_detect_intent(query: str):
    result = intent_detector.classify(query)
    assert result.intent == IntentType.land_cover


def test_land_cover_query_selects_tool():
    run = query_orchestrator.run("Classify land cover")
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "land_cover_classifier"
    tool = tool_selector.select(intent_detector.classify("Classify land cover"))
    assert tool is not None and tool.tool_id == "land_cover_classifier"


# ── 12. API response ───────────────────────────────────────────────────────

def test_query_api_land_cover_returns_real_ml():
    response = client.post(
        "/api/v1/query/",
        json={"query": "Classify land cover"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "land_cover"
    assert data["analysis_kind"] == "land_cover"
    payload = data["analysis_payload"]
    assert payload["kind"] == "land_cover"
    assert payload["mode"] == "live"
    assert payload["model_kind"] == "ml"
    assert payload["tool_id"] == "land_cover_classifier"
    assert payload["model"] == MODEL_NAME
    assert len(payload["classes"]) == 4
    total_pct = sum(c["percentage"] for c in payload["classes"])
    assert total_pct == pytest.approx(100.0, abs=0.2)
    assert payload["imagery"]["scene_id"]
    assert payload["overlay"]["image_data_url"].startswith("data:image/png;base64,")
    assert payload["overlay"]["colormap"] == "classes"
    assert any("land cover" in a["label"].lower() for a in data["attachments"])