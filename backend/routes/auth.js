import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { sendMail } from '../utils/mailer.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCK_MINUTES = parseInt(process.env.LOCK_TIME_MINUTES || '15');
const RESET_TOKEN_TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30');

// Base URL of the frontend, used to build the password-reset link.
function appUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  const origin = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return origin ? origin.replace(/\/+$/, '') : '';
}

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
          OR (POSITION('@' IN $1) > 0 AND (LOWER(u.email) = LOWER($1) OR LOWER(m.email) = LOWER($1)))
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

// Look up the account name for an email (step 1 of the forgot-password flow).
// Lets the user confirm the right account before a reset link is sent.
router.post('/forgot-password/lookup', async (req, res) => {
  const email = (req.body.email || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  try {
    const result = await pool.query(
      `SELECT u.username, COALESCE(NULLIF(m.name, ''), u.username) AS name
       FROM users u
       LEFT JOIN members m ON u.member_id = m.id
       WHERE LOWER(u.email) = LOWER($1) OR LOWER(m.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No account is registered with that email.' });
    return res.json({ name: user.name, username: user.username });
  } catch (err) {
    logger.error('forgot-password lookup error', { message: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// Request a password reset link by email.
// Always returns a generic success so attackers can't probe which emails exist.
router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').trim();
  const generic = { message: 'If an account with that email exists, a reset link has been sent.' };

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email AS user_email, m.email AS member_email
       FROM users u
       LEFT JOIN members m ON u.member_id = m.id
       WHERE LOWER(u.email) = LOWER($1) OR LOWER(m.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.json(generic); // don't reveal non-existence

    // Send to whichever stored email matched the request (account or member email)
    const toEmail =
      [user.user_email, user.member_email].find((e) => e && e.toLowerCase() === email.toLowerCase()) ||
      user.user_email ||
      user.member_email;

    // Create a single-use token; store only its hash.
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60000);

    // Invalidate any previous outstanding tokens for this user.
    await pool.query('UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id]);
    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    const link = `${appUrl()}/reset-password?token=${token}`;
    const subject = 'Galaxy Trust — Reset your password';
    const text =
      `Hello ${user.username},\n\n` +
      `We received a request to reset your Galaxy Trust password. ` +
      `Open the link below to set a new password (valid for ${RESET_TOKEN_TTL_MIN} minutes):\n\n` +
      `${link}\n\n` +
      `If you didn't request this, you can safely ignore this email — your password won't change.`;
    const html =
      `<p>Hello <b>${user.username}</b>,</p>` +
      `<p>We received a request to reset your Galaxy Trust password. ` +
      `Click the button below to set a new password. This link is valid for ${RESET_TOKEN_TTL_MIN} minutes.</p>` +
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#6d5efc;color:#fff;border-radius:8px;text-decoration:none">Reset Password</a></p>` +
      `<p>Or paste this link into your browser:<br><a href="${link}">${link}</a></p>` +
      `<p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>`;

    const sent = await sendMail({ to: toEmail, subject, text, html });
    if (!sent) {
      // SMTP not configured — surface the link in the server log as a fallback.
      logger.warn('Password reset link (email not sent — SMTP off)', { userId: user.id, link });
    }

    await logActivity(user.id, user.username, 'password_reset_requested', req);
    return res.json(generic);
  } catch (err) {
    logger.error('forgot-password error', { message: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// Complete a password reset using the emailed token.
router.post('/reset-password', async (req, res) => {
  const token = (req.body.token || '').trim();
  const newPassword = req.body.new_password || '';

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      'SELECT * FROM password_resets WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW() LIMIT 1',
      [tokenHash]
    );
    const reset = result.rows[0];
    if (!reset) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2',
      [newHash, reset.user_id]
    );
    await pool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [reset.id]);

    const u = await pool.query('SELECT username FROM users WHERE id = $1', [reset.user_id]);
    await logActivity(reset.user_id, u.rows[0]?.username || null, 'password_reset', req);

    return res.json({ message: 'Your password has been reset. Please sign in.' });
  } catch (err) {
    logger.error('reset-password error', { message: err.message });
    return res.status(500).json({ error: 'Server error' });
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
