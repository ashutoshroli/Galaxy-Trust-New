import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { isSuperAdmin } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';

export default function Permissions() {
  const { t } = useI18n();
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [resetResult, setResetResult] = useState({}); // member_id -> { username, password }
  const [copiedId, setCopiedId] = useState(null);

  function load() {
    apiCall('/permissions/members')
      .then((data) => {
        setRoles(data.roles || []);
        setMembers(data.members || []);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (isSuperAdmin()) load();
  }, []);

  async function changeRole(member, role) {
    setSavingId(member.member_id);
    try {
      await apiCall('/permissions/role', { method: 'PUT', body: JSON.stringify({ member_id: member.member_id, role }) });
      toast.success(t('perm.updated'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function resetPassword(member) {
    if (!window.confirm(t('perm.resetConfirm'))) return;
    try {
      const data = await apiCall('/permissions/reset-password', {
        method: 'PUT',
        body: JSON.stringify({ member_id: member.member_id }),
      });
      setResetResult((prev) => ({ ...prev, [member.member_id]: data }));
      toast.success(t('perm.updated'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function copyCreds(memberId) {
    const r = resetResult[memberId];
    if (!r) return;
    const text = `Username: ${r.username}\nPassword: ${r.password}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(memberId);
    setTimeout(() => setCopiedId((c) => (c === memberId ? null : c)), 2000);
  }

  if (!isSuperAdmin()) {
    return <div className="card error-text">Access denied.</div>;
  }

  return (
    <div>
      <h2>{t('perm.title')}</h2>
      <p className="muted">{t('perm.subtitle')}</p>
      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('perm.member')}</th>
              <th>{t('perm.loginRole')}</th>
              <th>{t('perm.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const reset = resetResult[m.member_id];
              return (
                <React.Fragment key={m.member_id}>
                  <tr>
                    <td>
                      {m.name}{' '}
                      <span className={`badge ${m.member_role}`}>{t(`role.${m.member_role}`)}</span>
                    </td>
                    <td>
                      {m.user_id ? (
                        <select
                          value={m.login_role}
                          disabled={savingId === m.member_id}
                          onChange={(e) => changeRole(m, e.target.value)}
                          style={{ maxWidth: 180, margin: 0 }}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>{t(`role.${r}`)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">{t('perm.noLogin')}</span>
                      )}
                    </td>
                    <td>
                      {m.user_id && (
                        <button className="print-btn" onClick={() => resetPassword(m)}>🔑 {t('perm.resetPassword')}</button>
                      )}
                    </td>
                  </tr>

                  {reset && (
                    <tr>
                      <td colSpan={3}>
                        <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                          <p className="muted" style={{ marginTop: 0 }}>{t('perm.newPassword')}</p>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <code style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
                              {reset.username} / {reset.password}
                            </code>
                            <button className="print-btn" onClick={() => copyCreds(m.member_id)}>
                              {copiedId === m.member_id ? `✓ ${t('perm.copied')}` : `📋 ${t('perm.copy')}`}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>{t('perm.note')}</p>
      </div>
    </div>
  );
}
