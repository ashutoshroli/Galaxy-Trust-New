import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { sendMail } from '../utils/mailer.js';
import { logger } from '../utils/logger.js';
import { createSession, listSessions, revokeSession, revokeAllSessions } from '../utils/sessions.js';
import { renderTemplate } from '../utils/templates.js';

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

// Mask an email for display: first 4 chars of the local part, then ****, then @domain.
// e.g. rekhajan2002@gmail.com -> rekh****@gmail.com
function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}****@${domain}`;
}

// Find a login account by username, mobile, or email (account or member email).
// Returns { id, username, name, email } or null.
async function findAccountByIdentifier(identifier) {
  const id = (identifier || '').trim();
  if (!id) return null;
  const digits = id.replace(/\D/g, '');
  const result = await pool.query(
    `SELECT u.id, u.username,
            COALESCE(NULLIF(m.name, ''), u.username) AS name,
            COALESCE(NULLIF(u.email, ''), m.email) AS email
     FROM users u
     LEFT JOIN members m ON u.member_id = m.id
     WHERE LOWER(u.username) = LOWER($1)
        OR (POSITION('@' IN $1) > 0 AND (LOWER(u.email) = LOWER($1) OR LOWER(m.email) = LOWER($1)))
        OR (LENGTH($2) >= 10 AND RIGHT(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 10) = RIGHT($2, 10))
     LIMIT 1`,
    [id, digits]
  );
  return result.rows[0] || null;
}

// Login with username, mobile number OR email
router.post('/login', async (req, res) => {
  const { username, password, remember } = req.body;
  const identifier = (username || '').trim();
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/mobile/email and password required' });
  }
  const digits = identifier.replace(/\D/g, '');
  // "Remember me": keep the session alive for 30 days instead of the usual
  // short-lived token, so the user isn't auto-logged-out on this device.
  const tokenTtl = remember ? '30d' : (process.env.JWT_EXPIRES_IN || '8h');

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

    const jti = await createSession(req, { userId: user.id, remember: !!remember, ttl: tokenTtl });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, member_id: user.member_id, member_role: user.member_role, jti },
      process.env.JWT_SECRET,
      { expiresIn: tokenTtl }
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

// Logout — revokes this device's session (so a stolen/cached token stops
// working immediately) and records the event for the audit log.
router.post('/logout', async (req, res) => {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      await logActivity(decoded.id, decoded.username, 'logout', req);
      if (decoded.jti) {
        await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE jti = $1', [decoded.jti]).catch(() => {});
      }
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

// Look up the account for a username / mobile / email (step 1 of the flow).
// Lets the user confirm the right account before a reset link is sent.
router.post('/forgot-password/lookup', async (req, res) => {
  const identifier = (req.body.identifier || req.body.email || '').trim();
  if (!identifier) return res.status(400).json({ error: 'Enter a username, mobile or email' });
  try {
    const acc = await findAccountByIdentifier(identifier);
    if (!acc) return res.status(404).json({ error: 'No account found for that username, mobile or email.' });
    return res.json({
      name: acc.name,
      username: acc.username,
      hasEmail: Boolean(acc.email),
      maskedEmail: maskEmail(acc.email),
    });
  } catch (err) {
    logger.error('forgot-password lookup error', { message: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// Send a password reset link. Accepts a username / mobile / email.
// Step 1 (lookup) already confirmed the account, so this returns a definite message.
router.post('/forgot-password', async (req, res) => {
  const identifier = (req.body.identifier || req.body.email || '').trim();
  if (!identifier) return res.status(400).json({ error: 'Enter a username, mobile or email' });

  try {
    const acc = await findAccountByIdentifier(identifier);
    if (!acc) return res.status(404).json({ error: 'No account found for that username, mobile or email.' });
    if (!acc.email) {
      return res.status(400).json({ error: 'This account has no email address on file. Please contact an admin.' });
    }

    const toEmail = acc.email;
    const masked = maskEmail(toEmail);

    // Create a single-use token; store only its hash.
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60000);

    // Invalidate any previous outstanding tokens for this user.
    await pool.query('UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE', [acc.id]);
    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [acc.id, tokenHash, expiresAt]
    );

    const link = `${appUrl()}/reset-password?token=${token}`;
    const rendered = await renderTemplate('password_reset_email', {
      username: acc.username,
      link,
      minutes: RESET_TOKEN_TTL_MIN,
    });

    await logActivity(acc.id, acc.username, 'password_reset_requested', req);

    // Respond immediately — don't make the user wait on email delivery.
    res.json({ message: `A reset link has been sent to ${masked}. Please check your inbox.`, maskedEmail: masked });

    if (!rendered) {
      // Superadmin disabled this template — still log the link so an admin
      // can manually help the user if needed.
      logger.warn('Password reset email template disabled', { userId: acc.id, link });
      return;
    }

    // Deliver the email in the background; log the link if it can't be sent.
    sendMail({ to: toEmail, subject: rendered.emailSubject, html: rendered.emailHtml, text: rendered.emailHtml })
      .then((sent) => {
        if (!sent) logger.warn('Password reset link (no email provider)', { userId: acc.id, link });
      })
      .catch((err) => {
        logger.error('reset email send failed', { userId: acc.id, message: err.message, link });
      });
    return;
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
    // Keep the same session (jti) alive across the username change instead
    // of minting an untracked one, so "Active Sessions" stays accurate.
    // Re-derive the remaining lifetime from that session's own expiry
    // rather than resetting to the default -- a "remember me" (30-day)
    // login shouldn't get cut short just from editing the profile.
    let expiresInSec = 8 * 3600;
    if (req.user.jti) {
      const s = await pool.query('SELECT expires_at FROM user_sessions WHERE jti = $1', [req.user.jti]);
      if (s.rows[0]) {
        expiresInSec = Math.max(60, Math.floor((new Date(s.rows[0].expires_at) - Date.now()) / 1000));
      }
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, member_id: user.member_id, member_role, jti: req.user.jti },
      process.env.JWT_SECRET,
      { expiresIn: expiresInSec }
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

// List the logged-in user's active sessions ("Active Sessions" in Profile).
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const rows = await listSessions(req.user.id);
    res.json(
      rows.map((s) => ({
        id: s.id,
        device_label: s.device_label,
        ip_address: s.ip_address,
        remember: s.remember,
        created_at: s.created_at,
        last_seen_at: s.last_seen_at,
        expires_at: s.expires_at,
        current: s.jti === req.user.jti,
      }))
    );
  } catch (err) {
    logger.error('list sessions error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Revoke one session by id ("Log out this device").
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const ok = await revokeSession(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Session not found' });
    await logActivity(req.user.id, req.user.username, 'session_revoked', req);
    res.json({ message: 'Session signed out' });
  } catch (err) {
    logger.error('revoke session error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Revoke every OTHER session (keeps the current device signed in).
router.post('/sessions/revoke-others', authenticate, async (req, res) => {
  try {
    const count = await revokeAllSessions(req.user.id, req.user.jti);
    await logActivity(req.user.id, req.user.username, 'sessions_revoked_others', req);
    res.json({ revoked: count });
  } catch (err) {
    logger.error('revoke-others error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Revoke ALL sessions, including this one ("Sign out everywhere").
router.post('/sessions/revoke-all', authenticate, async (req, res) => {
  try {
    const count = await revokeAllSessions(req.user.id, null);
    await logActivity(req.user.id, req.user.username, 'sessions_revoked_all', req);
    res.json({ revoked: count });
  } catch (err) {
    logger.error('revoke-all error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
