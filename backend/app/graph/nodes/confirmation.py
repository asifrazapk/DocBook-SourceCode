"""confirmation — gate a booking behind an explicit patient confirmation.

If the patient hasn't yet affirmed (``slots['confirmed']`` is falsy), build a
summary and set a deterministic reply asking them to confirm; the turn ends
there. Once they affirm on a later turn, route_after_confirmation sends the flow
to the booking node.
"""

from app.graph.state import ChatState


async def confirmation_node(state: ChatState) -> dict:
    slots = state.get("slots", {})
    lang = state.get("lang", "en")
    confirmed = bool(slots.get("confirmed"))

    if confirmed:
        # route_after_confirmation will send us to booking; nothing to say here.
        return {"needs_confirmation": False}

    availability = state.get("availability") or {}
    doctor = state.get("matched_doctor") or {}

    summary = _summary(slots, doctor, lang)

    if availability.get("available") is False:
        note = _availability_note(availability, lang)
        if note:
            summary += note

    if lang == "ur":
        summary += "\n\nکیا میں یہ اپوائنٹمنٹ کنفرم کر دوں؟ (ہاں/نہیں)"
    else:
        summary += "\n\nShall I confirm this appointment? (yes/no)"

    return {"needs_confirmation": True, "final_reply": summary}


def _availability_note(availability: dict, lang: str) -> str:
    reason = availability.get("reason")
    open_slots = ", ".join(availability.get("open_slots", [])) or None

    if reason == "day_off":
        return (
            "\n\nنوٹ: ڈاکٹر اس دن دستیاب نہیں ہیں۔"
            if lang == "ur"
            else "\n\nNote: the doctor doesn't work on that day."
        )
    if reason == "on_leave":
        return (
            "\n\nنوٹ: ڈاکٹر اس تاریخ کو رخصت پر ہیں۔"
            if lang == "ur"
            else "\n\nNote: the doctor is on leave that day."
        )
    if reason in ("already_booked_or_closed", "fully_booked"):
        if open_slots:
            return (
                f"\n\nنوٹ: یہ وقت دستیاب نہیں۔ دستیاب اوقات: {open_slots}۔"
                if lang == "ur"
                else f"\n\nNote: that time isn't available. Open slots that day: {open_slots}."
            )
        return (
            "\n\nنوٹ: اس تاریخ کو کوئی وقت دستیاب نہیں۔"
            if lang == "ur"
            else "\n\nNote: there are no open slots that day."
        )
    return ""


def _summary(slots: dict, doctor: dict, lang: str) -> str:
    doctor_name = doctor.get("name") or slots.get("doctor_name") or "—"
    if lang == "ur":
        return (
            "براہ کرم تفصیلات کی تصدیق کریں:\n"
            f"• مریض: {slots.get('patient_name', '—')}\n"
            f"• فون: {slots.get('patient_phone', '—')}\n"
            f"• ڈاکٹر: {doctor_name}\n"
            f"• تاریخ: {slots.get('appointment_date', '—')}\n"
            f"• وقت: {slots.get('appointment_time', '—')}\n"
            f"• وجہ: {slots.get('reason', '—')}"
        )
    return (
        "Please confirm these details:\n"
        f"• Patient: {slots.get('patient_name', '—')}\n"
        f"• Phone: {slots.get('patient_phone', '—')}\n"
        f"• Doctor: {doctor_name}\n"
        f"• Date: {slots.get('appointment_date', '—')}\n"
        f"• Time: {slots.get('appointment_time', '—')}\n"
        f"• Reason: {slots.get('reason', '—')}"
    )
