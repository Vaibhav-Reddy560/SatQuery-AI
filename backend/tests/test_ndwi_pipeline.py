"""
Phase 2C tests — REAL Sentinel-2 NDWI water detection.

Everything here is deterministic and offline: NDWI math is checked against
the textbook formula (including the distinction from NDVI) with synthetic
arrays, and the imagery tests read the bundled REAL Sentinel-2 sample
(Harike wetland scene, B03/B04/B08/SCL) — no network, no API key.

Covers: formula correctness, zero-denominator handling, nodata/invalid
masking, statistics, threshold classification, sample water analysis,
missing band error handling, orchestrator integration and water intent
detection.
"""

import json
import os
import sys
import tempfile

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.intent_detector import intent_detector
from backend.app.agents.tool_selector import tool_selector
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.analysis.base import AnalysisServiceError
from backend.app.analysis.imagery import (
    BandData,
    ImageryMetadata,
    MissingBand,
    SampleSentinel2Provider,
)
from backend.app.analysis.indices import (
    compute_ndvi,
    compute_ndwi,
    ndwi_stats,
    water_mask,
)
from backend.app.analysis.water_detection import water_detection_service
from backend.app.schemas.ai import (
    AgentContext,
    AnalysisRequest,
    IntentType,
)

from backend.app.main import app

client = TestClient(app)

SAMPLE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../app/analysis/data/sample_ndvi")
)


def _water_request(**overrides) -> AnalysisRequest:
    base = dict(
        query="Find water bodies",
        intent=IntentType.find_water,
        tool_id="water_detector",
    )
    base.update(overrides)
    return AnalysisRequest(**base)


# ── 1. NDWI mathematical correctness ───────────────────────────────────────

def test_ndwi_textbook_formula():
    # GREEN = 0.5, NIR = 0.1  ->  NDWI = (0.5 - 0.1) / (0.5 + 0.1) = 2/3
    green = np.array([[0.5]])
    nir = np.array([[0.1]])
    ndwi, valid = compute_ndwi(green, nir)
    assert float(ndwi[0, 0]) == pytest.approx(2.0 / 3.0, abs=1e-6)
    assert bool(valid[0, 0]) is True


def test_ndwi_array_matches_formula():
    green = np.array([[0.6, 0.2], [0.4, 0.8]])
    nir = np.array([[0.1, 0.3], [0.3, 0.1]])
    ndwi, valid = compute_ndwi(green, nir)
    expected = (green - nir) / (green + nir)
    np.testing.assert_allclose(ndwi[valid], expected[valid], atol=1e-6)
    assert bool(valid.all())


def test_ndwi_is_not_ndvi():
    """Same NIR value, but NDWI uses GREEN (B03) where NDVI uses RED (B04)."""
    red = np.array([[0.2]])
    green = np.array([[0.2]])
    nir = np.array([[0.6]])
    ndvi, _ = compute_ndvi(red, nir)
    ndwi, _ = compute_ndwi(green, nir)
    assert float(ndvi[0, 0]) == pytest.approx(0.5, abs=1e-6)   # (0.6-0.2)/(0.6+0.2)
    assert float(ndwi[0, 0]) == pytest.approx(-0.5, abs=1e-6)  # (0.2-0.6)/(0.2+0.6)
    assert float(ndvi[0, 0]) != float(ndwi[0, 0])


# ── 2. Zero denominator handling ───────────────────────────────────────────

def test_ndwi_divide_by_zero_is_invalid():
    green = np.array([[0.0, 1.0], [0.0, 0.0]])
    nir = np.array([[0.0, 1.0], [0.0, 0.0]])
    ndwi, valid = compute_ndwi(green, nir)
    assert bool(valid[0, 0]) is False  # 0/0 -> invalid
    assert np.isnan(ndwi[0, 0])
    assert bool(valid[1, 0]) is False  # 0/0 -> invalid
    # green = nir = 1 is a legitimate NDWI of 0.
    assert bool(valid[0, 1]) is True
    assert float(ndwi[0, 1]) == pytest.approx(0.0, abs=1e-6)


def test_ndwi_negative_reflectance_is_invalid():
    green = np.array([[-0.1, 0.5]])
    nir = np.array([[0.3, 0.1]])
    ndwi, valid = compute_ndwi(green, nir)
    assert bool(valid[0, 0]) is False
    assert np.isnan(ndwi[0, 0])
    assert bool(valid[0, 1]) is True


# ── 3. Nodata / invalid pixel masking ──────────────────────────────────────

def test_ndwi_respects_cloud_valid_mask():
    green = np.full((2, 2), 0.5)
    nir = np.full((2, 2), 0.1)
    valid = np.array([[True, True], [True, False]])
    ndwi, out_valid = compute_ndwi(green, nir, valid)
    assert bool(out_valid[1, 1]) is False
    assert np.isnan(ndwi[1, 1])


def test_ndwi_nan_bands_are_invalid():
    green = np.array([[np.nan, 0.5]])
    nir = np.array([[0.1, 0.1]])
    ndwi, valid = compute_ndwi(green, nir)
    assert bool(valid[0, 0]) is False
    assert np.isnan(ndwi[0, 0])
    assert bool(valid[0, 1]) is True


# ── 4. Statistics ──────────────────────────────────────────────────────────

def test_ndwi_stats_known_values():
    ndwi = np.array([[0.5, 0.2], [-0.1, 0.3]])
    valid = np.ones((2, 2), dtype=bool)
    stats = ndwi_stats(ndwi, valid, total_pixels=4, water_threshold=0.0)
    assert stats is not None
    assert stats.min == pytest.approx(-0.1)
    assert stats.max == pytest.approx(0.5)
    assert stats.mean == pytest.approx(0.225)
    # sorted: -0.1, 0.2, 0.3, 0.5 -> median = mean of the two middle ones
    assert stats.median == pytest.approx(0.25)
    assert stats.valid_pixel_percentage == pytest.approx(100.0)
    # water: 3 of the 4 valid pixels are >= 0
    assert stats.water_pixel_percentage == pytest.approx(75.0)


def test_ndwi_stats_valid_percentage():
    ndwi = np.array([[0.5, 0.2, -0.1, 0.3]])
    valid = np.array([[True, True, False, False]])
    stats = ndwi_stats(ndwi, valid, total_pixels=4)
    assert stats is not None
    assert stats.valid_pixel_percentage == pytest.approx(50.0)
    assert stats.mean == pytest.approx(0.35)
    # both valid pixels are water
    assert stats.water_pixel_percentage == pytest.approx(100.0)


def test_ndwi_stats_none_when_no_valid_pixels():
    assert ndwi_stats(np.array([[-1.0]]), np.array([[False]])) is None


# ── 5. Threshold classification ────────────────────────────────────────────

def test_water_mask_respects_threshold():
    ndwi = np.array([[0.4, 0.05], [-0.05, 0.1]])
    valid = np.ones((2, 2), dtype=bool)
    loose = water_mask(ndwi, valid, 0.0)
    assert loose.tolist() == [[True, True], [False, True]]
    strict = water_mask(ndwi, valid, 0.2)
    assert strict.tolist() == [[True, False], [False, False]]


def test_ndwi_stats_threshold_changes_water_pct():
    ndwi = np.array([[0.5, 0.0, -0.5]])
    valid = np.ones(3, dtype=bool)
    loose = ndwi_stats(ndwi, valid, water_threshold=0.0)
    strict = ndwi_stats(ndwi, valid, water_threshold=0.1)
    assert loose is not None and strict is not None
    assert loose.water_pixel_percentage == pytest.approx(200.0 / 3.0)  # 0.5 and 0.0
    assert strict.water_pixel_percentage == pytest.approx(100.0 / 3.0)  # only 0.5


def test_default_water_threshold_is_explicit_zero():
    from backend.app.analysis.indices import DEFAULT_WATER_THRESHOLD
    assert DEFAULT_WATER_THRESHOLD == 0.0


# ── 6. Sample provider (bundled real Sentinel-2, offline) ─────────────────

def test_sample_provider_returns_green_band():
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    data = provider.fetch(_water_request())
    assert data.green is not None
    assert data.green.shape == data.red.shape
    assert data.metadata.scene_id
    assert any("B03" in b for b in data.metadata.bands)
    assert any("B08" in b for b in data.metadata.bands)


def test_sample_scene_contains_water():
    """The bundled sample must actually contain water (Harike wetland)."""
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    bands = provider.fetch(_water_request())
    assert bands.green is not None
    ndwi, valid = compute_ndwi(bands.green, bands.nir, bands.valid)
    stats = ndwi_stats(ndwi, valid, water_threshold=0.0)
    assert stats is not None
    assert stats.water_pixel_percentage > 5.0  # meaningful open water, not noise


# ── 7. End-to-end NDWI through the agent ───────────────────────────────────

def test_end_to_end_water_ndwi():
    run = query_orchestrator.run("Find water bodies")
    result = run.result
    assert result is not None
    assert result.kind == "water"
    assert result.mode == "live"
    assert result.model == "ndwi"
    assert result.model_version
    assert result.ndwi_stats is not None
    assert -1.0 <= result.ndwi_stats.min <= result.ndwi_stats.max <= 1.0
    assert 0.0 <= result.ndwi_stats.water_pixel_percentage <= 100.0
    assert result.threshold == 0.0
    assert result.water_area_km2 > 0
    assert result.total_area_km2 > result.water_area_km2
    assert result.imagery is not None
    assert result.imagery.scene_id
    band_list = " ".join(result.imagery.bands)
    assert "B03" in band_list and "B08" in band_list
    assert result.overlay is not None
    assert result.overlay.image_data_url.startswith("data:image/png;base64,")
    assert result.overlay.colormap == "ndwi"
    assert len(result.overlay.bounds) == 4
    assert "NDWI" in result.summary_text
    assert any("live pipeline" in s and "no simulation" in s for s in run.trace)


def test_water_uses_real_bands_not_fabricated():
    """NDWI must come from GREEN/NIR; stats must equal recomputation."""
    run = query_orchestrator.run("Find water bodies")
    result = run.result
    assert result is not None and result.ndwi_stats is not None
    provider = SampleSentinel2Provider(SAMPLE_DIR)
    bands = provider.fetch(_water_request())
    assert bands.green is not None
    ndwi, valid = compute_ndwi(bands.green, bands.nir, bands.valid)
    stats = ndwi_stats(ndwi, valid, water_threshold=result.threshold)
    assert stats is not None
    assert result.ndwi_stats.mean == pytest.approx(stats.mean, abs=1e-6)
    assert result.ndwi_stats.min == pytest.approx(stats.min, abs=1e-6)
    assert result.ndwi_stats.water_pixel_percentage == pytest.approx(
        stats.water_pixel_percentage, abs=1e-6
    )


def test_water_is_deterministic():
    first = query_orchestrator.run("Find water bodies")
    second = query_orchestrator.run("Find water bodies")
    assert first.result is not None and second.result is not None
    assert first.result.model_dump() == second.result.model_dump()
    assert first.explanation == second.explanation


def test_water_aoi_outside_sample_surfaces_honest_error():
    run = query_orchestrator.run(
        "Find water bodies",
        context=AgentContext(centre=[0.0, 0.0], location_name="Atlantic Ocean"),
    )
    assert run.result is None
    assert "overlap" in run.explanation.lower() or "couldn't complete" in run.explanation.lower()


# ── 8. Missing imagery / band error handling ───────────────────────────────

def test_sample_provider_missing_blue_or_green_band_raises():
    # The provider now requires the full 10 m set used by the pipelines
    # (B02 BLUE for RGB, B03 GREEN for NDWI, B04 RED, B08 NIR, SCL mask).
    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, "metadata.json"), "w", encoding="utf-8") as fh:
            json.dump(
                {"center_lat": 31.1, "center_lng": 75.0, "pixels": 224, "pixel_size_m": 10},
                fh,
            )
        for name, dtype in (("B04", "uint16"), ("B08", "uint16"), ("SCL", "uint8")):
            profile = {
                "driver": "GTiff",
                "width": 4,
                "height": 4,
                "count": 1,
                "dtype": dtype,
                "crs": "EPSG:32643",
                "transform": rasterio.transform.from_origin(0, 0, 10, 10),
            }
            with rasterio.open(os.path.join(tmp, f"{name}.tif"), "w", **profile) as ds:
                ds.write(np.zeros((4, 4), dtype=dtype), 1)
        with pytest.raises(MissingBand):
            SampleSentinel2Provider(tmp)


def test_water_service_missing_green_band_raises(monkeypatch):
    class FakeProvider:
        provider_name = "fake"

        def fetch(self, request):
            return BandData(
                red=np.full((4, 4), 0.2, dtype=np.float32),
                nir=np.full((4, 4), 0.3, dtype=np.float32),
                valid=np.ones((4, 4), dtype=bool),
                bounds_lnglat=(0.0, 0.0, 1.0, 1.0),
                resolution_m=10.0,
                metadata=ImageryMetadata(
                    provider="fake",
                    satellite="Sentinel-2",
                    sensor="MSI",
                    bands=["B04 (RED 10m)", "B08 (NIR 10m)"],
                    processing_method="fake",
                ),
                green=None,
            )

    monkeypatch.setattr(
        "backend.app.analysis.water_detection.get_imagery_provider", lambda: FakeProvider()
    )
    with pytest.raises(AnalysisServiceError) as excinfo:
        water_detection_service.analyze(_water_request())
    assert excinfo.value.code == "MISSING_BAND"


# ── 9. Water intent + tool selection (agent layer) ─────────────────────────

@pytest.mark.parametrize(
    "query",
    [
        "Find water bodies",
        "Detect lakes",
        "Identify rivers and canals",
    ],
)
def test_water_queries_detect_water_intent(query: str):
    result = intent_detector.classify(query)
    assert result.intent == IntentType.find_water


def test_water_query_selects_water_tool():
    run = query_orchestrator.run("Find water bodies")
    assert run.intent == IntentType.find_water
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "water_detector"
    assert run.result is not None and run.result.kind == "water"


# ── 10. API response ───────────────────────────────────────────────────────

def test_query_api_water_returns_real_ndwi():
    response = client.post(
        "/api/v1/query/",
        json={"query": "Find water bodies"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "find_water"
    assert data["analysis_kind"] == "water"
    payload = data["analysis_payload"]
    assert payload["kind"] == "water"
    assert payload["mode"] == "live"
    assert payload["tool_id"] == "water_detector"
    assert payload["ndwi_stats"]["water_pixel_percentage"] > 0
    assert -1.0 <= payload["ndwi_stats"]["min"] <= payload["ndwi_stats"]["max"] <= 1.0
    assert payload["threshold"] == 0.0
    assert payload["imagery"]["scene_id"]
    assert payload["overlay"]["image_data_url"].startswith("data:image/png;base64,")
    assert any("NDWI" in a["label"] for a in data["attachments"])