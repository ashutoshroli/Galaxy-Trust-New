import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { notifyAll } from '../utils/notify.js';

const router = express.Router();
router.use(authenticate);

// List announcements (pinned first, then newest) — every authenticated user
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT a.*, COALESCE(m.name, u.username) AS author_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN members m ON u.member_id = m.id
      ORDER BY a.pinned DESC, a.created_at DESC
    `);
    res.json(result.rows);
  })
);

// Create — canAdd roles
router.post(
  '/',
  canAdd,
  asyncHandler(async (req, res) => {
    const { title, body, pinned } = req.body;
    if (!title || title.trim() === '') return badRequest(res, 'title required');
    const result = await pool.query(
      `INSERT INTO announcements (title, body, pinned, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title.trim(), body || null, !!pinned, req.user.id]
    );
    notifyAll(req.user.id, {
      type: 'announcement',
      title: `📢 ${title.trim()}`,
      body: body ? String(body).slice(0, 120) : '',
      link: '/announcements',
    }).catch(() => {});
    res.status(201).json(result.rows[0]);
  })
);

// Update — canAdd roles
router.put(
  '/:id',
  canAdd,
  asyncHandler(async (req, res) => {
    const { title, body, pinned } = req.body;
    if (!title || title.trim() === '') return badRequest(res, 'title required');
    const result = await pool.query(
      `UPDATE announcements SET title=$1, body=$2, pinned=$3 WHERE id=$4 RETURNING *`,
      [title.trim(), body || null, !!pinned, req.params.id]
    );
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

// Delete — superadmin only
router.delete(
  '/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  })
);

export default router;
