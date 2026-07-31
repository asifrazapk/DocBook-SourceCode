"""clinic_info — surface clinic address, phone and opening hours.

Reads the record resolved by clinic_lookup and packages it as structured facts
for the response composer.
"""

from app.graph.state import ChatState


async def clinic_info_node(state: ChatState) -> dict:
    clinic = state.get("matched_clinic") or state.get("clinic") or {}

    payload = {
        "intent": "clinic_info",
        "name": clinic.get("name"),
        "address": clinic.get("address"),
        "phone": clinic.get("phone"),
        "email": clinic.get("email"),
        "opening_hours": clinic.get("opening_hours") or {},
    }
    return {"response_payload": payload}
