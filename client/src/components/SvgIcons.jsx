import React from 'react';

const PATHS = {
  check: <path d="M5 12l5 5L20 7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  cal: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pen: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />,
  repeat: <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="10" rx="1" />
      <path d="M2 19h20" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  tablet: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  camera: (
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  qr: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z" />,
  chev: <path d="M9 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  flag: <path d="M4 21V4h12l-2 4 2 4H4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  inbox: <path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
  wifi: <path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01" />,
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.6-10-8.6z" />
    </>
  ),
  sparkles: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8L5 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  )
};

export function Icon({ name, size = 16, style = {}, className = '' }) {
  return (
    <span
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[name] || PATHS.check}
      </svg>
    </span>
  );
}

/**
 * Natural-Language Task Parser
 * Recognizes:
 *  - #ListName (e.g. #Work, #Personal, #Shopping)
 *  - !high, !med, !medium, !low
 *  - today, tomorrow, next week, monday..sunday, in N days
 *  - times like 6pm, 17:00, 9:30am
 *  - daily, every day, weekly, every week, weekdays, monthly, every N days
 */
export function parseNaturalTaskInput(rawText, lists = []) {
  if (!rawText || !rawText.trim()) {
    return {
      cleanTitle: '',
      detectedList: null,
      detectedPriority: null,
      detectedDate: null,
      detectedDateLabel: null,
      detectedTime: null,
      detectedRecurrence: null,
      detectedInterval: 1,
      hasDetections: false
    };
  }

  let working = rawText;
  let detectedList = null;
  let detectedPriority = null;
  let detectedDate = null;
  let detectedDateLabel = null;
  let detectedTime = null;
  let detectedRecurrence = null;
  let detectedInterval = 1;

  // 1. #List matching
  const hashMatch = working.match(/(?:^|\s)#([a-zA-Z0-9_\u0600-\u06FF-]+)/);
  if (hashMatch) {
    const tag = hashMatch[1].toLowerCase();
    const matched = lists.find(
      l => l.name.toLowerCase() === tag || l.id.toLowerCase() === tag || l.name.toLowerCase().startsWith(tag)
    );
    if (matched) {
      detectedList = matched;
      working = working.replace(hashMatch[0], ' ');
    }
  }

  // 2. !Priority matching (!high, !med, !medium, !low, !1, !2, !3)
  const priMatch = working.match(/(?:^|\s)!(high|med|medium|low|urgent|1|2|3)\b/i);
  if (priMatch) {
    const val = priMatch[1].toLowerCase();
    if (val === 'high' || val === 'urgent' || val === '1') detectedPriority = 'high';
    else if (val === 'med' || val === 'medium' || val === '2') detectedPriority = 'medium';
    else if (val === 'low' || val === '3') detectedPriority = 'low';
    working = working.replace(priMatch[0], ' ');
  }

  // 3. Recurrence matching ("every 3 days", "every day", "daily", "weekly", "weekdays", "monthly")
  const everyNDays = working.match(/\bevery\s+(\d+)\s+days?\b/i);
  if (everyNDays) {
    detectedRecurrence = 'custom';
    detectedInterval = Math.max(1, parseInt(everyNDays[1], 10) || 1);
    working = working.replace(everyNDays[0], ' ');
  } else {
    const recSimple = working.match(/\b(every\s+day|daily|every\s+weekday|weekdays|every\s+week|weekly|every\s+month|monthly)\b/i);
    if (recSimple) {
      const r = recSimple[1].toLowerCase();
      if (r.includes('day') && !r.includes('week')) detectedRecurrence = 'daily';
      else if (r.includes('weekday')) detectedRecurrence = 'weekdays';
      else if (r.includes('week')) detectedRecurrence = 'weekly';
      else if (r.includes('month')) detectedRecurrence = 'monthly';
      working = working.replace(recSimple[0], ' ');
    }
  }

  // 4. Date matching (today, tomorrow, next week, in N days, weekday names)
  const now = new Date();
  const toIso = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const inNDays = working.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inNDays) {
    const add = parseInt(inNDays[1], 10) || 1;
    const d = new Date(now);
    d.setDate(d.getDate() + add);
    detectedDate = toIso(d);
    detectedDateLabel = `In ${add}d`;
    working = working.replace(inNDays[0], ' ');
  } else if (/\btomorrow\b|\btmrw\b/i.test(working)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    detectedDate = toIso(d);
    detectedDateLabel = 'Tomorrow';
    working = working.replace(/\b(tomorrow|tmrw)\b/i, ' ');
  } else if (/\btoday\b|\btonight\b/i.test(working)) {
    detectedDate = toIso(now);
    detectedDateLabel = 'Today';
    working = working.replace(/\b(today|tonight)\b/i, ' ');
  } else if (/\bnext\s+week\b/i.test(working)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    detectedDate = toIso(d);
    detectedDateLabel = 'Next week';
    working = working.replace(/\bnext\s+week\b/i, ' ');
  } else {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayRegex = new RegExp(`\\b(${dayNames.join('|')})\\b`, 'i');
    const m = working.match(dayRegex);
    if (m) {
      const targetDay = dayNames.indexOf(m[1].toLowerCase());
      const d = new Date(now);
      const currentDay = d.getDay();
      let diff = (targetDay - currentDay + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      detectedDate = toIso(d);
      detectedDateLabel = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      working = working.replace(m[0], ' ');
    }
  }

  // 5. Time matching ("at 6pm", "6:30pm", "17:00", "9am")
  const time12 = working.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time12) {
    let hr = parseInt(time12[1], 10);
    const min = time12[2] || '00';
    const mer = time12[3].toLowerCase();
    if (mer === 'pm' && hr < 12) hr += 12;
    if (mer === 'am' && hr === 12) hr = 0;
    detectedTime = `${String(hr).padStart(2, '0')}:${min}`;
    if (!detectedDate) {
      detectedDate = toIso(now);
      detectedDateLabel = 'Today';
    }
    working = working.replace(time12[0], ' ');
  } else {
    const time24 = working.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (time24) {
      detectedTime = `${String(time24[1]).padStart(2, '0')}:${time24[2]}`;
      if (!detectedDate) {
        detectedDate = toIso(now);
        detectedDateLabel = 'Today';
      }
      working = working.replace(time24[0], ' ');
    }
  }

  const cleanTitle = working.replace(/\s+/g, ' ').trim();
  const hasDetections = Boolean(
    detectedList || detectedPriority || detectedDate || detectedTime || detectedRecurrence
  );

  return {
    cleanTitle: cleanTitle || rawText.trim(),
    detectedList,
    detectedPriority,
    detectedDate,
    detectedDateLabel,
    detectedTime,
    detectedRecurrence,
    detectedInterval,
    hasDetections
  };
}
