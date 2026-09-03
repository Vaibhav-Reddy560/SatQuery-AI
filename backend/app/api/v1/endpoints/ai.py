"""
AI Assistant endpoints.

``POST /api/v1/ai/chat`` is the ChatGPT-style conversational surface used
by every assistant on the site (Query page, per-page assistant panels).
It proxies a single Gemini completion and composes the system prompt from
the caller-supplied role instructions plus optional grounded context
(page data / AOI summary), so the model stays on-topic without the
frontend ever touching Google directly.

The backend stays deliberately generic: the *caller* decides what the
assistant is (satellite analyst on /query, page docent on analysis pages)
by sending the right ``system_prompt`` and ``context``.
"""

import time
from typing import List

from fastapi import APIRouter, HTTPException

from backend.app.schemas.domain import AiStatusOut, ChatRequest, ChatResponse
from backend.app.services import llm

router = APIRouter()


@router.get("/status", response_model=AiStatusOut)
def ai_status() -> AiStatusOut:
    """Reports whether the Gemini assistant is configured (no secrets)."""
    configured = llm.available()
    return AiStatusOut(
        provider="gemini" if configured else "offline",
        model=llm.model_name(),
        configured=configured,
    )


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """
    One assistant turn. Returns 503 when Gemini is not configured or the
    upstream call fails, so clients can degrade to their fallback path.
    """
    if not llm.available():
        raise HTTPException(
            status_code=503,
            detail="AI assistant is not configured on the server (GOOGLE_API_KEY missing).",
        )

    system_prompt = (req.system_prompt or "").strip()
    if req.context and req.context.strip():
        system_prompt = (
            f"{system_prompt}\n\n"
            f"Grounded context you may use to answer (only cite figures that "
            f"appear here; say when you don't have the data):\n{req.context.strip()}"
        ).strip()

    messages: List[dict] = [m.model_dump() for m in req.messages]
    started = time.perf_counter()
    reply = llm.generate_text(
        system_prompt=system_prompt or None,
        messages=messages,
        temperature=req.temperature,
        max_output_tokens=req.max_tokens,
    )
    latency_ms = round((time.perf_counter() - started) * 1000.0, 2)

    if reply is None:
        raise HTTPException(
            status_code=503,
            detail="The AI assistant could not generate a response right now. Please try again.",
        )

    return ChatResponse(
        reply=reply,
        model=llm.model_name(),
        latency_ms=latency_ms,
    )
