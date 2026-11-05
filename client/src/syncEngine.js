// Offline-First CRDT-style Delta Sync Engine

const STORAGE_KEY_TODOS = 'synctodo_items_v1';
const STORAGE_KEY_LISTS = 'synctodo_lists_v1';
const STORAGE_KEY_QUEUE = 'synctodo_mutations_queue_v1';
const STORAGE_KEY_SERVER = 'synctodo_server_url_v1';
const STORAGE_KEY_DEVICE = 'synctodo_device_info_v1';
const STORAGE_KEY_DEVICE_NAME = 'synctodo_device_name_v1';

import { P2PEngine } from './p2pEngine';
import { getLogicalDateStr, isSameLogicalDay, getStoredDayStartHour } from './utils/calendar';

export const ICON_NAME_MAP = {
  inbox: '📥',
  briefcase: '💼',
  work: '💼',
  heart: '❤️',
  personal: '❤️',
  cart: '🛒',
  shopping: '🛒',
  folder: '📁',
  star: '⭐',
  home: '🏠',
  settings: '⚙️',
  task: '📝',
  tasks: '📋',
  checklist: '📋',
  calendar: '📅',
  book: '📚',
  homework: '📚',
  notes: '📝',
  note: '📝',
  study: '🎓',
  school: '🏫',
  university: '🏛️',
  code: '💻',
  computer: '💻',
  pencil: '✏️',
  pen: '✒️',
  alert: '⚠️',
  star2: '✨',
  archive: '📦',
  fitness: '💪',
  health: '🏥',
  music: '🎵',
  idea: '💡'
};

export function normalizeListIcon(icon) {
  if (!icon) return '📁';
  const trimmed = String(icon).trim();
  const lower = trimmed.toLowerCase();
  if (ICON_NAME_MAP[lower]) return ICON_NAME_MAP[lower];
  // If it's a raw alphanumeric identifier without emoji (e.g. "custom", "list", "notes"), fallback to folder
  if (/^[a-zA-Z0-9_\-\s]+$/.test(trimmed)) {
    return '📁';
  }
  return trimmed;
}

export function hasPersianChar(text) {
  return /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');
}

export function detectBidiDirection(text) {
  if (!text) return 'ltr';
  if (!hasPersianChar(text)) return 'ltr';

  // Check if it's predominantly an English title with just a Persian date in parentheses at the end
  // e.g. "AP - ICE: Basics C++ (یکشنبه ۱۴۰۵/۰۷/۱۲)"
  const farsiCount = (text.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  const endsWithFarsiParens = /\([\u0600-\u06FF\s\d\/\.\-:]+\)\s*$/.test(text);

  if (endsWithFarsiParens && latinCount > farsiCount) {
    return 'ltr';
  }

  return 'rtl';
}

export function splitTitleForBidi(text) {
  if (!text) return { isSplit: false, text: '' };
  // Check if title ends with parenthesized Persian date / tag
  const match = text.match(/^(.*?)\s*(\([\u0600-\u06FF\s\d\/\.\-:]+\))\s*$/);
  if (match) {
    const prefix = match[1];
    const paren = match[2];
    const prefixLatin = (prefix.match(/[a-zA-Z]/g) || []).length;
    const prefixFarsi = (prefix.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    // If the prefix is predominantly Latin/English (e.g. "AP - ICE: Basics C++")
    if (prefixLatin > prefixFarsi) {
      return { isSplit: true, prefix, paren, dir: 'ltr' };
    }
  }
  return { isSplit: false, text, dir: detectBidiDirection(text) };
}

const DEFAULT_LISTS = [
  { id: 'inbox', name: 'Inbox', icon: '📥', color: '#6366f1', isSystem: true },
  { id: 'work', name: 'Work', icon: '💼', color: '#a855f7', isSystem: false },
  { id: 'personal', name: 'Personal', icon: '❤️', color: '#10b981', isSystem: false },
  { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#f59e0b', isSystem: false }
];

// Detect device form factor
export function detectDeviceType() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const userAgent = navigator.userAgent.toLowerCase();

  // 1. Android / iOS Phone User-Agent check (always phone regardless of orientation)
  if (/iphone|ipod|android.*mobile/.test(userAgent)) {
    return 'phone';
  }

  // 2. Explicit Tablet User-Agent check (iPad or Android tablet without 'mobile')
  if (/ipad|tablet|(android(?!.*mobile))/.test(userAgent)) {
    return 'tablet';
  }

  // 3. Dimension-based detection for web browsers / responsive views:
  // Shortest side (Smallest Width, SW): Phones have shortest side < 540px
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);

  if (shortestSide < 540) {
    return 'phone';
  }

  if (shortestSide >= 540 && longestSide < 1180) {
    return 'tablet';
  }

  return 'laptop';
}

export class SyncEngine {
  constructor() {
    this.deviceType = detectDeviceType();
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = this.getOrCreateDeviceName();
    this.serverUrl = this.getStoredServerUrl();
    this.status = 'DISCONNECTED'; // 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'DISCONNECTED'
    this.ws = null;
    this.reconnectTimer = null;
    this.lastSyncTimestamp = 0;
    this.listeners = new Set();
    this.onlineDevices = [];
    this.pendingCount = 0;

    // Load initial cached data
    this.todos = this.loadStoredTodos();
    this.lists = this.loadStoredLists();
    this.mutationQueue = this.loadStoredQueue();
    this.pendingCount = this.mutationQueue.length;

    // Initialize P2P LAN Mesh Engine
    this.p2pEngine = new P2PEngine(this);

    // Listen to browser online/offline events
    window.addEventListener('online', () => this.connect());
    window.addEventListener('offline', () => {
      this.status = 'OFFLINE';
      this.notify();
    });

    // Start connection
    this.connect();
    this.mirrorToLocalEmbeddedServer();
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem(STORAGE_KEY_DEVICE);
    if (!id) {
      id = `${this.deviceType}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_KEY_DEVICE, id);
    }
    return id;
  }

  getOrCreateDeviceName() {
    let name = localStorage.getItem(STORAGE_KEY_DEVICE_NAME);
    // Sanitize corrupted laptop device name on mobile devices
    if (name && (this.deviceType === 'phone' || this.deviceType === 'tablet') &&
        (name.toLowerCase().includes('laptop') || name.toLowerCase().includes('g16'))) {
      name = null;
      localStorage.removeItem(STORAGE_KEY_DEVICE_NAME);
    }
    if (!name) {
      if (this.deviceType === 'phone') name = 'Android Phone';
      else if (this.deviceType === 'tablet') name = 'Android Tablet';
      else name = 'My Laptop';
      localStorage.setItem(STORAGE_KEY_DEVICE_NAME, name);
    }
    return name;
  }

  setDeviceName(newName) {
    const clean = String(newName || '').trim();
    if (!clean) return;
    this.deviceName = clean;
    localStorage.setItem(STORAGE_KEY_DEVICE_NAME, clean);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const cleanIp = (this.p2pEngine?.myLocalIp && this.p2pEngine.myLocalIp !== 'Detecting...') ? this.p2pEngine.myLocalIp : null;
      this.ws.send(JSON.stringify({
        type: 'IDENTIFY',
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        deviceType: this.deviceType,
        localIp: cleanIp
      }));
    }
    this.notify();
  }

  getStoredServerUrl() {
    const saved = localStorage.getItem(STORAGE_KEY_SERVER);
    if (saved) return saved;

    const host = window.location.hostname || 'localhost';
    return `ws://${host}:4000`;
  }

  setServerUrl(url) {
    this.serverUrl = url;
    localStorage.setItem(STORAGE_KEY_SERVER, url);
    this.disconnect();
    this.connect();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    const p2pInfo = this.p2pEngine ? this.p2pEngine.getInfo() : { activeP2PCount: 0, peers: [] };
    listener({
      status: this.status,
      todos: Object.values(this.todos).filter(t => !t.deletedAt),
      lists: this.lists,
      onlineDevices: this.onlineDevices,
      pendingCount: this.mutationQueue.length,
      p2pInfo
    });
    return () => this.listeners.delete(listener);
  }

  notify() {
    const activeTodos = Object.values(this.todos).filter(t => !t.deletedAt);
    const p2pInfo = this.p2pEngine ? this.p2pEngine.getInfo() : { activeP2PCount: 0, peers: [] };
    this.listeners.forEach(cb => {
      try {
        cb({
          status: this.status,
          todos: activeTodos,
          lists: this.lists,
          onlineDevices: this.onlineDevices,
          pendingCount: this.mutationQueue.length,
          p2pInfo
        });
      } catch (e) {
        console.error(e);
      }
    });
  }

  notifyP2POnly() {
    this.notify();
  }

  // Keep Android's embedded LocalPeerServer store in sync with WebView localStorage
  mirrorToLocalEmbeddedServer() {
    if (this.deviceType === 'laptop') return;
    try {
      fetch('http://127.0.0.1:4567/api/p2p/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          deviceType: this.deviceType,
          todos: this.todos,
          lists: this.lists,
          mutations: this.mutationQueue,
          pairedDevices: this.p2pEngine ? Array.from(this.p2pEngine.pairedDevices.values()) : [],
          timestamp: Date.now()
        })
      }).catch(() => {});
    } catch {}
  }

  loadStoredTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TODOS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveStoredTodos() {
    try {
      localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(this.todos));
      this.mirrorToLocalEmbeddedServer();
    } catch (e) {
      console.error('Failed to persist todos locally:', e);
    }
  }

  loadStoredLists() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LISTS);
      const parsed = raw ? JSON.parse(raw) : DEFAULT_LISTS;
      const mapped = (parsed || DEFAULT_LISTS).map(l => ({
        ...l,
        icon: normalizeListIcon(l.icon)
      }));
      // Deduplicate lists by name
      const deduped = [];
      const seenNames = new Set();
      mapped.forEach(l => {
        if (l.isSystem) {
          deduped.push(l);
        } else {
          const key = (l.name || '').trim().toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            deduped.push(l);
          }
        }
      });
      return deduped;
    } catch {
      return DEFAULT_LISTS;
    }
  }

  saveStoredLists() {
    try {
      localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(this.lists));
      this.mirrorToLocalEmbeddedServer();
    } catch (e) {
      console.error('Failed to persist lists locally:', e);
    }
  }

  loadStoredQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveStoredQueue() {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.mutationQueue));
      this.pendingCount = this.mutationQueue.length;
    } catch (e) {
      console.error('Failed to persist mutation queue:', e);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  connect() {
    if (!navigator.onLine) {
      this.status = 'OFFLINE';
      this.notify();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = 'SYNCING';
    this.notify();

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.status = 'CONNECTED';

        // Extract host to look up pairing token
        let wsHost = null;
        try {
          const u = new URL(this.serverUrl);
          wsHost = u.hostname;
        } catch (_) {}
        const token = this.p2pEngine ? this.p2pEngine.getTokenForHost(wsHost) : null;

        // Identify this device & announce dynamic IP
        const cleanIp = (this.p2pEngine?.myLocalIp && this.p2pEngine.myLocalIp !== 'Detecting...') ? this.p2pEngine.myLocalIp : null;
        this.ws.send(JSON.stringify({
          type: 'IDENTIFY',
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          deviceType: this.deviceType,
          localIp: cleanIp,
          token
        }));

        // Flush queued offline mutations
        this.flushQueue();

        // Request deltas since last sync
        this.ws.send(JSON.stringify({
          type: 'SYNC_PULL',
          since: this.lastSyncTimestamp
        }));

        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('Invalid WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.status = navigator.onLine ? 'DISCONNECTED' : 'OFFLINE';
        this.notify();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Handled by onclose
      };
    } catch {
      this.status = 'DISCONNECTED';
      this.notify();
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3500);
  }

  handleServerMessage(msg) {
    if (msg.type === 'WELCOME') {
      const isLocalHost = Boolean(this.serverUrl.includes('localhost') || this.serverUrl.includes('127.0.0.1'));
      if (msg.serverInfo && this.p2pEngine) {
        this.p2pEngine.ingestDiscoveryResponse({ serverInfo: msg.serverInfo }, isLocalHost);
      }
      // Only merge data if device is confirmed paired or running locally
      if (msg.isPaired !== false) {
        if (Array.isArray(msg.todos)) {
          msg.todos.forEach(t => this.mergeTodo(t));
          this.saveStoredTodos();
        }
        if (Array.isArray(msg.lists)) {
          msg.lists.forEach(rawList => this.mergeList(rawList));
          this.saveStoredLists();
        }
        this.reconcileLocalChangesWithServer(msg.todos, msg.lists);
      }
      this.notify();
    } else if (msg.type === 'DEVICES_PRESENCE') {
      this.onlineDevices = msg.devices || [];
      if (this.p2pEngine) {
        if (Array.isArray(msg.devices)) {
          this.p2pEngine.ingestPresenceDevices(msg.devices);
        }
        if (Array.isArray(msg.pairedDevices)) {
          this.p2pEngine.ingestDiscoveryResponse({ pairedDevices: msg.pairedDevices }, true);
        }
      }
      this.notify();
    } else if (msg.type === 'PAIRING_UPDATE') {
      this.p2pEngine?.handleSignalingMessage(msg);
    } else if (msg.type === 'P2P_SIGNAL') {
      this.p2pEngine?.handleSignalingMessage(msg);
    } else if (msg.type === 'SYNC_RESPONSE') {
      if (Array.isArray(msg.deltas)) {
        msg.deltas.forEach(delta => {
          if (delta.type === 'LIST_UPSERT' && delta.data) {
            this.mergeList(delta.data);
            this.saveStoredLists();
          } else if (delta.type === 'LIST_DELETE') {
            this.lists = this.lists.filter(l => l.id !== delta.entityId);
            this.saveStoredLists();
          } else if (delta.data) {
            this.mergeTodo(delta.data);
          }
        });
        this.saveStoredTodos();
      }
      if (Array.isArray(msg.lists)) {
        msg.lists.forEach(l => this.mergeList(l));
        this.saveStoredLists();
      }
      this.lastSyncTimestamp = msg.timestamp || Date.now();
      this.notify();
    } else if (msg.type === 'SYNC_BROADCAST') {
      if (Array.isArray(msg.mutations)) {
        msg.mutations.forEach(m => {
          if (m.type === 'LIST_UPSERT' && m.data) {
            this.mergeList(m.data);
            this.saveStoredLists();
          } else if (m.type === 'LIST_DELETE') {
            this.lists = this.lists.filter(l => l.id !== m.entityId);
            this.saveStoredLists();
          } else if (m.data) {
            this.mergeTodo(m.data);
            this.saveStoredTodos();
          }
        });
      }
      this.notify();
    } else if (msg.type === 'SYNC_ACK') {
      this.status = 'CONNECTED';
      if (this.inFlightMutationIds) {
        this.mutationQueue = this.mutationQueue.filter(m => !this.inFlightMutationIds.has(m.id));
        this.inFlightMutationIds = null;
        this.saveStoredQueue();
      }
      this.notify();
    } else if (msg.type === 'SYNC_ERROR') {
      console.warn('[SyncEngine] Server reported sync error:', msg.message);
      this.inFlightMutationIds = null;
    }
  }

  mergeList(rawList) {
    if (!rawList || !rawList.id) return;
    const l = { ...rawList, icon: normalizeListIcon(rawList.icon) };
    const idx = this.lists.findIndex(existing => existing.id === l.id);
    if (idx >= 0) {
      this.lists[idx] = { ...this.lists[idx], ...l };
    } else {
      // Check if a non-system list with the same name already exists to prevent duplicates
      const nameMatchIdx = this.lists.findIndex(existing => !existing.isSystem && existing.name && existing.name.trim().toLowerCase() === l.name.trim().toLowerCase());
      if (nameMatchIdx >= 0) {
        const existing = this.lists[nameMatchIdx];
        const oldId = existing.id;
        this.lists[nameMatchIdx] = { ...existing, ...l };
        if (oldId !== l.id) {
          Object.values(this.todos).forEach(t => {
            if (t.listId === oldId) t.listId = l.id;
          });
          this.saveStoredTodos();
        }
      } else {
        this.lists.push(l);
      }
    }
  }

  mergeTodo(incoming) {
    if (!incoming || !incoming.id) return;
    const current = this.todos[incoming.id];

    // Last-Write-Wins CRDT resolution based on updatedAt
    if (!current || (incoming.updatedAt || 0) >= (current.updatedAt || 0)) {
      this.todos[incoming.id] = {
        ...current,
        ...incoming
      };
    }
  }

  // Custom Lists Management
  addList(name, icon = '📁', color = '#6366f1') {
    const trimmed = name.trim();
    const existing = this.lists.find(l => !l.isSystem && l.name && l.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }
    const now = Date.now();
    const id = `list-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const newList = {
      id,
      name: trimmed,
      icon: normalizeListIcon(icon) || '📁',
      color: color || '#6366f1',
      isSystem: false,
      createdAt: now,
      updatedAt: now
    };

    this.lists.push(newList);
    this.saveStoredLists();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'LIST_UPSERT',
      data: newList,
      timestamp: now
    });

    this.notify();
    return newList;
  }

  updateList(id, patch) {
    const idx = this.lists.findIndex(l => l.id === id);
    if (idx >= 0) {
      const now = Date.now();
      const cleanPatch = { ...patch, updatedAt: now };
      if (cleanPatch.icon) cleanPatch.icon = normalizeListIcon(cleanPatch.icon);
      this.lists[idx] = { ...this.lists[idx], ...cleanPatch };
      this.saveStoredLists();
      this.queueMutation({
        id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
        entityId: id,
        type: 'LIST_UPSERT',
        data: this.lists[idx],
        timestamp: now
      });
      this.notify();
    }
  }

  deleteList(id) {
    if (id === 'inbox') return; // Cannot delete inbox
    const now = Date.now();
    this.lists = this.lists.filter(l => l.id !== id);
    this.saveStoredLists();

    // Move orphan todos to inbox
    Object.values(this.todos).forEach(t => {
      if (t.listId === id) {
        this.updateTodo(t.id, { listId: 'inbox' });
      }
    });

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'LIST_DELETE',
      data: null,
      timestamp: now
    });

    this.notify();
  }

  // Restore deleted lists & restore moved tasks back to their original listId (for UNDO)
  restoreListsSnapshot(deletedLists = [], previousTodoListMap = {}) {
    const now = Date.now();
    deletedLists.forEach(list => {
      if (!list || !list.id) return;
      const restored = { ...list, updatedAt: now };
      this.mergeList(restored);
      this.queueMutation({
        id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
        entityId: restored.id,
        type: 'LIST_UPSERT',
        data: restored,
        timestamp: now
      });
    });
    this.saveStoredLists();

    Object.entries(previousTodoListMap).forEach(([todoId, origListId]) => {
      if (this.todos[todoId]) {
        this.updateTodo(todoId, { listId: origListId });
      }
    });

    this.notify();
  }

  // Local-First Mutations
  addTodo(title, listId = 'inbox', priority = 'medium', dueDate = null, notes = '', extra = {}) {
    const id = `todo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // Default order: place new tasks at the top
    const allOrders = Object.values(this.todos)
      .filter(t => !t.deletedAt && typeof t.order === 'number')
      .map(t => t.order);
    const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 0;
    const order = typeof extra.order === 'number' ? extra.order : (minOrder - 1);

    const todo = {
      id,
      title: title.trim(),
      notes,
      completed: false,
      completedAt: null,
      listId,
      priority,
      dueDate,
      dueTime: extra.dueTime || null,
      reminderTime: extra.reminderTime || null,
      steps: Array.isArray(extra.steps) ? extra.steps : [],
      order,
      inMyDay: extra.inMyDay || false,
      plannedDate: extra.plannedDate || null,
      recurrence: extra.recurrence || 'none', // 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'
      recurrenceInterval: extra.recurrenceInterval || 1,
      handwriting: extra.handwriting || null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      ...extra
    };

    this.todos[id] = todo;
    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'UPSERT',
      data: todo,
      timestamp: now
    });

    this.notify();
    return todo;
  }

  // Subtasks / Steps helpers
  addStep(todoId, stepTitle) {
    const todo = this.todos[todoId];
    if (!todo || !stepTitle || !stepTitle.trim()) return;
    const steps = Array.isArray(todo.steps) ? [...todo.steps] : [];
    steps.push({
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: stepTitle.trim(),
      completed: false
    });
    this.updateTodo(todoId, { steps });
  }

  toggleStep(todoId, stepId) {
    const todo = this.todos[todoId];
    if (!todo || !Array.isArray(todo.steps)) return;
    const steps = todo.steps.map(s => s.id === stepId ? { ...s, completed: !s.completed } : s);
    this.updateTodo(todoId, { steps });
  }

  deleteStep(todoId, stepId) {
    const todo = this.todos[todoId];
    if (!todo || !Array.isArray(todo.steps)) return;
    const steps = todo.steps.filter(s => s.id !== stepId);
    this.updateTodo(todoId, { steps });
  }

  reorderTodos(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
    const now = Date.now();
    orderedIds.forEach((id, index) => {
      const todo = this.todos[id];
      if (todo) {
        todo.order = index;
        todo.updatedAt = now;
        todo.version = (todo.version || 1) + 1;
        this.queueMutation({
          id: `mut-${now}-${id.slice(-5)}-${index}`,
          entityId: id,
          type: 'UPSERT',
          data: todo,
          timestamp: now
        });
      }
    });
    this.saveStoredTodos();
    this.notify();
  }

  toggleTodo(id) {
    const todo = this.todos[id];
    if (!todo) return;

    const now = Date.now();
    const willBeCompleted = !todo.completed;
    todo.completed = willBeCompleted;
    todo.completedAt = willBeCompleted ? now : null;
    todo.updatedAt = now;
    todo.version = (todo.version || 1) + 1;

    // Handle Recurring Task creation upon completion
    if (willBeCompleted && todo.recurrence && todo.recurrence !== 'none') {
      const nextDate = this.calculateNextRecurrence(
        todo.dueDate || new Date().toISOString().split('T')[0],
        todo.recurrence,
        todo.recurrenceInterval || 1
      );

      setTimeout(() => {
        this.addTodo(
          todo.title,
          todo.listId,
          todo.priority,
          nextDate,
          todo.notes || '',
          {
            recurrence: todo.recurrence,
            recurrenceInterval: todo.recurrenceInterval || 1,
            handwriting: todo.handwriting || null,
            steps: Array.isArray(todo.steps) ? todo.steps.map(s => ({ ...s, completed: false })) : [],
            inMyDay: false
          }
        );
      }, 350);
    }

    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'UPSERT',
      data: todo,
      timestamp: now
    });

    this.notify();
  }

  calculateNextRecurrence(baseDateStr, recurrence, interval = 1) {
    const d = new Date(baseDateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

    const safeInterval = Math.max(1, parseInt(interval, 10) || 1);

    if (recurrence === 'daily') {
      d.setDate(d.getDate() + safeInterval);
    } else if (recurrence === 'weekdays') {
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6);
    } else if (recurrence === 'weekly') {
      d.setDate(d.getDate() + (7 * safeInterval));
    } else if (recurrence === 'monthly') {
      d.setMonth(d.getMonth() + safeInterval);
    } else if (recurrence === 'custom') {
      d.setDate(d.getDate() + safeInterval);
    }

    return d.toISOString().split('T')[0];
  }

  carryForwardUnfinished(selectedIds = null, dayStartHour = null) {
    const startHour = typeof dayStartHour === 'number' ? dayStartHour : getStoredDayStartHour();
    const today = getLogicalDateStr(new Date(), startHour);
    const now = Date.now();
    let count = 0;
    const allowSet = Array.isArray(selectedIds) ? new Set(selectedIds) : null;

    Object.values(this.todos).forEach(t => {
      if (t.deletedAt) return;

      // Completed tasks from previous days should NEVER be carried forward,
      // and should have inMyDay reset to false so they never linger into today's My Day!
      if (t.completed) {
        if (t.inMyDay) {
          const completedToday = t.completedAt
            ? isSameLogicalDay(t.completedAt, today, startHour)
            : (t.plannedDate === today || t.dueDate === today);
          if (!completedToday) {
            t.inMyDay = false;
            t.updatedAt = now;
            this.queueMutation({
              id: `mut-${now}-${t.id.slice(-5)}-purge`,
              entityId: t.id,
              type: 'UPSERT',
              data: t,
              timestamp: now
            });
          }
        }
        return; // NEVER carry forward completed tasks!
      }

      // Active / unfinished tasks
      if (allowSet && !allowSet.has(t.id)) return;
      const isPastDue = t.dueDate && t.dueDate < today;
      const isPastMyDay = t.inMyDay && t.plannedDate && t.plannedDate < today;
      if (isPastDue || isPastMyDay || allowSet) {
        t.dueDate = today;
        t.plannedDate = today;
        t.inMyDay = true;
        t.updatedAt = now;
        this.queueMutation({
          id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
          entityId: t.id,
          type: 'UPSERT',
          data: t,
          timestamp: now
        });
        count++;
      }
    });

    if (count > 0) {
      this.saveStoredTodos();
      this.notify();
    }
    return count;
  }

  updateTodo(id, patch) {
    const todo = this.todos[id];
    if (!todo) return;

    const now = Date.now();
    Object.assign(todo, patch, {
      updatedAt: now,
      version: (todo.version || 1) + 1
    });

    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'UPSERT',
      data: todo,
      timestamp: now
    });

    this.notify();
  }

  deleteTodo(id) {
    const todo = this.todos[id];
    if (!todo) return null;

    const snapshot = JSON.parse(JSON.stringify(todo));
    const now = Date.now();
    todo.deletedAt = now;
    todo.updatedAt = now;

    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'DELETE',
      data: null,
      timestamp: now
    });

    this.notify();
    return snapshot;
  }

  // Restore a deleted or modified todo snapshot (for UNDO toast)
  restoreTodoSnapshot(snapshot) {
    if (!snapshot || !snapshot.id) return;
    const now = Date.now();
    const restored = {
      ...snapshot,
      deletedAt: null,
      updatedAt: now,
      version: (snapshot.version || 1) + 1
    };
    this.todos[restored.id] = restored;
    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: restored.id,
      type: 'UPSERT',
      data: restored,
      timestamp: now
    });

    this.notify();
  }

  queueMutation(mutation) {
    this.mutationQueue.push(mutation);
    this.saveStoredQueue();

    // Broadcast immediately to direct P2P mesh
    this.p2pEngine?.broadcastMutationToPeers(mutation);

    // Send to central server if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.flushQueue();
    }
  }

  flushQueue() {
    if (this.mutationQueue.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const toSend = [...this.mutationQueue];
    this.inFlightMutationIds = new Set(toSend.map(m => m.id));
    this.ws.send(JSON.stringify({
      type: 'SYNC_PUSH',
      deviceId: this.deviceId,
      mutations: toSend
    }));

    this.notify();
  }

  reconcileLocalChangesWithServer(serverTodos, serverLists) {
    if (!this.isPaired || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const serverMap = new Map();
    if (Array.isArray(serverTodos)) {
      serverTodos.forEach(t => {
        if (t && t.id) serverMap.set(t.id, t);
      });
    }

    const mutations = [];
    const now = Date.now();

    // Check for local todos that are either not on server or newer than server version
    Object.values(this.todos).forEach(localTodo => {
      if (!localTodo || !localTodo.id) return;
      const srv = serverMap.get(localTodo.id);
      if (!srv || (localTodo.updatedAt || 0) > (srv.updatedAt || 0)) {
        mutations.push({
          id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'UPSERT',
          data: localTodo,
          timestamp: localTodo.updatedAt || now
        });
      }
    });

    // Check for custom lists
    if (Array.isArray(serverLists)) {
      const serverListMap = new Map();
      serverLists.forEach(l => {
        if (l && l.id) serverListMap.set(l.id, l);
      });
      this.lists.forEach(localList => {
        if (!localList || !localList.id || localList.isSystem) return;
        const srv = serverListMap.get(localList.id);
        if (!srv || (localList.updatedAt || 0) > (srv.updatedAt || 0)) {
          mutations.push({
            id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
            type: 'LIST_UPSERT',
            data: localList,
            timestamp: localList.updatedAt || now
          });
        }
      });
    }

    if (mutations.length > 0) {
      mutations.forEach(m => this.mutationQueue.push(m));
      this.saveStoredQueue();
      this.flushQueue();
    }
  }
}

export const syncEngine = new SyncEngine();
