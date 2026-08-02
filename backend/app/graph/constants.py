"""Shared constants for the MediBot chat graph.

Intent labels, required-slot definitions, validation patterns, emergency
keywords and quick-reply templates live here so nodes and prompts import a
single source of truth instead of hard-coding strings.
"""

import re

# ---------------------------------------------------------------------------
# Intents
# ---------------------------------------------------------------------------
class Intent:
    """Canonical intent labels produced by the intent-classification node."""

    BOOK = "book_appointment"
    CANCEL = "cancel_appointment"
    RESCHEDULE = "reschedule_appointment"
    AVAILABILITY = "check_availability"
    DOCTOR_INFO = "doctor_info"
    CLINIC_INFO = "clinic_info"
    FAQ = "faq"
    MEDICAL_RECORD = "view_prescription"  # patient asking to see their prescription/report
    GREETING = "greeting"
    EMERGENCY = "emergency"
    OTHER = "other"
    INVALID = "invalid"  # set by preprocess when the message is unusable


# Every label the classifier is allowed to return (INVALID is internal only).
INTENT_LABELS = [
    Intent.BOOK,
    Intent.CANCEL,
    Intent.RESCHEDULE,
    Intent.AVAILABILITY,
    Intent.DOCTOR_INFO,
    Intent.CLINIC_INFO,
    Intent.FAQ,
    Intent.MEDICAL_RECORD,
    Intent.GREETING,
    Intent.EMERGENCY,
    Intent.OTHER,
]

# ---------------------------------------------------------------------------
# Slots
# ---------------------------------------------------------------------------
# Slots the entity extractor tries to fill and that merge_state accumulates
# across turns.
SLOT_FIELDS = [
    "patient_name",
    "patient_phone",
    "patient_email",
    "doctor_name",
    "specialty",
    "appointment_date",  # YYYY-MM-DD
    "appointment_time",  # HH:MM (24h)
    "reason",
    "appointment_id",
    "confirmed",  # bool — user affirmed the booking summary
]

# Slots that must be present before a booking can proceed.
REQUIRED_BOOKING_SLOTS = [
    "patient_name",
    "patient_phone",
    "doctor_name",
    "appointment_date",
    "appointment_time",
]

# Human-readable slot names for the "ask for missing info" prompt.
SLOT_LABELS_EN = {
    "patient_name": "your full name",
    "patient_phone": "your phone number",
    "patient_email": "your email (optional)",
    "doctor_name": "which doctor you'd like to see",
    "specialty": "the specialty you need",
    "appointment_date": "the date (YYYY-MM-DD)",
    "appointment_time": "the time (HH:MM)",
    "reason": "the reason for your visit",
    "appointment_id": "the appointment ID",
}

SLOT_LABELS_UR = {
    "patient_name": "آپ کا پورا نام",
    "patient_phone": "آپ کا فون نمبر",
    "patient_email": "آپ کا ای میل (اختیاری)",
    "doctor_name": "آپ کس ڈاکٹر سے ملنا چاہتے ہیں",
    "specialty": "مطلوبہ شعبہ",
    "appointment_date": "تاریخ (سال-مہینہ-دن)",
    "appointment_time": "وقت (گھنٹہ:منٹ)",
    "reason": "ملاقات کی وجہ",
    "appointment_id": "اپوائنٹمنٹ آئی ڈی",
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
MAX_MESSAGE_LENGTH = 4000

PHONE_RE = re.compile(r"^[0-9+\-\s()]{7,20}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ---------------------------------------------------------------------------
# Emergency detection
# ---------------------------------------------------------------------------
EMERGENCY_KEYWORDS = [
    # English
    "emergency", "heart attack", "stroke", "bleeding", "unconscious",
    "not breathing", "chest pain", "suicide", "overdose", "seizure",
    "can't breathe", "cant breathe", "severe pain",
    # Roman Urdu
    "emergency hai", "saans nahi", "behosh", "dil ka daura", "khoon",
    # Urdu script
    "ایمرجنسی", "سانس نہیں", "بے ہوش", "دل کا دورہ", "خون",
]

EMERGENCY_NUMBERS = "1122 / 115"

# ---------------------------------------------------------------------------
# Affirmation detection (for the confirmation step)
# ---------------------------------------------------------------------------
AFFIRMATIVES = [
    "yes", "yep", "yeah", "confirm", "confirmed", "sure", "ok", "okay",
    "go ahead", "book it", "haan", "han", "jee", "ji", "theek", "ٹھیک",
    "ہاں", "جی", "بک کر",
]

# ---------------------------------------------------------------------------
# Quick replies
# ---------------------------------------------------------------------------
QUICK_REPLIES = {
    "en": {
        "default": ["Book appointment", "View doctors", "Clinic info"],
        "post_booking": ["Book another", "View doctors", "Opening hours"],
        "doctors": ["Book appointment", "Check availability", "Clinic info"],
    },
    "ur": {
        "default": ["اپوائنٹمنٹ بک کریں", "ڈاکٹرز دیکھیں", "کلینک کی معلومات"],
        "post_booking": ["نئی اپوائنٹمنٹ", "ڈاکٹرز دیکھیں", "اوقات کار"],
        "doctors": ["اپوائنٹمنٹ بک کریں", "دستیابی چیک کریں", "کلینک کی معلومات"],
    },
}
