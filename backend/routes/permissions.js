import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);
router.use(onlySuperAdmin); // entire permissions module is superadmin-only

function genPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// Roles a superadmin can assign through the UI (superadmin itself is intentionally excluded)
export const ASSIGNABLE_ROLES = ['admin', 'manager', 'president', 'secretary', 'treasurer', 'trustee', 'viewer'];

// GET /permissions/members - every member with their linked login account + current role
router.get(
  '/members',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT m.id AS member_id, m.name, m.role AS member_role,
             u.id AS user_id, u.username, u.role AS login_role
      FROM members m
      LEFT JOIN users u ON u.member_id = m.id AND u.role <> 'superadmin'
      ORDER BY m.name
    `);
    res.json({ roles: ASSIGNABLE_ROLES, members: result.rows });
  })
);

// PUT /permissions/role - set the login permission role for a member's account
router.put(
  '/role',
  asyncHandler(async (req, res) => {
    const { member_id, role } = req.body;
    if (!member_id) return badRequest(res, 'member_id required');
    if (!ASSIGNABLE_ROLES.includes(role)) return badRequest(res, 'Invalid role');

    const userRes = await pool.query(
      "SELECT id FROM users WHERE member_id = $1 AND role <> 'superadmin'",
      [member_id]
    );
    if (!userRes.rows[0]) {
      return res.status(400).json({ error: 'Is member ka login account nahi hai. Pehle login banao (npm run create-logins).' });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, member_id',
      [role, userRes.rows[0].id]
    );
    if (!result.rows[0]) return notFound(res, 'User not found');
    res.json(result.rows[0]);
  })
);

// PUT /permissions/reset-password - generate a new password for a member's login.
// Returns the plaintext password ONCE so the superadmin can share it.
router.put(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { member_id } = req.body;
    if (!member_id) return badRequest(res, 'member_id required');

    const userRes = await pool.query(
      "SELECT id, username FROM users WHERE member_id = $1 AND role <> 'superadmin'",
      [member_id]
    );
    if (!userRes.rows[0]) {
      return res.status(400).json({ error: 'Is member ka login account nahi hai. Pehle login banao (npm run create-logins).' });
    }

    const password = genPassword();
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2',
      [hash, userRes.rows[0].id]
    );

    res.json({ username: userRes.rows[0].username, password });
  })
);

export default router;
