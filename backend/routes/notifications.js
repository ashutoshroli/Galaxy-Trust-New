import express from 'express';
import { pool } from '../db.js';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/http.js';
import { vapidPublicKey, saveSubscription, notifyMembers } from '../utils/notify.js';
import { runDailyReminders } from '../utils/scheduler.js';

const router = express.Router();
router.use(authenticate);

// GET /notifications - my recent notifications + unread count
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const rows = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2',
      [req.user.id, limit]
    );
    const unread = await pool.query(
      'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read = false',
      [req.user.id]
    );
    res.json({ unread: unread.rows[0].c, items: rows.rows });
  })
);

// POST /notifications/read - mark one ({id}) or all ({all:true}) as read
router.post(
  '/read',
  asyncHandler(async (req, res) => {
    const { id, all } = req.body;
    if (all) {
      await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.user.id]);
    } else if (id) {
      await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    } else {
      return badRequest(res, 'id or all required');
    }
    res.json({ message: 'ok' });
  })
);

// --- Web Push ---
router.get('/vapid-key', (req, res) => res.json({ key: vapidPublicKey() }));

router.post(
  '/push/subscribe',
  asyncHandler(async (req, res) => {
    await saveSubscription(req.user.id, req.body?.subscription || req.body);
    res.json({ message: 'subscribed' });
  })
);

router.post(
  '/push/unsubscribe',
  asyncHandler(async (req, res) => {
    const endpoint = req.body?.endpoint;
    if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
    res.json({ message: 'unsubscribed' });
  })
);

// POST /notifications/remind-installments - superadmin sends reminders to members with pending balance
router.post(
  '/remind-installments',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const rows = await pool.query(`
      SELECT i.member_id, SUM(i.total_amount - i.paid_amount) AS balance
      FROM installments i
      WHERE (i.total_amount - i.paid_amount) > 0
      GROUP BY i.member_id
    `);
    let reminded = 0;
    for (const r of rows.rows) {
      await notifyMembers([r.member_id], {
        type: 'installment_reminder',
        title: '⏳ Pending Installment',
        body: `Aapki ₹${Number(r.balance).toLocaleString('en-IN')} ki kisht abhi baki hai.`,
        link: '/installments',
      });
      reminded++;
    }
    res.json({ reminded });
  })
);

// POST /notifications/run-scheduled-reminders - superadmin manually triggers
// the same job the daily cron runs (pending installments + birthdays today).
// Useful to test delivery, or to force a run without waiting for 9 AM.
router.post(
  '/run-scheduled-reminders',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const result = await runDailyReminders();
    res.json(result);
  })
);

export default router;
