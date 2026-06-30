import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete } from '../permissions.js';
import { printHTML } from '../printHelper.js';
import { useI18n } from '../i18n.js';
import Modal from '../components/Modal.jsx';

const TRUST_NAME = 'Galaxy Educational and Social Welfare Trust';

export default function Meetings() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ meeting_date: '', location: '', subject: '', description: '', minutes: '' });
  const [attendance, setAttendance] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function load() {
    apiCall('/meetings').then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
    apiCall('/members').then(setMembers).catch(() => {});
  }
  useEffect(load, []);

  function toggleAttendance(memberId) {
    setAttendance({ ...attendance, [memberId]: !attendance[memberId] });
  }

  async function handleAdd(e) {
    e.preventDefault();
    try {
      const attendanceArr = members.map((m) => ({ member_id: m.id, present: !!attendance[m.id] }));
      await apiCall('/meetings', { method: 'POST', body: JSON.stringify({ ...form, attendance: attendanceArr }) });
      setForm({ meeting_date: '', location: '', subject: '', description: '', minutes: '' });
      setAttendance({});
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/meetings/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewDetail(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    try {
      const d = await apiCall(`/meetings/${id}`);
      setDetail(d);
      setExpandedId(id);
    } catch (err) {
      setError(err.message);
    }
  }

  function printMOM(d) {
    if (!d) return;
    const present = d.attendance.filter((a) => a.present).map((a) => a.name);
    const absent = d.attendance.filter((a) => !a.present).map((a) => a.name);
    printHTML(`MOM - ${d.subject || d.meeting_date?.slice(0, 10)}`, `
      <h3>${t('meet.mom')}</h3>
      <p class="muted">
        <strong>${t('field.date')}:</strong> ${d.meeting_date?.slice(0, 10) || '-'} &nbsp;|&nbsp;
        <strong>${t('field.location')}:</strong> ${d.location || '-'}
      </p>
      <p><strong>${t('field.subject')}:</strong> ${d.subject || '-'}</p>
      ${d.description ? `<p><strong>${t('field.description')}:</strong> ${d.description}</p>` : ''}
      <div class="section-title"><h3>${t('meet.minutes')}</h3></div>
      <p style="white-space:pre-wrap;">${d.minutes || '-'}</p>
      <div class="section-title"><h3>${t('meet.attendance')}</h3></div>
      <p><strong>${t('meet.present')} (${present.length}):</strong> ${present.join(', ') || '-'}</p>
      <p><strong>${t('meet.absent')} (${absent.length}):</strong> ${absent.join(', ') || '-'}</p>
    `);
  }

  return (
    <div>
      <h2>{t('meet.title')}</h2>
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      <div className="actions-row">
        {canAdd() && (
          <button onClick={() => setShowForm(true)}>+ {t('meet.add')}</button>
        )}
      </div>

      <Modal open={showForm} title={t('meet.add')} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} required />
          <input placeholder={t('field.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input placeholder={t('field.subject')} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea placeholder={t('field.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <textarea placeholder={t('meet.minutes')} style={{ minHeight: 100 }} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />

          <p><strong>{t('meet.attendance')}</strong></p>
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10, border: '1px solid var(--glass-border)', borderRadius: 8, padding: 8 }}>
            {members.map((m) => (
              <label key={m.id} style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
                <input type="checkbox" style={{ width: 'auto', marginRight: 8 }} checked={!!attendance[m.id]} onChange={() => toggleAttendance(m.id)} />
                {m.name} <span className="muted">({t(`role.${m.role}`)})</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('common.save')}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <div className="actions-row" style={{ flexWrap: 'wrap' }}>
        <input placeholder={t('meet.searchPlaceholder')} style={{ maxWidth: 220, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="muted" style={{ margin: 0 }}>{t('common.from')}:</label>
        <input type="date" style={{ maxWidth: 160, margin: 0 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label className="muted" style={{ margin: 0 }}>{t('common.to')}:</label>
        <input type="date" style={{ maxWidth: 160, margin: 0 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>{t('common.clearFilters')}</button>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('field.date')}</th><th>{t('field.location')}</th><th>{t('field.subject')}</th><th>{t('field.description')}</th><th>{t('meet.attendance')}</th>
              {canDelete() && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {list
              .filter((m) => {
                const q = search.toLowerCase();
                const matchesSearch = !q || m.location?.toLowerCase().includes(q) || m.subject?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
                const d = m.meeting_date?.slice(0, 10);
                const matchesFrom = !dateFrom || (d && d >= dateFrom);
                const matchesTo = !dateTo || (d && d <= dateTo);
                return matchesSearch && matchesFrom && matchesTo;
              })
              .map((m) => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td>{m.meeting_date?.slice(0, 10)}</td>
                    <td>{m.location}</td>
                    <td>{m.subject}</td>
                    <td>{m.description}</td>
                    <td><button onClick={() => viewDetail(m.id)}>{expandedId === m.id ? t('common.hide') : t('common.view')}</button></td>
                    {canDelete() && (
                      <td><button onClick={() => handleDelete(m.id)}>{t('common.delete')}</button></td>
                    )}
                  </tr>
                  {expandedId === m.id && detail && (
                    <tr>
                      <td colSpan={6}>
                        <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                          <div className="card-header">
                            <h3 style={{ margin: 0 }}>{detail.subject || t('meet.title')}</h3>
                            <button className="print-btn" onClick={() => printMOM(detail)}>🖨 {t('meet.mom')}</button>
                          </div>
                          {detail.minutes && (
                            <div style={{ margin: '10px 0' }}>
                              <strong>{t('meet.minutes')}:</strong>
                              <p style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{detail.minutes}</p>
                            </div>
                          )}
                          <strong>{t('meet.present')}:</strong>{' '}
                          {detail.attendance.filter((a) => a.present).map((a) => a.name).join(', ') || t('common.none')}
                          <br />
                          <strong>{t('meet.absent')}:</strong>{' '}
                          {detail.attendance.filter((a) => !a.present).map((a) => a.name).join(', ') || t('common.none')}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
