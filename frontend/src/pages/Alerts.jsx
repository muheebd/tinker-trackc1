import { useEffect, useState } from 'react';
import api from '../api.js';
import { useApp } from '../context.jsx';

const SEVERITY_STYLE = {
  high: 'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
};
const SEVERITY_DOT = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
};

export default function Alerts() {
  const { staffId } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [outcomeDrafts, setOutcomeDrafts] = useState({});

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const res = await api.get('/alerts');
    setAlerts(res.data);
  }

  async function close(id) {
    const outcome = outcomeDrafts[id] || 'Reviewed, no action needed';
    await api.post(`/alerts/${id}/close`, { reviewer_id: staffId, outcome });
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="font-display text-xl font-semibold text-gray-900 mb-1">Supervisor alerts</h2>
      <p className="text-sm text-gray-500 mb-6">
        Patterns and overrides that a single log row can't show on its own.
      </p>
      <div className="grid gap-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`border rounded-xl p-4 ${a.status === 'closed' ? 'bg-gray-50 border-gray-100 opacity-60' : SEVERITY_STYLE[a.severity] || 'bg-paper-card border-gray-100'}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1.5 ${a.status === 'closed' ? 'bg-gray-300' : SEVERITY_DOT[a.severity]}`} />
                <div>
                  <p className="text-xs uppercase tracking-wide font-medium text-gray-500 mb-1">{a.type.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-700">{a.detail}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-white/70 border border-gray-200 text-gray-500 shrink-0">{a.severity}</span>
            </div>
            {a.status === 'closed' ? (
              <p className="text-xs text-gray-500 mt-2 pl-4">Closed &middot; {a.outcome}</p>
            ) : (
              <div className="mt-3 pl-4 flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                  placeholder="Review outcome..."
                  value={outcomeDrafts[a.id] || ''}
                  onChange={(e) => setOutcomeDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                />
                <button onClick={() => close(a.id)} className="text-xs bg-brand hover:bg-brand-dark text-white px-3 py-1 rounded transition">
                  Close
                </button>
              </div>
            )}
          </div>
        ))}
        {alerts.length === 0 && <p className="text-sm text-gray-400">No alerts.</p>}
      </div>
    </div>
  );
}