import { apiCall } from '../api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Ask permission + subscribe this device for web push. Returns true on success.
export async function enablePush() {
  if (!pushSupported()) throw new Error('Push not supported on this browser.');

  const { key } = await apiCall('/notifications/vapid-key');
  if (!key) throw new Error('Push is not configured on the server.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await apiCall('/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
  return true;
}

export function pushPermission() {
  return (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
}
