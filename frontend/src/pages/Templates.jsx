import React, { useEffect, useState } from 'react';
import { apiCall } from '../api.js';
import { isSuperAdmin } from '../permissions.js';
import { useI18n } from '../i18n.js';
import { useToast } from '../components/Toast.jsx';

export default function Templates() {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [drafts, setDrafts] = useState({}); // key -> { title, body, email_subject, email_html, enabled }
  const [saving, setSaving] = useState('');
  const [testTarget, setTestTarget] = useState({}); // key -> phone/email typed into the test box

  function load() {
    apiCall('/templates')
      .then((rows) => {
        setList(rows);
        const d = {};
        rows.forEach((r) => {
          d[r.key] = { title: r.title || '', body: r.body || '', email_subject: r.email_subject || '', email_html: r.email_html || '', enabled: r.enabled };
        });
        setDrafts(d);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => { if (isSuperAdmin()) load(); }, []);

  function updateDraft(key, field, value) {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
  }

  async function save(key) {
    if (saving) return;
    setSaving(key);
    try {
      await apiCall(`/templates/${key}`, { method: 'PUT', body: JSON.stringify(drafts[key]) });
      toast.success(t('tmpl.saved'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving('');
    }
  }

  async function toggleEnabled(key, row) {
    if (saving) return;
    const nextEnabled = !drafts[key].enabled;
    setSaving(key);
    try {
      await apiCall(`/templates/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ ...drafts[key], enabled: nextEnabled }),
      });
      updateDraft(key, 'enabled', nextEnabled);
      toast.success(nextEnabled ? t('tmpl.enabled') : t('tmpl.disabled'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving('');
    }
  }

  async function resetToDefault(key) {
    if (saving || !window.confirm(t('tmpl.resetConfirm'))) return;
    setSaving(key);
    try {
      await apiCall(`/templates/${key}/reset`, { method: 'POST' });
      toast.success(t('tmpl.resetDone'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving('');
    }
  }

  async function sendTest(key, def) {
    if (saving) return;
    const isEmail = def.channels.includes('email');
    const isText = def.channels.includes('whatsapp/sms');
    const target = (testTarget[key] || '').trim();
    if (isEmail && !target) return toast.error(t('tmpl.testEmailRequired'));
    if (isText && !target) return toast.error(t('tmpl.testPhoneRequired'));

    setSaving(key);
    try {
      const body = { ...drafts[key] };
      if (isEmail) body.test_email = target;
      if (isText) body.test_phone = target;
      const r = await apiCall(`/templates/${key}/test`, { method: 'POST', body: JSON.stringify(body) });
      toast.success(r.message || t('tmpl.testSent'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving('');
    }
  }

  if (!isSuperAdmin()) return <div className="card error-text">Access denied.</div>;

  return (
    <div>
      <h2>📨 {t('tmpl.title')}</h2>
      <p className="muted">{t('tmpl.subtitle')}</p>
      {error && <div className="error-text">{error}</div>}
      {!list && <div className="card" style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      {list && list.map((row) => {
        const key = row.key;
        const draft = drafts[key] || {};
        const isOpen = openKey === key;
        const isEmail = row.channels.includes('email');
        const isText = row.channels.includes('whatsapp/sms');

        return (
          <div className="card" key={key}>
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setOpenKey(isOpen ? null : key)}>
              <div>
                <h3 style={{ margin: 0 }}>{row.label}</h3>
                <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{row.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {row.customized && <span className="badge" style={{ background: '#6d5efc', fontSize: 11 }}>{t('tmpl.customized')}</span>}
                <label className="remember-me-row" style={{ margin: 0 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!draft.enabled}
                    disabled={saving === key}
                    onChange={() => toggleEnabled(key, row)}
                  />
                  <span style={{ fontSize: 12 }}>{draft.enabled ? t('tmpl.on') : t('tmpl.off')}</span>
                </label>
                <span className="muted">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 14 }}>
                <p className="muted" style={{ fontSize: 12.5 }}>
                  {t('tmpl.placeholders')}: {row.placeholders.map((p) => `{${p}}`).join(', ')}
                </p>

                {isEmail ? (
                  <>
                    <label className="muted" style={{ fontSize: 13 }}>{t('tmpl.emailSubject')}</label>
                    <input value={draft.email_subject} onChange={(e) => updateDraft(key, 'email_subject', e.target.value)} />
                    <label className="muted" style={{ fontSize: 13 }}>{t('tmpl.emailBody')}</label>
                    <textarea
                      style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 13 }}
                      value={draft.email_html}
                      onChange={(e) => updateDraft(key, 'email_html', e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <label className="muted" style={{ fontSize: 13 }}>{t('tmpl.notifTitle')}</label>
                    <input value={draft.title} onChange={(e) => updateDraft(key, 'title', e.target.value)} />
                    <label className="muted" style={{ fontSize: 13 }}>{t('tmpl.notifBody')}</label>
                    <textarea
                      style={{ minHeight: 90 }}
                      value={draft.body}
                      onChange={(e) => updateDraft(key, 'body', e.target.value)}
                    />
                  </>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => save(key)} disabled={saving === key}>{t('common.save')}</button>
                  <button className="print-btn" onClick={() => resetToDefault(key)} disabled={saving === key}>{t('tmpl.resetToDefault')}</button>
                </div>

                {(isEmail || isText) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
                    <input
                      style={{ margin: 0, maxWidth: 240 }}
                      placeholder={isEmail ? t('tmpl.testEmailPlaceholder') : t('tmpl.testPhonePlaceholder')}
                      value={testTarget[key] || ''}
                      onChange={(e) => setTestTarget((s) => ({ ...s, [key]: e.target.value }))}
                    />
                    <button className="print-btn" onClick={() => sendTest(key, row)} disabled={saving === key}>
                      {t('tmpl.sendTest')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
