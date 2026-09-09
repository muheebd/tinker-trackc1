import { useState } from 'react';
import { useApp } from '../context.jsx';

// Demo-only control: lets a presenter simulate "clock advanced past shift
// end" (build contract demo scene 2) without an actual multi-hour wait.
export default function TimeMachine() {
  const { nowOverride, setNowOverride } = useApp();
  const [draft, setDraft] = useState('');

  function apply() {
    if (!draft) return;
    setNowOverride(new Date(draft).toISOString());
  }

  function reset() {
    setNowOverride(null);
    setDraft('');
  }

  function jumpHours(h) {
    const base = nowOverride ? new Date(nowOverride) : new Date();
    const next = new Date(base.getTime() + h * 3600 * 1000);
    setNowOverride(next.toISOString());
  }

  const isOverridden = Boolean(nowOverride);

  return (
    <div
      className={`px-6 py-1.5 flex items-center gap-3 text-xs border-b border-ink-border ${
        isOverridden ? 'bg-amber-500/10 text-amber-300' : 'bg-black/20 text-white/40'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOverridden ? 'bg-amber-400' : 'bg-white/30'}`} />
      <span className="font-medium">Demo clock</span>
      <span>{isOverridden ? new Date(nowOverride).toLocaleString() : 'Live (real time)'}</span>
      <button onClick={() => jumpHours(12)} className="underline decoration-dotted hover:text-white">+12h</button>
      <button onClick={() => jumpHours(24)} className="underline decoration-dotted hover:text-white">+24h</button>
      <input
        type="datetime-local"
        className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/80"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button onClick={apply} className="underline decoration-dotted hover:text-white">Set</button>
      {isOverridden && (
        <button onClick={reset} className="text-brand-light font-medium hover:text-white ml-auto">
          Reset to live
        </button>
      )}
    </div>
  );
}