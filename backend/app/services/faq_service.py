import time
from typing import Any, Dict, List, Optional

from app.repo.faq_repo import FAQRepo

# Cache for the chat pipeline's per-turn FAQ context fetch -- FAQs change
# rarely (admin-edited), but get_all_faqs_for_context() was being re-queried
# from the DB on every single chat message. Writes (create/update/delete)
# invalidate immediately, so the long TTL only matters for the rare case of
# an edit made directly in the DB out-of-band.
_FAQ_CACHE_TTL_SECONDS = 60 * 60
_faq_cache: Dict[int, tuple[float, List[dict]]] = {}


async def list_faqs(clinic_id: int) -> List[dict]:
    return await FAQRepo.list_by_clinic(clinic_id)


async def get_faq(faq_id: int) -> Optional[dict]:
    try:
        return await FAQRepo.get_by_id(faq_id)
    except ValueError:
        return None


async def create_faq(data: Dict[str, Any]) -> dict:
    created = await FAQRepo.create(data)
    _faq_cache.pop(created.get("clinic_id"), None)
    return created


async def update_faq(faq_id: int, data: Dict[str, Any]) -> Optional[dict]:
    try:
        updated = await FAQRepo.update(faq_id, data)
    except ValueError:
        return None
    _faq_cache.pop(updated.get("clinic_id"), None)
    return updated


async def delete_faq(faq_id: int) -> bool:
    try:
        existing = await FAQRepo.get_by_id(faq_id)
    except ValueError:
        return False
    deleted = await FAQRepo.delete(faq_id)
    _faq_cache.pop(existing.get("clinic_id"), None)
    return deleted


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
    cached = _faq_cache.get(clinic_id)
    if cached and (time.monotonic() - cached[0]) < _FAQ_CACHE_TTL_SECONDS:
        return cached[1]

    faqs = await FAQRepo.list_by_clinic(clinic_id)
    result = [
        {
            "question_en": f.get("question_en"),
            "answer_en": f.get("answer_en"),
            "question_ur": f.get("question_ur"),
            "answer_ur": f.get("answer_ur"),
        }
        for f in faqs
    ]
    _faq_cache[clinic_id] = (time.monotonic(), result)
    return result
