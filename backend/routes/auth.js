import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCK_MINUTES = parseInt(process.env.LOCK_TIME_MINUTES || '15');

// Login with username, mobile number OR email
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const identifier = (username || '').trim();
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/mobile/email and password required' });
  }
  const digits = identifier.replace(/\D/g, '');

  try {
    const result = await pool.query(
      `SELECT u.*, m.role AS member_role
       FROM users u
       LEFT JOIN members m ON u.member_id = m.id
       WHERE LOWER(u.username) = LOWER($1)
          OR (POSITION('@' IN $1) > 0 AND LOWER(u.email) = LOWER($1))
          OR (LENGTH($2) >= 10 AND RIGHT(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 10) = RIGHT($2, 10))
       LIMIT 1`,
      [identifier, digits]
    );
    const user = result.rows[0];

    if (!user) {
      await logActivity(null, identifier, 'login_failed', req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minsLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      await logActivity(user.id, user.username, 'locked', req);
      return res.status(423).json({ error: `Account locked. Try again in ${minsLeft} minute(s).` });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      const attempts = (user.failed_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
      }
      await pool.query(
        'UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts >= MAX_ATTEMPTS ? 0 : attempts, lockedUntil, user.id]
      );
      await logActivity(user.id, user.username, 'login_failed', req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success
    await pool.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );
    await logActivity(user.id, user.username, 'login_success', req);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, member_id: user.member_id, member_role: user.member_role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, member_id: user.member_id, member_role: user.member_role },
    });
  } catch (err) {
    logger.error('login error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

async function logActivity(userId, username, action, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    await pool.query(
      'INSERT INTO login_activity (user_id, username, action, ip_address) VALUES ($1,$2,$3,$4)',
      [userId, username, action, ip]
    );
  } catch (e) {
    logger.error('Failed to log activity', { message: e.message });
  }
}

// Logout — JWT is stateless, so this just records the event for the audit log.
router.post('/logout', async (req, res) => {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      await logActivity(decoded.id, decoded.username, 'logout', req);
    } catch (err) {
      // ignore invalid/expired token on logout
    }
  }
  res.json({ message: 'Logged out' });
});

// Change own password (authenticated)
router.post('/change-password', async (req, res) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    await logActivity(user.id, user.username, 'password_changed', req);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error('change-password error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get the logged-in user's own account info (username + email)
router.get('/account', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    logger.error('account get error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Update the logged-in user's own username and/or email
router.put('/account', authenticate, async (req, res) => {
  const username = (req.body.username || '').trim();
  const email = (req.body.email || '').trim();

  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    // Username must stay unique (case-insensitive), ignoring the user's own row
    const dup = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2',
      [username, req.user.id]
    );
    if (dup.rows.length) return res.status(409).json({ error: 'That username is already taken' });

    // Email must also be unique (it can be used to log in), ignoring the user's own row
    if (email) {
      const dupEmail = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
        [email, req.user.id]
      );
      if (dupEmail.rows.length) return res.status(409).json({ error: 'That email is already in use' });
    }

    const result = await pool.query(
      'UPDATE users SET username = $1, email = $2 WHERE id = $3 RETURNING id, username, email, role, member_id',
      [username, email || null, req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // The username is embedded in the JWT, so issue a fresh token reflecting the change
    let member_role = null;
    if (user.member_id) {
      const mr = await pool.query('SELECT role AS member_role FROM members WHERE id = $1', [user.member_id]);
      member_role = mr.rows[0]?.member_role || null;
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, member_id: user.member_id, member_role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await logActivity(user.id, user.username, 'account_updated', req);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        member_id: user.member_id,
        member_role,
      },
    });
  } catch (err) {
    logger.error('account update error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
