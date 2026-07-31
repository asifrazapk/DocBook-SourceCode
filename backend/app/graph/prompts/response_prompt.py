"""Prompt builder for the final response-composition node."""

import json
from typing import Any, Dict, List


def build_response_messages(
    clinic: Dict[str, Any],
    payload: Dict[str, Any],
    lang: str,
) -> List[Dict[str, str]]:
    """Compose a natural bilingual reply from structured facts gathered upstream.

    ``payload`` carries the intent plus whatever the branch produced (doctor
    list, FAQ answer, availability, missing fields, etc.). The model turns those
    facts into a warm, concise reply — it must not invent details beyond them.
    """
    lang_name = "Urdu" if lang == "ur" else "English"

    system = f"""You are MediBot, the friendly virtual assistant for {clinic.get('name', 'the clinic')}.
Write the reply to the patient in {lang_name}. Be warm, concise and professional.

Rules:
- Use ONLY the facts provided below. Never invent doctors, times, prices or policy.
- Never diagnose. For medical concerns, recommend seeing a doctor.
- If facts are empty for the question, say you're not sure and offer to help book
  an appointment or answer clinic questions.
- Keep it to a few sentences of intro/context, but ALWAYS list structured facts as
  a markdown bullet list rather than folding them into prose -- they're easier to
  scan and, for slots, easier to tap/select on mobile.
- If "doctors" is present: list each doctor as "- Name — Specialty" (one per line).
- If "open_slots" is present and non-empty: list each time as its own bullet
  (e.g. "- 09:00", "- 09:30"), then ask which one they'd like. If "open_slots"
  is present but empty, say plainly that there's nothing open and suggest
  another date rather than listing nothing.
- If "schedule" (a doctor's weekly hours) is present: summarise it briefly by
  day rather than repeating every field verbatim.
- No markdown headings."""

    user = f"""Facts (JSON):
{json.dumps(payload, ensure_ascii=False, default=str)}

Write the reply now in {lang_name}."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
