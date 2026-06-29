import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role, member_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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
