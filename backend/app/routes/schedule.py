"""Admin-panel API for doctor scheduling: recurring weekly availability,
one-off leaves, and pre-generated bookable slots.

Endpoints are nested under /doctors/{doctor_id}/... to match how an admin
panel edit screen works: open a doctor, then manage their schedule.
"""

from datetime import date, time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import schedule_service

router = APIRouter(prefix="/doctors/{doctor_id}", tags=["schedule"])


# --------------------------------------------------------------------------
# Availability (recurring weekly rule)
# --------------------------------------------------------------------------
class AvailabilityCreate(BaseModel):
    days: list[int]  # 0=Sunday ... 6=Saturday; one checkbox per day in the admin form
    start_time: time
    end_time: time
    break_start_time: time | None = None
    break_end_time: time | None = None
    slot_duration_minutes: int | None = None  # defaults to the doctor's default_slot_duration_minutes


class AvailabilityUpdate(BaseModel):
    start_time: time | None = None
    end_time: time | None = None
    break_start_time: time | None = None
    break_end_time: time | None = None
    slot_duration_minutes: int | None = None
    is_active: bool | None = None


@router.get("/availability")
async def list_availability(doctor_id: int):
    return await schedule_service.list_availability(doctor_id)


@router.post("/availability", status_code=201)
async def create_availability(doctor_id: int, body: AvailabilityCreate):
    if not body.days:
        raise HTTPException(status_code=422, detail="Select at least one day")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")
    rule = body.model_dump(exclude={"days"})
    return await schedule_service.create_availability(doctor_id, body.days, rule)


@router.patch("/availability/{availability_id}")
async def update_availability(doctor_id: int, availability_id: int, body: AvailabilityUpdate):
    row = await schedule_service.update_availability(availability_id, body.model_dump(exclude_none=True))
    if not row:
        raise HTTPException(status_code=404, detail="Availability rule not found")
    return row


@router.delete("/availability/{availability_id}", status_code=204)
async def delete_availability(doctor_id: int, availability_id: int):
    deleted = await schedule_service.delete_availability(availability_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Availability rule not found")


# --------------------------------------------------------------------------
# Leaves (one-off exceptions)
# --------------------------------------------------------------------------
class LeaveCreate(BaseModel):
    leave_date: date
    start_time: time | None = None  # both None = full day off
    end_time: time | None = None
    reason: str | None = None


@router.get("/leaves")
async def list_leaves(doctor_id: int):
    return await schedule_service.list_leaves(doctor_id)


@router.post("/leaves", status_code=201)
async def create_leave(doctor_id: int, body: LeaveCreate):
    if (body.start_time is None) != (body.end_time is None):
        raise HTTPException(status_code=422, detail="start_time and end_time must both be set, or both omitted")
    return await schedule_service.create_leave(doctor_id, body.model_dump())


@router.delete("/leaves/{leave_id}", status_code=204)
async def delete_leave(doctor_id: int, leave_id: int):
    deleted = await schedule_service.delete_leave(leave_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Leave not found")


# --------------------------------------------------------------------------
# Slots (pre-generated, individually bookable)
# --------------------------------------------------------------------------
@router.get("/slots")
async def list_slots(doctor_id: int, on_date: date):
    return await schedule_service.list_open_slots(doctor_id, on_date)


@router.post("/slots/generate")
async def generate_slots(doctor_id: int, days_ahead: int = 30):
    created = await schedule_service.generate_slots(doctor_id, days_ahead=days_ahead)
    return {"generated": created}
