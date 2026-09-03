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
