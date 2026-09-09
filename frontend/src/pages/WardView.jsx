import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function WardView() {
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/patients').then((res) => setPatients(res.data));
  }, []);

  const byWard = patients.reduce((acc, p) => {
    acc[p.ward_id] = acc[p.ward_id] || [];
    acc[p.ward_id].push(p);
    return acc;
  }, {});

  const wardNames = { 1: 'Ward A — General', 2: 'Ward B — Maternity', 3: 'Ward C — ICU' };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="font-display text-xl font-semibold text-gray-900 mb-1">All patients</h2>
      <p className="text-sm text-gray-500 mb-6">
        Every patient is listed here regardless of your assignment — access is enforced when you
        open a record, not by hiding the list. Try opening a patient outside your ward to see how
        that plays out.
      </p>
      {Object.entries(byWard).map(([wardId, list]) => (
        <div key={wardId} className="mb-6">
          <h3 className="text-xs font-medium text-brand-dark uppercase tracking-wide mb-2">
            {wardNames[wardId] || `Ward ${wardId}`}
          </h3>
          <div className="grid gap-2">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/patients/${p.id}`)}
                className="bg-paper-card text-left p-3 rounded-xl border border-gray-100 hover:border-brand hover:shadow-sm transition text-sm text-gray-700"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}