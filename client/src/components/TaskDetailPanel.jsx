import React, { useState, useEffect } from 'react';
import { Icon } from './SvgIcons';
import { normalizeListIcon, hasPersianChar, detectBidiDirection } from '../syncEngine';
import { formatCalendarDate } from '../utils/calendar';
import CalendarPickerModal from './CalendarPickerModal';

export default function TaskDetailPanel({
  calendarType = 'gregorian',
  todo,
  lists = [],
  deviceType = 'laptop',
  panelWidth = 350,
  isOverlay = false,
  todayStr,
  syncEngine,
  currentPinContext = 'today',
  isPinnedInCurrentContext = false,
  onTogglePin = null,
  onOpenCanvas,
  onDeleteTodo,
  onClose
}) {
  const [titleText, setTitleText] = useState(todo?.title || '');
  const [notesText, setNotesText] = useState(todo?.notes || '');
  const [newStepText, setNewStepText] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  useEffect(() => {
    setTitleText(todo?.title || '');
    setNotesText(todo?.notes || '');
    setNewStepText('');
  }, [todo?.id, todo?.title, todo?.notes]);

  if (!todo) return null;

  const isInlineNote = todo.isInlineHandwriting || (todo.handwriting && (!todo.title || todo.title === 'Handwritten task' || todo.title.trim() === ''));
  const steps = Array.isArray(todo.steps) ? todo.steps : [];
  const doneStepsCount = steps.filter(s => s.completed).length;

  const commitTitle = () => {
    const trimmed = titleText.trim();
    if (trimmed && trimmed !== todo.title) {
      syncEngine.updateTodo(todo.id, { title: trimmed });
    } else if (!trimmed) {
      setTitleText(todo.title);
    }
  };

  const commitNotes = () => {
    if (notesText !== (todo.notes || '')) {
      syncEngine.updateTodo(todo.id, { notes: notesText });
    }
  };

  const handleAddStep = (e) => {
    e.preventDefault();
    if (!newStepText.trim()) return;
    syncEngine.addStep(todo.id, newStepText.trim());
    setNewStepText('');
  };

  const setQuickDate = (offsetDays) => {
    if (offsetDays === null) {
      syncEngine.updateTodo(todo.id, { dueDate: null });
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    syncEngine.updateTodo(todo.id, { dueDate: iso });
  };

  const panelContent = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: deviceType === 'phone' ? '100%' : isOverlay ? `min(${panelWidth}px, 92vw)` : `${panelWidth}px`,
        maxWidth: '100%',
        maxHeight: deviceType === 'phone' ? '86vh' : '100%',
        height: deviceType === 'phone' ? 'auto' : '100%',
        backgroundColor: 'var(--surface)',
        borderLeft: deviceType === 'phone' ? 'none' : '1px solid var(--border)',
        borderTop: deviceType === 'phone' ? '1px solid var(--border)' : 'none',
        borderRadius: deviceType === 'phone' ? '22px 22px 0 0' : '0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: deviceType === 'phone'
          ? '0 -12px 40px rgba(0,0,0,0.45)'
          : isOverlay
          ? '-12px 0 36px rgba(0,0,0,0.45)'
          : 'none'
      }}
    >
      {/* Top Bar */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-subtle)'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
          Task Details
        </span>
        <button
          onClick={onClose}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Close details (Esc)"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {/* Title & Completion Box */}
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <button
            onClick={() => syncEngine.toggleTodo(todo.id)}
            style={{
              width: '22px',
              height: '22px',
              minWidth: '22px',
              borderRadius: '50%',
              border: todo.completed ? 'none' : '2px solid var(--text-muted)',
              background: todo.completed ? '#10b981' : 'transparent',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '3px'
            }}
          >
            {todo.completed && <Icon name="check" size={13} />}
          </button>

          {isInlineNote && todo.handwriting ? (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                onClick={() => onOpenCanvas(todo.id, todo.handwriting)}
                title="Tap to edit handwriting"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '38px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--tag-bg)'
                }}
              >
                <img
                  src={todo.handwriting}
                  alt="Handwritten note"
                  style={{
                    maxHeight: '44px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    filter: document.body.getAttribute('data-theme')?.match(/minimal|editorial|matcha|sakura/) ? 'none' : 'invert(1) brightness(1.25)'
                  }}
                />
              </div>
              <input
                type="text"
                placeholder="Optional text title / transcription..."
                value={titleText === 'Handwritten task' ? '' : titleText}
                onChange={(e) => setTitleText(e.target.value)}
                onBlur={commitTitle}
                dir={detectBidiDirection(titleText)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  outline: 'none',
                  padding: '2px 0'
                }}
              />
            </div>
          ) : (
            <input
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              onBlur={commitTitle}
              dir={detectBidiDirection(titleText)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: todo.completed ? 'var(--text-muted)' : 'var(--text)',
                textDecoration: todo.completed ? 'line-through' : 'none',
                fontSize: '16px',
                fontWeight: 700,
                outline: 'none',
                lineHeight: 1.35,
                textAlign: detectBidiDirection(titleText) === 'rtl' ? 'right' : 'left'
              }}
            />
          )}
        </div>

        {/* Quick Toggles: My Day & Pin to Top */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              const nextInMyDay = !todo.inMyDay;
              syncEngine.updateTodo(todo.id, {
                inMyDay: nextInMyDay,
                plannedDate: nextInMyDay ? todayStr : null
              });
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: todo.inMyDay ? '1px solid rgba(251, 191, 36, 0.45)' : '1px solid var(--border)',
              background: todo.inMyDay ? 'rgba(251, 191, 36, 0.12)' : 'var(--bg-subtle)',
              color: todo.inMyDay ? '#fbbf24' : 'var(--text)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Icon name="sun" size={15} />
              <span>{todo.inMyDay ? 'In My Day' : 'Add to My Day'}</span>
            </span>
            {todo.inMyDay && <span style={{ fontSize: '10.5px', opacity: 0.85 }}>✓</span>}
          </button>

          {(() => {
            const isPinned = onTogglePin
              ? isPinnedInCurrentContext
              : (Array.isArray(todo.pinnedIn) ? todo.pinnedIn.includes(currentPinContext) : Boolean(todo.pinned));
            const pinLabel = currentPinContext === 'today'
              ? (isPinned ? 'Pinned in My Day' : 'Pin in My Day')
              : (isPinned ? 'Pinned to Top' : 'Pin to Top');

            return (
              <button
                type="button"
                onClick={() => {
                  if (onTogglePin) {
                    onTogglePin();
                  } else {
                    syncEngine.togglePinTodo(todo.id, currentPinContext);
                  }
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: isPinned ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border)',
                  background: isPinned ? 'rgba(245, 158, 11, 0.14)' : 'var(--bg-subtle)',
                  color: isPinned ? '#f59e0b' : 'var(--text)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Icon name={isPinned ? 'pinFilled' : 'pin'} size={15} />
                  <span>{pinLabel}</span>
                </span>
                {isPinned && <span style={{ fontSize: '10.5px', opacity: 0.85 }}>✓</span>}
              </button>
            );
          })()}
        </div>

        {/* SUBTASKS / STEPS */}
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Subtasks / Steps
            </span>
            {steps.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>
                {doneStepsCount}/{steps.length} done
              </span>
            )}
          </div>

          {steps.map((step) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)'
              }}
            >
              <button
                type="button"
                onClick={() => syncEngine.toggleStep(todo.id, step.id)}
                style={{
                  width: '17px',
                  height: '17px',
                  minWidth: '17px',
                  borderRadius: '5px',
                  border: step.completed ? 'none' : '1.5px solid var(--text-muted)',
                  background: step.completed ? '#10b981' : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {step.completed && <Icon name="check" size={11} />}
              </button>
              <span
                dir={detectBidiDirection(step.title)}
                style={{
                  flex: 1,
                  fontSize: '12.5px',
                  color: step.completed ? 'var(--text-muted)' : 'var(--text)',
                  textDecoration: step.completed ? 'line-through' : 'none',
                  wordBreak: 'break-word',
                  unicodeBidi: 'plaintext',
                  textAlign: detectBidiDirection(step.title) === 'rtl' ? 'right' : 'left'
                }}
              >
                {step.title}
              </span>
              <button
                type="button"
                onClick={() => syncEngine.deleteStep(todo.id, step.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
                title="Remove step"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}

          <form onSubmit={handleAddStep} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <input
              type="text"
              placeholder="+ Add a step..."
              value={newStepText}
              onChange={(e) => setNewStepText(e.target.value)}
              dir="auto"
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '15px',
                outline: 'none',
                textAlign: 'start'
              }}
            />
            {newStepText.trim() && (
              <button
                type="submit"
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Add
              </button>
            )}
          </form>
        </div>

        {/* LIST & PRIORITY GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              List
            </label>
            <select
              value={todo.listId || 'inbox'}
              onChange={(e) => syncEngine.updateTodo(todo.id, { listId: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                color: 'var(--text)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {normalizeListIcon(l.icon)} {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Priority
            </label>
            <select
              value={todo.priority || 'medium'}
              onChange={(e) => syncEngine.updateTodo(todo.id, { priority: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                color: 'var(--text)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High Priority</option>
            </select>
          </div>
        </div>

        {/* DUE DATE & REMINDER TIME */}
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Due Date & Reminder
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                style={{
                  padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--border)',
                  background: todo.dueDate === todayStr ? 'var(--tag-bg)' : 'var(--surface)',
                  color: todo.dueDate === todayStr ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '10.5px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                style={{
                  padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-muted)',
                  fontSize: '10.5px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Tomorrow
              </button>
              {todo.dueDate && (
                <button
                  type="button"
                  onClick={() => setQuickDate(null)}
                  style={{
                    padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text-muted)',
                    fontSize: '10.5px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Date ({calendarType === 'shamsi' ? 'شمسی' : (calendarType === 'islamic' ? 'قمری' : 'Gregorian')})
              </label>
              <button
                type="button"
                onClick={() => setShowCalendarModal(true)}
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: todo.dueDate ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: todo.dueDate ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  gap: '6px'
                }}
              >
                <span
                  dir={calendarType === 'gregorian' ? 'ltr' : 'rtl'}
                  style={{
                    unicodeBidi: 'isolate',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: todo.dueDate ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                >
                  {todo.dueDate
                    ? formatCalendarDate(todo.dueDate, calendarType)
                    : (calendarType === 'shamsi' ? 'انتخاب تاریخ...' : (calendarType === 'islamic' ? 'اختر التاريخ...' : 'Select date...'))}
                </span>
                <span style={{ fontSize: '12px', opacity: 0.8, flexShrink: 0 }}>📅</span>
              </button>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Reminder Time
              </label>
              <input
                type="time"
                value={todo.reminderTime || ''}
                onChange={(e) => syncEngine.updateTodo(todo.id, { reminderTime: e.target.value || null })}
                style={{
                  width: '100%', padding: '7px 8px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: '12px'
                }}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              Repeat Schedule
            </label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                value={todo.recurrence || 'none'}
                onChange={(e) => syncEngine.updateTodo(todo.id, { recurrence: e.target.value })}
                style={{
                  flex: 1, padding: '7px 8px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: '12px', fontWeight: 600
                }}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays (Mon–Fri)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom interval (days)</option>
              </select>

              {todo.recurrence === 'custom' && (
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={todo.recurrenceInterval || 1}
                  onChange={(e) => syncEngine.updateTodo(todo.id, { recurrenceInterval: parseInt(e.target.value, 10) || 1 })}
                  style={{
                    width: '56px', padding: '7px 8px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: '12px'
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* TEXT NOTES */}
        <div>
          <label style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
            Notes
          </label>
          <textarea
            rows={4}
            placeholder="Add notes, links, or details..."
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={commitNotes}
            dir={hasPersianChar(notesText) ? 'rtl' : 'ltr'}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text)',
              fontSize: '15px',
              lineHeight: 1.45,
              resize: 'vertical',
              outline: 'none',
              textAlign: hasPersianChar(notesText) ? 'right' : 'left'
            }}
          />
        </div>

        {/* STYLUS HANDWRITING / SKETCH */}
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Stylus / S-Pen Sketch
            </span>
            <button
              type="button"
              onClick={() => onOpenCanvas(todo.id, todo.handwriting)}
              style={{
                background: 'none', border: 'none', color: 'var(--primary)',
                fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Icon name="pen" size={13} />
              <span>{todo.handwriting ? 'Edit Sketch' : 'Add Sketch'}</span>
            </button>
          </div>

          {todo.handwriting && !isInlineNote && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <img
                src={todo.handwriting}
                alt="Handwritten note"
                onClick={() => onOpenCanvas(todo.id, todo.handwriting)}
                style={{
                  width: '100%',
                  maxHeight: '140px',
                  objectFit: 'contain',
                  background: 'transparent',
                  filter: document.body.getAttribute('data-theme')?.match(/minimal|editorial|matcha|sakura/) ? 'none' : 'invert(1) brightness(1.25)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              />
              <button
                type="button"
                onClick={() => syncEngine.updateTodo(todo.id, { handwriting: null })}
                style={{
                  alignSelf: 'flex-end',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Remove Sketch
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer with Delete */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {todo.updatedAt ? `Updated ${new Date(todo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        <button
          type="button"
          onClick={() => onDeleteTodo(todo)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Icon name="trash" size={13} />
          <span>Delete Task</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {deviceType === 'phone' ? (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: 180,
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          {panelContent}
        </div>
      ) : isOverlay ? (
        <div
          onClick={onClose}
          data-detail-drawer-backdrop="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.42)',
            backdropFilter: 'blur(2px)',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          {panelContent}
        </div>
      ) : (
        panelContent
      )}

      {showCalendarModal && (
        <CalendarPickerModal
          isOpen={showCalendarModal}
          value={todo.dueDate}
          calendarType={calendarType}
          deviceType={deviceType}
          onSelect={(newDate) => syncEngine.updateTodo(todo.id, { dueDate: newDate })}
          onClose={() => setShowCalendarModal(false)}
        />
      )}
    </>
  );
}
