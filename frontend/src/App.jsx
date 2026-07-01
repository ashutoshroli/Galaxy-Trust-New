import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { I18nProvider } from './i18n.js';
import { getToken } from './api.js';

// Route-based code-splitting: everything except the login screen is loaded
// on demand, so the first paint (login page) ships a much smaller bundle.
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Members = lazy(() => import('./pages/Members.jsx'));
const Contributions = lazy(() => import('./pages/Contributions.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const Staff = lazy(() => import('./pages/Staff.jsx'));
const Feed = lazy(() => import('./pages/Feed.jsx'));
const Installments = lazy(() => import('./pages/Installments.jsx'));
const Meetings = lazy(() => import('./pages/Meetings.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Permissions = lazy(() => import('./pages/Permissions.jsx'));
const Cashier = lazy(() => import('./pages/Cashier.jsx'));
const Announcements = lazy(() => import('./pages/Announcements.jsx'));
const Activity = lazy(() => import('./pages/Activity.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const SidebarPermissions = lazy(() => import('./pages/SidebarPermissions.jsx'));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>
  );
}

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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </I18nProvider>
  );
}
