"""Appointment booking, lookup and lifecycle (cancel/reschedule).

An appointment now references a patient (patient_id) instead of storing
patient_name/phone/email inline, and optionally a pre-generated doctor_slots
row (slot_id). book_appointment() is the single entry point that ties all of
that together: resolve-or-create the patient, claim a slot if one exists,
compute the clinic-local and UTC timestamps, and persist the appointment --
falling back gracefully if two people grab the same slot at once.
"""

import asyncio
import logging
import smtplib
from datetime import date as date_type, datetime, time as time_type, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import asyncpg

from app.repo.appointment_repo import AppointmentRepo
from app.repo.clinic_repo import ClinicRepo
from app.repo.schedule_repo import DoctorSlotRepo
from app.services.patient_service import get_or_create_patient
from app.services.settings_service import get_email_settings_for_sending

logger = logging.getLogger(__name__)

# Tracks in-flight best-effort side effects (confirmation emails,
# notifications) fired via _fire_and_forget() so the request/response cycle
# doesn't block on them, while still keeping a reference so asyncio doesn't
# garbage-collect a task mid-flight.
_background_tasks: set[asyncio.Task] = set()


async def _run_background(coro, label: str) -> None:
    try:
        await coro
    except Exception:
        logger.exception(f"Background task failed: {label}")


def _fire_and_forget(coro, label: str) -> None:
    """Schedule a best-effort side effect without making the caller wait
    for it -- used for confirmation emails and notifications, which should
    never delay an appointment booking/update response."""
    task = asyncio.create_task(_run_background(coro, label))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


class SlotUnavailableError(Exception):
    """Raised when the requested doctor/date/time is already booked --
    whether caught via a pre-generated slot claim or the appointments table's
    own unique constraint (ux_appointments_doctor_slot)."""


def _parse_time(value: Any) -> time_type:
    if isinstance(value, time_type):
        return value
    return time_type.fromisoformat(str(value)[:5] if len(str(value)) <= 5 else str(value))


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


async def list_appointments_for_phone(clinic_id: int, phone: str, limit: int = 10) -> List[dict]:
    """Patient-facing lookup for 'is my appointment confirmed/cancelled?' --
    phone-verified (the phone the patient logged into chat with), same
    pattern as the prescription lookup. Most recent/upcoming first."""
    from app.repo.patient_repo import PatientRepo

    patient = await PatientRepo.find_by_phone(clinic_id, phone)
    if not patient:
        return []
    appts = await AppointmentRepo.list_by_patient(patient["id"])
    enriched = await _enrich_with_names(appts, clinic_id)
    enriched.sort(key=lambda a: (a["appointment_date"], a["appointment_time"]), reverse=True)
    return enriched[:limit]


class NotOwnerError(Exception):
    """Raised when a phone-verified action is attempted against an
    appointment that doesn't belong to that phone number."""


async def _verify_patient_owns_appointment(appt_id: int, clinic_id: int, phone: str) -> dict:
    appt = await get_appointment(appt_id)
    if not appt or appt.get("clinic_id") != clinic_id:
        raise ValueError("Appointment not found")
    if (appt.get("patient_phone") or "") != phone:
        raise NotOwnerError("This appointment doesn't belong to that phone number.")
    return appt


async def reschedule_appointment_as_patient(
    appt_id: int, clinic_id: int, phone: str, new_date: Optional[date_type], new_time: Optional[str]
) -> dict:
    """Phone-verified reschedule for the patient-facing My Appointments page
    -- same underlying logic as the admin's reschedule, but only allowed if
    the calling phone actually matches the appointment's patient."""
    await _verify_patient_owns_appointment(appt_id, clinic_id, phone)
    updated = await reschedule_appointment(appt_id, new_date=new_date, new_time=new_time, note="Rescheduled by patient")
    if not updated:
        raise ValueError("Appointment not found")
    return updated


async def cancel_appointment_as_patient(appt_id: int, clinic_id: int, phone: str) -> dict:
    """Phone-verified cancel for the patient-facing My Appointments page."""
    await _verify_patient_owns_appointment(appt_id, clinic_id, phone)
    updated = await cancel_appointment(appt_id, note="Cancelled by patient")
    if not updated:
        raise ValueError("Appointment not found")
    return updated


async def enable_telemedicine_as_patient(appt_id: int, clinic_id: int, phone: str) -> dict:
    """Phone-verified: lets a patient turn their own appointment into a
    video consultation (e.g. requesting a video visit instead of an
    in-person one), same ownership check as reschedule/cancel."""
    await _verify_patient_owns_appointment(appt_id, clinic_id, phone)
    updated = await update_appointment(appt_id, {"is_telemedicine": True})
    if not updated:
        raise ValueError("Appointment not found")
    return updated


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
    _fire_and_forget(_send_confirmation_email(appt, patient, [appointment_time]), "send_confirmation_email")
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
        _fire_and_forget(
            _send_confirmation_email(booked[0], patient, [b["appointment_time"] for b in booked]),
            "send_confirmation_email",
        )

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
        # Always store as a canonical HH:MM:SS string -- callers may pass
        # "11:00", "11:00:00", or a real time object, and the unique
        # double-booking constraint below is a pure string comparison, so an
        # inconsistent format would silently let two "same" times coexist.
        "appointment_time": str(_parse_time(appointment_time)),
        "reason": reason,
        "language": language,
    }

    try:
        created = await AppointmentRepo.create(data)
    except asyncpg.exceptions.UniqueViolationError as exc:
        # Backstop: ux_appointments_doctor_slot caught a race the slot claim
        # above didn't (e.g. no pre-generated slot was in play at all).
        if slot_id:
            await DoctorSlotRepo.release(slot_id)
        raise SlotUnavailableError(
            f"Doctor {doctor_id} is already booked on {appointment_date} at {appointment_time}."
        ) from exc

    _fire_and_forget(
        _notify_new_appointment(clinic_id, doctor_id, patient, appointment_date, created.get("status", "pending")),
        "notify_new_appointment",
    )
    return created


async def _notify_new_appointment(clinic_id: int, doctor_id: Optional[int], patient: dict, appointment_date, status: str) -> None:
    """Best-effort: a new booking (from any source -- chat, admin, or a
    patient's own self-service page) shows up in the admin notification
    bell. Failure here should never break the booking itself."""
    try:
        from app.services import notification_service
        from app.repo.doctor_repo import DoctorRepo

        doctor_name = None
        if doctor_id:
            doctor = await DoctorRepo.get_by_id(doctor_id)
            doctor_name = doctor.get("name") if doctor else None

        who = f"{patient.get('name') or 'a patient'}" + (f" with {doctor_name}" if doctor_name else "")
        message = (
            f"New appointment request from {who} on {appointment_date} — needs confirmation."
            if status == "pending"
            else f"New appointment booked for {who} on {appointment_date}."
        )
        await notification_service.create_notification(clinic_id, message, notification_type="appointment_created")
    except Exception:
        logger.exception("Failed to create notification for new appointment (booking itself still succeeded)")


async def _send_templated_email(clinic_id: int, to_address: str, subject: str, body: str):
    """Generic template-rendered email sender, used for the
    confirm-notifies-patient-and-doctor feature (Settings > Message templates)."""
    if not to_address:
        return
    email_cfg = await get_email_settings_for_sending(clinic_id)
    if not email_cfg.get("mail_username"):
        return
    await asyncio.to_thread(_send_templated_email_sync, to_address, subject, body, email_cfg)


def _send_templated_email_sync(to_address: str, subject: str, body: str, email_cfg: Dict[str, Any]):
    try:
        msg = MIMEMultipart()
        msg["From"] = email_cfg["mail_from"]
        msg["To"] = to_address
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(email_cfg["mail_server"], email_cfg["mail_port"]) as server:
            server.starttls()
            server.login(email_cfg["mail_username"], email_cfg["mail_password"])
            server.sendmail(email_cfg["mail_from"], to_address, msg.as_string())
    except Exception:
        # Best-effort: a misconfigured SMTP server or an invalid recipient
        # shouldn't break the confirmation flow, but it should be visible in
        # the logs rather than silently vanishing.
        logger.exception(f"Failed to send templated email to {to_address}")


async def _notify_confirmation(appt: dict):
    """Emails BOTH the patient and the doctor once an appointment is
    actually confirmed, using the admin-editable templates in
    Settings > Message templates. Best-effort -- a missing email address or
    unconfigured SMTP just means that side silently doesn't get emailed."""
    from app.services.settings_service import get_message_templates, render_template
    from app.repo.patient_repo import PatientRepo
    from app.repo.doctor_repo import DoctorRepo

    clinic_id = appt["clinic_id"]
    clinic = await ClinicRepo.get_by_id(clinic_id)
    templates = await get_message_templates(clinic_id)

    try:
        patient = await PatientRepo.get_by_id(appt["patient_id"])
    except ValueError:
        patient = None
    doctor = None
    if appt.get("doctor_id"):
        try:
            doctor = await DoctorRepo.get_by_id(appt["doctor_id"])
        except ValueError:
            doctor = None

    variables = {
        "patient_name": patient.get("name") if patient else "",
        "doctor_name": doctor.get("name") if doctor else "the clinic",
        "clinic_name": clinic.get("name") if clinic else "",
        "appointment_date": str(appt.get("appointment_date")),
        "appointment_time": str(appt.get("appointment_time"))[:5],
        "reason": appt.get("reason") or "N/A",
    }

    if patient and patient.get("email"):
        body = render_template(templates["patient_confirmation"], **variables)
        await _send_templated_email(clinic_id, patient["email"], "Appointment Confirmed", body)

    if doctor and doctor.get("email"):
        body = render_template(templates["doctor_notification"], **variables)
        await _send_templated_email(clinic_id, doctor["email"], "Appointment Confirmed", body)


async def update_appointment(appt_id: int, data: Dict[str, Any], note: Optional[str] = None) -> Optional[dict]:
    payload = dict(data)
    if note is not None:
        payload["status_note"] = note

    existing = await get_appointment(appt_id)
    if not existing:
        return None

    if payload.get("is_telemedicine") and not existing.get("video_room_key"):
        # Jitsi Meet needs no API key/account -- any unique room name works,
        # and meet.jit.si/<key> is immediately a real, working video room.
        import uuid

        payload["video_room_key"] = f"I-DocAssistance-{existing['clinic_id']}-{appt_id}-{uuid.uuid4().hex[:8]}"

    try:
        updated = await AppointmentRepo.update(appt_id, payload)
    except ValueError:
        return None

    # Notify patient + doctor only on the actual pending -> confirmed
    # transition, not on every subsequent edit (e.g. adding a note later).
    if updated and payload.get("status") == "confirmed" and existing.get("status") != "confirmed":
        _fire_and_forget(_notify_confirmation(updated), "notify_confirmation")

    return updated


async def reschedule_appointment(
    appt_id: int,
    new_date: Optional[date_type] = None,
    new_time: Optional[str] = None,
    new_doctor_id: Optional[int] = None,
    note: Optional[str] = None,
) -> Optional[dict]:
    """Move an appointment to a new date/time and/or a different doctor,
    releasing its old slot (if any) and claiming a new one (if one has been
    pre-generated for the new doctor/date/time)."""
    existing = await get_appointment(appt_id)
    if not existing:
        return None

    appointment_date = new_date or existing["appointment_date"]
    appointment_time = new_time or existing["appointment_time"]
    doctor_id = new_doctor_id if new_doctor_id is not None else existing.get("doctor_id")
    time_changed = appointment_date != existing["appointment_date"] or _parse_time(appointment_time) != _parse_time(existing["appointment_time"])

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
        "status": "rescheduled" if time_changed else existing["status"],
        "appointment_date": appointment_date,
        "appointment_time": str(_parse_time(appointment_time)),
        "doctor_id": doctor_id,
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

    if existing.get("doctor_id"):
        from app.services.waitlist_service import notify_waitlist_for_opening

        _fire_and_forget(
            notify_waitlist_for_opening(existing["clinic_id"], existing["doctor_id"], existing["appointment_date"]),
            "notify_waitlist_for_opening",
        )

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
        subject = "تصدیق — I-DocAssistance اپوائنٹمنٹ" if is_urdu else "Appointment Confirmation — I-DocAssistance"
        if is_urdu:
            body = (
                f"محترم {patient.get('name')}،\n\n"
                f"آپ کی اپوائنٹمنٹ کی تصدیق ہو گئی ہے۔\n"
                f"تاریخ: {appt.get('appointment_date')}\n"
                f"وقت: {times_line}\n"
                f"وجہ: {appt.get('reason') or 'N/A'}\n\n"
                f"منسوخ کرنے کے لیے کلینک سے رابطہ کریں۔\n\nشکریہ — I-DocAssistance"
            )
        else:
            body = (
                f"Dear {patient.get('name')},\n\n"
                f"Your appointment has been confirmed.\n"
                f"Date: {appt.get('appointment_date')}\n"
                f"Time: {times_line}\n"
                f"Reason: {appt.get('reason') or 'N/A'}\n\n"
                f"To cancel, please contact the clinic.\n\nThank you — I-DocAssistance"
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
        logger.exception(f"Failed to send booking confirmation email to {patient.get('email')}")


async def send_due_reminders(clinic_id: int) -> Dict[str, Any]:
    """Emails patients (and the doctor, if telemedicine) whose confirmed
    appointment is happening ~24h from now and hasn't been reminded yet.

    This function does the actual sending -- something still needs to CALL
    it on a schedule (a cron job, or a serverless scheduled trigger hitting
    POST /appointments/send-reminders) for reminders to go out automatically.
    There's no built-in scheduler in this app; that's an infra decision for
    wherever this gets deployed (e.g. a `cron` entry, GitHub Actions on a
    schedule, or APScheduler if this runs as a long-lived process).
    """
    from app.repo.patient_repo import PatientRepo
    from app.repo.doctor_repo import DoctorRepo
    from app.services.settings_service import get_message_templates, render_template

    target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
    candidates = await AppointmentRepo.list_by_clinic(clinic_id, status="confirmed")
    due = [a for a in candidates if a["appointment_date"] == target_date and not a.get("reminder_sent_at")]

    if not due:
        return {"checked": len(candidates), "sent": 0}

    templates = await get_message_templates(clinic_id)
    clinic = await ClinicRepo.get_by_id(clinic_id)
    sent = 0

    for appt in due:
        try:
            patient = await PatientRepo.get_by_id(appt["patient_id"])
        except ValueError:
            patient = None
        doctor = None
        if appt.get("doctor_id"):
            try:
                doctor = await DoctorRepo.get_by_id(appt["doctor_id"])
            except ValueError:
                doctor = None

        if patient and patient.get("email"):
            variables = {
                "patient_name": patient.get("name") or "",
                "doctor_name": doctor.get("name") if doctor else "the clinic",
                "clinic_name": clinic.get("name") if clinic else "",
                "appointment_date": str(appt.get("appointment_date")),
                "appointment_time": str(appt.get("appointment_time"))[:5],
                "reason": appt.get("reason") or "N/A",
            }
            body = "Reminder: " + render_template(templates["patient_confirmation"], **variables)
            await _send_templated_email(clinic_id, patient["email"], "Appointment Reminder — Tomorrow", body)
            sent += 1

        await AppointmentRepo.update(appt["id"], {"reminder_sent_at": datetime.now(timezone.utc)})

    return {"checked": len(candidates), "sent": sent}
