"""Assemble and compile the MediBot deterministic node pipeline.

Flow (see router.py for the conditional edges):

    preprocess
      └─(route_after_preprocess)─▶ intent ─▶ merge_state
                                 └─(invalid)──────────────────────────▶ response
    (intent now classifies AND extracts entities in one call -- see nlu_prompt.py)
    merge_state ─(route_by_intent)─▶ faq | clinic_lookup | doctor_lookup
                                     | validator | cancel | reschedule
                                     | save_memory  (greeting/emergency/other)
    validator ─(route_after_validation)─▶ ask_missing | doctor_lookup
    doctor_lookup ─(route_after_doctor_lookup)─▶ doctor_info | availability
    availability ─(route_after_availability)─▶ confirmation | save_memory
    confirmation ─(route_after_confirmation)─▶ booking | save_memory
    clinic_lookup ─▶ clinic_info ─▶ save_memory
    faq | doctor_info | ask_missing | booking | cancel | reschedule ─▶ save_memory
    save_memory ─▶ response ─▶ END
"""

from langgraph.graph import END, StateGraph

from app.graph.nodes import (
    ask_missing_node,
    availability_node,
    booking_node,
    cancel_node,
    clinic_info_node,
    clinic_lookup_node,
    confirmation_node,
    doctor_info_node,
    doctor_lookup_node,
    faq_node,
    intent_node,
    medical_record_node,
    merge_state_node,
    preprocess_node,
    reschedule_node,
    response_node,
    save_memory_node,
    validator_node,
)
from app.graph.router import (
    route_after_availability,
    route_after_confirmation,
    route_after_doctor_lookup,
    route_after_preprocess,
    route_after_validation,
    route_by_intent,
)
from app.graph.state import ChatState


def build_chat_graph():
    graph = StateGraph(ChatState)

    # -- register nodes ----------------------------------------------------
    graph.add_node("preprocess", preprocess_node)
    graph.add_node("intent", intent_node)
    graph.add_node("merge_state", merge_state_node)
    graph.add_node("validator", validator_node)
    graph.add_node("ask_missing", ask_missing_node)
    graph.add_node("clinic_lookup", clinic_lookup_node)
    graph.add_node("doctor_lookup", doctor_lookup_node)
    graph.add_node("availability", availability_node)
    graph.add_node("confirmation", confirmation_node)
    graph.add_node("booking", booking_node)
    graph.add_node("faq", faq_node)
    graph.add_node("doctor_info", doctor_info_node)
    graph.add_node("clinic_info", clinic_info_node)
    graph.add_node("cancel", cancel_node)
    graph.add_node("reschedule", reschedule_node)
    graph.add_node("medical_record", medical_record_node)
    graph.add_node("save_memory", save_memory_node)
    graph.add_node("response", response_node)

    # -- entry + NLU front -------------------------------------------------
    graph.set_entry_point("preprocess")
    graph.add_conditional_edges(
        "preprocess",
        route_after_preprocess,
        {"intent": "intent", "response": "response"},
    )
    graph.add_edge("intent", "merge_state")

    # -- fan out by intent -------------------------------------------------
    graph.add_conditional_edges(
        "merge_state",
        route_by_intent,
        {
            "faq": "faq",
            "doctor_lookup": "doctor_lookup",
            "clinic_lookup": "clinic_lookup",
            "validator": "validator",
            "cancel": "cancel",
            "reschedule": "reschedule",
            "medical_record": "medical_record",
            "save_memory": "save_memory",
        },
    )

    # -- booking sub-flow --------------------------------------------------
    graph.add_conditional_edges(
        "validator",
        route_after_validation,
        {"ask_missing": "ask_missing", "doctor_lookup": "doctor_lookup"},
    )
    graph.add_conditional_edges(
        "doctor_lookup",
        route_after_doctor_lookup,
        {"doctor_info": "doctor_info", "availability": "availability"},
    )
    graph.add_conditional_edges(
        "availability",
        route_after_availability,
        {"confirmation": "confirmation", "save_memory": "save_memory"},
    )
    graph.add_conditional_edges(
        "confirmation",
        route_after_confirmation,
        {"booking": "booking", "save_memory": "save_memory"},
    )

    # -- info branches -----------------------------------------------------
    graph.add_edge("clinic_lookup", "clinic_info")

    # -- everything converges on save_memory then response -----------------
    for node in (
        "faq",
        "doctor_info",
        "clinic_info",
        "ask_missing",
        "booking",
        "cancel",
        "reschedule",
        "medical_record",
    ):
        graph.add_edge(node, "save_memory")

    graph.add_edge("save_memory", "response")
    graph.add_edge("response", END)

    return graph.compile()


# Built once at import time and reused across requests.
chat_graph = build_chat_graph()


async def run_chat_graph(state: ChatState) -> ChatState:
    return await chat_graph.ainvoke(state)
