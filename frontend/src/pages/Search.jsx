import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../api.js';
import { useI18n } from '../i18n.js';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Search() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runSearch(e) {
    e?.preventDefault();
    if (q.trim().length < 2) return setError(t('search.minChars'));
    setError('');
    setLoading(true);
    try {
      const data = await apiCall(`/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalCount = results
    ? Object.values(results).reduce((s, arr) => s + (arr?.length || 0), 0)
    : 0;

  const Section = ({ title, items, to, render }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>{title} <span className="muted">({items.length})</span></h3>
          {to && <button className="print-btn" onClick={() => navigate(to)}>{t('search.openPage')}</button>}
        </div>
        <div>{items.map(render)}</div>
      </div>
    );
  };

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

      {results && (
        <p className="muted">{t('search.found', { n: totalCount })}</p>
      )}

      {results && totalCount === 0 && !loading && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>{t('common.noRecords')}</p></div>
      )}

      {results && (
        <>
          <Section title={t('nav.members')} items={results.members} to="/members" render={(m) => (
            <div key={`m${m.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <strong>{m.name}</strong> <span className={`badge ${m.role}`} style={{ fontSize: 10 }}>{t(`role.${m.role}`)}</span>
              <span className="muted"> · {m.phone || '-'} · {m.address || ''}</span>
            </div>
          )} />
          <Section title={t('nav.contributions')} items={results.contributions} to="/contributions" render={(c) => (
            <div key={`c${c.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <strong>{c.member_name}</strong> · {inr(c.amount)} <span className="muted">· {c.contribution_date?.slice(0, 10)} {c.remarks ? `· ${c.remarks}` : ''}</span>
            </div>
          )} />
          <Section title={t('nav.expenses')} items={results.expenses} to="/expenses" render={(e) => (
            <div key={`e${e.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
              {inr(e.amount)} · <strong>{e.category || '-'}</strong> <span className="muted">· {e.expense_date?.slice(0, 10)} {e.used_for ? `· ${e.used_for}` : ''}</span>
            </div>
          )} />
          <Section title={t('nav.staff')} items={results.staff} to="/staff" render={(s) => (
            <div key={`s${s.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <strong>{s.name}</strong> <span className="muted">· {s.category || '-'} · {s.contact || ''}</span>
            </div>
          )} />
          <Section title={t('nav.meetings')} items={results.meetings} to="/meetings" render={(m) => (
            <div key={`mt${m.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <strong>{m.subject || '-'}</strong> <span className="muted">· {m.meeting_date?.slice(0, 10)} · {m.location || ''}</span>
            </div>
          )} />
          <Section title={t('ann.title')} items={results.announcements} to="/announcements" render={(a) => (
            <div key={`a${a.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <strong>{a.title}</strong> <span className="muted">· {a.created_at?.slice(0, 10)}</span>
            </div>
          )} />
        </>
      )}
    </div>
  );
}
