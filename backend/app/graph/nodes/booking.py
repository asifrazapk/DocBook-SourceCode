"""booking — persist the confirmed appointment and clear the booking slots.

Reached only after validation, doctor lookup and an explicit confirmation, so
it trusts the slots. It writes through appointment_service.book_appointment,
which resolves-or-creates the patient record, claims a pre-generated slot if
one exists, and fires the confirmation email. On success it clears the
per-booking slots so the next booking starts clean. If the slot was grabbed
by someone else a moment earlier, it asks the patient to pick another time
instead of silently double-booking the doctor.
"""

from datetime import date as date_type

from app.graph.state import ChatState
from app.services.appointment_service import SlotUnavailableError, book_appointment

_CLEARED = [
    "patient_name", "patient_phone", "patient_email", "doctor_name",
    "doctor_id", "specialty", "appointment_date", "appointment_time",
    "reason", "confirmed",
]


async def booking_node(state: ChatState) -> dict:
    slots = state.get("slots", {})
    lang = state.get("lang", "en")
    clinic_id = state["clinic_id"]

    try:
        appt = await book_appointment(
            clinic_id=clinic_id,
            doctor_id=slots.get("doctor_id"),
            patient_name=slots.get("patient_name", ""),
            patient_phone=slots.get("patient_phone", ""),
            patient_email=slots.get("patient_email"),
            appointment_date=date_type.fromisoformat(str(slots["appointment_date"])),
            appointment_time=slots.get("appointment_time", ""),
            reason=slots.get("reason"),
            language=lang,
            patient_source="chat",
        )
    except SlotUnavailableError:
        if lang == "ur":
            reply = (
                "معذرت، یہ وقت ابھی ابھی بک ہو گیا ہے۔ براہ کرم کوئی اور وقت بتائیں۔"
            )
        else:
            reply = "Sorry, that time slot was just taken. Could you share another time?"
        # Drop only the time so the patient can pick a new one without
        # re-entering everything else.
        cleared = {k: v for k, v in slots.items() if k not in ("appointment_time", "confirmed")}
        return {"action_error": "slot_unavailable", "final_reply": reply, "slots": cleared}
    except Exception as exc:  # noqa: BLE001 — surface a friendly message, keep serving
        if lang == "ur":
            reply = "معذرت، اپوائنٹمنٹ محفوظ کرتے ہوئے مسئلہ ہوا۔ براہ کرم دوبارہ کوشش کریں۔"
        else:
            reply = "Sorry, something went wrong saving the appointment. Please try again."
        return {"action_error": str(exc), "final_reply": reply}

    if lang == "ur":
        reply = (
            f"آپ کی اپوائنٹمنٹ کنفرم ہو گئی ہے ✅ (آئی ڈی: #{appt['id']})۔ "
            f"{appt['appointment_date']} کو {appt['appointment_time']} بجے تشریف لائیں۔"
        )
    else:
        reply = (
            f"Your appointment is confirmed ✅ (ID: #{appt['id']}). "
            f"See you on {appt['appointment_date']} at {appt['appointment_time']}."
        )

    # Clear booking slots but keep patient identity-neutral state empty.
    cleared = {k: v for k, v in slots.items() if k not in _CLEARED}

    return {"action_result": appt, "final_reply": reply, "slots": cleared}
