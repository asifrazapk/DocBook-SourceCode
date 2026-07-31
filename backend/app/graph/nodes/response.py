"""response — produce the final patient-facing reply and quick replies.

Two paths:
1. A deterministic ``final_reply`` was set upstream (emergency, ask_missing,
   confirmation summary, booking/cancel/reschedule result, invalid input). We
   keep it verbatim — protecting critical strings like appointment IDs — and
   only attach quick replies.
2. Softer intents (faq, doctor_info, clinic_info, greeting) provide structured
   facts in ``response_payload``; we compose a warm bilingual reply via the LLM.
"""

from app.graph.constants import EMERGENCY_NUMBERS, QUICK_REPLIES, Intent
from app.graph.llm import complete
from app.graph.prompts import build_response_messages
from app.graph.state import ChatState


async def response_node(state: ChatState) -> dict:
    lang = state.get("lang", "en")
    intent = state.get("intent", Intent.OTHER)

    # ---- deterministic replies -----------------------------------------
    if state.get("intent") == Intent.EMERGENCY and not state.get("final_reply"):
        reply = _emergency_reply(lang)
        return {"final_reply": reply, "quick_replies": []}

    if intent == Intent.INVALID and not state.get("final_reply"):
        reply = _invalid_reply(state.get("input_error"), lang)
        return {"final_reply": reply, "quick_replies": []}

    if intent == Intent.GREETING and not state.get("final_reply"):
        reply = _greeting_reply(state.get("clinic", {}), lang)
        return {"final_reply": reply, "quick_replies": _quick_replies(state, lang)}

    existing = state.get("final_reply")
    if existing:
        return {"final_reply": existing, "quick_replies": _quick_replies(state, lang)}

    # ---- composed replies ----------------------------------------------
    payload = state.get("response_payload") or {"intent": intent}
    clinic = state.get("clinic", {})

    messages = build_response_messages(clinic=clinic, payload=payload, lang=lang)
    try:
        reply = await complete(messages, temperature=0.4)
    except Exception:
        reply = _fallback_reply(lang)

    if not reply:
        reply = _fallback_reply(lang)

    return {"final_reply": reply, "quick_replies": _quick_replies(state, lang)}


# ---------------------------------------------------------------------------
def _quick_replies(state: ChatState, lang: str) -> list[str]:
    intent = state.get("intent", Intent.OTHER)
    table = QUICK_REPLIES.get(lang, QUICK_REPLIES["en"])
    # Only show "post booking" chips once a booking has actually gone
    # through -- intent stays BOOK while still collecting info or awaiting
    # confirmation, which shouldn't imply the appointment already exists.
    if intent == Intent.BOOK and state.get("action_result"):
        return table["post_booking"]
    if intent in (Intent.DOCTOR_INFO, Intent.AVAILABILITY):
        return table["doctors"]
    return table["default"]


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
