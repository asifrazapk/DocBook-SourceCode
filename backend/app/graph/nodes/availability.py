"""availability — check whether the matched doctor can be booked on the
requested date (and time, once one is known).

Reads the doctor's recurring weekly rule (doctor_availability), one-off
exceptions (doctor_leaves) and pre-generated bookable slots (doctor_slots) via
availability_service -- replacing the old JSONB available_days check. Sets an
``availability`` result the confirmation/response nodes read. On the booking
path a negative result still flows forward so the response can suggest
another day or time.
"""

from datetime import date

from app.graph.state import ChatState
from app.services.availability_service import check_availability


async def availability_node(state: ChatState) -> dict:
    doctor = state.get("matched_doctor")
    slots = state.get("slots", {})
    req_date = slots.get("appointment_date")
    req_time = slots.get("appointment_time")

    if not doctor:
        return {
            "availability": {"available": False, "reason": "no_doctor"},
            "response_payload": {
                "intent": "check_availability",
                "note": "No specific doctor was matched -- ask which doctor or specialty they mean.",
                "doctors": [{"name": d.get("name"), "specialty": d.get("specialty")} for d in state.get("doctors", [])],
            },
        }

    if not req_date:
        # No date yet — treat as "need more info" rather than unavailable.
        return {
            "availability": {"available": None, "reason": "no_date"},
            "response_payload": {
                "intent": "check_availability",
                "doctor_name": doctor.get("name"),
                "specialty": doctor.get("specialty"),
                "note": "No date was given yet -- ask the patient which date they'd like to check.",
            },
        }

    try:
        parsed_date = date.fromisoformat(str(req_date))
    except ValueError:
        return {
            "availability": {"available": False, "reason": "bad_date"},
            "response_payload": {
                "intent": "check_availability",
                "doctor_name": doctor.get("name"),
                "note": "The date given wasn't understood -- ask them to resend it.",
            },
        }

    result = await check_availability(
        doctor_id=doctor["id"],
        doctor_name=doctor.get("name"),
        on_date=parsed_date,
        on_time=req_time,
    )

    payload = {
        "intent": "check_availability",
        "doctor_name": doctor.get("name"),
        "specialty": doctor.get("specialty"),
        "date": str(parsed_date),
        "requested_time": req_time,
        "available": result.get("available"),
        "reason": result.get("reason"),
        "open_slots": result.get("open_slots", []),
    }
    if result.get("reason") == "on_leave":
        payload["leave_reason"] = result.get("leave_reason")

    return {"availability": result, "response_payload": payload}
