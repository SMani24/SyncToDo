// Date and calendar system utilities supporting Gregorian, Solar Hijri (Shamsi), and Hijri Qamari (Islamic)

export const CALENDAR_TYPES = [
  {
    id: 'gregorian',
    label: 'Gregorian',
    nativeLabel: 'میلادی',
    description: 'Standard international calendar (e.g. Nov 4, 2026)'
  },
  {
    id: 'shamsi',
    label: 'Solar Hijri (Shamsi)',
    nativeLabel: 'هجری شمسی',
    description: 'Official Persian / Iranian calendar (e.g. ۱۴ آبان ۱۴۰۵)'
  },
  {
    id: 'islamic',
    label: 'Hijri Qamari (Islamic)',
    nativeLabel: 'هجری قمری',
    description: 'Lunar Islamic calendar (e.g. ۲۴ جمادی‌الاول ۱۴۴۸)'
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
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: options.year !== undefined ? options.year : 'numeric',
        month: options.month || 'short',
        day: options.day || 'numeric'
      }).format(date);
    } else if (calendarType === 'islamic') {
      return new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
        year: options.year !== undefined ? options.year : 'numeric',
        month: options.month || 'short',
        day: options.day || 'numeric'
      }).format(date);
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
 * Formats a due date for task card badges: e.g. "Today · ۱۴ آبان" or "۱۴ آبان ۱۴۰۵"
 */
export function formatDueDateBadge(dueDateStr, todayStr, calendarType = 'gregorian') {
  if (!dueDateStr) return '';
  const isToday = dueDateStr === todayStr;

  if (isToday) {
    if (calendarType === 'shamsi') {
      return 'امروز';
    } else if (calendarType === 'islamic') {
      return 'اليوم';
    }
    return 'Today';
  }

  return formatCalendarDate(dueDateStr, calendarType, {
    month: 'short',
    day: 'numeric',
    year: undefined
  });
}

/**
 * Formats full header date for My Day / Today views
 */
export function formatFullHeaderDate(dateObj = new Date(), calendarType = 'gregorian') {
  try {
    if (calendarType === 'shamsi') {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(dateObj);
    } else if (calendarType === 'islamic') {
      return new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(dateObj);
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
