"""Appointment booking, lookup and lifecycle (cancel/reschedule).

An appointment now references a patient (patient_id) instead of storing
patient_name/phone/email inline, and optionally a pre-generated doctor_slots
row (slot_id). book_appointment() is the single entry point that ties all of
that together: resolve-or-create the patient, claim a slot if one exists,
compute the clinic-local and UTC timestamps, and persist the appointment --
falling back gracefully if two people grab the same slot at once.
"""

import asyncio
import smtplib
from datetime import date as date_type, datetime, time as time_type
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import asyncpg

from app.repo.appointment_repo import AppointmentRepo
from app.repo.clinic_repo import ClinicRepo
from app.repo.schedule_repo import DoctorSlotRepo
from app.services.patient_service import get_or_create_patient
from app.services.settings_service import get_email_settings_for_sending


class SlotUnavailableError(Exception):
    """Raised when the requested doctor/date/time is already booked --
    whether caught via a pre-generated slot claim or the appointments table's
    own unique constraint (ux_appointments_doctor_slot)."""


def _parse_time(value: Any) -> time_type:
    if isinstance(value, time_type):
        return value
    return time_type.fromisoformat(str(value)[:5] if len(str(value)) <= 5 else str(value))


def _local_and_utc(appointment_date: date_type, appointment_time: str, clinic_timezone: str):
    t = _parse_time(appointment_time)
    local_dt = datetime.combine(appointment_date, t)
    try:
        utc_dt = local_dt.replace(tzinfo=ZoneInfo(clinic_timezone)).astimezone(ZoneInfo("UTC"))
    except Exception:
        # Unknown/bad timezone string -- fall back to naive local time only
        # rather than failing the whole booking over a data-quality issue.
        utc_dt = None
    return local_dt, utc_dt


async def list_appointments(clinic_id: int, status: Optional[str] = None) -> List[dict]:
    appts = await AppointmentRepo.list_by_clinic(clinic_id, status=status)
    return await _enrich_with_names(appts, clinic_id)


async def list_appointments_paginated(
    clinic_id: int,
    status: Optional[str] = None,
    doctor_id: Optional[int] = None,
    start_date: Optional[date_type] = None,
    end_date: Optional[date_type] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    return await AppointmentRepo.list_paginated_by_clinic(
        clinic_id,
        status=status,
        doctor_id=doctor_id,
        start_date=start_date,
        end_date=end_date,
        q=q,
        page=page,
        page_size=page_size,
    )


async def list_appointments_for_patient(patient_id: int) -> List[dict]:
    return await AppointmentRepo.list_by_patient(patient_id)


async def _enrich_with_names(appts: List[dict], clinic_id: int) -> List[dict]:
    """Attach patient_name/patient_phone/patient_email and doctor_name to
    each appointment for convenient admin-panel display, without requiring
    the frontend to separately fetch and join /patients and /doctors."""
    if not appts:
        return appts

    from app.repo.doctor_repo import DoctorRepo
    from app.repo.patient_repo import PatientRepo

    patients = {p["id"]: p for p in await PatientRepo.list_by_clinic(clinic_id)}
    doctors = {d["id"]: d for d in await DoctorRepo.list_by_clinic(clinic_id)}

    enriched = []
    for a in appts:
        row = dict(a)
        patient = patients.get(row.get("patient_id"))
        doctor = doctors.get(row.get("doctor_id"))
        row["patient_name"] = patient.get("name") if patient else None
        row["patient_phone"] = patient.get("phone") if patient else None
        row["patient_email"] = patient.get("email") if patient else None
        row["doctor_name"] = doctor.get("name") if doctor else None
        enriched.append(row)
    return enriched


async def get_appointment(appt_id: int) -> Optional[dict]:
    try:
        appt = await AppointmentRepo.get_by_id(appt_id)
    except ValueError:
        return None
    enriched = await _enrich_with_names([appt], appt["clinic_id"])
    return enriched[0]


async def list_appointments_created_since(clinic_id: int, since: datetime, limit: int = 20) -> List[dict]:
    """Backs the admin notification bell's polling -- appointments created
    after `since`, from any source (chat or manual)."""
    return await AppointmentRepo.list_created_since(clinic_id, since, limit=limit)


async def get_doctor_day_schedule(clinic_id: int, doctor_id: int, on_date: date_type) -> Dict[str, Any]:
    """Composes the doctor-wise day view: available time slots (computed on
    the fly -- no pre-generated doctor_slots required), the day's
    appointments, and summary stat counts."""
    from app.repo.doctor_repo import DoctorRepo
    from app.services.availability_service import get_available_slots

    doctor = await DoctorRepo.get_by_id(doctor_id)

    open_slots = await get_available_slots(doctor_id, on_date)
    day_appts = await AppointmentRepo.list_for_doctor_on_date(doctor_id, on_date)
    day_appts = await _enrich_with_names(day_appts, clinic_id)

    booked_count = sum(1 for a in day_appts if a["status"] != "cancelled")
    rescheduled_count = sum(1 for a in day_appts if a["status"] == "rescheduled")
    available_count = len(open_slots)

    return {
        "doctor": doctor,
        "date": str(on_date),
        "stats": {
            "total_slots": available_count + booked_count,
            "booked": booked_count,
            "available": available_count,
            "rescheduled": rescheduled_count,
        },
        "available_slots": [
            {"start_time": str(s["start_time"])[:5], "end_time": str(s["end_time"])[:5]} for s in open_slots
        ],
        "appointments": day_appts,
    }


async def book_appointment(
    clinic_id: int,
    doctor_id: Optional[int],
    patient_name: str,
    patient_phone: str,
    patient_email: Optional[str],
    appointment_date: date_type,
    appointment_time: str,
    reason: Optional[str] = None,
    language: str = "en",
    patient_source: str = "manual",
) -> dict:
    """Resolve/create the patient, claim a slot if one exists, and create the
    appointment. Raises SlotUnavailableError if the slot was just taken."""
    patient = await get_or_create_patient(clinic_id, patient_name, patient_phone, patient_email, source=patient_source)
    appt = await _book_single_time(clinic_id, doctor_id, patient, appointment_date, appointment_time, reason, language)
    appt["patient"] = patient
    await _send_confirmation_email(appt, patient, [appointment_time])
    return appt


async def book_appointments_multi(
    clinic_id: int,
    doctor_id: Optional[int],
    patient_name: str,
    patient_phone: str,
    patient_email: Optional[str],
    appointment_date: date_type,
    appointment_times: List[str],
    reason: Optional[str] = None,
    language: str = "en",
    patient_source: str = "manual",
) -> Dict[str, Any]:
    """Book several times for the same patient/doctor/date in one call (e.g.
    a block of consecutive slots). The patient is resolved once; each time is
    then attempted independently -- if one is already taken, the others
    still go through rather than failing the whole batch. Returns
    {"booked": [...appointments], "failed": [{"time":..., "error":...}]}."""
    if not appointment_times:
        raise ValueError("appointment_times must contain at least one time")

    patient = await get_or_create_patient(clinic_id, patient_name, patient_phone, patient_email, source=patient_source)

    booked: List[dict] = []
    failed: List[Dict[str, str]] = []
    for t in appointment_times:
        try:
            appt = await _book_single_time(clinic_id, doctor_id, patient, appointment_date, t, reason, language)
            booked.append(appt)
        except SlotUnavailableError as exc:
            failed.append({"time": str(t), "error": str(exc)})

    if booked:
        await _send_confirmation_email(booked[0], patient, [b["appointment_time"] for b in booked])

    return {"patient": patient, "booked": booked, "failed": failed}


async def _book_single_time(
    clinic_id: int,
    doctor_id: Optional[int],
    patient: dict,
    appointment_date: date_type,
    appointment_time: str,
    reason: Optional[str],
    language: str,
) -> dict:
    """Claim a slot (if a matching pre-generated one exists -- most setups
    don't pre-generate and rely purely on the unique-constraint backstop
    below) and create the appointment row."""
    clinic = await ClinicRepo.get_by_id(clinic_id)
    clinic_timezone = clinic.get("timezone") or "Asia/Karachi"
    local_dt, utc_dt = _local_and_utc(appointment_date, appointment_time, clinic_timezone)

    slot_id = None
    if doctor_id:
        existing_slot = await DoctorSlotRepo.find_slot(doctor_id, appointment_date, _parse_time(appointment_time))
        if existing_slot:
            claimed = await DoctorSlotRepo.claim(existing_slot["id"])
            if not claimed:
                raise SlotUnavailableError(
                    f"Doctor {doctor_id} is already booked on {appointment_date} at {appointment_time}."
                )
            slot_id = claimed["id"]

    data = {
        "clinic_id": clinic_id,
        "doctor_id": doctor_id,
        "patient_id": patient["id"],
        "slot_id": slot_id,
        "appointment_date": appointment_date,
        "appointment_time": str(appointment_time),
        "appointment_local_time": local_dt,
        "appointment_utc_time": utc_dt,
        "reason": reason,
        "language": language,
    }

    try:
        return await AppointmentRepo.create(data)
    except asyncpg.exceptions.UniqueViolationError as exc:
        # Backstop: ux_appointments_doctor_slot caught a race the slot claim
        # above didn't (e.g. no pre-generated slot was in play at all).
        if slot_id:
            await DoctorSlotRepo.release(slot_id)
        raise SlotUnavailableError(
            f"Doctor {doctor_id} is already booked on {appointment_date} at {appointment_time}."
        ) from exc


async def update_appointment(appt_id: int, data: Dict[str, Any], note: Optional[str] = None) -> Optional[dict]:
    payload = dict(data)
    if note is not None:
        payload["status_note"] = note
    try:
        return await AppointmentRepo.update(appt_id, payload)
    except ValueError:
        return None


async def reschedule_appointment(
    appt_id: int,
    new_date: Optional[date_type] = None,
    new_time: Optional[str] = None,
    note: Optional[str] = None,
) -> Optional[dict]:
    """Move an appointment to a new date/time, releasing its old slot (if
    any) and claiming a new one (if one has been pre-generated for the new
    date/time)."""
    existing = await get_appointment(appt_id)
    if not existing:
        return None

    appointment_date = new_date or existing["appointment_date"]
    appointment_time = new_time or existing["appointment_time"]
    doctor_id = existing.get("doctor_id")

    clinic = await ClinicRepo.get_by_id(existing["clinic_id"])
    clinic_timezone = clinic.get("timezone") or "Asia/Karachi"
    local_dt, utc_dt = _local_and_utc(appointment_date, appointment_time, clinic_timezone)

    new_slot_id = None
    if doctor_id:
        candidate = await DoctorSlotRepo.find_slot(doctor_id, appointment_date, _parse_time(appointment_time))
        if candidate:
            claimed = await DoctorSlotRepo.claim(candidate["id"])
            if not claimed:
                raise SlotUnavailableError(
                    f"Doctor {doctor_id} is already booked on {appointment_date} at {appointment_time}."
                )
            new_slot_id = claimed["id"]

    update_data = {
        "status": "rescheduled",
        "appointment_date": appointment_date,
        "appointment_time": str(appointment_time),
        "appointment_local_time": local_dt,
        "appointment_utc_time": utc_dt,
        "slot_id": new_slot_id,
    }
    if note is not None:
        update_data["status_note"] = note

    try:
        updated = await AppointmentRepo.update(appt_id, update_data)
    except (ValueError, asyncpg.exceptions.UniqueViolationError) as exc:
        if new_slot_id:
            await DoctorSlotRepo.release(new_slot_id)
        if isinstance(exc, asyncpg.exceptions.UniqueViolationError):
            raise SlotUnavailableError(
                f"Doctor {doctor_id} is already booked on {appointment_date} at {appointment_time}."
            ) from exc
        return None

    old_slot_id = existing.get("slot_id")
    if old_slot_id and old_slot_id != new_slot_id:
        await DoctorSlotRepo.release(old_slot_id)

    return updated


async def cancel_appointment(appt_id: int, note: Optional[str] = None) -> Optional[dict]:
    existing = await get_appointment(appt_id)
    if not existing:
        return None

    payload: Dict[str, Any] = {"status": "cancelled"}
    if note is not None:
        payload["status_note"] = note

    try:
        updated = await AppointmentRepo.update(appt_id, payload)
    except ValueError:
        return None

    if existing.get("slot_id"):
        await DoctorSlotRepo.release(existing["slot_id"])

    return updated


async def _send_confirmation_email(appt: dict, patient: dict, appointment_times: List[str]):
    if not patient.get("email"):
        return
    email_cfg = await get_email_settings_for_sending(appt["clinic_id"])
    if not email_cfg.get("mail_username"):
        return
    # smtplib is blocking; keep the event loop free by running it in a thread
    await asyncio.to_thread(_send_confirmation_email_sync, appt, patient, email_cfg, appointment_times)


def _send_confirmation_email_sync(appt: dict, patient: dict, email_cfg: Dict[str, Any], appointment_times: List[str]):
    try:
        is_urdu = appt.get("language") == "ur"
        times_line = ", ".join(str(t)[:5] for t in appointment_times)
        subject = "تصدیق — MediBot اپوائنٹمنٹ" if is_urdu else "Appointment Confirmation — MediBot"
        if is_urdu:
            body = (
                f"محترم {patient.get('name')}،\n\n"
                f"آپ کی اپوائنٹمنٹ کی تصدیق ہو گئی ہے۔\n"
                f"تاریخ: {appt.get('appointment_date')}\n"
                f"وقت: {times_line}\n"
                f"وجہ: {appt.get('reason') or 'N/A'}\n\n"
                f"منسوخ کرنے کے لیے کلینک سے رابطہ کریں۔\n\nشکریہ — MediBot"
            )
        else:
            body = (
                f"Dear {patient.get('name')},\n\n"
                f"Your appointment has been confirmed.\n"
                f"Date: {appt.get('appointment_date')}\n"
                f"Time: {times_line}\n"
                f"Reason: {appt.get('reason') or 'N/A'}\n\n"
                f"To cancel, please contact the clinic.\n\nThank you — MediBot"
            )

        msg = MIMEMultipart()
        msg["From"] = email_cfg["mail_from"]
        msg["To"] = patient["email"]
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(email_cfg["mail_server"], email_cfg["mail_port"]) as server:
            server.starttls()
            server.login(email_cfg["mail_username"], email_cfg["mail_password"])
            server.sendmail(email_cfg["mail_from"], patient["email"], msg.as_string())
    except Exception:
        pass
