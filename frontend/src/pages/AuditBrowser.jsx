import { useEffect, useState } from 'react';
import api from '../api.js';

const DECISION_STYLE = {
  ALLOW: 'text-brand',
  BREAK_GLASS: 'text-amber-400',
  DENY: 'text-red-400',
};
const DECISION_LETTER = { ALLOW: 'A', DENY: 'D', BREAK_GLASS: 'B' };
const DECISION_DOT = { ALLOW: 'bg-brand', DENY: 'bg-gray-400', BREAK_GLASS: 'bg-amber-500' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function AuditBrowser() {
  const [logs, setLogs] = useState([]);
  const [chainLogs, setChainLogs] = useState([]);
  const [chainStates, setChainStates] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');

  useEffect(() => { refresh(); loadChain(); }, []);
  useEffect(() => { refresh(); }, [staffFilter]);

  async function refresh() {
    const params = {};
    if (staffFilter) params.staff_id = staffFilter;
    const res = await api.get('/audit', { params });
    setLogs(res.data);
  }

  async function loadChain() {
    const res = await api.get('/audit');
    const chronological = [...res.data].reverse();
    setChainLogs(chronological);
    setChainStates(new Array(chronological.length).fill('idle'));
  }

  async function verify() {
    setVerifying(true);
    setVerifyResult(null);

    const chainRes = await api.get('/audit');
    const chronological = [...chainRes.data].reverse();
    setChainLogs(chronological);
    setChainStates(new Array(chronological.length).fill('idle'));

    const result = await api.get('/verify');
    const brokenId = result.data.first_broken_row;

    for (let i = 0; i < chronological.length; i++) {
      await sleep(65);
      const isBrokenHere = chronological[i].id === brokenId;
      setChainStates((prev) => {
        const next = [...prev];
        next[i] = isBrokenHere ? 'broken' : 'ok';
        return next;
      });
      if (isBrokenHere) break;
    }

    setVerifyResult(result.data);
    setVerifying(false);
  }

  function chipClass(state) {
    if (state === 'ok') return 'border-brand bg-brand-light text-brand-dark scale-105';
    if (state === 'broken') return 'border-red-500 bg-red-50 text-red-600 animate-shakeX scale-105';
    return 'border-ink-border bg-ink-card text-white/30';
  }

  function connectorClass(state) {
    if (state === 'ok') return 'bg-brand';
    if (state === 'broken') return 'bg-red-500';
    return 'bg-ink-border';
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="font-display text-xl font-semibold text-white bg-ink -mx-6 -mt-6 px-6 py-4 rounded-b-2xl mb-2">
        Audit browser
      </h2>

      <div className="bg-ink-card border border-ink-border text-white rounded-xl p-4">
        <p className="font-display font-medium mb-1">Log integrity</p>
        <p className="text-sm text-white/40 mb-4">
          Each entry hashes the one before it. Edit any row directly in the SQLite file, then verify again.
        </p>

        <div className="overflow-x-auto pb-3 -mx-1 px-1">
          <div className="flex items-center min-w-max">
            {chainLogs.map((log, i) => (
              <div key={log.id} className="flex items-center">
                {i > 0 && <div className={`w-4 h-0.5 shrink-0 transition-colors duration-200 ${connectorClass(chainStates[i - 1])}`} />}
                <div
                  className={`relative shrink-0 w-16 h-12 rounded-lg border-2 flex items-center justify-center font-mono text-[10px] transition-all duration-200 ${chipClass(chainStates[i])}`}
                  title={`#${log.id} · ${log.decision} · ${log.reason}`}
                >
                  <span className={`absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-sans font-bold text-white ${DECISION_DOT[log.decision]}`}>
                    {DECISION_LETTER[log.decision]}
                  </span>
                  {log.hash.slice(0, 6)}
                </div>
              </div>
            ))}
            {chainLogs.length === 0 && <p className="text-sm text-white/30">No log entries yet.</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={verify}
            disabled={verifying}
            className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            {verifying ? 'Verifying...' : 'Verify chain'}
          </button>
          <span className="text-xs text-white/30">A = allow &middot; D = deny &middot; B = break-glass</span>
        </div>

        {verifyResult && !verifying && (
          <p className={`mt-3 text-sm ${verifyResult.ok ? 'text-brand' : 'text-red-400'}`}>
            {verifyResult.ok
              ? 'Chain intact from row 1 to the latest entry.'
              : `First broken row: #${verifyResult.first_broken_row} — ${verifyResult.reason}`}
          </p>
        )}
      </div>

      <div className="bg-ink-card border border-ink-border text-white rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-medium">Access log</p>
          <input
            className="bg-white/5 border border-white/10 text-xs rounded px-2 py-1 w-32 text-white/80"
            placeholder="Filter staff_id"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          />
        </div>
        <div className="space-y-1 max-h-[28rem] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex justify-between items-center text-sm border-t border-ink-border py-2">
              <div>
                <span className={`font-medium ${DECISION_STYLE[log.decision]}`}>{log.decision}</span>
                <span className="text-white/40 ml-2">{log.staff_name} &middot; {log.action}{log.patient_name ? ` \u2192 ${log.patient_name}` : ''}</span>
                <p className="text-xs text-white/30">{log.reason}{log.note ? ` — "${log.note}"` : ''}</p>
              </div>
              <span className="font-mono text-xs text-white/30">{log.hash.slice(0, 8)}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-white/30">No log entries.</p>}
        </div>
      </div>
    </div>
  );
}