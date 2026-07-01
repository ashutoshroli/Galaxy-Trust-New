import crypto from 'crypto';
import { pool } from '../db.js';

// Turns a User-Agent string into a short, human-friendly device label,
// e.g. "Chrome on Android", "Safari on iPhone", "Firefox on Windows".
export function labelDevice(userAgent) {
  const ua = userAgent || '';
  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Unknown device';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone/i.test(ua)) os = 'iPhone';
  else if (/ipad/i.test(ua)) os = 'iPad';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'Mac';
  else if (/linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
}

// Converts a jsonwebtoken expiresIn duration string ("8h", "30d") to a JS Date.
export function expiryFromDuration(duration) {
  const m = /^(\d+)([smhd])$/.exec(String(duration).trim());
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = m ? parseInt(m[1], 10) * (unitMs[m[2]] || 0) : 8 * 3600000;
  return new Date(Date.now() + (ms || 8 * 3600000));
}

// Creates a session row for a freshly-issued token. Returns the jti to embed
// in the JWT payload.
export async function createSession(req, { userId, remember, ttl }) {
  const jti = crypto.randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO user_sessions (user_id, jti, device_label, ip_address, remember, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, jti, labelDevice(req.headers['user-agent']), clientIp(req), !!remember, expiryFromDuration(ttl)]
  );
  return jti;
}

export async function listSessions(userId) {
  const r = await pool.query(
    `SELECT id, jti, device_label, ip_address, remember, created_at, last_seen_at, expires_at
     FROM user_sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY last_seen_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function revokeSession(userId, sessionId) {
  const r = await pool.query(
    'UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id',
    [sessionId, userId]
  );
  return r.rows.length > 0;
}

// Revokes every session for a user. If exceptJti is given, that one session
// (the caller's own current one) is left alone -- used by "Sign out of all
// OTHER devices".
export async function revokeAllSessions(userId, exceptJti) {
  const r = await pool.query(
    exceptJti
      ? 'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL AND jti <> $2 RETURNING id'
      : 'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id',
    exceptJti ? [userId, exceptJti] : [userId]
  );
  return r.rows.length;
}
