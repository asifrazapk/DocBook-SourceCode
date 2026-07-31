from datetime import date as date_type
from typing import Any, Dict, List, Optional

from app.repo.doctor_repo import DoctorRepo
from app.repo.schedule_repo import DoctorAvailabilityRepo, DoctorLeaveRepo, DoctorSlotRepo
from app.services.availability_service import get_available_slots


# --------------------------------------------------------------------------
# Availability (recurring weekly rule)
# --------------------------------------------------------------------------
async def list_availability(doctor_id: int) -> List[dict]:
    return await DoctorAvailabilityRepo.list_by_doctor(doctor_id, active_only=True)


async def create_availability(doctor_id: int, days: List[int], rule: Dict[str, Any]) -> List[dict]:
    """Admin-panel entry point: one submitted form (start/end/break/slot
    length + the day checkboxes it applies to) becomes one row per day."""
    if not rule.get("slot_duration_minutes"):
        doctor = await DoctorRepo.get_by_id(doctor_id)
        rule = {**rule, "slot_duration_minutes": doctor.get("default_slot_duration_minutes", 30)}
    return await DoctorAvailabilityRepo.create_many(doctor_id, days, rule)


async def update_availability(availability_id: int, data: Dict[str, Any]) -> Optional[dict]:
    try:
        return await DoctorAvailabilityRepo.update(availability_id, data)
    except ValueError:
        return None


async def delete_availability(availability_id: int) -> bool:
    try:
        await DoctorAvailabilityRepo.get_by_id(availability_id)
    except ValueError:
        return False
    # Soft delete keeps history intact -- see doctor_availability.is_deleted.
    await DoctorAvailabilityRepo.update(availability_id, {"is_deleted": True, "is_active": False})
    return True


# --------------------------------------------------------------------------
# Leaves (one-off exceptions)
# --------------------------------------------------------------------------
async def list_leaves(doctor_id: int) -> List[dict]:
    return await DoctorLeaveRepo.list_by_doctor(doctor_id, active_only=False)


async def create_leave(doctor_id: int, data: Dict[str, Any]) -> dict:
    return await DoctorLeaveRepo.create({"doctor_id": doctor_id, **data})


async def delete_leave(leave_id: int) -> bool:
    try:
        await DoctorLeaveRepo.get_by_id(leave_id)
    except ValueError:
        return False
    await DoctorLeaveRepo.update(leave_id, {"is_deleted": True, "is_active": False})
    return True


# --------------------------------------------------------------------------
# Slots (pre-generated, individually bookable)
# --------------------------------------------------------------------------
async def list_open_slots(doctor_id: int, on_date: date_type) -> List[dict]:
    """What a booking screen should show for this doctor/date -- pre-generated
    slots if they exist, otherwise computed on the fly (see
    availability_service.get_available_slots)."""
    slots = await get_available_slots(doctor_id, on_date)
    return [
        {
            "start_time": str(s["start_time"])[:5],
            "end_time": str(s["end_time"])[:5],
        }
        for s in slots
    ]


async def generate_slots(doctor_id: int, days_ahead: int = 30) -> int:
    doctor = await DoctorRepo.get_by_id(doctor_id)
    return await DoctorSlotRepo.generate_for_doctor(doctor_id, doctor["clinic_id"], days_ahead=days_ahead)
