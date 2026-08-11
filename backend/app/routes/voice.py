import asyncio
import base64
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.services import voice_service
from app.services.chat_service import get_chat_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


class SpeakRequest(BaseModel):
    text: str
    voice_id: str | None = None


@router.post("/speak")
async def speak(body: SpeakRequest):
    """Text-to-speech -- returns raw MP3 bytes for an <audio> element."""
    try:
        audio_bytes = await asyncio.to_thread(voice_service.synthesize_speech, body.text, body.voice_id)
    except voice_service.VoiceNotConfiguredError as exc:
        logger.warning(f"/voice/speak: not configured -- {exc}")
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("/voice/speak: speech synthesis failed")
        raise HTTPException(status_code=502, detail=f"Speech synthesis failed: {exc}")
    return Response(content=audio_bytes, media_type="audio/mpeg")


class VoiceMessageRequest(BaseModel):
    clinic_id: int
    session_id: str
    message: str  # already transcribed by the browser's own speech recognition
    patient_phone: str | None = None
    patient_name: str | None = None
    language: str | None = None


@router.post("/message")
async def voice_message(body: VoiceMessageRequest):
    """One round trip for the voice-chat page: the browser has already
    transcribed the patient's speech (same Web Speech API the text chat's
    mic button uses), so this just runs the transcript through the normal
    chat pipeline and returns the reply as both text and speech audio.
    If ElevenLabs isn't configured, this still returns the text reply --
    the frontend falls back to the browser's own TTS in that case."""
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="No speech was recognized -- please try again.")

    reply, quick_replies, message_id, used_language = await get_chat_response(
        clinic_id=body.clinic_id,
        session_id=body.session_id,
        user_message=body.message,
        patient_phone=body.patient_phone,
        patient_name=body.patient_name,
        language=body.language,
    )

    audio_b64 = None
    try:
        reply_audio = await asyncio.to_thread(voice_service.synthesize_speech, reply)
        audio_b64 = base64.b64encode(reply_audio).decode("ascii")
    except voice_service.VoiceNotConfiguredError as exc:
        logger.warning(f"/voice/message: TTS not configured, falling back to browser TTS -- {exc}")
    except Exception:
        # Best-effort -- the text reply below still gets through -- but this
        # used to fail completely silently (e.g. a 402 from ElevenLabs for a
        # library voice on a free plan), which looked like "ElevenLabs just
        # isn't calling" with zero trace of why. Now it's at least in the logs.
        logger.exception("/voice/message: speech synthesis failed, falling back to browser TTS")

    return {
        "patient_text": body.message,
        "reply": reply,
        "quick_replies": quick_replies,
        "message_id": message_id,
        "language": used_language,
        "reply_audio_base64": audio_b64,
    }
