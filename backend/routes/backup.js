import express from 'express';
import { pool } from '../db.js';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);
router.use(onlySuperAdmin); // full data export is superadmin-only

// Tables exported in the backup. Sensitive auth fields are excluded.
const TABLES = [
  { name: 'members', sql: 'SELECT * FROM members ORDER BY id' },
  { name: 'users', sql: 'SELECT id, username, role, member_id, phone, last_login, created_at FROM users ORDER BY id' },
  { name: 'contributions', sql: 'SELECT * FROM contributions ORDER BY id' },
  { name: 'expenses', sql: 'SELECT * FROM expenses ORDER BY id' },
  { name: 'installments', sql: 'SELECT * FROM installments ORDER BY id' },
  { name: 'meetings', sql: 'SELECT * FROM meetings ORDER BY id' },
  { name: 'meeting_attendance', sql: 'SELECT * FROM meeting_attendance ORDER BY id' },
  { name: 'staff', sql: 'SELECT * FROM staff ORDER BY id' },
  { name: 'staff_payments', sql: 'SELECT * FROM staff_payments ORDER BY id' },
  { name: 'cashiers', sql: 'SELECT * FROM cashiers ORDER BY id' },
  { name: 'cashier_allocations', sql: 'SELECT * FROM cashier_allocations ORDER BY id' },
  { name: 'announcements', sql: 'SELECT * FROM announcements ORDER BY id' },
  { name: 'feed_posts', sql: 'SELECT id, author_user_id, content, location, edit_count, created_at FROM feed_posts ORDER BY id' },
  { name: 'feed_comments', sql: 'SELECT * FROM feed_comments ORDER BY id' },
];

// GET /backup - full JSON snapshot of the database
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = {};
    for (const t of TABLES) {
      try {
        const r = await pool.query(t.sql);
        data[t.name] = r.rows;
      } catch (e) {
        data[t.name] = { error: e.message };
      }
    }
    const payload = {
      generated_at: new Date().toISOString(),
      app: 'Galaxy Trust',
      tables: data,
    };
    const filename = `galaxy-trust-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  })
);

export default router;
