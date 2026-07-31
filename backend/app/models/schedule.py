from datetime import date, datetime, time
from sqlmodel import Field, SQLModel


class DoctorAvailability(SQLModel, table=True):
    """Recurring weekly rule, e.g. 'Mon/Wed/Fri 9-6, lunch 1-2, 30 min slots'."""

    __tablename__ = "doctor_availability"

    id: int | None = Field(default=None, primary_key=True)
    doctor_id: int = Field(foreign_key="doctors.id", index=True)
    day_of_week: int  # 0=Sunday ... 6=Saturday
    start_time: time
    end_time: time
    break_start_time: time | None = None
    break_end_time: time | None = None
    slot_duration_minutes: int = Field(default=30)
    is_active: bool = Field(default=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None


class DoctorLeave(SQLModel, table=True):
    """One-off exception to the recurring rule -- a full day off (start_time
    and end_time both None) or a partial absence on a specific date."""

    __tablename__ = "doctor_leaves"

    id: int | None = Field(default=None, primary_key=True)
    doctor_id: int = Field(foreign_key="doctors.id", index=True)
    leave_date: date
    start_time: time | None = None
    end_time: time | None = None
    reason: str | None = None
    is_active: bool = Field(default=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None


class DoctorSlot(SQLModel, table=True):
    """Pre-generated, individually bookable slot produced from
    DoctorAvailability (minus anything covered by DoctorLeave)."""

    __tablename__ = "doctor_slots"

    id: int | None = Field(default=None, primary_key=True)
    doctor_id: int = Field(foreign_key="doctors.id", index=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True)
    slot_date: date
    start_time: time
    end_time: time
    is_booked: bool = Field(default=False)
    is_active: bool = Field(default=True)
    local_created_at: datetime = Field(default_factory=datetime.utcnow)
    local_updated_at: datetime | None = None
    server_created_at: datetime = Field(default_factory=datetime.utcnow)
    server_updated_at: datetime | None = None
