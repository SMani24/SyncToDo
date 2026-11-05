import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './SvgIcons';
import {
  toPersianDigits,
  toJalaali,
  toGregorian,
  getJalaaliMonthLength,
  JALAALI_MONTH_NAMES_FA,
  JALAALI_MONTH_NAMES_EN,
  JALAALI_WEEKDAYS_FA,
  toIslamic,
  islamicToGregorian,
  getIslamicMonthLength,
  ISLAMIC_MONTH_NAMES_FA,
  ISLAMIC_MONTH_NAMES_EN,
  ISLAMIC_WEEKDAYS_FA,
  GREGORIAN_MONTH_NAMES_EN,
  GREGORIAN_MONTH_NAMES_FA,
  GREGORIAN_WEEKDAYS,
  getGregorianMonthLength
} from '../utils/calendar';

export default function CalendarPickerModal({
  isOpen,
  value, // "YYYY-MM-DD" or null
  calendarType = 'gregorian',
  onSelect, // (isoDateStr | null) => void
  onClose,
  deviceType = 'laptop'
}) {
  if (!isOpen) return null;

  const isPhone = deviceType === 'phone';
  const isRTL = calendarType === 'shamsi' || calendarType === 'islamic';

  // Current today reference
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Initial state based on current calendarType and selected value
  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value + 'T12:00:00') : now;
    if (calendarType === 'shamsi') {
      const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return j.jy;
    } else if (calendarType === 'islamic') {
      const isl = toIslamic(d);
      return isl.hy;
    } else {
      return d.getFullYear();
    }
  });

  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value + 'T12:00:00') : now;
    if (calendarType === 'shamsi') {
      const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return j.jm; // 1..12
    } else if (calendarType === 'islamic') {
      const isl = toIslamic(d);
      return isl.hm; // 1..12
    } else {
      return d.getMonth() + 1; // 1..12
    }
  });

  // Keep state in sync if value or calendarType changes externally
  useEffect(() => {
    const d = value ? new Date(value + 'T12:00:00') : new Date();
    if (calendarType === 'shamsi') {
      const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      setViewYear(j.jy);
      setViewMonth(j.jm);
    } else if (calendarType === 'islamic') {
      const isl = toIslamic(d);
      setViewYear(isl.hy);
      setViewMonth(isl.hm);
    } else {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth() + 1);
    }
  }, [value, calendarType]);

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth > 1) {
      setViewMonth(viewMonth - 1);
    } else {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth < 12) {
      setViewMonth(viewMonth + 1);
    } else {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    }
  };

  // Month names and weekdays for active calendar
  const monthNames = useMemo(() => {
    if (calendarType === 'shamsi') return JALAALI_MONTH_NAMES_FA;
    if (calendarType === 'islamic') return ISLAMIC_MONTH_NAMES_FA;
    return GREGORIAN_MONTH_NAMES_EN;
  }, [calendarType]);

  const weekdays = useMemo(() => {
    if (calendarType === 'shamsi') return JALAALI_WEEKDAYS_FA;
    if (calendarType === 'islamic') return ISLAMIC_WEEKDAYS_FA;
    return GREGORIAN_WEEKDAYS;
  }, [calendarType]);

  // Calendar title
  const currentMonthName = monthNames[viewMonth - 1] || '';
  const displayYear = (calendarType === 'shamsi' || calendarType === 'islamic')
    ? toPersianDigits(viewYear)
    : viewYear;

  // Build grid of days
  const { totalDays, colOffset, daysList } = useMemo(() => {
    let tot = 30;
    let offset = 0;
    const list = [];

    if (calendarType === 'shamsi') {
      tot = getJalaaliMonthLength(viewYear, viewMonth);
      const gFirst = toGregorian(viewYear, viewMonth, 1);
      const dFirst = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
      // Week starts Saturday: Saturday(6) -> 0, Sunday(0) -> 1, Friday(5) -> 6
      offset = (dFirst.getDay() + 1) % 7;

      for (let day = 1; day <= tot; day++) {
        const g = toGregorian(viewYear, viewMonth, day);
        const iso = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        list.push({
          dayNum: day,
          displayNum: toPersianDigits(day),
          iso,
          isToday: iso === todayISO,
          isSelected: iso === value,
          isWeekend: (offset + day - 1) % 7 === 6 // Friday
        });
      }
    } else if (calendarType === 'islamic') {
      tot = getIslamicMonthLength(viewYear, viewMonth);
      const gFirst = islamicToGregorian(viewYear, viewMonth, 1);
      offset = (gFirst.getDay() + 1) % 7;

      for (let day = 1; day <= tot; day++) {
        const gDate = islamicToGregorian(viewYear, viewMonth, day);
        const iso = `${gDate.getFullYear()}-${String(gDate.getMonth() + 1).padStart(2, '0')}-${String(gDate.getDate()).padStart(2, '0')}`;
        list.push({
          dayNum: day,
          displayNum: toPersianDigits(day),
          iso,
          isToday: iso === todayISO,
          isSelected: iso === value,
          isWeekend: (offset + day - 1) % 7 === 6 // Friday
        });
      }
    } else {
      // Gregorian
      tot = getGregorianMonthLength(viewYear, viewMonth);
      const dFirst = new Date(viewYear, viewMonth - 1, 1);
      offset = dFirst.getDay(); // Sunday=0 .. Saturday=6

      for (let day = 1; day <= tot; day++) {
        const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        list.push({
          dayNum: day,
          displayNum: String(day),
          iso,
          isToday: iso === todayISO,
          isSelected: iso === value,
          isWeekend: (offset + day - 1) % 7 === 0 || (offset + day - 1) % 7 === 6
        });
      }
    }

    return { totalDays: tot, colOffset: offset, daysList: list };
  }, [viewYear, viewMonth, calendarType, value, todayISO]);

  // Quick Select Helpers
  const handleSelectToday = () => {
    onSelect(todayISO);
    onClose();
  };

  const handleSelectTomorrow = () => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwISO = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    onSelect(tmrwISO);
    onClose();
  };

  const handleClear = () => {
    onSelect(null);
    onClose();
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
        zIndex: 220,
        padding: isPhone ? 'max(16px, var(--sat)) 12px max(20px, var(--sab)) 12px' : '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          maxWidth: '360px',
          backgroundColor: 'var(--surface)',
          borderRadius: '18px',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--text)',
          animation: 'fadeInScale 0.16s ease-out'
        }}
      >
        {/* Header with Calendar Type Badge & Close */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '7px',
              background: 'var(--tag-bg)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px'
            }}>
              📅
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
              {calendarType === 'shamsi' && 'تقویم هجری شمسی'}
              {calendarType === 'islamic' && 'تقويم هجري قمري'}
              {calendarType === 'gregorian' && 'Gregorian Calendar'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '28px',
              height: '28px',
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
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Month & Year Navigation Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 8px 16px',
          gap: '8px'
        }}>
          {/* Previous Month Button */}
          <button
            type="button"
            onClick={handlePrevMonth}
            title={isRTL ? 'ماه قبل' : 'Previous month'}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              border: '1px solid var(--border)',
              background: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '18px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              lineHeight: 1
            }}
          >
            {isRTL ? '›' : '‹'}
          </button>

          {/* Month & Year Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
            {/* Month Select */}
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-elevated)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: isRTL ? 'right' : 'left'
              }}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            {/* Year Input / Select */}
            <select
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-elevated)',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {Array.from({ length: 15 }, (_, i) => {
                const yr = viewYear - 5 + i;
                return (
                  <option key={yr} value={yr}>
                    {isRTL ? toPersianDigits(yr) : yr}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Next Month Button */}
          <button
            type="button"
            onClick={handleNextMonth}
            title={isRTL ? 'ماه بعد' : 'Next month'}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              border: '1px solid var(--border)',
              background: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '18px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              lineHeight: 1
            }}
          >
            {isRTL ? '‹' : '›'}
          </button>
        </div>

        {/* Days of Week Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '6px 12px 2px 12px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border)'
        }}>
          {weekdays.map((w, idx) => (
            <div
              key={idx}
              title={w.name}
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: w.isWeekend ? '#ef4444' : 'var(--text-muted)',
                padding: '4px 0'
              }}
            >
              {w.short}
            </div>
          ))}
        </div>

        {/* Month Days Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          padding: '10px 12px 14px 12px'
        }}>
          {/* Empty spacer cells before day 1 */}
          {Array.from({ length: colOffset }).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: '36px' }} />
          ))}

          {/* Days of current month */}
          {daysList.map((d) => (
            <button
              key={d.dayNum}
              type="button"
              onClick={() => {
                onSelect(d.iso);
                onClose();
              }}
              style={{
                height: '36px',
                borderRadius: '9px',
                border: d.isSelected
                  ? 'none'
                  : (d.isToday ? '1px solid var(--primary)' : '1px solid transparent'),
                background: d.isSelected
                  ? 'var(--primary-gradient)'
                  : (d.isToday ? 'var(--tag-bg)' : 'transparent'),
                color: d.isSelected
                  ? '#ffffff'
                  : (d.isWeekend ? '#f87171' : 'var(--text)'),
                fontSize: '13px',
                fontWeight: d.isSelected || d.isToday ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'transform 0.1s, background-color 0.15s',
                boxShadow: d.isSelected ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none'
              }}
            >
              <span>{d.displayNum}</span>
              {d.isToday && !d.isSelected && (
                <span style={{
                  position: 'absolute',
                  bottom: '3px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)'
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Bottom Quick-Action Shortcuts Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={handleSelectToday}
              style={{
                padding: '5px 9px',
                borderRadius: '7px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--primary)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {isRTL ? 'امروز' : 'Today'}
            </button>
            <button
              type="button"
              onClick={handleSelectTomorrow}
              style={{
                padding: '5px 9px',
                borderRadius: '7px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isRTL ? 'فردا' : 'Tomorrow'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '5px 9px',
                  borderRadius: '7px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: '#ef4444',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isRTL ? 'پاک کردن' : 'Clear'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                border: 'none',
                background: 'var(--bg-subtle)',
                color: 'var(--text)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {isRTL ? 'بستن' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
