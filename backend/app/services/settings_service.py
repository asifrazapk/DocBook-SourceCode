"""Admin-configurable app settings (currently: email/SMTP config), stored
per clinic in app_settings. Falls back to the env-based Settings object
(app/core/config.py) if nothing has been configured yet through the admin
panel, so the app keeps working out of the box.
"""

from typing import Any, Dict, Optional

from app.core.config import settings as env_settings
from app.repo.settings_repo import SettingsRepo

EMAIL_KEY = "email"
GENERAL_KEY = "general"
TEMPLATES_KEY = "message_templates"

DEFAULT_EMAIL_SETTINGS: Dict[str, Any] = {
    "mail_username": env_settings.MAIL_USERNAME,
    "mail_password": "",  # never echoed back to the client once set
    "mail_from": env_settings.MAIL_FROM,
    "mail_port": env_settings.MAIL_PORT,
    "mail_server": env_settings.MAIL_SERVER,
}

DEFAULT_GENERAL_SETTINGS: Dict[str, Any] = {
    "default_language": "en",  # 'en' or 'ur' -- fallback when a message's language can't be auto-detected
    "notifications_enabled": True,  # in-app notifications (e.g. "appointment booked")
}

# Placeholders available: {patient_name}, {doctor_name}, {clinic_name},
# {appointment_date}, {appointment_time}, {reason}
DEFAULT_TEMPLATES: Dict[str, Any] = {
    "patient_confirmation": (
        "Dear {patient_name},\n\n"
        "Your appointment with {doctor_name} at {clinic_name} has been confirmed for "
        "{appointment_date} at {appointment_time}.\n\n"
        "If you need to reschedule or cancel, please contact the clinic.\n\n"
        "Thank you."
    ),
    "doctor_notification": (
        "Dear {doctor_name},\n\n"
        "An appointment with {patient_name} has been confirmed for {appointment_date} at "
        "{appointment_time}. Reason: {reason}.\n\n"
        "— {clinic_name}"
    ),
}


async def get_message_templates(clinic_id: int) -> Dict[str, Any]:
    row = await SettingsRepo.get(clinic_id, TEMPLATES_KEY)
    return {**DEFAULT_TEMPLATES, **(row["value"] if row else {})}


async def update_message_templates(clinic_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    current = await get_message_templates(clinic_id)
    merged = {**current, **data}
    await SettingsRepo.upsert(clinic_id, TEMPLATES_KEY, merged)
    return merged


async def get_general_settings(clinic_id: int) -> Dict[str, Any]:
    row = await SettingsRepo.get(clinic_id, GENERAL_KEY)
    return {**DEFAULT_GENERAL_SETTINGS, **(row["value"] if row else {})}


async def update_general_settings(clinic_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    current = await get_general_settings(clinic_id)
    merged = {**current, **data}
    await SettingsRepo.upsert(clinic_id, GENERAL_KEY, merged)
    return merged


async def get_email_settings(clinic_id: int, reveal_password: bool = False) -> Dict[str, Any]:
    row = await SettingsRepo.get(clinic_id, EMAIL_KEY)
    value = {**DEFAULT_EMAIL_SETTINGS, **(row["value"] if row else {})}
    if not reveal_password:
        value = {**value, "mail_password": "•••••••" if value.get("mail_password") else ""}
    return value


async def get_email_settings_for_sending(clinic_id: int) -> Dict[str, Any]:
    """Internal use only (appointment_service) -- includes the real password."""
    return await get_email_settings(clinic_id, reveal_password=True)


async def update_email_settings(clinic_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    existing = await SettingsRepo.get(clinic_id, EMAIL_KEY)
    current = {**DEFAULT_EMAIL_SETTINGS, **(existing["value"] if existing else {})}

    # An empty/omitted password means "keep the existing one" -- so the
    # admin isn't forced to re-type it every time they update other fields.
    incoming = dict(data)
    if not incoming.get("mail_password"):
        incoming["mail_password"] = current.get("mail_password", "")

    merged = {**current, **incoming}
    await SettingsRepo.upsert(clinic_id, EMAIL_KEY, merged)
    return await get_email_settings(clinic_id)


class _SafeDict(dict):
    def __missing__(self, key):
        return ""


def render_template(template: str, **kwargs) -> str:
    """Fill {placeholders} in a message template -- any variable not
    supplied renders as blank rather than raising, so an admin's custom
    template with a typo'd placeholder doesn't break the send."""
    return template.format_map(_SafeDict(**kwargs))
