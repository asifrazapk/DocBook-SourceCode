-- ============================================================
-- MediBot Database Schema (PostgreSQL)
-- Run this in pgAdmin's Query Tool against your target database,
-- or via: psql -U medibot -d medibot -f db/schema.sql
--
-- Note: the app talks to Postgres directly via asyncpg (app/repo/),
-- not an ORM, so this script is the source of truth for the schema.
-- Run it against your target database before starting the app.
--
-- Column order convention (kept consistent across every table):
--   1. id
--   2. foreign keys
--   3. business/data columns
--   4. is_active / is_deleted flags (where applicable)
--   5. local_created_at / local_updated_at / server_created_at / server_updated_at
--
-- Timestamp convention -- every table ends with the same four columns:
--   server_created_at / server_updated_at  -> TIMESTAMPTZ, the authoritative
--       UTC instant a row was created/updated. Defaults to NOW().
--   local_created_at  / local_updated_at   -> TIMESTAMP (naive), the same
--       instant expressed in the relevant clinic's local timezone
--       (clinics.timezone) -- the wall-clock time staff/patients should see.
-- Postgres can't resolve "the relevant clinic" through a join chain inside
-- a column DEFAULT (e.g. doctor_availability -> doctors -> clinics, or
-- messages -> conversations -> clinics), so local_created_at/local_updated_at
-- default to the same UTC instant as a safe placeholder. The application
-- layer is expected to overwrite them with the real clinic-local conversion
-- whenever it knows which clinic a row belongs to -- the same pattern
-- already used for appointments.appointment_local_time/appointment_utc_time.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- clinics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinics (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR NOT NULL,
    slug                VARCHAR NOT NULL UNIQUE,
    address             VARCHAR NOT NULL,
    phone               VARCHAR NOT NULL,
    email               VARCHAR NOT NULL,
    opening_hours       JSONB,
    timezone            VARCHAR NOT NULL DEFAULT 'Asia/Karachi',
    logo_url            VARCHAR,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_clinics_name ON clinics (name);
CREATE UNIQUE INDEX IF NOT EXISTS ix_clinics_slug ON clinics (slug);
CREATE INDEX IF NOT EXISTS ix_clinics_is_active ON clinics (is_active);

-- ------------------------------------------------------------
-- doctors
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    id                              SERIAL PRIMARY KEY,
    clinic_id                       INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    name                            VARCHAR NOT NULL,
    specialty                       VARCHAR NOT NULL,
    bio                             VARCHAR,
    email                           VARCHAR,
    phone                           VARCHAR,
    default_slot_duration_minutes   INTEGER NOT NULL DEFAULT 30,  -- used when creating weekly availability (Add Doctor step 1)
    is_active                       BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_doctors_clinic_id ON doctors (clinic_id);
CREATE INDEX IF NOT EXISTS ix_doctors_is_active ON doctors (is_active);

-- ------------------------------------------------------------
-- doctor_availability
-- Recurring weekly availability rule per doctor, structured so
-- an admin panel can render it as a simple form:
--   doctor -> day of week -> start time -> end time -> slot length
--            -> optional break (e.g. lunch)
-- One row per doctor/day range; break_start_time/break_end_time
-- carve out a gap (lunch, etc.) within that single range instead
-- of needing two separate rows.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_availability (
    id                      SERIAL PRIMARY KEY,
    doctor_id               INTEGER NOT NULL REFERENCES doctors (id) ON DELETE CASCADE,
    day_of_week             SMALLINT NOT NULL,  -- 0 = Sunday ... 6 = Saturday
    start_time              TIME NOT NULL,
    end_time                TIME NOT NULL,
    break_start_time        TIME,   -- e.g. lunch break start; NULL = no break
    break_end_time          TIME,   -- must be set together with break_start_time
    slot_duration_minutes   INTEGER NOT NULL DEFAULT 30,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    is_deleted              BOOLEAN NOT NULL DEFAULT false,
    local_created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at        TIMESTAMP,
    server_created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at       TIMESTAMPTZ,
    CONSTRAINT chk_doctor_availability_day CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT chk_doctor_availability_time_range CHECK (end_time > start_time),
    CONSTRAINT chk_doctor_availability_slot_len CHECK (slot_duration_minutes > 0),
    CONSTRAINT chk_doctor_availability_break CHECK (
        (break_start_time IS NULL AND break_end_time IS NULL)
        OR (
            break_start_time IS NOT NULL AND break_end_time IS NOT NULL
            AND break_end_time > break_start_time
            AND break_start_time >= start_time
            AND break_end_time <= end_time
        )
    )
);

CREATE INDEX IF NOT EXISTS ix_doctor_availability_doctor_id ON doctor_availability (doctor_id);
CREATE INDEX IF NOT EXISTS ix_doctor_availability_day ON doctor_availability (doctor_id, day_of_week);
CREATE INDEX IF NOT EXISTS ix_doctor_availability_is_active ON doctor_availability (is_active);

-- ------------------------------------------------------------
-- doctor_leaves
-- One-off exceptions to the recurring rule above -- a full day
-- off (start_time/end_time both NULL) or a partial absence on a
-- specific date (e.g. out 14:00-16:00 for a procedure).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id                  SERIAL PRIMARY KEY,
    doctor_id           INTEGER NOT NULL REFERENCES doctors (id) ON DELETE CASCADE,
    leave_date          DATE NOT NULL,
    start_time          TIME,   -- NULL together with end_time = full day off
    end_time            TIME,
    reason              VARCHAR,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ,
    CONSTRAINT chk_doctor_leaves_time_range CHECK (
        (start_time IS NULL AND end_time IS NULL) OR (end_time > start_time)
    ),
    UNIQUE (doctor_id, leave_date, start_time)
);

CREATE INDEX IF NOT EXISTS ix_doctor_leaves_doctor_date ON doctor_leaves (doctor_id, leave_date);

-- ------------------------------------------------------------
-- doctor_slots
-- Pre-generated, individually bookable slots produced from
-- doctor_availability (minus anything covered by doctor_leaves).
-- Booking a slot = atomically flipping is_booked, which is what
-- actually prevents two patients grabbing the same slot at once
-- (the UNIQUE constraint below is the backstop if that ever fails).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_slots (
    id                  SERIAL PRIMARY KEY,
    doctor_id           INTEGER NOT NULL REFERENCES doctors (id) ON DELETE CASCADE,
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    slot_date           DATE NOT NULL,
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    is_booked           BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,   -- admin can block a single slot without deleting it
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ,
    UNIQUE (doctor_id, slot_date, start_time)
);

CREATE INDEX IF NOT EXISTS ix_doctor_slots_doctor_date ON doctor_slots (doctor_id, slot_date);
CREATE INDEX IF NOT EXISTS ix_doctor_slots_available ON doctor_slots (doctor_id, slot_date)
    WHERE NOT is_booked AND is_active AND NOT is_deleted;

-- ------------------------------------------------------------
-- patients
-- One row per real-world patient, scoped to a clinic. Repeat
-- customers are matched on (clinic_id, phone) so the same person
-- booking again reuses this record instead of creating a duplicate.
-- Email is optional but also kept unique per clinic when present.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id                  SERIAL PRIMARY KEY,
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    name                VARCHAR NOT NULL,
    phone               VARCHAR NOT NULL,
    email               VARCHAR,
    date_of_birth       DATE,
    gender              VARCHAR,
    notes               VARCHAR,
    source              VARCHAR NOT NULL DEFAULT 'manual',  -- 'chat' (self-booked via the assistant) or 'manual' (added by an admin)
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_patients_clinic_id ON patients (clinic_id);
-- same phone number within a clinic = same patient
CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_clinic_phone ON patients (clinic_id, phone);
-- same email within a clinic = same patient (only enforced when email is provided)
CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_clinic_email ON patients (clinic_id, email) WHERE email IS NOT NULL;

-- ------------------------------------------------------------
-- faqs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
    id                  SERIAL PRIMARY KEY,
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    question_en         VARCHAR NOT NULL,
    question_ur         VARCHAR,
    answer_en           VARCHAR NOT NULL,
    answer_ur           VARCHAR,
    category            VARCHAR,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_faqs_clinic_id ON faqs (clinic_id);

-- ------------------------------------------------------------
-- appointments
-- Linked to patients (not raw name/phone/email) so repeat bookings
-- tie back to one patient record, and optionally to a pre-generated
-- doctor_slots row.
--
-- appointment_local_time  -> wall-clock time in the clinic's own
--                            timezone (clinics.timezone), what
--                            staff/patients should see displayed
-- appointment_utc_time    -> the same instant converted to UTC
--                            ("server time"), used for sorting,
--                            reminders, and cross-clinic comparisons
-- These two are the appointment's *scheduled* time, distinct from the
-- local_created_at/server_created_at audit columns below (which track
-- when the row itself was created/updated).
--
-- The UNIQUE index below is a backstop against double-booking a
-- doctor for the same date/time even if the doctor_slots claim is
-- bypassed somehow (e.g. a direct insert, or slots not in use yet).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id                      SERIAL PRIMARY KEY,
    clinic_id               INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    doctor_id               INTEGER REFERENCES doctors (id) ON DELETE SET NULL,
    patient_id              INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    slot_id                 INTEGER REFERENCES doctor_slots (id) ON DELETE SET NULL,
    appointment_date        DATE NOT NULL,
    appointment_time        VARCHAR NOT NULL,
    appointment_local_time  TIMESTAMP,      -- clinic-local wall clock of the visit
    appointment_utc_time    TIMESTAMPTZ,    -- same instant, UTC ("server time") of the visit
    reason                  VARCHAR,
    status                  VARCHAR NOT NULL DEFAULT 'pending',
    status_note              VARCHAR,        -- comment/reason captured on the most recent status change (confirm/cancel/reschedule/complete)
    language                VARCHAR NOT NULL DEFAULT 'en',
    is_active               BOOLEAN NOT NULL DEFAULT true,
    is_deleted              BOOLEAN NOT NULL DEFAULT false,
    local_created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at        TIMESTAMP,
    server_created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_appointments_clinic_id ON appointments (clinic_id);
CREATE INDEX IF NOT EXISTS ix_appointments_patient_id ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS ix_appointments_slot_id ON appointments (slot_id);
CREATE INDEX IF NOT EXISTS ix_appointments_utc_time ON appointments (appointment_utc_time);
CREATE INDEX IF NOT EXISTS ix_appointments_is_active ON appointments (is_active);
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_doctor_slot
    ON appointments (doctor_id, appointment_date, appointment_time)
    WHERE status != 'cancelled' AND NOT is_deleted;

-- ------------------------------------------------------------
-- conversations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id                  SERIAL PRIMARY KEY,
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    session_id          VARCHAR NOT NULL UNIQUE,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_conversations_clinic_id ON conversations (clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_conversations_session_id ON conversations (session_id);

-- ------------------------------------------------------------
-- messages / llm_evaluations
-- The single source of truth for turns + quality scoring.
-- Each row in messages is one full turn: the patient's
-- message_text, the bot's llm_response, and what context/traces
-- produced it. message_id is an app-generated string (e.g. UUID);
-- conversation_id is a real foreign key into conversations above,
-- so every turn is tied to the session/clinic it belongs to.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messages (
    message_id          VARCHAR(100) NOT NULL,
    conversation_id     INTEGER NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    message_text        TEXT,
    llm_response        TEXT,
    context             TEXT,
    traces              TEXT,
    feedback_type       INTEGER,
    feedback_value      VARCHAR(50),
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ,
    CONSTRAINT messages_pkey PRIMARY KEY (message_id)
);

CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS ix_messages_server_created_at ON messages (server_created_at);

CREATE TABLE IF NOT EXISTS llm_evaluations (
    message_id              VARCHAR(255) NOT NULL,
    conversation_id         INTEGER NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    relevance               DOUBLE PRECISION,
    correctness             DOUBLE PRECISION,
    faithfulness            DOUBLE PRECISION,
    completeness            DOUBLE PRECISION,
    overall_score           DOUBLE PRECISION,
    is_hallucination        BOOLEAN,
    reasoning               JSONB,
    improvement_suggestion  JSONB,
    local_created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at        TIMESTAMP,
    server_created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at       TIMESTAMPTZ,
    CONSTRAINT llm_evaluations_pkey PRIMARY KEY (message_id),
    CONSTRAINT fk_llm_evaluations_message FOREIGN KEY (message_id)
        REFERENCES messages (message_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_llm_evaluations_conversation_id ON llm_evaluations (conversation_id);

-- ------------------------------------------------------------
-- app_settings
-- Generic key/value store for admin-configurable settings (email/SMTP,
-- and any future settings) scoped per clinic. `value` is JSONB so a
-- single row can hold a structured settings object (e.g. the whole SMTP
-- config), not just one field.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    id                  SERIAL PRIMARY KEY,
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    key                 VARCHAR NOT NULL,
    value               JSONB NOT NULL,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_app_settings_clinic_key ON app_settings (clinic_id, key);

COMMIT;
