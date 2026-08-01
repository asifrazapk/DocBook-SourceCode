from typing import Any, Dict, Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class ConversationRepo(BasePostgresModel):
    TABLE = "conversations"

    @classmethod
    async def get_by_session_id(cls, session_id: str) -> Optional[dict]:
        try:
            return await cls.get_by_field("session_id", session_id)
        except ValueError:
            return None

    @classmethod
    async def list_by_phone_paginated(
        cls, clinic_id: int, phone: str, page: int = 1, page_size: int = 20
    ) -> Dict[str, Any]:
        """Every past conversation for this phone identity, newest activity
        first -- backs the chat sidebar's infinite-scroll history list (never
        loads everything at once)."""
        async with get_read_pool().acquire() as conn:
            total = await conn.fetchval(
                """
                SELECT COUNT(*) FROM conversations
                WHERE clinic_id = $1 AND patient_phone = $2
                  AND (is_deleted = false OR is_deleted IS NULL)
                """,
                clinic_id,
                phone,
            )
            page = max(1, page)
            page_size = max(1, min(page_size, 100))
            offset = (page - 1) * page_size

            rows = await conn.fetch(
                """
                SELECT
                    c.id, c.session_id, c.local_created_at, c.language,
                    (SELECT m.message_text FROM messages m
                     WHERE m.conversation_id = c.id
                     ORDER BY m.local_created_at ASC LIMIT 1) AS first_message,
                    (SELECT MAX(m.local_created_at) FROM messages m
                     WHERE m.conversation_id = c.id) AS last_activity
                FROM conversations c
                WHERE c.clinic_id = $1 AND c.patient_phone = $2
                  AND (c.is_deleted = false OR c.is_deleted IS NULL)
                ORDER BY COALESCE(
                    (SELECT MAX(m.local_created_at) FROM messages m WHERE m.conversation_id = c.id),
                    c.local_created_at
                ) DESC
                LIMIT $3 OFFSET $4
                """,
                clinic_id,
                phone,
                page_size,
                offset,
            )
            total = total or 0
            return {
                "items": [dict(r) for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, -(-total // page_size)),
            }


# NOTE: the old public.messages table (one row per role/content message) has
# been replaced by messages (one row per full turn: patient message +
# bot response together, plus context/traces/feedback). See app/repo/chat_repo.py.
