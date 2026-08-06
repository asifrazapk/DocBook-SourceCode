from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import waitlist_service

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistCreate(BaseModel):
    clinic_id: int
    doctor_id: int
    patient_id: int
    desired_date: date


@router.get("")
async def list_waitlist(clinic_id: int):
    return await waitlist_service.list_waitlist(clinic_id)


@router.post("", status_code=201)
async def add_to_waitlist(body: WaitlistCreate):
    return await waitlist_service.add_to_waitlist(body.clinic_id, body.doctor_id, body.patient_id, body.desired_date)
