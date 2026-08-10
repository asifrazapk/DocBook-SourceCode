from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class NotificationRepo(BasePostgresModel):
    TABLE = "notifications"

    @classmethod
    async def list_paginated(cls, clinic_id: int, page: int = 1, page_size: int = 10) -> dict:
        """Most recent first. Page 1 = the newest 10 (default page_size),
        page 2 = the next 10 back, etc. -- backs the notification bell's
        "always show recent 10, load 10 more on scroll" behaviour."""
        offset = (page - 1) * page_size
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM notifications
                WHERE clinic_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
                ORDER BY server_created_at DESC
                LIMIT $2 OFFSET $3
                """,
                clinic_id,
                page_size,
                offset,
            )
            total_row = await conn.fetchrow(
                "SELECT count(*) AS total FROM notifications WHERE clinic_id = $1 AND (is_deleted = false OR is_deleted IS NULL)",
                clinic_id,
            )
            unread_row = await conn.fetchrow(
                "SELECT count(*) AS unread FROM notifications WHERE clinic_id = $1 AND NOT is_read AND (is_deleted = false OR is_deleted IS NULL)",
                clinic_id,
            )
            return {
                "items": [dict(r) for r in rows],
                "total": total_row["total"],
                "unread_count": unread_row["unread"],
                "page": page,
                "page_size": page_size,
                "has_more": offset + len(rows) < total_row["total"],
            }

    @classmethod
    async def mark_all_read(cls, clinic_id: int) -> int:
        async with get_read_pool().acquire() as conn:
            result = await conn.execute(
                "UPDATE notifications SET is_read = true, local_updated_at = NOW(), server_updated_at = NOW() "
                "WHERE clinic_id = $1 AND NOT is_read",
                clinic_id,
            )
            return int(result.split(" ")[-1]) if result else 0
