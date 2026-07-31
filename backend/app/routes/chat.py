from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.chat_service import get_chat_response, get_chat_history, submit_feedback

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    clinic_id: int
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    quick_replies: list[str]
    message_id: str


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatFeedback(BaseModel):
    message_id: str
    feedback_type: int  # 1 = thumbs up, 0 = thumbs down
    feedback_value: str = ""


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    reply, quick_replies, message_id = await get_chat_response(
        clinic_id=body.clinic_id,
        session_id=body.session_id,
        user_message=body.message,
    )
    return ChatResponse(reply=reply, session_id=body.session_id, quick_replies=quick_replies, message_id=message_id)


@router.get("/history", response_model=list[ChatHistoryMessage])
async def chat_history(clinic_id: int, session_id: str):
    """Reload a past session's messages -- backs the chat UI's clickable
    'Recent' chat history list."""
    return await get_chat_history(clinic_id, session_id)


@router.post("/feedback")
async def chat_feedback(body: ChatFeedback):
    ok = await submit_feedback(body.message_id, body.feedback_type, body.feedback_value)
    if not ok:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}
