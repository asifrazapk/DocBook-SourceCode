from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.pagination import validate_page_size
from app.services import clinic_service

router = APIRouter(prefix="/clinics", tags=["clinics"])


class ClinicCreate(BaseModel):
    name: str
    slug: str
    address: str
    phone: str
    email: str
    opening_hours: dict | None = None
    timezone: str = "Asia/Karachi"
    logo_url: str | None = None


class ClinicUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    opening_hours: dict | None = None
    logo_url: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_clinics():
    """Bare, unpaginated list -- used by the clinic switcher, which needs
    every clinic to populate its dropdown. See /clinics/paginated for the
    admin table view."""
    return await clinic_service.list_clinics()


@router.get("/paginated")
async def list_clinics_paginated(q: str | None = None, page: int = 1, page_size: int = 10):
    validate_page_size(page_size)
    return await clinic_service.list_clinics_paginated(q=q, page=page, page_size=page_size)


@router.get("/{slug}")
async def get_clinic(slug: str):
    clinic = await clinic_service.get_clinic_by_slug(slug)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.post("", status_code=201)
async def create_clinic(body: ClinicCreate):
    return await clinic_service.create_clinic(body.model_dump())


@router.patch("/{clinic_id}")
async def update_clinic(clinic_id: int, body: ClinicUpdate):
    clinic = await clinic_service.update_clinic(clinic_id, body.model_dump(exclude_none=True))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic
