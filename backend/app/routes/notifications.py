from fastapi import APIRouter

from app.core.pagination import validate_page_size
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(clinic_id: int, page: int = 1, page_size: int = 10):
    validate_page_size(page_size)
    return await notification_service.list_notifications(clinic_id, page=page, page_size=page_size)


@router.post("/mark-all-read")
async def mark_all_read(clinic_id: int):
    updated = await notification_service.mark_all_read(clinic_id)
    return {"updated": updated}
