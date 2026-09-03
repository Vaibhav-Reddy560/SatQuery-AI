"""
Gemini (Google AI) text-generation client for the SatQuery assistant.

Kept deliberately thin: it calls the public ``generateContent`` REST API
over ``httpx`` (already a core dependency) instead of pulling in the
Google SDK, and it never raises — every failure mode (no API key, network
error, HTTP error, empty response) returns ``None`` so callers can fall
back to the deterministic engine instead of surfacing a crash.

The free tier is prone to transient ``503 high demand`` responses and
model ids get retired (Gemini 2.x flash now returns 404 for new keys), so
``generate_text`` retries once and then automatically falls through an
ordered list of current flash models before giving up.

Configure with:

    GOOGLE_API_KEY=<AI Studio key>   # https://aistudio.google.com/apikey
    GEMINI_MODEL=gemini-3.8-flash    # primary model, override as needed

The key stays server-side: the browser only ever talks to this backend,
never to Google directly.
"""

import logging
import time
from typing import Dict, List, Optional

import httpx

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

_GENERATE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/{model}:generateContent"
)
_TIMEOUT_S = 60.0

# Ordered fallbacks when the primary model is transiently overloaded (503/429)
# or no longer served (404 for new keys). Only verified current 3.x ids.
_FALLBACK_MODELS = ("gemini-3.5-flash", "gemini-3.7-flash")

# HTTP statuses that mean "try again (maybe another model)" rather than
# "the request itself is wrong".
_RETRYABLE_STATUS = {429, 500, 503}


def _api_key() -> Optional[str]:
    key = (settings.GOOGLE_API_KEY or "").strip()
    return key or None


def available() -> bool:
    """True when an API key is configured (endpoint may still fail)."""
    return _api_key() is not None


def model_name() -> str:
    return settings.GEMINI_MODEL


def _build_payload(
    system_prompt: Optional[str],
    messages: List[Dict[str, str]],
    temperature: Optional[float],
    max_output_tokens: Optional[int],
) -> Optional[Dict[str, object]]:
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
    return payload


def _call_model(model: str, key: str, payload: Dict[str, object]) -> httpx.Response:
    """One generateContent call. Module seam ``_post`` is patchable in tests."""
    return _post(
        _GENERATE_URL.format(model=model),
        params={"key": key},
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=_TIMEOUT_S,
    )


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
    configured or every upstream attempt fails.
    """
    key = _api_key()
    if key is None:
        logger.info("Gemini not configured (GOOGLE_API_KEY unset) — skipping LLM call.")
        return None

    payload = _build_payload(system_prompt, messages, temperature, max_output_tokens)
    if payload is None:
        return None

    models: List[str] = [settings.GEMINI_MODEL]
    for fallback in _FALLBACK_MODELS:
        if fallback not in models:
            models.append(fallback)

    # First model gets one immediate retry; fallbacks are each tried once.
    # Keeps the worst case bounded (~6 requests) while surviving demand spikes.
    attempts = [(models[0], 0), (models[0], 1)] + [(m, 0) for m in models[1:]]

    for model, attempt in attempts:
        try:
            response = _call_model(model, key, payload)
        except httpx.HTTPError as exc:
            logger.warning("Gemini request failed (%s): %s", model, exc)
            continue

        if response.status_code == 200:
            text = _extract_text(response)
            if text:
                return text
            logger.warning("Gemini returned an empty response body for %s", model)
            return None

        if response.status_code in _RETRYABLE_STATUS:
            logger.warning(
                "Gemini %s transiently unavailable (HTTP %s) — %s",
                model,
                response.status_code,
                _brief(response),
            )
            if attempt == 0:
                time.sleep(0.6)
            continue

        # Non-retryable (401/403 auth, 404 unknown model, 400 bad request…).
        logger.warning(
            "Gemini %s rejected the request (HTTP %s): %s",
            model,
            response.status_code,
            _brief(response),
        )
        return None

    logger.warning("Gemini unavailable across all candidate models.")
    return None


def _brief(response: httpx.Response) -> str:
    return response.text[:200].replace("\n", " ") or f"(empty body, HTTP {response.status_code})"


def _extract_text(response: httpx.Response) -> Optional[str]:
    try:
        data = response.json()
    except ValueError as exc:
        logger.warning("Gemini returned invalid JSON: %s", exc)
        return None
    candidates = data.get("candidates") or []
    if not candidates:
        logger.warning("Gemini returned no candidates: %s", str(data)[:200])
        return None
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
    return text or None


# Module-level seam so tests can stub the network call without a live key.
_post = httpx.post
