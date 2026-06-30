import nodemailer from 'nodemailer';
import { logger } from './logger.js';

// Email delivery. Picks a provider based on which env vars are set, in order:
//   1. Brevo HTTP API   — BREVO_API_KEY   (recommended on Render: uses HTTPS, not blocked)
//   2. Resend HTTP API  — RESEND_API_KEY
//   3. SMTP             — SMTP_HOST/PORT/USER/PASS (blocked on Render free tier)
// MAIL_FROM sets the sender, e.g.  "Galaxy Trust <no-reply@example.com>".
// If nothing is configured, sendMail() is a no-op and the caller logs the link.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

let smtpTransporter = null;
(function configureSmtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  if (host && user && pass) {
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user, pass },
      // Fail fast instead of hanging for minutes if the port is blocked.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
})();

function activeProvider() {
  if (BREVO_API_KEY) return 'brevo';
  if (RESEND_API_KEY) return 'resend';
  if (smtpTransporter) return 'smtp';
  return 'none';
}

logger.info('mailer configured', { provider: activeProvider() });

export function mailConfigured() {
  return activeProvider() !== 'none';
}

// Parse MAIL_FROM ("Name <email>" or "email") into { name, email }.
function parseFrom() {
  const raw = process.env.MAIL_FROM || process.env.SMTP_USER || '';
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || 'Galaxy Trust', email: m[2].trim() };
  return { name: 'Galaxy Trust', email: raw.trim() };
}

async function fetchWithTimeout(url, options, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function sendViaBrevo({ to, subject, text, html, from }) {
  const res = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

async function sendViaResend({ to, subject, text, html, from }) {
  const res = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: `${from.name} <${from.email}>`, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendViaSmtp({ to, subject, text, html, from }) {
  await smtpTransporter.sendMail({ from: `${from.name} <${from.email}>`, to, subject, text, html });
}

// Returns true if the message was handed off to a provider; false if no
// provider is configured. Throws if a configured provider fails.
export async function sendMail({ to, subject, text, html }) {
  const provider = activeProvider();
  if (provider === 'none') {
    logger.warn('sendMail skipped (no email provider configured)', { to, subject });
    return false;
  }
  const from = parseFrom();
  if (provider === 'brevo') await sendViaBrevo({ to, subject, text, html, from });
  else if (provider === 'resend') await sendViaResend({ to, subject, text, html, from });
  else await sendViaSmtp({ to, subject, text, html, from });
  logger.info('email sent', { provider, to });
  return true;
}
