import express from 'express';
import { pool } from '../db.js';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// Pages a superadmin can grant/revoke per role.
export const CONFIGURABLE_PAGES = [
  'search', 'feed', 'announcements', 'members', 'contributions',
  'expenses', 'staff', 'installments', 'meetings', 'reports',
];
// Always visible to every logged-in user.
const ALWAYS = ['dashboard', 'profile'];
// Pages only the superadmin ever sees (not configurable).
const SUPERADMIN_PAGES = ['cashier', 'activity', 'permissions', 'sidebarPerms', 'templates'];
// Roles that can be configured (superadmin is always full-access).
export const CONFIG_ROLES = ['admin', 'manager', 'president', 'secretary', 'treasurer', 'trustee', 'viewer'];

// GET /nav-permissions/mine - allowed page keys for the logged-in user's role
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const role = req.user.role;
    if (role === 'superadmin') {
      return res.json({ allowed: [...ALWAYS, ...CONFIGURABLE_PAGES, ...SUPERADMIN_PAGES] });
    }
    const rows = await pool.query('SELECT page_key, visible FROM nav_permissions WHERE role = $1', [role]);
    const stored = {};
    rows.rows.forEach((r) => { stored[r.page_key] = r.visible; });
    const allowed = [...ALWAYS];
    CONFIGURABLE_PAGES.forEach((p) => {
      const v = p in stored ? stored[p] : true; // default visible
      if (v) allowed.push(p);
    });
    res.json({ allowed });
  })
);

// GET /nav-permissions - full matrix (superadmin only)
router.get(
  '/',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const rows = await pool.query('SELECT role, page_key, visible FROM nav_permissions');
    const stored = {};
    rows.rows.forEach((r) => { stored[`${r.role}:${r.page_key}`] = r.visible; });
    const matrix = {};
    CONFIG_ROLES.forEach((role) => {
      matrix[role] = {};
      CONFIGURABLE_PAGES.forEach((p) => {
        const k = `${role}:${p}`;
        matrix[role][p] = k in stored ? stored[k] : true;
      });
    });
    res.json({ pages: CONFIGURABLE_PAGES, roles: CONFIG_ROLES, matrix });
  })
);

// PUT /nav-permissions - upsert one role/page visibility (superadmin only)
router.put(
  '/',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const { role, page_key, visible } = req.body;
    if (!CONFIG_ROLES.includes(role)) return badRequest(res, 'Invalid role');
    if (!CONFIGURABLE_PAGES.includes(page_key)) return badRequest(res, 'Invalid page');
    await pool.query(
      `INSERT INTO nav_permissions (role, page_key, visible) VALUES ($1, $2, $3)
       ON CONFLICT (role, page_key) DO UPDATE SET visible = EXCLUDED.visible`,
      [role, page_key, !!visible]
    );
    res.json({ role, page_key, visible: !!visible });
  })
);

export default router;
