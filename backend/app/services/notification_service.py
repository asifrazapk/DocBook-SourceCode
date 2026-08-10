from typing import Optional

from app.repo.notification_repo import NotificationRepo


async def create_notification(
    clinic_id: int,
    message: str,
    notification_type: str = "general",
    reference_id: Optional[int] = None,
) -> dict:
    return await NotificationRepo.create(
        {
            "clinic_id": clinic_id,
            "message": message,
            "notification_type": notification_type,
            "reference_id": reference_id,
        }
    )


async def list_notifications(clinic_id: int, page: int = 1, page_size: int = 10) -> dict:
    return await NotificationRepo.list_paginated(clinic_id, page=page, page_size=page_size)


async def mark_all_read(clinic_id: int) -> int:
    return await NotificationRepo.mark_all_read(clinic_id)
