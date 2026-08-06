"""Real authentication: bcrypt password hashing + JWT session tokens.

This replaces the single placeholder "System Admin" (user_id=1) that every
write used to be silently attributed to. Existing rows keep working (that
placeholder user still exists), but new logins now go through this.

Roles:
- 'admin'  -- full access to a clinic (or every clinic if user.clinic_id is null)
- 'doctor' -- scoped to their own schedule/patients/prescriptions (see
              routes/doctor_portal.py)
- 'staff'  -- same as admin for now; kept separate so permissions can be
              tightened later without a schema change
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.core.config import settings
from app.repo.user_repo import UserRepo

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "role": user["role"],
        "clinic_id": user.get("clinic_id"),
        "doctor_id": user.get("doctor_id"),
        "name": user["name"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


async def authenticate(email: str, password: str) -> Optional[dict]:
    user = await UserRepo.get_by_email(email)
    if not user or not user.get("is_active"):
        return None
    if not verify_password(password, user.get("password_hash")):
        return None
    return user


async def register_user(
    name: str, email: str, password: str, role: str = "admin", clinic_id: Optional[int] = None, doctor_id: Optional[int] = None
) -> dict:
    existing = await UserRepo.get_by_email(email)
    if existing:
        raise ValueError("A user with this email already exists.")
    return await UserRepo.create(
        {
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "role": role,
            "clinic_id": clinic_id,
            "doctor_id": doctor_id,
        }
    )
