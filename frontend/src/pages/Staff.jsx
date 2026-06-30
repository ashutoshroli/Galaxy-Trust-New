import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete } from '../permissions.js';
import { useI18n } from '../i18n.js';
import Modal from '../components/Modal.jsx';
import CashierSplit from '../components/CashierSplit.jsx';

export default function Staff() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', contact: '', address: '' });

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', contact: '', address: '' });

  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: '', remarks: '' });
  const [search, setSearch] = useState('');

  const [cashierList, setCashierList] = useState([]);
  const [payCashierAlloc, setPayCashierAlloc] = useState([]);
  const [payResetKey, setPayResetKey] = useState(0);
  const [paying, setPaying] = useState(false);

  function load() {
    apiCall('/staff').then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
    apiCall('/cashiers').then(setCashierList).catch(() => {});
  }
  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await apiCall('/staff', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', category: '', contact: '', address: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('staff.confirmDelete'))) return;
    try {
      await apiCall(`/staff/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(s) {
    setEditId(s.id);
    setEditForm({ name: s.name, category: s.category || '', contact: s.contact || '', address: s.address || '' });
  }

  async function saveEdit(id) {
    try {
      await apiCall(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditId(null);
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
      const d = await apiCall(`/staff/${id}`);
      setDetail(d);
      setExpandedId(id);
      setPayForm({ amount: '', payment_date: '', remarks: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function addPayment(staffId) {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return setError(t('field.amount'));
    if (payCashierAlloc.length === 0) return setError(t('cashier.required'));
    if (paying) return;
    setPaying(true);
    try {
      await apiCall(`/staff/${staffId}/payments`, { method: 'POST', body: JSON.stringify({ ...payForm, cashiers: payCashierAlloc }) });
      const d = await apiCall(`/staff/${staffId}`);
      setDetail(d);
      setPayForm({ amount: '', payment_date: '', remarks: '' });
      setPayCashierAlloc([]);
      setPayResetKey((k) => k + 1);
      setError('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  async function deletePayment(staffId, paymentId) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/staff/payments/${paymentId}`, { method: 'DELETE' });
      const d = await apiCall(`/staff/${staffId}`);
      setDetail(d);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>{t('staff.title')}</h2>
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      <div className="actions-row">
        {canAdd() && (
          <button onClick={() => setShowForm(true)}>+ {t('staff.add')}</button>
        )}
      </div>

      <Modal open={showForm} title={t('staff.add')} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <input placeholder={t('field.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder={t('field.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input placeholder={t('field.contact')} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <input placeholder={t('field.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('common.save')}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} title={`${t('common.edit')}${editForm.name ? ' — ' + editForm.name : ''}`} onClose={() => setEditId(null)}>
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(editId); }}>
          <input placeholder={t('field.name')} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <input placeholder={t('field.category')} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
          <input placeholder={t('field.contact')} value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} />
          <input placeholder={t('field.address')} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('common.saveChanges')}</button>
            <button type="button" className="print-btn" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <div className="actions-row">
        <input placeholder={t('staff.searchPlaceholder')} style={{ maxWidth: 280, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('field.name')}</th><th>{t('field.category')}</th><th>{t('field.contact')}</th><th>{t('exp.totalPaid')}</th><th>{t('staff.payments')}</th>
              {canEditDelete() && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {list
              .filter((s) => {
                const q = search.toLowerCase();
                return !q || s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.contact?.toLowerCase().includes(q);
              })
              .map((s) => (
                <React.Fragment key={s.id}>
                  <tr>
                    <td>{s.name}</td>
                    <td>{s.category}</td>
                    <td>{s.contact}</td>
                    <td>₹{parseFloat(s.total_paid).toLocaleString()}</td>
                    <td><button onClick={() => viewDetail(s.id)}>{expandedId === s.id ? t('common.hide') : t('common.view')}</button></td>
                    {canEditDelete() && (
                      <td style={{ display: 'flex', gap: 6 }}>
                        {canEdit() && <button onClick={() => startEdit(s)}>{t('common.edit')}</button>}
                        {canDelete() && <button onClick={() => handleDelete(s.id)}>{t('common.delete')}</button>}
                      </td>
                    )}
                  </tr>

                  {expandedId === s.id && detail && (
                    <tr>
                      <td colSpan={6}>
                        <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                          <strong>{detail.name} — {t('staff.paymentHistory')}</strong>

                          {canAdd() && (
                            <div style={{ margin: '10px 0' }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                                <input type="number" step="0.01" placeholder={t('field.amount')} style={{ width: 130, margin: 0 }} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                                <input type="date" style={{ width: 160, margin: 0 }} value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
                                <input placeholder={t('field.remarks')} style={{ width: 180, margin: 0 }} value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} />
                                <button onClick={() => addPayment(s.id)} disabled={paying}>{paying ? t('common.loading') : t('staff.addPayment')}</button>
                              </div>
                              <CashierSplit key={`staff-${s.id}-${payResetKey}`} cashiers={cashierList} total={parseFloat(payForm.amount) || 0} onChange={setPayCashierAlloc} compact />
                            </div>
                          )}

                          <table>
                            <thead><tr><th>{t('field.date')}</th><th>{t('field.amount')}</th><th>{t('field.remarks')}</th>{canDelete() && <th>{t('common.actions')}</th>}</tr></thead>
                            <tbody>
                              {detail.payments.length === 0 && (
                                <tr><td colSpan={4} className="muted">{t('staff.noPayments')}</td></tr>
                              )}
                              {detail.payments.map((p) => (
                                <tr key={p.id}>
                                  <td>{p.payment_date?.slice(0, 10)}</td>
                                  <td>₹{parseFloat(p.amount).toLocaleString()}</td>
                                  <td>{p.remarks}</td>
                                  {canDelete() && (
                                    <td><button onClick={() => deletePayment(s.id, p.id)}>{t('common.delete')}</button></td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
