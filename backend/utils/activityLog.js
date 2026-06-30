import { pool } from '../db.js';
import { logger } from './logger.js';

// Auto-logs every successful create/update/delete across the API into
// login_activity, so the Activity Log shows all changes (not just logins).
//
// Skipped:
//   /api/auth          — auth.js already logs these with richer names
//   /api/notifications — read-state toggles would flood the log

const SKIP_PREFIXES = ['/api/auth', '/api/notifications'];

const RESOURCE_LABEL = {
  members: 'Member',
  contributions: 'Contribution',
  expenses: 'Expense',
  installments: 'Installment',
  meetings: 'Meeting',
  staff: 'Staff',
  feed: 'Feed post',
  announcements: 'Announcement',
  permissions: 'Permission',
  'nav-permissions': 'Sidebar access',
  cashiers: 'Cashier',
  reports: 'Report',
};

function verbFor(method) {
  switch (method) {
    case 'POST':
      return 'created';
    case 'PUT':
    case 'PATCH':
      return 'updated';
    case 'DELETE':
      return 'deleted';
    default:
      return null;
  }
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .toString()
    .split(',')[0]
    .trim();
}

// Pull a human-friendly label out of the request body, ignoring big fields.
function bodyLabel(body = {}) {
  const candidates = [body.name, body.title, body.username, body.purpose, body.reason, body.description];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim().slice(0, 80);
  }
  if (body.amount != null && body.amount !== '') return `\u20b9${body.amount}`;
  return '';
}

function describe(req, verb, path) {
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resource = segments[0] || 'record';
  const rest = segments.slice(1);

  // Special case: admin resetting a member's login password
  if (resource === 'permissions' && rest.includes('reset-password')) {
    const mid = req.body?.member_id;
    return { action: 'password_reset', details: `Reset login password${mid ? ` for member #${mid}` : ''}` };
  }

  const label = RESOURCE_LABEL[resource] || resource.replace(/-/g, ' ');
  const action = `${resource}_${verb}`.slice(0, 80);
  const id = rest.find((p) => /^\d+$/.test(p));
  let details = `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${label.toLowerCase()}`;
  if (id) details += ` #${id}`;
  const name = bodyLabel(req.body);
  if (name) details += `: ${name}`;
  return { action, details: details.slice(0, 250) };
}

export function activityLogger(req, res, next) {
  const verb = verbFor(req.method);
  if (!verb) return next(); // only POST / PUT / PATCH / DELETE
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return next();

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return; // successes only
    if (!req.user) return; // unauthenticated (shouldn't happen on 2xx) — skip
    let entry;
    try {
      entry = describe(req, verb, path);
    } catch {
      return;
    }
    pool
      .query(
        'INSERT INTO login_activity (user_id, username, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, req.user.username, entry.action, entry.details, clientIp(req)]
      )
      .catch((e) => logger.error('activity log insert failed', { message: e.message }));
  });

  next();
}
