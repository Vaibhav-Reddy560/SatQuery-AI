import os
import sys
import json
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.llm_fallback import classify_with_llm
from backend.app.schemas.ai import IntentType


def _mock_groq_response(payload: dict):
    """
    Builds a fake Groq API response object matching the real SDK's shape,
    so classify_with_llm() can parse it exactly like a live call.
    """
    mock_message = MagicMock()
    mock_message.content = json.dumps(payload)
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    return mock_response


@patch("backend.app.agents.llm_fallback._get_client")
def test_basic_classification(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response({
        "intent": "vegetation_analysis",
        "location": "Shimla",
        "from_year": None,
        "to_year": None,
        "targets": [],
        "water_type": None,
        "measurement_subtype": None,
        "confidence": 0.9,
        "reasoning": "test reasoning",
    })
    mock_get_client.return_value = mock_client

    result = classify_with_llm("is there any greenery being cut down near the hills")

    assert result.intent == IntentType.vegetation_analysis
    assert result.entities["location"] == "Shimla"
    assert result.confidence == 0.9
    assert "[LLM fallback]" in result.reasoning


@patch("backend.app.agents.llm_fallback._get_client")
def test_entity_extraction_years(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response({
        "intent": "change_detection",
        "location": "Chennai port",
        "from_year": "2022",
        "to_year": "2024",
        "targets": [],
        "water_type": None,
        "measurement_subtype": None,
        "confidence": 0.95,
        "reasoning": "comparing two years",
    })
    mock_get_client.return_value = mock_client

    result = classify_with_llm("how many ships near Chennai port in 2022 vs 2024")

    assert result.intent == IntentType.change_detection
    assert result.entities["from_year"] == "2022"
    assert result.entities["to_year"] == "2024"


@patch("backend.app.agents.llm_fallback._get_client")
def test_targets_only_populated_for_detect_objects(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response({
        "intent": "change_detection",
        "location": None,
        "from_year": None,
        "to_year": None,
        "targets": ["ship", "building"],  # LLM might still fill this in even though intent isn't detect_objects
        "water_type": None,
        "measurement_subtype": None,
        "confidence": 0.8,
        "reasoning": "test",
    })
    mock_get_client.return_value = mock_client

    result = classify_with_llm("some query")

    # Regression guard: targets should be dropped when intent isn't detect_objects,
    # since downstream code only expects targets in that case.
    assert "targets" not in result.entities


@patch("backend.app.agents.llm_fallback._get_client")
def test_invalid_intent_falls_back_to_unknown(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response({
        "intent": "totally_made_up_intent",
        "location": None,
        "confidence": 0.5,
        "reasoning": "bad output",
    })
    mock_get_client.return_value = mock_client

    result = classify_with_llm("some ambiguous query")

    assert result.intent == IntentType.unknown


@patch("backend.app.agents.llm_fallback._get_client")
def test_missing_confidence_defaults_reasonably(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_groq_response({
        "intent": "land_cover",
        "reasoning": "no confidence given",
    })
    mock_get_client.return_value = mock_client

    result = classify_with_llm("classify this area")

    assert 0.0 <= result.confidence <= 1.0


def test_missing_api_key_raises_clear_error(monkeypatch):
    # Ensure no leftover client instance from other tests interferes.
    import backend.app.agents.llm_fallback as fallback_module
    fallback_module._client = None

    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="GROQ_API_KEY not found"):
        classify_with_llm("any query")