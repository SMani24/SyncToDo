import React, { useState } from 'react';
import { normalizeListIcon, hasPersianChar, detectBidiDirection } from '../syncEngine';

export default function DailyPlannerModal({
  todos = [],
  lists = [],
  onToggleInMyDay,
  onCarryForward,
  onClose
}) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedListFilter, setSelectedListFilter] = useState('all');

  const activeTodos = todos.filter(t => !t.deletedAt);
  const myDayTodos = activeTodos.filter(t => t.inMyDay && !t.completed);

  // Identify unfinished / overdue tasks from past days
  const overdueTasks = activeTodos.filter(t => {
    if (t.completed) return false;
    const isPastDue = t.dueDate && t.dueDate < today;
    const isPastMyDay = t.inMyDay && t.plannedDate && t.plannedDate < today;
    return isPastDue || isPastMyDay;
  });

  // Candidate backlog tasks available to add to My Day
  const candidateTasks = activeTodos.filter(t => {
    if (t.completed) return false;
    if (selectedListFilter !== 'all' && t.listId !== selectedListFilter) return false;
    return true;
  });

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
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '640px',
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
            <span style={{ fontSize: '22px' }}>☀️</span>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Daily Planner & Backlog Triage
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Pick tasks from your bulk backlog & specific projects to focus on today
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

        {/* Overdue / Yesterday Carry-Forward Banner */}
        {overdueTasks.length > 0 && (
          <div style={{
            margin: '16px 20px 0 20px',
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠️</span> {overdueTasks.length} Unfinished {overdueTasks.length === 1 ? 'task' : 'tasks'} from yesterday
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Carry them forward directly into Today's plan so nothing falls through the cracks.
              </div>
            </div>
            <button
              onClick={() => onCarryForward()}
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
          </div>
        )}

        {/* Filter by Project / List */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '14px 20px 8px 20px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border)'
        }}>
          <button
            onClick={() => setSelectedListFilter('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: selectedListFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: selectedListFilter === 'all' ? 'var(--tag-bg)' : 'transparent',
              color: selectedListFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            📋 Bulk Backlog ({activeTodos.filter(t => !t.completed).length})
          </button>
          {lists.map(list => {
            const count = activeTodos.filter(t => !t.completed && t.listId === list.id).length;
            const isSel = selectedListFilter === list.id;
            return (
              <button
                key={list.id}
                onClick={() => setSelectedListFilter(list.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: isSel ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: isSel ? 'var(--tag-bg)' : 'transparent',
                  color: isSel ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{normalizeListIcon(list.icon)}</span>
                <span>{list.name}</span>
                <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Task List */}
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {candidateTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              🎉 No open tasks in this view. Everything is planned or completed!
            </div>
          ) : (
            candidateTasks.map(todo => {
              const isInToday = todo.inMyDay;
              const listObj = lists.find(l => l.id === todo.listId);

              return (
                <div
                  key={todo.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
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
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: isInToday ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: isInToday ? 'var(--primary)' : 'transparent',
                      color: isInToday ? '#ffffff' : 'var(--text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isInToday ? '✓ In Today' : '+ Add to Today'}
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
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
            ☀️ {myDayTodos.length} {myDayTodos.length === 1 ? 'task' : 'tasks'} planned for Today
          </span>
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
            Start My Day
          </button>
        </div>
      </div>
    </div>
  );
}
