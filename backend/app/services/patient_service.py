from typing import Any, Dict, List, Optional

from app.repo.patient_repo import PatientRepo


async def list_patients(clinic_id: int) -> List[dict]:
    return await PatientRepo.list_by_clinic(clinic_id)


async def list_patients_paginated(clinic_id: int, q: Optional[str] = None, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
    return await PatientRepo.list_paginated_by_clinic(clinic_id, q=q, page=page, page_size=page_size)


async def search_patients(clinic_id: int, query: str, limit: int = 20) -> List[dict]:
    if not query or not query.strip():
        return []
    return await PatientRepo.search(clinic_id, query.strip(), limit=limit)


async def create_patient(clinic_id: int, data: Dict[str, Any]) -> dict:
    """Manual admin-side patient creation. Reuses the same repeat-customer
    matching as booking: if the phone (or email) already exists for this
    clinic, that existing record is updated/returned instead of creating a
    duplicate."""
    return await PatientRepo.get_or_create(
        clinic_id,
        name=data["name"],
        phone=data["phone"],
        email=data.get("email"),
        source="manual",
        **{k: v for k, v in data.items() if k not in ("name", "phone", "email", "source")},
    )


async def delete_patient(patient_id: int) -> bool:
    """Soft delete -- keeps appointment history intact."""
    try:
        await PatientRepo.get_by_id(patient_id)
    except ValueError:
        return False
    await PatientRepo.update(patient_id, {"is_deleted": True, "is_active": False})
    return True


async def get_patient(patient_id: int) -> Optional[dict]:
    try:
        return await PatientRepo.get_by_id(patient_id)
    except ValueError:
        return None


async def find_patient(clinic_id: int, phone: str, email: Optional[str] = None) -> Optional[dict]:
    existing = await PatientRepo.find_by_phone(clinic_id, phone)
    if not existing and email:
        existing = await PatientRepo.find_by_email(clinic_id, email)
    return existing


async def get_or_create_patient(
    clinic_id: int,
    name: str,
    phone: str,
    email: Optional[str] = None,
    source: str = "manual",
) -> dict:
    """Resolve a patient for booking: reuse the existing record for this
    clinic+phone (or +email) if one exists, otherwise create it. `source`
    records how a *newly created* patient originated ('chat' from the
    booking assistant, 'manual' from the admin panel) -- ignored if an
    existing patient is matched instead."""
    return await PatientRepo.get_or_create(clinic_id, name=name, phone=phone, email=email, source=source)


async def update_patient(patient_id: int, data: Dict[str, Any]) -> Optional[dict]:
    try:
        return await PatientRepo.update(patient_id, data)
    except ValueError:
        return None
