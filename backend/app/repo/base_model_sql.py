import datetime
from typing import Optional, Dict, Any, List

from app.repo.sql_connector import get_read_pool, get_write_pool


class BasePostgresModel:
    TABLE = None
    UNIQUE_LOOKUP_FIELD = "id"

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    # =========================
    # TIME
    # =========================
    @classmethod
    def _now(cls):
        # Naive UTC — matches the naive local_created_at/local_updated_at
        # TIMESTAMP columns as a safe placeholder (see schema.sql header:
        # these default to the same UTC instant as server_* unless the
        # caller knows the row's real clinic timezone and overrides them).
        # datetime.utcnow() is deprecated, so go via an aware UTC value and
        # strip the tzinfo back off.
        return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    @classmethod
    def _now_aware(cls):
        # Timezone-aware UTC instant, for the server_created_at/
        # server_updated_at TIMESTAMPTZ columns.
        return datetime.datetime.now(datetime.timezone.utc)

    # =========================
    # LIST
    # =========================
    @classmethod
    async def list(
        cls,
        filter_dict: Optional[Dict[str, Any]] = None,
        order_by: str = "server_created_at",
        descending: bool = True,
    ):
        async with get_read_pool().acquire() as conn:

            query = f"SELECT * FROM {cls.TABLE}"
            conditions: List[str] = []
            values: List[Any] = []

            if filter_dict:
                for k, v in filter_dict.items():
                    values.append(v)
                    conditions.append(f"{k} = ${len(values)}")

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            if order_by:
                query += f" ORDER BY {order_by} {'DESC' if descending else 'ASC'}"

            rows = await conn.fetch(query, *values)
            return [dict(r) for r in rows]

    # =========================
    # LIST (paginated)
    # =========================
    @classmethod
    async def list_paginated(
        cls,
        filter_dict: Optional[Dict[str, Any]] = None,
        range_filters: Optional[List[tuple]] = None,  # [(column, operator, value), ...]
        order_by: str = "server_created_at",
        descending: bool = True,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Paginated variant of list(). range_filters lets callers add
        inequality conditions (e.g. a date range) without hand-building SQL:
        range_filters=[("appointment_date", ">=", start), ("appointment_date", "<=", end)].
        Returns {items, total, page, page_size, total_pages}.
        """
        async with get_read_pool().acquire() as conn:
            conditions: List[str] = []
            values: List[Any] = []

            if filter_dict:
                for k, v in filter_dict.items():
                    values.append(v)
                    conditions.append(f"{k} = ${len(values)}")

            if range_filters:
                for column, operator, value in range_filters:
                    values.append(value)
                    conditions.append(f"{column} {operator} ${len(values)}")

            where_sql = (" WHERE " + " AND ".join(conditions)) if conditions else ""

            total = await conn.fetchval(f"SELECT COUNT(*) FROM {cls.TABLE}{where_sql}", *values)

            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size

            query = f"SELECT * FROM {cls.TABLE}{where_sql}"
            if order_by:
                query += f" ORDER BY {order_by} {'DESC' if descending else 'ASC'}"
            query += f" LIMIT ${len(values) + 1} OFFSET ${len(values) + 2}"

            rows = await conn.fetch(query, *values, page_size, offset)

            total = total or 0
            return {
                "items": [dict(r) for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, -(-total // page_size)),  # ceil division
            }

    # =========================
    # GET BY FIELD
    # =========================
    @classmethod
    async def get_by_field(cls, field: str, value: Any):
        async with get_read_pool().acquire() as conn:

            query = f"""
            SELECT * FROM {cls.TABLE}
            WHERE {field} = $1
              AND (is_deleted = false OR is_deleted IS NULL)
            """

            row = await conn.fetchrow(query, value)

            if not row:
                raise ValueError(f"{cls.TABLE} not found by {field} = {value}")

            return dict(row)

    # =========================
    # GET BY ID
    # =========================
    @classmethod
    async def get_by_id(cls, item_value: Any, field: str = "id"):
        return await cls.get_by_field(field, item_value)

    # =========================
    # CREATE
    # =========================
    # Placeholder until a real admin-authentication system exists: every
    # table now carries a user_id column, but there's no login session to
    # pull a real one from yet, so every write attributes to this one
    # seeded account (see schema.sql's `users` table). Once real admin auth
    # exists, callers that know the acting user should pass user_id
    # explicitly in `data` -- this only fills the gap when they don't.
    DEFAULT_USER_ID = 1

    @classmethod
    async def create(cls, data: dict):
        async with get_write_pool().acquire() as conn:
            data = dict(data)  # avoid mutating input
            if cls.TABLE != "users" and "user_id" not in data:
                data["user_id"] = cls.DEFAULT_USER_ID

            columns = list(data.keys())
            values = list(data.values())

            column_sql = ", ".join(columns)
            placeholder_sql = ", ".join([f"${i}" for i in range(1, len(values) + 1)])

            query = f"""
            INSERT INTO {cls.TABLE} ({column_sql})
            VALUES ({placeholder_sql})
            RETURNING *
            """

            async with conn.transaction():
                row = await conn.fetchrow(query, *values)

            return dict(row) if row else data

    # =========================
    # UPDATE
    # =========================
    @classmethod
    async def update(cls, item_id: Any, data: dict):
        async with get_write_pool().acquire() as conn:

            data = dict(data)
            data["local_updated_at"] = cls._now()
            data["server_updated_at"] = cls._now_aware()

            set_clauses = []
            values: List[Any] = []

            for k, v in data.items():
                values.append(v)
                set_clauses.append(f"{k} = ${len(values)}")

            values.append(item_id)

            query = f"""
            UPDATE {cls.TABLE}
            SET {", ".join(set_clauses)}
            WHERE id = ${len(values)}
            RETURNING *
            """

            async with conn.transaction():
                row = await conn.fetchrow(query, *values)

            if not row:
                raise ValueError(f"{cls.TABLE} update failed for id={item_id}")

            return dict(row)

    # =========================
    # DELETE
    # =========================
    @classmethod
    async def delete(cls, item_id: Any):
        async with get_write_pool().acquire() as conn:

            query = f"DELETE FROM {cls.TABLE} WHERE id = $1"

            async with conn.transaction():
                await conn.execute(query, item_id)

            return True