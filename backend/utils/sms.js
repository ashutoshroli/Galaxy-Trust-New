import { logger } from './logger.js';

// SMS / WhatsApp delivery via the Twilio REST API (plain HTTPS, no SDK
// dependency — keeps this in the same lightweight style as utils/mailer.js).
//
// Configure with:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_SMS_FROM       — a Twilio phone number, e.g. +15551234567 (for SMS)
//   TWILIO_WHATSAPP_FROM  — a WhatsApp-enabled Twilio number, e.g.
//                           whatsapp:+14155238886 (Twilio's sandbox number
//                           while testing)
// If the account SID/token aren't set, sendSms()/sendWhatsApp() are no-ops
// and the caller should fall back to (or just rely on) in-app/push
// notifications.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SMS_FROM = process.env.TWILIO_SMS_FROM;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

const configured = Boolean(ACCOUNT_SID && AUTH_TOKEN);
logger.info('sms/whatsapp configured', { provider: configured ? 'twilio' : 'none' });

export function smsConfigured() {
  return configured && Boolean(SMS_FROM);
}
export function whatsappConfigured() {
  return configured && Boolean(WHATSAPP_FROM);
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

// Normalizes an Indian-style local number ("9801325939" or with punctuation)
// into E.164 (+919801325939). Numbers that already start with "+" pass
// through untouched.
export function toE164India(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return s.replace(/[^\d+]/g, '');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

async function sendViaTwilio({ to, from, body }) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Twilio ${res.status}: ${detail.slice(0, 300)}`);
  }
}

// Sends a plain SMS. Returns true if handed off to Twilio, false if SMS
// isn't configured. Throws if Twilio rejects the request.
export async function sendSms(toRaw, body) {
  if (!smsConfigured()) {
    logger.warn('sendSms skipped (Twilio SMS not configured)', { to: toRaw });
    return false;
  }
  const to = toE164India(toRaw);
  if (!to) return false;
  await sendViaTwilio({ to, from: SMS_FROM, body });
  logger.info('sms sent', { to });
  return true;
}

// Sends a WhatsApp message via Twilio's WhatsApp channel.
export async function sendWhatsApp(toRaw, body) {
  if (!whatsappConfigured()) {
    logger.warn('sendWhatsApp skipped (Twilio WhatsApp not configured)', { to: toRaw });
    return false;
  }
  const to = toE164India(toRaw);
  if (!to) return false;
  await sendViaTwilio({ to: `whatsapp:${to}`, from: WHATSAPP_FROM, body });
  logger.info('whatsapp sent', { to });
  return true;
}

// Tries WhatsApp first (usually cheaper/preferred), falling back to SMS if
// WhatsApp isn't configured. Returns the channel used, or null if neither is.
export async function sendReminderText(toRaw, body) {
  if (whatsappConfigured()) {
    try {
      await sendWhatsApp(toRaw, body);
      return 'whatsapp';
    } catch (err) {
      logger.error('whatsapp send failed, trying sms', { message: err.message });
    }
  }
  if (smsConfigured()) {
    try {
      await sendSms(toRaw, body);
      return 'sms';
    } catch (err) {
      logger.error('sms send failed', { message: err.message });
    }
  }
  return null;
}
