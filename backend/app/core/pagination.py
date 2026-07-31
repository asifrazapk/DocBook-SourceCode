"""Shared pagination query params + response shape for admin list endpoints
(appointments, patients, clinics, doctors, conversations/messages).

Usage in a route:
    @router.get("")
    async def list_x(clinic_id: int, page: int = 1, page_size: int = 10):
        return await x_service.list_paginated(clinic_id, page, page_size)

page_size is restricted to the four values the admin UI actually offers
(10/20/50/100) -- anything else is rejected with a clear 422 rather than
silently clamped, so a typo in a client doesn't quietly return the wrong
page size.
"""

from typing import Generic, List, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel

ALLOWED_PAGE_SIZES = (10, 20, 50, 100)

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


def validate_page_size(page_size: int) -> int:
    if page_size not in ALLOWED_PAGE_SIZES:
        raise HTTPException(
            status_code=422,
            detail=f"page_size must be one of {ALLOWED_PAGE_SIZES}",
        )
    return page_size
