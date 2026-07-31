"""Prompt builder for the intent-classification node."""

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
- greeting: hello / thanks / small talk with no request
- emergency: medical emergency or urgent danger to life
- other: anything that fits none of the above\
"""


def build_intent_messages(
    user_message: str,
    history: List[Dict[str, str]],
    lang: str,
) -> List[Dict[str, str]]:
    labels = ", ".join(INTENT_LABELS)

    recent = history[-6:] if history else []
    history_block = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
    history_block = history_block or "(no prior turns)"

    system = f"""You are the intent classifier for MediBot, a clinic appointment assistant.
Classify the patient's LATEST message into exactly one intent.

Allowed intents:
{_INTENT_GUIDE}

Use the recent conversation for context (e.g. a bare "yes" after a booking
summary is still book_appointment; a date alone after being asked for one keeps
the previous intent).

Respond with a single JSON object and nothing else:
{{"intent": "<one of: {labels}>", "confidence": <0.0-1.0>}}"""

    user = f"""Recent conversation:
{history_block}

Latest patient message ({lang}): {user_message}

Return the JSON now."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
