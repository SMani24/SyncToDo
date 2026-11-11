import React, { useState, useEffect } from 'react';
import { normalizeListIcon } from '../syncEngine';

const POPULAR_ICONS = [
  '📁', '📋', '📝', '📚', '💼', '🎯', '⭐', '🚀',
  '💡', '🏷️', '📌', '🏆', '🎨', '🛒', '🏠', '🔧',
  '💻', '📈', '🎓', '☕', '❤️', '🔥', '✈️', '🏋️',
  '🤖', '🧮', '⚡', '🎬'
];

const PRESET_COLORS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Coral', hex: '#f97316' },
  { name: 'Rose', hex: '#ec4899' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Slate', hex: '#64748b' }
];

export default function EditListModal({
  isOpen,
  list,
  onClose,
  onSave,
  onDelete
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (list) {
      setName(list.name || '');
      setIcon(normalizeListIcon(list.icon) || '📁');
      setColor(list.color || '#6366f1');
    }
  }, [list, isOpen]);

  if (!isOpen || !list) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      icon: normalizeListIcon(icon) || '📁',
      color
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          padding: '24px',
          color: 'var(--text, #f1f5f9)',
          animation: 'fadeIn 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '24px',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: `${color}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1.5px solid ${color}`
              }}
            >
              {icon}
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Edit List</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* List Name Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '6px' }}>
              LIST NAME
            </label>
            <input
              type="text"
              autoFocus
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work, Shopping, Project X..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg, #0f172a)',
                border: '1.5px solid var(--border, #334155)',
                color: 'var(--text, #f1f5f9)',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
                unicodeBidi: 'plaintext'
              }}
            />
          </div>

          {/* List Icon Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>
              CHOOSE ICON
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '6px',
              backgroundColor: 'var(--bg, #0f172a)',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border, #334155)',
              maxHeight: '130px',
              overflowY: 'auto'
            }}>
              {(icon && !POPULAR_ICONS.includes(icon) ? [icon, ...POPULAR_ICONS] : POPULAR_ICONS).map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  style={{
                    fontSize: '18px',
                    padding: '6px 0',
                    background: icon === emoji ? `${color}35` : 'transparent',
                    border: icon === emoji ? `1.5px solid ${color}` : '1px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* List Color Swatches */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>
              THEME COLOR
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: c.hex,
                    border: color === c.hex ? '3px solid #ffffff' : '2px solid transparent',
                    boxShadow: color === c.hex ? `0 0 10px ${c.hex}` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            {onDelete && list.id !== 'inbox' ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(list.id);
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete List
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted, #94a3b8)',
                  border: '1px solid var(--border, #334155)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  backgroundColor: color,
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: name.trim() ? 'pointer' : 'not-allowed',
                  opacity: name.trim() ? 1 : 0.5,
                  boxShadow: `0 4px 12px ${color}50`
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
