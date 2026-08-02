from datetime import date as date_type
from typing import Any, Dict, Optional

from app.repo.appointment_repo import AppointmentRepo
from app.repo.bill_repo import BillRepo


async def create_bill(
    clinic_id: int,
    appointment_id: int,
    amount: float,
    collected_by: str,
    collected_at,
    notes: Optional[str] = None,
) -> dict:
    appt = await AppointmentRepo.get_by_id(appointment_id)
    return await BillRepo.create(
        {
            "clinic_id": clinic_id,
            "appointment_id": appointment_id,
            "patient_id": appt["patient_id"],
            "amount": amount,
            "collected_by": collected_by,
            "collected_at": collected_at,
            "notes": notes,
        }
    )


async def list_bills_paginated(
    clinic_id: int,
    start_date: Optional[date_type] = None,
    end_date: Optional[date_type] = None,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    return await BillRepo.list_paginated_by_clinic(clinic_id, start_date=start_date, end_date=end_date, page=page, page_size=page_size)


async def get_total_collected(clinic_id: int, start_date: Optional[date_type], end_date: Optional[date_type]) -> float:
    return await BillRepo.total_collected(clinic_id, start_date, end_date)


async def delete_bill(bill_id: int) -> bool:
    try:
        await BillRepo.get_by_id(bill_id)
    except ValueError:
        return False
    await BillRepo.update(bill_id, {"is_deleted": True})
    return True
