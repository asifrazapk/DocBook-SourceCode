"""reschedule — move an existing appointment to a new date/time.

Needs ``appointment_id`` plus at least one of the new date/time. Validates the
appointment belongs to this clinic, then updates it through
appointment_service.reschedule_appointment, which releases the old
pre-generated slot (if any) and claims a new one (if one exists for the new
date/time) — asking the patient to pick another time if it's already taken.
"""

from datetime import date as date_type

from app.graph.constants import DATE_RE, TIME_RE
from app.graph.state import ChatState
from app.services.appointment_service import (
    SlotUnavailableError,
    get_appointment,
    reschedule_appointment,
)


async def reschedule_node(state: ChatState) -> dict:
    slots = state.get("slots", {})
    lang = state.get("lang", "en")
    appt_id = slots.get("appointment_id")

    if not appt_id:
        reply = (
            "کس اپوائنٹمنٹ کو تبدیل کرنا ہے؟ براہ کرم آئی ڈی بتائیں۔"
            if lang == "ur"
            else "Which appointment should I move? Please share the appointment ID."
        )
        return {"final_reply": reply}

    new_date = slots.get("appointment_date")
    new_time = slots.get("appointment_time")
    if not new_date and not new_time:
        reply = (
            "نئی تاریخ یا وقت بتائیں۔"
            if lang == "ur"
            else "What new date or time would you like?"
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

    parsed_date = None
    if new_date and DATE_RE.match(str(new_date)):
        parsed_date = date_type.fromisoformat(str(new_date))

    parsed_time = new_time if (new_time and TIME_RE.match(str(new_time))) else None

    try:
        result = await reschedule_appointment(int(appt_id), new_date=parsed_date, new_time=parsed_time)
    except SlotUnavailableError:
        reply = (
            "معذرت، یہ نیا وقت پہلے سے بک ہے۔ براہ کرم کوئی اور وقت بتائیں۔"
            if lang == "ur"
            else "Sorry, that new time is already booked. Could you share another time?"
        )
        return {"final_reply": reply}

    if not result:
        reply = (
            f"آئی ڈی #{appt_id} کے ساتھ کوئی اپوائنٹمنٹ نہیں ملی۔"
            if lang == "ur"
            else f"I couldn't find an appointment with ID #{appt_id}."
        )
        return {"final_reply": reply}

    if lang == "ur":
        reply = f"اپوائنٹمنٹ #{appt_id} کو {new_date or existing['appointment_date']} {new_time or ''} پر منتقل کر دیا گیا ہے۔"
    else:
        reply = f"Appointment #{appt_id} has been moved to {new_date or existing['appointment_date']} {new_time or ''}.".strip()

    cleared = {k: v for k, v in slots.items() if k not in ("appointment_id", "appointment_date", "appointment_time")}
    return {"action_result": result, "final_reply": reply, "slots": cleared}
