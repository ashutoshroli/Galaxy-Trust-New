import nodemailer from 'nodemailer';
import { logger } from './logger.js';

// Email is optional. Configure SMTP with these env vars:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//   SMTP_SECURE=true   (optional — auto-true for port 465)
//   MAIL_FROM="Galaxy Trust <no-reply@yourdomain.com>"  (optional)
// If not configured, sendMail() is a no-op and callers should handle the
// fallback (e.g. log the password-reset link to the server log).
let transporter = null;
let mailReady = false;

(function configureMail() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user, pass },
      });
      mailReady = true;
      logger.info('SMTP mailer configured', { host, port });
    } catch (e) {
      logger.error('SMTP config failed', { message: e.message });
    }
  } else {
    logger.warn('SMTP not configured — password-reset emails will be logged, not sent');
  }
})();

export function mailConfigured() {
  return mailReady;
}

// Returns true if the mail was handed off to the SMTP server, false otherwise.
export async function sendMail({ to, subject, text, html }) {
  if (!mailReady) {
    logger.warn('sendMail skipped (SMTP not configured)', { to, subject });
    return false;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await transporter.sendMail({ from, to, subject, text, html });
  return true;
}
