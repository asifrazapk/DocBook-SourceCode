"""Doctor availability logic.

Combines three sources to answer "can this doctor see a patient at this
date/time":

  doctor_availability -> the recurring weekly rule (which days, what hours,
                          optional lunch break, slot length)
  doctor_leaves       -> one-off exceptions (a day off, or a few hours off)
  doctor_slots        -> pre-generated bookable slots (optional -- if a
                          doctor's slots haven't been generated for a given
                          date yet, we fall back to computing straight from
                          doctor_availability/doctor_leaves instead)

Also checks the appointments table itself so an already-booked time isn't
offered again even when doctor_slots isn't in use.
"""

from datetime import date as date_type, datetime, time as time_type, timedelta
from typing import Any, Dict, List, Optional

from app.repo.appointment_repo import AppointmentRepo
from app.repo.schedule_repo import DoctorAvailabilityRepo, DoctorLeaveRepo, DoctorSlotRepo


def _add_minutes(t: time_type, minutes: int) -> time_type:
    dt = datetime.combine(date_type.today(), t) + timedelta(minutes=minutes)
    return dt.time()


def _overlaps(a_start: time_type, a_end: time_type, b_start: time_type, b_end: time_type) -> bool:
    return a_start < b_end and b_start < a_end


async def get_weekly_schedule(doctor_id: int) -> List[Dict[str, Any]]:
    """Full recurring schedule, for display (e.g. doctor_info) or an admin
    edit screen."""
    return await DoctorAvailabilityRepo.list_by_doctor(doctor_id)


async def get_leaves(doctor_id: int) -> List[Dict[str, Any]]:
    return await DoctorLeaveRepo.list_by_doctor(doctor_id)


async def _leave_for_date(doctor_id: int, on_date: date_type) -> Optional[dict]:
    leaves = await DoctorLeaveRepo.find_for_date(doctor_id, on_date)
    for leave in leaves:
        if leave.get("start_time") is None:
            return leave  # full day off takes priority
    return leaves[0] if leaves else None


def _generate_day_slots(rule: dict) -> List[Dict[str, time_type]]:
    """Turn one doctor_availability row into a list of {start_time, end_time}
    slot windows, skipping the break if one is set."""
    slots = []
    duration = rule["slot_duration_minutes"]
    cur = rule["start_time"]
    end = rule["end_time"]
    break_start = rule.get("break_start_time")
    break_end = rule.get("break_end_time")

    while True:
        slot_end = _add_minutes(cur, duration)
        if slot_end > end:
            break
        if break_start and break_end and _overlaps(cur, slot_end, break_start, break_end):
            cur = slot_end
            continue
        slots.append({"start_time": cur, "end_time": slot_end})
        cur = slot_end
    return slots


async def get_available_slots(doctor_id: int, on_date: date_type) -> List[Dict[str, Any]]:
    """Open, bookable slots for a doctor on a given date."""
    # Prefer pre-generated slots if any exist for this date.
    all_slots_for_date = await DoctorSlotRepo.list_for_date(doctor_id, on_date)
    if all_slots_for_date:
        return [s for s in all_slots_for_date if not s["is_booked"] and s["is_active"] and not s["is_deleted"]]

    # Fall back: compute from the recurring rule + leaves + existing appointments.
    leave = await _leave_for_date(doctor_id, on_date)
    if leave and leave.get("start_time") is None:
        return []  # full day off

    day_of_week = int(on_date.strftime("%w"))  # 0=Sunday ... 6=Saturday, matches schema
    rules = await DoctorAvailabilityRepo.list_for_day(doctor_id, day_of_week)
    if not rules:
        return []

    candidate_slots: List[Dict[str, time_type]] = []
    for rule in rules:
        candidate_slots.extend(_generate_day_slots(rule))

    if leave and leave.get("start_time") is not None:
        candidate_slots = [
            s for s in candidate_slots
            if not _overlaps(s["start_time"], s["end_time"], leave["start_time"], leave["end_time"])
        ]

    booked_times = await _booked_times(doctor_id, on_date)
    return [s for s in candidate_slots if s["start_time"] not in booked_times]


async def _booked_times(doctor_id: int, on_date: date_type) -> set:
    appts = await AppointmentRepo.list(
        filter_dict={"doctor_id": doctor_id, "appointment_date": on_date},
        order_by="appointment_time",
        descending=False,
    )
    booked = set()
    for a in appts:
        if a.get("status") == "cancelled":
            continue
        raw = a.get("appointment_time")
        try:
            t = time_type.fromisoformat(str(raw)[:5]) if len(str(raw)) <= 5 else time_type.fromisoformat(str(raw))
        except ValueError:
            continue
        booked.add(t)
    return booked


def _format_ampm(t) -> str:
    """12-hour display format for the chat-facing slot list (e.g. '9:00 AM').
    Only used here -- the admin API's get_available_slots() stays in 24-hour
    HH:MM since the admin UI relies on that for sorting/matching."""
    return t.strftime("%I:%M %p").lstrip("0")


async def check_availability(
    doctor_id: int,
    doctor_name: Optional[str],
    on_date: date_type,
    on_time: Optional[str] = None,
) -> Dict[str, Any]:
    """Mirrors the shape the graph's availability node needs: whether the
    doctor can be booked on this date (and, if a time was given, at that
    specific time)."""
    leave = await _leave_for_date(doctor_id, on_date)
    if leave and leave.get("start_time") is None:
        return {
            "available": False,
            "reason": "on_leave",
            "date": str(on_date),
            "doctor_name": doctor_name,
            "leave_reason": leave.get("reason"),
        }

    day_of_week = int(on_date.strftime("%w"))
    rules = await DoctorAvailabilityRepo.list_for_day(doctor_id, day_of_week)
    if not rules:
        return {
            "available": False,
            "reason": "day_off",
            "date": str(on_date),
            "doctor_name": doctor_name,
        }

    open_slots = await get_available_slots(doctor_id, on_date)

    if not on_time:
        return {
            "available": bool(open_slots),
            "reason": "ok" if open_slots else "fully_booked",
            "date": str(on_date),
            "doctor_name": doctor_name,
            "open_slots": [_format_ampm(s["start_time"]) for s in open_slots[:10]],
        }

    try:
        requested = time_type.fromisoformat(on_time)
    except ValueError:
        return {"available": False, "reason": "bad_time", "date": str(on_date), "doctor_name": doctor_name}

    is_open = any(s["start_time"] == requested for s in open_slots)
    return {
        "available": is_open,
        "reason": "ok" if is_open else "already_booked_or_closed",
        "date": str(on_date),
        "time": on_time,
        "doctor_name": doctor_name,
        "open_slots": [_format_ampm(s["start_time"]) for s in open_slots[:10]],
    }
