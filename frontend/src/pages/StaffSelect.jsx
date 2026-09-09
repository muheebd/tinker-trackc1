import { useApp } from '../context.jsx';

export default function StaffSelect() {
  const { staffList, setStaffId } = useApp();

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand mx-auto flex items-center justify-center text-white text-xl font-display font-bold mb-4">
            W
          </div>
          <h1 className="font-display text-2xl font-semibold text-white mb-1">WardSentry</h1>
          <p className="text-sm text-white/40">Access that can't hide.</p>
        </div>

        <div className="bg-ink-card border border-ink-border rounded-2xl p-6">
          <p className="text-xs text-white/40 mb-4">
            No real authentication in this prototype — sessions are simulated.
            Pick who you're acting as.
          </p>
          <div className="grid gap-2">
            {staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => setStaffId(s.id)}
                className="text-left px-4 py-3 rounded-xl border border-ink-border hover:border-brand hover:bg-white/5 transition flex justify-between items-center group"
              >
                <div>
                  <p className="text-sm font-medium text-white/90 group-hover:text-white">{s.name}</p>
                  <p className="text-xs text-white/40">{s.role}</p>
                </div>
                {s.active === 0 && (
                  <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">inactive</span>
                )}
              </button>
            ))}
            {staffList.length === 0 && <p className="text-sm text-white/30">Loading staff...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}