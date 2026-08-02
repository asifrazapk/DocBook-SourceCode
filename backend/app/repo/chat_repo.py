"""Repos for chat turns (messages: one row per full turn -- the patient's
message plus the bot's response together) and quality scoring
(llm_evaluations: a subset of those turns).

These tables use an app-generated string message_id as their primary key
(not a serial "id"), and messages has no is_deleted column, so they don't
fit BasePostgresModel's get_by_id/update assumptions cleanly -- hence the
bespoke queries below rather than inheriting those two methods.

Date filtering/grouping in the analytics queries below uses local_created_at
(the clinic's own calendar day) rather than server_created_at (UTC), since
"messages on July 29" should mean July 29 in the clinic's timezone, not UTC.
"""

import uuid
from datetime import date as date_type, datetime
from typing import Any, List, Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool, get_write_pool


def new_message_id() -> str:
    return f"msg-{uuid.uuid4().hex[:20]}"


class ChatMessageRepo(BasePostgresModel):
    TABLE = "messages"

    @classmethod
    async def list_by_conversation(cls, conversation_id: int) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY server_created_at ASC
            """
            rows = await conn.fetch(query, conversation_id)
            return [dict(r) for r in rows]

    @classmethod
    async def list_thread_with_eval(cls, clinic_id: int, conversation_id: int) -> list[dict]:
        """Every message in one conversation, chronological, with feedback and
        eval score joined in -- backs the admin 'View thread' action so a
        multi-turn conversation can be reviewed as a whole instead of piecing
        it together from scattered rows on the flat messages table."""
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                m.message_id, m.conversation_id, m.message_text, m.llm_response,
                m.feedback_type, m.feedback_value, m.local_created_at,
                e.overall_score
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            LEFT JOIN llm_evaluations e ON e.message_id = m.message_id
            WHERE m.conversation_id = $1 AND c.clinic_id = $2
            ORDER BY m.local_created_at ASC
            """
            rows = await conn.fetch(query, conversation_id, clinic_id)
            return [dict(r) for r in rows]

    @classmethod
    async def create_turn(
        cls,
        conversation_id: int,
        message_text: str,
        llm_response: str,
        context: Optional[str] = None,
        traces: Optional[str] = None,
        local_created_at: Optional[datetime] = None,
        server_created_at: Optional[datetime] = None,
    ) -> dict:
        """Persist one full turn (patient message + bot response).

        local_created_at/server_created_at are optional: pass them when the
        caller knows the clinic's timezone (chat_service does) so the row
        gets a real clinic-local timestamp instead of the column default's
        same-instant placeholder.
        """
        data: dict = {
            "message_id": new_message_id(),
            "conversation_id": conversation_id,
            "message_text": message_text,
            "llm_response": llm_response,
            "context": context,
            "traces": traces,
        }
        if local_created_at is not None:
            data["local_created_at"] = local_created_at
        if server_created_at is not None:
            data["server_created_at"] = server_created_at
        return await cls.create(data)

    @classmethod
    async def set_feedback(cls, message_id: str, feedback_type: int, feedback_value: str) -> Optional[dict]:
        async with get_write_pool().acquire() as conn:
            query = """
            UPDATE messages
            SET feedback_type = $2, feedback_value = $3,
                local_updated_at = NOW(), server_updated_at = NOW()
            WHERE message_id = $1
            RETURNING *
            """
            row = await conn.fetchrow(query, message_id, feedback_type, feedback_value)
            return dict(row) if row else None

    @classmethod
    async def daily_counts(cls, clinic_id: int, start_date: date_type, end_date: date_type) -> List[dict]:
        """Conversations/messages per day for a clinic, for the analytics
        date-filtered chart. Joins through conversations for the clinic scope."""
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                m.local_created_at::date AS day,
                COUNT(*) AS message_count,
                COUNT(DISTINCT m.conversation_id) AS conversation_count
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.clinic_id = $1
              AND m.local_created_at::date BETWEEN $2 AND $3
            GROUP BY m.local_created_at::date
            ORDER BY m.local_created_at::date
            """
            rows = await conn.fetch(query, clinic_id, start_date, end_date)
            return [dict(r) for r in rows]

    @classmethod
    async def feedback_breakdown(cls, clinic_id: int, start_date: date_type, end_date: date_type) -> List[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                m.feedback_type,
                m.feedback_value,
                COUNT(*) AS count
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.clinic_id = $1
              AND m.local_created_at::date BETWEEN $2 AND $3
              AND m.feedback_type IS NOT NULL
            GROUP BY m.feedback_type, m.feedback_value
            ORDER BY count DESC
            """
            rows = await conn.fetch(query, clinic_id, start_date, end_date)
            return [dict(r) for r in rows]

    @classmethod
    async def totals(cls, clinic_id: int, start_date: date_type, end_date: date_type) -> dict:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                COUNT(*) AS message_count,
                COUNT(DISTINCT m.conversation_id) AS conversation_count
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.clinic_id = $1
              AND m.local_created_at::date BETWEEN $2 AND $3
            """
            row = await conn.fetchrow(query, clinic_id, start_date, end_date)
            return dict(row) if row else {"message_count": 0, "conversation_count": 0}

    @classmethod
    async def list_recent_with_eval(
        cls, clinic_id: int, start_date: date_type, end_date: date_type, limit: int = 50
    ) -> List[dict]:
        """Recent turns in range, with their LLM evaluation joined in (NULL
        fields if that turn was never scored) -- backs an analytics detail
        table showing message + feedback + eval side by side."""
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                m.message_id, m.conversation_id, m.message_text, m.llm_response,
                m.feedback_type, m.feedback_value, m.local_created_at AS created_at,
                e.overall_score, e.relevance, e.correctness, e.faithfulness,
                e.completeness, e.is_hallucination
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            LEFT JOIN llm_evaluations e ON e.message_id = m.message_id
            WHERE c.clinic_id = $1
              AND m.local_created_at::date BETWEEN $2 AND $3
            ORDER BY m.local_created_at DESC
            LIMIT $4
            """
            rows = await conn.fetch(query, clinic_id, start_date, end_date, limit)
            return [dict(r) for r in rows]

    @classmethod
    async def list_paginated_with_eval(
        cls,
        clinic_id: int,
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> dict:
        """Paginated conversations/messages table for the admin panel --
        every turn in range (default: no date bound), newest first, with
        feedback and LLM evaluation score joined in."""
        async with get_read_pool().acquire() as conn:
            conditions = ["c.clinic_id = $1"]
            values: List[Any] = [clinic_id]

            if start_date:
                values.append(start_date)
                conditions.append(f"m.local_created_at::date >= ${len(values)}")
            if end_date:
                values.append(end_date)
                conditions.append(f"m.local_created_at::date <= ${len(values)}")

            where_sql = " AND ".join(conditions)

            total = await conn.fetchval(
                f"""
                SELECT COUNT(*) FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                WHERE {where_sql}
                """,
                *values,
            )

            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size

            query = f"""
            SELECT
                m.message_id, m.conversation_id, c.session_id, m.message_text, m.llm_response,
                m.feedback_type, m.feedback_value, m.local_created_at, m.server_created_at,
                e.overall_score, e.relevance, e.correctness, e.faithfulness,
                e.completeness, e.is_hallucination
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            LEFT JOIN llm_evaluations e ON e.message_id = m.message_id
            WHERE {where_sql}
            ORDER BY m.local_created_at DESC
            LIMIT ${len(values) + 1} OFFSET ${len(values) + 2}
            """
            rows = await conn.fetch(query, *values, page_size, offset)

            total = total or 0
            return {
                "items": [dict(r) for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, -(-total // page_size)),
            }


class LLMEvaluationRepo(BasePostgresModel):
    TABLE = "llm_evaluations"

    @classmethod
    async def create_for_message(cls, message_id: str, conversation_id: int, scores: dict[str, Any]) -> dict:
        return await cls.create(
            {
                "message_id": message_id,
                "conversation_id": conversation_id,
                **scores,
            }
        )

    @classmethod
    async def get_by_message_id(cls, message_id: str) -> Optional[dict]:
        async with get_read_pool().acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM llm_evaluations WHERE message_id = $1", message_id
            )
            return dict(row) if row else None

    @classmethod
    async def daily_scores(cls, clinic_id: int, start_date: date_type, end_date: date_type) -> List[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                e.local_created_at::date AS day,
                COUNT(*) AS evaluation_count,
                AVG(e.relevance) AS avg_relevance,
                AVG(e.correctness) AS avg_correctness,
                AVG(e.faithfulness) AS avg_faithfulness,
                AVG(e.completeness) AS avg_completeness,
                AVG(e.overall_score) AS avg_overall_score,
                COUNT(*) FILTER (WHERE e.is_hallucination) AS hallucination_count
            FROM llm_evaluations e
            JOIN conversations c ON c.id = e.conversation_id
            WHERE c.clinic_id = $1
              AND e.local_created_at::date BETWEEN $2 AND $3
            GROUP BY e.local_created_at::date
            ORDER BY e.local_created_at::date
            """
            rows = await conn.fetch(query, clinic_id, start_date, end_date)
            return [dict(r) for r in rows]

    @classmethod
    async def overall_scores(cls, clinic_id: int, start_date: date_type, end_date: date_type) -> dict:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT
                COUNT(*) AS evaluation_count,
                AVG(e.relevance) AS avg_relevance,
                AVG(e.correctness) AS avg_correctness,
                AVG(e.faithfulness) AS avg_faithfulness,
                AVG(e.completeness) AS avg_completeness,
                AVG(e.overall_score) AS avg_overall_score,
                COUNT(*) FILTER (WHERE e.is_hallucination) AS hallucination_count
            FROM llm_evaluations e
            JOIN conversations c ON c.id = e.conversation_id
            WHERE c.clinic_id = $1
              AND e.local_created_at::date BETWEEN $2 AND $3
            """
            row = await conn.fetchrow(query, clinic_id, start_date, end_date)
            return dict(row) if row else {}
