import json
from typing import Any, Optional

from app.repo.sql_connector import get_read_pool, get_write_pool


class SettingsRepo:
    """Generic key/value settings store, scoped per clinic (e.g. one row
    holding the whole SMTP config under key='email')."""

    @classmethod
    async def get(cls, clinic_id: int, key: str) -> Optional[dict]:
        async with get_read_pool().acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM app_settings
                WHERE clinic_id = $1 AND key = $2 AND (is_deleted = false OR is_deleted IS NULL)
                """,
                clinic_id,
                key,
            )
            if not row:
                return None
            data = dict(row)
            # asyncpg returns JSONB as a str; decode it back into a dict for callers.
            if isinstance(data.get("value"), str):
                data["value"] = json.loads(data["value"])
            return data

    @classmethod
    async def upsert(cls, clinic_id: int, key: str, value: Any) -> dict:
        async with get_write_pool().acquire() as conn:
            query = """
            INSERT INTO app_settings (clinic_id, key, value)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (clinic_id, key)
            DO UPDATE SET value = EXCLUDED.value, local_updated_at = NOW(), server_updated_at = NOW(), is_deleted = false
            RETURNING *
            """
            row = await conn.fetchrow(query, clinic_id, key, json.dumps(value))
            data = dict(row)
            if isinstance(data.get("value"), str):
                data["value"] = json.loads(data["value"])
            return data
