"""Conditional-edge routing functions for the MediBot chat graph.

Each function reads the current ChatState and returns the name of the next node.
Keeping all routing in one file makes the control flow easy to audit against the
graph wiring in graph.py.
"""

from app.graph.constants import Intent
from app.graph.state import ChatState

# ---------------------------------------------------------------------------
# After preprocess: bail out early on invalid input.
# ---------------------------------------------------------------------------
def route_after_preprocess(state: ChatState) -> str:
    if state.get("intent") == Intent.INVALID:
        return "response"
    return "intent"


# ---------------------------------------------------------------------------
# After merge_state: fan out by intent.
# ---------------------------------------------------------------------------
def route_by_intent(state: ChatState) -> str:
    intent = state.get("intent", Intent.OTHER)

    mapping = {
        Intent.FAQ: "faq",
        Intent.DOCTOR_INFO: "doctor_lookup",
        Intent.AVAILABILITY: "doctor_lookup",
        Intent.CLINIC_INFO: "clinic_lookup",
        Intent.BOOK: "validator",
        Intent.CANCEL: "cancel",
        Intent.RESCHEDULE: "reschedule",
        Intent.MEDICAL_RECORD: "medical_record",
        Intent.MY_APPOINTMENTS: "my_appointments",
    }
    # greeting / emergency / other / invalid -> straight to memory+response
    return mapping.get(intent, "save_memory")


# ---------------------------------------------------------------------------
# After doctor_lookup: shared by doctor_info, availability and booking.
# ---------------------------------------------------------------------------
def route_after_doctor_lookup(state: ChatState) -> str:
    intent = state.get("intent")
    if intent == Intent.DOCTOR_INFO:
        return "doctor_info"
    # AVAILABILITY and BOOK both need the availability check next.
    return "availability"


# ---------------------------------------------------------------------------
# After availability: booking continues to confirmation; a plain availability
# question goes straight to the response.
# ---------------------------------------------------------------------------
def route_after_availability(state: ChatState) -> str:
    if state.get("intent") == Intent.BOOK:
        return "confirmation"
    return "save_memory"


# ---------------------------------------------------------------------------
# After validator: missing/invalid -> ask; complete -> resolve the doctor.
# ---------------------------------------------------------------------------
def route_after_validation(state: ChatState) -> str:
    if state.get("missing_fields") or state.get("validation_error"):
        return "ask_missing"
    return "doctor_lookup"


# ---------------------------------------------------------------------------
# After confirmation: affirmed -> book; otherwise end the turn asking to confirm.
# ---------------------------------------------------------------------------
def route_after_confirmation(state: ChatState) -> str:
    if state.get("slots", {}).get("confirmed"):
        return "booking"
    return "save_memory"
