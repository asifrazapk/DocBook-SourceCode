"""faq — answer a general question from the clinic's FAQ list.

Searches the clinic FAQs for a match and hands the answer (or a no-match signal)
to the response composer as structured facts. Does not set a final_reply itself,
so the response node phrases the answer naturally and bilingually.
"""

from app.graph.state import ChatState
from app.services.faq_service import search_faq


async def faq_node(state: ChatState) -> dict:
    clinic_id = state["clinic_id"]
    lang = state.get("lang", "en")
    query = state.get("user_message", "")

    answer = await search_faq(clinic_id, query, lang=lang)

    payload = {
        "intent": "faq",
        "question": query,
        "faq_answer": answer,          # None if nothing matched
        "matched": answer is not None,
    }
    return {"response_payload": payload}
