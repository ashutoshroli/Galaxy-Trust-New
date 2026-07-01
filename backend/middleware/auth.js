import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export async function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = decoded; // { id, username, role, member_id, jti }

  // Session revocation check ("Logout from all devices" support). Tokens
  // issued before this feature existed have no jti — treat those as valid
  // so nobody gets logged out by this change. A DB hiccup here also fails
  // open (lets the request through) rather than locking everyone out.
  if (decoded.jti) {
    try {
      const r = await pool.query('SELECT revoked_at FROM user_sessions WHERE jti = $1', [decoded.jti]);
      if (r.rows[0]?.revoked_at) {
        return res.status(401).json({ error: 'This session has been signed out. Please sign in again.' });
      }
      pool.query('UPDATE user_sessions SET last_seen_at = NOW() WHERE jti = $1', [decoded.jti]).catch(() => {});
    } catch {
      // ignore — fail open
    }
  }
  next();
}

// superadmin = full access always
// allowedRoles = roles permitted for this specific action (besides superadmin)
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'superadmin') return next(); // full rights
    if (allowedRoles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Permission denied for your role' });
  };
}

// Capability tiers (superadmin always passes via authorize):
// - ADD:    president, secretary, treasurer, manager, admin
// - EDIT:   admin (PUT/update)
// - DELETE: superadmin only
export const canAdd = authorize('president', 'secretary', 'treasurer', 'manager', 'admin');
export const canEdit = authorize('admin');
export const canDelete = authorize();

// Backwards-compatible alias: superadmin-only (used for delete + admin-only routes)
export const onlySuperAdmin = authorize();
