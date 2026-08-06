from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: dict


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "admin"  # 'admin' | 'doctor' | 'staff'
    clinic_id: int | None = None
    doctor_id: int | None = None  # required when role='doctor'


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user = await auth_service.authenticate(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = auth_service.create_token(user)
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return LoginResponse(token=token, user=safe_user)


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    """Creates a login for a clinic's staff or a specific doctor. In a real
    multi-tenant deployment this would itself require an admin token; kept
    open here since there's no existing admin session to gate it with yet
    (see the onboarding wizard, which calls this for a brand-new clinic)."""
    if body.role == "doctor" and not body.doctor_id:
        raise HTTPException(status_code=422, detail="doctor_id is required when role='doctor'")
    try:
        user = await auth_service.register_user(
            name=body.name, email=body.email, password=body.password, role=body.role, clinic_id=body.clinic_id, doctor_id=body.doctor_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
