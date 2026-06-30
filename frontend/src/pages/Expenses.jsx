import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete } from '../permissions.js';
import { useToast } from '../components/Toast.jsx';
import { useI18n } from '../i18n.js';
import Modal from '../components/Modal.jsx';
import CashierSplit from '../components/CashierSplit.jsx';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function Expenses() {
  const toast = useToast();
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [fundInfo, setFundInfo] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'other'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', expense_date: '', category: '', description: '', used_for: '' });

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', expense_date: '', category: '', description: '', used_for: '' });

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffPayForm, setStaffPayForm] = useState({ staff_id: '', amount: '', payment_date: '', remarks: '' });

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  const [cashierList, setCashierList] = useState([]);
  const [expCashierAlloc, setExpCashierAlloc] = useState([]);
  const [staffCashierAlloc, setStaffCashierAlloc] = useState([]);
  const [editExpCashierAlloc, setEditExpCashierAlloc] = useState([]);
  const [editExpCashierInit, setEditExpCashierInit] = useState([]);
  const [resetKey, setResetKey] = useState(0);
  const [addingExp, setAddingExp] = useState(false);
  const [addingStaffPay, setAddingStaffPay] = useState(false);
  const [editingExp, setEditingExp] = useState(false);

  function load() {
    apiCall('/expenses').then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
    apiCall('/reports/dashboard').then(setFundInfo).catch(() => {});
    apiCall('/staff').then(setStaffList).catch(() => {});
    apiCall('/cashiers').then(setCashierList).catch(() => {});
  }
  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (expCashierAlloc.length === 0) return setError(t('cashier.required'));
    if (addingExp) return;
    setAddingExp(true);
    try {
      await apiCall('/expenses', { method: 'POST', body: JSON.stringify({ ...form, cashiers: expCashierAlloc }) });
      setForm({ amount: '', expense_date: '', category: '', description: '', used_for: '' });
      setExpCashierAlloc([]);
      setResetKey((k) => k + 1);
      setShowForm(false);
      setError('');
      toast.success(t('exp.title'));
      load();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setAddingExp(false);
    }
  }

  async function handleAddStaffPayment(e) {
    e.preventDefault();
    if (!staffPayForm.staff_id) return setError(t('exp.selectStaff'));
    if (!staffPayForm.amount || parseFloat(staffPayForm.amount) <= 0) return setError(t('field.amount'));
    if (staffCashierAlloc.length === 0) return setError(t('cashier.required'));
    if (addingStaffPay) return;
    setAddingStaffPay(true);
    try {
      await apiCall(`/staff/${staffPayForm.staff_id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: staffPayForm.amount, payment_date: staffPayForm.payment_date, remarks: staffPayForm.remarks, cashiers: staffCashierAlloc }),
      });
      setStaffPayForm({ staff_id: '', amount: '', payment_date: '', remarks: '' });
      setStaffCashierAlloc([]);
      setResetKey((k) => k + 1);
      setShowStaffForm(false);
      setError('');
      toast.success(t('exp.addStaffPayment'));
      load();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setAddingStaffPay(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/expenses/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  }

  function startEdit(exp) {
    setEditId(exp.id);
    setEditForm({
      amount: exp.amount,
      expense_date: exp.expense_date ? exp.expense_date.slice(0, 10) : '',
      category: exp.category || '',
      description: exp.description || '',
      used_for: exp.used_for || '',
    });
    const init = (exp.cashiers || []).map((x) => ({ member_id: x.member_id, amount: x.amount }));
    setEditExpCashierInit(init);
    setEditExpCashierAlloc(init);
  }

  async function saveEdit(id) {
    if (editExpCashierAlloc.length === 0) return setError(t('cashier.required'));
    if (editingExp) return;
    setEditingExp(true);
    try {
      await apiCall(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify({ ...editForm, cashiers: editExpCashierAlloc }) });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setEditingExp(false);
    }
  }

  return (
    <div>
      <h2>{t('exp.title')}</h2>
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      {fundInfo && (
        <div className="grid-stats" style={{ marginBottom: 16 }}>
          <div className="stat-box">
            <div className="label">{t('exp.fundAvailable')}</div>
            <div className="value" style={{ background: 'none', WebkitTextFillColor: fundInfo.total_fund_available >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {inr(fundInfo.total_fund_available)}
            </div>
            <span className="stat-icon">🪐</span>
          </div>
          <div className="stat-box">
            <div className="label">{t('exp.totalIn')}</div>
            <div className="value">{inr(fundInfo.total_contribution)}</div>
            <span className="stat-icon">💫</span>
          </div>
          <div className="stat-box">
            <div className="label">{t('exp.totalExpenseAll')}</div>
            <div className="value">{inr(Number(fundInfo.total_expense) + Number(fundInfo.total_staff_paid))}</div>
            <span className="stat-icon">🛰️</span>
          </div>
          <div className="stat-box">
            <div className="label">{t('exp.otherOut')}</div>
            <div className="value">{inr(fundInfo.total_expense)}</div>
            <span className="stat-icon">🧾</span>
          </div>
          <div className="stat-box">
            <div className="label">{t('exp.staffOut')}</div>
            <div className="value">{inr(fundInfo.total_staff_paid)}</div>
            <span className="stat-icon">👨‍🔧</span>
          </div>
        </div>
      )}

      <div className="actions-row">
        {canAdd() && activeTab === 'other' && (
          <button onClick={() => setShowForm(true)}>+ {t('exp.add')}</button>
        )}
        {canAdd() && activeTab === 'staff' && (
          <button onClick={() => setShowStaffForm(true)}>+ {t('exp.addStaffPayment')}</button>
        )}
      </div>

      <Modal open={showForm} title={t('exp.add')} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <input type="number" step="0.01" placeholder={t('field.amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          <input placeholder={t('field.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input placeholder={t('field.usedFor')} value={form.used_for} onChange={(e) => setForm({ ...form, used_for: e.target.value })} />
          <textarea placeholder={t('field.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <CashierSplit key={`exp-add-${resetKey}`} cashiers={cashierList} total={parseFloat(form.amount) || 0} onChange={setExpCashierAlloc} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={addingExp}>{addingExp ? t('common.loading') : t('common.save')}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showStaffForm} title={t('exp.addStaffPayment')} onClose={() => setShowStaffForm(false)}>
        <form onSubmit={handleAddStaffPayment}>
          <select value={staffPayForm.staff_id} onChange={(e) => setStaffPayForm({ ...staffPayForm, staff_id: e.target.value })} required>
            <option value="">{t('exp.selectStaff')}</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name} {s.category ? `(${s.category})` : ''}</option>
            ))}
          </select>
          <input type="number" step="0.01" placeholder={t('field.amount')} value={staffPayForm.amount} onChange={(e) => setStaffPayForm({ ...staffPayForm, amount: e.target.value })} required />
          <input type="date" value={staffPayForm.payment_date} onChange={(e) => setStaffPayForm({ ...staffPayForm, payment_date: e.target.value })} />
          <textarea placeholder={t('field.remarks')} value={staffPayForm.remarks} onChange={(e) => setStaffPayForm({ ...staffPayForm, remarks: e.target.value })} />
          <CashierSplit key={`staff-pay-${resetKey}`} cashiers={cashierList} total={parseFloat(staffPayForm.amount) || 0} onChange={setStaffCashierAlloc} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={addingStaffPay}>{addingStaffPay ? t('common.loading') : t('common.save')}</button>
            <button type="button" className="print-btn" onClick={() => setShowStaffForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} title={t('common.edit')} onClose={() => setEditId(null)}>
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(editId); }}>
          <input type="number" step="0.01" placeholder={t('field.amount')} value={editForm.amount} onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })} />
          <input type="date" value={editForm.expense_date} onChange={(ev) => setEditForm({ ...editForm, expense_date: ev.target.value })} />
          <input placeholder={t('field.category')} value={editForm.category} onChange={(ev) => setEditForm({ ...editForm, category: ev.target.value })} />
          <input placeholder={t('field.usedFor')} value={editForm.used_for} onChange={(ev) => setEditForm({ ...editForm, used_for: ev.target.value })} />
          <textarea placeholder={t('field.description')} value={editForm.description} onChange={(ev) => setEditForm({ ...editForm, description: ev.target.value })} />
          <CashierSplit key={`exp-edit-${editId}`} cashiers={cashierList} total={parseFloat(editForm.amount) || 0} initial={editExpCashierInit} onChange={setEditExpCashierAlloc} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={editingExp}>{editingExp ? t('common.loading') : t('common.saveChanges')}</button>
            <button type="button" className="print-btn" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <div className="actions-row" style={{ marginTop: -8 }}>
        <button onClick={() => setActiveTab('staff')} className={activeTab === 'staff' ? '' : 'print-btn'}>{t('exp.tabStaff')}</button>
        <button onClick={() => setActiveTab('other')} className={activeTab === 'other' ? '' : 'print-btn'}>{t('exp.tabOther')}</button>
      </div>

      {activeTab === 'other' && (
        <>
          <div className="actions-row" style={{ flexWrap: 'wrap' }}>
            <input placeholder={t('exp.searchPlaceholder')} style={{ maxWidth: 220, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <th>{t('field.date')}</th><th>{t('field.amount')}</th><th>{t('field.category')}</th><th>{t('field.usedFor')}</th><th>{t('field.description')}</th>
                  {canEditDelete() && <th>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {list
                  .filter((e) => {
                    const q = search.toLowerCase();
                    const matchesSearch = !q || e.category?.toLowerCase().includes(q) || e.used_for?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
                    const d = e.expense_date?.slice(0, 10);
                    const matchesFrom = !dateFrom || (d && d >= dateFrom);
                    const matchesTo = !dateTo || (d && d <= dateTo);
                    return matchesSearch && matchesFrom && matchesTo;
                  })
                  .map((e) => (
                    <tr key={e.id}>
                      <td>{e.expense_date?.slice(0, 10)}</td>
                      <td>{inr(e.amount)}</td>
                      <td>{e.category}</td>
                      <td>{e.used_for}</td>
                      <td>{e.description}</td>
                      {canEditDelete() && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          {canEdit() && <button onClick={() => startEdit(e)}>{t('common.edit')}</button>}
                          {canDelete() && <button onClick={() => handleDelete(e.id)}>{t('common.delete')}</button>}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'staff' && (
        <>
          <div className="card">
            <p className="muted">{t('exp.staffSummaryNote')}</p>
            <input placeholder={t('exp.searchStaff')} style={{ maxWidth: 280 }} value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
            <table>
              <thead><tr><th>{t('field.name')}</th><th>{t('field.category')}</th><th>{t('field.contact')}</th><th>{t('exp.totalPaid')}</th></tr></thead>
              <tbody>
                {staffList.length === 0 && <tr><td colSpan={4} className="muted">{t('exp.noStaff')}</td></tr>}
                {staffList
                  .filter((s) => {
                    const q = staffSearch.toLowerCase();
                    return !q || s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q);
                  })
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.category}</td>
                      <td>{s.contact}</td>
                      <td>{inr(s.total_paid)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
