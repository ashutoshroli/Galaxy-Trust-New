import React, { useEffect, useState } from 'react';
import { apiCall, getUser } from '../api.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import PhotoPicker from '../components/PhotoPicker.jsx';

export default function Profile() {
  const { t } = useI18n();
  const toast = useToast();
  const user = getUser();

  // ---- Personal details ----
  const [profile, setProfile] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [details, setDetails] = useState({ name: '', relation_name: '', phone: '', email: '', address: '', dob: '', photo: '' });
  const [savingDetails, setSavingDetails] = useState(false);

  // ---- Password ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiCall('/members/me')
      .then((m) => {
        if (m) {
          setHasProfile(true);
          setProfile(m);
          setDetails({
            name: m.name || '',
            relation_name: m.relation_name || '',
            phone: m.phone || '',
            email: m.email || '',
            address: m.address || '',
            dob: m.dob ? m.dob.slice(0, 10) : '',
            photo: m.photo || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error(t('members.imageOnly'));
    try {
      const dataUrl = await resizeImage(file);
      setDetails((d) => ({ ...d, photo: dataUrl }));
    } catch {
      toast.error(t('members.imageError'));
    }
  }

  async function saveDetails(e) {
    e.preventDefault();
    if (!details.name.trim()) return toast.error(t('field.name'));
    if (savingDetails) return;
    setSavingDetails(true);
    try {
      const updated = await apiCall('/members/me', { method: 'PUT', body: JSON.stringify(details) });
      setProfile(updated);
      toast.success(t('profile.detailsUpdated'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) return setError(t('profile.mismatch'));
    if (newPassword.length < 8) return setError(t('profile.tooShort'));

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

      <div className="card" style={{ maxWidth: 480 }}>
        <p>
          <strong>{t('profile.username')}:</strong> {user?.username}{' '}
          <span className={`badge ${user?.member_role || user?.role}`}>{t(`role.${user?.member_role || user?.role}`)}</span>
        </p>
      </div>

      {/* Personal details — only when the account is linked to a member */}
      {hasProfile && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h3>{t('profile.personalDetails')}</h3>
          <form onSubmit={saveDetails}>
            <PhotoPicker value={details.photo} onChange={(p) => setDetails({ ...details, photo: p })} />

            <input placeholder={t('field.name')} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} required />
            <input placeholder={t('field.relation')} value={details.relation_name} onChange={(e) => setDetails({ ...details, relation_name: e.target.value })} />
            <input placeholder={t('field.phone')} value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
            <input type="email" placeholder={t('field.email')} value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} />
            <input placeholder={t('field.address')} value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
            <label className="muted" style={{ fontSize: 13 }}>{t('members.dob')}</label>
            <input type="date" value={details.dob} onChange={(e) => setDetails({ ...details, dob: e.target.value })} />
            <button type="submit" disabled={savingDetails}>{savingDetails ? t('profile.updating') : t('profile.saveDetails')}</button>
          </form>
        </div>
      )}

      <div className="card" style={{ maxWidth: 480 }}>
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
