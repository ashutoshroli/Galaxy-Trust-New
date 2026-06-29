import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { replaceAllocations, deleteAllocations, getAllocationsMap } from '../utils/cashierAllocations.js';

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
    const result = await pool.query(`
    SELECT c.*, m.name AS member_name
    FROM contributions c JOIN members m ON c.member_id = m.id
    ORDER BY c.contribution_date DESC, c.id DESC
  `);
    const allocMap = await getAllocationsMap(pool, 'contribution', result.rows.map((r) => r.id));
    res.json(result.rows.map((r) => ({ ...r, cashiers: allocMap[r.id] || [] })));
  }));

router.get('/member/:memberId', asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM contributions WHERE member_id=$1 ORDER BY contribution_date DESC',
      [req.params.memberId]
    );
    res.json(result.rows);
  }));

// Members whose installments still have pending balance, with their pending installments listed
router.get('/pending-members', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT i.id AS installment_id, i.member_id, m.name AS member_name, i.type,
           i.total_amount, i.paid_amount, (i.total_amount - i.paid_amount) AS balance, i.due_date
    FROM installments i
    JOIN members m ON i.member_id = m.id
    WHERE (i.total_amount - i.paid_amount) > 0
    ORDER BY m.name, i.due_date
  `);

  const byMember = {};
  result.rows.forEach((row) => {
    if (!byMember[row.member_id]) {
      byMember[row.member_id] = { member_id: row.member_id, member_name: row.member_name, installments: [] };
    }
    byMember[row.member_id].installments.push({
      installment_id: row.installment_id,
      type: row.type,
      total_amount: row.total_amount,
      paid_amount: row.paid_amount,
      balance: row.balance,
      due_date: row.due_date,
    });
  });

  res.json(Object.values(byMember));
}));

// Add a contribution. If installment_id is given, payment is applied ONLY to that
// specific installment (not all of the member's installments), and amount cannot
// exceed that installment's remaining balance.
router.post('/', canAdd, async (req, res) => {
  const { member_id, amount, contribution_date, mode, remarks, installment_id, cashiers } = req.body;
  if (!member_id || !amount) return res.status(400).json({ error: 'member_id and amount required' });
  const safeDate = contribution_date && contribution_date.trim() !== '' ? contribution_date : null;
  const paidAmount = parseFloat(amount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (installment_id) {
      const instResult = await client.query(
        'SELECT total_amount, paid_amount FROM installments WHERE id=$1 FOR UPDATE',
        [installment_id]
      );
      if (!instResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Installment not found' });
      }
      const balance = parseFloat(instResult.rows[0].total_amount) - parseFloat(instResult.rows[0].paid_amount);
      if (paidAmount > balance + 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Amount exceeds pending balance of ₹${balance.toFixed(2)} for this installment.` });
      }
    }

    const result = await client.query(
      `INSERT INTO contributions (member_id, amount, contribution_date, mode, remarks, installment_id, added_by)
       VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,$7) RETURNING *`,
      [member_id, paidAmount, safeDate, mode || 'cash', remarks, installment_id || null, req.user.id]
    );

    if (installment_id) {
      await client.query(
        'UPDATE installments SET paid_amount = paid_amount + $1, updated_at = NOW() WHERE id = $2',
        [paidAmount, installment_id]
      );
    }

    await replaceAllocations(client, 'contribution', result.rows[0].id, 'in', cashiers);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save contribution' });
  } finally {
    client.release();
  }
});

router.put('/:id', canEdit, async (req, res) => {
  const { amount, contribution_date, mode, remarks, cashiers } = req.body;
  const safeDate = contribution_date && contribution_date.trim() !== '' ? contribution_date : null;
  const newAmount = parseFloat(amount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query('SELECT * FROM contributions WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!oldResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const old = oldResult.rows[0];

    // Sync linked installment balance: remove old amount, add new amount
    if (old.installment_id) {
      const diff = newAmount - parseFloat(old.amount);
      await client.query(
        'UPDATE installments SET paid_amount = paid_amount + $1, updated_at = NOW() WHERE id = $2',
        [diff, old.installment_id]
      );
    }

    const result = await client.query(
      `UPDATE contributions SET amount=$1, contribution_date=COALESCE($2, contribution_date), mode=$3, remarks=$4
       WHERE id=$5 RETURNING *`,
      [newAmount, safeDate, mode, remarks, req.params.id]
    );

    if (cashiers !== undefined) {
      await replaceAllocations(client, 'contribution', req.params.id, 'in', cashiers);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update contribution' });
  } finally {
    client.release();
  }
});

router.delete('/:id', onlySuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query('SELECT * FROM contributions WHERE id=$1', [req.params.id]);
    const contrib = result.rows[0];
    if (!contrib) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    if (contrib.installment_id) {
      await client.query(
        'UPDATE installments SET paid_amount = paid_amount - $1, updated_at = NOW() WHERE id = $2',
        [contrib.amount, contrib.installment_id]
      );
    }

    await client.query('DELETE FROM contributions WHERE id=$1', [req.params.id]);
    await deleteAllocations(client, 'contribution', req.params.id);
    await client.query('COMMIT');
    res.json({ message: 'Deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to delete contribution' });
  } finally {
    client.release();
  }
});

export default router;
