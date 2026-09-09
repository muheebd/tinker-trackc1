import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api.js';
import { useApp } from '../context.jsx';

const CATEGORY_STYLE = {
  routine: 'bg-gray-100 text-gray-600',
  sensitive: 'bg-amber-100 text-amber-700',
  restricted: 'bg-red-100 text-red-700',
};

export default function PatientRecord() {
  const { id } = useParams();
  const { staffId, nowOverride } = useApp();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  useEffect(() => {
    load();
    setShowOverrideForm(false);
  }, [id, staffId, nowOverride]);

  async function load() {
    setError(null);
    setResult(null);
    try {
      const params = { staff_id: staffId };
      if (nowOverride) params.now = nowOverride;
      const res = await api.get(`/patients/${id}`, { params });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data || { explanation: 'Something went wrong.' });
    }
  }

  async function submitBreakGlass() {
    const body = { staff_id: staffId, patient_id: Number(id), note };
    if (nowOverride) body.now = nowOverride;
    const res = await api.post('/break-glass', body);
    setResult(res.data);
    setError(null);
    setShowOverrideForm(false);
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-paper-card border-l-4 border-red-500 rounded-r-xl rounded-l-sm shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <p className="font-display font-semibold text-red-600">Access denied</p>
            <span className="text-xs font-mono text-red-400 bg-red-50 px-1.5 py-0.5 rounded">{error.reason}</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error.explanation}</p>

          {!showOverrideForm ? (
            <button
              onClick={() => setShowOverrideForm(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Use emergency override
            </button>
          ) : (
            <div>
              <textarea
                className="w-full border border-amber-200 rounded-lg p-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="Why do you need emergency access? This is required and logged."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button onClick={submitBreakGlass} className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-3 py-1.5 rounded-lg transition">
                Confirm override
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!result) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  const { patient, records, decision, explanation } = result;

  return (
    <div className="max-w-xl mx-auto p-6">
      {decision === 'BREAK_GLASS' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl rounded-l-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-sm font-display font-semibold text-amber-700">Emergency override active</p>
          </div>
          <p className="text-sm text-amber-600">{explanation}</p>
        </div>
      )}

      {decision === 'ALLOW' && (
        <div className="flex items-center gap-2 mb-4 text-sm text-brand-dark">
          <span className="w-2 h-2 rounded-full bg-brand" />
          {explanation}
        </div>
      )}

      <div className="bg-paper-card rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-display text-lg font-semibold text-gray-900">{patient.name}</h2>
        <p className="text-sm text-gray-500 mb-4">DOB {patient.dob}</p>
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="border-b border-gray-50 pb-2">
              <span className={`text-xs px-2 py-0.5 rounded mr-2 font-medium ${CATEGORY_STYLE[r.category]}`}>{r.category}</span>
              <span className="text-sm text-gray-700">{r.content}</span>
            </div>
          ))}
          {records.length === 0 && <p className="text-sm text-gray-400">No records visible at your access level.</p>}
        </div>
      </div>
    </div>
  );
}