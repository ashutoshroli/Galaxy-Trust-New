import express from 'express';
import { pool } from '../db.js';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// GET /cashiers - list cashiers with their in/out totals.
// Available to every authenticated user (the in/out forms need this list).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT c.id AS cashier_id, m.id AS member_id, m.name, m.role AS member_role,
             COALESCE(SUM(ca.amount) FILTER (WHERE ca.direction = 'in'), 0) AS total_in,
             COALESCE(SUM(ca.amount) FILTER (WHERE ca.direction = 'out'), 0) AS total_out
      FROM cashiers c
      JOIN members m ON c.member_id = m.id
      LEFT JOIN cashier_allocations ca ON ca.cashier_member_id = m.id
      GROUP BY c.id, m.id, m.name, m.role
      ORDER BY m.name
    `);
    res.json(
      result.rows.map((r) => ({
        ...r,
        total_in: parseFloat(r.total_in),
        total_out: parseFloat(r.total_out),
        balance: parseFloat(r.total_in) - parseFloat(r.total_out),
      }))
    );
  })
);

// GET /cashiers/members - every member with a flag showing if they are a cashier.
// Superadmin only (used by the Cashier management page).
router.get(
  '/members',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT m.id AS member_id, m.name, m.role,
             (c.id IS NOT NULL) AS is_cashier
      FROM members m
      LEFT JOIN cashiers c ON c.member_id = m.id
      ORDER BY m.name
    `);
    res.json(result.rows);
  })
);

// POST /cashiers - designate a member as a cashier. Superadmin only.
router.post(
  '/',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const { member_id } = req.body;
    if (!member_id) return badRequest(res, 'member_id required');

    const member = await pool.query('SELECT id, name FROM members WHERE id = $1', [member_id]);
    if (!member.rows[0]) return notFound(res, 'Member not found');

    const result = await pool.query(
      `INSERT INTO cashiers (member_id) VALUES ($1)
       ON CONFLICT (member_id) DO NOTHING
       RETURNING *`,
      [member_id]
    );
    res.status(201).json(result.rows[0] || { member_id, already: true });
  })
);

// DELETE /cashiers/:memberId - remove cashier status (past allocations are kept). Superadmin only.
router.delete(
  '/:memberId',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM cashiers WHERE member_id = $1', [req.params.memberId]);
    res.json({ message: 'Removed' });
  })
);

// GET /cashiers/:memberId/detail - who gave money to this cashier, and to whom
// this cashier disbursed money.
router.get(
  '/:memberId/detail',
  asyncHandler(async (req, res) => {
    const memberId = req.params.memberId;

    const memberRes = await pool.query('SELECT id, name, role FROM members WHERE id = $1', [memberId]);
    if (!memberRes.rows[0]) return notFound(res, 'Member not found');

    // Money collected: grouped by the contributing member
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

    // Money disbursed against expenses (grouped by category)
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

    // Money disbursed to staff (grouped by staff member)
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

    const received_from = receivedFrom.rows.map((r) => ({
      member_id: r.member_id,
      member_name: r.member_name,
      total: parseFloat(r.total),
      num: parseInt(r.num, 10),
    }));
    const given_to = [
      ...givenExpenses.rows.map((r) => ({ kind: 'expense', name: r.name, total: parseFloat(r.total), num: parseInt(r.num, 10) })),
      ...givenStaff.rows.map((r) => ({ kind: 'staff', name: r.name, total: parseFloat(r.total), num: parseInt(r.num, 10) })),
    ].sort((a, b) => b.total - a.total);

    res.json({
      member: memberRes.rows[0],
      total_in: received_from.reduce((s, r) => s + r.total, 0),
      total_out: given_to.reduce((s, r) => s + r.total, 0),
      received_from,
      given_to,
    });
  })
);

export default router;
