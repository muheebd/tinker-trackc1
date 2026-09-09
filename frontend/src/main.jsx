import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// StrictMode is intentionally left off. It double-invokes effects in
// development to help surface bugs, but here every effect calls a
// stateful API route (view, break-glass), so double-invoking means
// double-writing audit_log rows and double-creating alerts. Fine for
// a pure-render app, wrong for one where every page load writes to a
// tamper-evident log.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);