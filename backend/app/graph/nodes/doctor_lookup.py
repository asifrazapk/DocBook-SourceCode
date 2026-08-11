"""doctor_lookup — resolve a doctor from the slots (by name or specialty).

Shared by doctor_info, check_availability and booking. Sets ``matched_doctor``
when it finds one and always publishes the clinic's doctor list in ``doctors``
so downstream nodes can present options if no single match is found.

For a browsing question (doctor_info) with only a specialty given (no name),
a specialty can match several doctors -- we deliberately do NOT silently pick
one; ``doctors`` is narrowed to every matching doctor so the patient sees the
full list and can pick, e.g. "who are your cardiologists?" -> lists all of
them rather than assuming which one they meant. Booking/availability intents
still need to commit to a single doctor to check slots, so they keep the
first-match behaviour there.
"""

import asyncio

from app.graph.constants import Intent
from app.graph.state import ChatState
from app.repo.doctor_repo import DoctorRepo


async def doctor_lookup_node(state: ChatState) -> dict:
    clinic_id = state["clinic_id"]
    slots = state.get("slots", {})
    intent = state.get("intent")

    name = (slots.get("doctor_name") or "").strip()

    # list_by_clinic and find_by_name are independent queries -- run them
    # concurrently instead of paying for two sequential round trips.
    if name:
        doctors, matched = await asyncio.gather(
            DoctorRepo.list_by_clinic(clinic_id),
            DoctorRepo.find_by_name(clinic_id, name),
        )
    else:
        doctors = await DoctorRepo.list_by_clinic(clinic_id)
        matched = None

    specialty = (slots.get("specialty") or "").strip().lower()
    specialty_matches = (
        [d for d in doctors if specialty in (d.get("specialty") or "").lower()] if specialty else []
    )

    if not matched and specialty_matches:
        if intent == Intent.DOCTOR_INFO and len(specialty_matches) > 1:
            # Browsing: show every doctor in that specialty rather than
            # guessing which one the patient means.
            doctors = specialty_matches
        else:
            # Booking/availability: commit to the first match so the flow
            # can keep moving; their name is always shown back to the
            # patient in the confirmation summary so this stays transparent.
            matched = specialty_matches[0]

    updates: dict = {"doctors": doctors, "matched_doctor": matched}

    # If we matched a doctor, remember their id in slots for booking.
    if matched:
        new_slots = dict(slots)
        new_slots["doctor_id"] = matched["id"]
        new_slots.setdefault("doctor_name", matched["name"])
        updates["slots"] = new_slots

    return updates
