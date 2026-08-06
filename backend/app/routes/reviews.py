from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import review_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    clinic_id: int
    appointment_id: int
    patient_id: int
    doctor_id: int | None = None
    rating: int
    comment: str | None = None


class VisibilityUpdate(BaseModel):
    is_public: bool


@router.get("/public")
async def public_reviews(clinic_id: int):
    """Backs the public clinic review page -- only reviews marked visible."""
    return await review_service.list_public_reviews(clinic_id)


@router.get("/summary")
async def rating_summary(clinic_id: int):
    return await review_service.get_rating_summary(clinic_id)


@router.get("")
async def all_reviews(clinic_id: int):
    """Admin view -- every review including ones hidden from the public page."""
    return await review_service.list_all_reviews(clinic_id)


@router.post("", status_code=201)
async def submit_review(body: ReviewCreate):
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=422, detail="rating must be between 1 and 5")
    return await review_service.submit_review(
        body.clinic_id, body.appointment_id, body.patient_id, body.doctor_id, body.rating, body.comment
    )


@router.patch("/{review_id}/visibility")
async def set_visibility(review_id: int, body: VisibilityUpdate):
    return await review_service.set_review_visibility(review_id, body.is_public)
