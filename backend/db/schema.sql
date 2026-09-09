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
