import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete, isSuperAdmin } from '../permissions.js';
import { printHTML } from '../printHelper.js';
import { downloadCSV } from '../utils/csv.js';
import PhotoPicker from '../components/PhotoPicker.jsx';
import { useI18n } from '../i18n.js';
import Modal from '../components/Modal.jsx';

const ROLE_OPTIONS = ['trustee', 'president', 'secretary', 'treasurer'];
const TRUST_NAME = 'Galaxy Educational and Social Welfare Trust';

const EMPTY_FORM = { name: '', relation_name: '', role: 'trustee', address: '', phone: '', email: '', dob: '', photo: '' };

export default function Members() {
  const { t } = useI18n();
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [saving, setSaving] = useState(false);

  function load() {
    apiCall('/members').then(setMembers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiCall('/members', { method: 'POST', body: JSON.stringify(form) });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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

  async function toggleStatus(m) {
    try {
      await apiCall(`/members/${m.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !m.active }) });
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
      email: m.email || '',
      dob: m.dob ? m.dob.slice(0, 10) : '',
      photo: m.photo || '',
    });
  }

  async function saveEdit(id) {
    if (saving) return;
    setSaving(true);
    try {
      await apiCall(`/members/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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

  function printIdCard(m) {
    const photo = m.photo
      ? `<img src="${m.photo}" style="width:96px;height:96px;object-fit:cover;border-radius:10px;border:2px solid #1e3a5f;" />`
      : `<div style="width:96px;height:96px;border-radius:10px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">No Photo</div>`;
    printHTML(`ID Card - ${m.name}`, `
      <div style="max-width:400px;border:2px solid #1e3a5f;border-radius:12px;padding:16px;margin-top:10px;">
        <div style="text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:12px;font-weight:700;color:#1e3a5f;">MEMBER ID CARD</div>
        <div style="display:flex;gap:14px;align-items:center;">
          ${photo}
          <div>
            <div style="font-size:18px;font-weight:700;">${m.name}</div>
            <div style="color:#6b7280;">${m.relation_name || ''}</div>
            <div style="margin-top:6px;"><span class="badge" style="background:#1e3a5f;">${t(`role.${m.role}`)}</span></div>
            <div style="margin-top:6px;font-size:13px;">ID: ${m.id}${m.phone ? ' &nbsp;·&nbsp; 📞 ' + m.phone : ''}</div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:#6b7280;">${m.address || ''}</div>
      </div>
    `);
  }

  function printPassbook() {
    if (!detail) return;
    const m = members.find((x) => x.id === detail.member.id) || detail.member;
    let running = 0;
    const contribRows = detail.contributions.map((c) => {
      running += Number(c.amount);
      return `<tr><td>${c.date ? c.date.slice(0, 10) : '-'}</td><td>${c.installment_type || '-'}</td><td>₹${Number(c.amount).toLocaleString()}</td><td>${c.mode || '-'}</td><td>₹${running.toLocaleString()}</td></tr>`;
    }).join('');
    const instRows = detail.installments.map((i) =>
      `<tr><td>${i.type}</td><td>₹${parseFloat(i.total_amount).toLocaleString()}</td><td>₹${parseFloat(i.paid_amount).toLocaleString()}</td><td>₹${parseFloat(i.balance).toLocaleString()}</td><td>${i.due_date ? i.due_date.slice(0, 10) : '-'}</td></tr>`
    ).join('');
    printHTML(`Passbook - ${detail.member.name}`, `
      <h3>${t('members.passbook')} — ${detail.member.name}</h3>
      <p class="muted">${t(`role.${detail.member.role}`)}${m.phone ? ' · 📞 ' + m.phone : ''} · ${t('members.totalGiven')}: ₹${detail.total_given.toLocaleString()}</p>
      <div class="section-title"><h3>${t('members.installmentPlans')}</h3></div>
      <table><thead><tr><th>${t('field.type')}</th><th>${t('field.total')}</th><th>${t('field.paid')}</th><th>${t('field.balance')}</th><th>${t('field.dueDate')}</th></tr></thead>
      <tbody>${instRows || `<tr><td colspan="5">${t('common.noRecords')}</td></tr>`}</tbody></table>
      <div class="section-title"><h3>${t('members.contributionsHeading')}</h3></div>
      <table><thead><tr><th>${t('field.date')}</th><th>${t('contrib.installmentType')}</th><th>${t('field.amount')}</th><th>${t('field.mode')}</th><th>${t('field.balance')}</th></tr></thead>
      <tbody>${contribRows || `<tr><td colspan="5">${t('common.noRecords')}</td></tr>`}</tbody></table>
    `);
  }

  function exportMembersCSV() {
    downloadCSV(
      'members.csv',
      [t('field.name'), t('field.relation'), t('field.role'), t('field.phone'), t('field.email'), t('field.address'), t('members.dob'), t('field.status')],
      members.map((m) => [
        m.name, m.relation_name || '', t(`role.${m.role}`), m.phone || '', m.email || '', m.address || '',
        m.dob ? m.dob.slice(0, 10) : '', m.active === false ? t('members.inactive') : t('members.active'),
      ])
    );
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
          <input type="email" placeholder={t('field.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="muted" style={{ fontSize: 13 }}>{t('members.dob')}</label>
          <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          <PhotoPicker value={form.photo} onChange={(p) => setForm({ ...form, photo: p })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
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
          <input type="email" placeholder={t('field.email')} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <label className="muted" style={{ fontSize: 13 }}>{t('members.dob')}</label>
          <input type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} />
          <PhotoPicker value={editForm.photo} onChange={(p) => setEditForm({ ...editForm, photo: p })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving}>{saving ? t('common.loading') : t('common.saveChanges')}</button>
            <button type="button" className="print-btn" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <div className="actions-row" style={{ flexWrap: 'wrap' }}>
        <input placeholder={t('members.searchPlaceholder')} style={{ maxWidth: 260, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 150, margin: 0 }}>
          <option value="active">{t('members.active')}</option>
          <option value="inactive">{t('members.inactive')}</option>
          <option value="all">{t('members.allStatus')}</option>
        </select>
        <button className="print-btn" onClick={exportMembersCSV}>⬇️ CSV</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('field.name')}</th><th>{t('field.relation')}</th><th>{t('field.role')}</th><th>{t('field.status')}</th><th>{t('field.address')}</th><th>{t('field.phone')}</th>
              {canEditDelete() && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {members
              .filter((m) => {
                if (statusFilter === 'active' && m.active === false) return false;
                if (statusFilter === 'inactive' && m.active !== false) return false;
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
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.photo
                          ? <img src={m.photo} alt="" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: '50%' }} />
                          : <span className="brand-logo" style={{ width: 30, height: 30 }} aria-hidden="true" />}
                        {m.name}
                      </span>
                    </td>
                    <td>{m.relation_name}</td>
                    <td><span className={`badge ${m.role}`}>{t(`role.${m.role}`)}</span></td>
                    <td>
                      {m.active === false
                        ? <span className="badge" style={{ background: '#6b7280' }}>{t('members.inactive')}</span>
                        : <span className="badge" style={{ background: '#059669' }}>{t('members.active')}</span>}
                    </td>
                    <td>{m.address}</td>
                    <td>{m.phone}</td>
                    {canEditDelete() && (
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        {canEdit() && <button onClick={() => startEdit(m)}>{t('common.edit')}</button>}
                        {canEdit() && <button className="print-btn" onClick={() => toggleStatus(m)}>{m.active === false ? t('members.activate') : t('members.deactivate')}</button>}
                        {canDelete() && <button onClick={() => handleDelete(m.id)}>{t('common.delete')}</button>}
                      </td>
                    )}
                  </tr>

                  {expandedId === m.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                          {detailLoading && <p className="muted">{t('common.loading')}</p>}
                          {detailError && <div className="error-text">{detailError}</div>}
                          {detail && (
                            <>
                              <div className="card-header">
                                <h3>{detail.member.name} — {t('members.detailTitle')}</h3>
                                <div className="card-header-actions">
                                  <button className="print-btn" onClick={() => printIdCard(m)}>🪪 {t('members.idCard')}</button>
                                  <button className="print-btn" onClick={printPassbook}>📖 {t('members.passbook')}</button>
                                  <button className="print-btn" onClick={printMemberDetail}>🖨 {t('common.print')}</button>
                                </div>
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
