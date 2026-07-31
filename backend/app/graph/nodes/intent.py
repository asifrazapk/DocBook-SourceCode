"""intent — classify the patient's latest message into one canonical intent.

Skips the LLM call when preprocess already decided the turn (emergency or
invalid input), keeping the pipeline cheap on those paths.
"""

from app.graph.constants import INTENT_LABELS, Intent
from app.graph.llm import complete_json
from app.graph.prompts import build_intent_messages
from app.graph.state import ChatState


async def intent_node(state: ChatState) -> dict:
    # preprocess may have already fixed the intent.
    if state.get("intent") in (Intent.EMERGENCY, Intent.INVALID):
        return {}

    messages = build_intent_messages(
        user_message=state["user_message"],
        history=state.get("history", []),
        lang=state.get("lang", "en"),
    )
    data = await complete_json(messages)

    intent = data.get("intent")
    if intent not in INTENT_LABELS:
        intent = Intent.OTHER

    return {"intent": intent}
