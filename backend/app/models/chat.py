from datetime import datetime
from sqlmodel import Field, SQLModel


class ChatMessage(SQLModel, table=True):
    """One row per full chat turn: the patient's message_text plus the bot's
    llm_response together, with optional context/traces and patient feedback."""

    __tablename__ = "messages"

    message_id: str = Field(primary_key=True)  # app-generated (e.g. UUID)
    conversation_id: int = Field(foreign_key="conversations.id", index=True)
    message_text: str | None = None
    llm_response: str | None = None
    context: str | None = None
    traces: str | None = None
    feedback_type: int | None = None
    feedback_value: str | None = None
    local_created_at: datetime | None = None
    local_updated_at: datetime | None = None
    server_created_at: datetime | None = None
    server_updated_at: datetime | None = None


class LLMEvaluation(SQLModel, table=True):
    """Quality scores for a subset of messages turns."""

    __tablename__ = "llm_evaluations"

    message_id: str = Field(primary_key=True, foreign_key="messages.message_id")
    conversation_id: int = Field(foreign_key="conversations.id", index=True)
    relevance: float | None = None
    correctness: float | None = None
    faithfulness: float | None = None
    completeness: float | None = None
    overall_score: float | None = None
    is_hallucination: bool | None = None
    reasoning: dict | None = None
    improvement_suggestion: dict | None = None
    local_created_at: datetime | None = None
    local_updated_at: datetime | None = None
    server_created_at: datetime | None = None
    server_updated_at: datetime | None = None
