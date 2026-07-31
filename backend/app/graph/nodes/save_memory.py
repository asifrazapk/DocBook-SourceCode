"""save_memory — persist accumulated slots so the next turn remembers them.

This is the shared choke point every branch flows through before the response
node. It writes the merged slots to a per-session store keyed by session_id.

The store is an in-process dict, which is enough for a single worker and keeps
the code dependency-free. In production, back ``_STORE`` with Redis (or a
conversation-state table) so memory survives restarts and works across workers —
only load_slots / save_slots need to change.
"""

from typing import Any, Dict

from app.graph.state import ChatState

# session_id -> slots dict
_STORE: Dict[str, Dict[str, Any]] = {}


def load_slots(session_id: str) -> Dict[str, Any]:
    """Return remembered slots for a session (empty dict if none)."""
    if not session_id:
        return {}
    return dict(_STORE.get(session_id, {}))


def save_slots(session_id: str, slots: Dict[str, Any]) -> None:
    if not session_id:
        return
    _STORE[session_id] = dict(slots)


def clear_slots(session_id: str) -> None:
    _STORE.pop(session_id, None)


async def save_memory_node(state: ChatState) -> dict:
    session_id = state.get("session_id", "")
    slots = state.get("slots", {})

    # Don't persist the transient confirmation flag between turns.
    to_persist = {k: v for k, v in slots.items() if k != "confirmed"}
    save_slots(session_id, to_persist)

    return {}
