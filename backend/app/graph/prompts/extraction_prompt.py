"""Prompt builder for the entity-extraction node."""

from datetime import date
from typing import Dict, List


def build_extraction_messages(
    user_message: str,
    history: List[Dict[str, str]],
    known_slots: Dict[str, object],
    lang: str,
) -> List[Dict[str, str]]:
    today = date.today().isoformat()

    recent = history[-6:] if history else []
    history_block = "\n".join(f"{m['role']}: {m['content']}" for m in recent)
    history_block = history_block or "(no prior turns)"

    known_block = ", ".join(f"{k}={v}" for k, v in known_slots.items() if v) or "(none)"

    system = f"""You extract appointment details from a patient's message for MediBot.
Today's date is {today} (Asia/Karachi). Resolve relative dates like "tomorrow",
"next Monday", "kal", "پرسوں" into absolute YYYY-MM-DD.

Extract ONLY fields the patient actually provides in the latest message. Do not
invent values. Normalise:
- appointment_date -> YYYY-MM-DD
- appointment_time -> HH:MM 24-hour
- patient_phone    -> digits/+ only, keep as written otherwise
- confirmed        -> true only if the patient clearly affirms a pending summary

Respond with a single JSON object using these keys (omit keys you cannot fill):
patient_name, patient_phone, patient_email, doctor_name, specialty,
appointment_date, appointment_time, reason, appointment_id, confirmed"""

    user = f"""Already-known details: {known_block}

Recent conversation:
{history_block}

Latest patient message ({lang}): {user_message}

Return the JSON now."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
