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

  res.json({
    member,
    installments: installmentsResult.rows,
    contributions,
    total_given,
    attendance,
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

export default router;
