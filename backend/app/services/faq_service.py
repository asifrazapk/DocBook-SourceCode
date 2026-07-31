from typing import Any, Dict, List, Optional

from app.repo.faq_repo import FAQRepo


async def list_faqs(clinic_id: int) -> List[dict]:
    return await FAQRepo.list_by_clinic(clinic_id)


async def get_faq(faq_id: int) -> Optional[dict]:
    try:
        return await FAQRepo.get_by_id(faq_id)
    except ValueError:
        return None


async def create_faq(data: Dict[str, Any]) -> dict:
    return await FAQRepo.create(data)


async def update_faq(faq_id: int, data: Dict[str, Any]) -> Optional[dict]:
    try:
        return await FAQRepo.update(faq_id, data)
    except ValueError:
        return None


async def delete_faq(faq_id: int) -> bool:
    try:
        await FAQRepo.get_by_id(faq_id)
    except ValueError:
        return False
    return await FAQRepo.delete(faq_id)


async def search_faq(clinic_id: int, query: str, lang: str = "en") -> Optional[str]:
    faqs = await FAQRepo.list_by_clinic(clinic_id)
    query_lower = query.lower()
    for faq in faqs:
        question_en = (faq.get("question_en") or "").lower()
        question_ur = (faq.get("question_ur") or "").lower()
        if query_lower in question_en or query_lower in question_ur:
            if lang == "ur" and faq.get("answer_ur"):
                return faq["answer_ur"]
            return faq.get("answer_en")
    return None


async def get_all_faqs_for_context(clinic_id: int) -> List[dict]:
    faqs = await FAQRepo.list_by_clinic(clinic_id)
    return [
        {
            "question_en": f.get("question_en"),
            "answer_en": f.get("answer_en"),
            "question_ur": f.get("question_ur"),
            "answer_ur": f.get("answer_ur"),
        }
        for f in faqs
    ]
