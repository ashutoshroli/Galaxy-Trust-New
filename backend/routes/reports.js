import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// Dashboard summary
router.get('/dashboard', asyncHandler(async (req, res) => {
  const totalContrib = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM contributions');
  const totalExpense = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM expenses');
  const totalStaffPaid = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM staff_payments');
  const totalMembers = await pool.query('SELECT COUNT(*) AS total FROM members');
  const totalMeetings = await pool.query('SELECT COUNT(*) AS total FROM meetings');
  const pendingInstallments = await pool.query(
    'SELECT COALESCE(SUM(total_amount - paid_amount),0) AS total FROM installments'
  );
  const cashierIn = await pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM cashier_allocations WHERE direction = 'in'");
  const cashierOut = await pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM cashier_allocations WHERE direction = 'out'");
  const cashierCount = await pool.query('SELECT COUNT(*) AS total FROM cashiers');

  const totalIn = parseFloat(totalContrib.rows[0].total);
  const totalOut = parseFloat(totalExpense.rows[0].total) + parseFloat(totalStaffPaid.rows[0].total);

  res.json({
    total_contribution: totalIn,
    total_expense: parseFloat(totalExpense.rows[0].total),
    total_staff_paid: parseFloat(totalStaffPaid.rows[0].total),
    total_fund_available: totalIn - totalOut,
    balance: totalIn - totalOut,
    total_members: parseInt(totalMembers.rows[0].total),
    total_meetings: parseInt(totalMeetings.rows[0].total),
    pending_installments: parseFloat(pendingInstallments.rows[0].total),
    cashier_total_in: parseFloat(cashierIn.rows[0].total),
    cashier_total_out: parseFloat(cashierOut.rows[0].total),
    total_cashiers: parseInt(cashierCount.rows[0].total, 10),
  });
}));

// What the total fund was used for - combined expenses + staff payments, by category
router.get('/fund-usage', asyncHandler(async (req, res) => {
  const expenseByCategory = await pool.query(`
    SELECT COALESCE(category, 'Uncategorized') AS category, COALESCE(SUM(amount),0) AS total_amount
    FROM expenses GROUP BY category
  `);
  const staffTotal = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM staff_payments`);

  const rows = expenseByCategory.rows.map((r) => ({
    category: r.category,
    total_amount: parseFloat(r.total_amount),
  }));
  const staffAmt = parseFloat(staffTotal.rows[0].total);
  if (staffAmt > 0) {
    rows.push({ category: 'Staff Payments', total_amount: staffAmt });
  }

  res.json(rows);
}));

// Cashier report - per cashier in/out totals (for the Reports page)
router.get('/cashiers', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT m.id AS member_id, m.name, m.role,
           COALESCE(SUM(ca.amount) FILTER (WHERE ca.direction = 'in'), 0) AS total_in,
           COALESCE(SUM(ca.amount) FILTER (WHERE ca.direction = 'out'), 0) AS total_out
    FROM cashiers c
    JOIN members m ON c.member_id = m.id
    LEFT JOIN cashier_allocations ca ON ca.cashier_member_id = m.id
    GROUP BY m.id, m.name, m.role
    ORDER BY m.name
  `);
  res.json(
    result.rows.map((r) => ({
      member_id: r.member_id,
      name: r.name,
      role: r.role,
      total_in: parseFloat(r.total_in),
      total_out: parseFloat(r.total_out),
      balance: parseFloat(r.total_in) - parseFloat(r.total_out),
    }))
  );
}));

// Contribution report - per member totals
router.get('/contributions', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT m.id AS member_id, m.name, m.role,
           COALESCE(SUM(c.amount),0) AS total_contributed,
           COUNT(c.id) AS num_payments
    FROM members m
    LEFT JOIN contributions c ON c.member_id = m.id
    GROUP BY m.id, m.name, m.role
    ORDER BY m.name
  `);
  res.json(result.rows);
}));

// Expense report - by category
router.get('/expenses', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT COALESCE(category, 'Uncategorized') AS category,
           COALESCE(SUM(amount),0) AS total_amount,
           COUNT(*) AS num_entries
    FROM expenses
    GROUP BY category
    ORDER BY total_amount DESC
  `);
  res.json(result.rows);
}));

// Installment due report
router.get('/installments-due', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT m.name, i.total_amount, i.paid_amount,
           (i.total_amount - i.paid_amount) AS balance, i.due_date
    FROM installments i JOIN members m ON i.member_id = m.id
    WHERE (i.total_amount - i.paid_amount) > 0
    ORDER BY i.due_date ASC NULLS LAST
  `);
  res.json(result.rows);
}));

// Meeting attendance report
router.get('/meeting-attendance/:meetingId', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT m.name, a.present
    FROM meeting_attendance a JOIN members m ON a.member_id = m.id
    WHERE a.meeting_id = $1
    ORDER BY m.name
  `, [req.params.meetingId]);
  res.json(result.rows);
}));

// Member contribution ledger - date-wise: kaun ne kab kitna diya (total given per member)
router.get('/member-balance-ledger', asyncHandler(async (req, res) => {
  const membersResult = await pool.query('SELECT id, name, role FROM members ORDER BY name');
  const contributionsResult = await pool.query(
    'SELECT id, member_id, amount, contribution_date, mode, remarks FROM contributions ORDER BY member_id, contribution_date ASC, id ASC'
  );

  const contribByMember = {};
  contributionsResult.rows.forEach((c) => {
    if (!contribByMember[c.member_id]) contribByMember[c.member_id] = [];
    contribByMember[c.member_id].push(c);
  });

  const ledger = membersResult.rows.map((m) => {
    const contributions = contribByMember[m.id] || [];
    const total_given = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const entries = contributions.map((c) => ({
      contribution_id: c.id,
      date: c.contribution_date,
      amount_given: parseFloat(c.amount),
      mode: c.mode,
      remarks: c.remarks,
    }));
    return {
      member_id: m.id,
      name: m.name,
      role: m.role,
      total_given,
      entries,
    };
  });

  res.json(ledger);
}));

// Full detail for ONE member: their installment plans (with type), total given,
// and date-wise contribution entries.
router.get('/member-detail/:memberId', asyncHandler(async (req, res) => {
  const memberId = req.params.memberId;
  const memberResult = await pool.query('SELECT id, name, role FROM members WHERE id=$1', [memberId]);
  if (!memberResult.rows[0]) return res.status(404).json({ error: 'Member not found' });
  const member = memberResult.rows[0];

  const installmentsResult = await pool.query(`
    SELECT i.*, (i.total_amount - i.paid_amount) AS balance,
           CASE WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE AND (i.total_amount - i.paid_amount) > 0
                THEN true ELSE false END AS overdue
    FROM installments i WHERE i.member_id = $1
    ORDER BY i.type, i.due_date ASC NULLS LAST
  `, [memberId]);

  const contributionsResult = await pool.query(`
    SELECT c.id, c.amount, c.contribution_date, c.mode, c.remarks, c.installment_id,
           i.type AS installment_type
    FROM contributions c
    LEFT JOIN installments i ON c.installment_id = i.id
    WHERE c.member_id = $1
    ORDER BY c.contribution_date ASC, c.id ASC
  `, [memberId]);

  const contributions = contributionsResult.rows.map((c) => ({
    contribution_id: c.id,
    date: c.contribution_date,
    amount: parseFloat(c.amount),
    mode: c.mode,
    remarks: c.remarks,
    installment_id: c.installment_id,
    installment_type: c.installment_type,
  }));

  const total_given = contributions.reduce((s, c) => s + c.amount, 0);

  // Meeting attendance summary for this member
  const attendanceResult = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM meetings) AS total_meetings,
      COUNT(*) FILTER (WHERE a.present)::int AS present,
      COUNT(*)::int AS recorded
    FROM meeting_attendance a
    WHERE a.member_id = $1
  `, [memberId]);
  const att = attendanceResult.rows[0] || { total_meetings: 0, present: 0, recorded: 0 };
  const attendance = {
    total_meetings: att.total_meetings,
    present: att.present,
    absent: Math.max(att.total_meetings - att.present, 0),
  };

  // Which cashier(s) received this member's contributions (works for every member)
  const gaveToCashiersRes = await pool.query(
    `SELECT cm.id AS cashier_member_id, cm.name AS cashier_name,
            COALESCE(SUM(ca.amount), 0) AS total, COUNT(ca.id) AS num
     FROM contributions c
     JOIN cashier_allocations ca ON ca.ref_type = 'contribution' AND ca.ref_id = c.id AND ca.direction = 'in'
     JOIN members cm ON ca.cashier_member_id = cm.id
     WHERE c.member_id = $1
     GROUP BY cm.id, cm.name
     ORDER BY total DESC`,
    [memberId]
  );
  const gave_to_cashiers = gaveToCashiersRes.rows.map((r) => ({
    cashier_member_id: r.cashier_member_id,
    cashier_name: r.cashier_name,
    total: parseFloat(r.total),
    num: parseInt(r.num, 10),
  }));

  // Is this member a cashier? If so, build their collected/disbursed breakdowns.
  const isCashierRes = await pool.query('SELECT 1 FROM cashiers WHERE member_id = $1', [memberId]);
  const is_cashier = !!isCashierRes.rows[0];

  let cashier_received_from = [];
  let cashier_given_to = [];
  if (is_cashier) {
    const receivedFrom = await pool.query(
      `SELECT gm.id AS member_id, gm.name AS member_name,
              COALESCE(SUM(ca.amount), 0) AS total, COUNT(ca.id) AS num
       FROM cashier_allocations ca
       JOIN contributions c ON ca.ref_type = 'contribution' AND ca.ref_id = c.id
       JOIN members gm ON c.member_id = gm.id
       WHERE ca.cashier_member_id = $1 AND ca.direction = 'in'
       GROUP BY gm.id, gm.name
       ORDER BY total DESC`,
      [memberId]
    );
    const givenExpenses = await pool.query(
      `SELECT COALESCE(NULLIF(e.category, ''), 'Uncategorized') AS name,
              COALESCE(SUM(ca.amount), 0) AS total, COUNT(ca.id) AS num
       FROM cashier_allocations ca
       JOIN expenses e ON ca.ref_type = 'expense' AND ca.ref_id = e.id
       WHERE ca.cashier_member_id = $1 AND ca.direction = 'out'
       GROUP BY COALESCE(NULLIF(e.category, ''), 'Uncategorized')
       ORDER BY total DESC`,
      [memberId]
    );
    const givenStaff = await pool.query(
      `SELECT s.name AS name, COALESCE(SUM(ca.amount), 0) AS total, COUNT(ca.id) AS num
       FROM cashier_allocations ca
       JOIN staff_payments sp ON ca.ref_type = 'staff_payment' AND ca.ref_id = sp.id
       JOIN staff s ON sp.staff_id = s.id
       WHERE ca.cashier_member_id = $1 AND ca.direction = 'out'
       GROUP BY s.name
       ORDER BY total DESC`,
      [memberId]
    );
    cashier_received_from = receivedFrom.rows.map((r) => ({
      member_id: r.member_id,
      member_name: r.member_name,
      total: parseFloat(r.total),
      num: parseInt(r.num, 10),
    }));
    cashier_given_to = [
      ...givenExpenses.rows.map((r) => ({ kind: 'expense', name: r.name, total: parseFloat(r.total), num: parseInt(r.num, 10) })),
      ...givenStaff.rows.map((r) => ({ kind: 'staff', name: r.name, total: parseFloat(r.total), num: parseInt(r.num, 10) })),
    ].sort((a, b) => b.total - a.total);
  }

  res.json({
    member,
    installments: installmentsResult.rows,
    contributions,
    total_given,
    attendance,
    is_cashier,
    gave_to_cashiers,
    cashier_received_from,
    cashier_given_to,
  });
}));

// Full detail for ONE contribution: which installment (type) it was paid against.
router.get('/contribution-detail/:contributionId', asyncHandler(async (req, res) => {
  const contributionId = req.params.contributionId;
  const contribResult = await pool.query(`
    SELECT c.*, m.name AS member_name,
           i.type AS installment_type, i.total_amount AS installment_total,
           i.paid_amount AS installment_paid, i.due_date AS installment_due_date
    FROM contributions c
    JOIN members m ON c.member_id = m.id
    LEFT JOIN installments i ON c.installment_id = i.id
    WHERE c.id = $1
  `, [contributionId]);
  if (!contribResult.rows[0]) return res.status(404).json({ error: 'Contribution not found' });

  res.json({ contribution: contribResult.rows[0] });
}));

// Annual / yearly statement - month-wise contributions vs expenses+staff for a year
router.get('/annual', asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();

  const contribByMonth = await pool.query(
    `SELECT EXTRACT(MONTH FROM contribution_date)::int AS m, COALESCE(SUM(amount),0) AS total
     FROM contributions WHERE EXTRACT(YEAR FROM contribution_date) = $1 GROUP BY m`,
    [year]
  );
  const expenseByMonth = await pool.query(
    `SELECT EXTRACT(MONTH FROM expense_date)::int AS m, COALESCE(SUM(amount),0) AS total
     FROM expenses WHERE EXTRACT(YEAR FROM expense_date) = $1 GROUP BY m`,
    [year]
  );
  const staffByMonth = await pool.query(
    `SELECT EXTRACT(MONTH FROM payment_date)::int AS m, COALESCE(SUM(amount),0) AS total
     FROM staff_payments WHERE EXTRACT(YEAR FROM payment_date) = $1 GROUP BY m`,
    [year]
  );

  const cMap = {}; contribByMonth.rows.forEach((r) => { cMap[r.m] = parseFloat(r.total); });
  const eMap = {}; expenseByMonth.rows.forEach((r) => { eMap[r.m] = parseFloat(r.total); });
  const sMap = {}; staffByMonth.rows.forEach((r) => { sMap[r.m] = parseFloat(r.total); });

  const months = [];
  let totalIn = 0; let totalOut = 0;
  for (let m = 1; m <= 12; m++) {
    const income = cMap[m] || 0;
    const expense = eMap[m] || 0;
    const staff = sMap[m] || 0;
    const out = expense + staff;
    totalIn += income; totalOut += out;
    months.push({ month: m, income, expense, staff, out, net: income - out });
  }

  res.json({ year, months, total_income: totalIn, total_out: totalOut, net: totalIn - totalOut });
}));

// Monthly trend (last 12 months from today) - income vs out
router.get('/monthly-trend', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    WITH months AS (
      SELECT to_char(date_trunc('month', (CURRENT_DATE - (n || ' month')::interval)), 'YYYY-MM') AS ym
      FROM generate_series(0, 11) AS n
    )
    SELECT m.ym AS month,
      COALESCE((SELECT SUM(amount) FROM contributions c WHERE to_char(c.contribution_date,'YYYY-MM') = m.ym), 0) AS income,
      COALESCE((SELECT SUM(amount) FROM expenses e WHERE to_char(e.expense_date,'YYYY-MM') = m.ym), 0)
        + COALESCE((SELECT SUM(amount) FROM staff_payments sp WHERE to_char(sp.payment_date,'YYYY-MM') = m.ym), 0) AS out
    FROM months m
    ORDER BY m.ym ASC
  `);
  res.json(result.rows.map((r) => ({ month: r.month, income: parseFloat(r.income), out: parseFloat(r.out) })));
}));

// Upcoming birthdays in the next N days (default 30)
router.get('/upcoming-birthdays', asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 366);
  const result = await pool.query(
    `SELECT id, name, role, dob,
            to_char(dob, 'DD Mon') AS dob_label,
            (date_part('doy',
               make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM dob)::int, EXTRACT(DAY FROM dob)::int)
             ) - date_part('doy', CURRENT_DATE)) AS day_diff
     FROM members
     WHERE dob IS NOT NULL AND active = true`,
    []
  );
  // Compute "days until next birthday" in JS to handle year wrap cleanly
  const today = new Date();
  const upcoming = result.rows
    .map((m) => {
      const d = new Date(m.dob);
      let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (next < startOfToday) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
      const daysUntil = Math.round((next - startOfToday) / 86400000);
      return { id: m.id, name: m.name, role: m.role, dob_label: m.dob_label, days_until: daysUntil };
    })
    .filter((m) => m.days_until <= days)
    .sort((a, b) => a.days_until - b.days_until);
  res.json(upcoming);
}));

export default router;
