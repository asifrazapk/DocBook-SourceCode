"""cancel — cancel an existing appointment by ID.

Needs ``appointment_id`` in the slots. If it's missing, asks for it (the turn
ends and the patient supplies it next). Verifies the appointment belongs to this
clinic before cancelling.
"""

from app.graph.state import ChatState
from app.services.appointment_service import cancel_appointment, get_appointment


async def cancel_node(state: ChatState) -> dict:
    slots = state.get("slots", {})
    lang = state.get("lang", "en")
    appt_id = slots.get("appointment_id")

    if not appt_id:
        reply = (
            "منسوخی کے لیے براہ کرم اپوائنٹمنٹ آئی ڈی بتائیں۔"
            if lang == "ur"
            else "Which appointment should I cancel? Please share the appointment ID."
        )
        return {"final_reply": reply}

    existing = await get_appointment(int(appt_id))
    if not existing or existing.get("clinic_id") != state["clinic_id"]:
        reply = (
            f"آئی ڈی #{appt_id} کے ساتھ کوئی اپوائنٹمنٹ نہیں ملی۔"
            if lang == "ur"
            else f"I couldn't find an appointment with ID #{appt_id}."
        )
        return {"final_reply": reply}

    result = await cancel_appointment(int(appt_id))
    if lang == "ur":
        reply = f"اپوائنٹمنٹ #{appt_id} منسوخ کر دی گئی ہے۔"
    else:
        reply = f"Appointment #{appt_id} has been cancelled."

    # Drop the id so a stray follow-up doesn't re-cancel.
    cleared = {k: v for k, v in slots.items() if k != "appointment_id"}
    return {"action_result": result, "final_reply": reply, "slots": cleared}
