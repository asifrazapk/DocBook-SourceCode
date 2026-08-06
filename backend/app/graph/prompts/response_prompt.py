"""Prompt builders for the response node: composing the reply text, and
generating contextually appropriate quick replies for it.

Quick replies used to be a large hardcoded if/elif chain in response.py,
re-patched every time a new conversational branch surfaced a bad chip set
(the doctor list repeating instead of "View slots", generic chips shown
while asking for a date, etc.). Chasing each of those individually doesn't
scale -- there will always be another branch. Instead, everything that chain
used to encode as *code* is encoded here as *instructions*, and the model
applies it to whatever the actual situation is, including branches nobody
explicitly coded for.
"""

import json
from typing import Any, Dict, List

QUICK_REPLY_RULES = """When suggesting quick_replies (0-4 short options the patient can tap instead
of typing), use these rules -- they come directly from real conversations
that went wrong when this was hardcoded, so follow them closely:
- If the message asks the patient to confirm a pending action (yes/no),
  quick_replies must be exactly the two answers to that question (e.g.
  "Yes"/"No"), nothing else.
- If the message asks which date the patient wants, quick_replies should be
  ["Today", "Tomorrow"] (in the reply's language) -- not a generic menu.
- If the message asks which doctor the patient wants and none is chosen yet,
  include a "View doctors" option (in the reply's language).
- If the message is asking for information that's genuinely free text (the
  patient's name, phone number, email, or reason for visit) and nothing else
  chippable, quick_replies must be an empty array -- a generic menu there is
  actively misleading, since it looks like a set of valid answers to "what's
  your name?" when it isn't.
- If the message just listed specific available time slots, quick_replies
  should be those exact times (up to 8), so the patient can tap one instead
  of retyping it.
- If the message just listed several doctors to choose from, quick_replies
  should be their names (up to 6).
- If the message just described ONE specific doctor the patient already
  picked, offer next steps like "View available slots" / "Book appointment"
  rather than repeating doctor names they've already narrowed down from.
- If a requested day/doctor genuinely isn't bookable (day off, fully booked,
  on leave, invalid date), offer something like "Try another date" / "View
  other doctors" rather than a dead-end menu.
- If the message just listed the patient's own appointments (checking
  status), offer relevant next steps like "Reschedule" / "Cancel" only if
  there's exactly one upcoming pending/confirmed appointment to act on;
  otherwise keep it to a short general menu -- don't imply an action on an
  already-cancelled or completed visit.
- If nothing above applies and the conversation is genuinely open-ended
  (e.g. a greeting, a general FAQ answer), a short general menu like "Book
  appointment" / "View doctors" / "Clinic info" is fine.
- Every quick_reply must be short (a few words), in the SAME language as the
  reply, and something the patient could plausibly send as their next
  message verbatim."""


def build_response_messages(
    clinic: Dict[str, Any],
    payload: Dict[str, Any],
    lang: str,
) -> List[Dict[str, str]]:
    """Compose a natural bilingual reply AND its quick replies together from
    structured facts gathered upstream, in one JSON-mode call.

    ``payload`` carries the intent plus whatever the branch produced (doctor
    list, FAQ answer, availability, missing fields, etc.). The model turns
    those facts into a warm, concise reply -- it must not invent details
    beyond them -- and suggests quick replies for it per QUICK_REPLY_RULES.
    """
    lang_name = "Urdu" if lang == "ur" else "English"

    language_rule = (
        (
            "Write your ENTIRE reply in Urdu, using Urdu script (اردو رسم الخط) throughout -- "
            "every sentence, every connecting word, the whole thing. Do not switch into English "
            "at any point and do not mix English sentences in with the Urdu ones. Category labels "
            "and technical terms (e.g. a specialty like 'Cardiologist') may be transliterated or "
            "kept as commonly used in Pakistani Urdu, but the surrounding sentences must still be "
            "Urdu. Proper nouns (doctor names, the clinic name) stay in their original script."
        )
        if lang == "ur"
        else "Write your entire reply in English."
    )

    system = f"""You are MediBot, the friendly virtual assistant for {clinic.get('name', 'the clinic')}.
{language_rule} Be warm, concise and professional.

Reply rules:
- Use ONLY the facts provided below. Never invent doctors, times, prices or policy.
- Never diagnose. For medical concerns, recommend seeing a doctor.
- If facts are empty for the question, say you're not sure and offer to help book
  an appointment or answer clinic questions.
- Keep it to a few sentences of intro/context, but ALWAYS list structured facts as
  a markdown bullet list rather than folding them into prose -- they're easier to
  scan and, for slots, easier to tap/select on mobile.
- If "doctors" is present: list each doctor as "- Name — Specialty" (one per line).
- If "requested_doctor_not_found" is present (a non-null name): the patient
  asked for that specific doctor by name and no one by that name is at this
  clinic. Say so plainly and directly (don't just silently list the roster
  as if nothing was asked) -- e.g. "We don't have a Dr. X here, but our
  doctors are:" -- then list the real doctors from "doctors" so the patient
  can pick a real one. Never imply the requested doctor exists or might be
  available elsewhere.
- If "open_slots" is present and non-empty: list each time as its own bullet
  (e.g. "- 9:00 AM", "- 9:30 AM"), then ask which one they'd like. If "open_slots"
  is present but empty, say plainly that there's nothing open and suggest
  another date rather than listing nothing.
- If "schedule" (a doctor's weekly hours) is present: summarise it briefly by
  day rather than repeating every field verbatim.
- If "records" is present (a prescription/report lookup): if the list is
  empty and "not_logged_in" is true, explain you need their verified phone
  (they should already be logged in) and can't show records without it. If
  the list is empty otherwise, say plainly no record was found for that
  appointment/patient number (or none on file yet) and suggest checking the
  number or contacting the clinic. If non-empty, for EACH record show the
  appointment date, doctor, diagnosis/report, and prescription clearly
  labelled (e.g. "**Diagnosis:**", "**Prescription:**") -- these are the
  patient's own medical details, present them completely and exactly as
  given, never summarised or trimmed.
- If "appointments" is present (checking booking status): if the list is
  empty and "not_logged_in" is true, explain you need their verified phone.
  If empty otherwise, say plainly you couldn't find any appointments on file
  for them. If non-empty, list each one clearly with its date, time, doctor,
  and status (pending/confirmed/cancelled/completed/rescheduled) -- if
  status_note is present (e.g. a cancellation reason), include it briefly.
  Most recent/soonest first is already the given order; don't reorder.
- No markdown headings.

{QUICK_REPLY_RULES}

Respond with a single JSON object: {{"reply": "...", "quick_replies": ["...", ...]}}"""

    user = f"""Facts (JSON):
{json.dumps(payload, ensure_ascii=False, default=str)}

Write the reply and its quick_replies now. Reminder: the reply must be entirely in {lang_name}."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
