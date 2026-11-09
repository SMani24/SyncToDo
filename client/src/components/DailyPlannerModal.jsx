import React, { useState } from 'react';
import { normalizeListIcon, hasPersianChar, detectBidiDirection } from '../syncEngine';
import { Icon } from './SvgIcons';
import { getLogicalDateStr, formatDayDateHeader } from '../utils/calendar';

export default function DailyPlannerModal({
  todos = [],
  lists = [],
  deviceType = 'laptop',
  calendarType = 'gregorian',
  dayStartHour = 0,
  leftoversDismissedDate = null,
  onDismissLeftovers,
  onToggleInMyDay,
  onCarryForward,
  onClose
}) {
  const today = getLogicalDateStr(new Date(), dayStartHour);
  const [selectedListFilter, setSelectedListFilter] = useState('all');

  const activeTodos = todos.filter(t => !t.deletedAt);
  const myDayTodos = activeTodos.filter(t => t.inMyDay && !t.completed && (!t.plannedDate || t.plannedDate === today));

  // Identify unfinished / overdue tasks from past days (ONLY active tasks, NEVER completed!)
  const overdueTasks = activeTodos.filter(t => {
    if (t.completed) return false;
    // If it is ALREADY planned for today in My Day, it is not an unfinished leftover!
    if (t.inMyDay && (!t.plannedDate || t.plannedDate === today)) return false;
    const isPastDue = Boolean(t.dueDate && t.dueDate < today);
    const isPastMyDay = Boolean(t.inMyDay && t.plannedDate && t.plannedDate < today);
    return isPastDue || isPastMyDay;
  });

  // Candidate backlog tasks available to add to My Day
  const candidateTasks = activeTodos.filter(t => {
    if (t.completed) return false;
    if (selectedListFilter !== 'all' && t.listId !== selectedListFilter) return false;
    return true;
  });

  const isPhone = deviceType === 'phone';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(6, 10, 20, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 210,
        padding: isPhone ? 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px' : '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--surface)',
          borderRadius: '20px',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isPhone ? 'calc(100% - 20px)' : '88vh',
          color: 'var(--text)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isPhone ? '14px 16px' : '18px 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: isPhone ? '34px' : '38px',
              height: isPhone ? '34px' : '38px',
              borderRadius: '11px',
              background: 'var(--tag-bg)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              ☀️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: isPhone ? '16px' : '17px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
                  {isPhone ? 'Plan My Day' : 'Daily Planner & Backlog Triage'}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  backgroundColor: 'var(--tag-bg)',
                  border: '1px solid var(--border)',
                  padding: '2px 8px',
                  borderRadius: '7px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  <Icon name="cal" size={12} />
                  <span>{formatDayDateHeader(new Date(), calendarType, dayStartHour)}</span>
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {isPhone ? 'Pick backlog tasks to focus on today' : 'Pick tasks from your bulk backlog & specific projects to focus on today'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Overdue / Yesterday Carry-Forward Banner */}
        {overdueTasks.length > 0 && leftoversDismissedDate !== today && (
          <div style={{
            margin: isPhone ? '12px 14px 0 14px' : '16px 20px 0 20px',
            padding: isPhone ? '12px 14px' : '14px 18px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            flexDirection: isPhone ? 'column' : 'row',
            alignItems: isPhone ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠️</span> {overdueTasks.length} Unfinished {overdueTasks.length === 1 ? 'task' : 'tasks'} from earlier
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Carry them forward directly into Today's plan so nothing falls through the cracks.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: isPhone ? 'flex-end' : 'auto' }}>
              <button
                type="button"
                onClick={() => {
                  onCarryForward();
                  if (onDismissLeftovers) onDismissLeftovers();
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f59e0b',
                  color: '#000000',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Carry Forward All
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDismissLeftovers) onDismissLeftovers();
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Filter by Project / List */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: isPhone ? '10px 14px' : '12px 20px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedListFilter('all')}
            style={{
              padding: '6px 13px',
              borderRadius: '20px',
              border: selectedListFilter === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              background: selectedListFilter === 'all' ? 'var(--tag-bg)' : 'transparent',
              color: selectedListFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: selectedListFilter === 'all' ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>📋</span>
            <span>Backlog</span>
            <span style={{ opacity: 0.75 }}>({activeTodos.filter(t => !t.completed).length})</span>
          </button>
          {lists.map(list => {
            const count = activeTodos.filter(t => !t.completed && t.listId === list.id).length;
            const isSel = selectedListFilter === list.id;
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListFilter(list.id)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '20px',
                  border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: isSel ? 'var(--tag-bg)' : 'transparent',
                  color: isSel ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>{normalizeListIcon(list.icon)}</span>
                <span dir="auto" style={{ unicodeBidi: 'plaintext' }}>{list.name}</span>
                <span style={{ opacity: 0.75 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Task Candidates List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isPhone ? '12px 14px' : '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {candidateTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              🎉 No open tasks in this view. Everything is planned or completed!
            </div>
          ) : (
            candidateTasks.map(todo => {
              const isInToday = todo.inMyDay && (!todo.plannedDate || todo.plannedDate === today);
              const listObj = lists.find(l => l.id === todo.listId);

              return (
                <div
                  key={todo.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isPhone ? '9px 12px' : '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: isInToday ? 'var(--surface-elevated)' : 'var(--bg-subtle)',
                    border: isInToday ? '1px solid var(--primary)' : '1px solid var(--border)',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        dir={detectBidiDirection(todo.title)}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          unicodeBidi: 'plaintext'
                        }}
                      >
                        {todo.title}
                      </span>
                      {listObj && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                          <span>{normalizeListIcon(listObj.icon)}</span>
                          <span dir="auto" style={{ unicodeBidi: 'plaintext' }}>{listObj.name}</span>
                        </span>
                      )}
                    </div>
                    {todo.notes && (
                      <div
                        dir={hasPersianChar(todo.notes) ? 'rtl' : 'ltr'}
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          unicodeBidi: 'plaintext',
                          textAlign: hasPersianChar(todo.notes) ? 'right' : 'left'
                        }}
                      >
                        {todo.notes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onToggleInMyDay(todo.id, !isInToday)}
                    style={{
                      padding: isPhone ? '5px 10px' : '6px 12px',
                      borderRadius: '8px',
                      border: isInToday ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: isInToday ? 'var(--primary)' : 'transparent',
                      color: isInToday ? '#ffffff' : 'var(--text)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isInToday ? '✓ Added' : '+ Add'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isPhone ? '12px 16px' : '14px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
            ☀️ {myDayTodos.length} {myDayTodos.length === 1 ? 'task' : 'tasks'} planned for Today
          </span>
          <button
            onClick={onClose}
            style={{
              padding: isPhone ? '7px 16px' : '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary-gradient)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Start My Day
          </button>
        </div>
      </div>
    </div>
  );
}
