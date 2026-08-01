"""Chat service — orchestrates a single chat turn around the graph pipeline.

Loads clinic + conversation context, seeds the graph state, runs the
deterministic node pipeline, and persists the turn. The graph itself owns all
NLU, slot filling and action logic.

Persistence note: chat history lives in messages, one row per full
turn (the patient's message_text + the bot's llm_response together), rather
than a one-row-per-role/content shape. To keep feeding the graph nodes
(intent/entity-extractor prompts) the [{role, content}, ...] format they
already expect, _expand_history() unpacks each turn row back into a
user/assistant pair.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from zoneinfo import ZoneInfo

from app.graph.graph import run_chat_graph
from app.graph.state import ChatState
from app.repo.chat_repo import ChatMessageRepo
from app.repo.clinic_repo import ClinicRepo
from app.repo.conversation_repo import ConversationRepo
from app.services.faq_service import get_all_faqs_for_context
from app.services.settings_service import get_general_settings


def _expand_history(turn_rows: List[dict]) -> List[Dict[str, str]]:
    history: List[Dict[str, str]] = []
    for row in turn_rows:
        if row.get("message_text"):
            history.append({"role": "user", "content": row["message_text"]})
        if row.get("llm_response"):
            history.append({"role": "assistant", "content": row["llm_response"]})
    return history


async def submit_feedback(message_id: str, feedback_type: int, feedback_value: str) -> bool:
    """Patient thumbs up/down on a bot reply."""
    updated = await ChatMessageRepo.set_feedback(message_id, feedback_type, feedback_value)
    return updated is not None


async def get_chat_history(clinic_id: int, session_id: str) -> List[Dict[str, str]]:
    """Reload a past session's turns as [{role, content}, ...] pairs, oldest
    first -- backs the chat UI's 'Recent' sidebar so clicking an old session
    actually restores its messages."""
    conv = await ConversationRepo.get_by_session_id(session_id)
    if not conv or conv.get("clinic_id") != clinic_id:
        return []
    turn_rows = await ChatMessageRepo.list_by_conversation(conv["id"])
    return _expand_history(turn_rows)


async def list_conversations_for_patient(
    clinic_id: int, phone: str, page: int = 1, page_size: int = 20
) -> Dict[str, Any]:
    """Paginated conversation history for a logged-in patient -- the chat
    sidebar loads this a page at a time (infinite scroll) rather than
    fetching everything up front."""
    return await ConversationRepo.list_by_phone_paginated(clinic_id, phone, page=page, page_size=page_size)


async def get_chat_response(
    clinic_id: int,
    session_id: str,
    user_message: str,
    patient_phone: str | None = None,
    patient_name: str | None = None,
    language: str | None = None,
) -> Tuple[str, List[str], str, str]:
    try:
        clinic = await ClinicRepo.get_by_id(clinic_id)
    except ValueError:
        return "Clinic not found.", [], "", language or "en"

    # Priority order matters here, and got this backwards before:
    #   1. Actual Urdu script in THIS message is the strongest signal --
    #      someone typing Urdu should just work even if they never touched
    #      the language toggle (which defaults to 'en' until clicked).
    #   2. Otherwise, the frontend's explicit selection is sticky -- this is
    #      what stops a Latin-script quick-reply tap (a doctor's name, "9:00
    #      AM") from silently flipping an Urdu conversation back to English,
    #      since that one message's script alone says nothing about which
    #      language the conversation is actually in.
    #   3. Only fall back to the clinic's configured default when the
    #      caller gives us neither (e.g. an older client).
    if any(ord(c) > 1536 for c in user_message):
        lang = "ur"
    elif language in ("en", "ur"):
        lang = language
    else:
        general = await get_general_settings(clinic_id)
        lang = general.get("default_language", "en")

    # Get or create the conversation for this session. If the patient is
    # "logged in" (basic phone-based identity, no password), attach that
    # identity now -- this is what lets the chat sidebar list their past
    # conversations across sessions. `language` is kept in sync every turn
    # too, so the conversation record always reflects what it's actually
    # being conducted in (not just whatever the first message happened to be).
    conv = await ConversationRepo.get_by_session_id(session_id)
    if not conv:
        conv = await ConversationRepo.create(
            {
                "clinic_id": clinic_id,
                "session_id": session_id,
                "patient_phone": patient_phone,
                "patient_name": patient_name,
                "language": lang,
            }
        )
    else:
        updates: Dict[str, Any] = {}
        if patient_phone and conv.get("patient_phone") != patient_phone:
            updates["patient_phone"] = patient_phone
            updates["patient_name"] = patient_name
        if conv.get("language") != lang:
            updates["language"] = lang
        if updates:
            conv = await ConversationRepo.update(conv["id"], updates)

    # Prior turns (oldest -> newest), unpacked into role/content pairs for
    # node context (see _expand_history docstring above).
    turn_rows = await ChatMessageRepo.list_by_conversation(conv["id"])
    history = _expand_history(turn_rows)

    faqs = await get_all_faqs_for_context(clinic_id)

    state: ChatState = {
        "clinic_id": clinic_id,
        "session_id": session_id,
        "lang": lang,
        "clinic": clinic,
        "faqs": faqs,
        "user_message": user_message,
        "history": history,
        "slots": {},
        "entities": {},
    }

    result = await run_chat_graph(state)
    final_reply = result.get("final_reply", "")
    quick_replies = result.get("quick_replies", [])

    # Persist the whole turn as one row, plus lightweight debugging context.
    context, traces = _serialize_debug_fields(result)
    local_created_at, server_created_at = _clinic_local_and_server_now(clinic.get("timezone"))
    turn = await ChatMessageRepo.create_turn(
        conversation_id=conv["id"],
        message_text=user_message,
        llm_response=final_reply,
        context=context,
        traces=traces,
        local_created_at=local_created_at,
        server_created_at=server_created_at,
    )

    return final_reply, quick_replies, turn["message_id"], lang


def _clinic_local_and_server_now(clinic_timezone: str | None) -> Tuple[datetime, datetime]:
    """The current instant, expressed both as the clinic's local wall clock
    (naive, for local_created_at) and as UTC (aware, for server_created_at)."""
    server_now = datetime.now(timezone.utc)
    try:
        local_now = server_now.astimezone(ZoneInfo(clinic_timezone)).replace(tzinfo=None)
    except Exception:
        # Unknown/missing timezone -- fall back to the UTC instant rather
        # than failing the whole chat turn over a data-quality issue.
        local_now = server_now.replace(tzinfo=None)
    return local_now, server_now


def _serialize_debug_fields(result: Dict[str, Any]) -> Tuple[str, str]:
    """Best-effort JSON snapshots for the context/traces columns -- never let
    a serialization hiccup break the chat reply."""
    try:
        context = json.dumps(result.get("response_payload"), ensure_ascii=False, default=str)
    except Exception:
        context = None
    try:
        traces = json.dumps(
            {
                "intent": result.get("intent"),
                "slots": result.get("slots"),
                "entities": result.get("entities"),
            },
            ensure_ascii=False,
            default=str,
        )
    except Exception:
        traces = None
    return context, traces
