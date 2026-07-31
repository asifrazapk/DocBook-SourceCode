"""entity_extractor — pull structured appointment details from the message.

Writes only what the patient supplied this turn into ``entities``; merge_state
is responsible for combining it with slots carried from earlier turns. Skipped
for intents that never need entities (greeting / emergency / invalid).
"""

from app.graph.constants import SLOT_FIELDS, Intent
from app.graph.llm import complete_json
from app.graph.prompts import build_extraction_messages
from app.graph.state import ChatState

_NO_EXTRACT = {Intent.GREETING, Intent.EMERGENCY, Intent.INVALID, Intent.CLINIC_INFO}


async def entity_extractor_node(state: ChatState) -> dict:
    if state.get("intent") in _NO_EXTRACT:
        return {"entities": {}}

    messages = build_extraction_messages(
        user_message=state["user_message"],
        history=state.get("history", []),
        known_slots=state.get("slots", {}),
        lang=state.get("lang", "en"),
    )
    data = await complete_json(messages)

    # Keep only recognised slot keys with a real value.
    entities = {
        k: v
        for k, v in data.items()
        if k in SLOT_FIELDS and v not in (None, "", [])
    }
    return {"entities": entities}
