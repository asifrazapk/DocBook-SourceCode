from datetime import date, datetime, time

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from app.core.pagination import validate_page_size
from app.services import appointment_service
from app.services.appointment_service import SlotUnavailableError

router = APIRouter(prefix="/appointments", tags=["appointments"])


class AppointmentCreate(BaseModel):
    """Direct/admin booking — e.g. a phone-in appointment, or an admin panel
    booking screen. Goes through the same book_appointment() flow the chat
    graph uses, so patient resolution and slot claiming behave identically.

    appointment_times accepts one or more times so an admin can book a block
    of slots for the same patient/doctor/date in a single request."""

    clinic_id: int
    doctor_id: int | None = None
    patient_id: int | None = None  # pick an existing patient (searchable dropdown) ...
    patient_name: str | None = None  # ... or supply a new patient's details
    patient_phone: str | None = None
    patient_email: str | None = None
    appointment_date: date
    appointment_times: list[time]
    reason: str | None = None
    language: str = "en"


class AppointmentUpdate(BaseModel):
    status: str | None = None
    note: str | None = None  # captured whenever the status changes (confirm/cancel/complete)


class AppointmentReschedule(BaseModel):
    appointment_date: date | None = None
    appointment_time: time | None = None
    note: str | None = None


class AppointmentCancel(BaseModel):
    note: str | None = None


@router.get("")
async def list_appointments(
    clinic_id: int,
    status: str | None = None,
    doctor_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 10,
):
    validate_page_size(page_size)
    return await appointment_service.list_appointments_paginated(
        clinic_id,
        status=status,
        doctor_id=doctor_id,
        start_date=start_date,
        end_date=end_date,
        q=q,
        page=page,
        page_size=page_size,
    )


@router.get("/doctor-day-schedule")
async def doctor_day_schedule(clinic_id: int, doctor_id: int, on_date: date):
    """Backs the doctor-wise day view: stat cards, available slots (computed
    on the fly), and the day's appointments."""
    return await appointment_service.get_doctor_day_schedule(clinic_id, doctor_id, on_date)


@router.get("/recent")
async def recent_appointments(clinic_id: int, since: datetime, limit: int = 20):
    """Appointments created after `since` -- polled by the admin
    notification bell so a booking made via chat shows up as a notification
    just as reliably as one made in the admin panel."""
    return await appointment_service.list_appointments_created_since(clinic_id, since, limit=limit)


@router.get("/{appt_id}")
async def get_appointment(appt_id: int):
    appt = await appointment_service.get_appointment(appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.post("", status_code=201)
async def create_appointment(body: AppointmentCreate):
    if not body.patient_id and not (body.patient_name and body.patient_phone):
        raise HTTPException(
            status_code=422, detail="Provide either patient_id or patient_name + patient_phone"
        )
    if not body.appointment_times:
        raise HTTPException(status_code=422, detail="appointment_times must contain at least one time")

    patient_name = body.patient_name
    patient_phone = body.patient_phone
    patient_email = body.patient_email

    if body.patient_id:
        from app.services import patient_service

        patient = await patient_service.get_patient(body.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient_name = patient["name"]
        patient_phone = patient["phone"]
        patient_email = patient.get("email")

    times_str = [t.strftime("%H:%M") for t in body.appointment_times]

    try:
        if len(times_str) == 1:
            appt = await appointment_service.book_appointment(
                clinic_id=body.clinic_id,
                doctor_id=body.doctor_id,
                patient_name=patient_name,
                patient_phone=patient_phone,
                patient_email=patient_email,
                appointment_date=body.appointment_date,
                appointment_time=times_str[0],
                reason=body.reason,
                language=body.language,
                patient_source="manual",
            )
            return {"booked": [appt], "failed": []}

        return await appointment_service.book_appointments_multi(
            clinic_id=body.clinic_id,
            doctor_id=body.doctor_id,
            patient_name=patient_name,
            patient_phone=patient_phone,
            patient_email=patient_email,
            appointment_date=body.appointment_date,
            appointment_times=times_str,
            reason=body.reason,
            language=body.language,
            patient_source="manual",
        )
    except SlotUnavailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.patch("/{appt_id}")
async def update_appointment(appt_id: int, body: AppointmentUpdate):
    data = body.model_dump(exclude={"note"}, exclude_none=True)
    appt = await appointment_service.update_appointment(appt_id, data, note=body.note)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.post("/{appt_id}/reschedule")
async def reschedule_appointment(appt_id: int, body: AppointmentReschedule):
    if body.appointment_date is None and body.appointment_time is None:
        raise HTTPException(status_code=422, detail="Provide a new appointment_date and/or appointment_time")
    try:
        appt = await appointment_service.reschedule_appointment(
            appt_id,
            new_date=body.appointment_date,
            new_time=body.appointment_time.strftime("%H:%M") if body.appointment_time else None,
            note=body.note,
        )
    except SlotUnavailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.delete("/{appt_id}", status_code=204)
async def cancel_appointment(appt_id: int, body: AppointmentCancel | None = Body(default=None)):
    appt = await appointment_service.cancel_appointment(appt_id, note=body.note if body else None)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
