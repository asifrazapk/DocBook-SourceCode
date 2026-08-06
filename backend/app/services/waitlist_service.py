"""Waitlist: a patient wants a specific doctor/date that's fully booked.
When an appointment for that doctor/date gets cancelled, the first waiting
patient is emailed automatically that a slot opened up."""

import logging
from datetime import date as date_type
from typing import List, Optional

from app.repo.doctor_repo import DoctorRepo
from app.repo.patient_repo import PatientRepo
from app.repo.waitlist_repo import WaitlistRepo

logger = logging.getLogger(__name__)


async def add_to_waitlist(clinic_id: int, doctor_id: int, patient_id: int, desired_date: date_type) -> dict:
    return await WaitlistRepo.create(
        {"clinic_id": clinic_id, "doctor_id": doctor_id, "patient_id": patient_id, "desired_date": desired_date}
    )


async def list_waitlist(clinic_id: int) -> List[dict]:
    return await WaitlistRepo.list_by_clinic(clinic_id)


async def notify_waitlist_for_opening(clinic_id: int, doctor_id: int, opened_date: date_type) -> Optional[dict]:
    """Called when an appointment is cancelled -- if anyone's waiting for
    this doctor on this date, email the first one that a slot opened up."""
    from app.services.appointment_service import _send_templated_email  # local import avoids a circular import

    waiting = await WaitlistRepo.list_for_doctor_date(clinic_id, doctor_id, opened_date, status="waiting")
    if not waiting:
        return None

    entry = waiting[0]
    try:
        patient = await PatientRepo.get_by_id(entry["patient_id"])
        doctor = await DoctorRepo.get_by_id(doctor_id)
    except ValueError:
        return None

    if patient.get("email"):
        body = (
            f"Good news, {patient['name']}! A slot with {doctor['name']} on {opened_date} just opened up. "
            "Please contact the clinic or reply to book it -- it may go to someone else if you wait too long."
        )
        await _send_templated_email(clinic_id, patient["email"], "A slot opened up", body)

    await WaitlistRepo.update(entry["id"], {"status": "notified"})
    return entry
