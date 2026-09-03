"""
Phase 1 AI/ML pipeline tests.

Covers: intent detection, tool selection, planner (incl. AOI plumbing),
orchestrator (deterministic output + AgentRun schema), and the /query API
response. All results are deterministic mocks; nothing here requires a model,
a GPU or a network connection.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

# Ensure the repo root is importable (same trick as test_api.py).
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.intent_detector import intent_detector
from backend.app.agents.tool_selector import tool_selector
from backend.app.agents.planner import planner
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.schemas.ai import (
    AgentContext,
    AgentRun,
    IntentType,
    PolygonGeometry,
)

from backend.app.main import app

client = TestClient(app)


# ── 1. Intent detection ────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "query,expected",
    [
        ("Find buildings", IntentType.detect_objects),
        ("Identify ships near Mumbai port", IntentType.detect_objects),
        ("How many buildings are in this area?", IntentType.detect_objects),
        ("Find water bodies", IntentType.find_water),
        ("Detect lakes", IntentType.find_water),
        ("Classify the land cover in Punjab", IntentType.land_cover),
        ("What is the land cover here?", IntentType.land_cover),
        ("What changed between 2024 and 2026?", IntentType.change_detection),
        ("Compare this area with last year", IntentType.change_detection),
        ("Show vegetation loss", IntentType.vegetation_analysis),
        ("Analyze vegetation", IntentType.vegetation_analysis),
        ("Measure the NDVI of the crops", IntentType.vegetation_analysis),
        ("How large is this lake?", IntentType.measure_area),
        ("Estimate the area of this lake", IntentType.measure_area),
        ("How far is the coast from here?", IntentType.measure_distance),
        ("What is the capital of France?", IntentType.unknown),
    ],
)
def test_intent_detection(query: str, expected: IntentType):
    result = intent_detector.classify(query)
    assert result.intent == expected
    assert 0.0 <= result.confidence <= 1.0
    assert isinstance(result.reasoning, str) and result.reasoning


def test_intent_detector_is_deterministic():
    q = "Find buildings near Mumbai"
    first = intent_detector.classify(q)
    second = intent_detector.classify(q)
    assert first.model_dump() == second.model_dump()


def test_detection_targets_are_extracted():
    result = intent_detector.classify("Detect ships and vehicles near the port")
    assert result.intent == IntentType.detect_objects
    targets = result.entities.get("targets")
    assert targets == ["ship", "vehicle"]


def test_location_entity_is_extracted():
    result = intent_detector.classify("Find water bodies near Mumbai port")
    assert result.entities.get("location") == "Mumbai"


# ── 2. Tool selection ──────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "query,expected_tool",
    [
        ("Find buildings", "object_detector"),
        ("Find water bodies", "water_detector"),
        ("Classify land cover", "land_cover_classifier"),
        ("What changed between 2024 and 2026?", "change_detector"),
        ("Analyze vegetation", "vegetation_analyzer"),
        ("How large is this lake?", "geospatial_measurement"),
    ],
)
def test_tool_selection(query: str, expected_tool: str):
    intent_result = intent_detector.classify(query)
    selection = tool_selector.select(intent_result)
    assert selection is not None
    assert selection.tool_id == expected_tool


def test_tool_selector_does_not_always_pick_object_detector():
    for query in ("Find water bodies", "Classify land cover", "Measure this area"):
        selection = tool_selector.select(intent_detector.classify(query))
        assert selection is not None
        assert selection.tool_id != "object_detector"


def test_tool_selection_for_measurement_sets_type():
    area = tool_selector.select(intent_detector.classify("How large is this lake?"))
    assert area is not None and area.parameters.get("measurement_type") == "area"

    dist = tool_selector.select(intent_detector.classify("Measure the distance across the river"))
    assert dist is not None and dist.parameters.get("measurement_type") == "distance"

    perimeter = tool_selector.select(intent_detector.classify("Measure the perimeter of this lake"))
    assert perimeter is not None and perimeter.parameters.get("measurement_type") == "perimeter"


def test_tool_selection_none_for_non_analysis_intents():
    unknown = tool_selector.select(intent_detector.classify("What is the capital of France?"))
    assert unknown is None
    general = tool_selector.select(intent_detector.classify("Describe this satellite region"))
    assert general is None


# ── 3. Planner ─────────────────────────────────────────────────────────────

def test_planner_builds_request_with_context():
    raw = "What changed between 2020 and 2024 in Bengaluru?"
    intent_result = intent_detector.classify(raw)
    selection = tool_selector.select(intent_result)
    context = AgentContext(
        location_name="Bengaluru",
        centre=[77.5946, 12.9716],
        image_ids=["img-1"],
    )
    request = planner.plan(
        raw_query=raw,
        intent_result=intent_result,
        tool_selection=selection,
        context=context,
    )
    assert request is not None
    assert request.intent == IntentType.change_detection
    assert request.location == "Bengaluru"
    assert request.centre == [77.5946, 12.9716]
    assert request.image_ids == ["img-1"]
    assert request.date_range is not None
    assert request.date_range.from_date == "2020-01-01"
    assert request.date_range.to_date == "2024-01-01"


def test_planner_accepts_aoi_geometry_from_frontend():
    """The AOI context from the frontend map drawing tools must flow through."""
    polygon = PolygonGeometry(
        type="Polygon",
        coordinates=[[[72.8, 18.9], [72.9, 18.9], [72.9, 19.0], [72.8, 18.9]]],
    )
    intent_result = intent_detector.classify("Find buildings")
    selection = tool_selector.select(intent_result)
    request = planner.plan(
        raw_query="Find buildings",
        intent_result=intent_result,
        tool_selection=selection,
        context=AgentContext(centre=[72.85, 18.95], aoi_geometry=polygon),
    )
    assert request is not None
    assert request.aoi_geometry == polygon
    assert request.centre == [72.85, 18.95]


# ── 4. Orchestrator ────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "query,expected_kind",
    [
        ("Find buildings", "detection"),
        ("Find water bodies", "detection"),
        ("Classify land cover", "land_cover"),
        ("What changed between 2024 and 2026?", "change"),
        ("Analyze vegetation", "vegetation"),
        ("How large is this lake?", "measurement"),
    ],
)
def test_orchestrator_produces_typed_results(query: str, expected_kind: str):
    run = query_orchestrator.run(query)
    assert run.result is not None
    assert run.result.kind == expected_kind
    # Phase 1 mock services report "mock"; the Phase 2 vegetation service now
    # reports "live" (real Sentinel-2 NDVI over the bundled sample scene).
    assert run.result.mode in ("mock", "live")
    assert run.explanation and run.trace
    # Every agent run exposes the fields the frontend AgentTrace displays.
    assert run.selected_tool is not None
    assert run.intent in (IntentType.detect_objects, IntentType.find_water,
                          IntentType.land_cover, IntentType.change_detection,
                          IntentType.vegetation_analysis, IntentType.measure_area,
                          IntentType.measure_distance)


def test_orchestrator_returns_agentrun_shape():
    run = query_orchestrator.run("Find buildings")
    dumped = run.model_dump()
    # Round-trips through the pydantic schema (discriminated union included).
    restored = AgentRun.model_validate(dumped)
    assert restored.query == run.query
    assert restored.result is not None
    assert restored.result.kind == "detection"
    assert restored.trace == run.trace


def test_orchestrator_is_deterministic():
    first = query_orchestrator.run("Find water bodies near Mumbai", context=AgentContext(centre=[72.8777, 19.076]))
    second = query_orchestrator.run("Find water bodies near Mumbai", context=AgentContext(centre=[72.8777, 19.076]))
    assert first.result is not None and second.result is not None
    assert first.result.model_dump() == second.result.model_dump()
    assert first.explanation == second.explanation
    assert first.selected_tool == second.selected_tool


def test_orchestrator_answers_unknown_without_tool():
    run = query_orchestrator.run("What is the capital of France?")
    assert run.intent == IntentType.unknown
    assert run.selected_tool is None
    assert run.result is None
    assert run.explanation
    assert "rephras" in run.explanation.lower()


# ── 5. API response ────────────────────────────────────────────────────────

def test_query_api_returns_agent_payload():
    response = client.post(
        "/api/v1/query/",
        json={"query": "Detect ships near Mumbai port", "location_name": "Mumbai Port", "centre": [72.8360, 18.9438]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "detect_objects"
    assert data["analysis_kind"] == "detection"
    assert data["confidence"] > 0.8
    assert data["text_response"]
    payload = data["analysis_payload"]
    assert payload["kind"] == "detection"
    assert payload["mode"] == "mock"
    assert len(payload["features"]) > 0
    # Canonical tool id, no object-detector-for-everything default.
    assert payload["tool_id"] == "object_detector"
    assert data["trace"]


def test_query_api_water_query_uses_water_detector():
    response = client.post(
        "/api/v1/query/",
        json={"query": "Find water bodies near Mumbai", "centre": [72.8777, 19.076]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "find_water"
    assert data["analysis_payload"]["tool_id"] == "water_detector"


def test_query_api_is_deterministic():
    body = {"query": "Classify the land cover in Punjab", "centre": [75.8573, 30.901]}
    first = client.post("/api/v1/query/", json=body).json()
    second = client.post("/api/v1/query/", json=body).json()
    assert first["analysis_payload"] == second["analysis_payload"]


def test_query_api_unknown_still_returns_200():
    response = client.post(
        "/api/v1/query/",
        json={"query": "What is the capital of France?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["type"] == "unknown"
    assert data["analysis_kind"] == "general"
    assert data["text_response"]
    assert data["analysis_payload"]["kind"] == "general"
