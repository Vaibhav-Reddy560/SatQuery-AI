"""
Gemini (Google AI) text-generation client for the SatQuery assistant.

Kept deliberately thin: it calls the public ``generateContent`` REST API
over ``httpx`` (already a core dependency) instead of pulling in the
Google SDK, and it never raises — every failure mode (no API key, network
error, HTTP error, empty response) returns ``None`` so callers can fall
back to the deterministic engine instead of surfacing a crash.

Configure with:

    GOOGLE_API_KEY=<AI Studio key>   # https://aistudio.google.com/apikey
    GEMINI_MODEL=gemini-3.8-flash    # model id, override as needed

The key stays server-side: the browser only ever talks to this backend,
never to Google directly.
"""

import logging
from typing import Dict, List, Optional

import httpx

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

_GENERATE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/{model}:generateContent"
)
_TIMEOUT_S = 60.0

# Module-level seam so tests can stub the network call without a live key.
_post = httpx.post


def _api_key() -> Optional[str]:
    key = (settings.GOOGLE_API_KEY or "").strip()
    return key or None


def available() -> bool:
    """True when an API key is configured (endpoint may still fail)."""
    return _api_key() is not None


def model_name() -> str:
    return settings.GEMINI_MODEL


def generate_text(
    *,
    system_prompt: Optional[str] = None,
    messages: List[Dict[str, str]],
    temperature: Optional[float] = None,
    max_output_tokens: Optional[int] = None,
) -> Optional[str]:
    """
    Single chat completion via Gemini ``generateContent``.

    ``messages`` is a list of ``{"role": "user"|"assistant", "content": str}``
    turns, oldest first (assistant turns are mapped to Gemini's ``model``
    role). Returns the reply text, or ``None`` when the assistant is not
    configured or the upstream call fails.
    """
    key = _api_key()
    if key is None:
        logger.info("Gemini not configured (GOOGLE_API_KEY unset) — skipping LLM call.")
        return None

    contents: List[Dict[str, object]] = []
    for turn in messages:
        role = turn.get("role")
        text = (turn.get("content") or "").strip()
        if not text:
            continue
        if role not in ("user", "assistant"):
            continue
        contents.append(
            {
                "role": "model" if role == "assistant" else "user",
                "parts": [{"text": text}],
            }
        )
    if not contents:
        return None

    payload: Dict[str, object] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature
            if temperature is not None
            else settings.GEMINI_TEMPERATURE,
            "maxOutputTokens": max_output_tokens
            if max_output_tokens is not None
            else settings.GEMINI_MAX_OUTPUT_TOKENS,
        },
    }
    if system_prompt and system_prompt.strip():
        payload["systemInstruction"] = {"parts": [{"text": system_prompt.strip()}]}

    model = settings.GEMINI_MODEL
    url = _GENERATE_URL.format(model=model)
    try:
        response = _post(
            url,
            params={"key": key},
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=_TIMEOUT_S,
        )
    except httpx.HTTPError as exc:
        logger.warning("Gemini request failed: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning(
            "Gemini returned HTTP %s: %s",
            response.status_code,
            response.text[:300],
        )
        return None

    try:
        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            logger.warning("Gemini returned no candidates: %s", str(data)[:300])
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
        return text or None
    except ValueError as exc:
        logger.warning("Gemini returned invalid JSON: %s", exc)
        return None
