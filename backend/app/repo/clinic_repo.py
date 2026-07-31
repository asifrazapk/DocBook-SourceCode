from typing import Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class ClinicRepo(BasePostgresModel):
    TABLE = "clinics"

    @classmethod
    async def get_by_slug(cls, slug: str):
        return await cls.get_by_field("slug", slug)

    @classmethod
    async def list_all_paginated(cls, q: Optional[str] = None, page: int = 1, page_size: int = 10):
        if not q:
            return await cls.list_paginated(order_by="name", descending=False, page=page, page_size=page_size)

        async with get_read_pool().acquire() as conn:
            like = f"%{q}%"
            total = await conn.fetchval(
                """
                SELECT COUNT(*) FROM clinics
                WHERE (is_deleted = false OR is_deleted IS NULL)
                  AND (name ILIKE $1 OR slug ILIKE $1 OR address ILIKE $1)
                """,
                like,
            )
            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size
            rows = await conn.fetch(
                """
                SELECT * FROM clinics
                WHERE (is_deleted = false OR is_deleted IS NULL)
                  AND (name ILIKE $1 OR slug ILIKE $1 OR address ILIKE $1)
                ORDER BY name
                LIMIT $2 OFFSET $3
                """,
                like,
                page_size,
                offset,
            )
            total = total or 0
            return {
                "items": [dict(r) for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, -(-total // page_size)),
            }
