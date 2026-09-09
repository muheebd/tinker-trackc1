// detector.js — surfaces patterns a single audit_log row can't show on
// its own. Runs on every GET /alerts call and upserts into the alerts
// table so alerts persist and can be closed by a reviewer.

const NO_RELATIONSHIP_THRESHOLD = 10;

function upsertAlert(db, alert) {
  const existing = db.prepare(
    'SELECT id FROM alerts WHERE type = ? AND IFNULL(staff_id,-1) = IFNULL(?,-1) AND IFNULL(audit_log_id,-1) = IFNULL(?,-1)'
  ).get(alert.type, alert.staff_id ?? null, alert.audit_log_id ?? null);
  if (existing) return;

  db.prepare(`
    INSERT INTO alerts (type, staff_id, patient_id, audit_log_id, detail, severity, status, created_ts)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(
    alert.type,
    alert.staff_id ?? null,
    alert.patient_id ?? null,
    alert.audit_log_id ?? null,
    alert.detail,
    alert.severity,
    new Date().toISOString()
  );
}

function runDetector(db) {
  // 1. Every break-glass row becomes an alert. Flags if the staff's
  //    identity also appears as a patient name (staff-as-patient).
  const breakGlassRows = db.prepare(
    "SELECT * FROM audit_log WHERE decision = 'BREAK_GLASS'"
  ).all();
  for (const row of breakGlassRows) {
    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(row.staff_id);
    const patient = row.patient_id ? db.prepare('SELECT * FROM patients WHERE id = ?').get(row.patient_id) : null;
    const staffAsPatient = patient && db.prepare(
      "SELECT 1 FROM staff WHERE name = ? OR name LIKE '%' || ? || '%'"
    ).get(patient.name, patient.name);
    let detail = `${staff ? staff.name : 'Unknown staff'} used break-glass on ${patient ? patient.name : 'an unknown patient'}.`;
    if (staffAsPatient) detail += ' The patient shares a name with a staff member — possible staff-as-patient access.';
    if (row.reason === 'break_glass_missing_note') detail += ' No justification note was recorded.';

    upsertAlert(db, {
      type: 'break_glass',
      staff_id: row.staff_id,
      patient_id: row.patient_id,
      audit_log_id: row.id,
      detail,
      severity: staffAsPatient ? 'high' : 'medium',
    });
  }

  // 2. Any denied attempt by inactive staff — the brief's exact scenario.
  const inactiveAttempts = db.prepare(
    "SELECT * FROM audit_log WHERE reason = 'staff_inactive'"
  ).all();
  for (const row of inactiveAttempts) {
    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(row.staff_id);
    upsertAlert(db, {
      type: 'inactive_staff_attempt',
      staff_id: row.staff_id,
      patient_id: row.patient_id,
      audit_log_id: row.id,
      detail: `${staff ? staff.name : `Staff #${row.staff_id}`} (credentials revoked) attempted access.`,
      severity: 'high',
    });
  }

  // 3. High volume of denied "no treatment relationship" attempts by one
  //    staff member — probing behaviour that each individual row, on its
  //    own, looks like correctly-functioning access control.
  const volumeRows = db.prepare(`
    SELECT staff_id, COUNT(*) as cnt FROM audit_log
    WHERE reason = 'no_treatment_relationship'
    GROUP BY staff_id
    HAVING cnt >= ?
  `).all(NO_RELATIONSHIP_THRESHOLD);
  for (const row of volumeRows) {
    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(row.staff_id);
    upsertAlert(db, {
      type: 'high_volume_no_relationship',
      staff_id: row.staff_id,
      patient_id: null,
      audit_log_id: null,
      detail: `${staff ? staff.name : `Staff #${row.staff_id}`} was denied access to ${row.cnt} patients with no treatment relationship.`,
      severity: 'high',
    });
  }
}

module.exports = { runDetector };
