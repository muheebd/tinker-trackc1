import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';
import TimeMachine from './TimeMachine.jsx';

function NavLink({ to, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`text-sm transition ${active ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { currentStaff, setStaffId } = useApp();
  const navigate = useNavigate();

  function switchUser() {
    setStaffId(null);
    navigate('/');
  }

  return (
    <div className="bg-ink">
      <div className="px-6 py-3 flex items-center justify-between border-b border-ink-border">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-brand flex items-center justify-center text-white text-xs font-display font-bold">
            W
          </span>
          <span className="font-display font-semibold text-white tracking-tight">
            WardSentry
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <NavLink to="/">Wards</NavLink>
          <NavLink to="/alerts">Alerts</NavLink>
          <NavLink to="/audit">Audit</NavLink>
          {currentStaff && (
            <span className="text-xs text-white/40 border-l border-ink-border pl-5">
              Acting as <span className="text-white/70">{currentStaff.name}</span>
              <span className="text-white/40"> &middot; {currentStaff.role}{currentStaff.active === 0 ? ', inactive' : ''}</span>
            </span>
          )}
          <button onClick={switchUser} className="text-xs text-white/40 hover:text-white/80 underline">
            Switch
          </button>
        </div>
      </div>
      <TimeMachine />
    </div>
  );
}