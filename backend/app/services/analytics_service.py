"""Analytics for the admin dashboard: conversation/message volume, patient
feedback, and LLM evaluation quality scores, all filterable by date range.
"""

from datetime import date as date_type
from typing import Any, Dict

from app.repo.chat_repo import ChatMessageRepo, LLMEvaluationRepo


def _round_scores(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in d.items():
        if isinstance(v, float):
            out[k] = round(v, 3)
        else:
            out[k] = v
    return out


def _compute_metrics(
    *,
    start_date: date_type,
    end_date: date_type,
    conversation_count: int,
    message_count: int,
    positive_feedback_count: int,
    total_feedback_count: int,
    llm_eval_score: float | None,
) -> Dict[str, Any]:
    """The named metrics table shown on the analytics page. NOTE on "Users":
    the schema doesn't yet track a persistent chat-user identity separate
    from a conversation (each browser session gets one conversations row) --
    so "unique users" is approximated here as unique conversations. If you
    add real chat-user identification later (e.g. capturing a phone number
    at the start of a chat), swap this for a true distinct-user count.
    """
    days = max(1, (end_date - start_date).days + 1)
    weeks = max(1.0, days / 7)
    users = conversation_count  # see docstring note above

    return _round_scores(
        {
            "conversations": conversation_count,
            "messages": message_count,
            "avg_daily_messages": message_count / days,
            "users": users,
            "avg_weekly_users": users / weeks,
            "feedback_positivity_pct": (positive_feedback_count / total_feedback_count * 100)
            if total_feedback_count
            else None,
            "feedback_completion_pct": (total_feedback_count / message_count * 100) if message_count else None,
            "llm_eval_score": llm_eval_score,
        }
    )


async def get_overview(clinic_id: int, start_date: date_type, end_date: date_type) -> Dict[str, Any]:
    totals = await ChatMessageRepo.totals(clinic_id, start_date, end_date)
    daily_counts = await ChatMessageRepo.daily_counts(clinic_id, start_date, end_date)
    feedback = await ChatMessageRepo.feedback_breakdown(clinic_id, start_date, end_date)
    llm_overall = await LLMEvaluationRepo.overall_scores(clinic_id, start_date, end_date)
    llm_daily = await LLMEvaluationRepo.daily_scores(clinic_id, start_date, end_date)
    recent = await ChatMessageRepo.list_recent_with_eval(clinic_id, start_date, end_date, limit=50)

    conversation_count = totals.get("conversation_count", 0)
    message_count = totals.get("message_count", 0)
    positive_count = sum(row["count"] for row in feedback if row["feedback_type"] == 1)
    total_feedback = sum(row["count"] for row in feedback)

    metrics = _compute_metrics(
        start_date=start_date,
        end_date=end_date,
        conversation_count=conversation_count,
        message_count=message_count,
        positive_feedback_count=positive_count,
        total_feedback_count=total_feedback,
        llm_eval_score=llm_overall.get("avg_overall_score"),
    )

    return {
        "range": {"start_date": str(start_date), "end_date": str(end_date)},
        "totals": {
            "conversation_count": conversation_count,
            "message_count": message_count,
        },
        "metrics": metrics,
        "daily": [
            {
                "date": str(row["day"]),
                "conversation_count": row["conversation_count"],
                "message_count": row["message_count"],
            }
            for row in daily_counts
        ],
        "feedback": {
            "breakdown": [
                {
                    "feedback_type": row["feedback_type"],
                    "feedback_value": row["feedback_value"],
                    "count": row["count"],
                }
                for row in feedback
            ],
            "total_with_feedback": sum(row["count"] for row in feedback),
        },
        "llm_evaluation": {
            "overall": _round_scores(
                {
                    "evaluation_count": llm_overall.get("evaluation_count") or 0,
                    "avg_relevance": llm_overall.get("avg_relevance"),
                    "avg_correctness": llm_overall.get("avg_correctness"),
                    "avg_faithfulness": llm_overall.get("avg_faithfulness"),
                    "avg_completeness": llm_overall.get("avg_completeness"),
                    "avg_overall_score": llm_overall.get("avg_overall_score"),
                    "hallucination_count": llm_overall.get("hallucination_count") or 0,
                }
            ),
            "daily": [
                _round_scores(
                    {
                        "date": str(row["day"]),
                        "evaluation_count": row["evaluation_count"],
                        "avg_overall_score": row["avg_overall_score"],
                        "avg_relevance": row["avg_relevance"],
                        "avg_correctness": row["avg_correctness"],
                        "avg_faithfulness": row["avg_faithfulness"],
                        "avg_completeness": row["avg_completeness"],
                        "hallucination_count": row["hallucination_count"],
                    }
                )
                for row in llm_daily
            ],
        },
        "recent_messages": [
            {
                "message_id": row["message_id"],
                "conversation_id": row["conversation_id"],
                "message_text": row["message_text"],
                "llm_response": row["llm_response"],
                "feedback_type": row["feedback_type"],
                "feedback_value": row["feedback_value"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "overall_score": round(row["overall_score"], 3) if row["overall_score"] is not None else None,
                "is_hallucination": row["is_hallucination"],
            }
            for row in recent
        ],
    }
