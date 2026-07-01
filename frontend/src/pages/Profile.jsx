import React, { useEffect, useState } from 'react';
import { apiCall, getUser, setToken, setUser as saveUser, clearToken } from '../api.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import PhotoPicker from '../components/PhotoPicker.jsx';

export default function Profile() {
  const { t } = useI18n();
  const toast = useToast();
  const [user, setUserState] = useState(getUser());

  // ---- Account (username + email) ----
  const [account, setAccount] = useState({ username: '', email: '' });
  const [savingAccount, setSavingAccount] = useState(false);

  // ---- Personal details ----
  const [profile, setProfile] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [details, setDetails] = useState({ name: '', relation_name: '', phone: '', email: '', address: '', dob: '', photo: '' });
  const [savingDetails, setSavingDetails] = useState(false);

  // ---- Active sessions ----
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingBulk, setRevokingBulk] = useState(false);

  // ---- Password ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiCall('/auth/account')
      .then((a) => setAccount({ username: a.username || '', email: a.email || '' }))
      .catch(() => {});
  }, []);

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

  function loadSessions() {
    setSessionsLoading(true);
    apiCall('/auth/sessions')
      .then(setSessions)
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }
  useEffect(loadSessions, []);

  async function revokeOne(id) {
    if (revokingId) return;
    setRevokingId(id);
    try {
      await apiCall(`/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success(t('profile.sessionRevoked'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeOthers() {
    if (revokingBulk || !window.confirm(t('profile.revokeOthersConfirm'))) return;
    setRevokingBulk(true);
    try {
      const r = await apiCall('/auth/sessions/revoke-others', { method: 'POST' });
      toast.success(t('profile.sessionsRevokedCount', { n: r.revoked || 0 }));
      loadSessions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRevokingBulk(false);
    }
  }

  async function revokeAll() {
    if (revokingBulk || !window.confirm(t('profile.revokeAllConfirm'))) return;
    setRevokingBulk(true);
    try {
      await apiCall('/auth/sessions/revoke-all', { method: 'POST' });
      toast.success(t('profile.signedOutEverywhere'));
      clearToken();
      window.location.href = '/login';
    } catch (err) {
      toast.error(err.message);
      setRevokingBulk(false);
    }
  }

  async function saveAccount(e) {
    e.preventDefault();
    if (!account.username.trim()) return toast.error(t('profile.username'));
    if (savingAccount) return;
    setSavingAccount(true);
    try {
      const res = await apiCall('/auth/account', {
        method: 'PUT',
        body: JSON.stringify({ username: account.username.trim(), email: account.email.trim() }),
      });
      if (res.token) setToken(res.token);
      if (res.user) {
        saveUser(res.user);
        setUserState(res.user);
        setAccount({ username: res.user.username || '', email: res.user.email || '' });
      }
      toast.success(t('profile.accountUpdated'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAccount(false);
    }
  }

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

      {/* Account — username + email (editable by every user) */}
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>{t('profile.account')}</h3>
        <form onSubmit={saveAccount}>
          <label className="muted" style={{ fontSize: 13 }}>{t('profile.username')}</label>
          <input
            placeholder={t('profile.username')}
            value={account.username}
            onChange={(e) => setAccount({ ...account, username: e.target.value })}
            required
          />
          <label className="muted" style={{ fontSize: 13 }}>{t('field.email')}</label>
          <input
            type="email"
            placeholder={t('field.email')}
            value={account.email}
            onChange={(e) => setAccount({ ...account, email: e.target.value })}
          />
          <button type="submit" disabled={savingAccount}>
            {savingAccount ? t('profile.updating') : t('profile.saveAccount')}
          </button>
        </form>
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

      {/* Active sessions — see where you're logged in, sign out remotely */}
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>{t('profile.activeSessions')}</h3>
          {sessions.length > 1 && (
            <button className="print-btn" onClick={revokeOthers} disabled={revokingBulk}>
              {t('profile.signOutOthers')}
            </button>
          )}
        </div>
        {sessionsLoading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : sessions.length === 0 ? (
          <p className="muted">{t('common.none')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map((s) => (
              <div key={s.id} className="session-row">
                <div>
                  <strong>{s.device_label || t('profile.unknownDevice')}</strong>
                  {s.current && <span className="badge" style={{ background: '#059669', marginLeft: 8, fontSize: 11 }}>{t('profile.thisDevice')}</span>}
                  {s.remember && <span className="badge" style={{ background: '#6d5efc', marginLeft: 8, fontSize: 11 }}>{t('login.rememberMe')}</span>}
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {s.ip_address ? `${s.ip_address} · ` : ''}{t('profile.lastActive')}: {new Date(s.last_seen_at).toLocaleString('en-IN')}
                  </div>
                </div>
                {!s.current && (
                  <button className="print-btn" onClick={() => revokeOne(s.id)} disabled={revokingId === s.id}>
                    {t('profile.signOut')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {sessions.length > 0 && (
          <button
            className="print-btn"
            style={{ marginTop: 12, color: '#dc2626' }}
            onClick={revokeAll}
            disabled={revokingBulk}
          >
            {t('profile.signOutEverywhere')}
          </button>
        )}
      </div>

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
