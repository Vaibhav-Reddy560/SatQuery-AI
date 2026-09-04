"""
Focused tests for the VLM engine's intent handling (vlm_engine.infer).

The router/orchestrator (backend/app/agents/intent_detector.py) is the source
of truth for intent. ``SatQueryVLMEngine.infer()`` accepts the already-resolved
canonical ``IntentType`` and MUST use it directly instead of re-classifying the
query with its own regex classifier — that second classification can disagree
with the router (e.g. the engine regex misses plural forms like "buildings").
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.ml.vlm_engine import SatQueryVLMEngine
from backend.app.schemas.ai import IntentType


def _engine() -> SatQueryVLMEngine:
    return SatQueryVLMEngine()


# ── (a) Supplied router intent wins over the engine's own regex ────────────

def test_supplied_router_intent_is_used_even_if_regex_would_disagree():
    # The engine's own regex has no plural "buildings" (only \bbuilding\b), so
    # it would classify this query as general_analysis. The router resolved
    # detect_objects — that authoritative decision must win.
    res = _engine().infer(
        query="buildings in xyz city",
        intent=IntentType.detect_objects,
    )
    assert res["intent"]["type"] == "building_detection"
    assert res["intent"]["detected_target"] == "Urban Structures"
    assert res["analysis_kind"] == "detection"
    # It must NOT fall back to what its own regex would have said.
    assert res["intent"]["type"] != "general_analysis"


def test_supplied_intent_wins_over_conflicting_regex_classification():
    # The engine's regex would say ship_detection for this query; the supplied
    # router intent (land_cover) is authoritative and must not be overridden.
    res = _engine().infer(
        query="detect ships near Mumbai port",
        intent=IntentType.land_cover,
    )
    assert res["intent"]["type"] == "land_cover"
    assert res["analysis_kind"] == "land_cover"
    assert res["intent"]["type"] != "ship_detection"


# ── (b) Fallback preserved when the optional intent is omitted ─────────────

def test_fallback_regex_still_works_when_intent_omitted():
    # No router intent supplied -> existing internal regex behaviour runs.
    res = _engine().infer(query="detect ships near Mumbai port")
    assert res["intent"]["type"] == "ship_detection"
    assert res["analysis_kind"] == "detection"


def test_fallback_still_misses_plurals_without_router_intent():
    # Proves the fallback path is unchanged (and why the router intent
    # matters): without a supplied intent, the engine's regex misses the
    # plural "buildings" and falls back to general_analysis.
    res = _engine().infer(query="buildings in xyz city")
    assert res["intent"]["type"] == "general_analysis"


# ── (c) "buildings in xyz city" is not reclassified when router intent set ─

def test_buildings_query_not_reclassified_when_router_intent_supplied():
    res = _engine().infer(
        query="buildings in xyz city",
        intent=IntentType.detect_objects,
    )
    # The router already resolved object/building detection — infer() must not
    # run its own regex (which would say general_analysis for the plural).
    assert res["intent"]["type"] == "building_detection"
    assert res["analysis_kind"] == "detection"
    assert res["intent"]["type"] != "general_analysis"