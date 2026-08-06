"""FastAPI dependency for authenticated routes (currently used by the
doctor portal -- see routes/doctor_portal.py). The rest of the existing
admin API is left as-is for backward compatibility; retrofitting auth
checks onto every existing endpoint is a larger follow-up."""

from fastapi import Header, HTTPException

from app.services.auth_service import decode_token


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload
