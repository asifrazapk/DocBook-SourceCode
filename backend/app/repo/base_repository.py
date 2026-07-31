from typing import Any, Dict, Generic, List, Optional, Type, TypeVar

from sqlmodel import Session, SQLModel, select

ModelType = TypeVar("ModelType", bound=SQLModel)


class BaseRepository(Generic[ModelType]):
    """Base class for all repositories.

    This is the ONLY layer that is allowed to touch the SQLModel `Session`
    directly (i.e. call the SQL database). Services should call into a
    repository instead of importing `sqlmodel.select`/`Session` themselves,
    and routes should never touch the session at all.
    """

    model: Type[ModelType]

    def __init__(self, session: Session):
        self.session = session

    def get(self, id: Any) -> Optional[ModelType]:
        return self.session.get(self.model, id)

    def get_by(self, **filters: Any) -> Optional[ModelType]:
        query = select(self.model)
        for field, value in filters.items():
            query = query.where(getattr(self.model, field) == value)
        return self.session.exec(query).first()

    def list(self, order_by: Optional[str] = None, **filters: Any) -> List[ModelType]:
        query = select(self.model)
        for field, value in filters.items():
            if value is not None:
                query = query.where(getattr(self.model, field) == value)
        if order_by:
            query = query.order_by(getattr(self.model, order_by))
        return self.session.exec(query).all()

    def create(self, data: Dict[str, Any]) -> ModelType:
        obj = self.model(**data)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def update(self, obj: ModelType, data: Dict[str, Any]) -> ModelType:
        for field, value in data.items():
            setattr(obj, field, value)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete(self, obj: ModelType) -> None:
        self.session.delete(obj)
        self.session.commit()
