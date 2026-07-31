"""validator — check that a booking has every required slot and valid formats.

Populates ``missing_fields`` (empty means good to proceed) and
``validation_error`` for format problems. route_after_validation sends the turn
to ask_missing when anything is missing or malformed, otherwise on to
doctor_lookup.
"""

from datetime import date

from app.graph.constants import (
    DATE_RE,
    EMAIL_RE,
    PHONE_RE,
    REQUIRED_BOOKING_SLOTS,
    TIME_RE,
)
from app.graph.state import ChatState


async def validator_node(state: ChatState) -> dict:
    slots = state.get("slots", {})
    missing: list[str] = []

    # doctor_name OR specialty satisfies the "which doctor" requirement.
    for field in REQUIRED_BOOKING_SLOTS:
        if field == "doctor_name":
            if not (slots.get("doctor_name") or slots.get("specialty") or slots.get("doctor_id")):
                missing.append("doctor_name")
            continue

        value = slots.get(field)
        is_empty = value is None or (isinstance(value, str) and not value.strip())
        if is_empty:
            missing.append(field)

    # Format checks only for fields that are present.
    error = None
    phone = slots.get("patient_phone")
    if phone and not PHONE_RE.match(str(phone)):
        error = "phone_invalid"

    email = slots.get("patient_email")
    if email and not EMAIL_RE.match(str(email)):
        error = "email_invalid"

    appt_date = slots.get("appointment_date")
    if appt_date:
        if not DATE_RE.match(str(appt_date)):
            error = "date_format"
        else:
            try:
                if date.fromisoformat(str(appt_date)) < date.today():
                    error = "date_past"
            except ValueError:
                error = "date_format"

    appt_time = slots.get("appointment_time")
    if appt_time and not TIME_RE.match(str(appt_time)):
        error = "time_format"

    return {"missing_fields": missing, "validation_error": error}
