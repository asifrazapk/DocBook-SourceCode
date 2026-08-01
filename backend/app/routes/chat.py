from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.chat_service import (
    get_chat_response,
    get_chat_history,
    list_conversations_for_patient,
    submit_feedback,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    clinic_id: int
    session_id: str
    message: str
    patient_phone: str | None = None  # basic phone-based login, no password
    patient_name: str | None = None
    language: str | None = None  # explicit UI selection ('en'/'ur') -- takes
    # priority over auto-detecting from the message's script, so tapping an
    # English-looking quick reply (e.g. a doctor's name) mid-Urdu-conversation
    # doesn't silently flip the whole reply back to English.


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    quick_replies: list[str]
    message_id: str
    language: str  # the language actually used for this turn -- lets the
    # frontend sync its toggle state (e.g. the patient typed Urdu without
    # ever touching the toggle; without this the *next* message would fall
    # back to the stale 'en' default and the bug would resurface)


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatFeedback(BaseModel):
    message_id: str
    feedback_type: int  # 1 = thumbs up, 0 = thumbs down
    feedback_value: str = ""


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest):
    reply, quick_replies, message_id, used_language = await get_chat_response(
        clinic_id=body.clinic_id,
        session_id=body.session_id,
        user_message=body.message,
        patient_phone=body.patient_phone,
        patient_name=body.patient_name,
        language=body.language,
    )
    return ChatResponse(
        reply=reply, session_id=body.session_id, quick_replies=quick_replies, message_id=message_id, language=used_language
    )


@router.get("/history", response_model=list[ChatHistoryMessage])
async def chat_history(clinic_id: int, session_id: str):
    """Reload a past session's messages -- backs the chat UI's clickable
    'Recent' chat history list."""
    return await get_chat_history(clinic_id, session_id)


@router.get("/conversations")
async def chat_conversations(clinic_id: int, phone: str, page: int = 1, page_size: int = 20):
    """Paginated conversation history for a logged-in patient -- the
    sidebar's infinite-scroll list."""
    return await list_conversations_for_patient(clinic_id, phone, page=page, page_size=page_size)


@router.post("/feedback")
async def chat_feedback(body: ChatFeedback):
    ok = await submit_feedback(body.message_id, body.feedback_type, body.feedback_value)
    if not ok:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}
