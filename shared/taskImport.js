export const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
export const VALID_RECURRENCES = new Set(['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom']);

const PRIORITY_ALIASES = {
  urgent: 'high',
  important: 'high',
  h: 'high',
  normal: 'medium',
  med: 'medium',
  m: 'medium',
  l: 'low'
};

/**
 * Remove optional markdown ```json fences around raw text pasted from an AI chat.
 */
export function stripJsonCodeFences(rawText) {
  if (typeof rawText !== 'string') return rawText;
  const trimmed = rawText.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match ? match[1].trim() : trimmed;
}

/**
 * Validate YYYY-MM-DD strictly or resolve 'today' / 'tomorrow' keywords.
 */
export function resolveDueDateValue(value, todayStr, tomorrowStr, taskIndex = 0) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new Error(`Task #${taskIndex + 1}: dueDate must be a string (YYYY-MM-DD, "today", or "tomorrow").`);
  }
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  if (clean === 'today') return todayStr;
  if (clean === 'tomorrow') return tomorrowStr;

  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) {
    throw new Error(`Task #${taskIndex + 1}: invalid dueDate "${value}". Use YYYY-MM-DD, "today", or "tomorrow".`);
  }
  const y = Number(isoMatch[1]);
  const m = Number(isoMatch[2]);
  const d = Number(isoMatch[3]);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) {
    throw new Error(`Task #${taskIndex + 1}: invalid calendar date "${value}".`);
  }
  return value.trim();
}

function normalizeTimeValue(value, fieldName, taskIndex) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new Error(`Task #${taskIndex + 1}: ${fieldName} must be an "HH:MM" string.`);
  }
  const trimmed = value.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) {
    throw new Error(`Task #${taskIndex + 1}: invalid ${fieldName} "${value}". Expected 24h "HH:MM".`);
  }
  const [hh, mm] = trimmed.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error(`Task #${taskIndex + 1}: ${fieldName} out of range "${value}".`);
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizePriority(value, taskIndex) {
  if (value === undefined || value === null || value === '') return 'medium';
  if (typeof value !== 'string') {
    throw new Error(`Task #${taskIndex + 1}: priority must be "low", "medium", or "high".`);
  }
  const lower = value.trim().toLowerCase();
  const mapped = PRIORITY_ALIASES[lower] || lower;
  if (!VALID_PRIORITIES.has(mapped)) {
    throw new Error(`Task #${taskIndex + 1}: unknown priority "${value}". Use "low", "medium", or "high".`);
  }
  return mapped;
}

function normalizeRecurrence(value, taskIndex) {
  if (value === undefined || value === null || value === '') return 'none';
  if (typeof value !== 'string') {
    throw new Error(`Task #${taskIndex + 1}: recurrence must be one of none, daily, weekdays, weekly, monthly, custom.`);
  }
  const lower = value.trim().toLowerCase();
  if (!VALID_RECURRENCES.has(lower)) {
    throw new Error(`Task #${taskIndex + 1}: unknown recurrence "${value}".`);
  }
  return lower;
}

function normalizeSteps(steps, now, taskIndex) {
  if (steps === undefined || steps === null) return [];
  if (!Array.isArray(steps)) {
    throw new Error(`Task #${taskIndex + 1}: steps must be an array of strings or step objects.`);
  }
  const out = [];
  for (let i = 0; i < steps.length; i++) {
    const raw = steps[i];
    if (typeof raw === 'string') {
      const title = raw.trim();
      if (title) {
        out.push({
          id: `st-${now}-${taskIndex}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          completed: false
        });
      }
    } else if (raw && typeof raw === 'object') {
      const title = typeof raw.title === 'string' ? raw.title.trim() : '';
      if (!title) {
        throw new Error(`Task #${taskIndex + 1}, step #${i + 1}: step object requires a non-empty "title".`);
      }
      out.push({
        id: (typeof raw.id === 'string' && raw.id.trim()) || `st-${now}-${taskIndex}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        completed: Boolean(raw.completed)
      });
    } else {
      throw new Error(`Task #${taskIndex + 1}, step #${i + 1}: step must be a string or object.`);
    }
  }
  return out;
}

/**
 * Parse and validate an agent JSON payload or full SyncToDo backup into normalized raw sections.
 */
export function parseTaskImportPayload(rawInput) {
  let parsed = rawInput;
  if (typeof rawInput === 'string') {
    const cleaned = stripJsonCodeFences(rawInput);
    if (!cleaned) {
      throw new Error('JSON input is empty.');
    }
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }
  }

  if (Array.isArray(parsed)) {
    return {
      rawTasks: parsed,
      rawLists: [],
      defaultList: 'inbox',
      defaultInMyDay: false,
      createMissingLists: true
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import JSON must be an object with a "tasks" array, or a JSON array of task objects.');
  }

  // Unwrap `{ payload: ... }` wrapper if provided by API callers
  const root = (parsed.payload && typeof parsed.payload === 'object' && !parsed.tasks && !parsed.todos)
    ? parsed.payload
    : parsed;

  const rawTasks = Array.isArray(root.tasks)
    ? root.tasks
    : Array.isArray(root.todos)
    ? root.todos.filter(t => t && !t.deletedAt)
    : null;

  if (!rawTasks) {
    throw new Error('Import JSON must contain a "tasks" (or "todos") array.');
  }
  if (rawTasks.length === 0) {
    throw new Error('The "tasks" array is empty — provide at least one task.');
  }

  return {
    rawTasks,
    rawLists: Array.isArray(root.lists) ? root.lists : [],
    defaultList: typeof root.defaultList === 'string' && root.defaultList.trim() ? root.defaultList.trim() : 'inbox',
    defaultInMyDay: Boolean(root.defaultInMyDay),
    createMissingLists: root.createMissingLists !== false
  };
}

function getLocalTodayAndTomorrow() {
  const pad = n => String(n).padStart(2, '0');
  const d0 = new Date();
  const d1 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
  return {
    todayStr: `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`,
    tomorrowStr: `${d1.getFullYear()}-${pad(d1.getMonth() + 1)}-${pad(d1.getDate())}`
  };
}

/**
 * Convert raw import JSON into SyncToDo list & todo entities ready for local apply or server sync.
 */
export function buildImportBatch({
  rawInput,
  existingTodos = {},
  existingLists = [],
  todayStr = null,
  tomorrowStr = null,
  normalizeIconFn = null,
  topMyDayOrder = null,
  now = Date.now()
}) {
  const fallbackDates = getLocalTodayAndTomorrow();
  const effectiveToday = todayStr || fallbackDates.todayStr;
  const effectiveTomorrow = tomorrowStr || fallbackDates.tomorrowStr;
  const normIcon = normalizeIconFn || (icon => (typeof icon === 'string' && icon.trim() ? icon.trim() : '📁'));

  const { rawTasks, rawLists, defaultList, defaultInMyDay, createMissingLists } = parseTaskImportPayload(rawInput);

  const todoValues = Array.isArray(existingTodos) ? existingTodos : Object.values(existingTodos || {});
  const activeTodos = todoValues.filter(t => t && !t.deletedAt);

  // Build lookup tables for existing lists (by ID and lowercase name)
  const workingLists = existingLists.map(l => ({ ...l }));
  const listById = new Map();
  const listByName = new Map();
  let maxListOrder = -1;

  const registerList = (l) => {
    if (!l || !l.id) return;
    listById.set(l.id, l);
    if (l.name) listByName.set(l.name.trim().toLowerCase(), l);
    if (typeof l.order === 'number' && Number.isFinite(l.order)) {
      maxListOrder = Math.max(maxListOrder, l.order);
    }
  };
  workingLists.forEach(registerList);

  const createdLists = [];
  const ensureListByMeta = (nameOrId, icon = '📁', color = '#6366f1', explicitId = null) => {
    const rawKey = (nameOrId || '').trim();
    if (!rawKey) return listById.get('inbox') || workingLists[0] || { id: 'inbox', name: 'Inbox' };

    if (listById.has(rawKey)) return listById.get(rawKey);
    const byName = listByName.get(rawKey.toLowerCase());
    if (byName) return byName;

    if (!createMissingLists && !explicitId) {
      return listById.get('inbox') || workingLists[0] || { id: 'inbox', name: 'Inbox' };
    }

    maxListOrder += 1;
    const newId = explicitId || `list-${now}-${createdLists.length}-${Math.random().toString(36).slice(2, 6)}`;
    const newList = {
      id: newId,
      name: rawKey,
      icon: normIcon(icon),
      color: color || '#6366f1',
      isSystem: false,
      order: maxListOrder,
      createdAt: now,
      updatedAt: now
    };
    workingLists.push(newList);
    createdLists.push(newList);
    registerList(newList);
    return newList;
  };

  // Honor explicit list declarations included in backup/bundle payloads
  for (const rl of rawLists) {
    if (!rl || !rl.name) continue;
    if (!listById.has(rl.id) && !listByName.has(rl.name.trim().toLowerCase())) {
      ensureListByMeta(rl.name, rl.icon, rl.color, rl.id || null);
    }
  }

  // First pass: validate & normalize every task before creating anything
  const staged = rawTasks.map((raw, idx) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`Task #${idx + 1}: expected a task object.`);
    }
    const rawTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
    const hasInlineInk = Boolean(raw.isInlineHandwriting && raw.handwriting);
    if (!rawTitle && !hasInlineInk) {
      throw new Error(`Task #${idx + 1}: "title" is required and cannot be empty.`);
    }

    const rawListRef = raw.listId || raw.list || raw.listName || defaultList;
    const refLower = typeof rawListRef === 'string' ? rawListRef.trim().toLowerCase() : '';
    const isMyDayAlias = refLower === 'my day' || refLower === 'today';
    const resolvedList = isMyDayAlias
      ? ensureListByMeta(defaultList && !['my day', 'today'].includes(defaultList.trim().toLowerCase()) ? defaultList : 'inbox')
      : ensureListByMeta(rawListRef, raw.listIcon, raw.listColor);

    const priority = normalizePriority(raw.priority, idx);
    const dueDate = resolveDueDateValue(raw.dueDate, effectiveToday, effectiveTomorrow, idx);
    const dueTime = normalizeTimeValue(raw.dueTime, 'dueTime', idx);
    const reminderTime = normalizeTimeValue(raw.reminderTime, 'reminderTime', idx);
    const recurrence = normalizeRecurrence(raw.recurrence, idx);
    const recurrenceInterval = Math.max(1, parseInt(raw.recurrenceInterval, 10) || 1);
    const notes = raw.notes === undefined || raw.notes === null ? '' : String(raw.notes);
    const steps = normalizeSteps(raw.steps, now, idx);

    const inMyDay = raw.inMyDay !== undefined ? Boolean(raw.inMyDay) : (isMyDayAlias || Boolean(defaultInMyDay));
    const plannedDate = inMyDay
      ? (typeof raw.plannedDate === 'string' && raw.plannedDate ? raw.plannedDate : effectiveToday)
      : null;

    const explicitPinnedIn = Array.isArray(raw.pinnedIn) ? [...new Set(raw.pinnedIn.filter(Boolean))] : null;
    const pinned = Boolean(raw.pinned) || (explicitPinnedIn && explicitPinnedIn.length > 0);
    const pinnedIn = explicitPinnedIn && explicitPinnedIn.length > 0
      ? explicitPinnedIn
      : (pinned ? [...new Set([...(inMyDay || dueDate === effectiveToday ? ['today'] : []), resolvedList.id])] : []);

    const entersMyDay = Boolean(inMyDay || (dueDate && dueDate >= effectiveToday));

    return {
      raw,
      title: rawTitle,
      notes,
      completed: Boolean(raw.completed),
      completedAt: raw.completed ? (raw.completedAt || now) : null,
      listId: resolvedList.id,
      priority,
      dueDate,
      dueTime,
      reminderTime,
      steps,
      inMyDay,
      plannedDate,
      recurrence,
      recurrenceInterval,
      pinned,
      pinnedIn,
      pinnedAt: pinned ? (raw.pinnedAt || now) : null,
      handwriting: raw.handwriting || null,
      isInlineHandwriting: Boolean(raw.isInlineHandwriting),
      entersMyDay
    };
  });

  // Compute deterministic top order blocks preserving input array order [0, 1, 2, ...]
  const existingOrders = activeTodos.map(t => t.order).filter(o => typeof o === 'number' && Number.isFinite(o));
  const minGlobalOrder = existingOrders.length > 0 ? Math.min(...existingOrders) : 0;

  let baseMyDayTop = topMyDayOrder;
  if (typeof baseMyDayTop !== 'number') {
    const myDayOrders = activeTodos
      .filter(t => !t.completed && (t.inMyDay || t.dueDate === effectiveToday))
      .map(t => (typeof t.myDayOrder === 'number' ? t.myDayOrder : t.order))
      .filter(o => typeof o === 'number' && Number.isFinite(o));
    baseMyDayTop = myDayOrders.length > 0 ? Math.min(...myDayOrders) - 1 : 0;
  }

  const totalMyDayEntries = staged.filter(s => s.entersMyDay).length;
  let myDayCursor = 0;

  const importedTodos = staged.map((item, i) => {
    const rawId = typeof item.raw.id === 'string' && item.raw.id.trim() ? item.raw.id.trim() : null;
    const id = rawId || `todo-${now}-${i}-${Math.random().toString(36).slice(2, 7)}`;

    const order = (typeof item.raw.order === 'number' && Number.isFinite(item.raw.order))
      ? item.raw.order
      : (minGlobalOrder - staged.length + i);

    let myDayOrder = null;
    if (typeof item.raw.myDayOrder === 'number' && Number.isFinite(item.raw.myDayOrder)) {
      myDayOrder = item.raw.myDayOrder;
    } else if (item.entersMyDay) {
      myDayOrder = baseMyDayTop - totalMyDayEntries + 1 + myDayCursor;
      myDayCursor += 1;
    }

    return {
      id,
      title: item.title,
      notes: item.notes,
      completed: item.completed,
      completedAt: item.completedAt,
      listId: item.listId,
      priority: item.priority,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      reminderTime: item.reminderTime,
      steps: item.steps,
      order,
      myDayOrder,
      inMyDay: item.inMyDay,
      plannedDate: item.plannedDate,
      myDayExcludedDate: null,
      recurrence: item.recurrence,
      recurrenceInterval: item.recurrenceInterval,
      handwriting: item.handwriting,
      isInlineHandwriting: item.isInlineHandwriting,
      pinned: item.pinned,
      pinnedIn: item.pinnedIn,
      pinnedAt: item.pinnedAt,
      createdAt: item.raw.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
  });

  const targetListCounts = {};
  for (const t of importedTodos) {
    const listObj = listById.get(t.listId);
    const label = listObj ? listObj.name : t.listId;
    targetListCounts[label] = (targetListCounts[label] || 0) + 1;
  }

  return {
    createdLists,
    importedTodos,
    summary: {
      taskCount: importedTodos.length,
      createdListCount: createdLists.length,
      targetListCounts
    }
  };
}

/**
 * Generate ChatGPT / Custom GPT instructions tailored to the user's live SyncToDo lists.
 */
export function buildChatGPTInstructions(lists = []) {
  const visibleLists = Array.isArray(lists) && lists.length > 0
    ? lists.map(l => `- "${l.name}"`).join('\n')
    : '- "Inbox"\n- "Work"\n- "Personal"';

  return `You format tasks into SyncToDo import JSON.
When the user asks you to plan work, break down goals, or create tasks for SyncToDo:

1. Output ONLY a single JSON object inside a \`\`\`json code block matching this schema:
{
  "defaultList": "Inbox",
  "createMissingLists": true,
  "tasks": [
    {
      "title": "Short clear actionable title",
      "list": "List Name",
      "priority": "low" | "medium" | "high",
      "dueDate": "YYYY-MM-DD" | "today" | "tomorrow" | null,
      "dueTime": "HH:MM" | null,
      "inMyDay": true | false,
      "pinned": false,
      "recurrence": "none" | "daily" | "weekdays" | "weekly" | "monthly",
      "notes": "Optional context, links, or page numbers",
      "steps": ["Optional subtask 1", "Optional subtask 2"]
    }
  ]
}

2. Available SyncToDo lists (prefer these exact names):
${visibleLists}

3. Rules:
- Keep each "title" concise and scannable (preserve Persian or English in the user's language).
- Put multi-part actions into "steps" (as short strings) and background details into "notes".
- Omit optional fields you do not need; "title" is the only required field per task.
- Only set "inMyDay": true if the user explicitly wants tasks in Today's focus ("My Day").
- Output tasks in logical execution order (first task first).`;
}
