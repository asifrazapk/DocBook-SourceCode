"""State threaded through the I-DocAssistance chat graph.

Populated by chat_service before the graph runs, mutated node-to-node down the
deterministic pipeline, and read back by chat_service once the graph reaches
END. Every field is optional (total=False) because each node only writes the
keys it owns.
"""

from typing import Any, Dict, List, Optional, TypedDict


class ChatState(TypedDict, total=False):
    # -- Context, set once before the graph starts -------------------------
    clinic_id: int
    session_id: str
    lang: str                       # "en" | "ur"
    clinic: Dict[str, Any]
    faqs: List[Dict[str, Any]]
    user_message: str               # cleaned message (set by preprocess)
    raw_message: str                # original, untouched message
    history: List[Dict[str, str]]   # prior [{role, content}] turns
    messages: List[Any]             # LLM buffer for the response composer
    patient_phone: Optional[str]    # verified identity from chat login, if any

    # -- Preprocess --------------------------------------------------------
    is_emergency: bool
    input_error: Optional[str]

    # -- NLU ---------------------------------------------------------------
    intent: str
    entities: Dict[str, Any]        # entities extracted this turn only
    slots: Dict[str, Any]           # slots accumulated across turns

    # -- Validation / slot filling -----------------------------------------
    missing_fields: List[str]
    validation_error: Optional[str]

    # -- Lookups -----------------------------------------------------------
    matched_doctor: Optional[Dict[str, Any]]
    matched_clinic: Optional[Dict[str, Any]]
    doctors: List[Dict[str, Any]]
    availability: Optional[Dict[str, Any]]   # {"available": bool, "message": str}
    medical_records: List[Dict[str, Any]]    # phone-verified prescription/report lookup result

    # -- Confirmation / actions --------------------------------------------
    needs_confirmation: bool
    action_result: Optional[Dict[str, Any]]
    action_error: Optional[str]

    # -- Output ------------------------------------------------------------
    response_payload: Dict[str, Any]  # structured facts for the composer
    final_reply: str                  # deterministic reply (skips the LLM)
    quick_replies: List[str]
