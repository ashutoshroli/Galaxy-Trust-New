import React, { useState } from 'react';
import { apiCall } from '../api.js';
import { useI18n } from '../i18n.js';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Search() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // inline expand state: a unique key like "member-5" + loaded detail
  const [openKey, setOpenKey] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function runSearch(e) {
    e?.preventDefault();
    if (q.trim().length < 2) return setError(t('search.minChars'));
    setError('');
    setLoading(true);
    setOpenKey(null);
    try {
      const data = await apiCall(`/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleMember(m) {
    const key = `member-${m.id}`;
    if (openKey === key) { setOpenKey(null); setMemberDetail(null); return; }
    setOpenKey(key);
    setMemberDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiCall(`/reports/member-detail/${m.id}`);
      setMemberDetail(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleSimple(key) {
    setOpenKey(openKey === key ? null : key);
  }

  const totalCount = results
    ? Object.values(results).reduce((s, arr) => s + (arr?.length || 0), 0)
    : 0;

  const Row = ({ open, onClick, children, detail }) => (
    <div style={{ borderBottom: '1px solid var(--glass-border)' }}>
      <div className="clickable-row" onClick={onClick} style={{ padding: '8px 4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>{children}</div>
        <span className="muted">{open ? '−' : '+'}</span>
      </div>
      {open && <div style={{ padding: '6px 4px 12px' }}>{detail}</div>}
    </div>
  );

  return (
    <div>
      <h2>🔍 {t('search.title')}</h2>

      <form className="actions-row" onSubmit={runSearch}>
        <input
          autoFocus
          placeholder={t('search.placeholder')}
          style={{ maxWidth: 360, margin: 0 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={loading}>{loading ? t('common.loading') : t('common.search')}</button>
      </form>

      {error && <div className="error-text">{error}</div>}
      {results && <p className="muted">{t('search.found', { n: totalCount })}</p>}
      {results && totalCount === 0 && !loading && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>{t('common.noRecords')}</p></div>
      )}

      {/* Members */}
      {results?.members?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('nav.members')} <span className="muted">({results.members.length})</span></h3>
          {results.members.map((m) => (
            <Row
              key={m.id}
              open={openKey === `member-${m.id}`}
              onClick={() => toggleMember(m)}
              detail={
                <div className="card" style={{ background: 'var(--subcard-bg)', marginBottom: 0 }}>
                  {detailLoading && openKey === `member-${m.id}` && <p className="muted">{t('common.loading')}</p>}
                  {memberDetail && openKey === `member-${m.id}` && (
                    <>
                      <p className="muted" style={{ marginTop: 0 }}>{t('members.totalGiven')}: <strong>{inr(memberDetail.total_given)}</strong></p>
                      <strong>{t('members.installmentPlans')}</strong>
                      <table style={{ marginBottom: 12 }}>
                        <thead><tr><th>{t('field.type')}</th><th>{t('field.total')}</th><th>{t('field.paid')}</th><th>{t('field.balance')}</th></tr></thead>
                        <tbody>
                          {memberDetail.installments.length === 0 && <tr><td colSpan={4} className="muted">{t('common.noRecords')}</td></tr>}
                          {memberDetail.installments.map((i) => (
                            <tr key={i.id}>
                              <td>{i.type}</td>
                              <td>{inr(i.total_amount)}</td>
                              <td>{inr(i.paid_amount)}</td>
                              <td style={{ color: parseFloat(i.balance) > 0 ? '#dc2626' : '#059669' }}>{inr(i.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <strong>{t('members.contributionsHeading')}</strong>
                      <table>
                        <thead><tr><th>{t('field.date')}</th><th>{t('contrib.installmentType')}</th><th>{t('field.amount')}</th></tr></thead>
                        <tbody>
                          {memberDetail.contributions.length === 0 && <tr><td colSpan={3} className="muted">{t('common.noRecords')}</td></tr>}
                          {memberDetail.contributions.map((c) => (
                            <tr key={c.contribution_id}>
                              <td>{c.date?.slice(0, 10)}</td>
                              <td>{c.installment_type || '-'}</td>
                              <td>{inr(c.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              }
            >
              <strong>{m.name}</strong> <span className={`badge ${m.role}`} style={{ fontSize: 10 }}>{t(`role.${m.role}`)}</span>
              <span className="muted"> · {m.phone || '-'}</span>
            </Row>
          ))}
        </div>
      )}

      {/* Contributions */}
      {results?.contributions?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('nav.contributions')} <span className="muted">({results.contributions.length})</span></h3>
          {results.contributions.map((c) => (
            <Row key={c.id} open={openKey === `c-${c.id}`} onClick={() => toggleSimple(`c-${c.id}`)}
              detail={<div className="muted">{t('field.date')}: {c.contribution_date?.slice(0, 10)} · {t('field.mode')}: {c.mode || '-'}{c.remarks ? ` · ${c.remarks}` : ''}</div>}>
              <strong>{c.member_name}</strong> · {inr(c.amount)}
            </Row>
          ))}
        </div>
      )}

      {/* Expenses */}
      {results?.expenses?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('nav.expenses')} <span className="muted">({results.expenses.length})</span></h3>
          {results.expenses.map((e) => (
            <Row key={e.id} open={openKey === `e-${e.id}`} onClick={() => toggleSimple(`e-${e.id}`)}
              detail={<div className="muted">{t('field.date')}: {e.expense_date?.slice(0, 10)}{e.used_for ? ` · ${t('field.usedFor')}: ${e.used_for}` : ''}{e.description ? ` · ${e.description}` : ''}</div>}>
              {inr(e.amount)} · <strong>{e.category || '-'}</strong>
            </Row>
          ))}
        </div>
      )}

      {/* Staff */}
      {results?.staff?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('nav.staff')} <span className="muted">({results.staff.length})</span></h3>
          {results.staff.map((s) => (
            <Row key={s.id} open={openKey === `s-${s.id}`} onClick={() => toggleSimple(`s-${s.id}`)}
              detail={<div className="muted">{t('field.category')}: {s.category || '-'} · {t('field.contact')}: {s.contact || '-'}</div>}>
              <strong>{s.name}</strong>
            </Row>
          ))}
        </div>
      )}

      {/* Meetings */}
      {results?.meetings?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('nav.meetings')} <span className="muted">({results.meetings.length})</span></h3>
          {results.meetings.map((m) => (
            <Row key={m.id} open={openKey === `mt-${m.id}`} onClick={() => toggleSimple(`mt-${m.id}`)}
              detail={<div className="muted">{t('field.date')}: {m.meeting_date?.slice(0, 10)} · {t('field.location')}: {m.location || '-'}</div>}>
              <strong>{m.subject || '-'}</strong>
            </Row>
          ))}
        </div>
      )}

      {/* Announcements */}
      {results?.announcements?.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('ann.title')} <span className="muted">({results.announcements.length})</span></h3>
          {results.announcements.map((a) => (
            <Row key={a.id} open={openKey === `a-${a.id}`} onClick={() => toggleSimple(`a-${a.id}`)}
              detail={<div className="muted">{a.created_at?.slice(0, 10)}</div>}>
              <strong>{a.title}</strong>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
