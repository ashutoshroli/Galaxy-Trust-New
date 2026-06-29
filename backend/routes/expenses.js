import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { replaceAllocations, deleteAllocations, getAllocationsMap } from '../utils/cashierAllocations.js';

const router = express.Router();
router.use(authenticate);

// List all expenses (expenses simply draw from the total available fund)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC');
    const allocMap = await getAllocationsMap(pool, 'expense', result.rows.map((r) => r.id));
    res.json(result.rows.map((r) => ({ ...r, cashiers: allocMap[r.id] || [] })));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return notFound(res, 'Expense not found');
    res.json(result.rows[0]);
  })
);

router.post(
  '/',
  canAdd,
  asyncHandler(async (req, res) => {
    const { amount, expense_date, category, description, used_for, cashiers } = req.body;
    if (amount === undefined || amount === null || amount === '') {
      return badRequest(res, 'amount required');
    }
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) return badRequest(res, 'amount must be a positive number');

    const safeDate = expense_date && expense_date.trim() !== '' ? expense_date : null;
    const result = await pool.query(
      `INSERT INTO expenses (amount, expense_date, category, description, used_for, added_by)
       VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6) RETURNING *`,
      [expenseAmount, safeDate, category, description, used_for, req.user.id]
    );
    await replaceAllocations(pool, 'expense', result.rows[0].id, 'out', cashiers);
    res.status(201).json(result.rows[0]);
  })
);

router.put(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { amount, expense_date, category, description, used_for, cashiers } = req.body;
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) return badRequest(res, 'amount must be a positive number');

    const safeDate = expense_date && expense_date.trim() !== '' ? expense_date : null;
    const result = await pool.query(
      `UPDATE expenses SET amount=$1, expense_date=COALESCE($2, expense_date), category=$3, description=$4, used_for=$5
       WHERE id=$6 RETURNING *`,
      [expenseAmount, safeDate, category, description, used_for, req.params.id]
    );
    if (!result.rows[0]) return notFound(res, 'Expense not found');
    if (cashiers !== undefined) {
      await replaceAllocations(pool, 'expense', req.params.id, 'out', cashiers);
    }
    res.json(result.rows[0]);
  })
);

router.delete(
  '/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
    await deleteAllocations(pool, 'expense', req.params.id);
    res.json({ message: 'Deleted' });
  })
);

export default router;
