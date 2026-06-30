import crypto from 'crypto';

// Optional Cloudinary image hosting. Configure EITHER:
//   - CLOUDINARY_URL = cloudinary://API_KEY:API_SECRET@CLOUD_NAME   (single var, easiest)
//   - or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET
// If not configured, feed images fall back to base64 stored in the DB.

function fromUrl() {
  const url = process.env.CLOUDINARY_URL;
  if (!url) return null;
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return null;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

function config() {
  const u = fromUrl();
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || u?.cloudName || '',
    apiKey: process.env.CLOUDINARY_API_KEY || u?.apiKey || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || u?.apiSecret || '',
  };
}

export function cloudinaryConfigured() {
  const c = config();
  return !!(c.cloudName && c.apiKey && c.apiSecret);
}

// Upload a base64 data URI (or remote URL) and return the hosted secure URL.
export async function uploadImage(dataUri, folder = 'galaxy_trust_feed') {
  const { cloudName, apiKey, apiSecret } = config();

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

  const form = new URLSearchParams();
  form.append('file', dataUri);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (data.secure_url) return data.secure_url;
  throw new Error(data?.error?.message || 'Cloudinary upload failed');
}
