from datetime import datetime, date
from sqlmodel import Field, SQLModel


class Appointment(SQLModel, table=True):
    __tablename__ = "appointments"

    id: int | None = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True)
    doctor_id: int | None = Field(default=None, foreign_key="doctors.id")
    patient_id: int = Field(foreign_key="patients.id", index=True)
    slot_id: int | None = Field(default=None, foreign_key="doctor_slots.id")
    appointment_date: date
    appointment_time: str
    appointment_local_time: datetime | None = None  # clinic-local wall clock
    appointment_utc_time: datetime | None = None     # same instant, UTC ("server time")
    reason: str | None = None
    status: str = Field(default="pending")
    language: str = Field(default="en")
    is_active: bool = Field(default=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None
