import webpush from 'web-push';
import { pool } from '../db.js';
import { logger } from './logger.js';

// Web Push is optional. Configure with VAPID env vars:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
// Generate keys once with:  npx web-push generate-vapid-keys
let pushReady = false;
(function configurePush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@galaxytrust.app', pub, priv);
      pushReady = true;
      logger.info('Web Push configured');
    } catch (e) {
      logger.error('VAPID config failed', { message: e.message });
    }
  }
})();

export function pushConfigured() {
  return pushReady;
}
export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

export async function allUserIds(exceptId) {
  const r = await pool.query(
    exceptId ? 'SELECT id FROM users WHERE id <> $1' : 'SELECT id FROM users',
    exceptId ? [exceptId] : []
  );
  return r.rows.map((x) => x.id);
}

export async function userIdsForMembers(memberIds) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) return [];
  const r = await pool.query('SELECT id FROM users WHERE member_id = ANY($1::int[])', [memberIds]);
  return r.rows.map((x) => x.id);
}

async function sendPushToUser(userId, payload) {
  if (!pushReady) return;
  const subs = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
  for (const s of subs.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      // Subscription expired/invalid -> clean it up
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
      }
    }
  }
}

// Create in-app notifications for a set of users + fire web push (best-effort).
export async function notifyUsers(userIds, { type, title, body, link }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const values = [];
    const params = [];
    ids.forEach((uid, i) => {
      const b = i * 5;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`);
      params.push(uid, type || null, title, body || null, link || null);
    });
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link) VALUES ${values.join(',')}`,
      params
    );
  } catch (e) {
    logger.error('notify insert failed', { message: e.message });
    return;
  }
  for (const uid of ids) {
    sendPushToUser(uid, { title, body: body || '', link: link || '/' }).catch(() => {});
  }
}

export async function notifyAll(actorUserId, payload) {
  const ids = await allUserIds(actorUserId);
  return notifyUsers(ids, payload);
}

export async function notifyMembers(memberIds, payload) {
  const ids = await userIdsForMembers(memberIds);
  return notifyUsers(ids, payload);
}

export async function saveSubscription(userId, sub) {
  if (!sub || !sub.endpoint || !sub.keys) return;
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
}
