"""ask_missing — build a prompt asking the patient for the missing booking info.

Terminal branch for an incomplete booking: it sets a deterministic reply (so the
response node passes it through unchanged) and lets the pipeline end the turn,
waiting for the patient to supply the rest. Slots already collected are
preserved by save_memory so the next turn continues where this left off.
"""

from app.graph.constants import SLOT_LABELS_EN, SLOT_LABELS_UR
from app.graph.state import ChatState


async def ask_missing_node(state: ChatState) -> dict:
    lang = state.get("lang", "en")
    missing = state.get("missing_fields", [])
    validation_error = state.get("validation_error")

    labels = SLOT_LABELS_UR if lang == "ur" else SLOT_LABELS_EN
    wanted = [labels.get(f, f) for f in missing]

    if lang == "ur":
        if validation_error:
            reply = _format_error_ur(validation_error)
        elif wanted:
            reply = "اپوائنٹمنٹ مکمل کرنے کے لیے براہ کرم بتائیں: " + "، ".join(wanted) + "۔"
        else:
            reply = "براہ کرم اپوائنٹمنٹ کی تفصیلات فراہم کریں۔"
    else:
        if validation_error:
            reply = _format_error_en(validation_error)
        elif wanted:
            reply = "To finish booking, could you share: " + ", ".join(wanted) + "?"
        else:
            reply = "Could you share your appointment details?"

    return {"final_reply": reply}


def _format_error_en(code: str) -> str:
    return {
        "phone_invalid": "That phone number doesn't look right — please send it again (e.g. 0300-1234567).",
        "email_invalid": "That email looks off — could you double-check it?",
        "date_format": "Please give the date as YYYY-MM-DD (e.g. 2026-08-05).",
        "date_past": "That date is in the past — please pick an upcoming date.",
        "time_format": "Please give the time as HH:MM in 24-hour format (e.g. 15:30).",
    }.get(code, "Some details need fixing — could you re-send them?")


def _format_error_ur(code: str) -> str:
    return {
        "phone_invalid": "فون نمبر درست نہیں لگتا — براہ کرم دوبارہ بھیجیں (مثلاً 0300-1234567)۔",
        "email_invalid": "ای میل درست نہیں لگتا — براہ کرم دوبارہ دیکھیں۔",
        "date_format": "براہ کرم تاریخ اس طرح لکھیں: سال-مہینہ-دن (مثلاً 2026-08-05)۔",
        "date_past": "یہ تاریخ گزر چکی ہے — براہ کرم آئندہ تاریخ منتخب کریں۔",
        "time_format": "براہ کرم وقت 24 گھنٹے کی صورت میں لکھیں (مثلاً 15:30)۔",
    }.get(code, "کچھ تفصیلات درست کرنی ہیں — براہ کرم دوبارہ بھیجیں۔")
