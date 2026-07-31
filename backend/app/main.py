from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
from app.repo.sql_connector import init_db_pools, close_db_pools
from app.routes import chat, clinics, doctors, faqs, appointments, patients, schedule, analytics, settings, conversations


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pools()
    yield
    await close_db_pools()


app = FastAPI(title="MediBot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": traceback.format_exc()})

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


@app.get("/health")
async def health():
    return {"status": "ok"}
