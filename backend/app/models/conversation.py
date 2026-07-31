from datetime import datetime
from sqlmodel import Field, SQLModel


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: int | None = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True)
    session_id: str = Field(unique=True, index=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None


# NOTE: the old public.messages table (one row per role/content message) has
# been replaced by messages -- one row per full turn (patient message +
# bot response together), plus context/traces/feedback. See models/chat.py.
