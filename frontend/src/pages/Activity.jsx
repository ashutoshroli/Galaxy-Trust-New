import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { isSuperAdmin } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import { downloadCSV, triggerDownload } from '../utils/csv.js';

const PAGE = 50;

const ACTION_LABEL = {
  login_success: '✅ Login',
  login_failed: '❌ Failed login',
  logout: '↩️ Logout',
  locked: '🔒 Locked',
  password_changed: '🔑 Password changed',
};

export default function Activity() {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [backingUp, setBackingUp] = useState(false);

  function load(reset = false) {
    const off = reset ? 0 : offset;
    const af = action ? `&action=${encodeURIComponent(action)}` : '';
    apiCall(`/activity?limit=${PAGE}&offset=${off}${af}`)
      .then((data) => {
        setTotal(data.total);
        setRows(reset ? data.rows : [...rows, ...data.rows]);
        setOffset(off + data.rows.length);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => { if (isSuperAdmin()) load(true); /* eslint-disable-next-line */ }, [action]);

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
      [t('field.date'), t('activity.user'), t('activity.action'), t('activity.ip')],
      rows.map((r) => [
        r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
        r.username || '',
        r.action || '',
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
        <select value={action} onChange={(e) => setAction(e.target.value)} style={{ maxWidth: 220, margin: 0 }}>
          <option value="">{t('activity.allActions')}</option>
          <option value="login_success">Login success</option>
          <option value="login_failed">Login failed</option>
          <option value="logout">Logout</option>
          <option value="locked">Locked</option>
          <option value="password_changed">Password changed</option>
        </select>
        <span className="muted">{t('activity.total')}: {total}</span>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>{t('field.date')}</th><th>{t('activity.user')}</th><th>{t('activity.action')}</th><th>{t('activity.ip')}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="muted">{t('common.noRecords')}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : ''}</td>
                <td>{r.username || '-'}</td>
                <td>{ACTION_LABEL[r.action] || r.action}</td>
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
