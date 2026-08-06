from typing import Optional

from app.repo.base_model_sql import BasePostgresModel


class UserRepo(BasePostgresModel):
    TABLE = "users"

    @classmethod
    async def get_by_email(cls, email: str) -> Optional[dict]:
        try:
            return await cls.get_by_field("email", email)
        except ValueError:
            return None
