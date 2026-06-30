import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// GET /search?q= - global search across the main entities
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ members: [], contributions: [], expenses: [], staff: [], meetings: [], announcements: [] });
    const like = `%${q}%`;

    const [members, contributions, expenses, staff, meetings, announcements] = await Promise.all([
      pool.query(
        `SELECT id, name, role, phone, address FROM members
         WHERE name ILIKE $1 OR phone ILIKE $1 OR address ILIKE $1 OR relation_name ILIKE $1
         ORDER BY name LIMIT 20`,
        [like]
      ),
      pool.query(
        `SELECT c.id, c.amount, c.contribution_date, c.remarks, m.name AS member_name
         FROM contributions c JOIN members m ON c.member_id = m.id
         WHERE m.name ILIKE $1 OR c.remarks ILIKE $1
         ORDER BY c.contribution_date DESC LIMIT 20`,
        [like]
      ),
      pool.query(
        `SELECT id, amount, expense_date, category, description, used_for FROM expenses
         WHERE category ILIKE $1 OR description ILIKE $1 OR used_for ILIKE $1
         ORDER BY expense_date DESC LIMIT 20`,
        [like]
      ),
      pool.query(
        `SELECT id, name, category, contact FROM staff
         WHERE name ILIKE $1 OR category ILIKE $1 OR contact ILIKE $1
         ORDER BY name LIMIT 20`,
        [like]
      ),
      pool.query(
        `SELECT id, meeting_date, location, subject FROM meetings
         WHERE location ILIKE $1 OR subject ILIKE $1 OR description ILIKE $1
         ORDER BY meeting_date DESC LIMIT 20`,
        [like]
      ),
      pool.query(
        `SELECT id, title, created_at FROM announcements
         WHERE title ILIKE $1 OR body ILIKE $1
         ORDER BY created_at DESC LIMIT 20`,
        [like]
      ),
    ]);

    res.json({
      members: members.rows,
      contributions: contributions.rows,
      expenses: expenses.rows,
      staff: staff.rows,
      meetings: meetings.rows,
      announcements: announcements.rows,
    });
  })
);

export default router;
