from typing import Optional

from app.repo.review_repo import ReviewRepo


async def submit_review(
    clinic_id: int, appointment_id: int, patient_id: int, doctor_id: Optional[int], rating: int, comment: Optional[str]
) -> dict:
    return await ReviewRepo.create(
        {
            "clinic_id": clinic_id,
            "appointment_id": appointment_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "rating": rating,
            "comment": comment,
        }
    )


async def list_public_reviews(clinic_id: int) -> list[dict]:
    return await ReviewRepo.list_public(clinic_id)


async def list_all_reviews(clinic_id: int) -> list[dict]:
    return await ReviewRepo.list_all(clinic_id)


async def get_rating_summary(clinic_id: int) -> dict:
    return await ReviewRepo.average_rating(clinic_id)


async def set_review_visibility(review_id: int, is_public: bool) -> dict:
    return await ReviewRepo.update(review_id, {"is_public": is_public})
