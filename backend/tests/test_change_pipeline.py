"""
Phase 2E tests — REAL multi-temporal change detection.

Everything here is deterministic and offline: the imagery comes from the
bundled REAL Sentinel-2 bi-temporal sample (``sample_change/before`` =
S2B_43RDQ_20251202 dry season; ``sample_change/after`` = S2B_43RDQ_20260829
monsoon) — the same AOI on one aligned 10 m UTM grid. No network, no API key.

Covers: before/after retrieval, temporal metadata, same-AOI validation,
raster alignment, SCL/cloud masking, dual-date valid-pixel intersection,
delta calculation, threshold classification, loss/gain/unchanged classes,
class statistics, geospatial area, deterministic sample result, overlay
generation + class/color consistency, missing imagery errors, no-valid-
overlap handling, orchestrator integration, intent detection and structured
failures.
"""

import json
import os
import sys

import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.intent_detector import intent_detector
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.agents.tool_selector import tool_selector
from backend.app.analysis.base import AnalysisServiceError
from backend.app.analysis.change import (
    CHANGE_CLASS_COLORS,
    CHANGE_CLASS_LABELS,
    DEFAULT_CHANGE_THRESHOLD,
    align_pair,
    change_statistics,
    classify_change,
    compute_delta_ndvi,
    encode_change_overlay,
    resolve_change_threshold,
)
from backend.app.analysis.change_detection import change_detection_service
from backend.app.analysis.imagery import (
    BandData,
    ImageryMetadata,
    SampleSentinel2Provider,
)
from backend.app.schemas.ai import AgentContext, AnalysisRequest, IntentType

from backend.app.main import app

client = TestClient(app)

SAMPLE_CHANGE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../app/analysis/data/sample_change")
)


def _change_request(**overrides) -> AnalysisRequest:
    base = dict(
        query="What changed between December 2025 and August 2026?",
        intent=IntentType.change_detection,
        tool_id="change_detector",
    )
    base.update(overrides)
    return AnalysisRequest(**base)


# ── 1. Before/after imagery retrieval ──────────────────────────────────────

def test_sample_pair_retrieval():
    provider = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    pair = provider.fetch_pair(_change_request())
    assert pair.before.metadata.scene_id == "S2B_43RDQ_20251202_0_L2A"
    assert pair.after.metadata.scene_id == "S2B_43RDQ_20260829_0_L2A"
    assert pair.before.red.shape == pair.after.red.shape


def test_pair_contains_required_bands():
    provider = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    pair = provider.fetch_pair(_change_request())
    for date in (pair.before, pair.after):
        assert date.red is not None and date.nir is not None and date.green is not None
        assert any("B04" in b for b in date.metadata.bands)
        assert any("B08" in b for b in date.metadata.bands)


# ── 2. Temporal metadata ───────────────────────────────────────────────────

def test_invalid_temporal_order_raises():
    """from_date after to_date must fail structurally, never silently swap."""
    from backend.app.analysis.imagery import InvalidAOI, Sentinel2EarthSearchProvider
    from backend.app.schemas.ai import DateRange

    provider = Sentinel2EarthSearchProvider()
    req = _change_request()
    req = AnalysisRequest(
        **{
            **req.model_dump(),
            "centre": [75.0092, 31.1162],
            "date_range": DateRange(from_date="2026-08-01", to_date="2025-01-01"),
        }
    )
    # The ordering guard runs before any network call, so an inverted range
    # raises InvalidAOI immediately.
    with pytest.raises(InvalidAOI):
        provider.fetch_pair(req)


def test_pair_temporal_metadata():
    provider = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    pair = provider.fetch_pair(_change_request())
    assert pair.before.metadata.acquisition_date
    assert pair.after.metadata.acquisition_date
    assert pair.before.metadata.acquisition_date < pair.after.metadata.acquisition_date
    assert pair.before.metadata.cloud_cover_percent is not None
    assert pair.before.metadata.crs == "EPSG:32643"
    assert pair.before.metadata.resolution_m == 10.0


# ── 3. Same-AOI validation ─────────────────────────────────────────────────

def test_pair_same_aoi():
    provider = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    pair = provider.fetch_pair(_change_request())
    assert pair.before.bounds_lnglat == pair.after.bounds_lnglat


def test_pair_outside_sample_raises():
    provider = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    with pytest.raises(Exception) as excinfo:
        provider.fetch_pair(
            _change_request(centre=[0.0, 0.0], location_name="Atlantic Ocean")
        )
    assert "overlap" in str(excinfo.value).lower()


# ── 4. Raster alignment ────────────────────────────────────────────────────

def test_pair_is_pixel_aligned():
    provider = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    pair = provider.fetch_pair(_change_request())
    assert pair.before.crs == pair.after.crs
    assert pair.before.transform == pair.after.transform
    assert pair.before.red.shape == pair.after.red.shape


def test_align_pair_passthrough_identical_grids():
    a = np.array([[0.1, 0.2], [0.3, 0.4]], dtype=np.float32)
    va = np.ones((2, 2), dtype=bool)
    b, c, valid = align_pair(
        a, a.copy(), va, va,
        "EPSG:32643", "EPSG:32643",
        (10.0, 0.0, 0.0, 0.0, -10.0, 0.0),
        (10.0, 0.0, 0.0, 0.0, -10.0, 0.0),
    )
    np.testing.assert_array_equal(b, a)
    np.testing.assert_array_equal(c, a)
    assert bool(valid.all())


def test_align_pair_crs_mismatch_fails_structurally():
    a = np.ones((2, 2), dtype=np.float32)
    with pytest.raises(AnalysisServiceError) as excinfo:
        align_pair(a, a, np.ones((2, 2), bool), np.ones((2, 2), bool),
                   "EPSG:32643", "EPSG:32642",
                   (10.0, 0.0, 0.0, 0.0, -10.0, 0.0),
                   (10.0, 0.0, 0.0, 0.0, -10.0, 0.0))
    assert excinfo.value.code == "INCOMPATIBLE_GRID"


# ── 5. SCL / cloud masking ─────────────────────────────────────────────────

def test_masking_intersects_valid_pixels():
    """Pixels valid in only one date must never enter the comparison."""
    red_b = np.array([[0.2, 0.3], [0.4, 0.5]], dtype=np.float32)
    nir_b = np.array([[0.4, 0.6], [0.8, 1.0]], dtype=np.float32)
    red_a = np.array([[0.3, 0.3], [0.4, 0.5]], dtype=np.float32)
    nir_a = np.array([[0.5, 0.6], [0.8, 1.0]], dtype=np.float32)
    valid_b = np.array([[True, True], [True, True]])
    valid_a = np.array([[True, False], [True, True]])  # top-right cloudy in after
    delta, valid_both = compute_delta_ndvi(red_b, nir_b, valid_b, red_a, nir_a, valid_a)
    assert valid_both.tolist() == [[True, False], [True, True]]
    assert np.isnan(delta[0, 1])


# ── 6. Dual-date valid-pixel intersection ──────────────────────────────────

def test_no_overlap_yields_empty_stats():
    ndvi = np.array([[0.5, 0.5], [0.5, 0.5]], dtype=np.float32)
    valid = np.zeros((2, 2), dtype=bool)
    classes = classify_change(ndvi, valid, 0.15)
    assert (classes == "").all()
    with pytest.raises(AnalysisServiceError) as excinfo:
        change_statistics(ndvi, valid, classes, 10.0)
    assert excinfo.value.code == "NO_VALID_OVERLAP"


# ── 7. Delta calculation ───────────────────────────────────────────────────

def test_delta_ndvi_formula():
    """delta = NDVI_after - NDVI_before, verified against the textbook NDVI."""
    from backend.app.analysis.indices import compute_ndvi

    red_b = np.array([[0.2]], dtype=np.float32)
    nir_b = np.array([[0.6]], dtype=np.float32)   # NDVI = 0.5
    red_a = np.array([[0.2]], dtype=np.float32)
    nir_a = np.array([[0.8]], dtype=np.float32)   # NDVI = 0.6
    delta, valid = compute_delta_ndvi(red_b, nir_b, np.ones((1, 1), bool),
                                      red_a, nir_a, np.ones((1, 1), bool))
    ndvi_b, _ = compute_ndvi(red_b, nir_b)
    ndvi_a, _ = compute_ndvi(red_a, nir_a)
    assert float(delta[0, 0]) == pytest.approx(float(ndvi_a[0, 0]) - float(ndvi_b[0, 0]))
    assert float(delta[0, 0]) == pytest.approx(0.1, abs=1e-5)


# ── 8. Threshold classification ────────────────────────────────────────────

def test_classify_change_thresholds():
    delta = np.array([[0.2, -0.2, 0.05, -0.05]], dtype=np.float32)
    valid = np.ones((1, 4), dtype=bool)
    classes = classify_change(delta, valid, 0.15)
    assert classes[0, 0] == "vegetation_gain"
    assert classes[0, 1] == "vegetation_loss"
    assert classes[0, 2] == "unchanged"
    assert classes[0, 3] == "unchanged"


def test_classify_change_configurable_threshold():
    delta = np.array([[0.12]], dtype=np.float32)
    valid = np.ones((1, 1), dtype=bool)
    loose = classify_change(delta, valid, 0.1)
    strict = classify_change(delta, valid, 0.2)
    assert loose[0, 0] == "vegetation_gain"
    assert strict[0, 0] == "unchanged"


def test_default_threshold_is_explicit():
    assert DEFAULT_CHANGE_THRESHOLD == 0.15
    req = _change_request()
    assert resolve_change_threshold(req) == 0.15


def test_threshold_override_via_request():
    req = _change_request(thresholds={"ndvi_delta": 0.25})
    assert resolve_change_threshold(req) == 0.25


# ── 9. Loss/gain/unchanged classes ─────────────────────────────────────────

def test_class_names_and_labels_consistent():
    assert set(CHANGE_CLASS_LABELS) == {"unchanged", "vegetation_loss", "vegetation_gain"}
    assert set(CHANGE_CLASS_COLORS) == set(CHANGE_CLASS_LABELS)


# ── 10. Class statistics ───────────────────────────────────────────────────

def test_change_statistics_known_values():
    delta = np.array([[0.3, -0.3, 0.0]], dtype=np.float32)
    valid = np.ones(3, dtype=bool)
    classes = classify_change(delta, valid, 0.15)
    stats = change_statistics(delta, valid, classes, 10.0)
    assert stats.valid_pixel_count == 3
    assert stats.loss_pixel_count == 1
    assert stats.gain_pixel_count == 1
    assert stats.unchanged_pixel_count == 1
    assert stats.changed_pixel_count == 2
    assert stats.loss_percentage == pytest.approx(100.0 / 3.0, abs=0.01)
    assert stats.gain_percentage == pytest.approx(100.0 / 3.0, abs=0.01)
    assert stats.unchanged_percentage == pytest.approx(100.0 / 3.0, abs=0.01)
    assert stats.changed_percentage == pytest.approx(200.0 / 3.0, abs=0.01)
    # 10 m pixels -> 1e-4 km2 each
    assert stats.total_area_km2 == pytest.approx(3e-4)
    assert stats.loss_area_km2 == pytest.approx(1e-4)


# ── 11. Geospatial area calculation ────────────────────────────────────────

def test_change_area_uses_resolution():
    delta = np.array([[0.5, 0.5]], dtype=np.float32)
    valid = np.ones((1, 2), dtype=bool)
    classes = classify_change(delta, valid, 0.15)
    stats_10 = change_statistics(delta, valid, classes, 10.0)
    stats_20 = change_statistics(delta, valid, classes, 20.0)
    assert stats_10.gain_area_km2 == pytest.approx(2e-4)
    assert stats_20.gain_area_km2 == pytest.approx(8e-4)  # 20 m pixels -> 4x area


# ── 12. Deterministic bundled temporal sample ──────────────────────────────

def test_sample_change_is_deterministic():
    first = change_detection_service.analyze(_change_request())
    second = change_detection_service.analyze(_change_request())
    assert first.model_dump() == second.model_dump()


def test_sample_has_real_temporal_signal():
    """The bundled pair must genuinely differ (monsoon green-up)."""
    result = change_detection_service.analyze(_change_request())
    assert result.change_stats is not None
    assert result.change_stats.changed_percentage > 10.0
    assert result.change_stats.gain_percentage > result.change_stats.loss_percentage


# ── 13. Overlay generation ─────────────────────────────────────────────────

def test_overlay_is_georeferenced_png():
    result = change_detection_service.analyze(_change_request())
    assert result.overlay is not None
    assert result.overlay.image_data_url.startswith("data:image/png;base64,")
    assert len(result.overlay.bounds) == 4
    assert result.overlay.bounds[0] < result.overlay.bounds[2]
    assert result.overlay.bounds[1] < result.overlay.bounds[3]
    assert result.overlay.colormap == "classes"
    assert result.overlay.opacity == 0.8


# ── 14. Overlay color/class consistency ────────────────────────────────────

def test_overlay_uses_only_valid_class_colors():
    """Decode the overlay PNG and verify every opaque pixel is one of the
    three change-class colors."""
    import base64
    import io

    from PIL import Image

    result = change_detection_service.analyze(_change_request())
    assert result.overlay is not None
    b64 = result.overlay.image_data_url.split(",", 1)[1]
    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")
    arr = np.asarray(img)
    palette = np.array(
        [[int(c[i : i + 2], 16) for i in (1, 3, 5)] for c in CHANGE_CLASS_COLORS.values()],
        dtype=np.uint8,
    )
    opaque = arr[..., 3] == 255
    if opaque.any():
        px = arr[opaque][:, :3]
        matches = [np.all(px == p, axis=1).sum() for p in palette]
        assert sum(matches) == int(opaque.sum())
    # The legend colors and the overlay share the same central mapping.
    assert set(CHANGE_CLASS_COLORS.values()) == {
        "#6b7280", "#dc2626", "#22c55e",
    }


# ── 15. Missing before imagery ─────────────────────────────────────────────

def test_missing_temporal_directory_raises(monkeypatch, tmp_path):
    provider = SampleSentinel2Provider(temporal_directory=tmp_path / "nonexistent")
    with pytest.raises(Exception) as excinfo:
        provider.fetch_pair(_change_request())
    assert "sample" in str(excinfo.value).lower() or "missing" in str(excinfo.value).lower()


# ── 16. Missing after imagery ──────────────────────────────────────────────

def test_fetch_pair_missing_after_raises(monkeypatch, tmp_path):
    """Only 'before' present -> structured error, no fake pair."""
    before = tmp_path / "before"
    before.mkdir(parents=True)
    # Reuse real before bands + a metadata.json.
    real = SampleSentinel2Provider(temporal_directory=SAMPLE_CHANGE_DIR)
    for name in ("B03.tif", "B04.tif", "B08.tif", "SCL.tif", "metadata.json"):
        import shutil
        shutil.copy(os.path.join(SAMPLE_CHANGE_DIR, "before", name), before / name)
    provider = SampleSentinel2Provider(temporal_directory=str(tmp_path))
    with pytest.raises(Exception) as excinfo:
        provider.fetch_pair(_change_request())
    assert "after" in str(excinfo.value).lower() or "missing" in str(excinfo.value).lower()


# ── 17. No valid overlapping pixels ────────────────────────────────────────

def test_service_no_valid_overlap_fails_honestly(monkeypatch):
    class FakePairProvider:
        provider_name = "fake"

        def fetch_pair(self, request):
            def band(v):
                return np.full((4, 4), v, dtype=np.float32)

            meta = ImageryMetadata(
                provider="fake", satellite="Sentinel-2", sensor="MSI",
                bands=["B04 (RED)", "B08 (NIR)"], processing_method="fake",
                acquisition_date="2025-01-01T00:00:00Z", scene_id="fake-before",
                crs="EPSG:32643", resolution_m=10.0,
            )
            b = BandData(red=band(0.2), nir=band(0.4), valid=np.zeros((4, 4), dtype=bool),
                         bounds_lnglat=(0, 0, 1, 1), resolution_m=10.0, metadata=meta,
                         crs="EPSG:32643", transform=(10, 0, 0, 0, -10, 0))
            a = BandData(red=band(0.3), nir=band(0.5), valid=np.zeros((4, 4), dtype=bool),
                         bounds_lnglat=(0, 0, 1, 1), resolution_m=10.0, metadata=meta,
                         crs="EPSG:32643", transform=(10, 0, 0, 0, -10, 0))
            from backend.app.analysis.imagery import TemporalPair
            return TemporalPair(before=b, after=a)

    monkeypatch.setattr(
        "backend.app.analysis.change_detection.get_imagery_provider", lambda: FakePairProvider()
    )
    with pytest.raises(AnalysisServiceError) as excinfo:
        change_detection_service.analyze(_change_request())
    assert excinfo.value.code == "NO_VALID_OVERLAP"


# ── 18. Orchestrator integration ───────────────────────────────────────────

def test_orchestrator_runs_real_change_detection():
    run = query_orchestrator.run("What changed between December 2025 and August 2026?")
    assert run.intent == IntentType.change_detection
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "change_detector"
    assert run.result is not None
    assert run.result.kind == "change"
    assert run.result.mode == "live"
    assert run.result.model_kind == "algorithm"
    assert getattr(run.result, "change_method", None) == "delta_ndvi"
    assert any("two real Sentinel-2 observations" in s for s in run.trace)
    assert not any("ML" in s for s in run.trace)
    assert run.result.before_imagery is not None and run.result.after_imagery is not None
    assert run.result.overlay is not None


def test_orchestrator_aoi_failure_surfaces_honest_error():
    run = query_orchestrator.run(
        "What changed here?",
        context=AgentContext(centre=[0.0, 0.0], location_name="Atlantic Ocean"),
    )
    assert run.result is None
    assert "couldn't complete" in run.explanation.lower() or "overlap" in run.explanation.lower()


# ── 19. Change-detection intent detection ──────────────────────────────────

@pytest.mark.parametrize(
    "query",
    [
        "What changed between 2024 and 2026?",
        "Compare this area with last year",
        "How has this area changed since 2024?",
    ],
)
def test_change_queries_detect_intent(query: str):
    result = intent_detector.classify(query)
    assert result.intent == IntentType.change_detection


def test_change_query_selects_tool():
    run = query_orchestrator.run("What changed between 2024 and 2026?")
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "change_detector"
    tool = tool_selector.select(intent_detector.classify("What changed here?"))
    assert tool is not None and tool.tool_id == "change_detector"


# ── 20. Structured failure behavior ────────────────────────────────────────

def test_result_exposes_threshold_and_method():
    result = change_detection_service.analyze(_change_request())
    assert result.threshold == 0.15
    assert result.change_method == "delta_ndvi"
    assert result.model == "delta-ndvi"
    assert "not ML" in result.summary_text or "radiometric" in result.summary_text


def test_result_names_both_observations():
    result = change_detection_service.analyze(_change_request())
    assert "S2B_43RDQ_20251202_0_L2A" in result.summary_text
    assert "S2B_43RDQ_20260829_0_L2A" in result.summary_text


# ── 21. API response ───────────────────────────────────────────────────────

def test_query_api_change_returns_real_result():
    response = client.post(
        "/api/v1/query/",
        json={"query": "What changed between December 2025 and August 2026?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "change_detection"
    assert data["analysis_kind"] == "change"
    payload = data["analysis_payload"]
    assert payload["kind"] == "change"
    assert payload["mode"] == "live"
    assert payload["model_kind"] == "algorithm"
    assert payload["tool_id"] == "change_detector"
    assert payload["threshold"] == 0.15
    assert payload["change_method"] == "delta_ndvi"
    assert payload["change_stats"]["changed_percentage"] > 0
    assert payload["before_imagery"]["scene_id"] == "S2B_43RDQ_20251202_0_L2A"
    assert payload["after_imagery"]["scene_id"] == "S2B_43RDQ_20260829_0_L2A"
    assert payload["overlay"]["image_data_url"].startswith("data:image/png;base64,")
    assert any("change" in a["label"].lower() for a in data["attachments"])