// decide() — the access engine. One pure function, checked in order,
// first failure short-circuits to DENY. See BUILD_CONTRACT.md for the
// reason-code table this must match exactly.

const CATEGORIES_BY_ROLE = {
  doctor: ['routine', 'sensitive', 'restricted'],
  nurse: ['routine', 'sensitive'],
  clerk: ['routine'],
  admin: ['routine'], // admin can browse audit/alerts, not clinical categories
};

const ACTIONS_BY_ROLE = {
  doctor: ['view', 'search', 'edit'],
  nurse: ['view', 'search', 'edit'],
  clerk: ['view', 'search'],
  admin: ['search'],
};

function decide(db, { staffId, patientId, action, now, breakGlass = false, note = null }) {
  const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);

  // Break-glass overrides checks 2-5. It never returns DENY. A missing
  // note is a client bug, not a reason to block — the row is written
  // and flagged instead.
  if (breakGlass) {
    const reason = note && note.trim() ? 'break_glass' : 'break_glass_missing_note';
    return { outcome: 'BREAK_GLASS', reason, categories: ['routine', 'sensitive', 'restricted'] };
  }

  // Check 1: staff exists and is active
  if (!staff || staff.active !== 1) {
    return { outcome: 'DENY', reason: 'staff_inactive', categories: [] };
  }

  // Check 2: a shift covers now
  const nowIso = now.toISOString();
  const activeShift = db.prepare(
    'SELECT * FROM shifts WHERE staff_id = ? AND start_ts <= ? AND end_ts >= ?'
  ).get(staffId, nowIso, nowIso);
  if (!activeShift) {
    return { outcome: 'DENY', reason: 'off_shift', categories: [] };
  }

  // Check 3: patient is admitted to a ward in the caller's assignments
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  if (!patient || !patient.ward_id || patient.discharged) {
    return { outcome: 'DENY', reason: 'ward_mismatch', categories: [] };
  }
  const assigned = db.prepare(
    'SELECT 1 FROM assignments WHERE staff_id = ? AND ward_id = ?'
  ).get(staffId, patient.ward_id);
  if (!assigned) {
    return { outcome: 'DENY', reason: 'ward_mismatch', categories: [] };
  }

  // Check 4: an open or recent encounter links the pair
  const encounter = db.prepare(
    'SELECT * FROM encounters WHERE staff_id = ? AND patient_id = ? ORDER BY start_ts DESC LIMIT 1'
  ).get(staffId, patientId);
  if (!encounter) {
    return { outcome: 'DENY', reason: 'no_treatment_relationship', categories: [] };
  }

  // Check 5: role permits the action
  const allowedActions = ACTIONS_BY_ROLE[staff.role] || [];
  if (!allowedActions.includes(action)) {
    return { outcome: 'DENY', reason: 'action_not_permitted', categories: [] };
  }

  return {
    outcome: 'ALLOW',
    reason: 'on_duty_treatment_relationship',
    categories: CATEGORIES_BY_ROLE[staff.role] || ['routine'],
  };
}

module.exports = { decide, CATEGORIES_BY_ROLE, ACTIONS_BY_ROLE };
