CREATE TABLE patients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  ward_id INTEGER,
  admitted TEXT,
  discharged TEXT
);

CREATE TABLE records (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  category TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE wards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE staff (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE assignments (
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  PRIMARY KEY (staff_id, ward_id)
);

CREATE TABLE shifts (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  start_ts TEXT NOT NULL,
  end_ts TEXT NOT NULL
);

CREATE TABLE encounters (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  start_ts TEXT NOT NULL,
  end_ts TEXT
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  staff_id INTEGER NOT NULL,
  patient_id INTEGER,
  action TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);

-- Addition beyond the contract's literal schema: alerts need persistent,
-- closable state (POST /alerts/{id}/close), which no table above provides.
-- This table is new, not a change to any table in the contract.
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  staff_id INTEGER,
  patient_id INTEGER,
  audit_log_id INTEGER,
  detail TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reviewer_id INTEGER,
  outcome TEXT,
  created_ts TEXT NOT NULL,
  closed_ts TEXT
);

-- Two further additions, built to answer real reviewer feedback: shift
-- substitution (a colleague covering someone's shift) and cross-department
-- consults (a referral). Neither changes decide()'s five checks into a
-- bypass — a shift cover writes a REAL row into the existing shifts and
-- assignments tables, so it is evaluated by the normal checks like anyone
-- else's shift. A referral is a second legitimate source of "treatment
-- relationship" alongside encounters, checked explicitly in decide().

CREATE TABLE shift_covers (
  id INTEGER PRIMARY KEY,
  covering_staff_id INTEGER NOT NULL REFERENCES staff(id),
  absent_staff_id INTEGER NOT NULL REFERENCES staff(id),
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  created_ts TEXT NOT NULL
);

CREATE TABLE consult_referrals (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  referring_staff_id INTEGER NOT NULL REFERENCES staff(id),
  target_ward_id INTEGER NOT NULL REFERENCES wards(id),
  note TEXT,
  created_ts TEXT NOT NULL,
  expires_at TEXT NOT NULL
);