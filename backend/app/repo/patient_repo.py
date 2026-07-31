from typing import Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class PatientRepo(BasePostgresModel):
    TABLE = "patients"

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
                SELECT COUNT(*) FROM patients
                WHERE clinic_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
                  AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
                """,
                clinic_id,
                like,
            )
            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size
            rows = await conn.fetch(
                """
                SELECT * FROM patients
                WHERE clinic_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
                  AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
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
    async def search(cls, clinic_id: int, query: str, limit: int = 20) -> list[dict]:
        """Name/phone search for the searchable patient dropdown on the
        appointment booking form."""
        async with get_read_pool().acquire() as conn:
            sql = """
            SELECT * FROM patients
            WHERE clinic_id = $1
              AND (is_deleted = false OR is_deleted IS NULL)
              AND (name ILIKE $2 OR phone ILIKE $2)
            ORDER BY name
            LIMIT $3
            """
            rows = await conn.fetch(sql, clinic_id, f"%{query}%", limit)
            return [dict(r) for r in rows]

    @classmethod
    async def find_by_phone(cls, clinic_id: int, phone: str) -> Optional[dict]:
        """Repeat-customer lookup: same clinic + same phone = same patient."""
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM patients
            WHERE clinic_id = $1
              AND phone = $2
              AND (is_deleted = false OR is_deleted IS NULL)
            LIMIT 1
            """
            row = await conn.fetchrow(query, clinic_id, phone)
            return dict(row) if row else None

    @classmethod
    async def find_by_email(cls, clinic_id: int, email: str) -> Optional[dict]:
        if not email:
            return None
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM patients
            WHERE clinic_id = $1
              AND email = $2
              AND (is_deleted = false OR is_deleted IS NULL)
            LIMIT 1
            """
            row = await conn.fetchrow(query, clinic_id, email)
            return dict(row) if row else None

    @classmethod
    async def get_or_create(
        cls,
        clinic_id: int,
        name: str,
        phone: str,
        email: Optional[str] = None,
        source: str = "manual",
        **extra,
    ) -> dict:
        """Find an existing patient by phone (then email) within this clinic,
        otherwise create a new one. This is what makes a returning caller
        recognised instead of duplicated on every booking.

        `source` ('chat' or 'manual') only applies when actually creating a
        new record -- an existing patient's original source is never
        rewritten just because they were looked up again from a different
        flow (e.g. a manually-added patient booking via chat later doesn't
        retroactively become a 'chat' patient).
        """
        existing = await cls.find_by_phone(clinic_id, phone)
        if not existing and email:
            existing = await cls.find_by_email(clinic_id, email)

        if existing:
            # Keep the record's details fresh if the caller supplied new info.
            updates = {}
            if name and name != existing.get("name"):
                updates["name"] = name
            if email and email != existing.get("email"):
                updates["email"] = email
            for k, v in extra.items():
                if v is not None and v != existing.get(k):
                    updates[k] = v
            if updates:
                existing = await cls.update(existing["id"], updates)
            return existing

        return await cls.create(
            {
                "clinic_id": clinic_id,
                "name": name,
                "phone": phone,
                "email": email,
                "source": source,
                **extra,
            }
        )
