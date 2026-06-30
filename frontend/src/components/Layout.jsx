import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getUser, logout as apiLogout } from '../api.js';
import { getActiveTheme, setTheme, getActiveFontSize, setFontSize, FONT_SIZES } from '../theme.js';
import { useI18n } from '../i18n.js';

const NAV_ITEMS = [
  { to: '/', key: 'nav.dashboard', icon: '🌌', end: true },
  { to: '/search', key: 'nav.search', icon: '🔍' },
  { to: '/feed', key: 'nav.feed', icon: '📣' },
  { to: '/announcements', key: 'nav.announcements', icon: '📢' },
  { to: '/members', key: 'nav.members', icon: '🧑‍🚀' },
  { to: '/contributions', key: 'nav.contributions', icon: '💫' },
  { to: '/expenses', key: 'nav.expenses', icon: '🛰️' },
  { to: '/staff', key: 'nav.staff', icon: '👨‍🔧' },
  { to: '/installments', key: 'nav.installments', icon: '🪐' },
  { to: '/meetings', key: 'nav.meetings', icon: '📡' },
  { to: '/reports', key: 'nav.reports', icon: '📊' },
  { to: '/cashier', key: 'nav.cashier', icon: '👛', superadminOnly: true },
  { to: '/activity', key: 'nav.activity', icon: '🛡️', superadminOnly: true },
  { to: '/permissions', key: 'nav.permissions', icon: '🔐', superadminOnly: true },
  { to: '/profile', key: 'nav.profile', icon: '⚙️' },
];

export default function Layout({ children }) {
  const user = getUser();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState(getActiveTheme());
  const [fontSize, setFontSizeState] = useState(getActiveFontSize());

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
        {NAV_ITEMS.filter((item) => !item.superadminOnly || user?.role === 'superadmin').map((item) => (
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
