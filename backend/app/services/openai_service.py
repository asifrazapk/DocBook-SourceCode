"""LEGACY / UNUSED — an earlier single-function-loop chat implementation,
superseded by the LangGraph pipeline in app/services/chat_service.py +
app/graph/. Nothing imports this module (routes/chat.py uses chat_service).
Kept working (not deleted) in case it's still a useful reference, but the
active code path is chat_service.py — update that one for behavior changes.
"""

import json
from datetime import date
from typing import Optional

from openai import AsyncAzureOpenAI

from app.core.config import settings
from app.repo.clinic_repo import ClinicRepo
from app.repo.doctor_repo import DoctorRepo
from app.repo.conversation_repo import ConversationRepo
from app.repo.chat_repo import ChatMessageRepo
from app.services.appointment_service import SlotUnavailableError, book_appointment
from app.services.availability_service import check_availability
from app.services.faq_service import get_all_faqs_for_context
from app.services.doctor_service import find_doctor_by_name

# Azure OpenAI client (light model deployment, e.g. gpt-5.4-nano) — async client
client = AsyncAzureOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT_SM,
    api_key=settings.AZURE_OPENAI_KEY_SM,
    api_version=settings.AZURE_OPENAI_PREVIEW_API_VERSION_SM,
)

# On Azure OpenAI, "model" must be the deployment name, not the base model name.
AZURE_DEPLOYMENT_SM = settings.AZURE_OPENAI_MODEL_SM

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_doctors",
            "description": "Returns available doctors and their specialties at the clinic.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_clinic_info",
            "description": "Returns clinic address, phone, opening hours.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check if a doctor is available on a given date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_id": {"type": "integer", "description": "Doctor ID"},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                },
                "required": ["doctor_id", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": "Book an appointment for the patient.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_name": {"type": "string"},
                    "patient_phone": {"type": "string"},
                    "patient_email": {"type": "string"},
                    "doctor_id": {"type": "integer"},
                    "appointment_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "appointment_time": {"type": "string", "description": "HH:MM"},
                    "reason": {"type": "string"},
                },
                "required": ["patient_name", "patient_phone", "appointment_date", "appointment_time"],
            },
        },
    },
]


def _build_system_prompt(clinic: dict, faqs: list[dict]) -> str:
    faq_block = "\n".join(
        f"Q: {f['question_en']} | A: {f['answer_en']}" for f in faqs[:20]
    )
    return f"""You are MediBot, the friendly virtual assistant for {clinic['name']}.
You help patients book appointments, answer questions about the clinic, and handle basic symptom queries.
Always be clear, calm, and professional. Never diagnose — always recommend seeing a doctor for medical concerns.
For emergencies, direct the patient to call 1122 or 115 immediately.

You speak both English and Urdu fluently. Detect the patient's language from their first message and respond in the same language throughout. If they write in Roman Urdu or Nastaliq Urdu script, reply in Urdu.

Clinic details:
- Name: {clinic['name']}
- Address: {clinic['address']}
- Phone: {clinic['phone']}
- Hours: {json.dumps(clinic.get('opening_hours') or {})}

Frequently Asked Questions:
{faq_block if faq_block else "No FAQs configured yet."}

When booking an appointment, collect: patient name, phone number, preferred doctor, date, time, and reason for visit. Confirm all details before calling book_appointment.
"""


async def _execute_tool(name: str, args: dict, clinic_id: int, lang: str) -> str:
    if name == "list_doctors":
        doctors = await DoctorRepo.list_by_clinic(clinic_id)
        if not doctors:
            return "No doctors registered yet."
        return "\n".join(f"- Dr. {d['name']} ({d['specialty']}), ID: {d['id']}" for d in doctors)

    elif name == "get_clinic_info":
        try:
            clinic = await ClinicRepo.get_by_id(clinic_id)
        except ValueError:
            return "Clinic not found."
        return f"Address: {clinic['address']}\nPhone: {clinic['phone']}\nHours: {json.dumps(clinic.get('opening_hours') or {})}"

    elif name == "check_availability":
        try:
            doctor = await DoctorRepo.get_by_id(args.get("doctor_id"))
        except ValueError:
            return "Doctor not found."
        req_date = args.get("date", "")
        try:
            parsed_date = date.fromisoformat(req_date)
        except ValueError:
            return "Invalid date format."
        result = await check_availability(doctor["id"], doctor.get("name"), parsed_date)
        if result.get("available"):
            return f"Dr. {doctor['name']} is available on {req_date}."
        return f"Dr. {doctor['name']} is not available on {req_date} ({result.get('reason')})."

    elif name == "book_appointment":
        try:
            # Resolve doctor_id by name if GPT passed doctor_name instead of id
            doctor_id = args.get("doctor_id")
            if not doctor_id and args.get("doctor_name"):
                doc = await find_doctor_by_name(clinic_id, args["doctor_name"])
                doctor_id = doc["id"] if doc else None

            appt = await book_appointment(
                clinic_id=clinic_id,
                doctor_id=doctor_id,
                patient_name=args.get("patient_name", ""),
                patient_phone=args.get("patient_phone", ""),
                patient_email=args.get("patient_email"),
                appointment_date=date.fromisoformat(args["appointment_date"]),
                appointment_time=args.get("appointment_time", ""),
                reason=args.get("reason"),
                language=lang,
            )
            if lang == "ur":
                return f"اپوائنٹمنٹ بک ہو گئی ہے (ID: {appt['id']})۔ {appt['appointment_date']} کو {appt['appointment_time']} بجے ملیں۔"
            return f"Appointment confirmed! ✅ ID: #{appt['id']} — {appt['appointment_date']} at {appt['appointment_time']}. See you soon!"
        except SlotUnavailableError:
            return "That time slot was just taken -- please suggest another time to the patient."
        except Exception as e:
            return f"Booking failed: {str(e)}"

    return "Unknown function."


async def get_chat_response(
    clinic_id: int,
    session_id: str,
    user_message: str,
) -> tuple[str, list[str]]:
    try:
        clinic = await ClinicRepo.get_by_id(clinic_id)
    except ValueError:
        return "Clinic not found.", []

    # Detect language hint (simple heuristic; GPT handles actual detection)
    lang = "ur" if any(ord(c) > 1536 for c in user_message) else "en"

    # Get or create conversation
    conv = await ConversationRepo.get_by_session_id(session_id)
    if not conv:
        conv = await ConversationRepo.create({"clinic_id": clinic_id, "session_id": session_id})

    # Load history (messages stores one row per turn: message_text +
    # llm_response together) and unpack it back into role/content pairs.
    turn_rows = await ChatMessageRepo.list_by_conversation(conv["id"])
    history = []
    for row in turn_rows:
        if row.get("message_text"):
            history.append({"role": "user", "content": row["message_text"]})
        if row.get("llm_response"):
            history.append({"role": "assistant", "content": row["llm_response"]})

    faqs = await get_all_faqs_for_context(clinic_id)
    system_prompt = _build_system_prompt(clinic, faqs)

    messages = [{"role": "system", "content": system_prompt}]
    messages += history
    messages.append({"role": "user", "content": user_message})

    # Call GPT with tool use loop
    final_reply = ""
    for _ in range(5):
        response = await client.chat.completions.create(
            model=AZURE_DEPLOYMENT_SM,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        choice = response.choices[0]

        if choice.finish_reason == "tool_calls":
            messages.append(choice.message)
            for tool_call in choice.message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                result = await _execute_tool(fn_name, fn_args, clinic_id, lang)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
        else:
            final_reply = choice.message.content or ""
            break

    # Persist the whole turn as one row.
    if final_reply:
        await ChatMessageRepo.create_turn(
            conversation_id=conv["id"],
            message_text=user_message,
            llm_response=final_reply,
        )

    quick_replies = _suggest_quick_replies(final_reply, lang)
    return final_reply, quick_replies


def _suggest_quick_replies(reply: str, lang: str) -> list[str]:
    reply_lower = reply.lower()
    if lang == "ur":
        if "اپوائنٹمنٹ" in reply:
            return ["نئی اپوائنٹمنٹ", "ڈاکٹرز دیکھیں", "اوقات کار"]
        return ["اپوائنٹمنٹ بک کریں", "ڈاکٹرز دیکھیں", "کلینک کی معلومات"]
    if "appointment" in reply_lower:
        return ["Book another", "View doctors", "Opening hours"]
    return ["Book appointment", "View doctors", "Clinic info"]
