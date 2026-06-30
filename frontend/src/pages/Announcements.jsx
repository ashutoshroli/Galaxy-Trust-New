import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canDelete } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

export default function Announcements() {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [saving, setSaving] = useState(false);

  function load() {
    apiCall('/announcements').then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openAdd() {
    setEditId(null);
    setForm({ title: '', body: '', pinned: false });
    setShowForm(true);
  }
  function openEdit(a) {
    setEditId(a.id);
    setForm({ title: a.title || '', body: a.body || '', pinned: !!a.pinned });
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error(t('ann.titleRequired'));
    if (saving) return;
    setSaving(true);
    try {
      if (editId) await apiCall(`/announcements/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
      else await apiCall('/announcements', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      toast.success(t('ann.saved'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/announcements/${id}`, { method: 'DELETE' });
      toast.success(t('ann.deleted'));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <h2>📢 {t('ann.title')}</h2>
      {error && <div className="error-text">{error}</div>}

      {canAdd() && (
        <div className="actions-row">
          <button onClick={openAdd}>+ {t('ann.add')}</button>
        </div>
      )}

      <Modal open={showForm} title={editId ? t('ann.edit') : t('ann.add')} onClose={() => setShowForm(false)}>
        <form onSubmit={save}>
          <input placeholder={t('ann.titleField')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea placeholder={t('ann.bodyField')} style={{ minHeight: 120 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            📌 {t('ann.pin')}
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}
      {!loading && list.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>{t('ann.none')}</p></div>}

      {list.map((a) => (
        <div key={a.id} className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>{a.pinned ? '📌 ' : ''}{a.title}</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {canAdd() && <button className="print-btn" onClick={() => openEdit(a)}>✏️</button>}
              {canDelete() && <button className="print-btn" onClick={() => remove(a.id)}>🗑</button>}
            </div>
          </div>
          {a.body && <p style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>{a.body}</p>}
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            {a.author_name || ''} · {a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
