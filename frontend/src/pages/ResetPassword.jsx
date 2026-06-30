import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../api.js';
import { useI18n } from '../i18n.js';

export default function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError(t('profile.mismatch'));
    if (newPassword.length < 8) return setError(t('profile.tooShort'));

    setLoading(true);
    try {
      const data = await apiCall('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setSuccess(data.message || t('login.resetSuccess'));
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={handleSubmit}>
        <div className="login-logo" aria-hidden="true" />
        <h2><span className="gradient-text">{t('app.brand')}</span></h2>
        <p className="subtitle">{t('login.resetTitle')}</p>

        {error && <div className="error-text">{error}</div>}
        {success && <div className="success-text">{success}</div>}

        {!token ? (
          <p className="muted" style={{ textAlign: 'center' }}>{t('login.resetInvalid')}</p>
        ) : (
          !success && (
            <>
              <input
                type="password"
                placeholder={t('login.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              <input
                type="password"
                placeholder={t('profile.confirm')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
                {loading ? t('login.resetting') : t('login.resetPassword')}
              </button>
            </>
          )
        )}

        <p style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            {t('login.backToLogin')}
          </button>
        </p>
      </form>
    </div>
  );
}
