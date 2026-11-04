// Date and calendar system utilities supporting Gregorian, Solar Hijri (Shamsi), and Hijri Qamari (Islamic)

export const CALENDAR_TYPES = [
  {
    id: 'gregorian',
    label: 'Gregorian',
    nativeLabel: 'میلادی',
    description: 'International'
  },
  {
    id: 'shamsi',
    label: 'Solar Hijri',
    nativeLabel: 'هجری شمسی',
    description: 'Iranian calendar'
  },
  {
    id: 'islamic',
    label: 'Hijri Qamari',
    nativeLabel: 'هجری قمری',
    description: 'Islamic lunar'
  }
];

export function getStoredCalendarType() {
  try {
    return localStorage.getItem('synctodo_calendar_system_v1') || 'gregorian';
  } catch (_) {
    return 'gregorian';
  }
}

export function setStoredCalendarType(calType) {
  try {
    localStorage.setItem('synctodo_calendar_system_v1', calType);
  } catch (_) {}
}

/**
 * Format a date string (YYYY-MM-DD or ISO string) according to selected calendar
 * Strictly maintains Persian & Arabic RTL token order: [Day] [Month] [Year]
 * (Day on right, Month in middle, Year on left when viewed RTL)
 */
export function formatCalendarDate(dateStr, calendarType = 'gregorian', options = {}) {
  if (!dateStr) return '';
  try {
    const raw = String(dateStr).split('T')[0];
    const parts = raw.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);

    if (calendarType === 'shamsi') {
      const dtParts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: options.month || 'long',
        day: 'numeric'
      }).formatToParts(date);
      const d = dtParts.find(p => p.type === 'day')?.value || '';
      const m = dtParts.find(p => p.type === 'month')?.value || '';
      const y = dtParts.find(p => p.type === 'year')?.value || '';

      const content = options.includeYear === false ? `${d} ${m}` : `${d} ${m} ${y}`;
      // Wrap with Unicode Right-To-Left Isolate (\u2067 ... \u2069)
      return `\u2067${content.trim()}\u2069`;
    } else if (calendarType === 'islamic') {
      const dtParts = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
        year: 'numeric',
        month: options.month || 'long',
        day: 'numeric'
      }).formatToParts(date);
      const d = dtParts.find(p => p.type === 'day')?.value || '';
      const m = dtParts.find(p => p.type === 'month')?.value || '';
      const y = dtParts.find(p => p.type === 'year')?.value || '';

      const content = options.includeYear === false ? `${d} ${m}` : `${d} ${m} ${y}`;
      return `\u2067${content.trim()}\u2069`;
    } else {
      // Gregorian
      return new Intl.DateTimeFormat('en-US', {
        year: options.year !== undefined ? options.year : (new Date().getFullYear() !== year ? 'numeric' : undefined),
        month: options.month || 'short',
        day: options.day || 'numeric'
      }).format(date);
    }
  } catch (_) {
    return dateStr;
  }
}

/**
 * Formats a due date for task card badges: e.g. "Today · ۱۳ آبان" or "۱۳ آبان ۱۴۰۵"
 */
export function formatDueDateBadge(dueDateStr, todayStr, calendarType = 'gregorian') {
  if (!dueDateStr) return '';
  const isToday = dueDateStr === todayStr;

  if (isToday) {
    if (calendarType === 'shamsi') {
      return '\u2067امروز\u2069';
    } else if (calendarType === 'islamic') {
      return '\u2067اليوم\u2069';
    }
    return 'Today';
  }

  return formatCalendarDate(dueDateStr, calendarType, {
    month: 'short',
    day: 'numeric',
    includeYear: false
  });
}

/**
 * Formats full header date for My Day / Today views
 */
export function formatFullHeaderDate(dateObj = new Date(), calendarType = 'gregorian') {
  try {
    if (calendarType === 'shamsi') {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).formatToParts(dateObj);
      const w = parts.find(p => p.type === 'weekday')?.value || '';
      const d = parts.find(p => p.type === 'day')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const y = parts.find(p => p.type === 'year')?.value || '';
      return `\u2067${w}، ${d} ${m} ${y}\u2069`;
    } else if (calendarType === 'islamic') {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).formatToParts(dateObj);
      const w = parts.find(p => p.type === 'weekday')?.value || '';
      const d = parts.find(p => p.type === 'day')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const y = parts.find(p => p.type === 'year')?.value || '';
      return `\u2067${w}، ${d} ${m} ${y}\u2069`;
    } else {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }).format(dateObj);
    }
  } catch (_) {
    return dateObj.toLocaleDateString();
  }
}
