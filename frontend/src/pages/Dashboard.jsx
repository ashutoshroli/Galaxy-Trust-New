import React, { useEffect, useState } from 'react';
import { apiCall, getUser } from '../api.js';
import { useI18n } from '../i18n.js';

function StatBox({ label, value, icon, color }) {
  return (
    <div className="stat-box">
      <div className="label">{label}</div>
      <div className="value" style={color ? { background: 'none', WebkitTextFillColor: color, color } : undefined}>
        {value}
      </div>
      <span className="stat-icon" aria-hidden="true">{icon}</span>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [fundUsage, setFundUsage] = useState([]);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    apiCall('/reports/dashboard').then(setStats).catch((e) => setError(e.message));
    apiCall('/reports/fund-usage').then(setFundUsage).catch(() => {});
  }, []);

  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  if (error) return <div className="card error-text">{error}</div>;
  if (!stats) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 50 }}>
        <div className="spinner" />
        <p className="muted" style={{ marginTop: 14 }}>{t('common.loading')}</p>
      </div>
    );
  }

  const totalUsage = fundUsage.reduce((s, r) => s + Number(r.total_amount), 0);
  const palette = ['#7c3aed', '#22d3ee', '#d946ef', '#34d399', '#fbbf24', '#fb7185', '#60a5fa'];
  const totalExpenseAll = Number(stats.total_expense) + Number(stats.total_staff_paid ?? 0);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ marginBottom: 4 }}>
          {t('dash.welcome')}, <span className="gradient-text">{user?.username || ''}</span>
        </h2>
        <p className="muted" style={{ margin: 0 }}>{t('dash.subtitle')}</p>
      </div>

      <div className="grid-stats">
        <StatBox label={t('dash.totalContribution')} value={inr(stats.total_contribution)} icon="💫" />
        <StatBox label={t('dash.totalExpenseAll')} value={inr(totalExpenseAll)} icon="🛰️" />
        <StatBox label={t('dash.otherExpense')} value={inr(stats.total_expense)} icon="🧾" />
        <StatBox label={t('dash.staffPaid')} value={inr(stats.total_staff_paid ?? 0)} icon="👨‍🔧" />
        <StatBox
          label={t('dash.balance')}
          value={inr(stats.balance)}
          icon="🪐"
          color={stats.balance >= 0 ? 'var(--success)' : 'var(--danger)'}
        />
        <StatBox label={t('dash.members')} value={stats.total_members} icon="🧑‍🚀" />
        <StatBox label={t('dash.meetings')} value={stats.total_meetings} icon="📡" />
        <StatBox label={t('dash.pending')} value={inr(stats.pending_installments)} icon="⏳" />
      </div>

      {fundUsage.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>{t('dash.fundUsage')}</h3>
            <span className="muted">{t('dash.totalUsed')}: {inr(totalUsage)}</span>
          </div>
          <div style={{ marginTop: 14 }}>
            {fundUsage
              .slice()
              .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
              .map((row, idx) => {
                const pct = totalUsage > 0 ? (Number(row.total_amount) / totalUsage) * 100 : 0;
                const color = palette[idx % palette.length];
                return (
                  <div key={idx} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                      <span>{row.category}</span>
                      <span className="muted">{inr(row.total_amount)} · {pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 9, borderRadius: 999, background: 'rgba(140,150,230,0.12)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                          boxShadow: `0 0 12px ${color}88`,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
