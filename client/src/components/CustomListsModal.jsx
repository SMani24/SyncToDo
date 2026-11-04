import React, { useState } from 'react';
import { normalizeListIcon } from '../syncEngine';

const EMOJI_OPTIONS = ['💼', '📁', '🌿', '🛒', '🎯', '🚀', '📚', '🎨', '⚡', '💡', '🏠', '❤️', '✈️', '💻', '🛠️', '✨'];
const COLOR_OPTIONS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#64748b'];

export default function CustomListsModal({ lists = [], onAddList, onUpdateList, onDeleteList, onClose }) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📁');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [editingListId, setEditingListId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddList(name.trim(), selectedIcon, selectedColor);
    setName('');
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim()) return;
    onUpdateList(id, { name: editName.trim() });
    setEditingListId(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        backgroundColor: 'var(--surface)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        color: 'var(--text)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📁</span>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Manage Custom Projects & Lists
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Organize specific jobs, work streams, and life areas
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* New List Form */}
          <form onSubmit={handleCreate} style={{
            padding: 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            marginBottom: '20px'
          }}>
            <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
              Create New Project / List
            </label>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="List name (e.g. Website Redesign, Fitness)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                dir="auto"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                  unicodeBidi: 'plaintext'
                }}
              />
              <button
                type="submit"
                disabled={!name.trim()}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-gradient)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: name.trim() ? 'pointer' : 'default',
                  opacity: name.trim() ? 1 : 0.5
                }}
              >
                + Add List
              </button>
            </div>

            {/* Icon & Color pickers */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              {/* Emoji Options */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', maxWidth: '300px' }}>
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedIcon(emoji)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      border: selectedIcon === emoji ? '2px solid var(--primary)' : '1px solid transparent',
                      background: selectedIcon === emoji ? 'var(--surface-elevated)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Color Options */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {COLOR_OPTIONS.map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setSelectedColor(hex)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: hex,
                      border: selectedColor === hex ? '2px solid var(--text)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transform: selectedColor === hex ? 'scale(1.2)' : 'scale(1)'
                    }}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Existing Lists */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
              Your Projects & Lists ({lists.length})
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lists.map(list => (
                <div
                  key={list.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <span style={{ fontSize: '18px' }}>{normalizeListIcon(list.icon)}</span>
                    {editingListId === list.id ? (
                      <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          dir="auto"
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--primary)',
                            backgroundColor: 'var(--bg)',
                            color: 'var(--text)',
                            fontSize: '13px',
                            unicodeBidi: 'plaintext'
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(list.id)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span dir="auto" style={{ fontSize: '13px', fontWeight: 600, unicodeBidi: 'plaintext' }}>{list.name}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: list.color }} />
                    {list.id !== 'inbox' && (
                      <>
                        <button
                          onClick={() => { setEditingListId(list.id); setEditName(list.name); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDeleteList(list.id)}
                          style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '12px' }}
                          title="Delete List"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary-gradient)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
