import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.js';

// Reusable photo picker with square crop (zoom + drag) and live preview.
// Props: value (base64 string), onChange(base64|''), size (output px, default 400), shape ('circle'|'square')
export default function PhotoPicker({ value, onChange, size = 400, shape = 'circle' }) {
  const { t } = useI18n();
  const VIEW = 260; // crop viewport size in px

  const [rawSrc, setRawSrc] = useState(null);
  const [img, setImg] = useState(null); // HTMLImageElement
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const radius = shape === 'circle' ? '50%' : '12px';

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawSrc(ev.target.result);
    reader.readAsDataURL(file);
  }

  // Load image when a new raw source is chosen
  useEffect(() => {
    if (!rawSrc) return;
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.src = rawSrc;
  }, [rawSrc]);

  // Cover scale so the image always fills the viewport
  function coverScale(image) {
    return Math.max(VIEW / image.width, VIEW / image.height);
  }

  function clampOffset(next, image, z) {
    const eff = coverScale(image) * z;
    const dispW = image.width * eff;
    const dispH = image.height * eff;
    const minX = VIEW - dispW;
    const minY = VIEW - dispH;
    return {
      x: Math.min(0, Math.max(minX, next.x)),
      y: Math.min(0, Math.max(minY, next.y)),
    };
  }

  function onPointerDown(e) {
    if (!img) return;
    const point = e.touches ? e.touches[0] : e;
    dragRef.current = { startX: point.clientX, startY: point.clientY, baseX: offset.x, baseY: offset.y };
  }
  function onPointerMove(e) {
    if (!dragRef.current || !img) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - dragRef.current.startX;
    const dy = point.clientY - dragRef.current.startY;
    setOffset(clampOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy }, img, zoom));
  }
  function onPointerUp() { dragRef.current = null; }

  function changeZoom(z) {
    if (!img) return;
    setZoom(z);
    setOffset((o) => clampOffset(o, img, z));
  }

  function apply() {
    if (!img) return;
    const eff = coverScale(img) * zoom;
    const srcX = -offset.x / eff;
    const srcY = -offset.y / eff;
    const srcSize = VIEW / eff;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
    onChange(canvas.toDataURL('image/jpeg', 0.85));
    setRawSrc(null);
    setImg(null);
  }

  const eff = img ? coverScale(img) * zoom : 1;

  return (
    <div>
      <div className="actions-row" style={{ alignItems: 'center' }}>
        {value
          ? <img src={value} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: radius }} />
          : <span className="brand-logo" style={{ width: 64, height: 64 }} aria-hidden="true" />}
        <label className="print-btn" style={{ cursor: 'pointer', margin: 0 }}>
          📷 {t('members.photo')}
          <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </label>
        {value && <button type="button" className="print-btn" onClick={() => onChange('')}>{t('common.delete')}</button>}
      </div>

      {img && (
        <div className="modal-overlay" onClick={() => { setRawSrc(null); setImg(null); }}>
          <div className="modal" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('photo.crop')}</h3>
              <button type="button" className="modal-close" onClick={() => { setRawSrc(null); setImg(null); }}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: VIEW, height: VIEW, margin: '0 auto', overflow: 'hidden',
                  borderRadius: radius, position: 'relative', touchAction: 'none',
                  border: '2px solid var(--glass-border-strong)', cursor: 'grab', background: '#000',
                }}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              >
                <img
                  src={rawSrc}
                  alt="crop"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: offset.x, top: offset.y,
                    width: img.width * eff, height: img.height * eff,
                    maxWidth: 'none', userSelect: 'none',
                  }}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted">🔍</span>
                <input
                  type="range" min="1" max="3" step="0.01" value={zoom}
                  onChange={(e) => changeZoom(parseFloat(e.target.value))}
                  style={{ flex: 1, margin: 0 }}
                />
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('photo.dragHint')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" onClick={apply}>{t('photo.apply')}</button>
                <button type="button" className="print-btn" onClick={() => { setRawSrc(null); setImg(null); }}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
