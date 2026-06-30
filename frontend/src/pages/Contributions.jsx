import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { canAdd, canEdit, canDelete, canEditDelete } from '../permissions.js';
import { printHTML } from '../printHelper.js';
import { useI18n } from '../i18n.js';
import Modal from '../components/Modal.jsx';
import CashierSplit, { splitRowByCashiers } from '../components/CashierSplit.jsx';

const MODES = ['cash', 'online', 'cheque'];

export default function Contributions() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [installmentAmounts, setInstallmentAmounts] = useState({});
  const [sharedFields, setSharedFields] = useState({ contribution_date: '', mode: 'cash', remarks: '' });

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editForm, setEditForm] = useState({ amount: '', contribution_date: '', mode: 'cash', remarks: '' });
  const [lastReceipt, setLastReceipt] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [cashierList, setCashierList] = useState([]);
  const [cashierAlloc, setCashierAlloc] = useState([]);
  const [addResetKey, setAddResetKey] = useState(0);
  const [editCashierAlloc, setEditCashierAlloc] = useState([]);
  const [editCashierInit, setEditCashierInit] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    apiCall('/contributions').then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
    apiCall('/contributions/pending-members').then(setPendingMembers).catch(() => {});
    apiCall('/cashiers').then(setCashierList).catch(() => {});
  }
  useEffect(load, []);

  const grandTotal = Object.values(installmentAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const selectedMember = pendingMembers.find((m) => String(m.member_id) === String(selectedMemberId));

  function handleInstallmentAmountChange(installmentId, value, balance) {
    let v = value;
    if (v !== '' && parseFloat(v) > parseFloat(balance)) v = String(balance);
    setInstallmentAmounts({ ...installmentAmounts, [installmentId]: v });
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!selectedMemberId) return setError(t('contrib.selectMember'));
    const entries = Object.entries(installmentAmounts).filter(([, v]) => v !== '' && parseFloat(v) > 0);
    if (entries.length === 0) return setError(t('contrib.amountPaying'));
    if (submitting) return;
    setSubmitting(true);
    try {
      const savedReceiptItems = [];
      for (const [installmentId, amt] of entries) {
        const rowCashiers = splitRowByCashiers(parseFloat(amt), cashierAlloc, grandTotal);
        await apiCall('/contributions', {
          method: 'POST',
          body: JSON.stringify({
            member_id: selectedMemberId,
            amount: amt,
            installment_id: parseInt(installmentId),
            contribution_date: sharedFields.contribution_date,
            mode: sharedFields.mode,
            remarks: sharedFields.remarks,
            cashiers: rowCashiers,
          }),
        });
        savedReceiptItems.push({ installment_id: installmentId, amount: amt });
      }
      setLastReceipt({
        member_name: selectedMember?.member_name,
        date: sharedFields.contribution_date || new Date().toISOString().slice(0, 10),
        mode: sharedFields.mode,
        items: savedReceiptItems,
        total: entries.reduce((s, [, v]) => s + parseFloat(v), 0),
      });
      setSelectedMemberId('');
      setInstallmentAmounts({});
      setSharedFields({ contribution_date: '', mode: 'cash', remarks: '' });
      setCashierAlloc([]);
      setAddResetKey((k) => k + 1);
      setShowForm(false);
      setError('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/contributions/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(c) {
    setEditId(c.id);
    setEditName(c.member_name || '');
    setEditForm({
      amount: c.amount,
      contribution_date: c.contribution_date ? c.contribution_date.slice(0, 10) : '',
      mode: c.mode || 'cash',
      remarks: c.remarks || '',
    });
    const init = (c.cashiers || []).map((x) => ({ member_id: x.member_id, amount: x.amount }));
    setEditCashierInit(init);
    setEditCashierAlloc(init);
  }

  async function saveEdit(id) {
    if (editSaving) return;
    setEditSaving(true);
    try {
      await apiCall(`/contributions/${id}`, { method: 'PUT', body: JSON.stringify({ ...editForm, cashiers: editCashierAlloc }) });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleExpand(c) {
    if (expandedId === c.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(c.id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await apiCall(`/reports/contribution-detail/${c.id}`);
      setDetail(data);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function printReceipt() {
    if (!lastReceipt) return;
    printHTML(t('contrib.printReceipt'), `
      <h3>${t('contrib.title')} — ${t('common.print')}</h3>
      <p><strong>${t('contrib.member')}:</strong> ${lastReceipt.member_name}<br/>
      <strong>${t('field.date')}:</strong> ${lastReceipt.date}<br/>
      <strong>${t('field.mode')}:</strong> ${t(`mode.${lastReceipt.mode}`)}</p>
      <table>
        <tr><th>${t('contrib.installmentType')}</th><th>${t('field.amount')}</th></tr>
        ${lastReceipt.items.map((i) => `<tr><td>#${i.installment_id}</td><td>₹${parseFloat(i.amount).toLocaleString()}</td></tr>`).join('')}
        <tr><td><strong>${t('field.total')}</strong></td><td><strong>₹${lastReceipt.total.toLocaleString()}</strong></td></tr>
      </table>
    `);
  }

  function printContributionDetail() {
    if (!detail) return;
    printHTML(`${t('contrib.title')} #${detail.contribution.id}`, `
      <h3>#${detail.contribution.id} — ${detail.contribution.member_name}</h3>
      <p class="muted">
        ${t('field.date')}: ${detail.contribution.contribution_date ? detail.contribution.contribution_date.slice(0, 10) : '-'} |
        ${t('field.amount')}: ₹${parseFloat(detail.contribution.amount).toLocaleString()} | ${t('field.mode')}: ${t(`mode.${detail.contribution.mode}`)}
      </p>
      <p class="muted">${t('contrib.installmentType')}: ${detail.contribution.installment_type || '-'}</p>
      ${detail.contribution.remarks ? `<p class="muted">${t('field.remarks')}: ${detail.contribution.remarks}</p>` : ''}
    `);
  }

  function printAllContributions() {
    const rows = list.map((c) => `
      <tr>
        <td>${c.contribution_date?.slice(0, 10)}</td>
        <td>${c.member_name}</td>
        <td>₹${parseFloat(c.amount).toLocaleString()}</td>
        <td>${t(`mode.${c.mode}`)}</td>
        <td>${c.remarks || ''}</td>
      </tr>`).join('');
    printHTML(t('contrib.title'), `
      <h3>${t('contrib.title')}</h3>
      <table><thead><tr><th>${t('field.date')}</th><th>${t('contrib.member')}</th><th>${t('field.amount')}</th><th>${t('field.mode')}</th><th>${t('field.remarks')}</th></tr></thead>
      <tbody>${rows}</tbody></table>
    `);
  }

  const ModeSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange}>
      {MODES.map((m) => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
    </select>
  );

  return (
    <div>
      <div className="card-header">
        <h2>{t('contrib.title')}</h2>
        <button className="print-btn" onClick={printAllContributions}>🖨 {t('common.printAll')}</button>
      </div>
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      {lastReceipt && (
        <div className="card" style={{ background: 'rgba(52,211,153,0.12)' }}>
          {t('contrib.paymentSaved')} <strong>{lastReceipt.member_name}</strong> — {t('field.total')} ₹{lastReceipt.total.toLocaleString()}
          {' '}<button onClick={printReceipt}>{t('contrib.printReceipt')}</button>
          {' '}<button className="print-btn" onClick={() => setLastReceipt(null)}>{t('contrib.dismiss')}</button>
        </div>
      )}

      <div className="actions-row">
        {canAdd() && (
          <button onClick={() => setShowForm(true)}>+ {t('contrib.add')}</button>
        )}
      </div>

      <Modal open={showForm} title={t('contrib.add')} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <select value={selectedMemberId} onChange={(e) => { setSelectedMemberId(e.target.value); setInstallmentAmounts({}); }} required>
            <option value="">{t('contrib.selectMember')}</option>
            {pendingMembers.map((m) => (
              <option key={m.member_id} value={m.member_id}>{m.member_name}</option>
            ))}
          </select>

          {pendingMembers.length === 0 && <p className="muted">{t('contrib.noPending')}</p>}

          {selectedMember && (
            <div style={{ marginBottom: 10 }}>
              <p><strong>{t('contrib.pendingInstallments')} {selectedMember.member_name}</strong></p>
              {selectedMember.installments.map((inst) => (
                <div key={inst.installment_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 14 }}>
                    <strong>{inst.type || 'General'}</strong> — {t('field.total')}: ₹{parseFloat(inst.total_amount).toLocaleString()}
                    {' '}— <span style={{ color: '#fb7185', fontWeight: 600 }}>{t('field.balance')}: ₹{parseFloat(inst.balance).toLocaleString()}</span>
                    {inst.due_date && <span className="muted"> ({t('field.dueDate')}: {inst.due_date.slice(0, 10)})</span>}
                  </span>
                  <input
                    type="number" step="0.01" placeholder={t('contrib.amountPaying')}
                    style={{ width: 150, margin: 0 }}
                    value={installmentAmounts[inst.installment_id] || ''}
                    onChange={(e) => handleInstallmentAmountChange(inst.installment_id, e.target.value, inst.balance)}
                  />
                </div>
              ))}
            </div>
          )}

          <input type="date" value={sharedFields.contribution_date} onChange={(e) => setSharedFields({ ...sharedFields, contribution_date: e.target.value })} />
          <ModeSelect value={sharedFields.mode} onChange={(e) => setSharedFields({ ...sharedFields, mode: e.target.value })} />
          <textarea placeholder={t('field.remarks')} value={sharedFields.remarks} onChange={(e) => setSharedFields({ ...sharedFields, remarks: e.target.value })} />

          <CashierSplit
            key={`add-${selectedMemberId}-${addResetKey}`}
            cashiers={cashierList}
            total={grandTotal}
            onChange={setCashierAlloc}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={submitting}>{submitting ? t('common.loading') : t('contrib.savePayment')}</button>
            <button type="button" className="print-btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editId} title={`${t('common.edit')}${editName ? ' — ' + editName : ''}`} onClose={() => setEditId(null)}>
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(editId); }}>
          <input type="number" step="0.01" placeholder={t('field.amount')} value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
          <input type="date" value={editForm.contribution_date} onChange={(e) => setEditForm({ ...editForm, contribution_date: e.target.value })} />
          <ModeSelect value={editForm.mode} onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })} />
          <textarea placeholder={t('field.remarks')} value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
          <CashierSplit
            key={`edit-${editId}`}
            cashiers={cashierList}
            total={parseFloat(editForm.amount) || 0}
            initial={editCashierInit}
            onChange={setEditCashierAlloc}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={editSaving}>{editSaving ? t('common.loading') : t('common.saveChanges')}</button>
            <button type="button" className="print-btn" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      </Modal>

      <div className="actions-row" style={{ flexWrap: 'wrap' }}>
        <input placeholder={t('contrib.searchPlaceholder')} style={{ maxWidth: 220, margin: 0 }} value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <th>{t('field.date')}</th><th>{t('contrib.member')}</th><th>{t('field.amount')}</th><th>{t('field.mode')}</th><th>{t('field.remarks')}</th>
              {canEditDelete() && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {list
              .filter((c) => {
                const q = search.toLowerCase();
                const matchesSearch = !q || c.member_name?.toLowerCase().includes(q) || c.remarks?.toLowerCase().includes(q) || c.mode?.toLowerCase().includes(q);
                const d = c.contribution_date?.slice(0, 10);
                const matchesFrom = !dateFrom || (d && d >= dateFrom);
                const matchesTo = !dateTo || (d && d <= dateTo);
                return matchesSearch && matchesFrom && matchesTo;
              })
              .map((c) => (
                <React.Fragment key={c.id}>
                  <tr className="clickable-row" onClick={() => toggleExpand(c)}>
                    <td>{c.contribution_date?.slice(0, 10)}</td>
                    <td>{c.member_name}</td>
                    <td>₹{parseFloat(c.amount).toLocaleString()}</td>
                    <td>{t(`mode.${c.mode}`)}</td>
                    <td>{c.remarks}</td>
                    {canEditDelete() && (
                      <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {canEdit() && <button onClick={() => startEdit(c)}>{t('common.edit')}</button>}
                        {canDelete() && <button onClick={() => handleDelete(c.id)}>{t('common.delete')}</button>}
                      </td>
                    )}
                  </tr>
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={6}>
                        <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                          {detailLoading && <p className="muted">{t('common.loading')}</p>}
                          {detailError && <div className="error-text">{detailError}</div>}
                          {detail && (
                            <>
                              <div className="card-header">
                                <h3>{t('contrib.title')} #{detail.contribution.id}</h3>
                                <button className="print-btn" onClick={printContributionDetail}>🖨 {t('common.print')}</button>
                              </div>
                              <p className="muted">
                                {t('contrib.installmentType')}: <strong>{detail.contribution.installment_type || '-'}</strong>
                              </p>
                              <table>
                                <thead><tr><th>{t('field.date')}</th><th>{t('field.amount')}</th><th>{t('field.mode')}</th><th>{t('field.remarks')}</th></tr></thead>
                                <tbody>
                                  <tr>
                                    <td>{detail.contribution.contribution_date?.slice(0, 10) || '-'}</td>
                                    <td>₹{parseFloat(detail.contribution.amount).toLocaleString()}</td>
                                    <td>{t(`mode.${detail.contribution.mode}`)}</td>
                                    <td>{detail.contribution.remarks || '-'}</td>
                                  </tr>
                                </tbody>
                              </table>
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
