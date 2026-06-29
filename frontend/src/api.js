const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function getToken() {
  return localStorage.getItem('galaxy_token');
}

export function setToken(token) {
  localStorage.setItem('galaxy_token', token);
}

export function clearToken() {
  localStorage.removeItem('galaxy_token');
  localStorage.removeItem('galaxy_user');
}

export function getUser() {
  const u = localStorage.getItem('galaxy_user');
  return u ? JSON.parse(u) : null;
}

export function setUser(user) {
  localStorage.setItem('galaxy_user', JSON.stringify(user));
}

export async function apiCall(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// Notify the backend (best-effort, for the audit log) then clear local session.
export async function logout() {
  try {
    await apiCall('/auth/logout', { method: 'POST' });
  } catch (e) {
    // ignore network/server errors — we clear the local session regardless
  }
  clearToken();
}
