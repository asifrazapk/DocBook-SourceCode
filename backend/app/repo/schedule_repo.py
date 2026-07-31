"""Repos backing the admin-panel doctor scheduling tables.

doctor_availability -> recurring weekly rule ("Mon/Wed/Fri 9-6, lunch 1-2")
doctor_leaves        -> one-off exceptions (a day off, or a few hours off)
doctor_slots          -> pre-generated, individually bookable slots

See db/schema.sql for the full column/constraint definitions.
"""

from datetime import date as date_type
from typing import Any, Optional

from app.repo.base_model_sql import BasePostgresModel
from app.repo.sql_connector import get_read_pool, get_write_pool


class DoctorAvailabilityRepo(BasePostgresModel):
    TABLE = "doctor_availability"

    @classmethod
    async def list_by_doctor(cls, doctor_id: int, active_only: bool = True):
        filter_dict: dict[str, Any] = {"doctor_id": doctor_id}
        if active_only:
            filter_dict["is_active"] = True
        return await cls.list(filter_dict=filter_dict, order_by="day_of_week", descending=False)

    @classmethod
    async def list_for_day(cls, doctor_id: int, day_of_week: int):
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM doctor_availability
            WHERE doctor_id = $1
              AND day_of_week = $2
              AND is_active = true
              AND (is_deleted = false OR is_deleted IS NULL)
            ORDER BY start_time
            """
            rows = await conn.fetch(query, doctor_id, day_of_week)
            return [dict(r) for r in rows]

    @classmethod
    async def create_many(cls, doctor_id: int, days: list[int], rule: dict) -> list[dict]:
        """Admin-panel entry point: one form submission (start/end/break/slot
        length + the days it applies to) becomes one row per day -- skipping
        any day that already has an identical active rule (same start/end
        time) so re-submitting the same form twice doesn't pile up
        duplicates."""
        created = []
        for day in days:
            existing_for_day = await cls.list_for_day(doctor_id, day)
            is_duplicate = any(
                str(r["start_time"])[:5] == str(rule["start_time"])[:5]
                and str(r["end_time"])[:5] == str(rule["end_time"])[:5]
                for r in existing_for_day
            )
            if is_duplicate:
                continue
            row = await cls.create(
                {
                    "doctor_id": doctor_id,
                    "day_of_week": day,
                    "start_time": rule["start_time"],
                    "end_time": rule["end_time"],
                    "break_start_time": rule.get("break_start_time"),
                    "break_end_time": rule.get("break_end_time"),
                    "slot_duration_minutes": rule.get("slot_duration_minutes", 30),
                }
            )
            created.append(row)
        return created


class DoctorLeaveRepo(BasePostgresModel):
    TABLE = "doctor_leaves"

    @classmethod
    async def list_by_doctor(cls, doctor_id: int, active_only: bool = True):
        filter_dict: dict[str, Any] = {"doctor_id": doctor_id}
        if active_only:
            filter_dict["is_active"] = True
        return await cls.list(filter_dict=filter_dict, order_by="leave_date", descending=False)

    @classmethod
    async def find_for_date(cls, doctor_id: int, on_date: date_type) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM doctor_leaves
            WHERE doctor_id = $1
              AND leave_date = $2
              AND is_active = true
              AND (is_deleted = false OR is_deleted IS NULL)
            """
            rows = await conn.fetch(query, doctor_id, on_date)
            return [dict(r) for r in rows]


class DoctorSlotRepo(BasePostgresModel):
    TABLE = "doctor_slots"

    @classmethod
    async def list_open(cls, doctor_id: int, on_date: date_type) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM doctor_slots
            WHERE doctor_id = $1
              AND slot_date = $2
              AND is_booked = false
              AND is_active = true
              AND (is_deleted = false OR is_deleted IS NULL)
            ORDER BY start_time
            """
            rows = await conn.fetch(query, doctor_id, on_date)
            return [dict(r) for r in rows]

    @classmethod
    async def list_for_date(cls, doctor_id: int, on_date: date_type) -> list[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM doctor_slots
            WHERE doctor_id = $1
              AND slot_date = $2
              AND (is_deleted = false OR is_deleted IS NULL)
            ORDER BY start_time
            """
            rows = await conn.fetch(query, doctor_id, on_date)
            return [dict(r) for r in rows]

    @classmethod
    async def find_slot(cls, doctor_id: int, on_date: date_type, start_time) -> Optional[dict]:
        async with get_read_pool().acquire() as conn:
            query = """
            SELECT * FROM doctor_slots
            WHERE doctor_id = $1 AND slot_date = $2 AND start_time = $3
            """
            row = await conn.fetchrow(query, doctor_id, on_date, start_time)
            return dict(row) if row else None

    @classmethod
    async def claim(cls, slot_id: int) -> Optional[dict]:
        """Atomically flip is_booked. Returns None if someone else claimed it
        first (or it doesn't exist / isn't active) — the caller should treat
        that as 'please pick another slot', not raise."""
        async with get_write_pool().acquire() as conn:
            query = """
            UPDATE doctor_slots
            SET is_booked = true, local_updated_at = NOW(), server_updated_at = NOW()
            WHERE id = $1 AND NOT is_booked AND is_active AND NOT is_deleted
            RETURNING *
            """
            row = await conn.fetchrow(query, slot_id)
            return dict(row) if row else None

    @classmethod
    async def release(cls, slot_id: int) -> None:
        """Free up a slot again, e.g. after a cancellation."""
        if not slot_id:
            return
        async with get_write_pool().acquire() as conn:
            await conn.execute(
                "UPDATE doctor_slots SET is_booked = false, local_updated_at = NOW(), server_updated_at = NOW() WHERE id = $1",
                slot_id,
            )

    @classmethod
    async def generate_for_doctor(
        cls,
        doctor_id: int,
        clinic_id: int,
        days_ahead: int = 30,
    ) -> int:
        """Materialize doctor_slots for the next `days_ahead` days from the
        doctor's doctor_availability rules, skipping anything covered by
        doctor_leaves. Safe to re-run (ON CONFLICT DO NOTHING). Returns the
        number of rows inserted."""
        async with get_write_pool().acquire() as conn:
            query = """
            INSERT INTO doctor_slots (doctor_id, clinic_id, slot_date, start_time, end_time)
            SELECT
                da.doctor_id,
                $2::int,
                gs.slot_date,
                slot.start_time,
                slot.start_time + (da.slot_duration_minutes || ' minutes')::interval
            FROM doctor_availability da
            CROSS JOIN generate_series(
                CURRENT_DATE, CURRENT_DATE + ($3::int || ' days')::interval, '1 day'
            ) AS gs(slot_date)
            CROSS JOIN LATERAL (
                SELECT ts::time AS start_time
                FROM generate_series(
                    (DATE '2000-01-01' + da.start_time),
                    (DATE '2000-01-01' + da.end_time) - (da.slot_duration_minutes || ' minutes')::interval,
                    (da.slot_duration_minutes || ' minutes')::interval
                ) AS ts
            ) AS slot
            WHERE da.doctor_id = $1
              AND da.is_active AND NOT da.is_deleted
              AND EXTRACT(DOW FROM gs.slot_date) = da.day_of_week
              -- skip the doctor's lunch/break window, if one is set
              AND (
                  da.break_start_time IS NULL
                  OR NOT (slot.start_time, slot.start_time + (da.slot_duration_minutes || ' minutes')::interval)
                     OVERLAPS (da.break_start_time, da.break_end_time)
              )
              -- skip anything covered by a leave (full day or partial)
              AND NOT EXISTS (
                  SELECT 1 FROM doctor_leaves dl
                  WHERE dl.doctor_id = da.doctor_id
                    AND dl.leave_date = gs.slot_date::date
                    AND dl.is_active AND NOT dl.is_deleted
                    AND (
                        dl.start_time IS NULL
                        OR (slot.start_time, slot.start_time + (da.slot_duration_minutes || ' minutes')::interval)
                           OVERLAPS (dl.start_time, dl.end_time)
                    )
              )
            ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING
            """
            result = await conn.execute(query, doctor_id, clinic_id, days_ahead)
            # asyncpg execute() returns a string like "INSERT 0 12"
            try:
                return int(result.split()[-1])
            except (ValueError, IndexError):
                return 0
