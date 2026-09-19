require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { decide } = require('./decide');
const { appendLog, verifyChain } = require('./hashChain');
const { runDetector } = require('./detector');

const app = express();
app.use(cors());
app.use(express.json());

// Every route accepts an optional ?now= ISO timestamp. This is a demo-only
// affordance — it lets the UI simulate "clock advanced past shift end"
// (demo scene 2) without an actual multi-hour wait. Real deployments
// would never accept a client-supplied clock.
function resolveNow(req) {
  const raw = req.query.now || req.body?.now;
  const parsed = raw ? new Date(raw) : new Date();
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function humanExplain(result) {
  const map = {
    staff_inactive: 'This staff account is no longer active.',
    off_shift: 'No shift covers this staff member right now.',
    ward_mismatch: 'This patient is not on a ward this staff member is assigned to.',
    no_treatment_relationship: 'There is no record of this staff member treating this patient.',
    action_not_permitted: "This staff member's role does not permit this action.",
    on_duty_treatment_relationship: 'On shift, on the right ward, with a treatment relationship on file.',
    break_glass: 'Emergency override used. Access granted immediately and logged.',
    break_glass_missing_note: 'Emergency override used without a justification note. Access was still granted, and the row is flagged for review.',
    referral_active: 'Access granted through an active specialist referral to this ward.',
  };
  return map[result.reason] || result.reason;
}

// GET /patients/:id?staff_id=&now=
app.get('/patients/:id', (req, res) => {
  const staffId = Number(req.query.staff_id);
  const patientId = Number(req.params.id);
  const now = resolveNow(req);

  const result = decide(db, { staffId, patientId, action: 'view', now });
  const logRow = appendLog(db, {
    staff_id: staffId,
    patient_id: patientId,
    action: 'view',
    decision: result.outcome,
    reason: result.reason,
    note: null,
  });

  if (result.outcome === 'DENY') {
    return res.status(403).json({
      error: 'Access denied',
      reason: result.reason,
      explanation: humanExplain(result),
      log_id: logRow.id,
    });
  }

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  const records = db.prepare('SELECT * FROM records WHERE patient_id = ?').all(patientId)
    .filter((r) => result.categories.includes(r.category));

  let referringStaffName = null;
  if (result.referral) {
    const referringStaff = db.prepare('SELECT name FROM staff WHERE id = ?').get(result.referral.referring_staff_id);
    referringStaffName = referringStaff ? referringStaff.name : null;
  }

  res.json({
    patient,
    records,
    decision: result.outcome,
    reason: result.reason,
    explanation: humanExplain(result),
    log_id: logRow.id,
    referral: result.referral ? {
      referring_staff_name: referringStaffName,
      expires_at: result.referral.expires_at,
      note: result.referral.note,
    } : null,
  });
});

// POST /break-glass  { staff_id, patient_id, note, category, now? }
// category is "code_blue" or "other" — it is prefixed onto the stored
// note rather than added as a new audit_log column, since the
// contract's audit_log schema is fixed. The detector reads this prefix
// to set alert severity.
app.post('/break-glass', (req, res) => {
  const { staff_id, patient_id, note, category } = req.body;
  const now = resolveNow(req);

  const prefix = category === 'code_blue' ? 'Code Blue: ' : 'Other: ';
  const fullNote = note ? prefix + note : null;

  const result = decide(db, {
    staffId: Number(staff_id),
    patientId: Number(patient_id),
    action: 'break_glass',
    now,
    breakGlass: true,
    note: fullNote,
  });

  const logRow = appendLog(db, {
    staff_id: Number(staff_id),
    patient_id: Number(patient_id),
    action: 'break_glass',
    decision: result.outcome,
    reason: result.reason,
    note: fullNote,
  });

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(patient_id));
  const records = db.prepare('SELECT * FROM records WHERE patient_id = ?').all(Number(patient_id))
    .filter((r) => result.categories.includes(r.category));

  res.json({
    patient,
    records,
    decision: result.outcome,
    reason: result.reason,
    explanation: humanExplain(result),
    log_id: logRow.id,
  });
});

// POST /shift-covers  { covering_staff_id, absent_staff_id, ward_id, now? }
// Validates the absent colleague actually has an active shift right now,
// then grants the covering staff member a REAL shift and ward assignment
// for that window — decide() evaluates her exactly like anyone else on
// duty. No special-cased access path is added.
app.post('/shift-covers', (req, res) => {
  const { covering_staff_id, absent_staff_id, ward_id } = req.body;
  const now = resolveNow(req);
  const nowIso = now.toISOString();

  const absentShift = db.prepare(
    'SELECT * FROM shifts WHERE staff_id = ? AND start_ts <= ? AND end_ts >= ?'
  ).get(Number(absent_staff_id), nowIso, nowIso);

  if (!absentShift) {
    return res.status(400).json({ error: `That colleague has no active shift right now to cover.` });
  }

  const absentAssigned = db.prepare(
    'SELECT 1 FROM assignments WHERE staff_id = ? AND ward_id = ?'
  ).get(Number(absent_staff_id), Number(ward_id));
  if (!absentAssigned) {
    return res.status(400).json({ error: `That colleague is not assigned to this ward.` });
  }

  const coveringHasShift = db.prepare(
    'SELECT * FROM shifts WHERE staff_id = ? AND start_ts <= ? AND end_ts >= ?'
  ).get(Number(covering_staff_id), nowIso, nowIso);
  if (!coveringHasShift) {
    db.prepare('INSERT INTO shifts (staff_id, start_ts, end_ts) VALUES (?, ?, ?)')
      .run(Number(covering_staff_id), absentShift.start_ts, absentShift.end_ts);
  }

  db.prepare('INSERT OR IGNORE INTO assignments (staff_id, ward_id) VALUES (?, ?)')
    .run(Number(covering_staff_id), Number(ward_id));

  // Covering a shift means stepping into that colleague's current duties
  // on this ward — so the covering staff member inherits their open
  // (ongoing) treatment relationships for patients on this ward. This is
  // what makes the cover actually usable, not just technically present
  // on the roster: without this, she'd pass checks 2 and 3 but still be
  // denied at check 4 for every one of the absent colleague's patients.
  const openEncounters = db.prepare(`
    SELECT e.* FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    WHERE e.staff_id = ? AND p.ward_id = ? AND e.end_ts IS NULL
  `).all(Number(absent_staff_id), Number(ward_id));
  const insertEncounter = db.prepare(
    'INSERT INTO encounters (staff_id, patient_id, start_ts, end_ts) VALUES (?, ?, ?, ?)'
  );
  for (const enc of openEncounters) {
    insertEncounter.run(Number(covering_staff_id), enc.patient_id, new Date().toISOString(), null);
  }

  const info = db.prepare(`
    INSERT INTO shift_covers (covering_staff_id, absent_staff_id, ward_id, shift_start, shift_end, created_ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(covering_staff_id), Number(absent_staff_id), Number(ward_id), absentShift.start_ts, absentShift.end_ts, new Date().toISOString());

  const coveringStaff = db.prepare('SELECT name FROM staff WHERE id = ?').get(Number(covering_staff_id));
  const absentStaff = db.prepare('SELECT name FROM staff WHERE id = ?').get(Number(absent_staff_id));
  const ward = db.prepare('SELECT name FROM wards WHERE id = ?').get(Number(ward_id));

  appendLog(db, {
    staff_id: Number(covering_staff_id),
    patient_id: null,
    action: 'shift_cover',
    decision: 'ALLOW',
    reason: 'shift_cover_created',
    note: `${coveringStaff?.name || covering_staff_id} covering for ${absentStaff?.name || absent_staff_id} on ${ward?.name || ward_id}`,
  });

  res.json({ id: info.lastInsertRowid, ok: true });
});

// POST /consult-referrals  { patient_id, referring_staff_id, target_ward_id, note, hours, now? }
// Only a staff member who currently has legitimate access to the patient
// may refer them onward — decide() is called first to confirm this.
app.post('/consult-referrals', (req, res) => {
  const { patient_id, referring_staff_id, target_ward_id, note, hours } = req.body;
  const now = resolveNow(req);

  const decision = decide(db, {
    staffId: Number(referring_staff_id),
    patientId: Number(patient_id),
    action: 'view',
    now,
  });

  if (decision.outcome !== 'ALLOW') {
    return res.status(403).json({ error: 'You need active access to this patient before you can refer them.' });
  }

  const expiresAt = new Date(now.getTime() + (Number(hours) || 48) * 3600 * 1000).toISOString();

  const info = db.prepare(`
    INSERT INTO consult_referrals (patient_id, referring_staff_id, target_ward_id, note, created_ts, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(patient_id), Number(referring_staff_id), Number(target_ward_id), note || null, now.toISOString(), expiresAt);

  const referring = db.prepare('SELECT name FROM staff WHERE id = ?').get(Number(referring_staff_id));
  const ward = db.prepare('SELECT name FROM wards WHERE id = ?').get(Number(target_ward_id));

  appendLog(db, {
    staff_id: Number(referring_staff_id),
    patient_id: Number(patient_id),
    action: 'refer_patient',
    decision: 'ALLOW',
    reason: 'referral_created',
    note: `Referred to ${ward?.name || target_ward_id}${note ? ': ' + note : ''}`,
  });

  res.json({ id: info.lastInsertRowid, expires_at: expiresAt, referring_staff_name: referring?.name });
});

// GET /consult-referrals?patient_id=
app.get('/consult-referrals', (req, res) => {
  const { patient_id } = req.query;
  let rows;
  if (patient_id) {
    rows = db.prepare('SELECT * FROM consult_referrals WHERE patient_id = ? ORDER BY id DESC').all(Number(patient_id));
  } else {
    rows = db.prepare('SELECT * FROM consult_referrals ORDER BY id DESC').all();
  }
  res.json(rows);
});

// GET /audit?staff_id=&patient_id=
app.get('/audit', (req, res) => {
  const { staff_id, patient_id } = req.query;
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (staff_id) { query += ' AND staff_id = ?'; params.push(Number(staff_id)); }
  if (patient_id) { query += ' AND patient_id = ?'; params.push(Number(patient_id)); }
  query += ' ORDER BY id DESC LIMIT 200';

  const rows = db.prepare(query).all(...params);
  const staffMap = Object.fromEntries(db.prepare('SELECT id, name FROM staff').all().map((s) => [s.id, s.name]));
  const patientMap = Object.fromEntries(db.prepare('SELECT id, name FROM patients').all().map((p) => [p.id, p.name]));

  res.json(rows.map((r) => ({
    ...r,
    staff_name: staffMap[r.staff_id] || `#${r.staff_id}`,
    patient_name: r.patient_id ? (patientMap[r.patient_id] || `#${r.patient_id}`) : null,
  })));
});

// GET /verify
app.get('/verify', (req, res) => {
  res.json(verifyChain(db));
});

// GET /alerts?status=open|closed
app.get('/alerts', (req, res) => {
  runDetector(db);
  const status = req.query.status;
  let rows;
  if (status) {
    rows = db.prepare("SELECT * FROM alerts WHERE status = ? ORDER BY (severity = 'high') DESC, id DESC").all(status);
  } else {
    rows = db.prepare("SELECT * FROM alerts ORDER BY (status = 'open') DESC, (severity = 'high') DESC, id DESC").all();
  }
  res.json(rows);
});

// POST /alerts/:id/close  { reviewer_id, outcome }
app.post('/alerts/:id/close', (req, res) => {
  const { reviewer_id, outcome } = req.body;
  db.prepare(
    "UPDATE alerts SET status = 'closed', reviewer_id = ?, outcome = ?, closed_ts = ? WHERE id = ?"
  ).run(reviewer_id, outcome, new Date().toISOString(), Number(req.params.id));
  const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(Number(req.params.id));
  res.json(updated);
});

// GET /staff, /patients, /wards — helper listing endpoints for the
// frontend (not in the contract's route list, but needed for the UI to
// populate pickers without hardcoding IDs).
app.get('/staff', (req, res) => {
  res.json(db.prepare('SELECT id, name, role, active FROM staff ORDER BY id').all());
});
app.get('/patients', (req, res) => {
  res.json(db.prepare('SELECT id, name, ward_id FROM patients ORDER BY id').all());
});
app.get('/wards', (req, res) => {
  res.json(db.prepare('SELECT id, name FROM wards ORDER BY id').all());
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Track C1 backend running on port ${PORT}`));