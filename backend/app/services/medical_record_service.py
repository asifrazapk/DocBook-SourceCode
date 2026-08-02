from typing import List, Optional

from app.repo.medical_record_repo import MedicalRecordRepo


async def create_or_update_record(
    clinic_id: int,
    appointment_id: int,
    patient_id: int,
    doctor_id: Optional[int],
    diagnosis: Optional[str],
    prescription: Optional[str],
    notes: Optional[str],
) -> dict:
    """One record per appointment -- if the admin/doctor is adding a second
    entry for the same visit, treat it as an edit of the existing one rather
    than creating a duplicate."""
    existing = await MedicalRecordRepo.get_by_appointment(appointment_id)
    data = {
        "clinic_id": clinic_id,
        "appointment_id": appointment_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "diagnosis": diagnosis,
        "prescription": prescription,
        "notes": notes,
    }
    if existing:
        return await MedicalRecordRepo.update(existing["id"], data)
    return await MedicalRecordRepo.create(data)


async def get_record_for_appointment(appointment_id: int) -> Optional[dict]:
    return await MedicalRecordRepo.get_by_appointment(appointment_id)


async def list_records_for_patient(patient_id: int) -> List[dict]:
    return await MedicalRecordRepo.list_for_patient(patient_id)


async def lookup_for_patient(
    clinic_id: int, phone: str, appointment_id: Optional[int] = None, patient_id: Optional[int] = None
) -> List[dict]:
    """Patient-facing lookup by appointment number or patient number --
    phone-verified so an ID alone can't be used to see someone else's
    medical record."""
    return await MedicalRecordRepo.lookup_verified(clinic_id, phone, appointment_id=appointment_id, patient_id=patient_id)


async def lookup_recent_for_phone(clinic_id: int, phone: str, limit: int = 5) -> List[dict]:
    """Fallback for the chat flow: no appointment/patient number given, so
    just return this phone's most recent records."""
    return await MedicalRecordRepo.list_by_phone(clinic_id, phone, limit=limit)


async def get_report_stats(clinic_id: int, start_date=None, end_date=None) -> dict:
    """Prescriptions/reports issued in a date range, by doctor -- backs the
    Analytics page's Reports section."""
    return await MedicalRecordRepo.count_in_range(clinic_id, start_date, end_date)
