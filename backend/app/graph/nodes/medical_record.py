"""medical_record — patient asks to see their prescription/report.

Phone-verified: uses the phone the patient logged into the chat with (set
once via ChatLogin, carried in state["patient_phone"]) rather than trusting
anything the message itself claims about identity. If they mention a
specific appointment number, that narrows the lookup; otherwise falls back
to their most recent record for this clinic.
"""

from app.graph.state import ChatState
from app.services.medical_record_service import lookup_for_patient, lookup_recent_for_phone


async def medical_record_node(state: ChatState) -> dict:
    clinic_id = state["clinic_id"]
    phone = state.get("patient_phone")
    slots = state.get("slots", {})
    appointment_id = slots.get("appointment_id")

    if not phone:
        # Not logged in (shouldn't normally happen -- the chat app requires
        # a name+phone login before any message can be sent -- but handle it
        # gracefully rather than assuming).
        return {
            "response_payload": {"intent": "view_prescription", "records": [], "not_logged_in": True},
        }

    try:
        appt_id_int = int(appointment_id) if appointment_id else None
    except (TypeError, ValueError):
        appt_id_int = None

    if appt_id_int:
        records = await lookup_for_patient(clinic_id, phone, appointment_id=appt_id_int)
    else:
        records = await lookup_recent_for_phone(clinic_id, phone)

    slim = [
        {
            "appointment_id": r["appointment_id"],
            "appointment_date": str(r.get("appointment_date")),
            "doctor_name": r.get("doctor_name"),
            "diagnosis": r.get("diagnosis"),
            "prescription": r.get("prescription"),
            "notes": r.get("notes"),
        }
        for r in records
    ]

    return {"response_payload": {"intent": "view_prescription", "records": slim, "not_logged_in": False}}
