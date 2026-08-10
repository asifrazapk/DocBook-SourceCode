import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings as app_settings
from app.core.logging import configure_logging
from app.repo.sql_connector import init_db_pools, close_db_pools
from app.routes import (
    chat,
    clinics,
    doctors,
    faqs,
    appointments,
    patients,
    schedule,
    analytics,
    settings,
    conversations,
    medical_records,
    bills,
    auth,
    doctor_portal,
    waitlist,
    reviews,
    voice,
    notifications,
)

configure_logging()
logger = logging.getLogger("I-DocAssistance")
DEBUG = app_settings.DEBUG


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up: initializing DB pools")
    await init_db_pools()
    yield
    logger.info("Shutting down: closing DB pools")
    await close_db_pools()


app = FastAPI(title="I-DocAssistance API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if app_settings.CORS_ALLOWED_ORIGINS.strip() == "*" else [o.strip() for o in app_settings.CORS_ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = (time.monotonic() - start) * 1000
        status = response.status_code if response else 500
        log_fn = logger.warning if status >= 400 else logger.info
        log_fn(f"{request.method} {request.url.path} -> {status} ({duration_ms:.1f}ms)")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Full traceback goes to the server logs (that's what "proper logging"
    # means here) -- it must never be echoed back to the client, since a
    # raw stack trace can leak internals (file paths, query structure,
    # config) to whoever's calling the API.
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    if DEBUG:
        import traceback

        return JSONResponse(status_code=500, content={"detail": traceback.format_exc()})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(chat.router)
app.include_router(clinics.router)
app.include_router(doctors.router)
app.include_router(faqs.router)
app.include_router(appointments.router)
app.include_router(patients.router)
app.include_router(schedule.router)
app.include_router(analytics.router)
app.include_router(settings.router)
app.include_router(conversations.router)
app.include_router(medical_records.router)
app.include_router(bills.router)
app.include_router(auth.router)
app.include_router(doctor_portal.router)
app.include_router(waitlist.router)
app.include_router(reviews.router)
app.include_router(voice.router)
app.include_router(notifications.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
