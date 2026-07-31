from datetime import date
from typing import Any, Dict, List, Optional

from app.repo.appointment_repo import AppointmentRepo
from app.repo.doctor_repo import DoctorRepo
from app.repo.schedule_repo import DoctorAvailabilityRepo


async def list_doctors(clinic_id: int) -> List[dict]:
    return await DoctorRepo.list_by_clinic(clinic_id)


async def list_doctors_with_today_count(clinic_id: int) -> List[dict]:
    """Doctors list enriched with appointments_today -- answers 'which
    doctor has appointments today' at a glance without opening each one."""
    doctors = await DoctorRepo.list_by_clinic(clinic_id)
    counts = await AppointmentRepo.count_today_by_doctor(clinic_id, date.today())
    for d in doctors:
        d["appointments_today"] = counts.get(d["id"], 0)
    return doctors


async def list_doctors_paginated(clinic_id: int, q: Optional[str] = None, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
    result = await DoctorRepo.list_paginated_by_clinic(clinic_id, q=q, page=page, page_size=page_size)
    counts = await AppointmentRepo.count_today_by_doctor(clinic_id, date.today())
    for d in result["items"]:
        d["appointments_today"] = counts.get(d["id"], 0)
    return result


async def get_doctor(doctor_id: int) -> Optional[dict]:
    try:
        return await DoctorRepo.get_by_id(doctor_id)
    except ValueError:
        return None


async def find_doctor_by_name(clinic_id: int, name: str) -> Optional[dict]:
    return await DoctorRepo.find_by_name(clinic_id, name)


async def create_doctor(data: Dict[str, Any]) -> dict:
    return await DoctorRepo.create(data)


async def create_doctor_with_availability(
    doctor_data: Dict[str, Any],
    weekly_availability: List[Dict[str, Any]],
) -> dict:
    """Add Doctor wizard, both steps in one call: create the doctor (step 1:
    name/email/phone/default duration), then create one doctor_availability
    row per {day_of_week, start_time, end_time} entry supplied (step 2: as
    many ranges per day as the admin added). Each row uses the doctor's
    default_slot_duration_minutes unless a range explicitly overrides it."""
    doctor = await DoctorRepo.create(doctor_data)
    default_duration = doctor.get("default_slot_duration_minutes", 30)

    seen = set()
    created_availability = []
    for entry in weekly_availability:
        key = (entry["day_of_week"], str(entry["start_time"])[:5], str(entry["end_time"])[:5])
        if key in seen:
            continue  # identical range submitted twice in the same form
        seen.add(key)
        row = await DoctorAvailabilityRepo.create(
            {
                "doctor_id": doctor["id"],
                "day_of_week": entry["day_of_week"],
                "start_time": entry["start_time"],
                "end_time": entry["end_time"],
                "break_start_time": entry.get("break_start_time"),
                "break_end_time": entry.get("break_end_time"),
                "slot_duration_minutes": entry.get("slot_duration_minutes") or default_duration,
            }
        )
        created_availability.append(row)

    doctor["availability"] = created_availability
    doctor["availability_warning"] = (
        "No weekly availability was set — this doctor won't have any bookable slots until you add some via 'Schedule'."
        if not created_availability
        else None
    )
    return doctor


async def update_doctor(doctor_id: int, data: Dict[str, Any]) -> Optional[dict]:
    try:
        return await DoctorRepo.update(doctor_id, data)
    except ValueError:
        return None


async def delete_doctor(doctor_id: int) -> bool:
    """Soft delete -- keeps appointment/availability history intact."""
    try:
        await DoctorRepo.get_by_id(doctor_id)
    except ValueError:
        return False
    await DoctorRepo.update(doctor_id, {"is_deleted": True, "is_active": False})
    return True
