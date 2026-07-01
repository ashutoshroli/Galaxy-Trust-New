import React, { useEffect, useState } from 'react';
import { apiCall, getUser } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete, isSuperAdmin } from '../permissions.js';
import { printHTML } from '../printHelper.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

const TRUST_NAME = 'Galaxy Educational and Social Welfare Trust';

export default function Meetings() {
  const { t } = useI18n();
  const toast = useToast();
  const user = getUser();
  const [list, setList] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ meeting_date: '', location: '', subject: '', description: '', minutes: '' });
  const [attendance, setAttendance] = useState({});
  const [agendaDraft, setAgendaDraft] = useState([]); // [{ title, description }] while creating a meeting
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [votingId, setVotingId] = useState(null);
  const [voters, setVoters] = useState(null); // { itemId, rows } — voter breakdown popup
  const [newAgendaTitle, setNewAgendaTitle] = useState('');

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

  function addAgendaDraftRow() {
    setAgendaDraft([...agendaDraft, { title: '', description: '' }]);
  }
  function updateAgendaDraftRow(i, field, value) {
    const next = [...agendaDraft];
    next[i] = { ...next[i], [field]: value };
    setAgendaDraft(next);
  }
  function removeAgendaDraftRow(i) {
    setAgendaDraft(agendaDraft.filter((_, idx) => idx !== i));
  }

  async function handleAdd(e) {
    e.preventDefault();
    try {
      const attendanceArr = members.map((m) => ({ member_id: m.id, present: !!attendance[m.id] }));
      const agenda = agendaDraft.filter((a) => a.title.trim());
      await apiCall('/meetings', { method: 'POST', body: JSON.stringify({ ...form, attendance: attendanceArr, agenda }) });
      setForm({ meeting_date: '', location: '', subject: '', description: '', minutes: '' });
      setAttendance({});
      setAgendaDraft([]);
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

  async function refreshDetail() {
    if (!expandedId) return;
    try {
      const d = await apiCall(`/meetings/${expandedId}`);
      setDetail(d);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addAgendaItem() {
    const title = newAgendaTitle.trim();
    if (!title || !expandedId) return;
    try {
      await apiCall(`/meetings/${expandedId}/agenda`, { method: 'POST', body: JSON.stringify({ title }) });
      setNewAgendaTitle('');
      refreshDetail();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function setAgendaStatus(itemId, status) {
    try {
      await apiCall(`/meetings/agenda/${itemId}`, { method: 'PUT', body: JSON.stringify({ status }) });
      refreshDetail();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteAgendaItem(itemId) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/meetings/agenda/${itemId}`, { method: 'DELETE' });
      refreshDetail();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function castVote(itemId, vote) {
    if (votingId) return;
    setVotingId(itemId);
    try {
      await apiCall(`/meetings/agenda/${itemId}/vote`, { method: 'POST', body: JSON.stringify({ vote }) });
      await refreshDetail();
      toast.success(t('meet.voteRecorded'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVotingId(null);
    }
  }

  async function showVoters(itemId) {
    if (voters?.itemId === itemId) {
      setVoters(null);
      return;
    }
    try {
      const rows = await apiCall(`/meetings/agenda/${itemId}/votes`);
      setVoters({ itemId, rows });
    } catch (err) {
      toast.error(err.message);
    }
  }

  function agendaStatusLabel(status) {
    if (status === 'passed') return <span className="badge" style={{ background: '#059669' }}>{t('meet.passed')}</span>;
    if (status === 'rejected') return <span className="badge" style={{ background: '#dc2626' }}>{t('meet.rejected')}</span>;
    if (status === 'withdrawn') return <span className="badge" style={{ background: '#6b7280' }}>{t('meet.withdrawn')}</span>;
    return <span className="badge" style={{ background: '#d97706' }}>{t('meet.open')}</span>;
  }

  function printMOM(d) {
    if (!d) return;
    const present = d.attendance.filter((a) => a.present).map((a) => a.name);
    const absent = d.attendance.filter((a) => !a.present).map((a) => a.name);
    const agendaRows = (d.agenda || []).map((a) => `
      <tr>
        <td>${a.title}</td>
        <td>${a.status}</td>
        <td>${a.yes_count} / ${a.no_count} / ${a.abstain_count}</td>
      </tr>`).join('');
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
      ${(d.agenda || []).length > 0 ? `
        <div class="section-title"><h3>${t('meet.agenda')}</h3></div>
        <table><thead><tr><th>${t('meet.agendaItem')}</th><th>${t('field.status')}</th><th>${t('meet.yesNoAbstain')}</th></tr></thead>
        <tbody>${agendaRows}</tbody></table>
      ` : ''}
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

          <p style={{ marginBottom: 6 }}><strong>{t('meet.agenda')}</strong> <span className="muted" style={{ fontSize: 12 }}>({t('meet.agendaHint')})</span></p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {agendaDraft.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input
                  placeholder={t('meet.agendaItemPlaceholder')}
                  style={{ margin: 0 }}
                  value={a.title}
                  onChange={(e) => updateAgendaDraftRow(i, 'title', e.target.value)}
                />
                <button type="button" className="print-btn" onClick={() => removeAgendaDraftRow(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="print-btn" onClick={addAgendaDraftRow} style={{ alignSelf: 'flex-start' }}>
              + {t('meet.addAgendaItem')}
            </button>
          </div>

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

                          {/* Agenda + voting */}
                          <div style={{ margin: '14px 0' }}>
                            <strong>{t('meet.agenda')}</strong>
                            {(detail.agenda || []).length === 0 && (
                              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t('meet.noAgenda')}</p>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                              {(detail.agenda || []).map((a) => (
                                <div key={a.id} className="agenda-item-card">
                                  <div className="card-header" style={{ marginBottom: 6 }}>
                                    <span style={{ fontWeight: 600 }}>{a.title}</span>
                                    {agendaStatusLabel(a.status)}
                                  </div>
                                  {a.description && <p className="muted" style={{ fontSize: 13, margin: '0 0 6px' }}>{a.description}</p>}

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span className="muted" style={{ fontSize: 13 }}>
                                      ✅ {a.yes_count} &nbsp; ❌ {a.no_count} &nbsp; ⬜ {a.abstain_count}
                                    </span>
                                    <button className="print-btn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => showVoters(a.id)}>
                                      {voters?.itemId === a.id ? t('common.hide') : t('meet.viewVoters')}
                                    </button>
                                  </div>

                                  {a.status === 'open' && user?.member_id && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                      {['yes', 'no', 'abstain'].map((v) => (
                                        <button
                                          key={v}
                                          className="print-btn"
                                          disabled={votingId === a.id}
                                          style={{
                                            fontSize: 12,
                                            padding: '4px 10px',
                                            background: a.my_vote === v ? 'var(--grad-primary)' : undefined,
                                            color: a.my_vote === v ? '#fff' : undefined,
                                          }}
                                          onClick={() => castVote(a.id, v)}
                                        >
                                          {v === 'yes' ? `✅ ${t('meet.voteYes')}` : v === 'no' ? `❌ ${t('meet.voteNo')}` : `⬜ ${t('meet.voteAbstain')}`}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {voters?.itemId === a.id && (
                                    <div className="muted" style={{ fontSize: 13, marginTop: 8, borderTop: '1px solid var(--glass-border)', paddingTop: 8 }}>
                                      {voters.rows.length === 0
                                        ? t('common.none')
                                        : voters.rows.map((v) => `${v.name} (${v.vote})`).join(', ')}
                                    </div>
                                  )}

                                  {isSuperAdmin() && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                      {a.status !== 'passed' && <button className="print-btn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setAgendaStatus(a.id, 'passed')}>{t('meet.markPassed')}</button>}
                                      {a.status !== 'rejected' && <button className="print-btn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setAgendaStatus(a.id, 'rejected')}>{t('meet.markRejected')}</button>}
                                      {a.status === 'open' && <button className="print-btn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setAgendaStatus(a.id, 'withdrawn')}>{t('meet.withdraw')}</button>}
                                      <button className="print-btn" style={{ fontSize: 12, padding: '4px 8px', color: '#dc2626' }} onClick={() => deleteAgendaItem(a.id)}>{t('common.delete')}</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {canAdd() && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                <input
                                  placeholder={t('meet.agendaItemPlaceholder')}
                                  style={{ margin: 0 }}
                                  value={newAgendaTitle}
                                  onChange={(e) => setNewAgendaTitle(e.target.value)}
                                />
                                <button className="print-btn" onClick={addAgendaItem}>+ {t('common.add')}</button>
                              </div>
                            )}
                          </div>

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
