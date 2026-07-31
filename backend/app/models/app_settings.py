from datetime import datetime
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON


class AppSetting(SQLModel, table=True):
    """Generic key/value settings store, scoped per clinic (e.g. a single
    'email' row holding the whole SMTP config as JSON)."""

    __tablename__ = "app_settings"

    id: int | None = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True)
    key: str
    value: dict = Field(sa_column=Column(JSON))
    is_deleted: bool = Field(default=False)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None
