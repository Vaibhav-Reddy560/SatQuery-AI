import os
import sys

import httpx
import pytest
from fastapi.testclient import TestClient

# Ensure root backend module is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.main import app  # noqa: E402
from backend.app.services import llm  # noqa: E402

client = TestClient(app)


def _chat_payload(**overrides):
    payload = {
        "messages": [
            {"role": "user", "content": "What can you do with satellite imagery?"},
            {"role": "assistant", "content": "I can run analyses like change detection."},
            {"role": "user", "content": "Tell me more."},
        ],
        "system_prompt": "You are SatQuery, a satellite-intelligence assistant.",
        "context": "Current page: Help.\nKnown capabilities: change detection.",
    }
    payload.update(overrides)
    return payload


def test_status_offline_when_key_unset(monkeypatch):
    monkeypatch.setattr(llm, "_api_key", lambda: None)
    response = client.get("/api/v1/ai/status")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "offline"
    assert data["configured"] is False
    assert data["model"]


def test_chat_returns_503_when_unconfigured(monkeypatch):
    monkeypatch.setattr(llm, "_api_key", lambda: None)
    response = client.post("/api/v1/ai/chat", json=_chat_payload())
    assert response.status_code == 503


class _FakeGeminiResponse:
    def __init__(self, status_code=200, candidates=None):
        self.status_code = status_code
        self.text = "{}"
        self._candidates = candidates

    def json(self):
        if self.status_code != 200:
            return {}
        return {"candidates": self._candidates or []}


def test_chat_proxies_payload_and_returns_reply(monkeypatch):
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["params"] = kwargs.get("params")
        captured["json"] = kwargs.get("json")
        return _FakeGeminiResponse(
            candidates=[{"content": {"parts": [{"text": "Great question! Here's what I can do."}]}}]
        )

    monkeypatch.setattr(llm, "_api_key", lambda: "test-key")
    monkeypatch.setattr(llm, "_post", fake_post)

    response = client.post("/api/v1/ai/chat", json=_chat_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Great question! Here's what I can do."
    assert data["provider"] == "gemini"
    assert data["model"]

    # Payload shape: Gemini contents roles (assistant -> model), grounded
    # context appended to the system instruction, key passed server-side.
    body = captured["json"]
    roles = [c["role"] for c in body["contents"]]
    assert roles == ["user", "model", "user"]
    assert "key" in captured["params"]
    assert captured["url"].endswith(":generateContent")
    system_text = body["systemInstruction"]["parts"][0]["text"]
    assert "satellite-intelligence assistant" in system_text
    assert "Known capabilities: change detection." in system_text


def test_chat_returns_503_on_upstream_error(monkeypatch):
    def fake_post(url, **kwargs):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(llm, "_api_key", lambda: "test-key")
    monkeypatch.setattr(llm, "_post", fake_post)

    response = client.post("/api/v1/ai/chat", json=_chat_payload())
    assert response.status_code == 503


def test_chat_returns_503_when_gemini_has_no_candidates(monkeypatch):
    monkeypatch.setattr(llm, "_api_key", lambda: "test-key")
    monkeypatch.setattr(llm, "_post", lambda url, **kwargs: _FakeGeminiResponse(candidates=[]))

    response = client.post("/api/v1/ai/chat", json=_chat_payload())
    assert response.status_code == 503


def test_chat_retries_transient_503_and_falls_back_to_next_model(monkeypatch):
    """A 503 high-demand response should retry and then try the fallback model."""
    calls = []

    def flaky_post(url, **kwargs):
        calls.append(url)
        if len(calls) == 1:  # primary model, attempt 1 -> transient overload
            return _FakeGeminiResponse(status_code=503)
        if len(calls) == 2:  # primary model, attempt 2 -> still overloaded
            return _FakeGeminiResponse(status_code=503)
        # fallback model succeeds
        return _FakeGeminiResponse(
            candidates=[{"content": {"parts": [{"text": "Recovered via fallback model."}]}}]
        )

    monkeypatch.setattr(llm, "_api_key", lambda: "test-key")
    monkeypatch.setattr(llm, "_post", flaky_post)
    monkeypatch.setattr(llm, "time", type("T", (), {"sleep": lambda *a: None})())

    response = client.post("/api/v1/ai/chat", json=_chat_payload())
    assert response.status_code == 200
    assert response.json()["reply"] == "Recovered via fallback model."
    # Primary tried twice (URLs identical), then a different fallback model URL.
    assert len(set(calls)) == 2


def test_chat_does_not_retry_non_retryable_errors(monkeypatch):
    """404 (unknown model) or auth errors should fail fast, not burn retries."""
    calls = []

    def rejecting_post(url, **kwargs):
        calls.append(url)
        return _FakeGeminiResponse(status_code=404)

    monkeypatch.setattr(llm, "_api_key", lambda: "test-key")
    monkeypatch.setattr(llm, "_post", rejecting_post)

    response = client.post("/api/v1/ai/chat", json=_chat_payload())
    assert response.status_code == 503
    assert len(calls) == 1  # no fallback/retry for a hard 404


def test_generate_text_returns_none_when_all_models_exhausted(monkeypatch):
    calls = []

    def always_down(url, **kwargs):
        calls.append(url)
        return _FakeGeminiResponse(status_code=503)

    monkeypatch.setattr(llm, "_api_key", lambda: "test-key")
    monkeypatch.setattr(llm, "_post", always_down)
    monkeypatch.setattr(llm, "time", type("T", (), {"sleep": lambda *a: None})())

    assert llm.generate_text(messages=[{"role": "user", "content": "hi"}]) is None
    assert len(calls) >= 3  # primary x2 + at least one fallback
