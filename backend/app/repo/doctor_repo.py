from typing import Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class DoctorRepo(BasePostgresModel):
    TABLE = "doctors"

    @classmethod
    async def list_by_clinic(cls, clinic_id: int):
        return await cls.list(filter_dict={"clinic_id": clinic_id})

    @classmethod
    async def list_paginated_by_clinic(cls, clinic_id: int, q: Optional[str] = None, page: int = 1, page_size: int = 10):
        if not q:
            return await cls.list_paginated(
                filter_dict={"clinic_id": clinic_id},
                order_by="name",
                descending=False,
                page=page,
                page_size=page_size,
            )

        async with get_read_pool().acquire() as conn:
            like = f"%{q}%"
            total = await conn.fetchval(
                """
                SELECT COUNT(*) FROM doctors
                WHERE clinic_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
                  AND (name ILIKE $2 OR specialty ILIKE $2)
                """,
                clinic_id,
                like,
            )
            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size
            rows = await conn.fetch(
                """
                SELECT * FROM doctors
                WHERE clinic_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
                  AND (name ILIKE $2 OR specialty ILIKE $2)
                ORDER BY name
                LIMIT $3 OFFSET $4
                """,
                clinic_id,
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

    @classmethod
    async def find_by_name(cls, clinic_id: int, name: str) -> Optional[dict]:
        async with get_read_pool().acquire() as conn:
            query = f"""
            SELECT * FROM {cls.TABLE}
            WHERE clinic_id = $1
              AND name ILIKE $2
              AND (is_deleted = false OR is_deleted IS NULL)
            LIMIT 1
            """
            row = await conn.fetchrow(query, clinic_id, f"%{name}%")
            return dict(row) if row else None
