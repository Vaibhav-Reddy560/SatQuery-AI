import uuid
from typing import Dict, List

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.domain import QueryRequest, QueryResponse, QueryIntentOut
from backend.app.schemas.ai import (
    AgentContext,
    AgentRun,
    PointGeometry,
    PolygonGeometry,
)
from backend.app.agents.orchestrator import query_orchestrator
from backend.app.models.domain import ChatSession, ChatMessage

router = APIRouter()


# ── Adapters between the orchestrator (AgentRun) and the existing API ─────

def _agent_context_from_request(req: QueryRequest) -> AgentContext:
    """Build agent workspace context from the API request (all optional)."""
    aoi_geometry = None
    if req.aoi_geometry:
        try:
            geo_type = req.aoi_geometry.get("type")
            if geo_type == "Point":
                aoi_geometry = PointGeometry(**req.aoi_geometry)
            elif geo_type == "Polygon":
                aoi_geometry = PolygonGeometry(**req.aoi_geometry)
        except Exception:  # invalid geometry from the client -> ignore gracefully
            aoi_geometry = None
    return AgentContext(
        location_name=req.location_name,
        centre=req.centre,
        aoi_geometry=aoi_geometry,
        image_ids=list(req.image_ids or []),
        from_date=req.from_date,
        to_date=req.to_date,
    )


def _attachments_for_run(run: AgentRun) -> List[Dict[str, object]]:
    """Build QueryAttachment-style dicts from the agent result (or none)."""
    result = run.result
    if result is None:
        return []
    kind = result.kind
    if kind == "detection":
        total = result.total_features
        first_cat = next(iter(result.categories), "features")
        return [
            {"type": "map_overlay", "label": f"{total} {first_cat} overlay", "confidence": result.confidence},
            {"type": "data", "label": "Detection statistics"},
        ]
    if kind == "change":
        return [
            {"type": "map_overlay", "label": "Change detection overlay", "confidence": result.confidence},
            {"type": "data", "label": f"{len(result.changes)} changes identified"},
        ]
    if kind == "land_cover":
        return [
            {"type": "image", "label": "Land cover classification map", "confidence": result.confidence},
            {"type": "data", "label": f"{len(result.classes)} land classes"},
        ]
    if kind == "vegetation":
        overlay_label = (
            "Real NDVI overlay (Sentinel-2)" if result.overlay is not None else "Vegetation status zones"
        )
        return [
            {"type": "map_overlay", "label": overlay_label, "confidence": result.confidence},
            {"type": "data", "label": "Vegetation health summary"},
        ]
    if kind == "measurement":
        return [
            {"type": "data", "label": "Geodesic measurement summary", "confidence": result.confidence},
        ]
    return []


def _suggested_actions_for_run(run: AgentRun) -> List[str]:
    if run.result is None:
        return ["Show on map", "Ask a follow-up"]
    kind = run.result.kind
    by_kind: Dict[str, List[str]] = {
        "detection": ["Show detected features on map", "Filter by confidence", "Export results"],
        "change": ["Show changes on map", "Generate change report", "Zoom to changes"],
        "land_cover": ["View class breakdown", "Export classification", "Compare regions"],
        "vegetation": ["Show NDVI overlay on map", "Show zones on map", "Compare with baseline", "Export report"],
        "measurement": ["Save measurement", "Run land cover over AOI", "Clear selection"],
    }
    return by_kind.get(kind, ["Show on map", "Export results"])


def _query_response_from_run(run: AgentRun, session_id: str, query_id: str) -> QueryResponse:
    result = run.result
    plan = run.plan

    if result is not None:
        payload: Dict[str, object] = result.model_dump()
        confidence = result.confidence
        analysis_kind = result.kind
        location = result.location
    else:
        payload = {
            "kind": "general",
            "mode": "mock",
            "tool_id": None,
            "summary_text": run.explanation,
            "location": (plan.location if plan else None),
            "centre": (plan.centre if plan else None),
        }
        confidence = run.intent_confidence
        analysis_kind = "general"
        location = plan.location if plan else None

    return QueryResponse(
        session_id=session_id,
        query_id=query_id,
        intent=QueryIntentOut(
            type=run.intent.value,
            location=location,
            centre=plan.centre if plan else None,
            confidence=run.intent_confidence,
            detected_target=None,
        ),
        text_response=run.explanation,
        attachments=_attachments_for_run(run),
        suggested_actions=_suggested_actions_for_run(run),
        confidence=confidence,
        analysis_kind=analysis_kind,
        analysis_payload=payload,
        latency_ms=run.latency_ms,
        trace=list(run.trace),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/", response_model=QueryResponse)
def execute_query(req: QueryRequest, db: Session = Depends(get_db)):
    """
    Runs the agent pipeline (intent -> plan -> tool -> analysis -> explanation)
    over the optional AOI/workspace context. The response shape is unchanged
    from the previous mock VLM endpoint, so existing clients keep working.
    """
    session_id = req.session_id
    if not session_id:
        session = ChatSession(title=f"Query: {req.query[:30]}...")
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id

    # Execute the agent pipeline (mock or live analysis services).
    agent_run = query_orchestrator.run(
        raw_query=req.query,
        context=_agent_context_from_request(req),
    )

    query_id = str(uuid.uuid4())

    # Save user message & assistant message to DB (unchanged behaviour).
    user_msg = ChatMessage(
        session_id=session_id,
        sender="user",
        text=req.query,
    )
    asst_msg = ChatMessage(
        session_id=session_id,
        sender="assistant",
        text=agent_run.explanation,
        intent_type=agent_run.intent.value,
        intent_confidence=agent_run.intent_confidence,
        attachments=_attachments_for_run(agent_run),
        suggested_actions=_suggested_actions_for_run(agent_run),
    )
    db.add(user_msg)
    db.add(asst_msg)
    db.commit()

    return _query_response_from_run(agent_run, session_id, query_id)


@router.get("/stream")
async def stream_query_response(q: str, location: str = "Selected AOI"):
    """
    SSE endpoint streaming the agent explanation word-by-word (kept from the
    original mock VLM endpoint; now driven by the same orchestrator).
    """
    async def event_generator():
        agent_run = query_orchestrator.run(
            raw_query=q,
            context=AgentContext(location_name=location),
        )
        for word in agent_run.explanation.split(" "):
            yield f"data: {word} \n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
