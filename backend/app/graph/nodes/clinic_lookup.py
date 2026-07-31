"""clinic_lookup — load the clinic record for clinic-info requests.

The clinic is usually already on the state (chat_service loads it), so this node
mostly normalises it into ``matched_clinic`` and only hits the repo as a
fallback.
"""

from app.graph.state import ChatState
from app.repo.clinic_repo import ClinicRepo


async def clinic_lookup_node(state: ChatState) -> dict:
    clinic = state.get("clinic")
    if clinic:
        return {"matched_clinic": clinic}

    try:
        clinic = await ClinicRepo.get_by_id(state["clinic_id"])
    except ValueError:
        return {"matched_clinic": None}
    return {"matched_clinic": clinic}
