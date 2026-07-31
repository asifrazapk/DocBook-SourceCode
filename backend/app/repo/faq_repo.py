from app.repo.base_model_sql import BasePostgresModel


class FAQRepo(BasePostgresModel):
    TABLE = "faqs"

    @classmethod
    async def list_by_clinic(cls, clinic_id: int):
        return await cls.list(filter_dict={"clinic_id": clinic_id})
