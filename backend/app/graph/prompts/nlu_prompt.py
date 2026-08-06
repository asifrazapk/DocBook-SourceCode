"""Prompt builder for the combined intent-classification + entity-extraction
call.

These used to be two sequential LLM round-trips per turn (plus a third for
quick-replies on some paths) -- a major source of the ~5s response time.
Classifying intent and pulling structured details out of the same message is
naturally one task for the model, so it's now one JSON-mode call.
"""

from datetime import date, timedelta
from typing import Dict, List

from app.graph.constants import INTENT_LABELS

_INTENT_GUIDE = """\
- book_appointment: patient wants to book/schedule a new visit
- cancel_appointment: patient wants to cancel an existing appointment
- reschedule_appointment: patient wants to move an existing appointment
- check_availability: patient asks whether a doctor is free on a date/time
- doctor_info: questions about doctors, specialties, who is available
- clinic_info: address, phone, opening hours, location, parking
- faq: general questions likely answered by the clinic's FAQ list
- view_prescription: patient wants to see/retrieve their prescription, report,
  or medical record from a past visit (e.g. "show my prescription", "what did
  the doctor prescribe last time", "get my report for appointment 20")
- check_appointment_status: patient asking whether THEIR OWN appointment is
  confirmed, pending, cancelled, completed, or rescheduled (e.g. "is my
  appointment confirmed?", "did my appointment get cancelled?", "what's the
  status of my booking", "show me my appointments") -- this is about
  checking an existing booking's status, not booking/cancelling/rescheduling
  a new one
- greeting: hello / thanks / small talk with no request
- emergency: medical emergency or urgent danger to life
- other: anything that fits none of the above\
"""


def build_nlu_messages(
    user_message: str,
    history: List[Dict[str, str]],
    known_slots: Dict[str, object],
    lang: str,
) -> List[Dict[str, str]]:
    labels = ", ".join(INTENT_LABELS)
    today = date.today()
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)

    recent = history[-6:] if history else []
    history_block = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
    history_block = history_block or "(no prior turns)"

    known_block = ", ".join(f"{k}={v}" for k, v in known_slots.items() if v) or "(none)"

    system = f"""You are the NLU front-end for MediBot, a clinic appointment assistant. For
the patient's LATEST message, do two things at once:

1. Classify it into exactly one intent:
{_INTENT_GUIDE}
Use the recent conversation for context (e.g. a bare "yes" after a booking
summary is still book_appointment; a date alone after being asked for one
keeps the previous intent).

2. Extract any appointment details the patient actually provided in the
LATEST message (don't invent values, and don't re-extract from "Already-known
details" -- only from what they just said). Today's date is {today.isoformat()}
(Asia/Karachi). Resolve relative dates using these exact mappings -- don't
compute the arithmetic yourself:
- "today", "آج"                          -> {today.isoformat()}
- "tomorrow", "kal", "کل"                 -> {tomorrow.isoformat()}
- "day after tomorrow", "پرسوں"           -> {day_after.isoformat()}
- any other relative phrase ("next Monday", etc.) -> resolve it yourself relative to {today.isoformat()}
Normalise: appointment_date -> YYYY-MM-DD, appointment_time -> HH:MM 24-hour,
patient_phone -> digits/+ only. confirmed -> true only if the patient clearly
affirms a pending summary.

Respond with a single JSON object and nothing else:
{{
  "intent": "<one of: {labels}>",
  "confidence": <0.0-1.0>,
  "entities": {{
    "patient_name": "...", "patient_phone": "...", "patient_email": "...",
    "doctor_name": "...", "specialty": "...", "appointment_date": "...",
    "appointment_time": "...", "reason": "...", "appointment_id": "...",
    "confirmed": true/false
  }}
}}
Omit any entity key you cannot fill from the latest message -- don't guess."""

    user = f"""Already-known details: {known_block}

Recent conversation:
{history_block}

Latest patient message ({lang}): {user_message}

Return the JSON now."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
