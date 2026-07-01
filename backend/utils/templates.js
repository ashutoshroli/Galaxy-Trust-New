import { pool } from '../db.js';
import { logger } from './logger.js';

// Central registry of every automatic notification/message the app sends,
// with a built-in default and a list of placeholders it supports. A
// superadmin can override title/body (and email subject/html, for
// email-based templates) from the "Notification Templates" page, and can
// disable a template entirely. Overrides live in notification_templates;
// a missing row (or a NULL field on that row) simply falls back to the
// default below, so shipping a new template never needs a data migration.
//
// Placeholders use {like_this} and are filled in with fillPlaceholders().

export const TEMPLATE_DEFS = {
  installment_reminder: {
    label: 'Pending Installment Reminder',
    description: 'Sent automatically to a member with an unpaid installment balance (daily scheduler + manual "Send Reminders").',
    channels: ['in-app/push', 'whatsapp/sms'],
    placeholders: ['name', 'amount'],
    defaults: {
      title: '\u23f3 Pending Installment',
      body: 'Aapki \u20b9{amount} ki kisht abhi baki hai. Kripya jald bhugtan karein. \u2014 Galaxy Trust',
    },
  },
  birthday: {
    label: 'Birthday Wish',
    description: 'Sent automatically to a member on their birthday (daily scheduler).',
    channels: ['in-app/push', 'whatsapp/sms'],
    placeholders: ['name'],
    defaults: {
      title: '\ud83c\udf82 Happy Birthday!',
      body: 'Wishing you a wonderful birthday, {name}! \u2014 Galaxy Trust',
    },
  },
  meeting_created: {
    label: 'New Meeting Announcement',
    description: 'Sent to everyone when a new meeting is scheduled.',
    channels: ['in-app/push'],
    placeholders: ['subject', 'date'],
    defaults: {
      title: '\ud83d\udce1 New Meeting',
      body: '{subject} \u00b7 {date}',
    },
  },
  password_reset_email: {
    label: 'Password Reset Email',
    description: 'Emailed when a user requests a password reset link.',
    channels: ['email'],
    placeholders: ['username', 'link', 'minutes'],
    defaults: {
      email_subject: 'Galaxy Trust \u2014 Reset your password',
      email_html:
        '<p>Hello <b>{username}</b>,</p>' +
        '<p>We received a request to reset your Galaxy Trust password. ' +
        'Click the button below to set a new password. This link is valid for {minutes} minutes.</p>' +
        '<p><a href="{link}" style="display:inline-block;padding:10px 18px;background:#6d5efc;color:#fff;border-radius:8px;text-decoration:none">Reset Password</a></p>' +
        '<p>Or paste this link into your browser:<br><a href="{link}">{link}</a></p>' +
        '<p style="color:#888;font-size:13px">If you didn\'t request this, you can safely ignore this email \u2014 your password won\'t change.</p>',
    },
  },
};

export function fillPlaceholders(text, vars = {}) {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}

// Loads all stored overrides once per call (small table, superadmin-edited
// rarely) -- simplest correct approach; add caching later if this table
// ever gets large or hot.
async function getOverride(key) {
  try {
    const r = await pool.query('SELECT * FROM notification_templates WHERE template_key = $1', [key]);
    return r.rows[0] || null;
  } catch (e) {
    logger.error('template override lookup failed', { key, message: e.message });
    return null;
  }
}

// Resolves the effective template for a key: stored override merged over
// the built-in default (a NULL/missing override field falls back to the
// default). Returns null if the template is disabled.
export async function renderTemplate(key, vars = {}) {
  const def = TEMPLATE_DEFS[key];
  if (!def) throw new Error(`Unknown template key: ${key}`);
  const override = await getOverride(key);

  if (override && override.enabled === false) return null;

  const title = fillPlaceholders(override?.title ?? def.defaults.title ?? '', vars);
  const body = fillPlaceholders(override?.body ?? def.defaults.body ?? '', vars);
  const emailSubject = fillPlaceholders(override?.email_subject ?? def.defaults.email_subject ?? '', vars);
  const emailHtml = fillPlaceholders(override?.email_html ?? def.defaults.email_html ?? '', vars);

  return { title, body, emailSubject, emailHtml };
}

// --- Admin management (used by routes/templates.js) -----------------------

export async function getAllTemplatesForAdmin() {
  const overridesRes = await pool.query('SELECT * FROM notification_templates');
  const overrides = {};
  overridesRes.rows.forEach((r) => { overrides[r.template_key] = r; });

  return Object.entries(TEMPLATE_DEFS).map(([key, def]) => {
    const o = overrides[key];
    return {
      key,
      label: def.label,
      description: def.description,
      channels: def.channels,
      placeholders: def.placeholders,
      defaults: def.defaults,
      enabled: o ? o.enabled : true,
      customized: Boolean(o),
      title: o?.title ?? def.defaults.title ?? null,
      body: o?.body ?? def.defaults.body ?? null,
      email_subject: o?.email_subject ?? def.defaults.email_subject ?? null,
      email_html: o?.email_html ?? def.defaults.email_html ?? null,
      updated_at: o?.updated_at ?? null,
    };
  });
}

export async function setTemplateOverride(key, { title, body, email_subject, email_html, enabled }, userId) {
  if (!TEMPLATE_DEFS[key]) throw new Error(`Unknown template key: ${key}`);
  await pool.query(
    `INSERT INTO notification_templates (template_key, title, body, email_subject, email_html, enabled, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (template_key) DO UPDATE SET
       title = EXCLUDED.title, body = EXCLUDED.body,
       email_subject = EXCLUDED.email_subject, email_html = EXCLUDED.email_html,
       enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [key, title ?? null, body ?? null, email_subject ?? null, email_html ?? null, enabled !== false, userId || null]
  );
}

export async function resetTemplate(key) {
  if (!TEMPLATE_DEFS[key]) throw new Error(`Unknown template key: ${key}`);
  await pool.query('DELETE FROM notification_templates WHERE template_key = $1', [key]);
}
