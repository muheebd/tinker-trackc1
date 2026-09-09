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

  res.json({
    patient,
    records,
    decision: result.outcome,
    reason: result.reason,
    explanation: humanExplain(result),
    log_id: logRow.id,
  });
});

// POST /break-glass  { staff_id, patient_id, note, now? }
app.post('/break-glass', (req, res) => {
  const { staff_id, patient_id, note } = req.body;
  const now = resolveNow(req);

  const result = decide(db, {
    staffId: Number(staff_id),
    patientId: Number(patient_id),
    action: 'break_glass',
    now,
    breakGlass: true,
    note,
  });

  const logRow = appendLog(db, {
    staff_id: Number(staff_id),
    patient_id: Number(patient_id),
    action: 'break_glass',
    decision: result.outcome,
    reason: result.reason,
    note,
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

// GET /staff, /patients — helper listing endpoints for the frontend (not
// in the contract's route list, but needed for the UI to populate
// pickers and ward dashboards without hardcoding IDs).
app.get('/staff', (req, res) => {
  res.json(db.prepare('SELECT id, name, role, active FROM staff ORDER BY id').all());
});
app.get('/patients', (req, res) => {
  res.json(db.prepare('SELECT id, name, ward_id FROM patients ORDER BY id').all());
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Track C1 backend running on port ${PORT}`));
