"""Backs the admin 'Conversations' page: every chat turn in tabular form,
paginated, optionally date-filtered."""

from datetime import date
from typing import Any, Dict, Optional

from app.repo.chat_repo import ChatMessageRepo


async def list_messages_paginated(
    clinic_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    return await ChatMessageRepo.list_paginated_with_eval(
        clinic_id, start_date=start_date, end_date=end_date, page=page, page_size=page_size
    )
