const crypto = require('crypto');
const GENESIS = '0'.repeat(64);

// Deterministic string form of a row, used on both write and verify.
// Order and fields must never change without a migration note.
function canonical(row) {
  return [
    row.ts,
    row.staff_id,
    row.patient_id ?? '',
    row.action,
    row.decision,
    row.reason,
    row.note ?? '',
  ].join('|');
}

function computeHash(prevHash, row) {
  return crypto.createHash('sha256').update(prevHash + canonical(row)).digest('hex');
}

// Writes exactly one audit_log row. Called for every decide() outcome,
// including DENY and errors, per the contract.
function appendLog(db, entry) {
  const last = db.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1').get();
  const prevHash = last ? last.hash : GENESIS;
  const ts = entry.ts || new Date().toISOString();

  const rowForHash = {
    ts,
    staff_id: entry.staff_id,
    patient_id: entry.patient_id ?? null,
    action: entry.action,
    decision: entry.decision,
    reason: entry.reason,
    note: entry.note ?? null,
  };
  const hash = computeHash(prevHash, rowForHash);

  const info = db.prepare(`
    INSERT INTO audit_log (ts, staff_id, patient_id, action, decision, reason, note, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rowForHash.ts,
    rowForHash.staff_id,
    rowForHash.patient_id,
    rowForHash.action,
    rowForHash.decision,
    rowForHash.reason,
    rowForHash.note,
    prevHash,
    hash
  );

  return { id: info.lastInsertRowid, ...rowForHash, prev_hash: prevHash, hash };
}

// Walks the chain from row 1, returns {ok, first_broken_row}.
function verifyChain(db) {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id ASC').all();
  let prevHash = GENESIS;
  for (const row of rows) {
    if (row.prev_hash !== prevHash) {
      return { ok: false, first_broken_row: row.id, reason: 'prev_hash does not match the previous row (a row was inserted, deleted, or reordered)' };
    }
    const recomputed = computeHash(prevHash, row);
    if (recomputed !== row.hash) {
      return { ok: false, first_broken_row: row.id, reason: 'hash does not match row content (a field in this row was edited)' };
    }
    prevHash = row.hash;
  }
  return { ok: true, first_broken_row: null };
}

module.exports = { appendLog, verifyChain, computeHash, canonical, GENESIS };
