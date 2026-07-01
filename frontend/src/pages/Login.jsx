import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, setToken, setUser } from '../api.js';
import { useI18n } from '../i18n.js';

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState(null); // { name, username } once email is confirmed
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, remember }),
      });
      setToken(data.token);
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 1: confirm which account the identifier (username / mobile / email) belongs to
  async function handleLookup(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/forgot-password/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: email }),
      });
      setLookup(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: actually send the reset link
  async function handleSendLink(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: email }),
      });
      setInfo(data.message || t('login.resetLinkSent'));
      setLookup(null);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
    setLookup(null);
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={mode === 'login' ? handleLogin : (lookup ? handleSendLink : handleLookup)}>
        <div className="login-logo" aria-hidden="true" />
        <h2><span className="gradient-text">{t('app.brand')}</span></h2>
        <p className="subtitle">{mode === 'login' ? t('login.subtitle') : t('login.forgotTitle')}</p>

        {error && <div className="error-text">{error}</div>}
        {info && <div className="success-text">{info}</div>}

        {mode === 'login' ? (
          <>
            <input
              placeholder={t('login.identifier')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <input
              type="password"
              placeholder={t('login.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="remember-me-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>{t('login.rememberMe')}</span>
            </label>
            <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
            <p style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
              <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
                {t('login.forgotPassword')}
              </button>
            </p>
          </>
        ) : !lookup ? (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>{t('login.forgotHint')}</p>
            <input
              type="text"
              placeholder={t('login.forgotIdentifier')}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              autoFocus
            />
            <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? t('login.searching') : t('login.findAccount')}
            </button>
            <p style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                {t('login.backToLogin')}
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="account-confirm">
              <span className="muted" style={{ fontSize: 13 }}>{t('login.accountFound')}</span>
              <strong style={{ fontSize: 18 }}>{lookup.name}</strong>
              <span className="muted" style={{ fontSize: 13 }}>@{lookup.username}</span>
            </div>
            {lookup.hasEmail ? (
              <>
                <p className="muted" style={{ fontSize: 13 }}>
                  {t('login.linkWillBeSentTo')} <strong>{lookup.maskedEmail}</strong>
                </p>
                <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
                  {loading ? t('login.sending') : t('login.sendResetLink')}
                </button>
              </>
            ) : (
              <p className="error-text" style={{ marginTop: 4 }}>{t('login.noEmailOnFile')}</p>
            )}
            <p style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
              <button type="button" className="link-btn" onClick={() => { setLookup(null); setError(''); }}>
                {t('login.useDifferentAccount')}
              </button>
            </p>
          </>
        )}

        <p className="muted" style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          {t('login.note')}
        </p>
      </form>
    </div>
  );
}
