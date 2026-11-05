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

export const DEFAULT_DAY_START_HOUR = 0; // Midnight (00:00) default

export const DAY_START_HOUR_OPTIONS = [
  { value: 0, label: '00:00 (Midnight - Default)' },
  { value: 1, label: '01:00 AM' },
  { value: 2, label: '02:00 AM' },
  { value: 3, label: '03:00 AM' },
  { value: 4, label: '04:00 AM (Night Owl)' },
  { value: 5, label: '05:00 AM (Early Bird)' },
  { value: 6, label: '06:00 AM (Morning)' },
  { value: 7, label: '07:00 AM' },
  { value: 8, label: '08:00 AM' }
];

export function toPersianDigits(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

// Persian (Jalaali / Solar Hijri)
export const JALAALI_MONTH_NAMES_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const JALAALI_MONTH_NAMES_EN = [
  'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'
];

export const JALAALI_WEEKDAYS_FA = [
  { key: 0, short: 'ش', name: 'شنبه' },
  { key: 1, short: 'ی', name: 'یک‌شنبه' },
  { key: 2, short: 'د', name: 'دوشنبه' },
  { key: 3, short: 'س', name: 'سه‌شنبه' },
  { key: 4, short: 'چ', name: 'چهارشنبه' },
  { key: 5, short: 'پ', name: 'پنج‌شنبه' },
  { key: 6, short: 'ج', name: 'جمعه', isWeekend: true }
];

export function toJalaali(gy, gm, gd) {
  var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  var gy2 = (gm > 2) ? (gy + 1) : gy;
  var days = (365 * gy) + parseInt((gy2 + 3) / 4) - parseInt((gy2 + 99) / 100) + parseInt((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * parseInt(days / 12053);
  days %= 12053;
  jy += 4 * parseInt(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += parseInt((days - 1) / 365);
    days = (days - 1) % 365;
  }
  var jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
  var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

export function toGregorian(jy, jm, jd) {
  var gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  var days = (365 * jy) + ((parseInt(jy / 33)) * 8) + parseInt(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * parseInt(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * parseInt(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * parseInt(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += parseInt((days - 1) / 365);
    days = (days - 1) % 365;
  }
  var gd = days + 1;
  var sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var gm;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return { gy, gm, gd };
}

export function getJalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const gEnd = toGregorian(jy, 12, 30);
  const jEnd = toJalaali(gEnd.gy, gEnd.gm, gEnd.gd);
  return jEnd.jm === 12 && jEnd.jd === 30 ? 30 : 29;
}

// Islamic (Hijri Qamari)
export const ISLAMIC_MONTH_NAMES_FA = [
  'محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه'
];

export const ISLAMIC_MONTH_NAMES_EN = [
  'Muharram', 'Safar', 'Rabi\' I', 'Rabi\' II', 'Jumada I', 'Jumada II',
  'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
];

export const ISLAMIC_WEEKDAYS_FA = [
  { key: 0, short: 'ش', name: 'السبت' },
  { key: 1, short: 'ی', name: 'الأحد' },
  { key: 2, short: 'د', name: 'الإثنين' },
  { key: 3, short: 'س', name: 'الثلاثاء' },
  { key: 4, short: 'چ', name: 'الأربعاء' },
  { key: 5, short: 'پ', name: 'الخميس' },
  { key: 6, short: 'ج', name: 'الجمعة', isWeekend: true }
];

export function toIslamic(date) {
  if (!date || isNaN(date.getTime())) return { hy: 1448, hm: 1, hd: 1 };
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(date);
    const hy = parseInt(parts.find(p => p.type === 'year')?.value || '1448', 10);
    const hm = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
    const hd = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
    return { hy, hm, hd };
  } catch (_) {
    return { hy: 1448, hm: 1, hd: 1 };
  }
}

export function islamicToGregorian(hy, hm, hd) {
  try {
    const approxYear = Math.round(hy * 0.970229 + 621.57);
    const approxMonth = (hm - 1) * 29.53;
    let testDate = new Date(approxYear, 0, 1, 12, 0, 0);
    testDate.setDate(testDate.getDate() + Math.floor(approxMonth) + (hd - 1));

    for (let i = 0; i < 40; i++) {
      const cur = toIslamic(testDate);
      if (cur.hy === hy && cur.hm === hm && cur.hd === hd) {
        return new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 12, 0, 0);
      }
      const yDiff = hy - cur.hy;
      const mDiff = hm - cur.hm + (yDiff * 12);
      const dDiff = hd - cur.hd + Math.round(mDiff * 29.53);
      const step = dDiff === 0 ? 1 : (dDiff > 0 ? 1 : -1) * Math.max(1, Math.min(Math.abs(dDiff), 30));
      testDate.setDate(testDate.getDate() + step);
    }
  } catch (_) {}
  return new Date();
}

export function getIslamicMonthLength(hy, hm) {
  const g1 = islamicToGregorian(hy, hm, 1);
  const g30 = new Date(g1);
  g30.setDate(g30.getDate() + 29);
  return toIslamic(g30).hm === hm ? 30 : 29;
}

// Gregorian
export const GREGORIAN_MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GREGORIAN_MONTH_NAMES_FA = [
  'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'
];

export const GREGORIAN_WEEKDAYS = [
  { key: 0, short: 'Su', name: 'Sunday', isWeekend: true },
  { key: 1, short: 'Mo', name: 'Monday' },
  { key: 2, short: 'Tu', name: 'Tuesday' },
  { key: 3, short: 'We', name: 'Wednesday' },
  { key: 4, short: 'Th', name: 'Thursday' },
  { key: 5, short: 'Fr', name: 'Friday' },
  { key: 6, short: 'Sa', name: 'Saturday', isWeekend: true }
];

export function getGregorianMonthLength(gy, gm) {
  return new Date(gy, gm, 0).getDate();
}

export function getStoredDayStartHour() {
  try {
    const saved = localStorage.getItem('synctodo_day_start_hour_v1');
    if (saved !== null && saved !== undefined && saved !== '') {
      const h = parseInt(saved, 10);
      if (!isNaN(h) && h >= 0 && h <= 23) return h;
    }
  } catch (_) {}
  return DEFAULT_DAY_START_HOUR;
}

export function setStoredDayStartHour(hour) {
  try {
    localStorage.setItem('synctodo_day_start_hour_v1', String(hour));
  } catch (_) {}
}

/**
 * Returns the logical local YYYY-MM-DD date string taking into account
 * the user-configured dayStartHour rollover.
 * If current local hour < dayStartHour, we still belong to the previous calendar day!
 */
export function getLogicalDateStr(date = new Date(), dayStartHour = 0) {
  const d = new Date(date);
  if (d.getHours() < dayStartHour) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a timestamp (e.g. todo.completedAt) falls on the same logical day as targetDateStr
 */
export function isSameLogicalDay(timestamp, targetDateStr, dayStartHour = 0) {
  if (!timestamp || !targetDateStr) return false;
  const logicalDate = getLogicalDateStr(new Date(timestamp), dayStartHour);
  return logicalDate === targetDateStr;
}

/**
 * Formats a clean date label for My Day header based on calendar system:
 * e.g. "پنجشنبه ۱۴ آبان" (Shamsi), "پنجشنبه ۲۵ جمادی‌الاول" (Islamic), or "Thu, Nov 5" (Gregorian)
 */
export function formatDayDateHeader(date = new Date(), calendarType = 'gregorian', dayStartHour = 0) {
  try {
    const dObj = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
    if (dObj.getHours && dObj.getHours() < dayStartHour) {
      dObj.setDate(dObj.getDate() - 1);
    }

    if (calendarType === 'shamsi') {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }).formatToParts(dObj);
      const w = parts.find(p => p.type === 'weekday')?.value || '';
      const d = parts.find(p => p.type === 'day')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      return `\u2067${w} ${d} ${m}\u2069`;
    } else if (calendarType === 'islamic') {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }).formatToParts(dObj);
      const w = parts.find(p => p.type === 'weekday')?.value || '';
      const d = parts.find(p => p.type === 'day')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      return `\u2067${w} ${d} ${m}\u2069`;
    } else {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(dObj);
    }
  } catch (_) {
    return '';
  }
}

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
