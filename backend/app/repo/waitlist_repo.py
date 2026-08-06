from datetime import date as date_type

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class WaitlistRepo(BasePostgresModel):
    TABLE = "waitlist"

    @classmethod
    async def list_for_doctor_date(cls, clinic_id: int, doctor_id: int, desired_date: date_type, status: str = "waiting") -> list[dict]:
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT w.*, p.name AS patient_name, p.phone AS patient_phone
                FROM waitlist w
                JOIN patients p ON p.id = w.patient_id
                WHERE w.clinic_id = $1 AND w.doctor_id = $2 AND w.desired_date = $3
                  AND w.status = $4 AND (w.is_deleted = false OR w.is_deleted IS NULL)
                ORDER BY w.local_created_at ASC
                """,
                clinic_id,
                doctor_id,
                desired_date,
                status,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def list_by_clinic(cls, clinic_id: int) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT w.*, p.name AS patient_name, p.phone AS patient_phone, d.name AS doctor_name
                FROM waitlist w
                JOIN patients p ON p.id = w.patient_id
                JOIN doctors d ON d.id = w.doctor_id
                WHERE w.clinic_id = $1 AND (w.is_deleted = false OR w.is_deleted IS NULL)
                ORDER BY w.local_created_at DESC
                """,
                clinic_id,
            )
            return [dict(r) for r in rows]
