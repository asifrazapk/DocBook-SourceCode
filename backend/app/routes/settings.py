from fastapi import APIRouter
from pydantic import BaseModel

from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


class EmailSettingsUpdate(BaseModel):
    mail_username: str | None = None
    mail_password: str | None = None  # blank/omitted = keep existing password
    mail_from: str | None = None
    mail_port: int | None = None
    mail_server: str | None = None


@router.get("/email")
async def get_email_settings(clinic_id: int):
    return await settings_service.get_email_settings(clinic_id)


@router.put("/email")
async def update_email_settings(clinic_id: int, body: EmailSettingsUpdate):
    return await settings_service.update_email_settings(clinic_id, body.model_dump(exclude_none=True))


class GeneralSettingsUpdate(BaseModel):
    default_language: str | None = None  # 'en' or 'ur'
    notifications_enabled: bool | None = None


@router.get("/general")
async def get_general_settings(clinic_id: int):
    return await settings_service.get_general_settings(clinic_id)


@router.put("/general")
async def update_general_settings(clinic_id: int, body: GeneralSettingsUpdate):
    return await settings_service.update_general_settings(clinic_id, body.model_dump(exclude_none=True))


class MessageTemplatesUpdate(BaseModel):
    patient_confirmation: str | None = None
    doctor_notification: str | None = None


@router.get("/message-templates")
async def get_message_templates(clinic_id: int):
    return await settings_service.get_message_templates(clinic_id)


@router.put("/message-templates")
async def update_message_templates(clinic_id: int, body: MessageTemplatesUpdate):
    return await settings_service.update_message_templates(clinic_id, body.model_dump(exclude_none=True))
