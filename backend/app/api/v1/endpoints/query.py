import uuid
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.schemas.domain import QueryRequest, QueryResponse, QueryIntentOut
from backend.app.ml.vlm_engine import vlm_engine
from backend.app.models.domain import ChatSession, ChatMessage

router = APIRouter()

@router.post("/", response_model=QueryResponse)
def execute_query(req: QueryRequest, db: Session = Depends(get_db)):
    """
    Executes a multimodal vision-language query over satellite imagery.
    Processes natural language text query against Sentinel-1 SAR & Sentinel-2 multispectral features.
    """
    session_id = req.session_id
    if not session_id:
        session = ChatSession(title=f"Query: {req.query[:30]}...")
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    
    # Run VLM inference
    vlm_result = vlm_engine.infer(
        query=req.query,
        centre=req.centre,
        location_name=req.location_name
    )

    query_id = str(uuid.uuid4())

    # Save user message & assistant message to DB
    user_msg = ChatMessage(
        session_id=session_id,
        sender="user",
        text=req.query
    )
    asst_msg = ChatMessage(
        session_id=session_id,
        sender="assistant",
        text=vlm_result["text_response"],
        intent_type=vlm_result["intent"]["type"],
        intent_confidence=vlm_result["intent"]["confidence"],
        attachments=vlm_result["attachments"],
        suggested_actions=vlm_result["suggested_actions"]
    )
    db.add(user_msg)
    db.add(asst_msg)
    db.commit()

    return QueryResponse(
        session_id=session_id,
        query_id=query_id,
        intent=QueryIntentOut(**vlm_result["intent"]),
        text_response=vlm_result["text_response"],
        attachments=vlm_result["attachments"],
        suggested_actions=vlm_result["suggested_actions"],
        confidence=vlm_result["confidence"],
        analysis_kind=vlm_result["analysis_kind"],
        analysis_payload=vlm_result["analysis_payload"]
    )

@router.get("/stream")
async def stream_query_response(q: str, location: str = "Selected AOI"):
    """
    SSE Server-Sent Events endpoint for streaming interactive reasoning tokens from SatQuery VLM.
    """
    async def event_generator():
        vlm_result = vlm_engine.infer(query=q, location_name=location)
        text = vlm_result["text_response"]
        words = text.split(" ")
        
        for idx, word in enumerate(words):
            yield f"data: {word} \n\n"
        
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
