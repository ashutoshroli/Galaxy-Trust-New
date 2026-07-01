import express from 'express';
import { authenticate, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { TEMPLATE_DEFS, getAllTemplatesForAdmin, setTemplateOverride, resetTemplate, fillPlaceholders } from '../utils/templates.js';
import { sendMail } from '../utils/mailer.js';
import { sendReminderText } from '../utils/sms.js';

const router = express.Router();
router.use(authenticate, onlySuperAdmin);

// Sample values used to preview/test a template with its placeholders filled in.
const SAMPLE_VARS = {
  name: 'Rekha Verma',
  amount: '1,500',
  subject: 'Monthly General Meeting',
  date: new Date().toISOString().slice(0, 10),
  username: 'rekha_verma',
  link: 'https://example.com/reset-password?token=sample-token',
  minutes: '30',
};

// GET /templates - list every template (defaults + any override), for the
// Notification Templates admin page.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getAllTemplatesForAdmin());
  })
);

// PUT /templates/:key - save an override (or update enabled/disabled).
router.put(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    if (!TEMPLATE_DEFS[key]) return notFound(res, 'Unknown template');
    const { title, body, email_subject, email_html, enabled } = req.body;
    await setTemplateOverride(key, { title, body, email_subject, email_html, enabled }, req.user.id);
    res.json({ message: 'Saved' });
  })
);

// POST /templates/:key/reset - discard the override, revert to the built-in default.
router.post(
  '/:key/reset',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    if (!TEMPLATE_DEFS[key]) return notFound(res, 'Unknown template');
    await resetTemplate(key);
    res.json({ message: 'Reset to default' });
  })
);

// POST /templates/:key/test - send a one-off test using sample placeholder
// values, to the superadmin's own account (email test only needs the
// account to have an email on file; in-app/SMS tests use the request body).
router.post(
  '/:key/test',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const def = TEMPLATE_DEFS[key];
    if (!def) return notFound(res, 'Unknown template');

    // Preview with either the caller's pending edits (if provided) or the
    // stored/default template — lets a superadmin test before saving.
    const draft = req.body || {};
    const vars = SAMPLE_VARS;
    const title = fillPlaceholders(draft.title, vars) || fillPlaceholders(def.defaults.title, vars) || '';
    const body = fillPlaceholders(draft.body, vars) || fillPlaceholders(def.defaults.body, vars) || '';
    const emailSubject = fillPlaceholders(draft.email_subject, vars) || fillPlaceholders(def.defaults.email_subject, vars) || '';
    const emailHtml = fillPlaceholders(draft.email_html, vars) || fillPlaceholders(def.defaults.email_html, vars) || '';

    if (def.channels.includes('email')) {
      const to = req.body.test_email || req.user.email;
      if (!to) return badRequest(res, 'No email address to send the test to. Pass test_email or set one on your account.');
      const sent = await sendMail({ to, subject: `[TEST] ${emailSubject}`, html: emailHtml, text: body || emailHtml });
      return res.json({ message: sent ? `Test email sent to ${to}` : 'Email provider not configured — check server logs for the rendered content.' });
    }

    if (def.channels.includes('whatsapp/sms')) {
      const to = req.body.test_phone;
      if (!to) return badRequest(res, 'Pass test_phone to send a WhatsApp/SMS test.');
      const channel = await sendReminderText(to, `[TEST] ${body}`);
      return res.json({ message: channel ? `Test ${channel} sent to ${to}` : 'WhatsApp/SMS not configured — nothing was sent.' });
    }

    // In-app/push only — just echo back the rendered preview.
    return res.json({ message: 'Preview rendered (this template has no external channel to test).', preview: { title, body } });
  })
);

export default router;
