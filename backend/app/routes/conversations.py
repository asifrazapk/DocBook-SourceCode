from datetime import date

from fastapi import APIRouter

from app.core.pagination import validate_page_size
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/messages")
async def list_messages(
    clinic_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = 1,
    page_size: int = 10,
):
    """Every chat turn (patient message + bot response) in tabular form,
    paginated, with feedback and LLM evaluation score joined in."""
    validate_page_size(page_size)
    return await conversation_service.list_messages_paginated(
        clinic_id, start_date=start_date, end_date=end_date, page=page, page_size=page_size
    )


@router.get("/{conversation_id}/thread")
async def get_conversation_thread(conversation_id: int, clinic_id: int):
    """Every message in one conversation, in order -- lets the admin review
    a multi-turn conversation as a whole instead of piecing it together from
    scattered rows on the flat messages table."""
    return await conversation_service.get_conversation_thread(clinic_id, conversation_id)
