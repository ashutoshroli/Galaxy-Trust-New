import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// View - everyone (all roles including trustee)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM members ORDER BY id');
    res.json(result.rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM members WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

// Add - president/secretary/treasurer/superadmin
router.post(
  '/',
  canAdd,
  asyncHandler(async (req, res) => {
    const { name, relation_name, role, address, aadhar_last4, phone, dob, photo } = req.body;
    if (!name || !role) return badRequest(res, 'name and role required');
    const safeDob = dob && dob.trim() !== '' ? dob : null;
    const result = await pool.query(
      `INSERT INTO members (name, relation_name, role, address, aadhar_last4, phone, dob, photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, relation_name, role, address, aadhar_last4, phone, safeDob, photo || null]
    );
    res.status(201).json(result.rows[0]);
  })
);

// Edit - superadmin only
router.put(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { name, relation_name, role, address, aadhar_last4, phone, dob, photo, active } = req.body;
    const safeDob = dob && dob.trim() !== '' ? dob : null;
    const result = await pool.query(
      `UPDATE members SET name=$1, relation_name=$2, role=$3, address=$4, aadhar_last4=$5, phone=$6,
              dob=$7, photo=COALESCE($8, photo), active=COALESCE($9, active)
       WHERE id=$10 RETURNING *`,
      [name, relation_name, role, address, aadhar_last4, phone, safeDob, photo ?? null, active, req.params.id]
    );
    if (!result.rows[0]) return notFound(res);
    // Keep the linked login account's phone in sync (used for mobile login)
    await pool.query('UPDATE users SET phone=$1 WHERE member_id=$2', [phone || null, req.params.id]);
    res.json(result.rows[0]);
  })
);

// Toggle active/inactive status - superadmin only
router.patch(
  '/:id/status',
  canEdit,
  asyncHandler(async (req, res) => {
    const { active } = req.body;
    const result = await pool.query(
      'UPDATE members SET active=$1 WHERE id=$2 RETURNING *',
      [!!active, req.params.id]
    );
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

// Delete - superadmin only
router.delete(
  '/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM members WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  })
);

export default router;
