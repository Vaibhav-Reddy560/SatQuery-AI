"""
Phase 2G tests — REAL local vision-language visual interpretation.

These tests are deterministic and OFFLINE. They cover the intent/tool/routing
layer, the true-colour RGB rendering from the bundled REAL Sentinel-2 sample,
the structured result envelope, structured failure behaviour when the model
is unavailable, and the API/orchestrator integration — with the VLM backend
stubbed so no weights and no network are required in CI.

The single real-inference test (``test_real_smolvlm_inference``) is marked
``@pytest.mark.network`` so it runs only when explicitly requested (it
downloads ~1 GB of weights on first use):
    pytest backend/tests/test_visual_pipeline.py -m network
"""

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
from backend.app.analysis.visual import (
    _build_prompt,
    _encode_image_data_url,
    _render_rgb_preview,
    visual_analysis_service,
)
from backend.app.ml.vlm import MODEL_NAME, MODEL_VERSION, SmolVLMBackend, vlm_enabled
from backend.app.schemas.ai import (
    AgentContext,
    AnalysisRequest,
    IntentType,
    VisualResult,
)

from backend.app.main import app

client = TestClient(app)


# ── Fixtures ───────────────────────────────────────────────────────────────

def _visual_request(**overrides) -> AnalysisRequest:
    base = dict(
        query="What do you see in this satellite image?",
        intent=IntentType.visual_interpretation,
        tool_id="visual_analyzer",
        location=None,
        centre=None,
    )
    base.update(overrides)
    return AnalysisRequest(**base)


class StubVLM:
    """Deterministic stand-in for the SmolVLM backend (offline tests only)."""

    model_name = MODEL_NAME
    model_version = MODEL_VERSION
    device = "cpu"
    answer = "The scene shows wetland water surrounded by green vegetation and fields."

    def load(self) -> None:
        return None

    def caption(self, image, prompt: str):
        assert image.mode == "RGB"
        return self.answer, 42.5

    def provenance(self) -> dict:
        return {"model": self.model_name}


@pytest.fixture()
def stub_vlm(monkeypatch):
    import backend.app.analysis.visual as visual_mod

    monkeypatch.setattr(visual_mod, "smol_vlm_backend", StubVLM())
    monkeypatch.setattr(visual_mod, "vlm_enabled", lambda: True)
    # Keep the orchestrator honest path also stubbed.
    return StubVLM()


# ── 1. VLM intent detection ───────────────────────────────────────────────

@pytest.mark.parametrize(
    "query",
    [
        "What do you see in this satellite image?",
        "Describe the landscape in this image",
        "What does this satellite scene look like?",
        "Does the image appear to contain substantial vegetation?",
        "Describe the visible terrain",
        "Tell me about the landscape",
        # Natural image-observation wording (narrow "what is visible" family).
        "What is visible in the image?",
        "What can you see in this image?",
        "What do you see in this image?",
        "What's visible in the satellite photo?",
    ],
)
def test_visual_queries_detect_visual_intent(query: str):
    result = intent_detector.classify(query)
    assert result.intent == IntentType.visual_interpretation


def test_visible_image_phrases_do_not_route_ordinary_questions_to_vlm():
    """The narrow 'what is visible in the image' rule must NOT catch ordinary
    questions that merely mention 'visible', 'see' or 'image'."""
    cases = [
        "What is visible from space?",
        "Is the building visible in this image?",
        "Can you see the problem?",
        "What does visible mean?",
        "How visible is the water from above?",
        "What is visible in this region?",
    ]
    for query in cases:
        result = intent_detector.classify(query)
        assert result.intent != IntentType.visual_interpretation, query


def test_visual_query_selects_visual_tool():
    result = intent_detector.classify("What do you see in this satellite image?")
    selection = tool_selector.select(result)
    assert selection is not None
    assert selection.tool_id == "visual_analyzer"


def test_quantitative_queries_stay_on_analysis_tools():
    """Quantitative questions must NOT route to the VLM: NDVI/NDWI/land-cover
    stay authoritative, per the phase grounding requirement."""
    cases = {
        "Is the vegetation healthy near Ludhiana?": IntentType.vegetation_analysis,
        "Find water bodies": IntentType.find_water,
        "Classify land cover": IntentType.land_cover,
        "Show me the water in the lake": IntentType.find_water,
        "What changed here since 2024?": IntentType.change_detection,
    }
    for query, expected in cases.items():
        result = intent_detector.classify(query)
        assert result.intent == expected, f"{query!r} -> {result.intent}"


def test_general_capability_questions_are_not_vlm():
    """'What can you tell me about this region' (capability) stays on the
    canned general path rather than forcing a VLM run."""
    result = intent_detector.classify("What can you tell me about this region?")
    assert result.intent == IntentType.general_satellite_question


# ── 2. RGB render (real bundled sample) ───────────────────────────────────

def test_rgb_render_from_real_sample():
    bands = _sample_bands()
    rgb, image = _render_rgb_preview(bands)
    assert image.mode == "RGB"
    assert image.width > 0 and image.height > 0
    assert rgb.shape == (image.height, image.width, 3)
    assert rgb.dtype == np.uint8
    # The sample has water + vegetation; reflectance must be non-trivial.
    assert int(rgb.max(axis=(0, 1)).sum()) > 100


def test_rgb_preview_data_url():
    bands = _sample_bands()
    _, image = _render_rgb_preview(bands)
    url = _encode_image_data_url(image)
    assert url.startswith("data:image/png;base64,")
    assert len(url) > 1_000


def test_rgb_render_missing_band_raises():
    from backend.app.analysis.imagery import BandData, ImageryMetadata

    bands = BandData(
        red=np.full((4, 4), 0.2, dtype=np.float32),
        green=np.full((4, 4), 0.3, dtype=np.float32),
        nir=np.full((4, 4), 0.4, dtype=np.float32),
        blue=None,  # no blue -> cannot render true colour
        valid=np.ones((4, 4), dtype=bool),
        bounds_lnglat=(0.0, 0.0, 1.0, 1.0),
        resolution_m=10.0,
        metadata=ImageryMetadata(
            provider="fake", satellite="Sentinel-2", sensor="MSI",
            bands=[], processing_method="fake",
        ),
    )
    with pytest.raises(AnalysisServiceError) as excinfo:
        _render_rgb_preview(bands)
    assert excinfo.value.code == "MISSING_BAND"


def _sample_bands():
    from backend.app.analysis.imagery import get_imagery_provider

    return get_imagery_provider().fetch(_visual_request())


# ── 3. Prompt construction (grounding) ────────────────────────────────────

def test_prompt_is_grounded_and_forbids_invented_numbers():
    prompt = _build_prompt(
        "What do you see?",
        location="Harike",
        scene="S2B_SCENE",
        date="2026-08-29",
        resolution_m=10,
    )
    assert "S2B_SCENE" in prompt and "2026-08-29" in prompt
    assert "Never invent" in prompt
    assert "not a calibrated" not in prompt  # system text stays internal-safe
    # The prompt must not contain any analysis statistics to parrot.
    assert "NDVI" not in prompt and "mean" not in prompt.lower()


# ── 4. Service: structured success path (stubbed VLM) ─────────────────────

def test_visual_service_success(stub_vlm):
    result = visual_analysis_service.analyze(_visual_request())
    assert isinstance(result, VisualResult)
    assert result.kind == "visual"
    assert result.model_kind == "vlm"
    assert result.mode == "live"
    # A VLM has no calibrated confidence: honesty means omitting it.
    assert result.confidence is None
    assert result.answer == stub_vlm.answer
    assert result.imagery is not None
    assert result.imagery.scene_id  # real scene provenance preserved
    assert result.image_data_url is not None
    assert result.image_size
    assert result.context_supplied is False
    assert result.inference_latency_ms == 42.5


def test_visual_service_aoi_outside_sample_raises(stub_vlm):
    with pytest.raises(AnalysisServiceError) as excinfo:
        visual_analysis_service.analyze(
            _visual_request(centre=[0.0, 0.0], location="Atlantic Ocean")
        )
    assert excinfo.value.code in ("AOI_OUTSIDE_SAMPLE", "INVALID_AOI", "NO_IMAGERY")


# ── 5. Structured failures (never fabricated text) ────────────────────────

def test_visual_service_model_unavailable_raises(monkeypatch):
    import backend.app.analysis.visual as visual_mod

    class FailingVLM:
        def load(self) -> None:
            raise RuntimeError("weights unavailable (offline)")

    monkeypatch.setattr(visual_mod, "smol_vlm_backend", FailingVLM())
    monkeypatch.setattr(visual_mod, "vlm_enabled", lambda: True)
    with pytest.raises(AnalysisServiceError) as excinfo:
        visual_analysis_service.analyze(_visual_request())
    assert excinfo.value.code == "MODEL_UNAVAILABLE"
    assert "No visual description was generated" in excinfo.value.user_message


def test_visual_service_disabled_raises(monkeypatch):
    import backend.app.analysis.visual as visual_mod

    monkeypatch.setattr(visual_mod, "vlm_enabled", lambda: False)
    with pytest.raises(AnalysisServiceError) as excinfo:
        visual_analysis_service.analyze(_visual_request())
    assert excinfo.value.code == "MODEL_UNAVAILABLE"


def test_visual_service_empty_answer_raises(monkeypatch):
    import backend.app.analysis.visual as visual_mod

    class EmptyVLM:
        def load(self) -> None:
            return None

        def caption(self, image, prompt):
            return "   ", 5.0

    monkeypatch.setattr(visual_mod, "smol_vlm_backend", EmptyVLM())
    monkeypatch.setattr(visual_mod, "vlm_enabled", lambda: True)
    with pytest.raises(AnalysisServiceError) as excinfo:
        visual_analysis_service.analyze(_visual_request())
    assert excinfo.value.code == "EMPTY_RESULT"


def test_vlm_enabled_env_flag():
    import backend.app.ml.vlm as vlm_mod

    os.environ["SATQUERY_VLM"] = "disabled"
    assert vlm_mod.vlm_enabled() is False
    os.environ["SATQUERY_VLM"] = "1"
    assert vlm_mod.vlm_enabled() is True
    os.environ.pop("SATQUERY_VLM", None)


# ── 6. Orchestrator integration ───────────────────────────────────────────

def test_orchestrator_runs_visual_interpretation(stub_vlm):
    run = query_orchestrator.run("What do you see in this satellite image?")
    assert run.intent == IntentType.visual_interpretation
    assert run.selected_tool is not None
    assert run.selected_tool.tool_id == "visual_analyzer"
    assert run.result is not None
    assert run.result.kind == "visual"
    assert run.result.model_kind == "vlm"
    assert stub_vlm.answer in run.explanation
    # The trace must identify the actual method honestly.
    joined = " ".join(run.trace)
    assert "vision-language" in joined or "SmolVLM" in joined


def test_orchestrator_surfaces_visual_failure_honestly(monkeypatch):
    import backend.app.analysis.visual as visual_mod

    class FailingVLM:
        def load(self) -> None:
            raise RuntimeError("model weights unavailable")

    monkeypatch.setattr(visual_mod, "smol_vlm_backend", FailingVLM())
    monkeypatch.setattr(visual_mod, "vlm_enabled", lambda: True)
    run = query_orchestrator.run("What do you see in this satellite image?")
    assert run.result is None
    assert run.selected_tool.tool_id == "visual_analyzer"
    assert "couldn't complete" in run.explanation.lower() or "model" in run.explanation.lower()
    assert "doesn't describe" not in run.explanation.lower()


# ── 7. Structured API response ────────────────────────────────────────────

def test_query_api_visual_response(stub_vlm):
    response = client.post(
        "/api/v1/query/",
        json={"query": "What do you see in this satellite image?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "visual_interpretation"
    assert data["analysis_kind"] == "visual"
    payload = data["analysis_payload"]
    assert payload["kind"] == "visual"
    assert payload["model_kind"] == "vlm"
    assert payload["answer"] == stub_vlm.answer
    assert payload["confidence"] is None  # honest: no calibrated confidence
    assert payload["image_data_url"] is not None
    # Attachments reflect the analysed scene, not a fabricated overlay.
    labels = [a["label"] for a in data["attachments"]]
    assert any("scene" in label.lower() for label in labels)


# ── 8. VLM backend module (offline surface) ───────────────────────────────

def test_smolvlm_backend_metadata():
    backend = SmolVLMBackend()
    assert backend.model_name == MODEL_NAME
    assert backend.model_version == MODEL_VERSION
    assert backend.device == "cpu"
    prov = backend.provenance()
    assert prov["model"] == MODEL_NAME
    assert "Apache" in prov["license"]


def test_smolvlm_load_missing_deps_raises_clear_error(monkeypatch):
    backend = SmolVLMBackend()
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name.split(".")[0] in ("torch", "transformers"):
            raise ImportError("torch not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    with pytest.raises(RuntimeError) as excinfo:
        backend.load()
    assert "torch" in str(excinfo.value) or "transformers" in str(excinfo.value)


# ── 9. Optional REAL inference (explicit opt-in only) ─────────────────────

@pytest.mark.network
def test_real_smolvlm_inference_on_bundled_sample():
    """End-to-end real inference: actual SmolVLM weights over the real RGB
    sample. Requires network on first run (~1 GB HF cache). Opt-in:
    `pytest -m network`."""
    backend = SmolVLMBackend()
    backend.load()
    bands = _sample_bands()
    _, image = _render_rgb_preview(bands)
    answer, latency_ms = backend.caption(
        image, "Describe what you observe in this satellite scene in one sentence."
    )
    assert isinstance(answer, str) and len(answer.strip()) > 10
    assert latency_ms > 0
