import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// List all staff with total paid so far
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT s.*, COALESCE(SUM(sp.amount), 0) AS total_paid
      FROM staff s
      LEFT JOIN staff_payments sp ON sp.staff_id = s.id
      GROUP BY s.id
      ORDER BY s.name
    `);
    res.json(result.rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const staffResult = await pool.query('SELECT * FROM staff WHERE id=$1', [req.params.id]);
    if (!staffResult.rows[0]) return notFound(res);

    const payments = await pool.query(
      'SELECT * FROM staff_payments WHERE staff_id=$1 ORDER BY payment_date DESC, id DESC',
      [req.params.id]
    );
    res.json({ ...staffResult.rows[0], payments: payments.rows });
  })
);

router.post(
  '/',
  canAdd,
  asyncHandler(async (req, res) => {
    const { name, category, contact, address } = req.body;
    if (!name) return badRequest(res, 'name required');
    const result = await pool.query(
      `INSERT INTO staff (name, category, contact, address) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, category, contact, address]
    );
    res.status(201).json(result.rows[0]);
  })
);

router.put(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { name, category, contact, address } = req.body;
    const result = await pool.query(
      `UPDATE staff SET name=$1, category=$2, contact=$3, address=$4 WHERE id=$5 RETURNING *`,
      [name, category, contact, address, req.params.id]
    );
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

router.delete(
  '/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM staff WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  })
);

// --- Staff Payments ---

router.get(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM staff_payments WHERE staff_id=$1 ORDER BY payment_date DESC, id DESC',
      [req.params.id]
    );
    res.json(result.rows);
  })
);

router.post(
  '/:id/payments',
  canAdd,
  asyncHandler(async (req, res) => {
    const { amount, payment_date, remarks } = req.body;
    if (!amount) return badRequest(res, 'amount required');
    const safeDate = payment_date && payment_date.trim() !== '' ? payment_date : null;
    const result = await pool.query(
      `INSERT INTO staff_payments (staff_id, amount, payment_date, remarks, added_by)
       VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5) RETURNING *`,
      [req.params.id, amount, safeDate, remarks, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  })
);

router.put(
  '/payments/:paymentId',
  canEdit,
  asyncHandler(async (req, res) => {
    const { amount, payment_date, remarks } = req.body;
    const safeDate = payment_date && payment_date.trim() !== '' ? payment_date : null;
    const result = await pool.query(
      `UPDATE staff_payments SET amount=$1, payment_date=COALESCE($2, payment_date), remarks=$3
       WHERE id=$4 RETURNING *`,
      [amount, safeDate, remarks, req.params.paymentId]
    );
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

router.delete(
  '/payments/:paymentId',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM staff_payments WHERE id=$1', [req.params.paymentId]);
    res.json({ message: 'Deleted' });
  })
);

export default router;
