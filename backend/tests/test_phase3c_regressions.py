"""
Phase 3C regression tests.

Deterministic + OFFLINE. Covers:
- location resolution: location-less queries NEVER become Mumbai/any city;
  explicit Mumbai/Delhi/Jaisalmer resolve to their own coordinates and to
  their own real bundled Sentinel-2 scenes; the Harike default sample stays
  the no-AOI deterministic default.
- education routing: "What is NDVI?" / "Explain what Sentinel-2 is." are
  general questions, never analyses over an arbitrary AOI.
- real Indian sample scenes (Delhi / Jaisalmer / Mumbai) keep their own CRS.
- VLM: visual routing, model/processor reuse across requests, provenance
  (load latency + cached flag), no second-model rewrite of the real answer.
- object detection stays honestly mock.
- BigEarthNet honesty: no fabricated fine-tuning/evaluation claims.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.intent_detector import intent_detector
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.agents.planner import planner
from backend.app.agents.tool_selector import tool_selector
from backend.app.analysis.imagery import (
    SAMPLE_DELHI_DIR,
    SAMPLE_JAISALMER_DIR,
    SAMPLE_MUMBAI_DIR,
    get_imagery_provider,
)
from backend.app.analysis.visual import visual_analysis_service
from backend.app.ml.vlm import MODEL_NAME, MODEL_VERSION
from backend.app.schemas.ai import (
    AgentContext,
    AnalysisRequest,
    IntentType,
    VisualResult,
)

from backend.app.main import app

client = TestClient(app)

# Real bundled scenes (metadata from scripts/fetch_indian_scene_samples.py).
DELHI_SCENE = "S2B_43RGM_20250324_0_L2A"
JAISALMER_SCENE = "S2B_42RXQ_20250409_0_L2A"
MUMBAI_SCENE = "S2C_42QZG_20260506_0_L2A"
DEFAULT_SCENE = "S2B_43RDQ_20260829_0_L2A"  # Harike sample/default AOI

# ── Helpers ────────────────────────────────────────────────────────────────

def _request(query, intent, tool_id, location=None, centre=None):
    return AnalysisRequest(
        query=query,
        intent=intent,
        tool_id=tool_id,
        location=location,
        centre=centre,
    )


def _plan_for(query: str):
    intent = intent_detector.classify(query)
    selection = tool_selector.select(intent)
    return intent, selection, planner.plan(
        raw_query=query, intent_result=intent, tool_selection=selection
    )


# ── 1. Location: location-less queries never become a city ────────────────

def test_no_location_visual_query_has_no_city():
    intent = intent_detector.classify("What is visible in the image?")
    assert intent.intent == IntentType.visual_interpretation
    assert "location" not in intent.entities

    intent2 = intent_detector.classify("Describe this satellite image")
    assert intent2.intent == IntentType.visual_interpretation
    assert "location" not in intent2.entities


def test_no_location_visual_plan_has_no_city_location():
    for query in ("What is visible in the image?", "Describe this satellite image"):
        _, selection, plan = _plan_for(query)
        assert selection is not None and selection.tool_id == "visual_analyzer"
        assert plan is not None
        assert plan.location is None


def test_no_location_ndvi_scene_query_has_no_city():
    intent, selection, plan = _plan_for("What is the NDVI of this scene?")
    assert intent.intent == IntentType.vegetation_analysis
    assert selection is not None and selection.tool_id == "vegetation_analyzer"
    assert plan is not None and plan.location is None


def test_harike_default_sample_still_default_for_locationless_analysis():
    """A location-less analysis must keep analysing the bundled default
    (Harike) sample scene — never a city picked from nowhere."""
    run = query_orchestrator.run("Analyze vegetation")
    assert run.result is not None
    assert run.result.imagery is not None
    assert run.result.imagery.scene_id == DEFAULT_SCENE
    assert "mumbai" not in run.result.location.lower()


# ── 2. Education questions are general, not analyses ──────────────────────

@pytest.mark.parametrize(
    "query",
    ["What is NDVI?", "What is NDWI?", "Explain what Sentinel-2 is.",
     "What does NDVI mean?", "Define NDVI"],
)
def test_definition_questions_are_general(query: str):
    intent = intent_detector.classify(query)
    assert intent.intent == IntentType.general_satellite_question
    assert "location" not in intent.entities


def test_education_questions_never_run_an_analysis():
    for query in ("What is NDVI?", "Explain what Sentinel-2 is."):
        run = query_orchestrator.run(query)
        assert run.selected_tool is None
        assert run.result is None
        assert "NDVI" in run.explanation or "Sentinel-2" in run.explanation


def test_analysis_asks_with_scene_scope_are_not_education():
    assert intent_detector.classify("What is the NDVI of this scene?").intent == IntentType.vegetation_analysis
    assert intent_detector.classify("What is the NDVI around Mumbai?").intent == IntentType.vegetation_analysis
    # visual asks must never be swallowed by the education rule
    assert intent_detector.classify("Explain what is visible in this satellite image").intent == IntentType.visual_interpretation


# ── 3. Explicit locations resolve explicitly ──────────────────────────────

@pytest.mark.parametrize(
    "query,expected_location,expected_centre",
    [
        ("What is the NDVI around Mumbai?", "Mumbai", [72.8777, 19.076]),
        ("Find water around Delhi", "Delhi", [77.10, 28.66]),
        ("Find water around Jaisalmer", "Jaisalmer", [70.9, 27.0]),
        ("Describe the satellite image around Mumbai", "Mumbai", [72.8777, 19.076]),
    ],
)
def test_explicit_locations_resolve_to_centres(query, expected_location, expected_centre):
    intent, selection, plan = _plan_for(query)
    assert plan is not None
    assert plan.location == expected_location
    assert plan.centre == pytest.approx(expected_centre, abs=1e-3)


@pytest.mark.parametrize(
    "query,intent,tool",
    [
        ("What is the NDVI around Mumbai?", IntentType.vegetation_analysis, "vegetation_analyzer"),
        ("Find water around Delhi", IntentType.find_water, "water_detector"),
        ("Find water around Jaisalmer", IntentType.find_water, "water_detector"),
        ("Describe the satellite image around Mumbai", IntentType.visual_interpretation, "visual_analyzer"),
        ("What is visible in the image?", IntentType.visual_interpretation, "visual_analyzer"),
    ],
)
def test_canonical_routing(query, intent, tool):
    detected = intent_detector.classify(query)
    assert detected.intent == intent
    selection = tool_selector.select(detected)
    assert selection is not None and selection.tool_id == tool


# ── 4. Real Indian bundled scenes (own CRS each, offline) ─────────────────

def _request_for_scene_analysis(query, tool_id, location, centre):
    return _request(query, IntentType.vegetation_analysis, tool_id, location, centre)


def test_delhi_scene_ndvi_uses_real_delhi_scene():
    result = query_orchestrator.run(
        "What is the NDVI around Delhi?", context=None
    )
    # planner resolved Delhi via gazetteer -> centre -> Delhi bundled scene
    assert result.result is not None and result.result.kind == "vegetation"
    assert result.result.location == "Delhi"
    assert result.result.imagery.scene_id == DELHI_SCENE
    assert result.result.imagery.crs == "EPSG:32643"  # own UTM zone preserved
    assert result.result.ndvi_stats is not None


def test_jaisalmer_scene_ndvi_uses_real_jaisalmer_scene():
    result = query_orchestrator.run("What is the NDVI around Jaisalmer?")
    assert result.result is not None and result.result.kind == "vegetation"
    assert result.result.location == "Jaisalmer"
    assert result.result.imagery.scene_id == JAISALMER_SCENE
    assert result.result.imagery.crs == "EPSG:32642"  # own UTM zone preserved
    assert result.result.ndvi_stats is not None


def test_delhi_and_jaisalmer_scenes_keep_distinct_grids():
    provider = get_imagery_provider()
    delhi_bounds = provider._coverages()[SAMPLE_DELHI_DIR]
    jaisalmer_bounds = provider._coverages()[SAMPLE_JAISALMER_DIR]
    mumbai_bounds = provider._coverages()[SAMPLE_MUMBAI_DIR]
    # Different regions -> non-overlapping coverages (separate CRS/grids).
    assert delhi_bounds[0] > 76.5 and delhi_bounds[2] < 78.0
    assert jaisalmer_bounds[0] > 70.0 and jaisalmer_bounds[2] < 72.0
    assert mumbai_bounds[0] > 72.0 and mumbai_bounds[2] < 74.0


def test_mumbai_water_and_ndvi_scenes_resolve_offline():
    veg = query_orchestrator.run("What is the NDVI around Mumbai?")
    assert veg.result is not None and veg.result.kind == "vegetation"
    assert veg.result.imagery.scene_id == MUMBAI_SCENE

    water = query_orchestrator.run(
        "Find water bodies near Mumbai",
        context=AgentContext(centre=[72.8777, 19.076], location_name="Mumbai"),
    )
    assert water.result is not None and water.result.kind == "water"
    assert water.result.imagery.scene_id == MUMBAI_SCENE


def test_out_of_bundle_city_errors_honestly_not_silent_sample():
    """An explicit place with no bundled scene must raise a structured error
    (or be refused), never silently analyse the Harike default under that
    place's name."""
    run = query_orchestrator.run(
        "Find water around Paris",
        context=None,
    )
    # gazetteer-less place: refuse at the imagery layer with an honest error.
    assert run.result is None
    joined = run.explanation.lower()
    assert "could not be resolved" in joined or "no aoi" in joined or "outside" in joined


# ── 5. VLM routing / reuse / provenance ───────────────────────────────────

class CountingVLM:
    """Deterministic stand-in tracking load events like the real backend."""

    model_name = MODEL_NAME
    model_version = MODEL_VERSION
    device = "cpu"
    answer = "Open water and green vegetation in a delta scene."
    _load_count = 0
    _last_load_latency_ms = None
    _loaded = False

    @property
    def load_count(self) -> int:
        return self._load_count

    @property
    def last_load_latency_ms(self):
        return self._last_load_latency_ms

    def load(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        self._load_count += 1
        self._last_load_latency_ms = 1234.5

    def caption(self, image, prompt: str):
        return self.answer, 42.5


@pytest.fixture()
def stub_vlm(monkeypatch):
    import backend.app.analysis.visual as visual_mod

    backend = CountingVLM()
    monkeypatch.setattr(visual_mod, "smol_vlm_backend", backend)
    monkeypatch.setattr(visual_mod, "vlm_enabled", lambda: True)
    return backend


def test_visual_service_first_load_reports_load_latency_not_reused(stub_vlm):
    result = visual_analysis_service.analyze(
        _request("What is visible in the image?", IntentType.visual_interpretation, "visual_analyzer")
    )
    assert isinstance(result, VisualResult)
    assert result.model_reused is False
    assert result.model_load_latency_ms == 1234.5
    assert result.model == "smolvlm-500m-instruct"
    assert result.model_version == MODEL_VERSION
    assert result.inference_latency_ms == 42.5
    assert result.mode == "live" and result.model_kind == "vlm"
    # authoritative answer preserved verbatim
    assert result.answer == stub_vlm.answer


def test_visual_service_reuses_model_across_requests(stub_vlm):
    req = _request("Describe this satellite image", IntentType.visual_interpretation, "visual_analyzer")
    first = visual_analysis_service.analyze(req)
    second = visual_analysis_service.analyze(req)
    assert stub_vlm.load_count == 1  # weights loaded exactly once
    assert first.model_reused is False and first.model_load_latency_ms == 1234.5
    assert second.model_reused is True and second.model_load_latency_ms is None


def test_visual_api_no_location_no_mumbai(stub_vlm):
    response = client.post(
        "/api/v1/query/", json={"query": "What is visible in the image?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "visual_interpretation"
    assert data["analysis_kind"] == "visual"
    payload = data["analysis_payload"]
    assert payload["model_kind"] == "vlm"
    assert "mumbai" not in (payload.get("location") or "").lower()
    assert payload.get("model_reused") is False
    assert payload.get("model_load_latency_ms") == 1234.5


# ── 6. Object detection stays honest mock ─────────────────────────────────

def test_object_detection_is_honestly_mock():
    run = query_orchestrator.run("Detect ships near Mumbai port")
    assert run.result is not None
    assert run.result.kind == "detection"
    assert run.result.mode == "mock"  # no real detector exists yet
    assert run.result.model_kind is None or run.result.model_kind != "vlm"


# ── 7. BigEarthNet honesty ────────────────────────────────────────────────

def test_model_status_has_no_fabricated_finetuning_eval_claims():
    response = client.get("/api/v1/models/status")
    assert response.status_code == 200
    data = response.json()
    # Not fine-tuned, not benchmark-evaluated — honest defaults.
    assert data["bigearthnet_finetuned"] is False
    assert data["vrsbench_evaluated"] is False
    # No fabricated hardware/latency figures.
    assert data["gpu_memory_used_gb"] is None
    assert data["inference_latency_ms"] is None
    assert data["fine_tuning"]["status"] == "NOT_PERFORMED"


def test_bigearthnet_eval_endpoint_reports_not_available():
    response = client.get("/api/v1/datasets/bigearthnet/eval")
    assert response.status_code == 200
    data = response.json()
    assert data["dataset"] == "BigEarthNet"
    assert data["status"] == "NOT_AVAILABLE"
    assert data["evaluated"] is False
    assert data["metrics"] is None


def test_bigearthnet_sample_patches_are_stamped_mock():
    response = client.get("/api/v1/datasets/bigearthnet/samples")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "mock"
    assert all(s.get("is_demo") is True for s in data["samples"])
