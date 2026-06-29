import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, setToken, setUser } from '../api.js';
import { useI18n } from '../i18n.js';

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={handleLogin}>
        <div className="login-logo" aria-hidden="true" />
        <h2><span className="gradient-text">{t('app.brand')}</span></h2>
        <p className="subtitle">{t('login.subtitle')}</p>

        {error && <div className="error-text">{error}</div>}

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

        <p className="muted" style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          {t('login.note')}
        </p>
      </form>
    </div>
  );
}
