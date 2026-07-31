"""preprocess — clean the incoming message, detect language and emergencies.

First node in the pipeline. Owns basic input validation so the rest of the
graph can assume a usable, trimmed message. On invalid input it short-circuits
to the response node via route_after_preprocess.
"""

from app.graph.constants import EMERGENCY_KEYWORDS, MAX_MESSAGE_LENGTH, Intent
from app.graph.state import ChatState


def _detect_lang(text: str) -> str:
    # Any Arabic/Urdu-script codepoint -> Urdu. (Roman Urdu is handled by the LLM.)
    return "ur" if any(ord(c) > 1536 for c in text) else "en"


def _is_emergency(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in EMERGENCY_KEYWORDS)


async def preprocess_node(state: ChatState) -> dict:
    raw = state.get("user_message", "") or ""
    cleaned = raw.strip()
    lang = state.get("lang") or _detect_lang(cleaned)

    if not cleaned:
        return {
            "raw_message": raw,
            "user_message": cleaned,
            "lang": lang,
            "intent": Intent.INVALID,
            "input_error": "empty_message",
        }

    if len(cleaned) > MAX_MESSAGE_LENGTH:
        return {
            "raw_message": raw,
            "user_message": cleaned[:MAX_MESSAGE_LENGTH],
            "lang": lang,
            "intent": Intent.INVALID,
            "input_error": "too_long",
        }

    if _is_emergency(cleaned):
        return {
            "raw_message": raw,
            "user_message": cleaned,
            "lang": lang,
            "is_emergency": True,
            "intent": Intent.EMERGENCY,
        }

    return {
        "raw_message": raw,
        "user_message": cleaned,
        "lang": lang,
        "is_emergency": False,
        "input_error": None,
    }
