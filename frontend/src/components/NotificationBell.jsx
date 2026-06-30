import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../api.js';
import { useI18n } from '../i18n.js';
import { useToast } from './Toast.jsx';
import { enablePush, pushSupported, pushPermission } from '../utils/push.js';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationBell() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  function load() {
    apiCall('/notifications?limit=30')
      .then((d) => { setItems(d.items || []); setUnread(d.unread || 0); })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      try { await apiCall('/notifications/read', { method: 'POST', body: JSON.stringify({ id: n.id }) }); } catch (e) { /* ignore */ }
      setUnread((u) => Math.max(0, u - 1));
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) navigate(n.link);
  }

  async function markAllRead() {
    try {
      await apiCall('/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) });
      setUnread(0);
      setItems((list) => list.map((x) => ({ ...x, read: true })));
    } catch (e) { /* ignore */ }
  }

  async function turnOnPush() {
    try {
      await enablePush();
      toast.success(t('notif.pushOn'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button className="print-btn icon-btn" onClick={() => { setOpen((o) => !o); if (!open) load(); }} title={t('notif.title')} aria-label={t('notif.title')} style={{ position: 'relative' }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: 'var(--danger)', color: '#fff',
            borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="card" style={{
          position: 'absolute', right: 0, top: 46, width: 320, maxWidth: '90vw', maxHeight: 440,
          overflowY: 'auto', zIndex: 300, padding: 12, margin: 0,
        }}>
          <div className="card-header" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{t('notif.title')}</h3>
            {unread > 0 && <button className="print-btn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={markAllRead}>{t('notif.markAll')}</button>}
          </div>

          {pushSupported() && pushPermission() !== 'granted' && (
            <button className="print-btn" style={{ width: '100%', marginBottom: 8, fontSize: 13 }} onClick={turnOnPush}>
              🔔 {t('notif.enablePush')}
            </button>
          )}

          {items.length === 0 && <p className="muted" style={{ margin: '8px 0' }}>{t('notif.none')}</p>}

          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => openItem(n)}
              style={{
                padding: '8px 6px', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer',
                background: n.read ? 'transparent' : 'rgba(124,58,237,0.10)', borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
              {n.body && <div className="muted" style={{ fontSize: 12.5 }}>{n.body}</div>}
              <div className="muted" style={{ fontSize: 11 }}>{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
