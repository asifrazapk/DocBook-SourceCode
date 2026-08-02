from datetime import date as date_type
from typing import Any, Dict, Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool


class BillRepo(BasePostgresModel):
    TABLE = "bills"

    @classmethod
    async def list_paginated_by_clinic(
        cls,
        clinic_id: int,
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        async with get_read_pool().acquire() as conn:
            conditions = ["b.clinic_id = $1", "(b.is_deleted = false OR b.is_deleted IS NULL)"]
            values: list = [clinic_id]
            if start_date:
                values.append(start_date)
                conditions.append(f"b.collected_at::date >= ${len(values)}")
            if end_date:
                values.append(end_date)
                conditions.append(f"b.collected_at::date <= ${len(values)}")

            where_sql = " AND ".join(conditions)
            join_sql = """
                FROM bills b
                JOIN patients p ON p.id = b.patient_id
                JOIN appointments a ON a.id = b.appointment_id
                LEFT JOIN doctors d ON d.id = a.doctor_id
            """

            total = await conn.fetchval(f"SELECT COUNT(*) {join_sql} WHERE {where_sql}", *values)

            page = max(1, page)
            page_size = max(1, min(page_size, 500))
            offset = (page - 1) * page_size

            query = f"""
                SELECT b.*, p.name AS patient_name, a.appointment_date, d.name AS doctor_name
                {join_sql}
                WHERE {where_sql}
                ORDER BY b.collected_at DESC
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
    async def total_collected(cls, clinic_id: int, start_date: Optional[date_type], end_date: Optional[date_type]) -> float:
        async with get_read_pool().acquire() as conn:
            conditions = ["clinic_id = $1", "(is_deleted = false OR is_deleted IS NULL)"]
            values: list = [clinic_id]
            if start_date:
                values.append(start_date)
                conditions.append(f"collected_at::date >= ${len(values)}")
            if end_date:
                values.append(end_date)
                conditions.append(f"collected_at::date <= ${len(values)}")
            total = await conn.fetchval(
                f"SELECT COALESCE(SUM(amount), 0) FROM bills WHERE {' AND '.join(conditions)}", *values
            )
            return float(total or 0)
