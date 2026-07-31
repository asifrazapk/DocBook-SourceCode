from typing import Any, Dict, List, Optional

from app.repo.clinic_repo import ClinicRepo


async def list_clinics() -> List[dict]:
    return await ClinicRepo.list()


async def list_clinics_paginated(q: Optional[str] = None, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
    return await ClinicRepo.list_all_paginated(q=q, page=page, page_size=page_size)


async def get_clinic(clinic_id: int) -> Optional[dict]:
    try:
        return await ClinicRepo.get_by_id(clinic_id)
    except ValueError:
        return None


async def get_clinic_by_slug(slug: str) -> Optional[dict]:
    try:
        return await ClinicRepo.get_by_slug(slug)
    except ValueError:
        return None


async def create_clinic(data: Dict[str, Any]) -> dict:
    return await ClinicRepo.create(data)


async def update_clinic(clinic_id: int, data: Dict[str, Any]) -> Optional[dict]:
    try:
        return await ClinicRepo.update(clinic_id, data)
    except ValueError:
        return None
