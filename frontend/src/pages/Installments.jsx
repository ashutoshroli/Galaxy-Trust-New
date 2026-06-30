import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete, isSuperAdmin } from '../permissions.js';
import { printHTML } from '../printHelper.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

export default function Installments() {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '', total_amount: '', due_date: '', notes: '' });
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editForm, setEditForm] = useState({ type: '', total_amount: '', paid_amount: '', due_date: '', notes: '' });

  const [openTypes, setOpenTypes] = useState({});

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function load() {
    apiCall('/installments').then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
    apiCall('/members').then((rows) => {
      setMembers(rows);
      setSelectedMembers(rows.map((m) => m.id));
    }).catch(() => {});
  }
  useEffect(load, []);

  function toggleMember(id) {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }
  function toggleType(type) {
    setOpenTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  }
  function isTypeOpen(type) {
    return !!openTypes[type];
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (selectedMembers.length === 0) return setError(t('inst.selectMembers'));
    if (!form.type.trim()) return setError(t('inst.typePlaceholder'));
    try {
      await apiCall('/installments', {
        method: 'POST',
        body: JSON.stringify({ ...form, paid_amount: 0, member_ids: selectedMembers }),
      });
      setForm({ type: '', total_amount: '', due_date: '', notes: '' });
      setSelectedMembers(members.map((m) => m.id));
      setShowForm(false);
      setError('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/installments/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(item) {
    setEditId(item.id);
    setEditName(item.member_name || '');
    setEditForm({
      type: item.type || 'General',
      total_amount: item.total_amount,
      paid_amount: item.paid_amount,
      due_date: item.due_date ? item.due_date.slice(0, 10) : '',
      notes: item.notes || '',
    });
  }

  async function saveEdit(id) {
    try {
      await apiCall(`/installments/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function statusBadge(i) {
    if (i.overdue) return <span className="badge" style={{ background: '#dc2626' }}>{t('status.overdue')}</span>;
    if (parseFloat(i.balance) <= 0) return <span className="badge" style={{ background: '#059669' }}>{t('status.paid')}</span>;
    return <span className="badge" style={{ background: '#d97706' }}>{t('status.pending')}</span>;
  }

  const filteredList = list.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || i.member_name?.toLowerCase().includes(q) || i.type?.toLowerCase().includes(q) || i.notes?.toLowerCase().includes(q);
    const d = i.due_date?.slice(0, 10);
    const matchesFrom = !dateFrom || (d && d >= dateFrom);
    const matchesTo = !dateTo || (d && d <= dateTo);
    return matchesSearch && matchesFrom && matchesTo;
  });

  const byType = {};
  filteredList.forEach((i) => {
    const tp = i.type || 'General';
    if (!byType[tp]) byType[tp] = [];
    byType[tp].push(i);
  });

  function printType(type, items) {
    const totalDue = items.reduce((s, p) => s + parseFloat(p.total_amount), 0);
    const totalPaid = items.reduce((s, p) => s + parseFloat(p.paid_amount), 0);
    const rows = items.map((i) => `
      <tr>
        <td>${i.member_name}</td>
        <td>₹${parseFloat(i.total_amount).toLocaleString()}</td>
        <td>₹${parseFloat(i.paid_amount).toLocaleString()}</td>
        <td>₹${parseFloat(i.balance).toLocaleString()}</td>
        <td>${i.due_date ? i.due_date.slice(0, 10) : '-'}</td>
        <td>${i.notes || ''}</td>
      </tr>`).join('');
    printHTML(`${t('inst.title')} - ${type}`, `
      <h3>${t('inst.title')} - ${type}</h3>
      <p class="muted">${t('field.total')}: ₹${totalDue.toLocaleString()} | ${t('field.paid')}: ₹${totalPaid.toLocaleString()} | ${t('field.balance')}: ₹${(totalDue - totalPaid).toLocaleString()}</p>
      <table><thead><tr><th>${t('contrib.member')}</th><th>${t('field.total')}</th><th>${t('field.paid')}</th><th>${t('field.balance')}</th><th>${t('field.dueDate')}</th><th>${t('field.notes')}</th></tr></thead>
      <tbody>${rows}</tbody></table>
    `);
  }

  function printAll() {
    const sections = Object.entries(byType).map(([type, items]) => {
      const rows = items.map((i) => `
        <tr>
          <td>${i.member_name}</td>
          <td>₹${parseFloat(i.total_amount).toLocaleString()}</td>
          <td>₹${parseFloat(i.paid_amount).toLocaleString()}</td>
          <td>₹${parseFloat(i.balance).toLocaleString()}</td>
          <td>${i.due_date ? i.due_date.slice(0, 10) : '-'}</td>
        </tr>`).join('');
      return `<div class="section-title"><h3>${type}</h3></div>
        <table><thead><tr><th>${t('contrib.member')}</th><th>${t('field.total')}</th><th>${t('field.paid')}</th><th>${t('field.balance')}</th><th>${t('field.dueDate')}</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }).join('');
    printHTML(t('inst.title'), `<h3>${t('inst.title')}</h3>${sections}`);
  }

  async function sendReminders() {
    if (!window.confirm(t('inst.remindConfirm'))) return;
    try {
      const r = await apiCall('/notifications/remind-installments', { method: 'POST' });
      toast.success(t('inst.remindSent', { n: r.reminded || 0 }));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="card-header">
        <h2>{t('inst.title')}</h2>
        <div className="card-header-actions">
          {isSuperAdmin() && <button className="print-btn" onClick={sendReminders}>🔔 {t('inst.remind')}</button>}
          <button className="print-btn" onClick={printAll}>🖨 {t('common.printAll')}</button>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      <div className="actions-row">
        {canAdd() && (
          <button onClick={() => setShowForm(true)}>+ {t('inst.set')}</button>
        )}
      </div>

      <div className="actions-row" style={{ flexWrap: 'wrap' }}>
        <input placeholder={t('inst.searchPlaceholder')} style={{ maxWidth: 220, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="muted" style={{ margin: 0 }}>{t('inst.dueFrom')}:</label>
        <input type="date" style={{ maxWidth: 160, margin: 0 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label className="muted" style={{ margin: 0 }}>{t('inst.dueTo')}:</label>
        <input type="date" style={{ maxWidth: 160, margin: 0 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>{t('common.clearFilters')}</button>
        )}
      </div>

      <Modal open={showForm} title={t('inst.set')} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <p style={{ marginTop: 0 }}><strong>{t('inst.selectMembers')}</strong></p>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
            {members.map((m) => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selectedMembers.includes(m.id)} onChange={() => toggleMember(m.id)} />
                {m.name} <span className="muted">({t(`role.${m.role}`)})</span>
              </label>
            ))}
          </div>

          <input type="text" placeholder={t('inst.typePlaceholder')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required />
          <input type="number" step="0.01" placeholder={t('inst.totalPlaceholder')} value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} required />
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <textarea placeholder={t('field.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('inst.setFor', { n: selectedMembers.length || 0 })}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} title={`${t('common.edit')}${editName ? ' — ' + editName : ''}`} onClose={() => setEditId(null)}>
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(editId); }}>
          <input type="text" placeholder={t('field.type')} value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
          <input type="number" step="0.01" placeholder={t('field.total')} value={editForm.total_amount} onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })} />
          <input type="number" step="0.01" placeholder={t('field.paid')} value={editForm.paid_amount} onChange={(e) => setEditForm({ ...editForm, paid_amount: e.target.value })} />
          <input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
          <textarea placeholder={t('field.notes')} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('common.saveChanges')}</button>
            <button type="button" className="print-btn" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      {Object.entries(byType).map(([type, items]) => {
        const totalDue = items.reduce((s, p) => s + parseFloat(p.total_amount), 0);
        const totalPaid = items.reduce((s, p) => s + parseFloat(p.paid_amount), 0);
        const typeOpen = isTypeOpen(type);
        return (
          <div key={type} className="card">
            <div className="type-group-header" style={{ margin: 0 }} onClick={() => toggleType(type)}>
              <strong>{type} ({items.length}) — {t('field.total')} ₹{totalDue.toLocaleString()} | {t('field.paid')} ₹{totalPaid.toLocaleString()} | {t('field.balance')} ₹{(totalDue - totalPaid).toLocaleString()}</strong>
              <div className="card-header-actions">
                <button className="print-btn" onClick={(e) => { e.stopPropagation(); printType(type, items); }}>🖨 {t('common.print')}</button>
                <button className="toggle-btn" onClick={(e) => { e.stopPropagation(); toggleType(type); }}>{typeOpen ? '−' : '+'}</button>
              </div>
            </div>

            {typeOpen && (
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>{t('contrib.member')}</th><th>{t('field.total')}</th><th>{t('field.paid')}</th><th>{t('field.balance')}</th><th>{t('field.dueDate')}</th><th>{t('field.status')}</th>
                    {canEditDelete() && <th>{t('common.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <React.Fragment key={i.id}>
                      <tr>
                        <td>{i.member_name}</td>
                        <td>₹{parseFloat(i.total_amount).toLocaleString()}</td>
                        <td>₹{parseFloat(i.paid_amount).toLocaleString()}</td>
                        <td style={{ color: parseFloat(i.balance) > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                          ₹{parseFloat(i.balance).toLocaleString()}
                        </td>
                        <td>{i.due_date?.slice(0, 10) || '-'}</td>
                        <td>{statusBadge(i)}</td>
                        {canEditDelete() && (
                          <td style={{ display: 'flex', gap: 6 }}>
                            {canEdit() && <button onClick={() => startEdit(i)}>{t('common.edit')}</button>}
                            {canDelete() && <button onClick={() => handleDelete(i.id)}>{t('common.delete')}</button>}
                          </td>
                        )}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
