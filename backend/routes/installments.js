import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// View all - with member name, balance, and overdue flag
router.get('/', asyncHandler(async (req, res) => {
    const result = await pool.query(`
    SELECT i.*, m.name AS member_name,
           (i.total_amount - i.paid_amount) AS balance,
           CASE WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE AND (i.total_amount - i.paid_amount) > 0
                THEN true ELSE false END AS overdue
    FROM installments i JOIN members m ON i.member_id = m.id
    ORDER BY i.type, m.name
  `);
    res.json(result.rows);
  }));

router.get('/member/:memberId', asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM installments WHERE member_id=$1', [req.params.memberId]);
    res.json(result.rows);
  }));

// Create installment plan for MULTIPLE members at once (same type/total/due_date/notes for each)
// body: { member_ids: [1,2,3], type, total_amount, paid_amount, due_date, notes }
// (member_id singular still supported for backward compatibility)
router.post('/', canAdd, async (req, res) => {
  const { member_ids, member_id, type, total_amount, paid_amount, due_date, notes } = req.body;
  if (total_amount === undefined) {
    return res.status(400).json({ error: 'total_amount required' });
  }

  const ids = Array.isArray(member_ids) && member_ids.length > 0
    ? member_ids
    : (member_id ? [member_id] : []);

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Select at least one member' });
  }

  const safeDate = due_date && due_date.trim() !== '' ? due_date : null;
  const safeType = type && type.trim() !== '' ? type.trim() : 'General';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const mid of ids) {
      const result = await client.query(
        `INSERT INTO installments (member_id, type, total_amount, paid_amount, due_date, notes)
         VALUES ($1,$2,$3,COALESCE($4,0),$5,$6) RETURNING *`,
        [mid, safeType, total_amount, paid_amount, safeDate, notes]
      );
      created.push(result.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create installments' });
  } finally {
    client.release();
  }
});

router.put('/:id', canEdit, async (req, res) => {
  const { type, total_amount, paid_amount, due_date, notes } = req.body;
  const safeDate = due_date && due_date.trim() !== '' ? due_date : null;
  const safeType = type && type.trim() !== '' ? type.trim() : 'General';
  const result = await pool.query(
    `UPDATE installments SET type=$1, total_amount=$2, paid_amount=$3, due_date=$4, notes=$5, updated_at=NOW()
     WHERE id=$6 RETURNING *`,
    [safeType, total_amount, paid_amount, safeDate, notes, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', onlySuperAdmin, async (req, res) => {
  await pool.query('DELETE FROM installments WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

export default router;
