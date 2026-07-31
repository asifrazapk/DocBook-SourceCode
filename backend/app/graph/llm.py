"""Azure OpenAI client and thin async completion helpers for graph nodes.

Nodes never talk to the SDK directly; they call ``complete`` (free text) or
``complete_json`` (structured output) so retry / parsing behaviour lives in one
place. On Azure OpenAI the ``model`` argument must be the *deployment* name.
"""

import json
from typing import Any, Dict, List, Optional

from openai import AsyncAzureOpenAI

from app.core.config import settings

client = AsyncAzureOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT_SM,
    api_key=settings.AZURE_OPENAI_KEY_SM,
    api_version=settings.AZURE_OPENAI_PREVIEW_API_VERSION_SM,
)

AZURE_DEPLOYMENT_SM = settings.AZURE_OPENAI_MODEL_SM


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
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    response = await client.chat.completions.create(**kwargs)
    return (response.choices[0].message.content or "").strip()


async def complete_json(
    messages: List[Dict[str, str]],
    temperature: float = 0.0,
) -> Dict[str, Any]:
    """Return a parsed JSON object from a JSON-mode completion.

    The caller's system prompt must instruct the model to reply with a single
    JSON object. We request ``response_format=json_object`` and defensively
    strip markdown fences before parsing so a stray ```json block can't break
    the pipeline.
    """
    try:
        response = await client.chat.completions.create(
            model=AZURE_DEPLOYMENT_SM,
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"},
        )
    except Exception:
        # Some deployments reject response_format; retry without it.
        response = await client.chat.completions.create(
            model=AZURE_DEPLOYMENT_SM,
            messages=messages,
            temperature=temperature,
        )

    raw = (response.choices[0].message.content or "").strip()
    return _safe_json(raw)


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
