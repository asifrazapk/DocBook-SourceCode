from datetime import datetime
from sqlmodel import Field, SQLModel


class Doctor(SQLModel, table=True):
    __tablename__ = "doctors"

    id: int | None = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True)
    name: str
    specialty: str
    bio: str | None = None
    is_active: bool = Field(default=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None
