"""Doctor-facing portal: a doctor logs in and sees only their own schedule,
patients, and can add prescriptions -- reusing the same services the admin
panel uses, just scoped to `doctor_id` from their JWT instead of trusting a
client-supplied doctor_id."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services import appointment_service, medical_record_service

router = APIRouter(prefix="/doctor-portal", tags=["doctor-portal"])


def _require_doctor(user: dict) -> int:
    if user.get("role") != "doctor" or not user.get("doctor_id"):
        raise HTTPException(status_code=403, detail="This endpoint is for doctor logins only")
    return user["doctor_id"]


async def _own_appointment_or_404(doctor_id: int, appt_id: int) -> dict:
    appt = await appointment_service.get_appointment(appt_id)
    if not appt or appt.get("doctor_id") != doctor_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.get("/schedule")
async def my_schedule(on_date: date, user: dict = Depends(get_current_user)):
    doctor_id = _require_doctor(user)
    return await appointment_service.get_doctor_day_schedule(user["clinic_id"], doctor_id, on_date)


@router.get("/appointments")
async def my_appointments(
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    user: dict = Depends(get_current_user),
):
    """Optionally date-range filtered -- the doctor portal's week/month
    calendar views fetch one range instead of one call per day."""
    doctor_id = _require_doctor(user)
    all_appts = await appointment_service.list_appointments(user["clinic_id"], status=status)
    mine = [a for a in all_appts if a.get("doctor_id") == doctor_id]
    if start_date:
        mine = [a for a in mine if a["appointment_date"] >= start_date]
    if end_date:
        mine = [a for a in mine if a["appointment_date"] <= end_date]
    return mine


class PrescriptionUpsertRequest(BaseModel):
    appointment_id: int
    patient_id: int
    diagnosis: str | None = None
    prescription: str | None = None
    notes: str | None = None


@router.post("/prescriptions")
async def add_prescription(body: PrescriptionUpsertRequest, user: dict = Depends(get_current_user)):
    doctor_id = _require_doctor(user)
    return await medical_record_service.create_or_update_record(
        clinic_id=user["clinic_id"],
        appointment_id=body.appointment_id,
        patient_id=body.patient_id,
        doctor_id=doctor_id,
        diagnosis=body.diagnosis,
        prescription=body.prescription,
        notes=body.notes,
    )


class RescheduleRequest(BaseModel):
    new_date: date | None = None
    new_time: str | None = None
    note: str | None = None


@router.post("/appointments/{appt_id}/reschedule")
async def reschedule_my_appointment(appt_id: int, body: RescheduleRequest, user: dict = Depends(get_current_user)):
    doctor_id = _require_doctor(user)
    await _own_appointment_or_404(doctor_id, appt_id)
    try:
        updated = await appointment_service.reschedule_appointment(
            appt_id, new_date=body.new_date, new_time=body.new_time, note=body.note
        )
    except appointment_service.SlotUnavailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return updated


class CancelRequest(BaseModel):
    note: str | None = None


@router.post("/appointments/{appt_id}/cancel")
async def cancel_my_appointment(appt_id: int, body: CancelRequest, user: dict = Depends(get_current_user)):
    doctor_id = _require_doctor(user)
    await _own_appointment_or_404(doctor_id, appt_id)
    updated = await appointment_service.cancel_appointment(appt_id, note=body.note)
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return updated

