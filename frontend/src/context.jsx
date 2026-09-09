import { createContext, useContext, useState, useEffect } from 'react';
import api from './api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [staffList, setStaffList] = useState([]);
  const [staffId, setStaffId] = useState(() => {
    const stored = localStorage.getItem('staffId');
    return stored ? Number(stored) : null;
  });
  // nowOverride: an ISO string used for demoing "clock advanced past shift
  // end" (build contract demo scene 2), or null to use the real clock.
  const [nowOverride, setNowOverride] = useState(null);

  useEffect(() => {
    api.get('/staff').then((res) => setStaffList(res.data));
  }, []);

  useEffect(() => {
    if (staffId) localStorage.setItem('staffId', String(staffId));
    else localStorage.removeItem('staffId');
  }, [staffId]);

  const currentStaff = staffList.find((s) => s.id === staffId) || null;

  return (
    <AppContext.Provider value={{ staffList, staffId, setStaffId, currentStaff, nowOverride, setNowOverride }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
