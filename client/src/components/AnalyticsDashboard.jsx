import React from 'react';
import { normalizeListIcon } from '../syncEngine';

export default function AnalyticsDashboard({ todos = [], lists = [], onClose }) {
  const activeTodos = todos.filter(t => !t.deletedAt);
  const completedTodos = activeTodos.filter(t => t.completed);
  const totalCount = activeTodos.length;
  const completedCount = completedTodos.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Calculate 7-Day Completion Trend
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });

    // Count tasks completed on this day
    const count = completedTodos.filter(t => {
      if (!t.completedAt) return false;
      const compDate = new Date(t.completedAt).toISOString().split('T')[0];
      return compDate === dateStr;
    }).length;

    last7Days.push({ dateStr, dayName, count });
  }

  const maxDailyCount = Math.max(1, ...last7Days.map(d => d.count));

  // Calculate Streak
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const hasCompletion = completedTodos.some(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt).toISOString().split('T')[0] === dateStr;
    });
    if (hasCompletion) streak++;
    else if (i > 0) break; // Break streak if yesterday had none (allow today to be in progress)
  }

  // Priority distribution
  const highCount = activeTodos.filter(t => t.priority === 'high').length;
  const mediumCount = activeTodos.filter(t => t.priority === 'medium').length;
  const lowCount = activeTodos.filter(t => t.priority === 'low').length;

  // Breakdown by Project / List
  const listStats = lists.map(list => {
    const listTasks = activeTodos.filter(t => t.listId === list.id);
    const listCompleted = listTasks.filter(t => t.completed).length;
    const rate = listTasks.length > 0 ? Math.round((listCompleted / listTasks.length) * 100) : 0;
    return {
      ...list,
      total: listTasks.length,
      completed: listCompleted,
      rate
    };
  });

  return (
    <div style={{
      padding: '20px',
      overflowY: 'auto',
      maxHeight: '100%',
      color: 'var(--text)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> Productivity Insights & Metrics
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time tracking across all your synced devices
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Back to Tasks
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            🔥 Day Streak
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Consistency score
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '14px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            ✅ Completion Rate
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            {completionRate}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {completedCount} of {totalCount} tasks
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '14px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            🎯 Priority Focus
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
            {highCount}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            High priority active
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '14px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            📁 Projects
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
            {lists.length}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Active lists & jobs
          </div>
        </div>
      </div>

      {/* 7-Day Velocity Chart */}
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>7-Day Completion Velocity</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Daily tasks completed across all devices</span>
          </div>
          <span style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'var(--tag-bg)',
            color: 'var(--tag-text)',
            fontWeight: 600
          }}>
            Last 7 Days
          </span>
        </div>

        {/* SVG Bar Chart */}
        <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingBottom: '10px' }}>
          {last7Days.map((d, i) => {
            const heightPercent = Math.max(12, Math.round((d.count / maxDailyCount) * 100));
            const isToday = i === last7Days.length - 1;
            return (
              <div key={d.dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  {d.count > 0 ? d.count : ''}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '38px',
                    height: `${heightPercent}%`,
                    background: isToday ? 'var(--primary-gradient)' : 'var(--surface-elevated)',
                    border: isToday ? 'none' : '1px solid var(--border)',
                    borderRadius: '8px 8px 3px 3px',
                    transition: 'height 0.3s ease'
                  }}
                />
                <span style={{
                  fontSize: '10px',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                  marginTop: '8px'
                }}>
                  {d.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Breakdown & Priority Distribution Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {/* Project Lists Progress */}
        <div style={{
          padding: '18px',
          borderRadius: '16px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>
            Completion by Project & List
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {listStats.map(list => (
              <div key={list.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{normalizeListIcon(list.icon)}</span> {list.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {list.completed}/{list.total} ({list.rate}%)
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--bg-subtle)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${list.rate}%`,
                    height: '100%',
                    backgroundColor: list.color || 'var(--primary)',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Matrix */}
        <div style={{
          padding: '18px',
          borderRadius: '16px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>
            Active Tasks by Priority
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>High Priority</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>{highCount}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Medium Priority</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{mediumCount}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Low Priority</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{lowCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
