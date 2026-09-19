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
  const { staffId, staffList, nowOverride } = useApp();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Break-glass modal state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [category, setCategory] = useState('code_blue');
  const [note, setNote] = useState('');

  // Shift-cover modal state
  const [showCoverForm, setShowCoverForm] = useState(false);
  const [absentStaffId, setAbsentStaffId] = useState('');
  const [coverWardId, setCoverWardId] = useState('');
  const [wards, setWards] = useState([]);
  const [coverError, setCoverError] = useState('');

  // Referral modal state
  const [showReferForm, setShowReferForm] = useState(false);
  const [referWardId, setReferWardId] = useState('');
  const [referHours, setReferHours] = useState('48');
  const [referNote, setReferNote] = useState('');
  const [referConfirmation, setReferConfirmation] = useState(null);

  useEffect(() => {
    load();
    setShowOverrideForm(false);
    setShowCoverForm(false);
    setShowReferForm(false);
    setReferConfirmation(null);
  }, [id, staffId, nowOverride]);

  useEffect(() => {
    api.get('/wards').then((res) => setWards(res.data));
  }, []);

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
    const body = { staff_id: staffId, patient_id: Number(id), note, category };
    if (nowOverride) body.now = nowOverride;
    const res = await api.post('/break-glass', body);
    setResult(res.data);
    setError(null);
    setShowOverrideForm(false);
  }

  async function submitShiftCover() {
    setCoverError('');
    const body = { covering_staff_id: staffId, absent_staff_id: Number(absentStaffId), ward_id: Number(coverWardId) };
    if (nowOverride) body.now = nowOverride;
    try {
      await api.post('/shift-covers', body);
      setShowCoverForm(false);
      load();
    } catch (err) {
      setCoverError(err.response?.data?.error || 'Could not set up that cover.');
    }
  }

  async function submitReferral() {
    const body = {
      patient_id: Number(id),
      referring_staff_id: staffId,
      target_ward_id: Number(referWardId),
      note: referNote,
      hours: Number(referHours),
    };
    if (nowOverride) body.now = nowOverride;
    const res = await api.post('/consult-referrals', body);
    setReferConfirmation(res.data);
    setShowReferForm(false);
  }

  const otherStaff = staffList.filter((s) => s.id !== staffId && s.active === 1);

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

          <div className="flex flex-wrap gap-2 mb-2">
            {!showOverrideForm && !showCoverForm && (
              <>
                <button
                  onClick={() => setShowOverrideForm(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Use emergency override
                </button>
                <button
                  onClick={() => setShowCoverForm(true)}
                  className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  I'm covering a colleague's shift
                </button>
              </>
            )}
          </div>

          {showOverrideForm && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Situation</label>
              <select
                className="w-full border border-amber-200 rounded-lg p-2 text-sm mb-2 bg-white"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="code_blue">Critical medical emergency (Code Blue)</option>
                <option value="other">Other urgent need</option>
              </select>

              {category === 'code_blue' && (
                <p className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg p-2 mb-2">
                  Code Blue access is permanently logged to the tamper-evident audit trail
                  and is flagged for immediate Chief Medical Officer review.
                </p>
              )}

              <textarea
                className="w-full border border-amber-200 rounded-lg p-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="Why do you need emergency access? This is required and logged."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={submitBreakGlass} className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-3 py-1.5 rounded-lg transition">
                  Confirm override
                </button>
                <button onClick={() => setShowOverrideForm(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showCoverForm && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Who are you covering for?</label>
              <select
                className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2 bg-white"
                value={absentStaffId}
                onChange={(e) => setAbsentStaffId(e.target.value)}
              >
                <option value="">Select a colleague...</option>
                {otherStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
              <label className="block text-xs font-medium text-gray-600 mb-1">Which ward?</label>
              <select
                className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2 bg-white"
                value={coverWardId}
                onChange={(e) => setCoverWardId(e.target.value)}
              >
                <option value="">Select a ward...</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {coverError && <p className="text-xs text-red-600 mb-2">{coverError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={submitShiftCover}
                  disabled={!absentStaffId || !coverWardId}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg transition"
                >
                  Confirm I'm covering
                </button>
                <button onClick={() => setShowCoverForm(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!result) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  const { patient, records, decision, explanation, referral } = result;

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

      {decision === 'ALLOW' && result.reason === 'referral_active' && (
        <div className="bg-brand-light border-l-4 border-brand rounded-r-xl rounded-l-sm p-4 mb-4">
          <p className="text-sm font-display font-semibold text-brand-dark mb-1">Access via specialist referral</p>
          <p className="text-sm text-brand-dark">
            Referred by {referral?.referring_staff_name || 'a colleague'}, expires {referral ? new Date(referral.expires_at).toLocaleString() : ''}.
            {referral?.note && ` "${referral.note}"`}
          </p>
        </div>
      )}

      {decision === 'ALLOW' && result.reason !== 'referral_active' && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-brand-dark">
            <span className="w-2 h-2 rounded-full bg-brand" />
            {explanation}
          </div>
          {!showReferForm && !referConfirmation && (
            <button
              onClick={() => setShowReferForm(true)}
              className="text-xs bg-white border border-brand text-brand-dark px-3 py-1 rounded-lg hover:bg-brand-light transition"
            >
              Refer to specialist
            </button>
          )}
        </div>
      )}

      {showReferForm && (
        <div className="bg-paper-card border border-gray-100 rounded-xl p-4 mb-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-2">Refer this patient</p>
          <label className="block text-xs text-gray-500 mb-1">Target department</label>
          <select
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2"
            value={referWardId}
            onChange={(e) => setReferWardId(e.target.value)}
          >
            <option value="">Select a ward...</option>
            {wards.filter((w) => w.id !== patient.ward_id).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <label className="block text-xs text-gray-500 mb-1">Access valid for</label>
          <select
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2"
            value={referHours}
            onChange={(e) => setReferHours(e.target.value)}
          >
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="72">72 hours</option>
          </select>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2"
            placeholder="Reason for referral"
            value={referNote}
            onChange={(e) => setReferNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={submitReferral}
              disabled={!referWardId}
              className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition"
            >
              Send referral
            </button>
            <button onClick={() => setShowReferForm(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {referConfirmation && (
        <div className="bg-brand-light border border-brand rounded-xl p-3 mb-4 text-sm text-brand-dark">
          Referred to {wards.find((w) => w.id === Number(referWardId))?.name || 'the selected ward'},
          {' '}access expires {new Date(referConfirmation.expires_at).toLocaleString()}.
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