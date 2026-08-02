from datetime import date, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.pagination import validate_page_size
from app.services import bill_service

router = APIRouter(prefix="/bills", tags=["bills"])


class BillCreate(BaseModel):
    clinic_id: int
    appointment_id: int  # must be a confirmed appointment
    amount: float
    collected_by: str
    collected_at: datetime | None = None  # defaults to now if omitted
    notes: str | None = None


@router.get("")
async def list_bills(clinic_id: int, start_date: date | None = None, end_date: date | None = None, page: int = 1, page_size: int = 10):
    validate_page_size(page_size)
    return await bill_service.list_bills_paginated(clinic_id, start_date=start_date, end_date=end_date, page=page, page_size=page_size)


@router.get("/summary")
async def bills_summary(clinic_id: int, start_date: date | None = None, end_date: date | None = None):
    total = await bill_service.get_total_collected(clinic_id, start_date, end_date)
    return {"total_collected": total}


@router.post("", status_code=201)
async def create_bill(body: BillCreate):
    return await bill_service.create_bill(
        clinic_id=body.clinic_id,
        appointment_id=body.appointment_id,
        amount=body.amount,
        collected_by=body.collected_by,
        collected_at=body.collected_at or datetime.utcnow(),
        notes=body.notes,
    )


@router.delete("/{bill_id}", status_code=204)
async def delete_bill(bill_id: int):
    deleted = await bill_service.delete_bill(bill_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Bill not found")
