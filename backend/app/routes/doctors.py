from datetime import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.pagination import validate_page_size
from app.services import doctor_service

router = APIRouter(prefix="/doctors", tags=["doctors"])


class DoctorCreate(BaseModel):
    clinic_id: int
    name: str
    specialty: str
    bio: str | None = None
    email: str | None = None
    phone: str | None = None
    default_slot_duration_minutes: int = 30


class DoctorUpdate(BaseModel):
    name: str | None = None
    specialty: str | None = None
    bio: str | None = None
    email: str | None = None
    phone: str | None = None
    default_slot_duration_minutes: int | None = None
    is_active: bool | None = None


class WeeklyAvailabilityEntry(BaseModel):
    day_of_week: int  # 0=Sunday ... 6=Saturday
    start_time: time
    end_time: time
    break_start_time: time | None = None
    break_end_time: time | None = None
    slot_duration_minutes: int | None = None  # defaults to the doctor's default_slot_duration_minutes


class DoctorCreateWithAvailability(BaseModel):
    """Add Doctor wizard: step 1 (doctor info) + step 2 (weekly availability,
    one entry per time range the admin added -- a day can have several)."""

    doctor: DoctorCreate
    weekly_availability: list[WeeklyAvailabilityEntry] = []


@router.get("")
async def list_doctors(clinic_id: int, q: str | None = None, page: int = 1, page_size: int = 10):
    validate_page_size(page_size)
    return await doctor_service.list_doctors_paginated(clinic_id, q=q, page=page, page_size=page_size)


@router.get("/today")
async def doctors_with_today_count(clinic_id: int):
    """Which doctors have appointments today, at a glance."""
    return await doctor_service.list_doctors_with_today_count(clinic_id)


@router.get("/{doctor_id}")
async def get_doctor(doctor_id: int):
    doctor = await doctor_service.get_doctor(doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


@router.post("", status_code=201)
async def create_doctor(body: DoctorCreate):
    return await doctor_service.create_doctor(body.model_dump())


@router.post("/with-availability", status_code=201)
async def create_doctor_with_availability(body: DoctorCreateWithAvailability):
    return await doctor_service.create_doctor_with_availability(
        body.doctor.model_dump(),
        [
            {
                "day_of_week": e.day_of_week,
                "start_time": e.start_time,
                "end_time": e.end_time,
                "break_start_time": e.break_start_time,
                "break_end_time": e.break_end_time,
                "slot_duration_minutes": e.slot_duration_minutes,
            }
            for e in body.weekly_availability
        ],
    )


@router.patch("/{doctor_id}")
async def update_doctor(doctor_id: int, body: DoctorUpdate):
    doctor = await doctor_service.update_doctor(doctor_id, body.model_dump(exclude_none=True))
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


@router.delete("/{doctor_id}", status_code=204)
async def delete_doctor(doctor_id: int):
    deleted = await doctor_service.delete_doctor(doctor_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Doctor not found")
