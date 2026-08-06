from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class ReviewRepo(BasePostgresModel):
    TABLE = "reviews"

    @classmethod
    async def list_public(cls, clinic_id: int, limit: int = 50) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT r.*, p.name AS patient_name, d.name AS doctor_name
                FROM reviews r
                JOIN patients p ON p.id = r.patient_id
                LEFT JOIN doctors d ON d.id = r.doctor_id
                WHERE r.clinic_id = $1 AND r.is_public = true AND (r.is_deleted = false OR r.is_deleted IS NULL)
                ORDER BY r.server_created_at DESC
                LIMIT $2
                """,
                clinic_id,
                limit,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def list_all(cls, clinic_id: int) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT r.*, p.name AS patient_name, d.name AS doctor_name
                FROM reviews r
                JOIN patients p ON p.id = r.patient_id
                LEFT JOIN doctors d ON d.id = r.doctor_id
                WHERE r.clinic_id = $1 AND (r.is_deleted = false OR r.is_deleted IS NULL)
                ORDER BY r.server_created_at DESC
                """,
                clinic_id,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def average_rating(cls, clinic_id: int) -> dict:
        async with get_read_pool().acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average
                FROM reviews WHERE clinic_id = $1 AND is_public = true AND (is_deleted = false OR is_deleted IS NULL)
                """,
                clinic_id,
            )
            return {"count": row["count"], "average": round(float(row["average"]), 2)}
