from datetime import date as date_type, datetime
from typing import Any, Dict, Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class AppointmentRepo(BasePostgresModel):
    TABLE = "appointments"

    @classmethod
    async def list_by_clinic(cls, clinic_id: int, status: Optional[str] = None):
        filter_dict = {"clinic_id": clinic_id}
        if status:
            filter_dict["status"] = status
        return await cls.list(filter_dict=filter_dict, order_by="appointment_date", descending=False)

    @classmethod
    async def list_paginated_by_clinic(
        cls,
        clinic_id: int,
        status: Optional[str] = None,
        doctor_id: Optional[int] = None,
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Paginated appointments list, joined with patients/doctors so `q`
        can search across patient name/phone and doctor name server-side
        (rather than only filtering whatever page happened to load)."""
        async with get_read_pool().acquire() as conn:
            conditions = ["a.clinic_id = $1"]
            values: list = [clinic_id]

            if status:
                values.append(status)
                conditions.append(f"a.status = ${len(values)}")
            if doctor_id:
                values.append(doctor_id)
                conditions.append(f"a.doctor_id = ${len(values)}")
            if start_date:
                values.append(start_date)
                conditions.append(f"a.appointment_date >= ${len(values)}")
            if end_date:
                values.append(end_date)
                conditions.append(f"a.appointment_date <= ${len(values)}")
            if q:
                values.append(f"%{q}%")
                idx = len(values)
                conditions.append(f"(p.name ILIKE ${idx} OR p.phone ILIKE ${idx} OR d.name ILIKE ${idx})")

            where_sql = " AND ".join(conditions)
            join_sql = """
                FROM appointments a
                JOIN patients p ON p.id = a.patient_id
                LEFT JOIN doctors d ON d.id = a.doctor_id
            """

            total = await conn.fetchval(f"SELECT COUNT(*) {join_sql} WHERE {where_sql}", *values)

            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size

            query = f"""
                SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email, d.name AS doctor_name
                {join_sql}
                WHERE {where_sql}
                ORDER BY a.appointment_date ASC, a.appointment_time ASC
                LIMIT ${len(values) + 1} OFFSET ${len(values) + 2}
            """
            rows = await conn.fetch(query, *values, page_size, offset)

            total = total or 0
            return {
                "items": [dict(r) for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, -(-total // page_size)),
            }

    @classmethod
    async def list_by_patient(cls, patient_id: int):
        return await cls.list(
            filter_dict={"patient_id": patient_id},
            order_by="appointment_date",
            descending=True,
        )

    @classmethod
    async def list_created_since(cls, clinic_id: int, since: datetime, limit: int = 20) -> list:
        """Appointments created after `since`, oldest first -- lets the admin
        notification bell poll for genuinely new bookings regardless of
        source (chat or manual), rather than each booking flow having to
        push its own client-side notification."""
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, d.name AS doctor_name
                FROM appointments a
                JOIN patients p ON p.id = a.patient_id
                LEFT JOIN doctors d ON d.id = a.doctor_id
                WHERE a.clinic_id = $1 AND a.server_created_at > $2
                  AND (a.is_deleted = false OR a.is_deleted IS NULL)
                ORDER BY a.server_created_at ASC
                LIMIT $3
                """,
                clinic_id,
                since,
                limit,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def list_for_doctor_on_date(cls, doctor_id: int, on_date: date_type):
        """All (non-cancelled or cancelled -- caller filters) appointments for
        one doctor on one date. Backs the doctor-wise day view."""
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM appointments
                WHERE doctor_id = $1 AND appointment_date = $2
                  AND (is_deleted = false OR is_deleted IS NULL)
                ORDER BY appointment_time
                """,
                doctor_id,
                on_date,
            )
            return [dict(r) for r in rows]

    @classmethod
    async def count_today_by_doctor(cls, clinic_id: int, today: date_type) -> Dict[int, int]:
        """One query -> {doctor_id: appointment_count_today} for every doctor
        in this clinic. Backs the 'which doctor has appointments today'
        indicator on the Doctors list."""
        async with get_read_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT doctor_id, COUNT(*) AS count
                FROM appointments
                WHERE clinic_id = $1 AND appointment_date = $2
                  AND status != 'cancelled' AND (is_deleted = false OR is_deleted IS NULL)
                  AND doctor_id IS NOT NULL
                GROUP BY doctor_id
                """,
                clinic_id,
                today,
            )
            return {r["doctor_id"]: r["count"] for r in rows}

    @classmethod
    async def count_for_doctor_on_date(cls, doctor_id: int, on_date: date_type) -> int:
        async with get_read_pool().acquire() as conn:
            return await conn.fetchval(
                """
                SELECT COUNT(*) FROM appointments
                WHERE doctor_id = $1 AND appointment_date = $2
                  AND status != 'cancelled' AND (is_deleted = false OR is_deleted IS NULL)
                """,
                doctor_id,
                on_date,
            )
