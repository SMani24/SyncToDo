import React from 'react';
import { Icon } from './SvgIcons';
import { CALENDAR_TYPES, formatCalendarDate, formatFullHeaderDate, DAY_START_HOUR_OPTIONS } from '../utils/calendar';

export default function SettingsModal({
  calendarType = 'gregorian',
  onSelectCalendarType,
  dayStartHour = 0,
  onSelectDayStartHour,
  onOpenThemeModal,
  onOpenDeviceModal,
  syncEngine,
  syncState = {},
  deviceType = 'laptop',
  onClose
}) {
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const handleExportBackup = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        deviceName: syncEngine?.deviceName || 'Device',
        lists: syncState.lists || [],
        todos: syncState.todos || []
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synctodo-backup-${todayIso}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export backup: ' + err.message);
    }
  };

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
        zIndex: 230,
        padding: deviceType === 'phone' ? 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px' : '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--surface)',
          borderRadius: '20px',
          border: '1px solid var(--border)',
          padding: deviceType === 'phone' ? '18px 16px' : '22px 24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          color: 'var(--text)',
          maxHeight: '88vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: 'var(--tag-bg)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="gear" size={19} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
                Settings & Preferences
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Calendar system, appearance & device sync
              </div>
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

        {/* SECTION 1: CALENDAR SYSTEM */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 800 }}>
              <Icon name="cal" size={16} /> Calendar System / نوع تقویم
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Choose date display format
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {CALENDAR_TYPES.map(cal => {
              const isSelected = calendarType === cal.id;
              const formattedSample = formatCalendarDate(todayIso, cal.id);

              return (
                <div
                  key={cal.id}
                  data-calendar-id={cal.id}
                  onClick={() => onSelectCalendarType(cal.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--tag-bg)' : 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: isSelected ? '5px solid var(--primary)' : '2px solid var(--text-muted)',
                      backgroundColor: 'transparent',
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
                        <span>{cal.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>({cal.nativeLabel})</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {cal.description}
                      </div>
                    </div>
                  </div>

                  <div
                    dir={cal.id === 'gregorian' ? 'ltr' : 'rtl'}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: isSelected ? 'var(--primary)' : 'var(--text)',
                      fontFamily: 'inherit',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-subtle)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginLeft: '8px',
                      direction: cal.id === 'gregorian' ? 'ltr' : 'rtl',
                      unicodeBidi: 'isolate'
                    }}
                  >
                    {formattedSample}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: DAILY PLAN & NEW DAY ROLLOVER */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 800 }}>
              <Icon name="sun" size={16} /> Start of New Day / زمان شروع روز جدید
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              Choose what time your daily plan resets and prompts to carry forward unfinished tasks:
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={dayStartHour}
              onChange={(e) => onSelectDayStartHour && onSelectDayStartHour(Number(e.target.value))}
              style={{
                flex: 1,
                minWidth: '200px',
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--primary)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {DAY_START_HOUR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            💡 Tasks completed on previous days stay locked in yesterday's history. At <b>{DAY_START_HOUR_OPTIONS.find(o => o.value === dayStartHour)?.label || 'Midnight'}</b>, any unfinished tasks are offered to carry forward into today.
          </div>
        </div>

        {/* SECTION 3: APPEARANCE & THEMES */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text)'
            }}>
              <Icon name="palette" size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>Themes & Appearance</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                8 Dark & Light themes, Auto-Schedule, Sunrise/Sunset
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              if (onOpenThemeModal) onOpenThemeModal();
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Customize
          </button>
        </div>

        {/* SECTION 3: DEVICES & LOCAL WI-FI SYNC */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Icon name="wifi" size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>
                {syncEngine?.deviceName || 'This Device'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Direct Wi-Fi P2P & local mesh synchronization
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              if (onOpenDeviceModal) onOpenDeviceModal();
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Pair Devices
          </button>
        </div>

        {/* SECTION 4: DATA BACKUP & EXPORT */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#10b981'
            }}>
              <Icon name="inbox" size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>Backup & Export Data</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Download all tasks and lists as a standalone JSON file
              </div>
            </div>
          </div>
          <button
            onClick={handleExportBackup}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Export JSON
          </button>
        </div>

        {/* Footer info */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '6px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <span>SyncToDo v1.0 · Multi-Device Sync</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
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
