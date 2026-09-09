import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context.jsx';
import Navbar from './components/Navbar.jsx';
import StaffSelect from './pages/StaffSelect.jsx';
import WardView from './pages/WardView.jsx';
import PatientRecord from './pages/PatientRecord.jsx';
import Alerts from './pages/Alerts.jsx';
import AuditBrowser from './pages/AuditBrowser.jsx';

function Shell() {
  const { staffId, currentStaff } = useApp();

  if (!staffId) {
    return <StaffSelect />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <Routes>
        <Route path="/" element={<WardView />} />
        <Route path="/patients/:id" element={<PatientRecord />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/audit" element={<AuditBrowser />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {!currentStaff && <p className="text-center text-xs text-gray-400 py-2">Loading staff profile...</p>}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}