/**
 * seed.js — produces a populated SQLite database from scratch.
 *
 * PLANTED ABUSE CASES (must exist by day three, per the contract):
 *
 * 1. Clerk "Ifeoma Nwosu" (staff.id will be printed below) is denied
 *    access to 12 different Ward B patients during one shift, each time
 *    for reason='no_treatment_relationship'. Each individual denial is
 *    decide() working correctly. The abuse signal is the *pattern* —
 *    one staff member probing many patients she has no relationship
 *    with — which the detector surfaces as `high_volume_no_relationship`.
 *
 * 2. Nurse "Tolu Adeyemi" uses break-glass to open the record of patient
 *    "Musa Bello" — who is also seeded as a staff member (a doctor) — on
 *    a ward she is not assigned to, outside her shift hours. Signal:
 *    ward mismatch + staff-as-patient, surfaced as a `break_glass` alert
 *    with a staff-as-patient flag.
 *
 * 3. Departed intern "David Okonkwo" (staff.active = 0) attempts to view
 *    a patient's record with his old credentials. decide() check 1 fires
 *    (staff_inactive) and denies it — this is the brief's exact scenario,
 *    surfaced as an `inactive_staff_attempt` alert.
 *
 * Run: npm run init-db && npm run seed
 */

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { appendLog } = require('./src/hashChain');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

const now = new Date();
const iso = (d) => d.toISOString();
const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);
const hoursFromNow = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);

function run() {
  db.exec('DELETE FROM alerts; DELETE FROM audit_log; DELETE FROM encounters; DELETE FROM shifts; DELETE FROM assignments; DELETE FROM records; DELETE FROM patients; DELETE FROM staff; DELETE FROM wards;');

  // --- Wards ---
  const insertWard = db.prepare('INSERT INTO wards (id, name) VALUES (?, ?)');
  insertWard.run(1, 'Ward A - General');
  insertWard.run(2, 'Ward B - Maternity');
  insertWard.run(3, 'Ward C - ICU');

  // --- Staff ---
  const insertStaff = db.prepare('INSERT INTO staff (id, name, role, active) VALUES (?, ?, ?, ?)');
  insertStaff.run(1, 'System Admin', 'admin', 1);
  insertStaff.run(2, 'Dr. Amaka Obi', 'doctor', 1);
  insertStaff.run(3, 'Nurse Tolu Adeyemi', 'nurse', 1);
  insertStaff.run(4, 'Clerk Ifeoma Nwosu', 'clerk', 1);
  insertStaff.run(5, 'Dr. Musa Bello', 'doctor', 1); // also seeded as a patient below, for case 2
  insertStaff.run(6, 'David Okonkwo', 'clerk', 0);   // departed intern, case 3

  // --- Assignments (staff -> ward) ---
  const insertAssignment = db.prepare('INSERT INTO assignments (staff_id, ward_id) VALUES (?, ?)');
  insertAssignment.run(2, 2); // Dr. Obi -> Ward B
  insertAssignment.run(3, 1); // Nurse Adeyemi -> Ward A
  insertAssignment.run(4, 1); // Clerk Nwosu -> Ward A
  insertAssignment.run(5, 3); // Dr. Bello -> Ward C

  // --- Shifts: everyone (except the departed intern) covers "now" ---
  const insertShift = db.prepare('INSERT INTO shifts (staff_id, start_ts, end_ts) VALUES (?, ?, ?)');
  for (const staffId of [2, 3, 4, 5]) {
    insertShift.run(staffId, iso(hoursAgo(4)), iso(hoursFromNow(4)));
  }
  // Clerk Nwosu also had a shift yesterday, covering the planted probing.
  insertShift.run(4, iso(hoursAgo(28)), iso(hoursAgo(20)));
  // The departed intern's old shift pattern, long expired, kept for realism.
  insertShift.run(6, iso(hoursAgo(400)), iso(hoursAgo(392)));

  // --- Patients ---
  const insertPatient = db.prepare('INSERT INTO patients (id, name, dob, ward_id, admitted, discharged) VALUES (?, ?, ?, ?, ?, ?)');
  insertPatient.run(1, 'Chinedu Okafor', '1991-03-14', 1, iso(hoursAgo(48)), null);
  insertPatient.run(2, 'Blessing Eze', '1996-07-02', 1, iso(hoursAgo(30)), null);
  insertPatient.run(3, 'Ngozi Umeh', '1984-11-20', 2, iso(hoursAgo(20)), null);
  insertPatient.run(4, 'Musa Bello', '1978-05-09', 2, iso(hoursAgo(10)), null); // shares name with staff #5, case 2
  insertPatient.run(5, 'Grace Nnamdi', '2001-01-30', 3, iso(hoursAgo(60)), null);

  // 12 extra Ward A/B patients for the probing pattern in case 1
  const insertRecord = db.prepare('INSERT INTO records (patient_id, category, content) VALUES (?, ?, ?)');
  let nextPatientId = 6;
  const probedPatientIds = [];
  for (let i = 0; i < 12; i++) {
    const wardId = i % 2 === 0 ? 1 : 2;
    insertPatient.run(nextPatientId, `Probe Patient ${i + 1}`, '1990-01-01', wardId, iso(hoursAgo(15)), null);
    insertRecord.run(nextPatientId, 'routine', 'Routine billing information on file.');
    probedPatientIds.push(nextPatientId);
    nextPatientId++;
  }

  // --- Records for the five named patients ---
  insertRecord.run(1, 'routine', 'Admitted for malaria treatment. Vitals stable.');
  insertRecord.run(1, 'sensitive', 'Mild anxiety noted, referred to counseling.');
  insertRecord.run(2, 'routine', 'Admitted for typhoid fever. On ciprofloxacin.');
  insertRecord.run(2, 'sensitive', 'Allergic to penicillin.');
  insertRecord.run(3, 'routine', 'Postpartum recovery, day 3.');
  insertRecord.run(3, 'restricted', 'HIV status: negative.');
  insertRecord.run(4, 'routine', 'Hypertension monitoring, stable.');
  insertRecord.run(4, 'restricted', 'HIV status: positive, on ART. Highly sensitive — colleague of clinical staff.');
  insertRecord.run(5, 'routine', 'ICU observation post-surgery.');
  insertRecord.run(5, 'restricted', 'Do-not-resuscitate order on file, discussed with family.');

  // --- Encounters (treatment relationships) for legitimate access ---
  const insertEncounter = db.prepare('INSERT INTO encounters (staff_id, patient_id, start_ts, end_ts) VALUES (?, ?, ?, ?)');
  insertEncounter.run(2, 3, iso(hoursAgo(20)), null); // Dr. Obi <-> Ngozi Umeh (Ward B)
  insertEncounter.run(2, 4, iso(hoursAgo(10)), null); // Dr. Obi <-> Musa Bello (Ward B)
  insertEncounter.run(3, 1, iso(hoursAgo(48)), null); // Nurse Adeyemi <-> Chinedu Okafor (Ward A)
  insertEncounter.run(3, 2, iso(hoursAgo(30)), null); // Nurse Adeyemi <-> Blessing Eze (Ward A)
  insertEncounter.run(4, 1, iso(hoursAgo(48)), null); // Clerk Nwosu <-> Chinedu Okafor (billing, Ward A)
  insertEncounter.run(5, 5, iso(hoursAgo(60)), null); // Dr. Bello <-> Grace Nnamdi (Ward C)

  // ===================== PLANTED ABUSE CASE 1 =====================
  // Clerk Nwosu (id 4), during yesterday's shift, was correctly denied
  // access to 12 patients she had no encounter with. Each row is a
  // correct DENY. The pattern across all 12 is the abuse signal.
  let seedTime = hoursAgo(24);
  for (const pid of probedPatientIds) {
    appendLog(db, {
      ts: iso(seedTime),
      staff_id: 4,
      patient_id: pid,
      action: 'view',
      decision: 'DENY',
      reason: 'no_treatment_relationship',
      note: null,
    });
    seedTime = new Date(seedTime.getTime() + 3 * 60 * 1000); // 3 minutes apart
  }

  // ===================== PLANTED ABUSE CASE 2 =====================
  // Nurse Adeyemi (id 3, assigned only to Ward A) uses break-glass to
  // open Musa Bello's record (patient id 4, Ward B) — who shares a name
  // with staff #5, a doctor. She is off her normal ward and has no
  // encounter with this patient.
  appendLog(db, {
    ts: iso(hoursAgo(2)),
    staff_id: 3,
    patient_id: 4,
    action: 'break_glass',
    decision: 'BREAK_GLASS',
    reason: 'break_glass',
    note: 'Patient deteriorating, covering for Dr. Obi who is off-site.',
  });

  // ===================== PLANTED ABUSE CASE 3 =====================
  // David Okonkwo (id 6, active = 0) attempts to view a patient record
  // with his old credentials. decide() check 1 fires: staff_inactive.
  appendLog(db, {
    ts: iso(hoursAgo(1)),
    staff_id: 6,
    patient_id: 1,
    action: 'view',
    decision: 'DENY',
    reason: 'staff_inactive',
    note: null,
  });

  console.log('Seed complete.');
  console.log('');
  console.log('Staff IDs for the demo (use these as "Acting as" in the app):');
  console.log('  1  System Admin       (admin)');
  console.log('  2  Dr. Amaka Obi      (doctor, Ward B)');
  console.log('  3  Nurse Tolu Adeyemi (nurse, Ward A)   <- planted case 2');
  console.log('  4  Clerk Ifeoma Nwosu (clerk, Ward A)   <- planted case 1');
  console.log('  5  Dr. Musa Bello     (doctor, Ward C)  <- also patient #4');
  console.log('  6  David Okonkwo      (clerk, INACTIVE)  <- planted case 3');
  console.log('');
  console.log('Patient IDs: 1 Chinedu Okafor (Ward A), 2 Blessing Eze (Ward A),');
  console.log('             3 Ngozi Umeh (Ward B), 4 Musa Bello (Ward B),');
  console.log('             5 Grace Nnamdi (Ward C), 6-17 Probe Patient 1-12');
}

run();
db.close();
