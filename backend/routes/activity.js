import express from 'express';
import { pool } from '../db.js';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);
router.use(onlySuperAdmin); // entire activity log is superadmin-only

// GET /activity?limit=&offset=&action= - paginated login/activity log
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const action = (req.query.action || '').trim();

    const params = [];
    let where = '';
    if (action) {
      params.push(action);
      where = `WHERE action = $${params.length}`;
    }

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM login_activity ${where}`, params);

    params.push(limit);
    params.push(offset);
    const result = await pool.query(
      `SELECT id, user_id, username, action, ip_address, created_at
       FROM login_activity ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ total: totalRes.rows[0].total, rows: result.rows });
  })
);

export default router;
