-- ============================================================
-- DocBook app_settings Seed Data
-- Run AFTER db/schema.sql and db/seed_data.sql have been applied
-- (this depends on the clinics seeded there).
--
--   psql -U DocBook -d DocBook -f db/seed_app_settings.sql
--
-- Seeds one 'email' settings row per clinic (SMTP config used when
-- sending appointment confirmation emails). Only 8 of the 12 clinics
-- get a row here on purpose -- the other 4 are left unconfigured to
-- demonstrate that settings_service falls back to the env-based
-- defaults (app/core/config.py) when nothing's been set yet.
--
-- Uses ON CONFLICT (clinic_id, key) so it's safe to re-run.
-- ============================================================

BEGIN;

INSERT INTO app_settings (clinic_id, key, value)
SELECT c.id, 'email', v.value::jsonb
FROM (VALUES
    ('al-shifa-general',     '{"mail_username": "notifications@alshifa.pk",   "mail_password": "alshifa-app-pw-01",   "mail_from": "Al-Shifa General Clinic <notifications@alshifa.pk>",   "mail_port": 587, "mail_server": "smtp.gmail.com"}'),
    ('city-care-hospital',   '{"mail_username": "appointments@citycare.pk",    "mail_password": "citycare-app-pw-02",  "mail_from": "City Care Hospital <appointments@citycare.pk>",        "mail_port": 587, "mail_server": "smtp.office365.com"}'),
    ('blue-cross-clinic',    '{"mail_username": "noreply@bluecross.pk",        "mail_password": "bluecross-app-pw-03", "mail_from": "Blue Cross Clinic <noreply@bluecross.pk>",             "mail_port": 465, "mail_server": "smtp.zoho.com"}'),
    ('family-health-center', '{"mail_username": "care@familyhealth.pk",        "mail_password": "familyhealth-pw-04",  "mail_from": "Family Health Center <care@familyhealth.pk>",          "mail_port": 587, "mail_server": "smtp.gmail.com"}'),
    ('marina-medical',       '{"mail_username": "info@marinamed.pk",           "mail_password": "marinamed-app-pw-05", "mail_from": "Marina Medical Complex <info@marinamed.pk>",           "mail_port": 587, "mail_server": "smtp.gmail.com"}'),
    ('al-noor-diagnostic',   '{"mail_username": "reports@alnoor.pk",           "mail_password": "alnoor-app-pw-06",    "mail_from": "Al-Noor Diagnostic & Clinic <reports@alnoor.pk>",      "mail_port": 587, "mail_server": "smtp.office365.com"}'),
    ('sunrise-family',       '{"mail_username": "hello@sunrisefc.pk",          "mail_password": "sunrise-app-pw-07",   "mail_from": "Sunrise Family Clinic <hello@sunrisefc.pk>",           "mail_port": 465, "mail_server": "smtp.zoho.com"}'),
    ('crescent-clinic',      '{"mail_username": "maternity@crescentclinic.pk", "mail_password": "crescent-app-pw-08",  "mail_from": "Crescent Clinic & Maternity <maternity@crescentclinic.pk>", "mail_port": 587, "mail_server": "smtp.gmail.com"}')
) AS v(clinic_slug, value)
JOIN clinics c ON c.slug = v.clinic_slug
ON CONFLICT (clinic_id, key) DO NOTHING;

COMMIT;
