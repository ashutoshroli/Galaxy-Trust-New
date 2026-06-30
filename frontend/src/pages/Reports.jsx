import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { printHTML } from '../printHelper.js';
import { downloadCSV } from '../utils/csv.js';
import { useI18n } from '../i18n.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Reports() {
  const { t } = useI18n();
  const [ledgerRaw, setLedgerRaw] = useState([]);
  const [installmentsRaw, setInstallmentsRaw] = useState([]);
  const [expensesRaw, setExpensesRaw] = useState([]);
  const [cashiersRaw, setCashiersRaw] = useState([]);
  const [expandedMember, setExpandedMember] = useState(null);
  const [error, setError] = useState('');

  const nowYear = new Date().getFullYear();
  const [annualYear, setAnnualYear] = useState(nowYear);
  const [annual, setAnnual] = useState(null);

  // Date range filter (applies to every report)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // All sections start collapsed; open on '+'
  const [open, setOpen] = useState({
    installmentsByMember: false,
    byType: false,
    ledger: false,
    contrib: false,
    expense: false,
    due: false,
    cashiers: false,
  });
  const [openTypes, setOpenTypes] = useState({});

  useEffect(() => {
    apiCall('/reports/member-balance-ledger').then(setLedgerRaw).catch((e) => setError(e.message));
    apiCall('/installments').then(setInstallmentsRaw).catch((e) => setError(e.message));
    apiCall('/expenses').then(setExpensesRaw).catch(() => {});
    apiCall('/reports/cashiers').then(setCashiersRaw).catch(() => {});
  }, []);

  useEffect(() => {
    apiCall(`/reports/annual?year=${annualYear}`).then(setAnnual).catch(() => {});
  }, [annualYear]);

  function printAnnual() {
    if (!annual) return;
    const rows = annual.months.map((m) =>
      `<tr><td>${MONTHS[m.month - 1]}</td><td>₹${m.income.toLocaleString()}</td><td>₹${m.expense.toLocaleString()}</td><td>₹${m.staff.toLocaleString()}</td><td>₹${m.out.toLocaleString()}</td><td>₹${m.net.toLocaleString()}</td></tr>`
    ).join('');
    printHTML(`${t('rep.annual')} ${annual.year}`, `
      <h3>${t('rep.annual')} — ${annual.year}</h3>
      <p class="muted">${t('rep.totalIncome')}: ₹${annual.total_income.toLocaleString()} | ${t('rep.totalOut')}: ₹${annual.total_out.toLocaleString()} | ${t('rep.net')}: ₹${annual.net.toLocaleString()}</p>
      <table><thead><tr><th>${t('rep.month')}</th><th>${t('dash.income')}</th><th>${t('dash.otherExpense')}</th><th>${t('dash.staffPaid')}</th><th>${t('rep.totalOut')}</th><th>${t('rep.net')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function exportAnnualCSV() {
    if (!annual) return;
    downloadCSV(`annual-${annual.year}.csv`,
      [t('rep.month'), t('dash.income'), t('dash.otherExpense'), t('dash.staffPaid'), t('rep.totalOut'), t('rep.net')],
      annual.months.map((m) => [MONTHS[m.month - 1], m.income, m.expense, m.staff, m.out, m.net]));
  }

  function exportCashiersCSV() {
    downloadCSV('cashiers.csv',
      [t('cashier.cashier'), t('cashier.totalIn'), t('cashier.totalOut'), t('field.balance')],
      cashiersRaw.map((c) => [c.name, c.total_in, c.total_out, c.balance]));
  }

  function exportExpenseCSV() {
    downloadCSV('expense-report.csv',
      [t('field.category'), t('field.amount'), t('rep.entries')],
      expenseByCat.map((e) => [e.category, e.total_amount, e.num_entries]));
  }

  function exportContribCSV() {
    downloadCSV('contribution-report.csv',
      [t('field.name'), t('field.role'), t('rep.totalContributed'), t('rep.payments')],
      contrib.map((c) => [c.name, t(`role.${c.role}`), c.total_contributed, c.num_payments]));
  }

  function toggleSection(key) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleType(type) {
    setOpenTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  }
  const isTypeOpen = (type) => !!openTypes[type];

  // --- Date range helper ---
  function inRange(dateStr) {
    if (!dateFrom && !dateTo) return true;
    const d = dateStr ? dateStr.slice(0, 10) : null;
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }
  const hasFilter = !!(dateFrom || dateTo);

  // --- Derived, date-filtered datasets ---
  // Ledger: keep all members, filter their contribution entries by date
  const ledger = ledgerRaw.map((m) => {
    const entries = m.entries.filter((e) => inRange(e.date));
    return { ...m, entries, total_given: entries.reduce((s, e) => s + e.amount_given, 0) };
  });

  // Contribution report (per member) derived from the filtered ledger
  const contrib = ledger.map((m) => ({
    member_id: m.member_id,
    name: m.name,
    role: m.role,
    total_contributed: m.total_given,
    num_payments: m.entries.length,
  }));

  // Installments filtered by due date
  const filteredInstallments = installmentsRaw.filter((i) => inRange(i.due_date));
  const due = filteredInstallments.filter((i) => parseFloat(i.balance) > 0);

  // Installment plans grouped by member
  const installmentPlans = (() => {
    const byMember = {};
    filteredInstallments.forEach((r) => {
      if (!byMember[r.member_id]) byMember[r.member_id] = { member_name: r.member_name, plans: [] };
      byMember[r.member_id].plans.push(r);
    });
    return Object.values(byMember);
  })();

  // Installments grouped by type
  const installmentsByType = {};
  filteredInstallments.forEach((i) => {
    const tp = i.type || 'General';
    if (!installmentsByType[tp]) installmentsByType[tp] = [];
    installmentsByType[tp].push(i);
  });

  // Expenses by category (filtered by expense date)
  const expenseByCat = Object.values(
    expensesRaw.filter((e) => inRange(e.expense_date)).reduce((acc, e) => {
      const c = e.category || 'Uncategorized';
      if (!acc[c]) acc[c] = { category: c, total_amount: 0, num_entries: 0 };
      acc[c].total_amount += parseFloat(e.amount);
      acc[c].num_entries += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total_amount - a.total_amount);

  function statusLabel(plan) {
    const balance = parseFloat(plan.balance);
    if (plan.overdue) return t('status.overdue');
    if (balance <= 0) return t('status.paid');
    if (parseFloat(plan.paid_amount) > 0) return t('status.partial');
    return t('status.pending');
  }
  function statusBadge(plan) {
    const balance = parseFloat(plan.balance);
    if (plan.overdue) return <span className="badge" style={{ background: '#dc2626' }}>{t('status.overdue')}</span>;
    if (balance <= 0) return <span className="badge" style={{ background: '#059669' }}>{t('status.paid')}</span>;
    if (parseFloat(plan.paid_amount) > 0) return <span className="badge" style={{ background: '#2563eb' }}>{t('status.partial')}</span>;
    return <span className="badge" style={{ background: '#d97706' }}>{t('status.pending')}</span>;
  }

  const rangeNote = hasFilter ? ` (${dateFrom || '…'} → ${dateTo || '…'})` : '';

  // ---------- PRINT HANDLERS (use filtered data) ----------
  function printInstallmentsByMember() {
    const rows = installmentPlans.map((m) => {
      const totalDue = m.plans.reduce((s, p) => s + parseFloat(p.total_amount), 0);
      const totalPaid = m.plans.reduce((s, p) => s + parseFloat(p.paid_amount), 0);
      const plansHtml = m.plans.map((p) => `[${p.type}]: ₹${parseFloat(p.total_amount).toLocaleString()} - ${statusLabel(p)}`).join('<br/>');
      return `<tr><td>${m.member_name}</td><td>${plansHtml}</td><td>₹${totalDue.toLocaleString()}</td><td>₹${totalPaid.toLocaleString()}</td><td>₹${(totalDue - totalPaid).toLocaleString()}</td></tr>`;
    }).join('');
    printHTML(t('rep.installmentsByMember'), `
      <h3>${t('rep.installmentsByMember')}${rangeNote}</h3>
      <table><thead><tr><th>${t('field.name')}</th><th>${t('rep.plans')}</th><th>${t('rep.totalDue')}</th><th>${t('rep.totalPaid')}</th><th>${t('rep.totalBalance')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function printTypeGroup(type, items) {
    const totalDue = items.reduce((s, p) => s + parseFloat(p.total_amount), 0);
    const totalPaid = items.reduce((s, p) => s + parseFloat(p.paid_amount), 0);
    const rows = items.map((p) => `
      <tr><td>${p.member_name}</td><td>₹${parseFloat(p.total_amount).toLocaleString()}</td><td>₹${parseFloat(p.paid_amount).toLocaleString()}</td><td>₹${parseFloat(p.balance).toLocaleString()}</td><td>${p.due_date ? p.due_date.slice(0, 10) : '-'}</td><td>${statusLabel(p)}</td></tr>`).join('');
    printHTML(`${t('inst.title')} - ${type}`, `
      <h3>${t('inst.title')} - ${type}${rangeNote}</h3>
      <p class="muted">${t('rep.totalDue')}: ₹${totalDue.toLocaleString()} | ${t('rep.totalPaid')}: ₹${totalPaid.toLocaleString()} | ${t('rep.totalBalance')}: ₹${(totalDue - totalPaid).toLocaleString()}</p>
      <table><thead><tr><th>${t('contrib.member')}</th><th>${t('field.total')}</th><th>${t('field.paid')}</th><th>${t('field.balance')}</th><th>${t('field.dueDate')}</th><th>${t('field.status')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function printLedger() {
    const rows = ledger.map((m) => {
      const entriesHtml = m.entries.length
        ? `<table><thead><tr><th>${t('field.date')}</th><th>${t('field.amount')}</th><th>${t('field.mode')}</th><th>${t('field.remarks')}</th></tr></thead><tbody>${
            m.entries.map((e) => `<tr><td>${e.date?.slice(0, 10)}</td><td>₹${e.amount_given.toLocaleString()}</td><td>${e.mode || '-'}</td><td>${e.remarks || ''}</td></tr>`).join('')
          }</tbody></table>`
        : '';
      return `<tr><td>${m.name}</td><td>${t(`role.${m.role}`)}</td><td>₹${m.total_given.toLocaleString()}</td></tr>${entriesHtml ? `<tr><td colspan="3">${entriesHtml}</td></tr>` : ''}`;
    }).join('');
    printHTML(t('rep.contributionLedger'), `
      <h3>${t('rep.contributionLedger')}${rangeNote}</h3>
      <table><thead><tr><th>${t('field.name')}</th><th>${t('field.role')}</th><th>${t('rep.totalGiven')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function printContrib() {
    const rows = contrib.map((c) => `<tr><td>${c.name}</td><td>${t(`role.${c.role}`)}</td><td>₹${parseFloat(c.total_contributed).toLocaleString()}</td><td>${c.num_payments}</td></tr>`).join('');
    printHTML(t('rep.contributionReport'), `
      <h3>${t('rep.contributionReport')}${rangeNote}</h3>
      <table><thead><tr><th>${t('field.name')}</th><th>${t('field.role')}</th><th>${t('rep.totalContributed')}</th><th>${t('rep.payments')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function printExpense() {
    const rows = expenseByCat.map((e) => `<tr><td>${e.category}</td><td>₹${e.total_amount.toLocaleString()}</td><td>${e.num_entries}</td></tr>`).join('');
    printHTML(t('rep.expenseReport'), `
      <h3>${t('rep.expenseReport')}${rangeNote}</h3>
      <table><thead><tr><th>${t('field.category')}</th><th>${t('field.amount')}</th><th>${t('rep.entries')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function printDue() {
    const rows = due.map((d) => `<tr><td>${d.member_name}</td><td>₹${parseFloat(d.total_amount).toLocaleString()}</td><td>₹${parseFloat(d.paid_amount).toLocaleString()}</td><td>₹${parseFloat(d.balance).toLocaleString()}</td><td>${d.due_date?.slice(0, 10) || '-'}</td></tr>`).join('');
    printHTML(t('rep.pendingInstallments'), `
      <h3>${t('rep.pendingInstallments')}${rangeNote}</h3>
      <table><thead><tr><th>${t('contrib.member')}</th><th>${t('field.total')}</th><th>${t('field.paid')}</th><th>${t('field.balance')}</th><th>${t('field.dueDate')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  function printCashiers() {
    const rows = cashiersRaw.map((c) => `<tr><td>${c.name}</td><td>₹${c.total_in.toLocaleString()}</td><td>₹${c.total_out.toLocaleString()}</td><td>₹${c.balance.toLocaleString()}</td></tr>`).join('');
    printHTML(t('cashier.report'), `
      <h3>${t('cashier.report')}</h3>
      <table><thead><tr><th>${t('cashier.cashier')}</th><th>${t('cashier.totalIn')}</th><th>${t('cashier.totalOut')}</th><th>${t('field.balance')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }

  const SectionHeader = ({ title, sectionKey, onPrint, onCsv }) => (
    <div className="card-header">
      <h3>{title}</h3>
      <div className="card-header-actions">
        {onCsv && <button className="print-btn" onClick={onCsv}>⬇️ CSV</button>}
        {onPrint && <button className="print-btn" onClick={onPrint}>🖨 {t('common.print')}</button>}
        <button className="toggle-btn" onClick={() => toggleSection(sectionKey)}>{open[sectionKey] ? '−' : '+'}</button>
      </div>
    </div>
  );

  return (
    <div>
      <h2>{t('rep.title')}</h2>
      {error && <div className="error-text">{error}</div>}

      {/* Shared date-range filter */}
      <div className="card">
        <div className="actions-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
          <label className="muted" style={{ margin: 0 }}>{t('common.from')}:</label>
          <input type="date" style={{ maxWidth: 170, margin: 0 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label className="muted" style={{ margin: 0 }}>{t('common.to')}:</label>
          <input type="date" style={{ maxWidth: 170, margin: 0 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {hasFilter && <button onClick={() => { setDateFrom(''); setDateTo(''); }}>{t('common.clearFilters')}</button>}
        </div>
      </div>

      {/* Annual / Yearly Statement */}
      <div className="card">
        <div className="card-header">
          <h3>{t('rep.annual')}</h3>
          <div className="card-header-actions">
            <select value={annualYear} onChange={(e) => setAnnualYear(parseInt(e.target.value, 10))} style={{ margin: 0, maxWidth: 110 }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const y = nowYear - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
            <button className="print-btn" onClick={exportAnnualCSV}>⬇️ CSV</button>
            <button className="print-btn" onClick={printAnnual}>🖨 {t('common.print')}</button>
          </div>
        </div>
        {annual && (
          <>
            <p className="muted">
              {t('rep.totalIncome')}: ₹{annual.total_income.toLocaleString()} · {t('rep.totalOut')}: ₹{annual.total_out.toLocaleString()} · {t('rep.net')}: <strong style={{ color: annual.net >= 0 ? '#059669' : '#dc2626' }}>₹{annual.net.toLocaleString()}</strong>
            </p>
            <table>
              <thead><tr><th>{t('rep.month')}</th><th>{t('dash.income')}</th><th>{t('dash.otherExpense')}</th><th>{t('dash.staffPaid')}</th><th>{t('rep.totalOut')}</th><th>{t('rep.net')}</th></tr></thead>
              <tbody>
                {annual.months.map((m) => (
                  <tr key={m.month}>
                    <td>{MONTHS[m.month - 1]}</td>
                    <td style={{ color: '#059669' }}>₹{m.income.toLocaleString()}</td>
                    <td>₹{m.expense.toLocaleString()}</td>
                    <td>₹{m.staff.toLocaleString()}</td>
                    <td style={{ color: '#dc2626' }}>₹{m.out.toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>₹{m.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Installment Plans by Member */}
      <div className="card">
        <SectionHeader title={t('rep.installmentsByMember')} sectionKey="installmentsByMember" onPrint={printInstallmentsByMember} />
        {open.installmentsByMember && (
          <table>
            <thead><tr><th>{t('field.name')}</th><th>{t('rep.plans')}</th><th>{t('rep.totalDue')}</th><th>{t('rep.totalPaid')}</th><th>{t('rep.totalBalance')}</th></tr></thead>
            <tbody>
              {installmentPlans.map((m, idx) => {
                const totalDue = m.plans.reduce((s, p) => s + parseFloat(p.total_amount), 0);
                const totalPaid = m.plans.reduce((s, p) => s + parseFloat(p.paid_amount), 0);
                return (
                  <tr key={idx}>
                    <td>{m.member_name}</td>
                    <td>
                      {m.plans.map((p) => (
                        <div key={p.id} style={{ marginBottom: 2, fontSize: 13 }}>
                          [{p.type}]: ₹{parseFloat(p.total_amount).toLocaleString()} {statusBadge(p)}
                        </div>
                      ))}
                    </td>
                    <td>₹{totalDue.toLocaleString()}</td>
                    <td>₹{totalPaid.toLocaleString()}</td>
                    <td style={{ color: (totalDue - totalPaid) > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>₹{(totalDue - totalPaid).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Installments by Type */}
      <div className="card">
        <SectionHeader title={t('rep.installmentsByType')} sectionKey="byType" />
        {open.byType && Object.entries(installmentsByType).map(([type, items]) => {
          const totalDue = items.reduce((s, p) => s + parseFloat(p.total_amount), 0);
          const totalPaid = items.reduce((s, p) => s + parseFloat(p.paid_amount), 0);
          const typeOpen = isTypeOpen(type);
          return (
            <div key={type}>
              <div className="type-group-header" onClick={() => toggleType(type)}>
                <strong>{type} ({items.length}) — {t('rep.totalDue')} ₹{totalDue.toLocaleString()} | {t('field.paid')} ₹{totalPaid.toLocaleString()} | {t('field.balance')} ₹{(totalDue - totalPaid).toLocaleString()}</strong>
                <div className="card-header-actions">
                  <button className="print-btn" onClick={(e) => { e.stopPropagation(); printTypeGroup(type, items); }}>🖨 {t('common.print')}</button>
                  <button className="toggle-btn" onClick={(e) => { e.stopPropagation(); toggleType(type); }}>{typeOpen ? '−' : '+'}</button>
                </div>
              </div>
              {typeOpen && (
                <table>
                  <thead><tr><th>{t('contrib.member')}</th><th>{t('field.total')}</th><th>{t('field.paid')}</th><th>{t('field.balance')}</th><th>{t('field.dueDate')}</th><th>{t('field.status')}</th></tr></thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td>{p.member_name}</td>
                        <td>₹{parseFloat(p.total_amount).toLocaleString()}</td>
                        <td>₹{parseFloat(p.paid_amount).toLocaleString()}</td>
                        <td style={{ color: parseFloat(p.balance) > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>₹{parseFloat(p.balance).toLocaleString()}</td>
                        <td>{p.due_date?.slice(0, 10) || '-'}</td>
                        <td>{statusBadge(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* Member Contribution Ledger */}
      <div className="card">
        <SectionHeader title={t('rep.contributionLedger')} sectionKey="ledger" onPrint={printLedger} />
        {open.ledger && (
          <table>
            <thead><tr><th>{t('field.name')}</th><th>{t('field.role')}</th><th>{t('rep.totalGiven')}</th><th>{t('field.details')}</th></tr></thead>
            <tbody>
              {ledger.map((m) => (
                <React.Fragment key={m.member_id}>
                  <tr>
                    <td>{m.name}</td>
                    <td>{t(`role.${m.role}`)}</td>
                    <td style={{ fontWeight: 600 }}>₹{m.total_given.toLocaleString()}</td>
                    <td>
                      {m.entries.length > 0 && (
                        <button onClick={() => setExpandedMember(expandedMember === m.member_id ? null : m.member_id)}>
                          {expandedMember === m.member_id ? t('common.hide') : t('common.view')}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedMember === m.member_id && (
                    <tr>
                      <td colSpan={4}>
                        <div style={{ background: 'var(--subcard-bg)', padding: 10, borderRadius: 6 }}>
                          <table>
                            <thead><tr><th>{t('field.date')}</th><th>{t('field.amount')}</th><th>{t('field.mode')}</th><th>{t('field.remarks')}</th></tr></thead>
                            <tbody>
                              {m.entries.map((e, idx) => (
                                <tr key={idx}>
                                  <td>{e.date?.slice(0, 10)}</td>
                                  <td>₹{e.amount_given.toLocaleString()}</td>
                                  <td>{e.mode || '-'}</td>
                                  <td>{e.remarks || '-'}</td>
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
        )}
      </div>

      {/* Contribution Report */}
      <div className="card">
        <SectionHeader title={t('rep.contributionReport')} sectionKey="contrib" onPrint={printContrib} onCsv={exportContribCSV} />
        {open.contrib && (
          <table>
            <thead><tr><th>{t('field.name')}</th><th>{t('field.role')}</th><th>{t('rep.totalContributed')}</th><th>{t('rep.payments')}</th></tr></thead>
            <tbody>
              {contrib.map((c) => (
                <tr key={c.member_id}>
                  <td>{c.name}</td>
                  <td>{t(`role.${c.role}`)}</td>
                  <td>₹{parseFloat(c.total_contributed).toLocaleString()}</td>
                  <td>{c.num_payments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Expense Report */}
      <div className="card">
        <SectionHeader title={t('rep.expenseReport')} sectionKey="expense" onPrint={printExpense} onCsv={exportExpenseCSV} />
        {open.expense && (
          <table>
            <thead><tr><th>{t('field.category')}</th><th>{t('field.amount')}</th><th>{t('rep.entries')}</th></tr></thead>
            <tbody>
              {expenseByCat.map((e, idx) => (
                <tr key={idx}>
                  <td>{e.category}</td>
                  <td>₹{e.total_amount.toLocaleString()}</td>
                  <td>{e.num_entries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cashier Report */}
      <div className="card">
        <SectionHeader title={t('cashier.report')} sectionKey="cashiers" onPrint={printCashiers} onCsv={exportCashiersCSV} />
        {open.cashiers && (
          <table>
            <thead><tr><th>{t('cashier.cashier')}</th><th>{t('cashier.totalIn')}</th><th>{t('cashier.totalOut')}</th><th>{t('field.balance')}</th></tr></thead>
            <tbody>
              {cashiersRaw.length === 0 && <tr><td colSpan={4} className="muted">{t('cashier.noneYet')}</td></tr>}
              {cashiersRaw.map((c) => (
                <tr key={c.member_id}>
                  <td>{c.name}</td>
                  <td style={{ color: '#059669', fontWeight: 600 }}>₹{c.total_in.toLocaleString()}</td>
                  <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{c.total_out.toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>₹{c.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Installments */}
      <div className="card">
        <SectionHeader title={t('rep.pendingInstallments')} sectionKey="due" onPrint={printDue} />
        {open.due && (
          <table>
            <thead><tr><th>{t('contrib.member')}</th><th>{t('field.total')}</th><th>{t('field.paid')}</th><th>{t('field.balance')}</th><th>{t('field.dueDate')}</th></tr></thead>
            <tbody>
              {due.map((d, idx) => (
                <tr key={idx}>
                  <td>{d.member_name}</td>
                  <td>₹{parseFloat(d.total_amount).toLocaleString()}</td>
                  <td>₹{parseFloat(d.paid_amount).toLocaleString()}</td>
                  <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{parseFloat(d.balance).toLocaleString()}</td>
                  <td>{d.due_date?.slice(0, 10) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
