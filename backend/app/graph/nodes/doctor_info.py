"""doctor_info — present doctor(s) to the patient.

If doctor_lookup matched a single doctor, surface their details plus their
recurring weekly schedule (doctor_availability); otherwise hand the whole
roster to the response composer so it can list who's available. Sets
structured facts only — phrasing is the response node's job.
"""

from app.graph.state import ChatState
from app.services.availability_service import get_weekly_schedule

_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def _slim(d: dict) -> dict:
    return {
        "id": d.get("id"),
        "name": d.get("name"),
        "specialty": d.get("specialty"),
        "bio": d.get("bio"),
        "years_of_experience": d.get("years_of_experience"),
        "education": d.get("education"),
    }


def _format_schedule(rows: list[dict]) -> list[dict]:
    formatted = []
    for r in rows:
        entry = {
            "day": _DAY_NAMES[r["day_of_week"]],
            "start_time": str(r["start_time"])[:5],
            "end_time": str(r["end_time"])[:5],
        }
        if r.get("break_start_time") and r.get("break_end_time"):
            entry["break"] = f"{str(r['break_start_time'])[:5]}-{str(r['break_end_time'])[:5]}"
        formatted.append(entry)
    return formatted


async def doctor_info_node(state: ChatState) -> dict:
    matched = state.get("matched_doctor")
    doctors = state.get("doctors", [])
    requested_name = (state.get("slots", {}).get("doctor_name") or "").strip()

    matched_payload = None
    if matched:
        schedule = await get_weekly_schedule(matched["id"])
        matched_payload = {**_slim(matched), "schedule": _format_schedule(schedule)}

    payload = {
        "intent": "doctor_info",
        "matched_doctor": matched_payload,
        # Only attach the roster when we're actually presenting a *list* to
        # choose from -- once a single doctor is matched, the roster isn't
        # relevant anymore and including it here was making the quick-reply
        # chips repeat doctor names instead of offering "view slots" / "book"
        # next steps.
        "doctors": [] if matched else [_slim(d) for d in doctors],
        "count": len(doctors),
        # Set only when the patient named a SPECIFIC doctor and no one by
        # that name was found at this clinic -- distinct from a generic
        # "who are your doctors" browsing question, where no name was given
        # in the first place. Lets the response composer say plainly that
        # doctor isn't here (instead of silently listing the roster as if
        # nothing was wrong) and suggest real alternatives from `doctors`.
        "requested_doctor_not_found": requested_name if (requested_name and not matched) else None,
    }
    return {"response_payload": payload}
