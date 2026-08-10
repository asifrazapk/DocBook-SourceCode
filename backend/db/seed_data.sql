-- ============================================================
-- I-DocAssistance Dummy/Seed Data
-- Run AFTER db/schema.sql has been applied.
--
--   psql -U I-DocAssistance -d I-DocAssistance -f db/seed_data.sql
--
-- FK / insert order:
-- clinics -> doctors -> doctor_availability -> doctor_leaves
--   -> patients -> faqs -> doctor_slots -> appointments
--   -> conversations -> messages -> llm_evaluations
--
-- Uses ON CONFLICT where a real unique constraint exists, so it's
-- safe to re-run. doctors/doctor_availability/faqs/appointments have
-- no natural unique key to conflict on (matching the schema), so
-- re-running will add duplicates for those tables -- truncate first
-- if you need a clean reload.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- clinics (12)
-- ------------------------------------------------------------
INSERT INTO clinics (name, slug, address, phone, email, opening_hours, timezone, logo_url) VALUES
('Al-Shifa General Clinic',     'al-shifa-general',     '12-B Gulberg III, Lahore',            '+92-42-35761234', 'info@alshifa.pk',      '{"mon_fri": "9:00-21:00", "sat": "10:00-18:00", "sun": "closed"}', 'Asia/Karachi', 'https://cdn.I-DocAssistance.pk/logos/al-shifa.png'),
('City Care Hospital',          'city-care-hospital',   '45 Shahrah-e-Faisal, Karachi',        '+92-21-34567890', 'contact@citycare.pk',  '{"mon_fri": "8:00-22:00", "sat": "9:00-20:00", "sun": "10:00-14:00"}', 'Asia/Karachi', 'https://cdn.I-DocAssistance.pk/logos/citycare.png'),
('Blue Cross Clinic',           'blue-cross-clinic',    '78 F-10 Markaz, Islamabad',           '+92-51-2345678',  'hello@bluecross.pk',   '{"mon_fri": "9:00-20:00", "sat": "9:00-17:00", "sun": "closed"}', 'Asia/Karachi', NULL),
('Family Health Center',        'family-health-center', '23 Model Town, Lahore',               '+92-42-35123456', 'care@familyhealth.pk', '{"mon_sat": "8:30-21:30", "sun": "closed"}', 'Asia/Karachi', 'https://cdn.I-DocAssistance.pk/logos/fhc.png'),
('Marina Medical Complex',      'marina-medical',       '5 Clifton Block 4, Karachi',          '+92-21-35897456', 'info@marinamed.pk',    '{"mon_fri": "9:00-22:00", "sat": "9:00-18:00", "sun": "closed"}', 'Asia/Karachi', NULL),
('Green Valley Clinic',         'green-valley-clinic',  '9 Bahria Town Phase 4, Rawalpindi',   '+92-51-5123456',  'support@greenvalley.pk','{"mon_fri": "10:00-20:00", "sat": "10:00-16:00", "sun": "closed"}', 'Asia/Karachi', NULL),
('Al-Noor Diagnostic & Clinic', 'al-noor-diagnostic',   '34 Satellite Town, Rawalpindi',       '+92-51-4567890',  'info@alnoor.pk',       '{"mon_sat": "8:00-20:00", "sun": "9:00-13:00"}', 'Asia/Karachi', 'https://cdn.I-DocAssistance.pk/logos/alnoor.png'),
('Riverside Medical Center',    'riverside-medical',    '61 DHA Phase 6, Lahore',              '+92-42-37123456', 'contact@riverside.pk', '{"mon_fri": "9:00-21:00", "sat": "9:00-15:00", "sun": "closed"}', 'Asia/Karachi', NULL),
('Sunrise Family Clinic',       'sunrise-family',       '17 North Nazimabad, Karachi',         '+92-21-36123456', 'hello@sunrisefc.pk',   '{"mon_sat": "9:00-21:00", "sun": "closed"}', 'Asia/Karachi', NULL),
('Horizon Health Clinic',       'horizon-health',       '88 G-9 Markaz, Islamabad',            '+92-51-2876543',  'care@horizonhealth.pk','{"mon_fri": "8:00-20:00", "sat": "10:00-16:00", "sun": "closed"}', 'Asia/Karachi', 'https://cdn.I-DocAssistance.pk/logos/horizon.png'),
('Crescent Clinic & Maternity', 'crescent-clinic',      '3 Johar Town, Lahore',                '+92-42-35991234', 'info@crescentclinic.pk','{"mon_sun": "24/7"}', 'Asia/Karachi', NULL),
('Al-Falah Multan Clinic',      'al-falah-multan',      '22 Cantt Bazaar, Multan',             '+92-61-4567321',  'support@alfalah.pk',   '{"mon_fri": "9:00-21:00", "sat": "9:00-17:00", "sun": "closed"}', 'Asia/Karachi', NULL)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- doctors (20) — available_days is gone; schedules now live in
-- doctor_availability below.
-- ------------------------------------------------------------
INSERT INTO doctors (clinic_id, name, specialty, bio, email, phone, years_of_experience, graduation_year, education, default_slot_duration_minutes) VALUES
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'Dr. Ayesha Khan',      'General Physician',   'Over 12 years of experience in family medicine and preventive care.', 'ayesha.khan@alshifa.pk',      '+92-300-1000001', 12, 2012, 'MBBS, FCPS (Family Medicine)', 30),
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'Dr. Bilal Ahmed',      'Cardiologist',        'Specialist in interventional cardiology and heart health screening.', 'bilal.ahmed@alshifa.pk',      '+92-300-1000002', 15, 2009, 'MBBS, FCPS (Cardiology)', 30),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Dr. Sana Malik',       'Pediatrician',        'Dedicated to child healthcare from infancy through adolescence.', 'sana.malik@citycare.pk',      '+92-300-1000003', 9,  2015, 'MBBS, FCPS (Pediatrics)', 20),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Dr. Usman Tariq',      'Orthopedic Surgeon',  'Focused on sports injuries and joint replacement surgery.', 'usman.tariq@citycare.pk',     '+92-300-1000004', 11, 2013, 'MBBS, FCPS (Orthopedic Surgery)', 45),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Dr. Hina Farooq',      'Dermatologist',       'Expert in skin conditions, acne treatment, and cosmetic dermatology.', 'hina.farooq@citycare.pk',     '+92-300-1000005', 7,  2017, 'MBBS, FCPS (Dermatology)', 30),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'Dr. Kamran Sheikh',    'ENT Specialist',      'Treats ear, nose, and throat conditions for all age groups.', 'kamran.sheikh@bluecross.pk',  '+92-300-1000006', 10, 2014, 'MBBS, FCPS (ENT)', 20),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'Dr. Mahnoor Iqbal',    'Gynecologist',        'Provides comprehensive women''s health and prenatal care.', 'mahnoor.iqbal@bluecross.pk',  '+92-300-1000007', 13, 2011, 'MBBS, FCPS (Gynecology & Obstetrics)', 30),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'Dr. Farhan Qureshi',   'General Physician',   'Family medicine practitioner focused on chronic disease management.', 'farhan.qureshi@familyhealth.pk', '+92-300-1000008', 6,  2018, 'MBBS', 20),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'Dr. Zara Abbasi',      'Nutritionist',        'Helps patients build sustainable, healthy eating habits.', 'zara.abbasi@familyhealth.pk', '+92-300-1000009', 5,  2019, 'BS Nutrition & Dietetics, RD', 45),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'Dr. Imran Hashmi',     'Neurologist',         'Specializes in migraine management and neurological disorders.', 'imran.hashmi@marinamed.pk',   '+92-300-1000010', 14, 2010, 'MBBS, FCPS (Neurology)', 30),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'Dr. Rabia Siddiqui',   'Psychiatrist',        'Focused on anxiety, depression, and stress-related conditions.', 'rabia.siddiqui@marinamed.pk', '+92-300-1000011', 8,  2016, 'MBBS, FCPS (Psychiatry)', 45),
((SELECT id FROM clinics WHERE slug = 'green-valley-clinic'),  'Dr. Nadeem Chaudhry',  'General Physician',   'Over 8 years treating common illnesses and minor emergencies.', 'nadeem.chaudhry@greenvalley.pk', '+92-300-1000012', 8, 2016, 'MBBS', 30),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'Dr. Sara Yousaf',      'Radiologist',         'Reads and interprets X-rays, ultrasounds, and CT scans.', 'sara.yousaf@alnoor.pk',       '+92-300-1000013', 10, 2014, 'MBBS, FCPS (Radiology)', 20),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'Dr. Ali Raza',         'Pathologist',         'Runs the diagnostic lab and reviews all lab test results.', 'ali.raza@alnoor.pk',          '+92-300-1000014', 12, 2012, 'MBBS, FCPS (Pathology)', 30),
((SELECT id FROM clinics WHERE slug = 'riverside-medical'),    'Dr. Mehwish Aslam',    'Pediatrician',        'Passionate about vaccination programs and newborn care.', 'mehwish.aslam@riverside.pk',  '+92-300-1000015', 7,  2017, 'MBBS, FCPS (Pediatrics)', 30),
((SELECT id FROM clinics WHERE slug = 'sunrise-family'),       'Dr. Waqas Hussain',    'Dentist',             'Provides general and cosmetic dentistry services.', 'waqas.hussain@sunrisefc.pk',  '+92-300-1000016', 9,  2015, 'BDS', 30),
((SELECT id FROM clinics WHERE slug = 'horizon-health'),       'Dr. Amna Riaz',        'Endocrinologist',     'Manages diabetes, thyroid, and hormonal disorders.', 'amna.riaz@horizonhealth.pk',  '+92-300-1000017', 11, 2013, 'MBBS, FCPS (Endocrinology)', 30),
((SELECT id FROM clinics WHERE slug = 'horizon-health'),       'Dr. Tariq Javed',      'Urologist',           'Specializes in kidney and urinary tract conditions.', 'tariq.javed@horizonhealth.pk','+92-300-1000018', 16, 2008, 'MBBS, FCPS (Urology)', 30),
((SELECT id FROM clinics WHERE slug = 'crescent-clinic'),      'Dr. Fatima Zaidi',     'Obstetrician',        'Maternity care specialist with 15 years of delivery experience.', 'fatima.zaidi@crescentclinic.pk', '+92-300-1000019', 15, 2009, 'MBBS, FCPS (Gynecology & Obstetrics)', 30),
((SELECT id FROM clinics WHERE slug = 'al-falah-multan'),      'Dr. Omar Farooqi',     'General Physician',   'Provides walk-in consultations and minor procedures.', 'omar.farooqi@alfalah.pk',     '+92-300-1000020', 4, 2020, 'MBBS', 30)
ON CONFLICT (clinic_id, name) WHERE NOT is_deleted DO NOTHING;

-- ------------------------------------------------------------
-- doctor_availability (70) — recurring weekly rule per doctor.
-- day_of_week: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat.
-- break_start_time/break_end_time are NULL where a doctor works a
-- single uninterrupted block.
-- ------------------------------------------------------------
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, break_start_time, break_end_time, slot_duration_minutes)
SELECT d.id, v.day_of_week, v.start_time, v.end_time, v.break_start_time, v.break_end_time, v.slot_duration_minutes
FROM (VALUES
  -- Dr. Ayesha Khan: Mon-Fri, 9-6 with lunch break, 30 min
  ('Dr. Ayesha Khan', 1, '09:00'::time, '18:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Ayesha Khan', 2, '09:00'::time, '18:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Ayesha Khan', 3, '09:00'::time, '18:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Ayesha Khan', 4, '09:00'::time, '18:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Ayesha Khan', 5, '09:00'::time, '18:00'::time, '13:00'::time, '14:00'::time, 30),
  -- Dr. Bilal Ahmed: Mon/Wed/Fri, 9-1, no break, 30 min
  ('Dr. Bilal Ahmed', 1, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Bilal Ahmed', 3, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Bilal Ahmed', 5, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  -- Dr. Sana Malik: Tue/Thu/Sat, 9-5 with lunch break, 20 min
  ('Dr. Sana Malik', 2, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Sana Malik', 4, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Sana Malik', 6, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  -- Dr. Usman Tariq: Mon/Tue/Thu, 10-6, no break, 45 min
  ('Dr. Usman Tariq', 1, '10:00'::time, '18:00'::time, NULL, NULL, 45),
  ('Dr. Usman Tariq', 2, '10:00'::time, '18:00'::time, NULL, NULL, 45),
  ('Dr. Usman Tariq', 4, '10:00'::time, '18:00'::time, NULL, NULL, 45),
  -- Dr. Hina Farooq: Wed/Fri/Sat, 11-7, no break, 30 min
  ('Dr. Hina Farooq', 3, '11:00'::time, '19:00'::time, NULL, NULL, 30),
  ('Dr. Hina Farooq', 5, '11:00'::time, '19:00'::time, NULL, NULL, 30),
  ('Dr. Hina Farooq', 6, '11:00'::time, '19:00'::time, NULL, NULL, 30),
  -- Dr. Kamran Sheikh: Mon/Wed/Fri, 9-2, no break, 20 min
  ('Dr. Kamran Sheikh', 1, '09:00'::time, '14:00'::time, NULL, NULL, 20),
  ('Dr. Kamran Sheikh', 3, '09:00'::time, '14:00'::time, NULL, NULL, 20),
  ('Dr. Kamran Sheikh', 5, '09:00'::time, '14:00'::time, NULL, NULL, 20),
  -- Dr. Mahnoor Iqbal: Tue/Thu/Sat, 9-1, no break, 30 min
  ('Dr. Mahnoor Iqbal', 2, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Mahnoor Iqbal', 4, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Mahnoor Iqbal', 6, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  -- Dr. Farhan Qureshi: Mon-Sat, 9-9 with lunch break, 20 min
  ('Dr. Farhan Qureshi', 1, '09:00'::time, '21:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Farhan Qureshi', 2, '09:00'::time, '21:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Farhan Qureshi', 3, '09:00'::time, '21:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Farhan Qureshi', 4, '09:00'::time, '21:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Farhan Qureshi', 5, '09:00'::time, '21:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Farhan Qureshi', 6, '09:00'::time, '21:00'::time, '13:00'::time, '14:00'::time, 20),
  -- Dr. Zara Abbasi: Mon/Wed, 10-4, no break, 45 min
  ('Dr. Zara Abbasi', 1, '10:00'::time, '16:00'::time, NULL, NULL, 45),
  ('Dr. Zara Abbasi', 3, '10:00'::time, '16:00'::time, NULL, NULL, 45),
  -- Dr. Imran Hashmi: Tue/Thu, 9-1, no break, 30 min
  ('Dr. Imran Hashmi', 2, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Imran Hashmi', 4, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  -- Dr. Rabia Siddiqui: Mon/Wed/Fri, 2-8pm, no break, 45 min
  ('Dr. Rabia Siddiqui', 1, '14:00'::time, '20:00'::time, NULL, NULL, 45),
  ('Dr. Rabia Siddiqui', 3, '14:00'::time, '20:00'::time, NULL, NULL, 45),
  ('Dr. Rabia Siddiqui', 5, '14:00'::time, '20:00'::time, NULL, NULL, 45),
  -- Dr. Nadeem Chaudhry: Mon/Tue/Thu/Sat, 10-4 with lunch break, 30 min
  ('Dr. Nadeem Chaudhry', 1, '10:00'::time, '16:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Nadeem Chaudhry', 2, '10:00'::time, '16:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Nadeem Chaudhry', 4, '10:00'::time, '16:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Nadeem Chaudhry', 6, '10:00'::time, '16:00'::time, '13:00'::time, '14:00'::time, 30),
  -- Dr. Sara Yousaf: Mon-Fri, 9-5 with lunch break, 20 min
  ('Dr. Sara Yousaf', 1, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Sara Yousaf', 2, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Sara Yousaf', 3, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Sara Yousaf', 4, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  ('Dr. Sara Yousaf', 5, '09:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 20),
  -- Dr. Ali Raza: Mon/Wed/Fri, 9-3, no break, 30 min
  ('Dr. Ali Raza', 1, '09:00'::time, '15:00'::time, NULL, NULL, 30),
  ('Dr. Ali Raza', 3, '09:00'::time, '15:00'::time, NULL, NULL, 30),
  ('Dr. Ali Raza', 5, '09:00'::time, '15:00'::time, NULL, NULL, 30),
  -- Dr. Mehwish Aslam: Tue/Wed/Fri/Sat, 9-1, no break, 30 min
  ('Dr. Mehwish Aslam', 2, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Mehwish Aslam', 3, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Mehwish Aslam', 5, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Mehwish Aslam', 6, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  -- Dr. Waqas Hussain: Mon-Thu evenings, 4-9pm, no break, 30 min
  ('Dr. Waqas Hussain', 1, '16:00'::time, '21:00'::time, NULL, NULL, 30),
  ('Dr. Waqas Hussain', 2, '16:00'::time, '21:00'::time, NULL, NULL, 30),
  ('Dr. Waqas Hussain', 3, '16:00'::time, '21:00'::time, NULL, NULL, 30),
  ('Dr. Waqas Hussain', 4, '16:00'::time, '21:00'::time, NULL, NULL, 30),
  -- Dr. Amna Riaz: Mon/Thu, 10-2, no break, 30 min
  ('Dr. Amna Riaz', 1, '10:00'::time, '14:00'::time, NULL, NULL, 30),
  ('Dr. Amna Riaz', 4, '10:00'::time, '14:00'::time, NULL, NULL, 30),
  -- Dr. Tariq Javed: Tue/Fri, 11-5 with lunch break, 30 min
  ('Dr. Tariq Javed', 2, '11:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 30),
  ('Dr. Tariq Javed', 5, '11:00'::time, '17:00'::time, '13:00'::time, '14:00'::time, 30),
  -- Dr. Fatima Zaidi: every day, 8am-10pm maternity coverage, no break, 30 min
  ('Dr. Fatima Zaidi', 0, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  ('Dr. Fatima Zaidi', 1, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  ('Dr. Fatima Zaidi', 2, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  ('Dr. Fatima Zaidi', 3, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  ('Dr. Fatima Zaidi', 4, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  ('Dr. Fatima Zaidi', 5, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  ('Dr. Fatima Zaidi', 6, '08:00'::time, '22:00'::time, NULL, NULL, 30),
  -- Dr. Omar Farooqi: Mon/Wed/Fri, 9-1, no break, 30 min
  ('Dr. Omar Farooqi', 1, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Omar Farooqi', 3, '09:00'::time, '13:00'::time, NULL, NULL, 30),
  ('Dr. Omar Farooqi', 5, '09:00'::time, '13:00'::time, NULL, NULL, 30)
) AS v(doctor_name, day_of_week, start_time, end_time, break_start_time, break_end_time, slot_duration_minutes)
JOIN doctors d ON d.name = v.doctor_name
ON CONFLICT (doctor_id, day_of_week, start_time, end_time) WHERE NOT is_deleted DO NOTHING;

-- ------------------------------------------------------------
-- demo login accounts -- so the doctor portal (and admin auth, once it's
-- gated) have a real, working credential out of the box instead of
-- requiring a manual POST /auth/register first.
--
-- Demo admin login:  admin@alshifa.pk   / password: admin123
-- Demo doctor login: ayesha.khan@alshifa.pk / password: doctor123
--   (Dr. Ayesha Khan, Al-Shifa General Clinic -- try /doctor/login)
-- ------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, clinic_id, doctor_id)
SELECT 'Clinic Admin', 'admin@alshifa.pk',
       '$2b$12$L0kJOit8Y4rP8XtiPRIc8ONSHvGDJasb7RpJVXoqH3FINwMiI0.iK',
       'admin', c.id, NULL
FROM clinics c WHERE c.slug = 'al-shifa-general'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password_hash, role, clinic_id, doctor_id)
SELECT 'Dr. Ayesha Khan', 'ayesha.khan@alshifa.pk',
       '$2b$12$Qcd/EIeeBzeAB92zra9vM.YvvZdhoV9XPaTnumMpc7gSzakQVz7OK',
       'doctor', c.id, d.id
FROM clinics c
JOIN doctors d ON d.clinic_id = c.id AND d.name = 'Dr. Ayesha Khan'
WHERE c.slug = 'al-shifa-general'
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------------
-- doctor_leaves (8) — a mix of full-day and partial-day exceptions
-- ------------------------------------------------------------
INSERT INTO doctor_leaves (doctor_id, leave_date, start_time, end_time, reason)
SELECT d.id, v.leave_date, v.start_time, v.end_time, v.reason
FROM (VALUES
  ('Dr. Ayesha Khan',     CURRENT_DATE + 10, NULL::time, NULL::time, 'Medical conference'),
  ('Dr. Sana Malik',      CURRENT_DATE + 15, NULL::time, NULL::time, 'Annual leave'),
  ('Dr. Usman Tariq',     CURRENT_DATE + 5,  '10:00'::time, '12:00'::time, 'In surgery (OT booked)'),
  ('Dr. Farhan Qureshi',  CURRENT_DATE + 20, NULL::time, NULL::time, 'Personal leave'),
  ('Dr. Rabia Siddiqui',  CURRENT_DATE + 7,  '14:00'::time, '16:00'::time, 'Training session'),
  ('Dr. Fatima Zaidi',    CURRENT_DATE + 12, NULL::time, NULL::time, 'Attending delivery at partner hospital'),
  ('Dr. Waqas Hussain',   CURRENT_DATE + 6,  '16:00'::time, '18:00'::time, 'Dental workshop'),
  ('Dr. Nadeem Chaudhry', CURRENT_DATE + 9,  NULL::time, NULL::time, 'Sick leave')
) AS v(doctor_name, leave_date, start_time, end_time, reason)
JOIN doctors d ON d.name = v.doctor_name
ON CONFLICT (doctor_id, leave_date, (COALESCE(start_time, '00:00:00'::time))) DO NOTHING;

-- ------------------------------------------------------------
-- patients (18) — one row per real patient, scoped to their clinic.
-- Repeat customers (see Ahmed Raza below) reuse this same row across
-- multiple appointments instead of creating a duplicate.
-- ------------------------------------------------------------
INSERT INTO patients (clinic_id, name, phone, email, source, age, gender, city, notes) VALUES
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'Ahmed Raza',      '+92-300-1234567', 'ahmed.raza@example.com', 'chat',   34, 'male',   'Lahore',      NULL),
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'Sana Iqbal',      '+92-301-2345678', 'sana.iqbal@example.com', 'chat',   28, 'female', 'Lahore',      'Prefers evening appointments.'),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Bilal Hussain',   '+92-302-3456789', NULL,                      'manual', 45, 'male',   'Karachi',     NULL),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Fatima Sheikh',   '+92-303-4567890', 'fatima.sheikh@example.com', 'chat', 31, 'female', 'Karachi',     NULL),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Zainab Ali',      '+92-304-5678901', NULL,                      'manual', 52, 'female', 'Karachi',     'Penicillin allergy.'),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'Hassan Javed',    '+92-305-6789012', 'hassan.javed@example.com', 'chat',  39, 'male',   'Islamabad',   NULL),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'Ayesha Noor',     '+92-306-7890123', 'ayesha.noor@example.com', 'chat',   26, 'female', 'Islamabad',   NULL),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'Omar Siddiqui',   '+92-307-8901234', NULL,                      'manual', 60, 'male',   'Rawalpindi',  'Type 2 diabetic, on regular follow-up.'),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'Mariam Chaudhry', '+92-308-9012345', 'mariam.c@example.com', 'chat',      33, 'female', 'Rawalpindi',  NULL),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'Talha Nawaz',     '+92-309-0123456', 'talha.nawaz@example.com', 'chat',   41, 'male',   'Karachi',     NULL),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'Iqra Batool',     '+92-310-1234567', NULL,                      'manual', 24, 'female', 'Karachi',     NULL),
((SELECT id FROM clinics WHERE slug = 'green-valley-clinic'),  'Adeel Mirza',     '+92-311-2345678', 'adeel.mirza@example.com', 'chat',   37, 'male',   'Faisalabad',  NULL),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'Nimra Sattar',    '+92-312-3456789', 'nimra.sattar@example.com', 'chat',  29, 'female', 'Lahore',      NULL),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'Shahzaib Khan',   '+92-313-4567890', NULL,                      'manual', 48, 'male',   'Lahore',      NULL),
((SELECT id FROM clinics WHERE slug = 'riverside-medical'),    'Areeba Farooq',   '+92-314-5678901', 'areeba.farooq@example.com', 'chat', 22, 'female', 'Multan',      'New mother, infant vaccination schedule.'),
((SELECT id FROM clinics WHERE slug = 'sunrise-family'),       'Danish Ali',      '+92-315-6789012', 'danish.ali@example.com', 'chat',    35, 'male',   'Peshawar',    NULL),
((SELECT id FROM clinics WHERE slug = 'horizon-health'),       'Laiba Yousuf',    '+92-316-7890123', NULL,                      'manual', 44, 'female', 'Islamabad',   NULL),
((SELECT id FROM clinics WHERE slug = 'crescent-clinic'),      'Kiran Aslam',     '+92-317-8901234', 'kiran.aslam@example.com', 'chat',   30, 'female', 'Multan',      'Currently in third trimester.')
ON CONFLICT (clinic_id, phone) DO NOTHING;

-- ------------------------------------------------------------
-- faqs (20) — spread across clinics
-- ------------------------------------------------------------
INSERT INTO faqs (clinic_id, question_en, question_ur, answer_en, answer_ur, category) VALUES
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'What are your opening hours?',            'آپ کے کھلنے کے اوقات کیا ہیں؟',                 'We are open Monday to Friday 9am-9pm, Saturday 10am-6pm, and closed on Sunday.', 'ہم پیر سے جمعہ 9 بجے سے رات 9 بجے تک، ہفتہ 10 بجے سے شام 6 بجے تک کھلے ہیں، اتوار کو بند رہتا ہے۔', 'general'),
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'Do you accept walk-in patients?',         'کیا آپ بغیر اپوائنٹمنٹ کے مریض دیکھتے ہیں؟',    'Yes, we accept walk-ins, but booking an appointment reduces your wait time.',    'جی ہاں، ہم بغیر اپوائنٹمنٹ کے بھی مریض دیکھتے ہیں، لیکن اپوائنٹمنٹ بک کرنے سے انتظار کا وقت کم ہو جاتا ہے۔', 'appointments'),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Do you have an emergency department?',    'کیا آپ کے پاس ایمرجنسی ڈیپارٹمنٹ ہے؟',           'Yes, City Care Hospital has a 24/7 emergency department on the ground floor.',   'جی ہاں، سٹی کیئر ہسپتال میں گراؤنڈ فلور پر 24/7 ایمرجنسی ڈیپارٹمنٹ موجود ہے۔', 'emergency'),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'Which insurance providers do you accept?', 'آپ کون سی انشورنس کمپنیاں قبول کرتے ہیں؟',      'We accept most major insurance providers; please call our billing desk to confirm.', 'ہم زیادہ تر بڑی انشورنس کمپنیاں قبول کرتے ہیں؛ تصدیق کے لیے ہماری بلنگ ڈیسک پر کال کریں۔', 'billing'),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'How do I cancel an appointment?',         'میں اپوائنٹمنٹ کیسے منسوخ کروں؟',                'Call the clinic or reply to your confirmation message and we will cancel it for you.', 'کلینک کو کال کریں یا اپنے تصدیقی پیغام کا جواب دیں، ہم آپ کے لیے اسے منسوخ کر دیں گے۔', 'appointments'),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'Is parking available?',                   'کیا پارکنگ دستیاب ہے؟',                          'Yes, free parking is available for patients directly in front of the clinic.',   'جی ہاں، مریضوں کے لیے کلینک کے سامنے مفت پارکنگ دستیاب ہے۔', 'general'),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'Do you offer home visits?',               'کیا آپ گھر پر وزٹ کی سہولت دیتے ہیں؟',           'Home visits are available for elderly or bedridden patients within city limits.', 'بزرگ یا بستر پر موجود مریضوں کے لیے شہر کی حدود میں گھر پر وزٹ کی سہولت دستیاب ہے۔', 'services'),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'What payment methods do you accept?',     'آپ ادائیگی کے کون سے طریقے قبول کرتے ہیں؟',      'We accept cash, debit/credit cards, and JazzCash/Easypaisa.',                    'ہم نقد، ڈیبٹ/کریڈٹ کارڈ، اور جاز کیش/ایزی پیسہ قبول کرتے ہیں۔', 'billing'),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'Do I need a referral to see a specialist?', 'کیا مجھے سپیشلسٹ سے ملنے کے لیے ریفرل کی ضرورت ہے؟', 'No referral is needed; you can book a specialist appointment directly.',      'کسی ریفرل کی ضرورت نہیں؛ آپ براہ راست سپیشلسٹ اپوائنٹمنٹ بک کر سکتے ہیں۔', 'appointments'),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'Can I get lab results online?',           'کیا مجھے لیب رزلٹ آن لائن مل سکتے ہیں؟',        'Yes, lab results are emailed to you within 24-48 hours of your test.',           'جی ہاں، ٹیسٹ کے 24-48 گھنٹوں کے اندر لیب رزلٹ آپ کو ای میل کر دیے جاتے ہیں۔', 'services'),
((SELECT id FROM clinics WHERE slug = 'green-valley-clinic'),  'What should I bring to my first visit?',  'پہلی وزٹ پر مجھے کیا لانا چاہیے؟',              'Please bring a valid CNIC, any previous medical records, and your current medication list.', 'براہ کرم اپنا اصل شناختی کارڈ، پرانا میڈیکل ریکارڈ، اور موجودہ ادویات کی فہرست لے کر آئیں۔', 'general'),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'Do I need to fast before a blood test?',  'کیا خون کے ٹیسٹ سے پہلے روزہ رکھنا ضروری ہے؟',   'For most standard panels, fasting for 8-10 hours is recommended.',               'زیادہ تر معیاری ٹیسٹوں کے لیے 8-10 گھنٹے کا روزہ تجویز کیا جاتا ہے۔', 'lab'),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'How long does an X-ray report take?',     'ایکسرے رپورٹ ملنے میں کتنا وقت لگتا ہے؟',       'X-ray reports are usually ready within 2-4 hours.',                              'ایکسرے رپورٹس عام طور پر 2-4 گھنٹوں میں تیار ہو جاتی ہیں۔', 'lab'),
((SELECT id FROM clinics WHERE slug = 'riverside-medical'),    'Do you treat children under 2 years old?', 'کیا آپ 2 سال سے کم عمر بچوں کا علاج کرتے ہیں؟', 'Yes, our pediatric team treats infants, toddlers, and children of all ages.',    'جی ہاں، ہماری پیڈیاٹرک ٹیم ہر عمر کے بچوں کا علاج کرتی ہے۔', 'pediatrics'),
((SELECT id FROM clinics WHERE slug = 'sunrise-family'),       'Do you offer teeth whitening?',           'کیا آپ دانتوں کی سفیدی کی سہولت دیتے ہیں؟',      'Yes, our dental team offers both in-clinic and take-home whitening kits.',        'جی ہاں، ہماری ڈینٹل ٹیم کلینک اور گھر دونوں کے لیے وائٹننگ کٹس فراہم کرتی ہے۔', 'dental'),
((SELECT id FROM clinics WHERE slug = 'horizon-health'),       'How often should I get a thyroid check?', 'مجھے تھائیرائیڈ چیک اپ کتنی بار کروانا چاہیے؟',  'For most adults, an annual thyroid panel is recommended unless symptoms occur.', 'زیادہ تر بالغوں کے لیے سالانہ تھائیرائیڈ ٹیسٹ تجویز کیا جاتا ہے جب تک علامات ظاہر نہ ہوں۔', 'endocrinology'),
((SELECT id FROM clinics WHERE slug = 'horizon-health'),       'Can I reschedule my appointment?',        'کیا میں اپنی اپوائنٹمنٹ دوبارہ شیڈول کر سکتا ہوں؟', 'Yes, message us your preferred new date and time and we will confirm availability.', 'جی ہاں، ہمیں اپنی پسندیدہ نئی تاریخ اور وقت بھیجیں، ہم دستیابی کی تصدیق کریں گے۔', 'appointments'),
((SELECT id FROM clinics WHERE slug = 'crescent-clinic'),      'Do you have a maternity ward?',           'کیا آپ کے پاس زچگی وارڈ ہے؟',                    'Yes, Crescent Clinic operates a fully staffed 24/7 maternity ward.',             'جی ہاں، کریسنٹ کلینک میں مکمل عملے کے ساتھ 24/7 زچگی وارڈ موجود ہے۔', 'maternity'),
((SELECT id FROM clinics WHERE slug = 'crescent-clinic'),      'Can my partner stay during delivery?',    'کیا میرا ساتھی زچگی کے دوران ساتھ رہ سکتا ہے؟',  'Yes, one support person is welcome in the delivery room.',                        'جی ہاں، ڈیلیوری روم میں ایک ساتھی شخص کی اجازت ہے۔', 'maternity'),
((SELECT id FROM clinics WHERE slug = 'al-falah-multan'),      'Do you have a pharmacy on site?',         'کیا آپ کے پاس موقع پر فارمیسی ہے؟',              'Yes, our in-house pharmacy is open during all clinic hours.',                    'جی ہاں، ہماری اندرونِ کلینک فارمیسی تمام اوقات میں کھلی رہتی ہے۔', 'general')
ON CONFLICT (clinic_id, question_en) WHERE NOT is_deleted DO NOTHING;

-- ------------------------------------------------------------
-- doctor_slots (23) — pre-generated slots. One matches each
-- appointment below (is_booked = true; one freed up after its
-- appointment was cancelled), plus a handful of open slots to show
-- what a "book now" screen would list.
-- ------------------------------------------------------------
INSERT INTO doctor_slots (doctor_id, clinic_id, slot_date, start_time, end_time, is_booked)
SELECT d.id, d.clinic_id, v.slot_date, v.start_time, v.end_time, v.is_booked
FROM (VALUES
  ('Dr. Ayesha Khan',      CURRENT_DATE + 1,  '10:00'::time, '10:30'::time, true),
  ('Dr. Bilal Ahmed',      CURRENT_DATE + 2,  '11:30'::time, '12:00'::time, true),
  ('Dr. Sana Malik',       CURRENT_DATE + 1,  '09:15'::time, '09:35'::time, true),
  ('Dr. Usman Tariq',      CURRENT_DATE + 3,  '14:00'::time, '14:45'::time, true),
  ('Dr. Hina Farooq',      CURRENT_DATE - 2,  '16:30'::time, '17:00'::time, true),
  ('Dr. Kamran Sheikh',    CURRENT_DATE + 4,  '10:45'::time, '11:05'::time, true),
  ('Dr. Mahnoor Iqbal',    CURRENT_DATE + 5,  '12:00'::time, '12:30'::time, true),
  ('Dr. Farhan Qureshi',   CURRENT_DATE - 1,  '17:00'::time, '17:20'::time, true),
  ('Dr. Zara Abbasi',      CURRENT_DATE + 6,  '13:15'::time, '14:00'::time, true),
  ('Dr. Imran Hashmi',     CURRENT_DATE + 2,  '15:30'::time, '16:00'::time, true),
  ('Dr. Rabia Siddiqui',   CURRENT_DATE + 7,  '11:00'::time, '11:45'::time, true),
  ('Dr. Nadeem Chaudhry',  CURRENT_DATE - 3,  '09:30'::time, '10:00'::time, false), -- freed after cancellation
  ('Dr. Sara Yousaf',      CURRENT_DATE + 1,  '10:15'::time, '10:35'::time, true),
  ('Dr. Ali Raza',         CURRENT_DATE + 8,  '16:00'::time, '16:30'::time, true),
  ('Dr. Mehwish Aslam',    CURRENT_DATE + 3,  '09:00'::time, '09:30'::time, true),
  ('Dr. Waqas Hussain',    CURRENT_DATE + 4,  '18:30'::time, '19:00'::time, true),
  ('Dr. Amna Riaz',        CURRENT_DATE - 5,  '12:45'::time, '13:15'::time, true),
  ('Dr. Fatima Zaidi',     CURRENT_DATE + 9,  '10:30'::time, '11:00'::time, true),
  -- extra open slots, not tied to any appointment
  ('Dr. Ayesha Khan',      CURRENT_DATE + 1,  '09:00'::time, '09:30'::time, false),
  ('Dr. Ayesha Khan',      CURRENT_DATE + 1,  '09:30'::time, '10:00'::time, false),
  ('Dr. Bilal Ahmed',      CURRENT_DATE + 2,  '09:00'::time, '09:30'::time, false),
  ('Dr. Sana Malik',       CURRENT_DATE + 1,  '09:35'::time, '09:55'::time, false),
  ('Dr. Fatima Zaidi',     CURRENT_DATE + 9,  '11:00'::time, '11:30'::time, false)
) AS v(doctor_name, slot_date, start_time, end_time, is_booked)
JOIN doctors d ON d.name = v.doctor_name
ON CONFLICT (doctor_id, slot_date, start_time) DO NOTHING;

-- ------------------------------------------------------------
-- appointments (19) — linked to patients via patient_id, and to a
-- pre-generated slot where one exists (LEFT JOIN -> slot_id is NULL
-- otherwise). Row 19 has Ahmed Raza (row 1's patient) booking again
-- weeks later -- the repeat-customer case: same patient_id, no new
-- patients row created.
-- ------------------------------------------------------------
INSERT INTO appointments (
    clinic_id, doctor_id, patient_id, slot_id,
    appointment_date, appointment_time,
    reason, status, status_note, language
)
SELECT
    c.id, d.id, p.id, ds.id,
    v.appointment_date, v.appointment_time::text,
    v.reason, v.status, v.status_note, v.language
FROM (VALUES
    ('al-shifa-general',     'Dr. Ayesha Khan',     '+92-300-1234567', CURRENT_DATE + 1,  '10:00'::time, 'Routine check-up',                    'confirmed', NULL::varchar,                            'en'),
    ('al-shifa-general',     'Dr. Bilal Ahmed',     '+92-301-2345678', CURRENT_DATE + 2,  '11:30'::time, 'Chest pain and shortness of breath',  'pending',   NULL,                                      'en'),
    ('city-care-hospital',   'Dr. Sana Malik',      '+92-302-3456789', CURRENT_DATE + 1,  '09:15'::time, 'Child fever and cough',               'confirmed', 'Confirmed via phone call.',               'en'),
    ('city-care-hospital',   'Dr. Usman Tariq',     '+92-303-4567890', CURRENT_DATE + 3,  '14:00'::time, 'Knee pain after sports injury',       'pending',   NULL,                                      'en'),
    ('city-care-hospital',   'Dr. Hina Farooq',     '+92-304-5678901', CURRENT_DATE - 2,  '16:30'::time, 'Acne consultation',                   'completed', 'Follow-up in 4 weeks recommended.',      'ur'),
    ('blue-cross-clinic',    'Dr. Kamran Sheikh',   '+92-305-6789012', CURRENT_DATE + 4,  '10:45'::time, 'Persistent sore throat',              'pending',   NULL,                                      'en'),
    ('blue-cross-clinic',    'Dr. Mahnoor Iqbal',   '+92-306-7890123', CURRENT_DATE + 5,  '12:00'::time, 'Prenatal check-up',                   'confirmed', NULL,                                      'ur'),
    ('family-health-center', 'Dr. Farhan Qureshi',  '+92-307-8901234', CURRENT_DATE - 1,  '17:00'::time, 'Blood pressure follow-up',            'completed', 'Blood pressure stable, continue medication.', 'en'),
    ('family-health-center', 'Dr. Zara Abbasi',     '+92-308-9012345', CURRENT_DATE + 6,  '13:15'::time, 'Diet plan consultation',              'pending',   NULL,                                      'en'),
    ('marina-medical',       'Dr. Imran Hashmi',    '+92-309-0123456', CURRENT_DATE + 2,  '15:30'::time, 'Recurring migraines',                 'confirmed', NULL,                                      'en'),
    ('marina-medical',       'Dr. Rabia Siddiqui',  '+92-310-1234567', CURRENT_DATE + 7,  '11:00'::time, 'Anxiety and sleep issues',            'pending',   NULL,                                      'ur'),
    ('al-noor-diagnostic',   'Dr. Sara Yousaf',     '+92-312-3456789', CURRENT_DATE + 1,  '10:15'::time, 'Chest X-ray',                         'confirmed', NULL,                                      'en'),
    ('al-noor-diagnostic',   'Dr. Ali Raza',        '+92-313-4567890', CURRENT_DATE + 8,  '16:00'::time, 'Full body lab panel',                 'pending',   NULL,                                      'en'),
    ('riverside-medical',    'Dr. Mehwish Aslam',   '+92-314-5678901', CURRENT_DATE + 3,  '09:00'::time, 'Infant vaccination',                  'confirmed', NULL,                                      'ur'),
    ('sunrise-family',       'Dr. Waqas Hussain',   '+92-315-6789012', CURRENT_DATE + 4,  '18:30'::time, 'Tooth cavity filling',                'pending',   NULL,                                      'en'),
    ('horizon-health',       'Dr. Amna Riaz',       '+92-316-7890123', CURRENT_DATE - 5,  '12:45'::time, 'Diabetes management review',          'completed', 'HbA1c improved since last visit.',       'en'),
    ('crescent-clinic',      'Dr. Fatima Zaidi',    '+92-317-8901234', CURRENT_DATE + 9,  '10:30'::time, 'Third trimester check-up',            'confirmed', NULL,                                      'ur'),
    -- repeat customer: Ahmed Raza (same patient as row 1) books again with a different doctor, weeks later
    ('al-shifa-general',     'Dr. Bilal Ahmed',     '+92-300-1234567', CURRENT_DATE + 15, '11:00'::time, 'Follow-up cardiology consultation',   'pending',   NULL,                                      'en')
) AS v(clinic_slug, doctor_name, patient_phone, appointment_date, appointment_time, reason, status, status_note, language)
JOIN clinics c ON c.slug = v.clinic_slug
JOIN doctors d ON d.name = v.doctor_name AND d.clinic_id = c.id
JOIN patients p ON p.phone = v.patient_phone AND p.clinic_id = c.id
LEFT JOIN doctor_slots ds ON ds.doctor_id = d.id AND ds.slot_date = v.appointment_date AND ds.start_time = v.appointment_time
ON CONFLICT (doctor_id, appointment_date, appointment_time) WHERE status != 'cancelled' AND NOT is_deleted DO NOTHING;

-- The one deliberately-cancelled demo appointment is seeded separately: the
-- partial unique index above only covers non-cancelled rows (a cancelled
-- slot is legitimately reusable in the real app), so ON CONFLICT can't
-- de-duplicate it the same way. Guarding with WHERE NOT EXISTS instead.
INSERT INTO appointments (clinic_id, doctor_id, patient_id, slot_id, appointment_date, appointment_time, reason, status, status_note, language)
SELECT c.id, d.id, p.id, NULL,
       CURRENT_DATE - 3, '09:30'::time, 'Seasonal flu symptoms', 'cancelled', 'Patient requested cancellation.', 'en'
FROM clinics c
JOIN doctors d ON d.name = 'Dr. Nadeem Chaudhry' AND d.clinic_id = c.id
JOIN patients p ON p.phone = '+92-311-2345678' AND p.clinic_id = c.id
WHERE c.slug = 'green-valley-clinic'
  AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.doctor_id = d.id AND a.appointment_date = CURRENT_DATE - 3
        AND a.appointment_time = '09:30'::time::text AND a.status = 'cancelled'
  );

-- ------------------------------------------------------------
-- conversations (12)
-- ------------------------------------------------------------
INSERT INTO conversations (clinic_id, session_id, language) VALUES
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'sess-a1b2c3d4-0001', 'en'),
((SELECT id FROM clinics WHERE slug = 'al-shifa-general'),     'sess-a1b2c3d4-0002', 'en'),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'sess-e5f6g7h8-0003', 'en'),
((SELECT id FROM clinics WHERE slug = 'city-care-hospital'),   'sess-e5f6g7h8-0004', 'ur'),
((SELECT id FROM clinics WHERE slug = 'blue-cross-clinic'),    'sess-i9j0k1l2-0005', 'en'),
((SELECT id FROM clinics WHERE slug = 'family-health-center'), 'sess-m3n4o5p6-0006', 'ur'),
((SELECT id FROM clinics WHERE slug = 'marina-medical'),       'sess-q7r8s9t0-0007', 'en'),
((SELECT id FROM clinics WHERE slug = 'green-valley-clinic'),  'sess-u1v2w3x4-0008', 'en'),
((SELECT id FROM clinics WHERE slug = 'al-noor-diagnostic'),   'sess-y5z6a7b8-0009', 'ur'),
((SELECT id FROM clinics WHERE slug = 'riverside-medical'),    'sess-c9d0e1f2-0010', 'en'),
((SELECT id FROM clinics WHERE slug = 'sunrise-family'),       'sess-g3h4i5j6-0011', 'en'),
((SELECT id FROM clinics WHERE slug = 'crescent-clinic'),      'sess-k7l8m9n0-0012', 'ur')
ON CONFLICT (session_id) DO NOTHING;

-- ------------------------------------------------------------
-- messages (13) — one row per full turn (patient message +
-- bot response together), replacing the old role/content-per-row
-- public.messages table. local_created_at/local_updated_at assume
-- Asia/Karachi (UTC+5); server_created_at/server_updated_at are UTC.
-- ------------------------------------------------------------
INSERT INTO messages (message_id, conversation_id, message_text, llm_response, context, traces, feedback_type, feedback_value, local_created_at, local_updated_at, server_created_at, server_updated_at)
SELECT v.message_id, conv.id, v.message_text, v.llm_response, v.context, v.traces, v.feedback_type, v.feedback_value, v.created_at + INTERVAL '5 hours', v.created_at + INTERVAL '5 hours', v.created_at, v.created_at
FROM (VALUES
    ('msg-0001', 'sess-a1b2c3d4-0001', 'Hi, I want to book an appointment.', 'Sure! Could you share your name, phone number, and preferred date?', NULL, NULL, NULL::integer, NULL, NOW() - INTERVAL '2 days'),
    ('msg-0002', 'sess-a1b2c3d4-0001', 'Ahmed Raza, +92-300-1234567, tomorrow morning please.', 'Got it! Dr. Ayesha Khan has a 10:00 AM slot open tomorrow. Shall I confirm?', 'doctor_availability:Dr. Ayesha Khan', NULL, 1, 'helpful', NOW() - INTERVAL '2 days' + INTERVAL '2 minutes'),
    ('msg-0003', 'sess-a1b2c3d4-0002', 'What are your clinic hours?', 'We are open Monday-Friday 9am-9pm and Saturday 10am-6pm. Closed on Sundays.', 'faqs:opening_hours', NULL, NULL::integer, NULL, NOW() - INTERVAL '4 days'),
    ('msg-0004', 'sess-e5f6g7h8-0003', 'میرے بچے کو بخار ہے، آج اپوائنٹمنٹ مل سکتی ہے؟', 'جی ہاں، ڈاکٹر ثناء ملک آج صبح 9:15 بجے دستیاب ہیں۔ کیا میں یہ اپوائنٹمنٹ بک کر دوں؟', 'doctor_availability:Dr. Sana Malik', NULL, 1, 'helpful', NOW() - INTERVAL '1 day'),
    ('msg-0005', 'sess-e5f6g7h8-0004', 'Do you treat sports injuries?', 'Yes, Dr. Usman Tariq specializes in sports injuries and orthopedic care.', 'faqs:services', NULL, NULL::integer, NULL, NOW() - INTERVAL '3 days'),
    ('msg-0006', 'sess-i9j0k1l2-0005', 'I have a sore throat for 3 days, who should I see?', 'I''d recommend Dr. Kamran Sheikh, our ENT specialist. Would you like me to book a slot?', 'doctor_directory:ENT', NULL, NULL::integer, NULL, NOW() - INTERVAL '6 hours'),
    ('msg-0007', 'sess-m3n4o5p6-0006', 'Can I get a diet plan consultation?', 'Absolutely, Dr. Zara Abbasi is available Monday and Wednesday for nutrition consultations.', 'doctor_availability:Dr. Zara Abbasi', NULL, NULL::integer, NULL, NOW() - INTERVAL '5 days'),
    ('msg-0008', 'sess-q7r8s9t0-0007', 'I keep getting migraines, what should I do?', 'I''m sorry to hear that. I''d suggest seeing Dr. Imran Hashmi, our neurologist, for a proper evaluation.', NULL, NULL, 0, 'too_generic', NOW() - INTERVAL '8 hours'),
    ('msg-0009', 'sess-u1v2w3x4-0008', 'Is Dr. Nadeem available this Saturday?', 'Dr. Nadeem Chaudhry is available on Saturdays. Would you like to book a time?', 'doctor_availability:Dr. Nadeem Chaudhry', NULL, NULL::integer, NULL, NOW() - INTERVAL '2 days'),
    ('msg-0010', 'sess-y5z6a7b8-0009', 'How long will my X-ray results take?', 'X-ray reports are usually ready within 2-4 hours after the scan.', 'faqs:lab', NULL, 1, 'helpful', NOW() - INTERVAL '9 hours'),
    ('msg-0011', 'sess-c9d0e1f2-0010', 'Do you have vaccination records for my child?', 'Yes, we keep full vaccination records -- just share your child''s name and date of birth.', NULL, NULL, NULL::integer, NULL, NOW() - INTERVAL '3 days'),
    ('msg-0012', 'sess-g3h4i5j6-0011', 'How much does a tooth filling cost?', 'A standard filling starts at PKR 3,000, depending on the tooth and material used.', NULL, NULL, NULL::integer, NULL, NOW() - INTERVAL '7 hours'),
    ('msg-0013', 'sess-k7l8m9n0-0012', 'Is a birthing pool available?', 'Yes, Crescent Clinic offers a birthing pool option -- let us know if you''d like to include it in your birth plan.', NULL, NULL, NULL::integer, NULL, NOW() - INTERVAL '1 day')
) AS v(message_id, session_id, message_text, llm_response, context, traces, feedback_type, feedback_value, created_at)
JOIN conversations conv ON conv.session_id = v.session_id
ON CONFLICT (message_id) DO NOTHING;

-- ------------------------------------------------------------
-- llm_evaluations (6) — quality scores for a subset of the
-- turns above (not every message needs to be evaluated).
-- ------------------------------------------------------------
INSERT INTO llm_evaluations (message_id, conversation_id, relevance, correctness, faithfulness, completeness, overall_score, is_hallucination, reasoning, improvement_suggestion, local_created_at, local_updated_at, server_created_at, server_updated_at)
SELECT m.message_id, m.conversation_id, v.relevance, v.correctness, v.faithfulness, v.completeness, v.overall_score, v.is_hallucination, v.reasoning::jsonb, v.improvement_suggestion::jsonb, m.local_created_at, m.local_created_at, m.server_created_at, m.server_created_at
FROM (VALUES
    ('msg-0002', 0.95, 0.90, 0.92, 0.88, 0.91, false, '{"summary": "Correctly matched an open slot from doctor_availability"}', '{"summary": "Could also confirm the clinic address in the same reply"}'),
    ('msg-0004', 0.93, 0.91, 0.94, 0.85, 0.90, false, '{"summary": "Accurate pediatric slot lookup, replied in Urdu as requested"}', '{"summary": "Could offer an earlier slot if urgency (fever) is detected"}'),
    ('msg-0006', 0.88, 0.86, 0.90, 0.80, 0.85, false, '{"summary": "Reasonable ENT referral, but did not offer available times"}', '{"summary": "Proactively list open slots instead of asking a follow-up"}'),
    ('msg-0008', 0.70, 0.75, 0.80, 0.55, 0.68, false, '{"summary": "Generic referral, no migraine-specific guidance or slots offered"}', '{"summary": "Surface Dr. Imran Hashmi''s next available slot directly"}'),
    ('msg-0010', 0.97, 0.96, 0.98, 0.90, 0.95, false, '{"summary": "Directly answers the FAQ with the correct turnaround time"}', '{"summary": "None needed"}'),
    ('msg-0013', 0.84, 0.82, 0.88, 0.78, 0.83, false, '{"summary": "Correct amenity info, could ask about due date for follow-up"}', '{"summary": "Prompt for delivery date to personalize the birth plan"}')
) AS v(message_id, relevance, correctness, faithfulness, completeness, overall_score, is_hallucination, reasoning, improvement_suggestion)
JOIN messages m ON m.message_id = v.message_id
ON CONFLICT (message_id) DO NOTHING;

-- ------------------------------------------------------------
-- notifications (sample)
-- Seeded appointments above are inserted directly via SQL, not through the
-- application's book_appointment() service, so they don't pass through the
-- code path that normally creates a notification for each new booking.
-- A few sample rows here give the admin notification bell something to
-- show on a fresh install rather than starting empty. Guarded on clinic 1
-- already having notifications, so re-running this script doesn't
-- duplicate them.
-- ------------------------------------------------------------
INSERT INTO notifications (clinic_id, message, notification_type, is_read)
SELECT * FROM (VALUES
    (1, 'New appointment request from Sana Iqbal with Dr. Bilal Ahmed on 2026-08-09 — needs confirmation.', 'appointment_created', false),
    (1, 'New appointment booked for Ahmed Raza with Dr. Ayesha Khan on 2026-08-08.', 'appointment_created', false),
    (1, 'New appointment request from Ahmed Raza with Dr. Bilal Ahmed on 2026-08-22 — needs confirmation.', 'appointment_created', true)
) AS v(clinic_id, message, notification_type, is_read)
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE clinic_id = 1);

COMMIT;
