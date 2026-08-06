"""my_appointments — patient asking whether their own appointment is
confirmed/cancelled/completed/etc.

Phone-verified: uses the phone the patient logged into the chat with, the
same pattern as medical_record.py's prescription lookup. Returns their most
recent bookings (upcoming and past) so the response node can summarize
status for each.
"""

from app.graph.state import ChatState
from app.services.appointment_service import list_appointments_for_phone


async def my_appointments_node(state: ChatState) -> dict:
    clinic_id = state["clinic_id"]
    phone = state.get("patient_phone")

    if not phone:
        return {
            "response_payload": {"intent": "check_appointment_status", "appointments": [], "not_logged_in": True},
        }

    appts = await list_appointments_for_phone(clinic_id, phone, limit=10)

    slim = [
        {
            "appointment_id": a["id"],
            "appointment_date": str(a.get("appointment_date")),
            "appointment_time": str(a.get("appointment_time"))[:5],
            "doctor_name": a.get("doctor_name"),
            "status": a.get("status"),
            "status_note": a.get("status_note"),
            "reason": a.get("reason"),
        }
        for a in appts
    ]

    return {"response_payload": {"intent": "check_appointment_status", "appointments": slim, "not_logged_in": False}}
