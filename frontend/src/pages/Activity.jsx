import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { isSuperAdmin } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import { downloadCSV, triggerDownload } from '../utils/csv.js';

const PAGE = 50;

const STATIC_LABELS = {
  login_success: '✅ Login',
  login_failed: '❌ Failed login',
  logout: '↩️ Logout',
  locked: '🔒 Locked',
  password_changed: '🔑 Password changed',
  password_reset_requested: '📧 Reset link requested',
  password_reset: '🔑 Password reset',
  account_updated: '⚙️ Account updated',
};

// Format dynamic actions like "members_created" → "➕ Member created"
function actionLabel(a) {
  if (!a) return '';
  if (STATIC_LABELS[a]) return STATIC_LABELS[a];
  const m = a.match(/^(.*)_(created|updated|deleted)$/);
  if (m) {
    const icon = m[2] === 'created' ? '➕' : m[2] === 'updated' ? '✏️' : '🗑️';
    const resource = m[1].replace(/-/g, ' ');
    return `${icon} ${resource.charAt(0).toUpperCase()}${resource.slice(1)} ${m[2]}`;
  }
  return a;
}

// Filter options: value encodes how to query the backend ("action:x" or "like:%_x")
const FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'like:%_created', label: '➕ Created' },
  { value: 'like:%_updated', label: '✏️ Updated' },
  { value: 'like:%_deleted', label: '🗑️ Deleted' },
  { value: 'action:login_success', label: '✅ Login success' },
  { value: 'action:login_failed', label: '❌ Login failed' },
  { value: 'action:logout', label: '↩️ Logout' },
  { value: 'action:password_changed', label: '🔑 Password changed' },
  { value: 'action:password_reset', label: '🔑 Password reset' },
  { value: 'action:password_reset_requested', label: '📧 Reset link requested' },
  { value: 'action:account_updated', label: '⚙️ Account updated' },
];

export default function Activity() {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [backingUp, setBackingUp] = useState(false);

  function filterQuery() {
    if (!filter) return '';
    const [key, val] = filter.split(/:(.+)/);
    if (key === 'action') return `&action=${encodeURIComponent(val)}`;
    if (key === 'like') return `&like=${encodeURIComponent(val)}`;
    return '';
  }

  function load(reset = false) {
    const off = reset ? 0 : offset;
    apiCall(`/activity?limit=${PAGE}&offset=${off}${filterQuery()}`)
      .then((data) => {
        setTotal(data.total);
        setRows(reset ? data.rows : [...rows, ...data.rows]);
        setOffset(off + data.rows.length);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => { if (isSuperAdmin()) load(true); /* eslint-disable-next-line */ }, [filter]);

  async function downloadBackup() {
    setBackingUp(true);
    try {
      const data = await apiCall('/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `galaxy-trust-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success(t('backup.done'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBackingUp(false);
    }
  }

  function exportCSV() {
    downloadCSV(
      'activity-log.csv',
      [t('field.date'), t('activity.user'), t('activity.action'), t('activity.details'), t('activity.ip')],
      rows.map((r) => [
        r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
        r.username || '',
        r.action || '',
        r.details || '',
        r.ip_address || '',
      ])
    );
  }

  if (!isSuperAdmin()) return <div className="card error-text">Access denied.</div>;

  return (
    <div>
      <div className="card-header">
        <h2>🛡️ {t('activity.title')}</h2>
        <div className="card-header-actions">
          <button className="print-btn" onClick={exportCSV}>⬇️ CSV</button>
          <button onClick={downloadBackup} disabled={backingUp}>{backingUp ? t('common.loading') : `💾 ${t('backup.button')}`}</button>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="actions-row" style={{ flexWrap: 'wrap' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220, margin: 0 }}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.value === '' ? t('activity.allActions') : f.label}</option>
          ))}
        </select>
        <span className="muted">{t('activity.total')}: {total}</span>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>{t('field.date')}</th><th>{t('activity.user')}</th><th>{t('activity.action')}</th><th>{t('activity.details')}</th><th>{t('activity.ip')}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">{t('common.noRecords')}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : ''}</td>
                <td>{r.username || '-'}</td>
                <td>{actionLabel(r.action)}</td>
                <td className="muted">{r.details || '-'}</td>
                <td className="muted">{r.ip_address || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length < total && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="print-btn" onClick={() => load(false)}>{t('common.loadMore')}</button>
        </div>
      )}
    </div>
  );
}
