import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import membersRoutes from './routes/members.js';
import contributionsRoutes from './routes/contributions.js';
import expensesRoutes from './routes/expenses.js';
import installmentsRoutes from './routes/installments.js';
import meetingsRoutes from './routes/meetings.js';
import reportsRoutes from './routes/reports.js';
import staffRoutes from './routes/staff.js';
import feedRoutes from './routes/feed.js';
import permissionsRoutes from './routes/permissions.js';
import cashiersRoutes from './routes/cashiers.js';
import announcementsRoutes from './routes/announcements.js';
import activityRoutes from './routes/activity.js';
import searchRoutes from './routes/search.js';
import backupRoutes from './routes/backup.js';
import navPermissionsRoutes from './routes/navPermissions.js';
import notificationsRoutes from './routes/notifications.js';
import templatesRoutes from './routes/templates.js';
import { pool } from './db.js';
import { logger } from './utils/logger.js';
import { activityLogger } from './utils/activityLog.js';
import { applySchema } from './utils/migrate.js';
import { startScheduler, stopScheduler } from './utils/scheduler.js';

const isProd = process.env.NODE_ENV === 'production';

// --- Startup environment validation -----------------------------------------
// Fail fast (or warn loudly) if critical secrets are missing/insecure.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not set. Refusing to start — set it in your .env file.');
  process.exit(1);
}
if (JWT_SECRET.length < 16) {
  logger.warn('JWT_SECRET is short. Use a long, random string (32+ chars) in production.');
}
if (!process.env.DB_NAME || !process.env.DB_USER) {
  logger.warn('DB_NAME / DB_USER not set — database connection may fail.');
}

const app = express();
app.disable('x-powered-by');

// Render (and most hosts) put the app behind a reverse proxy. Trust the first
// proxy hop so express-rate-limit / IP logging read the real client IP from
// X-Forwarded-For (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
app.set('trust proxy', 1);

app.use(helmet());

// CORS: restrict to a comma-separated allowlist (CORS_ORIGIN) when provided,
// otherwise allow all (handy for local/Termux self-hosting).
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Lightweight request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

// Rate limiters apply in production only (so local/dev testing isn't blocked).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProd,
  message: { error: 'Too many login attempts from this IP, please try again later.' },
});
app.use('/api/auth/login', loginLimiter);

// Forgot-password (lookup + send) — tighter limit: prevents account
// enumeration and stops one IP from spamming reset emails to a target.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProd,
  message: { error: 'Too many password reset attempts. Please try again later.' },
});
app.use('/api/auth/forgot-password', forgotPasswordLimiter);

// General API rate limit (generous — protects against accidental floods)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProd,
});
app.use('/api', apiLimiter);

// Auto-log all successful create/update/delete actions to the Activity Log.
app.use('/api', activityLogger);

app.use('/api/auth', authRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/contributions', contributionsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/installments', installmentsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/cashiers', cashiersRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/nav-permissions', navPermissionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/templates', templatesRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', time: new Date().toISOString() });
  }
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler — every route uses asyncHandler so errors land here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('unhandled_error', {
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.publicMessage || 'Server error' });
});

// Safety net: never let an unhandled rejection silently take down the process.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: reason?.message || String(reason) });
});

const PORT = process.env.PORT || 3000;

// Auto-apply db/schema.sql on every boot (idempotent — see utils/migrate.js),
// so a new feature's schema change lands automatically without anyone having
// to run SQL by hand on Neon/Render. Set SKIP_AUTO_MIGRATE=true to disable
// (e.g. if you prefer to run `npm run setup-db` manually).
let server;
async function start() {
  if (process.env.SKIP_AUTO_MIGRATE !== 'true') {
    const ok = await applySchema(pool);
    if (!ok && isProd) {
      logger.error('Startup migration failed — refusing to start in production. Fix the schema and redeploy.');
      process.exit(1);
    }
  }
  server = app.listen(PORT, () => {
    logger.info(`Galaxy Trust backend running on port ${PORT}`, { env: process.env.NODE_ENV || 'development' });
  });
  startScheduler();
}
start();

// Graceful shutdown — Render/containers send SIGTERM on restart/stop.
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  stopScheduler();
  const closeDb = () => pool.end().then(() => process.exit(0)).catch(() => process.exit(0));
  // server may still be undefined if SIGTERM arrives while the startup
  // migration is still running.
  if (server) server.close(closeDb);
  else closeDb();
  // Force-exit if it hangs
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
