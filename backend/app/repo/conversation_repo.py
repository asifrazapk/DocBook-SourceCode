from typing import Optional

from app.repo.base_model_sql import BasePostgresModel


class ConversationRepo(BasePostgresModel):
    TABLE = "conversations"

    @classmethod
    async def get_by_session_id(cls, session_id: str) -> Optional[dict]:
        try:
            return await cls.get_by_field("session_id", session_id)
        except ValueError:
            return None


# NOTE: the old public.messages table (one row per role/content message) has
# been replaced by messages (one row per full turn: patient message +
# bot response together, plus context/traces/feedback). See app/repo/chat_repo.py.
