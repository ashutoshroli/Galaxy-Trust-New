import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { isSuperAdmin } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';

export default function SidebarPermissions() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!isSuperAdmin()) return;
    apiCall('/nav-permissions').then(setData).catch((e) => setError(e.message));
  }, []);

  async function toggle(role, page, current) {
    const key = `${role}:${page}`;
    setBusy(key);
    // optimistic update
    setData((d) => ({ ...d, matrix: { ...d.matrix, [role]: { ...d.matrix[role], [page]: !current } } }));
    try {
      await apiCall('/nav-permissions', { method: 'PUT', body: JSON.stringify({ role, page_key: page, visible: !current }) });
    } catch (err) {
      toast.error(err.message);
      // revert
      setData((d) => ({ ...d, matrix: { ...d.matrix, [role]: { ...d.matrix[role], [page]: current } } }));
    } finally {
      setBusy('');
    }
  }

  if (!isSuperAdmin()) return <div className="card error-text">Access denied.</div>;

  return (
    <div>
      <h2>🧭 {t('sperm.title')}</h2>
      <p className="muted">{t('sperm.subtitle')}</p>
      {error && <div className="error-text">{error}</div>}

      {!data && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      {data && (
        <div className="card">
          <p className="muted" style={{ fontSize: 12.5 }}>{t('sperm.note')}</p>
          <table>
            <thead>
              <tr>
                <th>{t('sperm.page')}</th>
                {data.roles.map((r) => (
                  <th key={r} style={{ textAlign: 'center' }}>{t(`role.${r}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pages.map((page) => (
                <tr key={page}>
                  <td><strong>{t(`nav.${page}`)}</strong></td>
                  {data.roles.map((role) => {
                    const checked = !!data.matrix[role][page];
                    const key = `${role}:${page}`;
                    return (
                      <td key={role} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          style={{ width: 'auto', margin: 0 }}
                          checked={checked}
                          disabled={busy === key}
                          onChange={() => toggle(role, page, checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
