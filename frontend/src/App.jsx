import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import Contributions from './pages/Contributions.jsx';
import Expenses from './pages/Expenses.jsx';
import Staff from './pages/Staff.jsx';
import Feed from './pages/Feed.jsx';
import Installments from './pages/Installments.jsx';
import Meetings from './pages/Meetings.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import Permissions from './pages/Permissions.jsx';
import Cashier from './pages/Cashier.jsx';
import Announcements from './pages/Announcements.jsx';
import Activity from './pages/Activity.jsx';
import Search from './pages/Search.jsx';
import SidebarPermissions from './pages/SidebarPermissions.jsx';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { I18nProvider } from './i18n.js';
import { getToken } from './api.js';

function Protected({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
      <BrowserRouter>
        <div className="starfield" aria-hidden="true" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/feed" element={<Protected><Feed /></Protected>} />
          <Route path="/members" element={<Protected><Members /></Protected>} />
          <Route path="/contributions" element={<Protected><Contributions /></Protected>} />
          <Route path="/expenses" element={<Protected><Expenses /></Protected>} />
          <Route path="/staff" element={<Protected><Staff /></Protected>} />
          <Route path="/installments" element={<Protected><Installments /></Protected>} />
          <Route path="/meetings" element={<Protected><Meetings /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/permissions" element={<Protected><Permissions /></Protected>} />
          <Route path="/cashier" element={<Protected><Cashier /></Protected>} />
          <Route path="/announcements" element={<Protected><Announcements /></Protected>} />
          <Route path="/activity" element={<Protected><Activity /></Protected>} />
          <Route path="/search" element={<Protected><Search /></Protected>} />
          <Route path="/sidebar-permissions" element={<Protected><SidebarPermissions /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </I18nProvider>
  );
}
