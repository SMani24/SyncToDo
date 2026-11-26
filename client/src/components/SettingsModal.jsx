import React, { useState, useRef, useMemo } from 'react';
import { Icon } from './SvgIcons';
import { CALENDAR_TYPES, formatCalendarDate, formatFullHeaderDate, formatDueDateBadge, DAY_START_HOUR_OPTIONS, getLogicalDateStr } from '../utils/calendar';
import { buildImportBatch, buildChatGPTInstructions } from '../../../shared/taskImport.js';

export default function SettingsModal({
  calendarType = 'gregorian',
  onSelectCalendarType,
  showWeekdayInTasks = false,
  onToggleShowWeekdayInTasks,
  dayStartHour = 0,
  onSelectDayStartHour,
  onOpenThemeModal,
  onOpenDeviceModal,
  onImportSuccess,
  syncEngine,
  syncState = {},
  deviceType = 'laptop',
  onClose
}) {
  const today = new Date();
  const todayIso = getLogicalDateStr(today, dayStartHour);
  const fileInputRef = useRef(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteJsonText, setPasteJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const importPreview = useMemo(() => {
    if (!pasteJsonText.trim()) return null;
    try {
      const res = buildImportBatch({
        rawInput: pasteJsonText,
        existingTodos: syncState.todos || [],
        existingLists: syncState.lists || []
      });
      return { ok: true, summary: res.summary };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [pasteJsonText, syncState.todos, syncState.lists]);

  const chatGptPrompt = useMemo(() => buildChatGPTInstructions(syncState.lists || []), [syncState.lists]);

  const runJsonImport = (rawText) => {
    setImportError('');
    try {
      const result = syncEngine.importTasks(rawText);
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
      }
      try { window.AndroidBridge?.hideKeyboard?.(); } catch (_) {}
      setPasteJsonText('');
      setShowPasteBox(false);
      if (onImportSuccess) {
        onImportSuccess(result);
      }
      onClose();
    } catch (err) {
      setImportError(err.message || 'Could not import JSON.');
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      runJsonImport(text);
    } catch (err) {
      setImportError('Failed to read file: ' + err.message);
      setShowPasteBox(true);
    }
  };

  const handleCopyPrompt = async () => {
    let copied = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(chatGptPrompt);
        copied = true;
      } catch (_) {}
    }
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = chatGptPrompt;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    }
    if (copied) {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2200);
    } else {
      setShowPromptPreview(true);
    }
  };

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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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

          {/* Day of Week in Task Cards Toggle */}
          <div
            onClick={() => onToggleShowWeekdayInTasks && onToggleShowWeekdayInTasks(!showWeekdayInTasks)}
            style={{
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              border: showWeekdayInTasks ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              background: showWeekdayInTasks ? 'var(--tag-bg)' : 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '5px',
                border: showWeekdayInTasks ? 'none' : '2px solid var(--text-muted)',
                backgroundColor: showWeekdayInTasks ? 'var(--primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800,
                flexShrink: 0
              }}>
                {showWeekdayInTasks && '✓'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                  Show Day of Week under Tasks
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  نمایش روز هفته در زیر کارها (مثال: چهارشنبه ۲۰ آبان)
                </div>
              </div>
            </div>

            <div
              dir={calendarType === 'gregorian' ? 'ltr' : 'rtl'}
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: showWeekdayInTasks ? 'var(--primary)' : 'var(--text-muted)',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: showWeekdayInTasks ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-subtle)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                marginLeft: '8px',
                unicodeBidi: 'isolate'
              }}
            >
              {formatDueDateBadge('2026-11-11', todayIso, calendarType, showWeekdayInTasks)}
            </div>
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

        {/* SECTION 4: AI TASK IMPORT & DATA BACKUP */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#10b981'
              }}>
                <Icon name="sparkles" size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>AI Task Import & Data Backup</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Import batch tasks from GPT, Codex, or JSON files, or export backup
                </div>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,.txt"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              data-action="import-json-file"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--primary)',
                background: 'var(--tag-bg)',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Import JSON File
            </button>
            <button
              type="button"
              data-action="toggle-paste-json"
              onClick={() => {
                setImportError('');
                setShowPasteBox(prev => !prev);
              }}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: showPasteBox ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: showPasteBox ? 'var(--tag-bg)' : 'var(--surface)',
                color: showPasteBox ? 'var(--primary)' : 'var(--text)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Paste JSON
            </button>
            <button
              type="button"
              data-action="copy-ai-prompt"
              onClick={handleCopyPrompt}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: promptCopied ? '1px solid #10b981' : '1px solid var(--border)',
                background: promptCopied ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface)',
                color: promptCopied ? '#10b981' : 'var(--text)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {promptCopied ? '✓ Copied AI Prompt' : 'Copy GPT Prompt'}
            </button>
            <button
              type="button"
              onClick={() => setShowPromptPreview(prev => !prev)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {showPromptPreview ? 'Hide Prompt' : 'View Prompt'}
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #10b981',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              Export JSON
            </button>
          </div>

          {showPasteBox && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px',
              borderRadius: '10px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)'
            }}>
              <textarea
                data-input="paste-tasks-json"
                value={pasteJsonText}
                onChange={(e) => {
                  setImportError('');
                  setPasteJsonText(e.target.value);
                }}
                rows={6}
                placeholder={'{\n  "tasks": [\n    { "title": "Review Lecture 3", "list": "OS", "priority": "high", "dueDate": "tomorrow", "steps": ["Read notes", "Solve Q1"] }\n  ]\n}'}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text)',
                  padding: '9px 10px',
                  fontSize: '11.5px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
              {importError && (
                <div style={{ fontSize: '11.5px', color: '#ef4444', fontWeight: 600 }}>
                  {importError}
                </div>
              )}
              {!importError && importPreview && (
                <div style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: importPreview.ok ? '#10b981' : '#ef4444'
                }}>
                  {importPreview.ok
                    ? `Ready: ${importPreview.summary.taskCount} task${importPreview.summary.taskCount === 1 ? '' : 's'} -> ${Object.entries(importPreview.summary.targetListCounts).map(([k, v]) => `${k} (${v})`).join(', ')}${importPreview.summary.createdListCount > 0 ? ` · +${importPreview.summary.createdListCount} new list${importPreview.summary.createdListCount === 1 ? '' : 's'}` : ''}`
                    : importPreview.error}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setShowPasteBox(false);
                    setImportError('');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-action="submit-paste-json"
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!pasteJsonText.trim() || (importPreview && !importPreview.ok)}
                  onClick={() => runJsonImport(pasteJsonText)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: (!pasteJsonText.trim() || (importPreview && !importPreview.ok)) ? 'var(--border)' : 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: (!pasteJsonText.trim() || (importPreview && !importPreview.ok)) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Import Tasks
                </button>
              </div>
            </div>
          )}

          {showPromptPreview && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px',
              borderRadius: '10px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                Paste into ChatGPT Custom Instructions, Project Knowledge, or chat:
              </div>
              <textarea
                readOnly
                value={chatGptPrompt}
                rows={7}
                onFocus={(e) => e.target.select()}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text)',
                  padding: '8px 10px',
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </div>
          )}
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
