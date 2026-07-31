from datetime import date, datetime
from sqlmodel import Field, SQLModel


class Patient(SQLModel, table=True):
    __tablename__ = "patients"

    id: int | None = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True)
    name: str
    phone: str
    email: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    notes: str | None = None
    is_active: bool = Field(default=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None
