-- ============================================================
-- I-DocAssistance Database Schema (PostgreSQL)
-- Run this in pgAdmin's Query Tool against your target database,
-- or via: psql -U I-DocAssistance -d I-DocAssistance -f db/schema.sql
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
-- whenever it knows which clinic a row belongs to.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
-- Minimal placeholder for admin/staff accounts. There is no real admin
-- login/auth system yet (the admin panel is currently a single shared
-- experience) -- this table + the DEFAULT_USER_ID seed row exist so every
-- other table can carry a user_id column now, ready to be populated
-- properly once real admin authentication is built. Until then, every
-- write defaults to this one seeded user (see app/repo/base_model_sql.py).
CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR NOT NULL,
    email               VARCHAR UNIQUE,
    password_hash       VARCHAR,             -- bcrypt hash; null for the legacy placeholder row
    role                VARCHAR NOT NULL DEFAULT 'admin',  -- 'admin' | 'doctor' | 'staff'
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

INSERT INTO users (id, name, email) VALUES (1, 'System Admin', 'admin@i-docassistance.local')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1));

-- ------------------------------------------------------------
-- clinics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinics (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users (id),
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
    user_id                         INTEGER REFERENCES users (id),
    clinic_id                       INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    name                            VARCHAR NOT NULL,
    specialty                       VARCHAR NOT NULL,
    bio                             VARCHAR,
    email                           VARCHAR,
    phone                           VARCHAR,
    years_of_experience             INTEGER,
    graduation_year                 INTEGER,
    education                       VARCHAR,  -- e.g. "MBBS, FCPS (Cardiology)"
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_doctors_clinic_name ON doctors (clinic_id, name) WHERE NOT is_deleted;

-- Added here (not in the original users CREATE TABLE above) because both
-- referenced tables need to exist first -- clinics and users otherwise
-- reference each other in a circular way at creation time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics (id) ON DELETE CASCADE;  -- null = access to every clinic (super-admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES doctors (id) ON DELETE SET NULL;  -- set when role='doctor' -- which doctor record this login is for
CREATE INDEX IF NOT EXISTS ix_users_clinic_id ON users (clinic_id);
CREATE INDEX IF NOT EXISTS ix_users_doctor_id ON users (doctor_id);

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
    user_id                         INTEGER REFERENCES users (id),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_doctor_availability_no_dupe
    ON doctor_availability (doctor_id, day_of_week, start_time, end_time)
    WHERE NOT is_deleted;
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
    user_id                         INTEGER REFERENCES users (id),
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
    )
);

CREATE INDEX IF NOT EXISTS ix_doctor_leaves_doctor_date ON doctor_leaves (doctor_id, leave_date);
-- Plain UNIQUE(doctor_id, leave_date, start_time) doesn't actually dedupe
-- full-day leaves: start_time is NULL for those, and SQL never considers
-- NULL equal to NULL, so two identical full-day-off rows wouldn't conflict.
-- Coalescing to a sentinel time makes NULL comparable to itself.
CREATE UNIQUE INDEX IF NOT EXISTS ux_doctor_leaves_no_dupe
    ON doctor_leaves (doctor_id, leave_date, (COALESCE(start_time, '00:00:00'::time)));

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
    user_id                         INTEGER REFERENCES users (id),
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
    user_id                         INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    name                VARCHAR NOT NULL,
    phone               VARCHAR NOT NULL,
    email               VARCHAR,
    date_of_birth       DATE,
    age                 INTEGER,  -- approximate age when exact date_of_birth isn't known
    gender              VARCHAR,
    city                VARCHAR,  -- living area / city
    address             VARCHAR,  -- fuller address, optional
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
    user_id                         INTEGER REFERENCES users (id),
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_faqs_clinic_question ON faqs (clinic_id, question_en) WHERE NOT is_deleted;

-- ------------------------------------------------------------
-- appointments
-- Linked to patients (not raw name/phone/email) so repeat bookings
-- tie back to one patient record, and optionally to a pre-generated
-- doctor_slots row.
--
-- The UNIQUE index below is a backstop against double-booking a
-- doctor for the same date/time even if the doctor_slots claim is
-- bypassed somehow (e.g. a direct insert, or slots not in use yet).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id                      SERIAL PRIMARY KEY,
    user_id                         INTEGER REFERENCES users (id),
    clinic_id               INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    doctor_id               INTEGER REFERENCES doctors (id) ON DELETE SET NULL,
    patient_id              INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    slot_id                 INTEGER REFERENCES doctor_slots (id) ON DELETE SET NULL,
    appointment_date        DATE NOT NULL,
    appointment_time        VARCHAR NOT NULL,
    reason                  VARCHAR,
    status                  VARCHAR NOT NULL DEFAULT 'pending',
    status_note              VARCHAR,        -- comment/reason captured on the most recent status change (confirm/cancel/reschedule/complete)
    language                VARCHAR NOT NULL DEFAULT 'en',
    is_telemedicine         BOOLEAN NOT NULL DEFAULT false,
    video_room_key          VARCHAR,        -- Jitsi Meet room slug for this visit, set when is_telemedicine
    reminder_sent_at        TIMESTAMPTZ,    -- when the 24h-ahead reminder was sent (null = not sent yet)
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
CREATE INDEX IF NOT EXISTS ix_appointments_is_active ON appointments (is_active);
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_doctor_slot
    ON appointments (doctor_id, appointment_date, appointment_time)
    WHERE status != 'cancelled' AND NOT is_deleted;

-- ------------------------------------------------------------
-- waitlist -- patient wants a specific doctor/date that's fully booked;
-- notified automatically if a slot on that date opens up (a cancellation).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waitlist (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    doctor_id           INTEGER NOT NULL REFERENCES doctors (id) ON DELETE CASCADE,
    patient_id          INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    desired_date        DATE NOT NULL,
    status              VARCHAR NOT NULL DEFAULT 'waiting',  -- 'waiting' | 'notified' | 'booked' | 'expired'
    notified_at         TIMESTAMPTZ,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_waitlist_clinic_doctor_date ON waitlist (clinic_id, doctor_id, desired_date);

-- ------------------------------------------------------------
-- reviews -- patient feedback after a completed visit; is_public controls
-- whether it shows on the clinic's public review page.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    appointment_id      INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
    patient_id          INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    doctor_id           INTEGER REFERENCES doctors (id) ON DELETE SET NULL,
    rating              INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment             VARCHAR,
    is_public           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_reviews_clinic_id ON reviews (clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_reviews_appointment ON reviews (appointment_id);

-- ------------------------------------------------------------
-- medical_records (prescription + report per appointment)
-- ------------------------------------------------------------
-- One record per appointment, added by the admin/doctor after the visit.
-- Patients retrieve their own record later via appointment number or
-- patient number (phone-verified -- see app/services/medical_record_service.py).
CREATE TABLE IF NOT EXISTS medical_records (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    appointment_id      INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
    patient_id          INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    doctor_id           INTEGER REFERENCES doctors (id) ON DELETE SET NULL,
    diagnosis           VARCHAR,        -- report / findings
    prescription        VARCHAR,        -- medications, dosage, instructions
    notes               VARCHAR,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_medical_records_clinic_id ON medical_records (clinic_id);
CREATE INDEX IF NOT EXISTS ix_medical_records_appointment_id ON medical_records (appointment_id);
CREATE INDEX IF NOT EXISTS ix_medical_records_patient_id ON medical_records (patient_id);

-- ------------------------------------------------------------
-- bills (manually recorded payment against a confirmed appointment)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    appointment_id      INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
    patient_id          INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    amount              NUMERIC(10, 2) NOT NULL,
    collected_by        VARCHAR NOT NULL,   -- staff member's name who took the payment
    collected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes               VARCHAR,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_bills_clinic_id ON bills (clinic_id);
CREATE INDEX IF NOT EXISTS ix_bills_appointment_id ON bills (appointment_id);
CREATE INDEX IF NOT EXISTS ix_bills_collected_at ON bills (collected_at);

-- ------------------------------------------------------------
-- conversations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id                  SERIAL PRIMARY KEY,
    user_id                         INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    session_id          VARCHAR NOT NULL UNIQUE,
    patient_phone       VARCHAR,  -- set once the patient "logs in" (basic phone-based identity, no password)
    patient_name        VARCHAR,  -- denormalized for the history sidebar list, avoids a join
    language            VARCHAR,  -- 'en' or 'ur' -- the language this conversation is being conducted in, kept in sync each turn
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_conversations_clinic_id ON conversations (clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_conversations_session_id ON conversations (session_id);
CREATE INDEX IF NOT EXISTS ix_conversations_patient_phone ON conversations (clinic_id, patient_phone);

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
    user_id             INTEGER REFERENCES users (id),
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
    user_id                 INTEGER REFERENCES users (id),
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
    user_id                         INTEGER REFERENCES users (id),
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

-- ------------------------------------------------------------
-- notifications
-- Server-side, persisted admin notifications (e.g. "new appointment
-- booked"), scoped per clinic. Replaces the earlier browser-localStorage-only
-- approach so notifications survive a page reload, are visible from any
-- device/session watching that clinic, and can be paginated (most recent 10
-- first, "load more" fetching 10 further back at a time).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users (id),
    clinic_id           INTEGER NOT NULL REFERENCES clinics (id) ON DELETE CASCADE,
    message             VARCHAR NOT NULL,
    notification_type   VARCHAR NOT NULL DEFAULT 'general',  -- e.g. 'appointment_created', 'appointment_cancelled'
    reference_id        INTEGER,  -- optional: id of the related appointment/entity, for future deep-linking
    is_read             BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    local_created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    local_updated_at    TIMESTAMP,
    server_created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_notifications_clinic_created ON notifications (clinic_id, server_created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notifications_clinic_unread ON notifications (clinic_id, is_read) WHERE NOT is_read;

COMMIT;
