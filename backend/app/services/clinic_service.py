import time
from typing import Any, Dict, List, Optional

from app.repo.clinic_repo import ClinicRepo

# Cache for the clinic row -- fetched on essentially every chat turn (and
# most other requests) but changes only when an admin edits clinic settings.
# update_clinic() invalidates immediately, so the long TTL only matters for
# an edit made directly in the DB out-of-band.
_CLINIC_CACHE_TTL_SECONDS = 60 * 60
_clinic_cache: Dict[int, tuple[float, dict]] = {}


async def list_clinics() -> List[dict]:
    return await ClinicRepo.list()


async def list_clinics_paginated(q: Optional[str] = None, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
    return await ClinicRepo.list_all_paginated(q=q, page=page, page_size=page_size)


async def get_clinic_cached(clinic_id: int) -> dict:
    """Same row as ClinicRepo.get_by_id, served from a short TTL cache.
    Raises ValueError if the clinic doesn't exist, same as the repo call --
    callers that already handle that (chat_service, etc.) don't need to change."""
    cached = _clinic_cache.get(clinic_id)
    if cached and (time.monotonic() - cached[0]) < _CLINIC_CACHE_TTL_SECONDS:
        return cached[1]

    clinic = await ClinicRepo.get_by_id(clinic_id)
    _clinic_cache[clinic_id] = (time.monotonic(), clinic)
    return clinic


async def get_clinic(clinic_id: int) -> Optional[dict]:
    try:
        return await get_clinic_cached(clinic_id)
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
        updated = await ClinicRepo.update(clinic_id, data)
    except ValueError:
        return None
    _clinic_cache.pop(clinic_id, None)
    return updated
