"""Azure OpenAI client and thin async completion helpers for graph nodes.

Nodes never talk to the SDK directly; they call ``complete`` (free text) or
``complete_json`` (structured output) so retry / parsing behaviour lives in one
place. On Azure OpenAI the ``model`` argument must be the *deployment* name.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

from openai import AsyncAzureOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# Explicit timeout + retry budget -- without these the SDK's defaults
# (max_retries=2, each retry sleeping for the server's Retry-After on a 429)
# can silently turn one call into 10-20+ seconds of retrying. A chat turn
# needs to fail fast, not sit in a backoff loop the caller can't see.
client = AsyncAzureOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT_SM,
    api_key=settings.AZURE_OPENAI_KEY_SM,
    api_version=settings.AZURE_OPENAI_PREVIEW_API_VERSION_SM,
    timeout=15.0,
    max_retries=1,
)

AZURE_DEPLOYMENT_SM = settings.AZURE_OPENAI_MODEL_SM
DEFAULT_MAX_TOKENS = 500


async def complete(
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: Optional[int] = None,
) -> str:
    """Return the assistant's plain-text reply for a message list."""
    kwargs: Dict[str, Any] = {
        "model": AZURE_DEPLOYMENT_SM,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens or DEFAULT_MAX_TOKENS,
    }
    started = time.monotonic()
    response = await client.chat.completions.create(**kwargs)
    _log_call_duration("complete", started)
    return (response.choices[0].message.content or "").strip()


async def complete_json(
    messages: List[Dict[str, str]],
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    """Return a parsed JSON object from a JSON-mode completion.

    The caller's system prompt must instruct the model to reply with a single
    JSON object. We request ``response_format=json_object`` and defensively
    strip markdown fences before parsing so a stray ```json block can't break
    the pipeline.
    """
    tokens = max_tokens or DEFAULT_MAX_TOKENS
    started = time.monotonic()
    try:
        response = await client.chat.completions.create(
            model=AZURE_DEPLOYMENT_SM,
            messages=messages,
            temperature=temperature,
            max_tokens=tokens,
            response_format={"type": "json_object"},
        )
    except Exception:
        # Some deployments reject response_format; retry without it. Logged
        # because this doubles the call's latency -- if it's firing on every
        # request, that's the real fix, not something to keep swallowing.
        logger.warning("complete_json: response_format=json_object rejected, retrying without it", exc_info=True)
        response = await client.chat.completions.create(
            model=AZURE_DEPLOYMENT_SM,
            messages=messages,
            temperature=temperature,
            max_tokens=tokens,
        )

    _log_call_duration("complete_json", started)
    raw = (response.choices[0].message.content or "").strip()
    return _safe_json(raw)


def _log_call_duration(label: str, started: float) -> None:
    elapsed = time.monotonic() - started
    log_fn = logger.warning if elapsed > 3.0 else logger.debug
    log_fn(f"{label} took {elapsed:.2f}s")


def _safe_json(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        # Last resort: pull the outermost {...} block.
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(cleaned[start : end + 1])
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}
