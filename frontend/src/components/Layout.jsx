import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiCall, getUser, logout as apiLogout } from '../api.js';
import { getActiveTheme, setTheme, getActiveFontSize, setFontSize, FONT_SIZES } from '../theme.js';
import { useI18n } from '../i18n.js';
import NotificationBell from './NotificationBell.jsx';

const NAV_ITEMS = [
  { to: '/', id: 'dashboard', key: 'nav.dashboard', icon: '🌌', end: true },
  { to: '/search', id: 'search', key: 'nav.search', icon: '🔍' },
  { to: '/feed', id: 'feed', key: 'nav.feed', icon: '📣' },
  { to: '/announcements', id: 'announcements', key: 'nav.announcements', icon: '📢' },
  { to: '/members', id: 'members', key: 'nav.members', icon: '🧑‍🚀' },
  { to: '/contributions', id: 'contributions', key: 'nav.contributions', icon: '💫' },
  { to: '/expenses', id: 'expenses', key: 'nav.expenses', icon: '🛰️' },
  { to: '/staff', id: 'staff', key: 'nav.staff', icon: '👨‍🔧' },
  { to: '/installments', id: 'installments', key: 'nav.installments', icon: '🪐' },
  { to: '/meetings', id: 'meetings', key: 'nav.meetings', icon: '📡' },
  { to: '/reports', id: 'reports', key: 'nav.reports', icon: '📊' },
  { to: '/cashier', id: 'cashier', key: 'nav.cashier', icon: '👛', superadminOnly: true },
  { to: '/activity', id: 'activity', key: 'nav.activity', icon: '🛡️', superadminOnly: true },
  { to: '/permissions', id: 'permissions', key: 'nav.permissions', icon: '🔐', superadminOnly: true },
  { to: '/sidebar-permissions', id: 'sidebarPerms', key: 'nav.sidebarPerms', icon: '🧭', superadminOnly: true },
  { to: '/profile', id: 'profile', key: 'nav.profile', icon: '⚙️' },
];

export default function Layout({ children }) {
  const user = getUser();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState(getActiveTheme());
  const [fontSize, setFontSizeState] = useState(getActiveFontSize());
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    apiCall('/nav-permissions/mine').then((d) => setAllowed(d.allowed)).catch(() => setAllowed(null));
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  function changeFont(delta) {
    const idx = FONT_SIZES.indexOf(fontSize);
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, idx + delta))];
    setFontSize(next);
    setFontSizeState(next);
  }

  function toggleLang() {
    setLang(lang === 'en' ? 'hi' : 'en');
  }

  async function logout() {
    await apiLogout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <h2>
          <span className="brand-logo" aria-hidden="true" />
          {t('app.brand')}
        </h2>
        {NAV_ITEMS.filter((item) => {
          if (item.superadminOnly) return user?.role === 'superadmin';
          if (user?.role === 'superadmin') return true;
          if (!allowed) return true; // fail-open while loading or on error
          return allowed.includes(item.id);
        }).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="main">
        <div className="topbar">
          <button className="menu-toggle print-btn icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">☰</button>

          <div className="user-meta">
            <strong>{user?.username}</strong>
            <span className={`badge ${user?.member_role || user?.role}`}>{t(`role.${user?.member_role || user?.role}`)}</span>
          </div>

          <div className="topbar-controls">
            <NotificationBell />
            <button className="print-btn icon-btn" onClick={() => changeFont(-1)} disabled={fontSize === 'sm'} title="Decrease text size" aria-label="Decrease text size" style={{ fontSize: 13 }}>A−</button>
            <button className="print-btn icon-btn" onClick={() => changeFont(1)} disabled={fontSize === 'lg'} title="Increase text size" aria-label="Increase text size" style={{ fontSize: 17 }}>A+</button>
            <button className="print-btn icon-btn" onClick={toggleLang} title="Language" aria-label="Language">{lang === 'en' ? 'EN' : 'हिं'}</button>
            <button className="print-btn icon-btn" onClick={toggleTheme} title="Theme" aria-label="Theme">{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={logout}>{t('action.logout')}</button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
