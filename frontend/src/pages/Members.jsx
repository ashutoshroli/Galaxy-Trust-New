import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete } from '../permissions.js';
import { printHTML } from '../printHelper.js';
import { useI18n } from '../i18n.js';
import Modal from '../components/Modal.jsx';

const ROLE_OPTIONS = ['trustee', 'president', 'secretary', 'treasurer'];

export default function Members() {
  const { t } = useI18n();
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', relation_name: '', role: 'trustee', address: '', phone: '' });

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', relation_name: '', role: 'trustee', address: '', phone: '' });

  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [search, setSearch] = useState('');

  function load() {
    apiCall('/members').then(setMembers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await apiCall('/members', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', relation_name: '', role: 'trustee', address: '', phone: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/members/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(m) {
    setEditId(m.id);
    setEditForm({
      name: m.name || '',
      relation_name: m.relation_name || '',
      role: m.role || 'trustee',
      address: m.address || '',
      phone: m.phone || '',
    });
  }

  async function saveEdit(id) {
    try {
      await apiCall(`/members/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleExpand(m) {
    if (expandedId === m.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(m.id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await apiCall(`/reports/member-detail/${m.id}`);
      setDetail(data);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function installmentStatus(i) {
    const balance = parseFloat(i.balance);
    if (i.overdue) return <span className="badge" style={{ background: '#dc2626' }}>{t('status.overdue')}</span>;
    if (balance <= 0) return <span className="badge" style={{ background: '#059669' }}>{t('status.paid')}</span>;
    if (parseFloat(i.paid_amount) > 0) return <span className="badge" style={{ background: '#2563eb' }}>{t('status.partial')}</span>;
    return <span className="badge" style={{ background: '#d97706' }}>{t('status.pending')}</span>;
  }

  function printMemberDetail() {
    if (!detail) return;
    const installmentsRows = detail.installments.map((i) => `
      <tr>
        <td>${i.type}</td>
        <td>₹${parseFloat(i.total_amount).toLocaleString()}</td>
        <td>₹${parseFloat(i.paid_amount).toLocaleString()}</td>
        <td>₹${parseFloat(i.balance).toLocaleString()}</td>
        <td>${i.due_date ? i.due_date.slice(0, 10) : '-'}</td>
      </tr>`).join('');

    const contribRows = detail.contributions.map((c) => `
      <tr>
        <td>${c.date ? c.date.slice(0, 10) : '-'}</td>
        <td>${c.installment_type || '-'}</td>
        <td>₹${c.amount.toLocaleString()}</td>
        <td>${c.mode || '-'}</td>
      </tr>`).join('');

    printHTML(`${t('members.detailTitle')} - ${detail.member.name}`, `
      <h3>${detail.member.name} <span style="font-size:13px;color:#6b7280;">(${t(`role.${detail.member.role}`)})</span></h3>
      <p class="muted">${t('members.totalGiven')}: ₹${detail.total_given.toLocaleString()}</p>

      <div class="section-title"><h3>${t('members.installmentPlans')}</h3></div>
      <table><thead><tr><th>${t('field.type')}</th><th>${t('field.total')}</th><th>${t('field.paid')}</th><th>${t('field.balance')}</th><th>${t('field.dueDate')}</th></tr></thead>
      <tbody>${installmentsRows || `<tr><td colspan="5">${t('common.noRecords')}</td></tr>`}</tbody></table>

      <div class="section-title"><h3>${t('members.contributionsHeading')}</h3></div>
      <table><thead><tr><th>${t('field.date')}</th><th>${t('contrib.installmentType')}</th><th>${t('field.amount')}</th><th>${t('field.mode')}</th></tr></thead>
      <tbody>${contribRows || `<tr><td colspan="4">${t('common.noRecords')}</td></tr>`}</tbody></table>
    `);
  }

  const RoleSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange}>
      {ROLE_OPTIONS.map((r) => (
        <option key={r} value={r}>{t(`role.${r}`)}</option>
      ))}
    </select>
  );

  return (
    <div>
      <h2>{t('members.title')}</h2>
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      <div className="actions-row">
        {canAdd() && (
          <button onClick={() => setShowForm(true)}>+ {t('members.add')}</button>
        )}
      </div>

      <Modal open={showForm} title={t('members.add')} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <input placeholder={t('field.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder={t('field.relation')} value={form.relation_name} onChange={(e) => setForm({ ...form, relation_name: e.target.value })} />
          <RoleSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input placeholder={t('field.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input placeholder={t('field.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('common.save')}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} title={`${t('common.edit')}${editForm.name ? ' — ' + editForm.name : ''}`} onClose={() => setEditId(null)}>
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(editId); }}>
          <input placeholder={t('field.name')} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <input placeholder={t('field.relation')} value={editForm.relation_name} onChange={(e) => setEditForm({ ...editForm, relation_name: e.target.value })} />
          <RoleSelect value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
          <input placeholder={t('field.address')} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <input placeholder={t('field.phone')} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('common.saveChanges')}</button>
            <button type="button" className="print-btn" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <div className="actions-row">
        <input placeholder={t('members.searchPlaceholder')} style={{ maxWidth: 280, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('field.name')}</th><th>{t('field.relation')}</th><th>{t('field.role')}</th><th>{t('field.address')}</th><th>{t('field.phone')}</th>
              {canEditDelete() && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {members
              .filter((m) => {
                const q = search.toLowerCase();
                if (!q) return true;
                return (
                  m.name?.toLowerCase().includes(q) ||
                  m.relation_name?.toLowerCase().includes(q) ||
                  m.address?.toLowerCase().includes(q) ||
                  m.phone?.toLowerCase().includes(q) ||
                  m.role?.toLowerCase().includes(q)
                );
              })
              .map((m) => (
                <React.Fragment key={m.id}>
                  <tr className="clickable-row" onClick={() => toggleExpand(m)}>
                    <td>{m.name}</td>
                    <td>{m.relation_name}</td>
                    <td><span className={`badge ${m.role}`}>{t(`role.${m.role}`)}</span></td>
                    <td>{m.address}</td>
                    <td>{m.phone}</td>
                    {canEditDelete() && (
                      <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {canEdit() && <button onClick={() => startEdit(m)}>{t('common.edit')}</button>}
                        {canDelete() && <button onClick={() => handleDelete(m.id)}>{t('common.delete')}</button>}
                      </td>
                    )}
                  </tr>

                  {expandedId === m.id && (
                    <tr>
                      <td colSpan={6}>
                        <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                          {detailLoading && <p className="muted">{t('common.loading')}</p>}
                          {detailError && <div className="error-text">{detailError}</div>}
                          {detail && (
                            <>
                              <div className="card-header">
                                <h3>{detail.member.name} — {t('members.detailTitle')}</h3>
                                <button className="print-btn" onClick={printMemberDetail}>🖨 {t('common.print')}</button>
                              </div>
                              <p className="muted">{t('members.totalGiven')}: ₹{detail.total_given.toLocaleString()}</p>

                              <strong>{t('members.installmentPlans')}</strong>
                              <table style={{ marginBottom: 14 }}>
                                <thead><tr><th>{t('field.type')}</th><th>{t('field.total')}</th><th>{t('field.paid')}</th><th>{t('field.balance')}</th><th>{t('field.dueDate')}</th><th>{t('field.status')}</th></tr></thead>
                                <tbody>
                                  {detail.installments.length === 0 && (
                                    <tr><td colSpan={6} className="muted">{t('common.noRecords')}</td></tr>
                                  )}
                                  {detail.installments.map((i) => (
                                    <tr key={i.id}>
                                      <td>{i.type}</td>
                                      <td>₹{parseFloat(i.total_amount).toLocaleString()}</td>
                                      <td>₹{parseFloat(i.paid_amount).toLocaleString()}</td>
                                      <td style={{ color: parseFloat(i.balance) > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                                        ₹{parseFloat(i.balance).toLocaleString()}
                                      </td>
                                      <td>{i.due_date?.slice(0, 10) || '-'}</td>
                                      <td>{installmentStatus(i)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <strong>{t('members.contributionsHeading')}</strong>
                              <table>
                                <thead><tr><th>{t('field.date')}</th><th>{t('contrib.installmentType')}</th><th>{t('field.amount')}</th><th>{t('field.mode')}</th></tr></thead>
                                <tbody>
                                  {detail.contributions.length === 0 && (
                                    <tr><td colSpan={4} className="muted">{t('common.noRecords')}</td></tr>
                                  )}
                                  {detail.contributions.map((c) => (
                                    <tr key={c.contribution_id}>
                                      <td>{c.date?.slice(0, 10)}</td>
                                      <td>{c.installment_type || '-'}</td>
                                      <td>₹{c.amount.toLocaleString()}</td>
                                      <td>{c.mode || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {detail.gave_to_cashiers && detail.gave_to_cashiers.length > 0 && (
                                <div style={{ marginTop: 14 }}>
                                  <strong>👛 {t('cashier.gaveToCashiers')}</strong>
                                  <table style={{ marginTop: 6 }}>
                                    <thead><tr><th>{t('cashier.cashier')}</th><th>{t('field.amount')}</th></tr></thead>
                                    <tbody>
                                      {detail.gave_to_cashiers.map((g) => (
                                        <tr key={g.cashier_member_id}>
                                          <td>{g.cashier_name}</td>
                                          <td style={{ color: '#059669', fontWeight: 600 }}>₹{Number(g.total).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {detail.is_cashier && (
                                <div style={{ marginTop: 14 }}>
                                  <strong>👛 {t('cashier.asCashier')}</strong>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 6 }}>
                                    <div>
                                      <p className="muted" style={{ margin: '4px 0' }}>⬇️ {t('cashier.receivedFrom')}</p>
                                      <table>
                                        <thead><tr><th>{t('contrib.member')}</th><th>{t('field.amount')}</th></tr></thead>
                                        <tbody>
                                          {(!detail.cashier_received_from || detail.cashier_received_from.length === 0) && (
                                            <tr><td colSpan={2} className="muted">{t('common.noRecords')}</td></tr>
                                          )}
                                          {(detail.cashier_received_from || []).map((r) => (
                                            <tr key={r.member_id}>
                                              <td>{r.member_name}</td>
                                              <td style={{ color: '#059669' }}>₹{Number(r.total).toLocaleString()}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div>
                                      <p className="muted" style={{ margin: '4px 0' }}>⬆️ {t('cashier.givenTo')}</p>
                                      <table>
                                        <thead><tr><th>{t('field.details')}</th><th>{t('field.amount')}</th></tr></thead>
                                        <tbody>
                                          {(!detail.cashier_given_to || detail.cashier_given_to.length === 0) && (
                                            <tr><td colSpan={2} className="muted">{t('common.noRecords')}</td></tr>
                                          )}
                                          {(detail.cashier_given_to || []).map((g, i) => (
                                            <tr key={i}>
                                              <td>{g.kind === 'staff' ? '👨‍🔧 ' : '🧾 '}{g.name}</td>
                                              <td style={{ color: '#dc2626' }}>₹{Number(g.total).toLocaleString()}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {detail.attendance && detail.attendance.total_meetings > 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <strong>{t('members.attendance')}</strong>
                                    <span className="muted">
                                      {detail.attendance.present} / {detail.attendance.total_meetings}
                                      {' '}({Math.round((detail.attendance.present / detail.attendance.total_meetings) * 100)}%)
                                    </span>
                                  </div>
                                  <div style={{ height: 10, borderRadius: 999, background: 'rgba(140,150,230,0.12)', overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${(detail.attendance.present / detail.attendance.total_meetings) * 100}%`,
                                        height: '100%',
                                        borderRadius: 999,
                                        background: 'linear-gradient(90deg, #34d399, #22d3ee)',
                                        boxShadow: '0 0 12px rgba(52,211,153,0.55)',
                                        transition: 'width 0.6s ease',
                                      }}
                                    />
                                  </div>
                                  <p className="muted" style={{ marginTop: 6 }}>
                                    {t('members.present')}: {detail.attendance.present} · {t('members.absent')}: {detail.attendance.absent}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
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
