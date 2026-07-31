from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(clinic_id: int, start_date: date | None = None, end_date: date | None = None):
    end = end_date or date.today()
    start = start_date or (end - timedelta(days=29))
    if start > end:
        raise HTTPException(status_code=422, detail="start_date must be before end_date")
    return await analytics_service.get_overview(clinic_id, start, end)
