"""response — produce the final patient-facing reply and quick replies.

Two paths for the REPLY text:
1. A deterministic ``final_reply`` was set upstream (emergency, ask_missing,
   confirmation summary, booking/cancel/reschedule result, invalid input). We
   keep it verbatim — protecting critical strings like appointment IDs — and
   attach quick replies via a fast, local rule set (no LLM round-trip: these
   replies are fixed strings from a small, well-understood set of situations,
   so there's nothing for a model call to add here except latency).
2. Softer intents (faq, doctor_info, clinic_info, greeting) provide structured
   facts in ``response_payload``; we compose a warm bilingual reply AND its
   quick replies together in one LLM call (see prompts/response_prompt.py's
   QUICK_REPLY_RULES) -- this doesn't add latency since composing the reply
   already needs a call regardless.
"""

from typing import List

from app.graph.constants import EMERGENCY_NUMBERS, QUICK_REPLIES, Intent
from app.graph.llm import complete_json
from app.graph.prompts import build_response_messages
from app.graph.state import ChatState


async def response_node(state: ChatState) -> dict:
    lang = state.get("lang", "en")
    intent = state.get("intent", Intent.OTHER)

    # ---- deterministic replies -----------------------------------------
    if intent == Intent.EMERGENCY and not state.get("final_reply"):
        return {"final_reply": _emergency_reply(lang), "quick_replies": []}

    if intent == Intent.INVALID and not state.get("final_reply"):
        return {"final_reply": _invalid_reply(state.get("input_error"), lang), "quick_replies": []}

    if intent == Intent.GREETING and not state.get("final_reply"):
        reply = _greeting_reply(state.get("clinic", {}), lang)
        return {"final_reply": reply, "quick_replies": _quick_replies(state, lang)}

    existing = state.get("final_reply")
    if existing:
        return {"final_reply": existing, "quick_replies": _quick_replies(state, lang)}

    # ---- composed replies (reply + quick_replies together, one call) ----
    payload = state.get("response_payload") or {"intent": intent}
    clinic = state.get("clinic", {})

    messages = build_response_messages(clinic=clinic, payload=payload, lang=lang)
    try:
        result = await complete_json(messages, temperature=0.4)
    except Exception:
        result = {}

    reply = (result.get("reply") or "").strip()
    quick_replies = _sanitize_quick_replies(result.get("quick_replies"))

    if not reply:
        reply = _fallback_reply(lang)
        quick_replies = QUICK_REPLIES.get(lang, QUICK_REPLIES["en"])["default"]
    elif lang == "ur" and not _looks_like_urdu(reply):
        try:
            retry_result = await complete_json(
                messages
                + [
                    {
                        "role": "user",
                        "content": "That was in English. Rewrite the whole JSON object with the reply entirely in Urdu script (اردو).",
                    }
                ],
                temperature=0.2,
            )
        except Exception:
            retry_result = {}
        retry_reply = (retry_result.get("reply") or "").strip()
        if retry_reply and _looks_like_urdu(retry_reply):
            reply = retry_reply
            quick_replies = _sanitize_quick_replies(retry_result.get("quick_replies")) or quick_replies
        else:
            reply = _fallback_reply(lang)
            quick_replies = QUICK_REPLIES.get(lang, QUICK_REPLIES["en"])["default"]

    return {"final_reply": reply, "quick_replies": quick_replies}


def _sanitize_quick_replies(value) -> List[str]:
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, str) and item.strip():
            cleaned.append(item.strip()[:40])
        if len(cleaned) >= 8:
            break
    return cleaned


# ---------------------------------------------------------------------------
# Fast, local quick-reply rules for the deterministic-reply path. This is the
# same logic the LLM is instructed with for the composed path (see
# prompts/response_prompt.py's QUICK_REPLY_RULES) -- kept here as plain code
# too since these situations are few, well-understood, and don't benefit from
# a model call that would only add latency.
def _quick_replies(state: ChatState, lang: str) -> List[str]:
    intent = state.get("intent", Intent.OTHER)
    table = QUICK_REPLIES.get(lang, QUICK_REPLIES["en"])

    if state.get("needs_confirmation"):
        return ["ہاں", "نہیں"] if lang == "ur" else ["Yes", "No"]

    missing = state.get("missing_fields") or []
    if missing and not state.get("validation_error"):
        chips: List[str] = []
        if "doctor_name" in missing:
            chips.append("ڈاکٹر دیکھیں" if lang == "ur" else "View doctors")
        if "appointment_date" in missing:
            chips.extend(["آج", "کل"] if lang == "ur" else ["Today", "Tomorrow"])
        return chips

    availability = state.get("availability") or {}
    if availability.get("reason") == "no_date":
        return ["آج", "کل"] if lang == "ur" else ["Today", "Tomorrow"]

    if intent == Intent.BOOK and state.get("action_result"):
        return table["post_booking"]

    if intent == Intent.AVAILABILITY and availability.get("available") is False:
        if availability.get("reason") in ("day_off", "fully_booked", "on_leave", "bad_date"):
            return (
                ["دوسری تاریخ آزمائیں", "دوسرے ڈاکٹر دیکھیں"]
                if lang == "ur"
                else ["Try another date", "View other doctors"]
            )

    payload = state.get("response_payload") or {}

    open_slots = payload.get("open_slots")
    if open_slots:
        return list(open_slots[:8])

    matched_doctor = payload.get("matched_doctor")
    if matched_doctor and intent == Intent.DOCTOR_INFO:
        return (
            ["دستیاب اوقات دیکھیں", "اپائنٹمنٹ بک کریں"]
            if lang == "ur"
            else ["View available slots", "Book appointment"]
        )

    doctors = payload.get("doctors")
    if doctors and len(doctors) > 1:
        names = [d.get("name") for d in doctors if d.get("name")]
        if names:
            return names[:6]

    if intent in (Intent.DOCTOR_INFO, Intent.AVAILABILITY):
        return table["doctors"]
    return table["default"]


def _looks_like_urdu(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return True
    urdu_letters = sum(1 for c in letters if ord(c) > 1536)
    return (urdu_letters / len(letters)) >= 0.3


def _greeting_reply(clinic: dict, lang: str) -> str:
    name = clinic.get("name") or ("کلینک" if lang == "ur" else "the clinic")
    if lang == "ur":
        return (
            f"وعلیکم السلام! 👋 میں {name} کا اسسٹنٹ ہوں۔ میں آپ کی اپوائنٹمنٹ بک کروانے، "
            "ڈاکٹرز کے بارے میں بتانے، یا کلینک سے متعلق سوالات کے جواب دینے میں مدد کر سکتا ہوں۔ "
            "آج میں آپ کی کیا مدد کر سکتا ہوں؟"
        )
    return (
        f"Hi there! 👋 I'm the virtual assistant for {name}. I can help you book an "
        "appointment, tell you about our doctors, or answer questions about the clinic. "
        "How can I help you today?"
    )


def _emergency_reply(lang: str) -> str:
    if lang == "ur":
        return (
            f"⚠️ اگر یہ ہنگامی صورتحال ہے تو فوراً {EMERGENCY_NUMBERS} پر کال کریں "
            "یا قریبی ایمرجنسی روم جائیں۔ میں طبی مشورہ نہیں دے سکتا۔"
        )
    return (
        f"⚠️ If this is an emergency, please call {EMERGENCY_NUMBERS} right away or go to "
        "the nearest emergency room. I can't provide medical advice."
    )


def _invalid_reply(code: str, lang: str) -> str:
    if code == "too_long":
        return (
            "آپ کا پیغام بہت طویل ہے — براہ کرم مختصر کریں۔"
            if lang == "ur"
            else "Your message is a bit too long — could you shorten it?"
        )
    return (
        "میں آپ کا پیغام نہیں سمجھ سکا — براہ کرم دوبارہ لکھیں۔"
        if lang == "ur"
        else "I didn't catch that — could you type your message again?"
    )


def _fallback_reply(lang: str) -> str:
    return (
        "معذرت، میں ابھی مکمل جواب نہیں دے سکا۔ کیا میں اپوائنٹمنٹ بک کرنے میں مدد کروں؟"
        if lang == "ur"
        else "Sorry, I couldn't quite answer that. Would you like help booking an appointment?"
    )
