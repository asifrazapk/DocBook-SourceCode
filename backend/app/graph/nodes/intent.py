"""nlu — classify intent AND extract appointment details in one call.

This replaces two separate sequential nodes (intent, entity_extractor) that
used to each make their own LLM round-trip. Merging them cuts one full
round-trip off every turn's latency, which was the single biggest lever for
bringing response time down.

Skips the call entirely when preprocess already decided the turn (emergency
or invalid input), same as before.
"""

from app.graph.constants import INTENT_LABELS, SLOT_FIELDS, Intent
from app.graph.llm import complete_json
from app.graph.prompts import build_nlu_messages
from app.graph.state import ChatState

# Entities are meaningless for these intents (small talk / already-decided
# bad input / a plain clinic-info lookup) -- discard whatever the model
# extracted for them rather than letting stray values pollute slots.
_NO_EXTRACT = {Intent.GREETING, Intent.EMERGENCY, Intent.INVALID, Intent.CLINIC_INFO}


async def intent_node(state: ChatState) -> dict:
    # preprocess may have already fixed the intent -- no need to spend a
    # call classifying/extracting on a turn that's already decided.
    if state.get("intent") in (Intent.EMERGENCY, Intent.INVALID):
        return {"entities": {}}

    messages = build_nlu_messages(
        user_message=state["user_message"],
        history=state.get("history", []),
        known_slots=state.get("slots", {}),
        lang=state.get("lang", "en"),
    )
    data = await complete_json(messages)

    intent = data.get("intent")
    if intent not in INTENT_LABELS:
        intent = Intent.OTHER

    entities = {}
    if intent not in _NO_EXTRACT:
        raw_entities = data.get("entities")
        if isinstance(raw_entities, dict):
            entities = {k: v for k, v in raw_entities.items() if k in SLOT_FIELDS and v not in (None, "", [])}

    return {"intent": intent, "entities": entities}
