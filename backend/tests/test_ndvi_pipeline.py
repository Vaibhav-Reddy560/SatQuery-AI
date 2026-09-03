"""
Phase 2 tests — REAL NDVI vegetation analysis.

Everything here is deterministic and offline: NDVI math is checked against
the textbook formula with synthetic arrays, and the imagery tests read the
bundled REAL Sentinel-2 sample (no network). No API key or internet access is
required.
"""

import json
import os
import sys

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.analysis.imagery import (
    OutsideSampleAOI,
    SampleSentinel2Provider,
    Sentinel2EarthSearchProvider,
    ImageryError,
    requested_aoi,
)
from backend.app.analysis.indices import (
    area_per_pixel_km2,
    classify_ndvi,
    compute_ndvi,
    ndvi_stats,
)
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.schemas.ai import (
    AgentContext,
    AnalysisRequest,
    IntentType,
    PolygonGeometry,
)

from backend.app.main import app

client = TestClient(app)

SAMPLE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../app/analysis/data/sample_ndvi")
)


def _sample_request(**overrides) -> AnalysisRequest:
    base = dict(
        query="Analyze vegetation",
        intent=IntentType.vegetation_analysis,
        tool_id="vegetation_analyzer",
    )
    base.update(overrides)
    return AnalysisRequest(**base)


# ── 1. NDVI mathematical correctness ───────────────────────────────────────

def test_ndvi_textbook_formula():
    # RED = 0.2, NIR = 0.6  ->  NDVI = (0.6 - 0.2) / (0.6 + 0.2) = 0.5
    red = np.array([[0.2]])
    nir = np.array([[0.6]])
    ndvi, valid = compute_ndvi(red, nir)
    assert float(ndvi[0, 0]) == pytest.approx(0.5, abs=1e-6)
    assert bool(valid[0, 0]) is True


def test_ndvi_array_matches_formula():
    red = np.array([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
    nir = np.array([[0.3, 0.6, 0.9], [0.8, 0.5, 0.7]])
    ndvi, valid = compute_ndvi(red, nir)
    expected = (nir - red) / (nir + red)
    np.testing.assert_allclose(ndvi[valid], expected[valid], atol=1e-6)
    assert bool(valid.all())


def test_ndvi_divide_by_zero_is_invalid():
    red = np.array([[0.0, 1.0], [0.0, 0.0]])
    nir = np.array([[0.0, 1.0], [0.0, 0.0]])
    ndvi, valid = compute_ndvi(red, nir)
    assert bool(valid[0, 0]) is False  # 0/0 -> invalid
    assert np.isnan(ndvi[0, 0])
    assert bool(valid[1, 0]) is False
    # red=0, nir>0 is a legitimately valid NDVI of -1.
    assert bool(valid[0, 1]) is True
    assert float(ndvi[0, 1]) == pytest.approx(0.0, abs=1e-6)


def test_ndvi_respects_cloud_valid_mask():
    red = np.full((2, 2), 0.2)
    nir = np.full((2, 2), 0.6)
    valid = np.array([[True, True], [True, False]])
    ndvi, out_valid = compute_ndvi(red, nir, valid)
    assert bool(out_valid[1, 1]) is False
    assert np.isnan(ndvi[1, 1])


# ── 2. Statistics ──────────────────────────────────────────────────────────

def test_ndvi_stats_single_value():
    ndvi, valid = compute_ndvi(np.array([[0.2, 0.2]]), np.array([[0.6, 0.6]]))
    stats = ndvi_stats(ndvi, valid)
    assert stats is not None
    assert stats.mean == pytest.approx(0.5)
    assert stats.min == pytest.approx(0.5)
    assert stats.max == pytest.approx(0.5)
    assert stats.median == pytest.approx(0.5)
    assert stats.valid_pixel_percentage == pytest.approx(100.0)


def test_ndvi_stats_valid_percentage():
    red = np.array([[0.1, 0.2, 0.3, 0.4]])
    nir = np.array([[0.5, 0.6, 0.7, 0.8]])
    valid = np.array([[True, True, False, False]])
    ndvi, out_valid = compute_ndvi(red, nir, valid)
    stats = ndvi_stats(ndvi, out_valid)
    assert stats is not None
    assert stats.valid_pixel_percentage == pytest.approx(50.0)
    # Stats over only the two valid pixels.
    assert stats.mean == pytest.approx(((0.5 - 0.1) / 0.6 + (0.6 - 0.2) / 0.8) / 2.0)


def test_ndvi_stats_none_when_no_valid_pixels():
    ndvi, valid = compute_ndvi(np.array([[0.0]]), np.array([[0.0]]))
    assert ndvi_stats(ndvi, valid) is None


def test_ndvi_stats_median_known():
    red = np.array([0.2, 0.2, 0.2, 0.2])
    nir = np.array([0.4, 0.6, 1.0, 2.0])
    ndvi, valid = compute_ndvi(red, nir)
    stats = ndvi_stats(ndvi, valid)
    assert stats is not None
    # Median of the four values = mean of the two middle ones.
    exact = np.array([(0.4 - 0.2) / 0.6, 0.5, 0.8 / 1.2, 1.8 / 2.2])
    expected = float(np.median(exact))
    assert 0.5 < expected < 0.6  # sanity: it is the middle pair, not sorted[1]
    assert stats.median == pytest.approx(expected, abs=1e-6)


# ── 3. Classification / zones ──────────────────────────────────────────────

def test_classify_ndvi_zone_areas_sum():
    rng = np.random.default_rng(7)
    red = rng.random((40, 40)).astype(np.float32) * 0.3
    nir = red + rng.random((40, 40)).astype(np.float32) * 0.5
    ndvi, valid = compute_ndvi(red, nir)
    px_km2 = area_per_pixel_km2(10)
    zones, thresholds = classify_ndvi(ndvi, valid, px_km2)
    assert set(z["status"] for z in zones) == {"healthy", "stressed", "degraded", "loss"}
    total = sum(z["area_km2"] for z in zones)
    assert total == pytest.approx(int(valid.sum()) * px_km2, rel=1e-3)
    assert thresholds["dense_vegetation"] == 0.6


# ── 4. Sample provider (bundled real Sentinel-2, offline) ─────────────────

def test_sample_provider_returns_real_band_shapes():
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    with rasterio.open(os.path.join(SAMPLE_DIR, "B04.tif")) as ds:
        expected = (ds.height, ds.width)
    data = provider.fetch(_sample_request())  # implicit default AOI
    assert data.red.shape == expected
    assert data.nir.shape == data.red.shape
    assert data.valid.shape == data.red.shape
    assert data.metadata.provider.startswith("sample")
    assert data.metadata.scene_id
    assert data.metadata.acquisition_date
    assert data.metadata.resolution_m == 10
    assert data.valid.sum() > 0


def test_sample_provider_clips_to_aoi():
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    full = provider.fetch(_sample_request())
    # An explicit centre slightly inside the sample coverage clips the window.
    clip = provider.fetch(_sample_request(centre=[75.009229, 31.1162]))
    assert clip.red.shape[0] < full.red.shape[0]
    assert clip.valid.sum() > 0


def test_sample_provider_aoi_outside_raises_structured_error():
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    with pytest.raises(OutsideSampleAOI) as excinfo:
        provider.fetch(_sample_request(centre=[0.0, 0.0]))
    assert "does not overlap" in str(excinfo.value)
    assert excinfo.value.code == "AOI_OUTSIDE_SAMPLE"


def test_sample_provider_missing_bands_raise():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        with pytest.raises(ImageryError):
            SampleSentinel2Provider(tmp)  # no metadata.json


# ── 5. AOI validation ──────────────────────────────────────────────────────

def test_requested_aoi_none_for_implicit_default():
    assert requested_aoi(_sample_request(centre=[78.9629, 20.5937])) is None


def test_requested_aoi_from_polygon():
    polygon = PolygonGeometry(
        type="Polygon",
        coordinates=[[[75.8, 30.9], [75.9, 30.9], [75.9, 31.0], [75.8, 30.9]]],
    )
    aoi = requested_aoi(_sample_request(centre=[75.85, 30.95], aoi_geometry=polygon))
    assert aoi == pytest.approx((75.8, 30.9, 75.9, 31.0))


def test_requested_aoi_rejects_oversized():
    polygon = PolygonGeometry(
        type="Polygon",
        coordinates=[[[75.0, 30.0], [77.0, 30.0], [77.0, 31.0], [75.0, 30.0]]],
    )
    with pytest.raises(ImageryError) as excinfo:
        requested_aoi(_sample_request(centre=[75.8, 30.5], aoi_geometry=polygon))
    assert excinfo.value.code == "OVERSIZED_AOI"


# ── 6. Vegetation intent + tool selection (agent layer) ───────────────────

@pytest.mark.parametrize(
    "query",
    [
        "Analyze vegetation",
        "Show NDVI",
        "Calculate NDVI",
        "What is the vegetation health here?",
        "Which areas have low vegetation?",
    ],
)
def test_vegetation_queries_select_vegetation_tool(query: str):
    run = query_orchestrator.run(query)
    assert run.intent == IntentType.vegetation_analysis
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "vegetation_analyzer"


# ── 7. End-to-end NDVI through the agent ───────────────────────────────────

def test_end_to_end_vegetation_ndvi():
    run = query_orchestrator.run("Analyze vegetation")
    result = run.result
    assert result is not None
    assert result.kind == "vegetation"
    assert result.mode == "live"
    assert result.ndvi_stats is not None
    assert -1.0 <= result.ndvi_stats.min <= result.ndvi_stats.max <= 1.0
    assert result.imagery is not None
    assert result.imagery.scene_id
    assert result.overlay is not None
    assert result.overlay.image_data_url.startswith("data:image/png;base64,")
    assert len(result.overlay.bounds) == 4
    assert result.total_area_km2 > 0
    assert "NDVI" in result.summary_text


def test_ndvi_is_deterministic():
    first = query_orchestrator.run("Analyze vegetation")
    second = query_orchestrator.run("Analyze vegetation")
    assert first.result is not None and second.result is not None
    assert first.result.model_dump() == second.result.model_dump()


def test_vegetation_uses_real_bands_not_fabricated():
    """NDVI must come from RED/NIR bands; mean must equal recomputation."""
    run = query_orchestrator.run("Analyze vegetation")
    result = run.result
    assert result is not None and result.ndvi_stats is not None
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    bands = provider.fetch(_sample_request())
    ndvi, valid = compute_ndvi(bands.red, bands.nir, bands.valid)
    stats = ndvi_stats(ndvi, valid)
    assert stats is not None
    assert result.ndvi_stats.mean == pytest.approx(stats.mean, abs=1e-6)
    assert result.ndvi_stats.min == pytest.approx(stats.min, abs=1e-6)


def test_aoi_outside_sample_surfaces_honest_error():
    run = query_orchestrator.run(
        "Analyze vegetation",
        context=AgentContext(centre=[0.0, 0.0], location_name="Atlantic Ocean"),
    )
    assert run.result is None
    assert "overlap" in run.explanation.lower() or "couldn't complete" in run.explanation.lower()


# ── 8. API response ────────────────────────────────────────────────────────

def test_query_api_vegetation_returns_real_ndvi():
    response = client.post(
        "/api/v1/query/",
        json={"query": "Analyze vegetation"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "vegetation_analysis"
    assert data["analysis_kind"] == "vegetation"
    payload = data["analysis_payload"]
    assert payload["kind"] == "vegetation"
    assert payload["mode"] == "live"
    assert payload["ndvi_stats"]["mean"] is not None
    assert -1.0 <= payload["ndvi_stats"]["min"] <= payload["ndvi_stats"]["max"] <= 1.0
    assert payload["imagery"]["scene_id"]
    assert payload["overlay"]["image_data_url"].startswith("data:image/png;base64,")
    assert any("NDVI" in a["label"] for a in data["attachments"])
    assert any("Show NDVI overlay on map" in s for s in data["suggested_actions"])
