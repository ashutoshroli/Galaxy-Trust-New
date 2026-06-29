import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { isSuperAdmin } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Cashier() {
  const { t } = useI18n();
  const toast = useToast();

  const [cashiers, setCashiers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function load() {
    apiCall('/cashiers').then(setCashiers).catch((e) => setError(e.message));
    apiCall('/cashiers/members').then(setAllMembers).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (isSuperAdmin()) load();
  }, []);

  async function addCashier(member) {
    setBusyId(member.member_id);
    try {
      await apiCall('/cashiers', { method: 'POST', body: JSON.stringify({ member_id: member.member_id }) });
      toast.success(t('cashier.added'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeCashier(memberId) {
    if (!window.confirm(t('cashier.removeConfirm'))) return;
    setBusyId(memberId);
    try {
      await apiCall(`/cashiers/${memberId}`, { method: 'DELETE' });
      toast.success(t('cashier.removed'));
      if (expandedId === memberId) { setExpandedId(null); setDetail(null); }
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDetail(memberId) {
    if (expandedId === memberId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(memberId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiCall(`/cashiers/${memberId}/detail`);
      setDetail(d);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  if (!isSuperAdmin()) {
    return <div className="card error-text">Access denied.</div>;
  }

  const nonCashiers = allMembers.filter((m) => !m.is_cashier);
  const filteredNonCashiers = nonCashiers.filter((m) => {
    const q = memberSearch.toLowerCase();
    return !q || m.name?.toLowerCase().includes(q);
  });

  return (
    <div>
      <h2>👛 {t('cashier.title')}</h2>
      <p className="muted">{t('cashier.subtitle')}</p>
      {error && <div className="error-text">{error}</div>}

      <div className="actions-row">
        <button onClick={() => setShowAdd(true)}>+ {t('cashier.add')}</button>
      </div>

      <Modal open={showAdd} title={t('cashier.add')} onClose={() => setShowAdd(false)}>
        <input
          placeholder={t('members.searchPlaceholder')}
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
        />
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filteredNonCashiers.length === 0 && (
            <p className="muted">{t('cashier.allAdded')}</p>
          )}
          {filteredNonCashiers.map((m) => (
            <div key={m.member_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span>
                {m.name} <span className={`badge ${m.role}`} style={{ fontSize: 10 }}>{t(`role.${m.role}`)}</span>
              </span>
              <button className="print-btn" disabled={busyId === m.member_id} onClick={() => addCashier(m)}>
                + {t('cashier.makeCashier')}
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('cashier.cashier')}</th>
              <th>{t('cashier.totalIn')}</th>
              <th>{t('cashier.totalOut')}</th>
              <th>{t('field.balance')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {cashiers.length === 0 && (
              <tr><td colSpan={5} className="muted">{t('cashier.noneYet')}</td></tr>
            )}
            {cashiers.map((c) => (
              <React.Fragment key={c.member_id}>
                <tr className="clickable-row" onClick={() => toggleDetail(c.member_id)}>
                  <td>
                    {c.name}{' '}
                    <span className={`badge ${c.member_role}`} style={{ fontSize: 10 }}>{t(`role.${c.member_role}`)}</span>
                  </td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{inr(c.total_in)}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{inr(c.total_out)}</td>
                  <td style={{ fontWeight: 600 }}>{inr(c.balance)}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                    <button className="print-btn" onClick={() => toggleDetail(c.member_id)}>
                      {expandedId === c.member_id ? t('common.hide') : t('common.view')}
                    </button>
                    <button disabled={busyId === c.member_id} onClick={() => removeCashier(c.member_id)}>
                      {t('cashier.remove')}
                    </button>
                  </td>
                </tr>

                {expandedId === c.member_id && (
                  <tr>
                    <td colSpan={5}>
                      <div className="card" style={{ background: 'var(--subcard-bg)' }}>
                        {detailLoading && <p className="muted">{t('common.loading')}</p>}
                        {detail && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                            <div>
                              <strong>⬇️ {t('cashier.receivedFrom')} ({inr(detail.total_in)})</strong>
                              <table style={{ marginTop: 8 }}>
                                <thead><tr><th>{t('contrib.member')}</th><th>{t('field.amount')}</th></tr></thead>
                                <tbody>
                                  {detail.received_from.length === 0 && (
                                    <tr><td colSpan={2} className="muted">{t('common.noRecords')}</td></tr>
                                  )}
                                  {detail.received_from.map((r) => (
                                    <tr key={r.member_id}>
                                      <td>{r.member_name}</td>
                                      <td style={{ color: 'var(--success)' }}>{inr(r.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div>
                              <strong>⬆️ {t('cashier.givenTo')} ({inr(detail.total_out)})</strong>
                              <table style={{ marginTop: 8 }}>
                                <thead><tr><th>{t('field.details')}</th><th>{t('field.amount')}</th></tr></thead>
                                <tbody>
                                  {detail.given_to.length === 0 && (
                                    <tr><td colSpan={2} className="muted">{t('common.noRecords')}</td></tr>
                                  )}
                                  {detail.given_to.map((g, i) => (
                                    <tr key={i}>
                                      <td>{g.kind === 'staff' ? '👨‍🔧 ' : '🧾 '}{g.name}</td>
                                      <td style={{ color: 'var(--danger)' }}>{inr(g.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
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
