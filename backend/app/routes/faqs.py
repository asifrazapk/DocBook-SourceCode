from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import faq_service

router = APIRouter(prefix="/faqs", tags=["faqs"])


class FAQCreate(BaseModel):
    clinic_id: int
    question_en: str
    question_ur: str | None = None
    answer_en: str
    answer_ur: str | None = None
    category: str | None = None


class FAQUpdate(BaseModel):
    question_en: str | None = None
    question_ur: str | None = None
    answer_en: str | None = None
    answer_ur: str | None = None
    category: str | None = None


@router.get("")
async def list_faqs(clinic_id: int):
    return await faq_service.list_faqs(clinic_id)


@router.post("", status_code=201)
async def create_faq(body: FAQCreate):
    return await faq_service.create_faq(body.model_dump())


@router.patch("/{faq_id}")
async def update_faq(faq_id: int, body: FAQUpdate):
    faq = await faq_service.update_faq(faq_id, body.model_dump(exclude_none=True))
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return faq


@router.delete("/{faq_id}", status_code=204)
async def delete_faq(faq_id: int):
    deleted = await faq_service.delete_faq(faq_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="FAQ not found")
