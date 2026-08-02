from typing import Any, Dict, Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class MedicalRecordRepo(BasePostgresModel):
    TABLE = "medical_records"

    @classmethod
    async def count_in_range(cls, clinic_id: int, start_date, end_date) -> Dict[str, Any]:
        """Total prescriptions/reports issued in a date range, broken down by
        doctor -- backs the Analytics page's Reports section."""
        async with get_read_pool().acquire() as conn:
            conditions = ["mr.clinic_id = $1", "(mr.is_deleted = false OR mr.is_deleted IS NULL)"]
            values: list = [clinic_id]
            if start_date:
                values.append(start_date)
                conditions.append(f"mr.local_created_at::date >= ${len(values)}")
            if end_date:
                values.append(end_date)
                conditions.append(f"mr.local_created_at::date <= ${len(values)}")
            where_sql = " AND ".join(conditions)

            total = await conn.fetchval(f"SELECT COUNT(*) FROM medical_records mr WHERE {where_sql}", *values)

            rows = await conn.fetch(
                f"""
                SELECT COALESCE(d.name, 'Unassigned') AS doctor_name, COUNT(*) AS count
                FROM medical_records mr
                LEFT JOIN doctors d ON d.id = mr.doctor_id
                WHERE {where_sql}
                GROUP BY d.name
                ORDER BY count DESC
                """,
                *values,
            )
            return {"total": total or 0, "by_doctor": [dict(r) for r in rows]}

    @classmethod
    async def get_by_appointment(cls, appointment_id: int) -> Optional[dict]:
        async with get_read_pool().acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM medical_records
                WHERE appointment_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
                ORDER BY server_created_at DESC LIMIT 1
                """,
                appointment_id,
            )
            return dict(row) if row else None

    @classmethod
    async def list_for_patient(cls, patient_id: int) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT mr.*, a.appointment_date, a.appointment_time, d.name AS doctor_name
                FROM medical_records mr
                JOIN appointments a ON a.id = mr.appointment_id
                LEFT JOIN doctors d ON d.id = mr.doctor_id
                WHERE mr.patient_id = $1 AND (mr.is_deleted = false OR mr.is_deleted IS NULL)
                ORDER BY mr.server_created_at DESC
                """,
                patient_id,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def list_by_phone(cls, clinic_id: int, phone: str, limit: int = 5) -> list[dict]:
        """Fallback for when the patient doesn't specify an appointment or
        patient number -- their most recent records, phone-verified same as
        the ID-based lookup."""
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT mr.*, a.appointment_date, a.appointment_time, d.name AS doctor_name
                FROM medical_records mr
                JOIN appointments a ON a.id = mr.appointment_id
                JOIN patients p ON p.id = mr.patient_id
                LEFT JOIN doctors d ON d.id = mr.doctor_id
                WHERE mr.clinic_id = $1 AND p.phone = $2 AND (mr.is_deleted = false OR mr.is_deleted IS NULL)
                ORDER BY mr.server_created_at DESC
                LIMIT $3
                """,
                clinic_id,
                phone,
                limit,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def lookup_verified(
        cls, clinic_id: int, phone: str, appointment_id: Optional[int] = None, patient_id: Optional[int] = None
    ) -> list[dict]:
        """Patient-facing lookup -- requires the phone to match the patient
        on file for the given appointment/patient, so knowing/guessing an ID
        alone isn't enough to see someone else's medical record."""
        if not appointment_id and not patient_id:
            return []
        async with get_read_pool().acquire() as conn:
            conditions = ["mr.clinic_id = $1", "p.phone = $2", "(mr.is_deleted = false OR mr.is_deleted IS NULL)"]
            values: list = [clinic_id, phone]
            if appointment_id:
                values.append(appointment_id)
                conditions.append(f"mr.appointment_id = ${len(values)}")
            if patient_id:
                values.append(patient_id)
                conditions.append(f"mr.patient_id = ${len(values)}")

            query = f"""
                SELECT mr.*, a.appointment_date, a.appointment_time, d.name AS doctor_name
                FROM medical_records mr
                JOIN appointments a ON a.id = mr.appointment_id
                JOIN patients p ON p.id = mr.patient_id
                LEFT JOIN doctors d ON d.id = mr.doctor_id
                WHERE {' AND '.join(conditions)}
                ORDER BY mr.server_created_at DESC
            """
            rows = await conn.fetch(query, *values)
            return [dict(r) for r in rows]
