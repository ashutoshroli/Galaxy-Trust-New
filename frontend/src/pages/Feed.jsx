import React, { useEffect, useState } from 'react';
import { apiCall, getUser } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useI18n } from '../i18n.js';

const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🙏'];
const MAX_EDITS = 5;
const MAX_IMAGES = 10;

function resizeImage(file, maxW = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeAgo(dateStr, t) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return t('feed.justNow') || 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('en-IN');
}

function ImageGrid({ images, onOpen }) {
  if (!images || images.length === 0) return null;
  const cols = images.length === 1 ? '1fr' : '1fr 1fr';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, marginBottom: 8 }}>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`img${i}`}
          className="clickable-img"
          onClick={() => onOpen?.(i)}
          style={{ width: '100%', height: images.length === 1 ? 'auto' : 190, objectFit: 'cover', borderRadius: 10, display: 'block' }}
        />
      ))}
    </div>
  );
}

// Full-size image popup with prev/next + keyboard support
function Lightbox({ images, index, onClose, onNav }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNav(-1);
      else if (e.key === 'ArrowRight') onNav(1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNav]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="print-btn lightbox-close" onClick={onClose} aria-label="Close">✕</button>
      {images.length > 1 && (
        <button className="print-btn lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); onNav(-1); }} aria-label="Previous">‹</button>
      )}
      <img className="lightbox-img" src={images[index]} alt="full" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <button className="print-btn lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); onNav(1); }} aria-label="Next">›</button>
      )}
      {images.length > 1 && <div className="lightbox-count">{index + 1} / {images.length}</div>}
    </div>
  );
}

function EditableImages({ images, onRemove }) {
  if (images.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 10 }}>
      {images.map((src, i) => (
        <div key={i} style={{ position: 'relative' }}>
          <img src={src} alt={`p${i}`} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
          <button type="button" className="print-btn" onClick={() => onRemove(i)} style={{ position: 'absolute', top: 4, right: 4, padding: '2px 7px', fontSize: 12 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function TagPicker({ members, staff, selected, onToggle, t }) {
  const [q, setQ] = useState('');
  const query = q.toLowerCase();
  const fm = members.filter((m) => !query || m.name?.toLowerCase().includes(query));
  const fs = staff.filter((s) => !query || s.name?.toLowerCase().includes(query));
  const isSel = (type, id) => !!selected.find((tg) => tg.type === type && tg.id === id);

  return (
    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--text-soft)', marginBottom: 8 }}>
        🏷️ {t('feed.tag')} {selected.length > 0 && `(${selected.length})`}
      </summary>

      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {selected.map((tg) => (
            <span key={`${tg.type}-${tg.id}`} className="badge" style={{ background: 'var(--grad-primary)' }}>
              {tg.type === 'staff' ? '👨‍🔧 ' : ''}{tg.name}{' '}
              <span style={{ cursor: 'pointer' }} onClick={() => onToggle(tg.type, tg.id, tg.name)}>✕</span>
            </span>
          ))}
        </div>
      )}

      <input placeholder={t('feed.searchName')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 8 }}>
        {fm.map((m) => (
          <label key={`m${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
            <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={isSel('member', m.id)} onChange={() => onToggle('member', m.id, m.name)} />
            {m.name} <span className="muted">({t(`role.${m.role}`)})</span>
          </label>
        ))}
        {fs.map((s) => (
          <label key={`s${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
            <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={isSel('staff', s.id)} onChange={() => onToggle('staff', s.id, s.name)} />
            👨‍🔧 {s.name} <span className="muted">({t('feed.staffTag')})</span>
          </label>
        ))}
        {fm.length === 0 && fs.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('common.noRecords')}</p>}
      </div>
    </details>
  );
}

export default function Feed() {
  const toast = useToast();
  const { t } = useI18n();
  const user = getUser();
  const isSuper = user?.role === 'superadmin';

  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [posting, setPosting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editImages, setEditImages] = useState([]);
  const [editTags, setEditTags] = useState([]);

  const [commentText, setCommentText] = useState({});
  const [lightbox, setLightbox] = useState(null); // { images, index }
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 10;

  function navLightbox(delta) {
    setLightbox((lb) => (lb ? { ...lb, index: (lb.index + delta + lb.images.length) % lb.images.length } : lb));
  }

  function load() {
    setLoading(true);
    apiCall(`/feed?limit=${LIMIT}&offset=0`)
      .then((data) => {
        setPosts(data.posts || []);
        setHasMore(!!data.hasMore);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    apiCall('/members').then(setMembers).catch(() => {});
    apiCall('/staff').then(setStaff).catch(() => {});
  }
  useEffect(load, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await apiCall(`/feed?limit=${LIMIT}&offset=${posts.length}`);
      setPosts((prev) => [...prev, ...(data.posts || [])]);
      setHasMore(!!data.hasMore);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function addImages(e, list, setList) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - list.length;
    if (room <= 0) return toast.error(t('feed.maxImages', { max: MAX_IMAGES }));
    const slice = files.slice(0, room);
    if (files.length > room) toast.info(t('feed.maxImages', { max: MAX_IMAGES }));
    try {
      const out = [];
      for (const f of slice) {
        if (!f.type.startsWith('image/')) continue;
        out.push(await resizeImage(f));
      }
      setList([...list, ...out]);
    } catch {
      toast.error(t('feed.imageError'));
    }
  }

  function toggleTag(list, setList, type, id, name) {
    const exists = list.find((tg) => tg.type === type && tg.id === id);
    if (exists) setList(list.filter((tg) => !(tg.type === type && tg.id === id)));
    else setList([...list, { type, id, name }]);
  }

  async function submitPost(e) {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return toast.error(t('feed.textOrPhoto'));
    setPosting(true);
    try {
      await apiCall('/feed', {
        method: 'POST',
        body: JSON.stringify({ content, images, location, tags: selectedTags.map((tg) => ({ type: tg.type, id: tg.id })) }),
      });
      setContent(''); setLocation(''); setImages([]); setSelectedTags([]);
      toast.success(t('feed.posted'));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditContent(p.content || '');
    setEditLocation(p.location || '');
    setEditImages(p.images || []);
    setEditTags(p.tags.map((tg) => ({ type: tg.type, id: tg.id, name: tg.name })));
  }

  async function saveEdit() {
    if (!editContent.trim() && editImages.length === 0) return toast.error(t('feed.textOrPhoto'));
    try {
      await apiCall(`/feed/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent, images: editImages, location: editLocation, tags: editTags.map((tg) => ({ type: tg.type, id: tg.id })) }),
      });
      setEditingId(null);
      toast.success(t('feed.postUpdated'));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function react(post, emoji) {
    try {
      await apiCall(`/feed/${post.id}/react`, { method: 'POST', body: JSON.stringify({ reaction: emoji }) });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function addComment(postId) {
    const text = (commentText[postId] || '').trim();
    if (!text) return;
    try {
      await apiCall(`/feed/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: text }) });
      setCommentText({ ...commentText, [postId]: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deletePost(id) {
    if (!window.confirm(t('feed.confirmDeletePost'))) return;
    try {
      await apiCall(`/feed/${id}`, { method: 'DELETE' });
      toast.success(t('feed.postDeleted'));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteComment(id) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await apiCall(`/feed/comments/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const isAuthor = (p) => user && p.author_user_id === user.id;
  const canEditPost = (p) => isSuper || (isAuthor(p) && (p.edit_count || 0) < MAX_EDITS);
  const canDeletePost = () => isSuper;
  const canManageComment = (c) => user && (c.user_id === user.id || isSuper);

  return (
    <div>
      <h2>{t('feed.title')} 📣</h2>
      {error && <div className="error-text">{error}</div>}

      {/* Composer */}
      <form className="card" onSubmit={submitPost}>
        <textarea placeholder={t('feed.composerPlaceholder', { name: user?.username || '' })} value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 70 }} />

        <EditableImages images={images} onRemove={(i) => setImages(images.filter((_, idx) => idx !== i))} />

        <div className="actions-row" style={{ flexWrap: 'wrap' }}>
          <label className="print-btn" style={{ cursor: 'pointer', margin: 0 }}>
            📷 {t('feed.photos')} ({images.length}/{MAX_IMAGES})
            <input type="file" accept="image/*" multiple onChange={(e) => addImages(e, images, setImages)} style={{ display: 'none' }} />
          </label>
          <input placeholder={t('feed.locationPlaceholder')} value={location} onChange={(e) => setLocation(e.target.value)} style={{ maxWidth: 220, margin: 0 }} />
        </div>

        <TagPicker members={members} staff={staff} selected={selectedTags} onToggle={(tp, i, n) => toggleTag(selectedTags, setSelectedTags, tp, i, n)} t={t} />

        <button type="submit" disabled={posting}>{posting ? t('feed.posting') : t('feed.post')}</button>
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" />
          <p className="muted" style={{ marginTop: 12 }}>{t('feed.loading')}</p>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>{t('feed.noPosts')}</p></div>
      )}

      {posts.map((p) => {
        const totalReactions = Object.values(p.reactions).reduce((s, n) => s + n, 0);
        const editsLeft = MAX_EDITS - (p.edit_count || 0);
        return (
          <div key={p.id} className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="brand-logo" style={{ width: 38, height: 38 }} aria-hidden="true" />
                <div>
                  <strong>{p.author_name || ''}</strong>{' '}
                  {p.author_role && <span className={`badge ${p.author_role}`}>{t(`role.${p.author_role}`)}</span>}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {timeAgo(p.created_at, t)}{p.location ? ` · 📍 ${p.location}` : ''}{p.edit_count > 0 ? ` · ${t('feed.edited')}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {canEditPost(p) && editingId !== p.id && (
                  <button className="print-btn" onClick={() => startEdit(p)}>✏️ {t('common.edit')}</button>
                )}
                {canDeletePost() && <button className="print-btn" onClick={() => deletePost(p.id)}>🗑</button>}
              </div>
            </div>

            {editingId === p.id ? (
              <div className="card" style={{ background: 'var(--subcard-bg)', marginTop: 10 }}>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ minHeight: 60 }} />
                <EditableImages images={editImages} onRemove={(i) => setEditImages(editImages.filter((_, idx) => idx !== i))} />
                <div className="actions-row" style={{ flexWrap: 'wrap' }}>
                  <label className="print-btn" style={{ cursor: 'pointer', margin: 0 }}>
                    📷 {t('feed.changePhotos')} ({editImages.length}/{MAX_IMAGES})
                    <input type="file" accept="image/*" multiple onChange={(e) => addImages(e, editImages, setEditImages)} style={{ display: 'none' }} />
                  </label>
                  <input placeholder={t('feed.locationPlaceholder')} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} style={{ maxWidth: 220, margin: 0 }} />
                </div>
                <TagPicker members={members} staff={staff} selected={editTags} onToggle={(tp, i, n) => toggleTag(editTags, setEditTags, tp, i, n)} t={t} />
                {isAuthor(p) && !isSuper && (
                  <p className="muted">{t('feed.editsLeft', { n: editsLeft, max: MAX_EDITS })}</p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit}>{t('common.save')}</button>
                  <button className="print-btn" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <>
                {p.content && <p style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{p.content}</p>}

                {p.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {p.tags.map((tg, i) => (
                      <span key={i} className="badge" style={{ background: 'rgba(124,58,237,0.25)' }}>
                        {tg.type === 'staff' ? '👨‍🔧 ' : '🧑‍🚀 '}{tg.name || `#${tg.id}`}
                      </span>
                    ))}
                  </div>
                )}

                <ImageGrid images={p.images} onOpen={(i) => setLightbox({ images: p.images, index: i })} />
              </>
            )}

            {totalReactions > 0 && (
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                {Object.entries(p.reactions).map(([emoji, count]) => `${emoji} ${count}`).join('   ')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--glass-border)', paddingTop: 10 }}>
              {REACTIONS.map((emoji) => (
                <button key={emoji} className={p.my_reaction === emoji ? '' : 'print-btn'} onClick={() => react(p, emoji)} style={{ fontSize: 16, padding: '6px 10px' }}>
                  {emoji}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              {p.comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 14 }}>
                    <strong>{c.author_name || ''}</strong>{' '}
                    {c.author_role && <span className={`badge ${c.author_role}`} style={{ fontSize: 10 }}>{t(`role.${c.author_role}`)}</span>}
                    <span className="muted" style={{ fontSize: 11 }}> · {timeAgo(c.created_at, t)}</span>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                  </div>
                  {canManageComment(c) && (
                    <span style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => deleteComment(c.id)}>✕</span>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  placeholder={t('feed.commentPlaceholder')}
                  style={{ margin: 0 }}
                  value={commentText[p.id] || ''}
                  onChange={(e) => setCommentText({ ...commentText, [p.id]: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(p.id); } }}
                />
                <button onClick={() => addComment(p.id)}>{t('common.send')}</button>
              </div>
            </div>
          </div>
        );
      })}

      {!loading && hasMore && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="print-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t('common.loading') : t('common.loadMore')}
          </button>
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNav={navLightbox}
        />
      )}
    </div>
  );
}
