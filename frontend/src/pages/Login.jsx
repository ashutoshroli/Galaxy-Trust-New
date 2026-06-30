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
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ username, password }),
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

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await apiCall('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfo(data.message || t('login.resetLinkSent'));
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
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={mode === 'login' ? handleLogin : handleForgot}>
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
            <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
            <p style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
              <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
                {t('login.forgotPassword')}
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>{t('login.forgotHint')}</p>
            <input
              type="email"
              placeholder={t('login.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? t('login.sending') : t('login.sendResetLink')}
            </button>
            <p style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                {t('login.backToLogin')}
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
