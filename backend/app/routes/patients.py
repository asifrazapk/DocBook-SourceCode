from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.pagination import validate_page_size
from app.services import patient_service, appointment_service

router = APIRouter(prefix="/patients", tags=["patients"])


class PatientCreate(BaseModel):
    clinic_id: int
    name: str
    phone: str
    email: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    notes: str | None = None


class PatientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    notes: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_patients(clinic_id: int, q: str | None = None, page: int = 1, page_size: int = 10):
    validate_page_size(page_size)
    return await patient_service.list_patients_paginated(clinic_id, q=q, page=page, page_size=page_size)


@router.get("/search")
async def search_patients(clinic_id: int, q: str, limit: int = 20):
    """Backs the searchable patient dropdown on the appointment booking form."""
    return await patient_service.search_patients(clinic_id, q, limit=limit)


@router.get("/{patient_id}")
async def get_patient(patient_id: int):
    patient = await patient_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/appointments")
async def get_patient_appointments(patient_id: int):
    patient = await patient_service.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return await appointment_service.list_appointments_for_patient(patient_id)


@router.post("", status_code=201)
async def create_patient(body: PatientCreate):
    return await patient_service.create_patient(body.clinic_id, body.model_dump(exclude={"clinic_id"}, exclude_none=True))


@router.patch("/{patient_id}")
async def update_patient(patient_id: int, body: PatientUpdate):
    patient = await patient_service.update_patient(patient_id, body.model_dump(exclude_none=True))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(patient_id: int):
    deleted = await patient_service.delete_patient(patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Patient not found")
