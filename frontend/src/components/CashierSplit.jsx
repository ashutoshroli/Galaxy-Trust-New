import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Split `total` across the selected cashiers. Cashiers the user manually edited
// are "locked" and keep their typed amount; everyone else shares the remainder
// equally. The last unlocked cashier absorbs any rounding remainder so the
// amounts always add up to `total`.
function computeAmounts(total, selected, locked) {
  const amounts = {};
  const lockedIds = selected.filter((id) => locked[id] !== undefined && locked[id] !== '');
  const unlockedIds = selected.filter((id) => locked[id] === undefined || locked[id] === '');

  let lockedSum = 0;
  lockedIds.forEach((id) => {
    const v = round2(parseFloat(locked[id]));
    amounts[id] = v;
    lockedSum += v;
  });

  const remaining = round2((Number(total) || 0) - lockedSum);
  if (unlockedIds.length > 0) {
    const each = round2(remaining / unlockedIds.length);
    let acc = 0;
    unlockedIds.forEach((id, i) => {
      if (i === unlockedIds.length - 1) amounts[id] = round2(remaining - acc);
      else {
        amounts[id] = each;
        acc = round2(acc + each);
      }
    });
  }
  return amounts;
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Given a cashier allocation [{member_id, amount}] computed over `total`, scale
// it proportionally to a single row of `rowAmount`. The last cashier absorbs
// rounding so the row's cashier amounts always sum to rowAmount.
export function splitRowByCashiers(rowAmount, cashierValue, total) {
  const t = Number(total) || 0;
  const row = Number(rowAmount) || 0;
  if (!t || !Array.isArray(cashierValue) || cashierValue.length === 0 || row <= 0) return [];
  let acc = 0;
  return cashierValue.map((c, i) => {
    let amt;
    if (i === cashierValue.length - 1) amt = round2(row - acc);
    else {
      amt = round2(row * (c.amount / t));
      acc = round2(acc + amt);
    }
    return { member_id: c.member_id, amount: amt };
  });
}

// Reusable multi-cashier selector with auto-equal-divide of `total`.
// onChange receives [{ member_id, amount }] for the selected cashiers.
export default function CashierSplit({ cashiers = [], total = 0, onChange, initial = [], compact = false }) {
  const { t } = useI18n();

  const [selected, setSelected] = useState(() => initial.map((c) => Number(c.member_id)));
  const [locked, setLocked] = useState(() => {
    const m = {};
    initial.forEach((c) => { m[Number(c.member_id)] = String(c.amount); });
    return m;
  });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const amounts = computeAmounts(total, selected, locked);
  const allocatedSum = round2(selected.reduce((s, id) => s + (amounts[id] || 0), 0));
  const mismatch = selected.length > 0 && Math.abs(allocatedSum - (Number(total) || 0)) > 0.01;

  // Notify parent whenever the resulting allocation changes.
  useEffect(() => {
    const out = selected.map((id) => ({ member_id: id, amount: amounts[id] || 0 }));
    onChangeRef.current?.(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, locked, total]);

  function toggle(memberId) {
    const id = Number(memberId);
    setSelected((prev) => {
      if (prev.includes(id)) {
        setLocked((lk) => {
          const next = { ...lk };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function editAmount(memberId, value) {
    const id = Number(memberId);
    setLocked((prev) => ({ ...prev, [id]: value }));
  }

  function resetSplit() {
    setLocked({});
  }

  if (cashiers.length === 0) {
    return (
      <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        {t('cashier.noneYet')}
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>👛 {t('cashier.selectCashiers')} <span style={{ color: 'var(--danger)' }}>*</span></strong>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {t('field.total')}: {inr(total)} · {t('cashier.allocated')}: {inr(allocatedSum)}
        </span>
      </div>

      <div style={{ maxHeight: compact ? 150 : 220, overflowY: 'auto', display: 'grid', gap: 6 }}>
        {cashiers.map((c) => {
          const id = Number(c.member_id);
          const isSel = selected.includes(id);
          const isLocked = locked[id] !== undefined && locked[id] !== '';
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, fontSize: 14, margin: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(id)}
                  style={{ width: 'auto', margin: 0 }}
                />
                {c.name}
              </label>
              {isSel && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={isLocked ? locked[id] : (amounts[id] ?? 0)}
                  onChange={(e) => editAmount(id, e.target.value)}
                  title={isLocked ? t('cashier.manual') : t('cashier.auto')}
                  style={{
                    width: 120,
                    margin: 0,
                    borderColor: isLocked ? 'var(--accent)' : undefined,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12 }}>{t('cashier.splitHint')}</span>
        {Object.keys(locked).length > 0 && (
          <button type="button" className="print-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={resetSplit}>
            {t('cashier.resetSplit')}
          </button>
        )}
      </div>

      {mismatch && (
        <p className="muted" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          {t('cashier.mismatch')}
        </p>
      )}
    </div>
  );
}
