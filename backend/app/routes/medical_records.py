from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import medical_record_service

router = APIRouter(prefix="/medical-records", tags=["medical-records"])


class MedicalRecordUpsert(BaseModel):
    clinic_id: int
    appointment_id: int
    patient_id: int
    doctor_id: int | None = None
    diagnosis: str | None = None
    prescription: str | None = None
    notes: str | None = None


@router.get("/stats")
async def report_stats(clinic_id: int, start_date: date | None = None, end_date: date | None = None):
    """Prescriptions/reports issued in a date range, by doctor -- backs the
    Analytics page's Reports section."""
    return await medical_record_service.get_report_stats(clinic_id, start_date, end_date)


@router.post("")
async def upsert_record(body: MedicalRecordUpsert):
    """Admin/doctor adds or edits the prescription + report for one
    appointment. One record per appointment -- resubmitting updates it."""
    return await medical_record_service.create_or_update_record(
        clinic_id=body.clinic_id,
        appointment_id=body.appointment_id,
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        diagnosis=body.diagnosis,
        prescription=body.prescription,
        notes=body.notes,
    )


@router.get("/by-appointment/{appointment_id}")
async def get_record_for_appointment(appointment_id: int):
    record = await medical_record_service.get_record_for_appointment(appointment_id)
    if not record:
        raise HTTPException(status_code=404, detail="No medical record for this appointment yet")
    return record


@router.get("/by-patient/{patient_id}")
async def list_records_for_patient(patient_id: int):
    """Admin-side: every medical record for a patient, across all their visits."""
    return await medical_record_service.list_records_for_patient(patient_id)


@router.get("/lookup")
async def lookup_for_patient(clinic_id: int, phone: str, appointment_id: int | None = None, patient_id: int | None = None):
    """Patient-facing lookup by appointment number or patient number --
    phone-verified, so an ID alone can't be used to see someone else's
    medical record. Used by the chat app once the patient is logged in."""
    if not appointment_id and not patient_id:
        raise HTTPException(status_code=422, detail="Provide appointment_id or patient_id")
    return await medical_record_service.lookup_for_patient(clinic_id, phone, appointment_id=appointment_id, patient_id=patient_id)
