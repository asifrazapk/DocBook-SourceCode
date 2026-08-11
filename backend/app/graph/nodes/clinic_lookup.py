"""clinic_lookup — load the clinic record for clinic-info requests.

The clinic is usually already on the state (chat_service loads it), so this node
mostly normalises it into ``matched_clinic`` and only hits the repo as a
fallback.
"""

from app.graph.state import ChatState
from app.services.clinic_service import get_clinic_cached


async def clinic_lookup_node(state: ChatState) -> dict:
    clinic = state.get("clinic")
    if clinic:
        return {"matched_clinic": clinic}

    try:
        clinic = await get_clinic_cached(state["clinic_id"])
    except ValueError:
        return {"matched_clinic": None}
    return {"matched_clinic": clinic}
