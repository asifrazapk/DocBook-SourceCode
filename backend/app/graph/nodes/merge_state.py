"""merge_state — accumulate slots across turns (multi-turn slot filling).

Loads any slots remembered from earlier turns, overlays this turn's freshly
extracted entities, and republishes the merged view. This is what lets a
patient give their name in one message and the date in the next without losing
either.

Also owns a deterministic backstop for the confirmation step: booking is the
one place a silent LLM misfire is unacceptable (a patient saying "yes" must
never just get ignored), so a short, unambiguous affirmative forces
slots['confirmed'] = True -- and forces intent back to book_appointment, in
case the classifier didn't recognise a bare "yes" as still being part of the
booking flow -- regardless of what the LLM extracted.
"""

import re

from app.graph.constants import AFFIRMATIVES, REQUIRED_BOOKING_SLOTS, Intent
from app.graph.nodes.save_memory import load_slots
from app.graph.state import ChatState

_NEGATIONS = {
    "no", "not", "nah", "nope", "cancel", "wait", "actually", "change",
    "nahi", "nahin", "نہیں",
}


def _looks_affirmative(text: str) -> bool:
    """True only for short, unambiguous affirmations ("yes", "ok confirm",
    "haan ji") -- deliberately conservative so a longer message like "yes but
    change the doctor" is left to the LLM instead of being force-confirmed."""
    normalized = re.sub(r"[^\w\s]", "", (text or "").strip().lower())
    words = normalized.split()
    if not words or len(words) > 4:
        return False
    wordset = set(words)
    if wordset & _NEGATIONS:
        return False
    return bool(wordset & set(AFFIRMATIVES))


async def merge_state_node(state: ChatState) -> dict:
    session_id = state.get("session_id", "")

    # Slots already on the state win only if newer; start from remembered slots.
    remembered = load_slots(session_id)
    merged = dict(remembered)
    merged.update(state.get("slots", {}))       # anything set earlier this run
    merged.update(state.get("entities", {}))     # this turn's extraction

    update: dict = {"slots": merged}

    if not merged.get("confirmed"):
        had_all_required = all(remembered.get(f) for f in REQUIRED_BOOKING_SLOTS)
        if had_all_required and _looks_affirmative(state.get("user_message", "")):
            merged["confirmed"] = True
            # Route back into the booking sub-flow even if the intent
            # classifier didn't tag a bare "yes" as book_appointment.
            update["intent"] = Intent.BOOK

    return update
