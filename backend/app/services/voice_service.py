"""Voice service for the voice-chat interface: text-to-speech only.

Speech-to-text is handled entirely in the browser now, using the same
Web Speech API (SpeechRecognition) the text chat's mic button already uses
-- so there's no audio upload and no Whisper/Azure transcription deployment
to configure. The backend's only job here is turning the assistant's reply
into speech via ElevenLabs.
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    """Lazily build the ElevenLabs client once and reuse it -- constructing
    it fresh on every call (as before) meant a new HTTP client/session per
    TTS request for no reason."""
    global _client
    if _client is None:
        from elevenlabs.client import ElevenLabs

        _client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    return _client


class VoiceNotConfiguredError(Exception):
    """Raised when text-to-speech is called without ELEVENLABS_API_KEY set
    -- callers turn this into a clear 4xx, not a 500."""


def synthesize_speech(text: str, voice_id: Optional[str] = None) -> bytes:
    """Text-to-speech via ElevenLabs -- returns raw MP3 bytes for the route
    to stream back to the browser. This is the sync ElevenLabs SDK; routes
    call it through asyncio.to_thread so it doesn't block the event loop.

    Chosen over the browser's built-in speechSynthesis (used elsewhere in
    the app for the "Listen" button) because ElevenLabs reliably supports
    Urdu -- the browser API's Urdu support depends entirely on whether the
    visitor's OS happens to have an Urdu voice installed, which turned out
    to be inconsistent (see the chat app's own Urdu TTS limitation notes).
    """
    if not settings.ELEVENLABS_API_KEY:
        raise VoiceNotConfiguredError("Text-to-speech isn't configured (ELEVENLABS_API_KEY is unset).")

    client = _get_client()
    audio_stream = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id or settings.ELEVENLABS_VOICE_ID,
        model_id="eleven_multilingual_v2",  # multilingual model -- needed for Urdu
        output_format="mp3_44100_128",
    )
    return b"".join(audio_stream)
