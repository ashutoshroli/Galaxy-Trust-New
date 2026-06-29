import React, { useState } from 'react';
import { apiCall, getUser } from '../api.js';
import { useI18n } from '../i18n.js';

export default function Profile() {
  const { t } = useI18n();
  const user = getUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError(t('profile.mismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('profile.tooShort'));
      return;
    }

    setLoading(true);
    try {
      await apiCall('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setSuccess(t('profile.success'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>{t('profile.title')}</h2>

      <div className="card" style={{ maxWidth: 420 }}>
        <p>
          <strong>{t('profile.username')}:</strong> {user?.username}{' '}
          <span className={`badge ${user?.member_role || user?.role}`}>{t(`role.${user?.member_role || user?.role}`)}</span>
        </p>

        <h3>{t('profile.changePassword')}</h3>
        {error && <div className="error-text">{error}</div>}
        {success && <div className="success-text">{success}</div>}

        <form onSubmit={handleSubmit}>
          <input type="password" placeholder={t('profile.current')} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <input type="password" placeholder={t('profile.new')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <input type="password" placeholder={t('profile.confirm')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>
            {loading ? t('profile.updating') : t('profile.update')}
          </button>
        </form>
      </div>
    </div>
  );
}
