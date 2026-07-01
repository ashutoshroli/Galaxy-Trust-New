import cron from 'node-cron';
import { pool } from '../db.js';
import { logger } from './logger.js';
import { notifyMembers } from './notify.js';
import { sendReminderText } from './sms.js';
import { renderTemplate } from './templates.js';

// Automatic daily reminders — no admin action needed:
//   1. Pending installments: nudges members with an outstanding balance,
//      at most once every REMINDER_COOLDOWN_DAYS (default 3) so the same
//      person isn't pinged every single day.
//   2. Upcoming birthdays: wishes members whose birthday is today, and
//      gives the trust admins a heads-up a few days ahead.
// Each reminder goes out as an in-app/push notification (via notify.js) and,
// if a member's phone + Twilio are configured, as a WhatsApp/SMS text too.
//
// Runs on the schedule set by REMINDER_CRON (default: every day at 9:00 AM
// server time — "0 9 * * *"). Disable entirely with ENABLE_REMINDERS=false.

const REMINDER_COOLDOWN_DAYS = parseInt(process.env.REMINDER_COOLDOWN_DAYS || '3', 10);

async function remindPendingInstallments() {
  const rows = await pool.query(`
    SELECT i.member_id, m.name, m.phone,
           SUM(i.total_amount - i.paid_amount) AS balance,
           MAX(i.last_reminded_at) AS last_reminded_at
    FROM installments i
    JOIN members m ON m.id = i.member_id
    WHERE (i.total_amount - i.paid_amount) > 0 AND m.active = true
    GROUP BY i.member_id, m.name, m.phone
  `);

  let notified = 0;
  for (const r of rows.rows) {
    const lastReminded = r.last_reminded_at ? new Date(r.last_reminded_at) : null;
    const dueForReminder =
      !lastReminded || Date.now() - lastReminded.getTime() >= REMINDER_COOLDOWN_DAYS * 86400000;
    if (!dueForReminder) continue;

    const amount = Number(r.balance).toLocaleString('en-IN');
    const rendered = await renderTemplate('installment_reminder', { name: r.name, amount }).catch((e) => {
      logger.error('installment_reminder template render failed', { message: e.message });
      return null;
    });
    if (!rendered) continue; // template disabled by the superadmin

    await notifyMembers([r.member_id], {
      type: 'installment_reminder',
      title: rendered.title,
      body: rendered.body,
      link: '/installments',
    }).catch((e) => logger.error('scheduled reminder notify failed', { message: e.message }));

    if (r.phone) {
      await sendReminderText(r.phone, rendered.body).catch((e) =>
        logger.error('scheduled reminder text failed', { memberId: r.member_id, message: e.message })
      );
    }

    await pool
      .query('UPDATE installments SET last_reminded_at = NOW() WHERE member_id = $1 AND (total_amount - paid_amount) > 0', [
        r.member_id,
      ])
      .catch(() => {});
    notified++;
  }
  if (notified) logger.info('scheduled installment reminders sent', { notified });
  return notified;
}

async function remindBirthdaysToday() {
  const result = await pool.query(
    `SELECT id, name, phone FROM members
     WHERE active = true AND dob IS NOT NULL
       AND EXTRACT(MONTH FROM dob) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM dob) = EXTRACT(DAY FROM CURRENT_DATE)`
  );

  let wished = 0;
  for (const m of result.rows) {
    const rendered = await renderTemplate('birthday', { name: m.name }).catch((e) => {
      logger.error('birthday template render failed', { message: e.message });
      return null;
    });
    if (!rendered) continue; // template disabled by the superadmin

    await notifyMembers([m.id], {
      type: 'birthday',
      title: rendered.title,
      body: rendered.body,
      link: '/members',
    }).catch((e) => logger.error('birthday notify failed', { message: e.message }));

    if (m.phone) {
      await sendReminderText(m.phone, rendered.body).catch((e) =>
        logger.error('birthday text failed', { memberId: m.id, message: e.message })
      );
    }
    wished++;
  }
  if (wished) logger.info('birthday wishes sent', { wished });
  return wished;
}

export async function runDailyReminders() {
  const [installments, birthdays] = await Promise.all([
    remindPendingInstallments().catch((e) => {
      logger.error('installment reminder job failed', { message: e.message });
      return 0;
    }),
    remindBirthdaysToday().catch((e) => {
      logger.error('birthday reminder job failed', { message: e.message });
      return 0;
    }),
  ]);
  return { installments, birthdays };
}

let task = null;

export function startScheduler() {
  if (process.env.ENABLE_REMINDERS === 'false') {
    logger.info('Scheduled reminders disabled (ENABLE_REMINDERS=false)');
    return;
  }
  const schedule = process.env.REMINDER_CRON || '0 9 * * *';
  if (!cron.validate(schedule)) {
    logger.error('Invalid REMINDER_CRON expression — scheduler not started', { schedule });
    return;
  }
  task = cron.schedule(schedule, () => {
    runDailyReminders()
      .then((r) => logger.info('daily reminder run complete', r))
      .catch((e) => logger.error('daily reminder run failed', { message: e.message }));
  });
  logger.info('Reminder scheduler started', { schedule });
}

export function stopScheduler() {
  task?.stop();
}
