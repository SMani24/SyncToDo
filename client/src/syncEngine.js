// Offline-First CRDT-style Delta Sync Engine

const STORAGE_KEY_TODOS = 'synctodo_items_v1';
const STORAGE_KEY_LISTS = 'synctodo_lists_v1';
const STORAGE_KEY_QUEUE = 'synctodo_mutations_queue_v1';
const STORAGE_KEY_SERVER = 'synctodo_server_url_v1';
const STORAGE_KEY_DEVICE = 'synctodo_device_info_v1';
const STORAGE_KEY_DEVICE_NAME = 'synctodo_device_name_v1';

import { P2PEngine } from './p2pEngine';
import { getLogicalDateStr, isSameLogicalDay, getStoredDayStartHour } from './utils/calendar';
import { buildImportBatch } from '../../shared/taskImport.js';

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

  // 3. Touch-primary devices without explicit mobile/tablet UA (e.g. responsive mobile testers or Android webviews)
  const isCoarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (isCoarsePointer) {
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    if (shortestSide < 540) return 'phone';
    if (longestSide < 1180) return 'tablet';
    return 'laptop';
  }

  // 4. Desktop/laptop browser windows: stay 'laptop' across normal & resized desktop shapes
  // (including short or half-screen windows), only falling back to compact 'phone' chrome at sliver widths.
  if (width < 460) {
    return 'phone';
  }

  return 'laptop';
}

export function isTodoInMyDay(todo, todayStr) {
  if (!todo) return false;
  const plannedToday = Boolean(todo.inMyDay) && (!todo.plannedDate || todo.plannedDate === todayStr);
  const dueTodayOrOverdue = Boolean(todo.dueDate && todo.dueDate <= todayStr && todo.myDayExcludedDate !== todayStr);
  return plannedToday || dueTodayOrOverdue;
}

export function isTodoLeftoverFromEarlier(todo, todayStr) {
  if (!todo || todo.completed || todo.deletedAt) return false;
  if (isTodoInMyDay(todo, todayStr)) return false;
  if (todo.myDayExcludedDate === todayStr) return false;
  return Boolean(todo.inMyDay && todo.plannedDate && todo.plannedDate < todayStr);
}

export function isTodoPinnedInContext(todo, context = 'today') {
  if (!todo) return false;
  if (Array.isArray(todo.pinnedIn) && todo.pinnedIn.length > 0) {
    return todo.pinnedIn.includes(context);
  }
  if (todo.pinned) {
    if (context === 'today' && todo.inMyDay) return true;
    if (todo.listId && context === todo.listId) return true;
    if (context === 'all') return true;
  }
  return false;
}

export function getEffectivePinnedIn(todo) {
  if (!todo) return [];
  if (Array.isArray(todo.pinnedIn) && todo.pinnedIn.length > 0) {
    return [...new Set(todo.pinnedIn)];
  }
  if (todo.pinned) {
    const inferred = [];
    if (todo.inMyDay) inferred.push('today');
    if (todo.listId) inferred.push(todo.listId);
    return inferred.length > 0 ? [...new Set(inferred)] : ['today'];
  }
  return [];
}

export class SyncEngine {
  constructor() {
    this.deviceType = detectDeviceType();
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = this.getOrCreateDeviceName();
    this.serverUrl = this.getStoredServerUrl();
    this.status = 'DISCONNECTED'; // 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'DISCONNECTED'
    this.isPaired = false;
    this.ws = null;
    this.reconnectTimer = null;
    this.lastSyncTimestamp = 0;
    this.listeners = new Set();
    this.onlineDevices = [];
    this.pendingCount = 0;

    // Load initial cached data
    this.todos = this.loadStoredTodos();
    this.lists = this.loadStoredLists();
    this.deletedLists = this.loadDeletedLists();
    this.mutationQueue = this.loadStoredQueue();
    this.pendingCount = this.mutationQueue.length;
    this.inFlightMutationIds = null;
    this.pendingFlushAfterAck = false;
    this._isMirroringLocal = false;

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
    // 1. If running in a web browser (not Capacitor native app):
    // ALWAYS use the host where the webpage is served from!
    // E.g., if loaded from http://localhost:4000 -> ws://localhost:4000
    // E.g., if loaded from http://g16laptop.local:4000 -> ws://g16laptop.local:4000
    // E.g., if loaded from http://172.18.132.75:4000 -> ws://172.18.132.75:4000
    const isCapacitorNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
    if (!isCapacitorNative && typeof window !== 'undefined' && window.location.protocol && window.location.protocol.startsWith('http')) {
      const host = window.location.hostname;
      const rawPort = window.location.port;
      const port = rawPort || '4000';
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `${wsProto}//${host}:${port}`;
      }
      if (rawPort && rawPort !== '5173') {
        return `${wsProto}//${host || 'localhost'}:${rawPort}`;
      }
      if (this.deviceType === 'laptop') {
        return `ws://localhost:4000`;
      }
    }

    // 2. On Mobile (Capacitor Android Phone or Tablet):
    const saved = localStorage.getItem(STORAGE_KEY_SERVER);
    if (saved && !saved.includes('localhost') && !saved.includes('127.0.0.1')) {
      return saved;
    }

    // 3. Fallback to paired laptop IP if available
    try {
      const pairedRaw = localStorage.getItem('synctodo_paired_devices_v2') || localStorage.getItem('synctodo_paired_devices_v1');
      if (pairedRaw) {
        const list = JSON.parse(pairedRaw);
        const laptop = Array.isArray(list)
          ? list.find(d => d.deviceType === 'laptop' || d.port === 4000 || (d.ip && d.ip !== 'localhost' && d.ip !== '127.0.0.1'))
          : null;
        if (laptop && laptop.ip) {
          return `ws://${laptop.ip}:${laptop.port || 4000}`;
        }
      }
    } catch (_) {}

    // 4. Default for mobile discovery
    return 'ws://g16laptop.local:4000';
  }

  nextTimestamp(entity = null) {
    const prev = entity && typeof entity.updatedAt === 'number' ? entity.updatedAt : 0;
    return Math.max(Date.now(), prev + 1);
  }

  loadDeletedLists() {
    try {
      const raw = localStorage.getItem('synctodo_deleted_lists_v1');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  saveDeletedLists() {
    try {
      localStorage.setItem('synctodo_deleted_lists_v1', JSON.stringify(this.deletedLists || {}));
    } catch {}
  }

  applyDeletedLists(deletedMap) {
    if (!deletedMap || typeof deletedMap !== 'object') return false;
    let changed = false;
    Object.entries(deletedMap).forEach(([listId, delTs]) => {
      if (!listId || listId === 'inbox' || typeof delTs !== 'number') return;
      if (!this.deletedLists[listId] || delTs > this.deletedLists[listId]) {
        this.deletedLists[listId] = delTs;
        changed = true;
      }
      const existing = this.lists.find(l => l.id === listId);
      if (existing && delTs >= (existing.updatedAt || existing.createdAt || 0)) {
        this.lists = this.lists.filter(l => l.id !== listId);
        changed = true;
      }
    });
    if (changed) {
      this.saveDeletedLists();
    }
    return changed;
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
  // and pull any tasks pushed directly to LocalPeerServer by LAN peers
  mirrorToLocalEmbeddedServer() {
    if (this.deviceType === 'laptop' || this._isMirroringLocal) return;
    this._isMirroringLocal = true;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      fetch('http://127.0.0.1:4567/api/p2p/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          deviceType: this.deviceType,
          todos: this.todos,
          lists: this.lists,
          deletedLists: this.deletedLists,
          mutations: this.mutationQueue,
          pairedDevices: this.p2pEngine ? Array.from(this.p2pEngine.pairedDevices.values()) : [],
          timestamp: Date.now()
        })
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!data) return;
          let changed = false;
          if (data.deletedLists) {
            if (this.applyDeletedLists(data.deletedLists)) changed = true;
          }
          const incomingTodos = Array.isArray(data.todos)
            ? data.todos
            : (data.todos && typeof data.todos === 'object' ? Object.values(data.todos) : []);
          incomingTodos.forEach(t => {
            if (!t || !t.id) return;
            const cur = this.todos[t.id];
            if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) {
              this.mergeTodo(t);
              changed = true;
            }
          });
          if (Array.isArray(data.lists)) {
            data.lists.forEach(l => {
              if (!l || !l.id) return;
              const cur = this.lists.find(x => x.id === l.id);
              const inUpd = l.updatedAt || l.createdAt || 0;
              const curUpd = cur ? (cur.updatedAt || cur.createdAt || 0) : -1;
              if (!cur || inUpd > curUpd) {
                this.mergeList(l);
                changed = true;
              }
            });
          }
          if (changed) {
            try {
              localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(this.todos));
              localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(this.lists));
            } catch {}
            this.notify();
          }
        })
        .catch(() => {})
        .finally(() => {
          clearTimeout(tid);
          this._isMirroringLocal = false;
        });
    } catch {
      this._isMirroringLocal = false;
    }
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

  scheduleSaveStoredTodos() {
    if (this._saveTodosTimer) return;
    this._saveTodosTimer = setTimeout(() => {
      this._saveTodosTimer = null;
      this.saveStoredTodos();
    }, 60);
  }

  sortListsArray(lists) {
    return [...lists].sort((a, b) => {
      const hasOrderA = typeof a.order === 'number';
      const hasOrderB = typeof b.order === 'number';
      if (hasOrderA && hasOrderB) return a.order - b.order;
      if (hasOrderA) return -1;
      if (hasOrderB) return 1;
      return 0;
    });
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
      return this.sortListsArray(deduped);
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

  scheduleSaveStoredLists() {
    if (this._saveListsTimer) return;
    this._saveListsTimer = setTimeout(() => {
      this._saveListsTimer = null;
      this.saveStoredLists();
    }, 60);
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
      if (this.mutationQueue.length > 5000) {
        this.mutationQueue = this.mutationQueue.slice(-5000);
      }
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.mutationQueue));
      this.pendingCount = this.mutationQueue.length;
    } catch (e) {
      console.error('Failed to persist mutation queue:', e);
    }
  }

  scheduleSaveStoredQueue() {
    if (this._saveQueueTimer) return;
    this._saveQueueTimer = setTimeout(() => {
      this._saveQueueTimer = null;
      this.saveStoredQueue();
    }, 60);
  }

  disconnect() {
    this.inFlightMutationIds = null;
    this.pendingFlushAfterAck = false;
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
        this.inFlightMutationIds = null;
        this.pendingFlushAfterAck = false;
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
      // Re-evaluate stored server URL on mobile in case laptop IP changed!
      if (this.deviceType !== 'laptop') {
        const freshUrl = this.getStoredServerUrl();
        if (freshUrl && freshUrl !== this.serverUrl) {
          this.serverUrl = freshUrl;
        }
      }
      this.connect();
    }, 3500);
  }

  handleServerMessage(msg) {
    if (msg.type === 'WELCOME') {
      const isLocalHost = Boolean(this.serverUrl.includes('localhost') || this.serverUrl.includes('127.0.0.1'));
      this.isPaired = msg.isPaired !== false;
      if (msg.serverInfo && this.p2pEngine) {
        this.p2pEngine.ingestDiscoveryResponse({ serverInfo: msg.serverInfo }, isLocalHost);
      }
      // Only merge data if device is confirmed paired or running locally
      if (msg.isPaired !== false) {
        if (msg.deletedLists) {
          this.applyDeletedLists(msg.deletedLists);
        }
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
          this.p2pEngine.ingestDiscoveryResponse({ pairedDevices: msg.pairedDevices }, this.deviceType === 'laptop');
        }
      }
      this.notify();
    } else if (msg.type === 'PAIRING_UPDATE') {
      this.p2pEngine?.handleSignalingMessage(msg);
    } else if (msg.type === 'P2P_SIGNAL') {
      this.p2pEngine?.handleSignalingMessage(msg);
    } else if (msg.type === 'SYNC_RESPONSE') {
      const isLocalHost = Boolean(this.serverUrl && (this.serverUrl.includes('localhost') || this.serverUrl.includes('127.0.0.1')));
      if (!this.isPaired && !isLocalHost) return;
      if (msg.deletedLists) {
        this.applyDeletedLists(msg.deletedLists);
      }
      // Merge full todos state if provided by server
      if (Array.isArray(msg.todos)) {
        msg.todos.forEach(t => this.mergeTodo(t));
        this.saveStoredTodos();
      }
      if (Array.isArray(msg.deltas)) {
        msg.deltas.forEach(delta => {
          if (delta.type === 'LIST_UPSERT' && delta.data) {
            this.mergeList(delta.data);
            this.saveStoredLists();
          } else if (delta.type === 'LIST_DELETE') {
            this.applyDeletedLists({ [delta.entityId]: delta.timestamp || Date.now() });
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
        let todosChanged = false;
        let listsChanged = false;
        msg.mutations.forEach(m => {
          if (m.type === 'LIST_UPSERT' && m.data) {
            this.mergeList(m.data);
            listsChanged = true;
          } else if (m.type === 'LIST_DELETE') {
            this.applyDeletedLists({ [m.entityId]: m.timestamp || Date.now() });
            listsChanged = true;
          } else if (m.data) {
            this.mergeTodo(m.data);
            todosChanged = true;
          }
        });
        if (listsChanged) this.scheduleSaveStoredLists();
        if (todosChanged) this.scheduleSaveStoredTodos();
      }
      this.notify();
    } else if (msg.type === 'SYNC_ACK') {
      this.status = 'CONNECTED';
      this.isPaired = true;
      if (this.inFlightMutationIds) {
        this.mutationQueue = this.mutationQueue.filter(m => !this.inFlightMutationIds.has(m.id));
        this.inFlightMutationIds = null;
        this.saveStoredQueue();
      }
      this.notify();
      if (this.pendingFlushAfterAck || this.mutationQueue.length > 0) {
        this.pendingFlushAfterAck = false;
        this.flushQueue();
      }
    } else if (msg.type === 'SYNC_ERROR') {
      console.warn('[SyncEngine] Server reported sync error:', msg.message);
      this.inFlightMutationIds = null;
      this.pendingFlushAfterAck = false;
    }
  }

  mergeList(rawList) {
    if (!rawList || !rawList.id) return;
    const l = { ...rawList, icon: normalizeListIcon(rawList.icon) };
    const inUpd = l.updatedAt || l.createdAt || 0;
    const deletedTs = this.deletedLists?.[l.id] || 0;
    if (l.deletedAt || (deletedTs && deletedTs >= inUpd)) {
      const effectiveDel = Math.max(l.deletedAt || 0, deletedTs);
      if (effectiveDel) this.applyDeletedLists({ [l.id]: effectiveDel });
      return;
    }
    if (deletedTs && inUpd > deletedTs) {
      delete this.deletedLists[l.id];
      this.saveDeletedLists();
    }

    const idx = this.lists.findIndex(existing => existing.id === l.id);
    if (idx >= 0) {
      const curUpd = this.lists[idx].updatedAt || this.lists[idx].createdAt || 0;
      if (inUpd >= curUpd) {
        this.lists[idx] = { ...this.lists[idx], ...l };
      }
    } else {
      // Check if a non-system list with the same name already exists to prevent duplicates
      const incomingName = typeof l.name === 'string' ? l.name.trim().toLowerCase() : '';
      const nameMatchIdx = incomingName
        ? this.lists.findIndex(existing => !existing.isSystem && typeof existing.name === 'string' && existing.name.trim().toLowerCase() === incomingName)
        : -1;
      if (nameMatchIdx >= 0) {
        const existing = this.lists[nameMatchIdx];
        const curUpd = existing.updatedAt || existing.createdAt || 0;
        if (inUpd >= curUpd) {
          const oldId = existing.id;
          this.lists[nameMatchIdx] = { ...existing, ...l };
          if (oldId !== l.id) {
            Object.values(this.todos).forEach(t => {
              if (t.listId === oldId) t.listId = l.id;
            });
            this.saveStoredTodos();
          }
        }
      } else {
        this.lists.push(l);
      }
    }
    this.lists = this.sortListsArray(this.lists);
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
    } else {
      // Intent preservation: if incoming has inMyDay for today, preserve it unless deleted or explicitly excluded today!
      const today = getLogicalDateStr(new Date(), getStoredDayStartHour());
      if (
        incoming.inMyDay &&
        !incoming.deletedAt &&
        !current.deletedAt &&
        (incoming.plannedDate === today || (incoming.dueDate && incoming.dueDate <= today)) &&
        !current.completed &&
        current.myDayExcludedDate !== today
      ) {
        if (!current.inMyDay || current.plannedDate !== today) {
          current.inMyDay = true;
          current.plannedDate = incoming.plannedDate || today;
          current.myDayExcludedDate = null;
          if (typeof incoming.myDayOrder === 'number' && typeof current.myDayOrder !== 'number') {
            current.myDayOrder = incoming.myDayOrder;
          }
          current.updatedAt = Math.max(current.updatedAt || 0, incoming.updatedAt || 0) + 1;
        }
      }
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
      const now = this.nextTimestamp(this.lists[idx]);
      const cleanPatch = { ...patch, updatedAt: now };
      if (cleanPatch.icon) cleanPatch.icon = normalizeListIcon(cleanPatch.icon);
      this.lists[idx] = { ...this.lists[idx], ...cleanPatch };
      this.saveStoredLists();
      this.queueMutation({
        id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
        entityId: id,
        type: 'LIST_UPSERT',
        data: { ...this.lists[idx] },
        timestamp: now
      });
      this.notify();
    }
  }

  deleteList(id) {
    if (id === 'inbox') return; // Cannot delete inbox
    const existingList = this.lists.find(l => l.id === id);
    const now = this.nextTimestamp(existingList);
    this.deletedLists[id] = now;
    this.saveDeletedLists();
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
    deletedLists.forEach(list => {
      if (!list || !list.id) return;
      const prevTs = Math.max(list.updatedAt || 0, this.deletedLists[list.id] || 0);
      const ts = Math.max(Date.now(), prevTs + 1);
      delete this.deletedLists[list.id];
      const restored = { ...list, deletedAt: null, updatedAt: ts };
      this.mergeList(restored);
      this.queueMutation({
        id: `mut-${ts}-${Math.random().toString(36).substring(2, 7)}`,
        entityId: restored.id,
        type: 'LIST_UPSERT',
        data: { ...restored },
        timestamp: ts
      });
    });
    this.saveDeletedLists();
    this.saveStoredLists();

    Object.entries(previousTodoListMap).forEach(([todoId, origListId]) => {
      if (this.todos[todoId]) {
        this.updateTodo(todoId, { listId: origListId });
      }
    });

    this.notify();
  }

  getTopMyDayOrder(todayStr = null) {
    const today = todayStr || getLogicalDateStr(new Date(), getStoredDayStartHour());
    const myDayActive = Object.values(this.todos).filter(t =>
      !t.deletedAt && !t.completed && isTodoInMyDay(t, today)
    );
    const unpinnedOrders = myDayActive
      .filter(t => !isTodoPinnedInContext(t, 'today'))
      .map(t => (typeof t.myDayOrder === 'number' ? t.myDayOrder : t.order))
      .filter(o => typeof o === 'number' && Number.isFinite(o));
    if (unpinnedOrders.length > 0) {
      return Math.min(...unpinnedOrders) - 1;
    }
    const allOrders = myDayActive
      .map(t => (typeof t.myDayOrder === 'number' ? t.myDayOrder : t.order))
      .filter(o => typeof o === 'number' && Number.isFinite(o));
    return allOrders.length > 0 ? Math.min(...allOrders) - 1 : 0;
  }

  // Local-First Mutations
  addTodo(title, listId = 'inbox', priority = 'medium', dueDate = null, notes = '', extra = {}) {
    const id = `todo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const todayStr = getLogicalDateStr(new Date(), getStoredDayStartHour());

    // Default order: place new tasks at the top
    const allOrders = Object.values(this.todos)
      .filter(t => !t.deletedAt && typeof t.order === 'number')
      .map(t => t.order);
    const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 0;
    const order = typeof extra.order === 'number' ? extra.order : (minOrder - 1);
    const myDayOrder = typeof extra.myDayOrder === 'number'
      ? extra.myDayOrder
      : (extra.inMyDay || Boolean(dueDate) ? this.getTopMyDayOrder(todayStr) : null);

    const normalizedPinnedIn = Array.isArray(extra.pinnedIn) && extra.pinnedIn.length > 0
      ? [...new Set(extra.pinnedIn)]
      : (extra.pinned ? [...new Set([...(extra.inMyDay ? ['today'] : []), ...(listId ? [listId] : ['today'])])] : []);
    const normalizedPinned = Boolean(extra.pinned) || normalizedPinnedIn.length > 0;

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
      myDayOrder,
      inMyDay: extra.inMyDay || false,
      plannedDate: extra.plannedDate || null,
      myDayExcludedDate: extra.myDayExcludedDate || null,
      recurrence: extra.recurrence || 'none', // 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'
      recurrenceInterval: extra.recurrenceInterval || 1,
      handwriting: extra.handwriting || null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      ...extra,
      pinned: normalizedPinned,
      pinnedIn: normalizedPinnedIn,
      pinnedAt: extra.pinnedAt || (normalizedPinned ? now : null)
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

  reorderTodos(orderedIds, options = {}) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
    const { preserveSlots = false, field = 'order' } = options;
    const now = Date.now();
    const newMutations = [];
    let hasChanges = false;
    const getSlotValue = (t) => {
      if (!t) return undefined;
      if (field === 'myDayOrder') {
        return typeof t.myDayOrder === 'number' ? t.myDayOrder : t.order;
      }
      return t[field];
    };

    let targetOrders = null;
    if (preserveSlots) {
      const existingNumeric = orderedIds
        .map(id => getSlotValue(this.todos[id]))
        .filter(o => typeof o === 'number' && Number.isFinite(o))
        .sort((a, b) => a - b);
      // Deduplicate/ensure strictly increasing slots when any existing items collide or lack numeric order
      targetOrders = [];
      let nextFallback = existingNumeric.length > 0 ? existingNumeric[existingNumeric.length - 1] + 1 : 0;
      for (let i = 0; i < orderedIds.length; i++) {
        let candidate = i < existingNumeric.length ? existingNumeric[i] : nextFallback++;
        if (targetOrders.length > 0 && candidate <= targetOrders[targetOrders.length - 1]) {
          candidate = targetOrders[targetOrders.length - 1] + 1;
        }
        targetOrders.push(candidate);
      }
    }

    orderedIds.forEach((id, index) => {
      const todo = this.todos[id];
      const nextOrder = targetOrders ? targetOrders[index] : index;
      if (todo && todo[field] !== nextOrder) {
        const ts = this.nextTimestamp(todo);
        todo[field] = nextOrder;
        todo.updatedAt = ts;
        todo.version = (todo.version || 1) + 1;
        hasChanges = true;
        newMutations.push({
          id: `mut-${ts}-${id.slice(-5)}-${index}`,
          entityId: id,
          type: 'UPSERT',
          data: { ...todo },
          timestamp: ts
        });
      }
    });

    if (!hasChanges) return;

    // Immediately notify React UI so task positions settle in 0ms without waiting for disk I/O!
    this.notify();

    this.scheduleSaveStoredTodos();
    this.enqueueMutations(newMutations, { saveImmediate: false, flush: true });
  }

  reorderLists(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
    let hasChanges = false;
    const newMutations = [];

    this.lists = this.lists
      .map((l, idx) => {
        const newOrder = orderMap.has(l.id) ? orderMap.get(l.id) : (orderedIds.length + idx);
        if (l.order !== newOrder) {
          hasChanges = true;
          const ts = this.nextTimestamp(l);
          const updated = { ...l, order: newOrder, updatedAt: ts };
          newMutations.push({
            id: `mut-${ts}-list-${l.id.slice(-5)}-${newOrder}`,
            entityId: l.id,
            type: 'LIST_UPSERT',
            data: { ...updated },
            timestamp: ts
          });
          return updated;
        }
        return l;
      })
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

    if (!hasChanges) return;

    this.notify();
    this.scheduleSaveStoredLists();
    this.enqueueMutations(newMutations, { saveImmediate: false, flush: true });
  }

  toggleTodo(id) {
    const todo = this.todos[id];
    if (!todo) return { spawnedTodoId: null };

    const now = this.nextTimestamp(todo);
    const willBeCompleted = !todo.completed;
    todo.completed = willBeCompleted;
    todo.completedAt = willBeCompleted ? now : null;
    todo.updatedAt = now;
    todo.version = (todo.version || 1) + 1;

    let spawnedTodoId = null;

    // Handle Recurring Task creation synchronously & idempotently upon completion
    if (willBeCompleted && todo.recurrence && todo.recurrence !== 'none' && !todo.recurrenceSpawned) {
      const todayStr = getLogicalDateStr(new Date(), getStoredDayStartHour());
      const baseDate = (todo.recurrence === 'daily' && (!todo.dueDate || todo.dueDate < todayStr))
        ? todayStr
        : (todo.dueDate || todayStr);
      const nextDate = this.calculateNextRecurrence(
        baseDate,
        todo.recurrence,
        todo.recurrenceInterval || 1
      );
      const nextPinnedIn = getEffectivePinnedIn(todo);
      const nextPinned = nextPinnedIn.length > 0;
      const preservedMyDayOrder = nextPinnedIn.includes('today')
        ? (typeof todo.myDayOrder === 'number'
            ? todo.myDayOrder
            : (typeof todo.order === 'number' ? todo.order : null))
        : null;
      const preservedListOrder = (nextPinned && typeof todo.order === 'number')
        ? todo.order
        : undefined;

      const spawned = this.addTodo(
        todo.title,
        todo.listId,
        todo.priority,
        nextDate,
        todo.notes || '',
        {
          dueTime: todo.dueTime || null,
          reminderTime: todo.reminderTime || null,
          recurrence: todo.recurrence,
          recurrenceInterval: todo.recurrenceInterval || 1,
          handwriting: todo.handwriting || null,
          isInlineHandwriting: Boolean(todo.isInlineHandwriting),
          steps: Array.isArray(todo.steps) ? todo.steps.map(s => ({ ...s, completed: false })) : [],
          inMyDay: false,
          plannedDate: null,
          pinned: nextPinned,
          pinnedIn: nextPinnedIn,
          pinnedAt: nextPinned ? (todo.pinnedAt || now) : null,
          ...(preservedMyDayOrder !== null ? { myDayOrder: preservedMyDayOrder } : {}),
          ...(preservedListOrder !== undefined ? { order: preservedListOrder } : {})
        }
      );
      if (spawned && spawned.id) {
        todo.recurrenceSpawned = true;
        todo.spawnedRecurrenceId = spawned.id;
        spawnedTodoId = spawned.id;
      }
    }

    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'UPSERT',
      data: { ...todo },
      timestamp: now
    });

    this.notify();
    return { spawnedTodoId };
  }

  togglePinTodo(id, context = 'today') {
    const todo = this.todos[id];
    if (!todo) return false;
    const currentPinnedIn = getEffectivePinnedIn(todo);

    const isPinnedInCtx = currentPinnedIn.includes(context);
    const nextPinnedIn = isPinnedInCtx
      ? currentPinnedIn.filter(c => c !== context)
      : [...currentPinnedIn, context];
    const isAnyPinned = nextPinnedIn.length > 0;

    this.updateTodo(id, {
      pinnedIn: nextPinnedIn,
      pinned: isAnyPinned,
      pinnedAt: isAnyPinned ? (todo.pinnedAt || Date.now()) : null
    });
    return !isPinnedInCtx;
  }

  // Force a complete bidirectional sync across WebSocket and all known P2P peers
  async forceSync(peerIpOrHost = null) {
    this.status = 'SYNCING';
    this.notify();

    let wsSucceeded = false;
    let peerSucceeded = false;

    // 1. Flush local queue and pull full state from WebSocket server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.flushQueue();
      this.ws.send(JSON.stringify({
        type: 'SYNC_PULL',
        since: 0
      }));
      wsSucceeded = true;
    } else {
      this.connect();
    }

    // 2. Direct P2P sync with targeted peer or all mesh peers
    if (this.p2pEngine) {
      if (peerIpOrHost) {
        peerSucceeded = await this.p2pEngine.syncWithPeer(peerIpOrHost);
      } else {
        const results = await this.p2pEngine.syncAllPeers();
        peerSucceeded = Array.isArray(results) && results.some(r => r === true);
      }
    }

    const overallSuccess = wsSucceeded || peerSucceeded;
    this.status = overallSuccess ? 'CONNECTED' : (navigator.onLine ? 'DISCONNECTED' : 'OFFLINE');
    this.notify();
    return overallSuccess;
  }

  calculateNextRecurrence(baseDateStr, recurrence, interval = 1) {
    const pad = n => String(n).padStart(2, '0');
    const d = new Date(baseDateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return getLogicalDateStr(new Date(), getStoredDayStartHour());

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
      const origDay = d.getDate();
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth() + safeInterval;
      const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      d.setFullYear(targetYear, targetMonth, Math.min(origDay, maxDay));
    } else if (recurrence === 'custom') {
      d.setDate(d.getDate() + safeInterval);
    }

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  carryForwardUnfinished(selectedIds = null, dayStartHour = null, options = {}) {
    const startHour = typeof dayStartHour === 'number' ? dayStartHour : getStoredDayStartHour();
    const today = getLogicalDateStr(new Date(), startHour);
    const now = Date.now();
    let count = 0;
    const allowSet = Array.isArray(selectedIds) ? new Set(selectedIds) : null;
    const dismissUnselected = Boolean(options && options.dismissUnselected);
    const newMutations = [];

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
            t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1000);
            t.version = (t.version || 1) + 1;
            newMutations.push({
              id: `mut-${now}-${t.id.slice(-5)}-purge`,
              entityId: t.id,
              type: 'UPSERT',
              data: { ...t },
              timestamp: t.updatedAt
            });
          }
        }
        return; // NEVER carry forward completed tasks!
      }

      // Active / unfinished tasks
      if (allowSet && !allowSet.has(t.id)) {
        if (dismissUnselected && isTodoLeftoverFromEarlier(t, today)) {
          t.inMyDay = false;
          t.plannedDate = null;
          t.myDayOrder = null;
          t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1000);
          t.version = (t.version || 1) + 1;
          newMutations.push({
            id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
            entityId: t.id,
            type: 'UPSERT',
            data: { ...t },
            timestamp: t.updatedAt
          });
        }
        return;
      }
      if (isTodoInMyDay(t, today)) return; // Already in today's focus!
      if (isTodoLeftoverFromEarlier(t, today) || allowSet) {
        // Compute destination My Day slot before marking inMyDay so task's own home-list order cannot distort it
        const nextMyDayOrder = this.getTopMyDayOrder(today);
        t.plannedDate = today;
        t.inMyDay = true;
        t.myDayExcludedDate = null;
        t.myDayOrder = nextMyDayOrder;
        // Bump updatedAt so it wins CRDT Last-Write-Wins across devices even with minor clock skew
        t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1000);
        t.version = (t.version || 1) + 1;
        newMutations.push({
          id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
          entityId: t.id,
          type: 'UPSERT',
          data: { ...t },
          timestamp: t.updatedAt
        });
        count++;
      }
    });

    if (count > 0 || newMutations.length > 0) {
      this.scheduleSaveStoredTodos();
      this.enqueueMutations(newMutations, { saveImmediate: false, flush: true });
      this.notify();
    }
    return count;
  }

  dismissLeftovers(dayStartHour = null) {
    const startHour = typeof dayStartHour === 'number' ? dayStartHour : getStoredDayStartHour();
    const today = getLogicalDateStr(new Date(), startHour);
    const now = Date.now();
    let count = 0;
    const newMutations = [];

    Object.values(this.todos).forEach(t => {
      if (t.deletedAt) return;

      if (t.completed) {
        if (t.inMyDay) {
          const completedToday = t.completedAt
            ? isSameLogicalDay(t.completedAt, today, startHour)
            : (t.plannedDate === today || t.dueDate === today);
          if (!completedToday) {
            t.inMyDay = false;
            t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1000);
            t.version = (t.version || 1) + 1;
            newMutations.push({
              id: `mut-${now}-${t.id.slice(-5)}-purge`,
              entityId: t.id,
              type: 'UPSERT',
              data: { ...t },
              timestamp: t.updatedAt
            });
          }
        }
        return;
      }

      if (isTodoLeftoverFromEarlier(t, today)) {
        t.inMyDay = false;
        t.plannedDate = null;
        t.myDayOrder = null;
        t.updatedAt = Math.max(now, (t.updatedAt || 0) + 1000);
        t.version = (t.version || 1) + 1;
        newMutations.push({
          id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
          entityId: t.id,
          type: 'UPSERT',
          data: { ...t },
          timestamp: t.updatedAt
        });
        count++;
      }
    });

    if (count > 0 || newMutations.length > 0) {
      this.scheduleSaveStoredTodos();
      this.enqueueMutations(newMutations, { saveImmediate: false, flush: true });
      this.notify();
    }
    return count;
  }

  toggleTodoInMyDay(id, todayStr) {
    const todo = this.todos[id];
    if (!todo) return;
    if (isTodoInMyDay(todo, todayStr)) {
      this.updateTodo(id, {
        inMyDay: false,
        plannedDate: null,
        myDayExcludedDate: todayStr,
        myDayOrder: null
      });
    } else {
      this.updateTodo(id, {
        inMyDay: true,
        plannedDate: todayStr,
        myDayExcludedDate: null,
        myDayOrder: this.getTopMyDayOrder(todayStr)
      });
    }
  }

  updateTodo(id, patch) {
    const todo = this.todos[id];
    if (!todo) return;

    const now = this.nextTimestamp(todo);
    const extraReset = {};
    if (('dueDate' in patch || patch.inMyDay === true) && !('myDayExcludedDate' in patch)) {
      extraReset.myDayExcludedDate = null;
    }
    if ('dueDate' in patch && patch.dueDate && !('myDayOrder' in patch)) {
      const todayStr = getLogicalDateStr(new Date(), getStoredDayStartHour());
      if (!isTodoInMyDay(todo, todayStr)) {
        extraReset.myDayOrder = this.getTopMyDayOrder(todayStr);
      }
    }
    Object.assign(todo, patch, extraReset, {
      updatedAt: now,
      version: (todo.version || 1) + 1
    });

    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: id,
      type: 'UPSERT',
      data: { ...todo },
      timestamp: now
    });

    this.notify();
  }

  deleteTodo(id) {
    const todo = this.todos[id];
    if (!todo) return null;

    const snapshot = JSON.parse(JSON.stringify(todo));
    const now = this.nextTimestamp(todo);
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
    const existing = this.todos[snapshot.id];
    const now = Math.max(this.nextTimestamp(existing), this.nextTimestamp(snapshot));
    const restored = {
      ...snapshot,
      deletedAt: null,
      updatedAt: now,
      version: Math.max((existing?.version || 1), (snapshot.version || 1)) + 1
    };
    this.todos[restored.id] = restored;
    this.saveStoredTodos();

    this.queueMutation({
      id: `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
      entityId: restored.id,
      type: 'UPSERT',
      data: { ...restored },
      timestamp: now
    });

    this.notify();
  }

  enqueueMutations(newMutations, { saveImmediate = true, flush = true } = {}) {
    if (!Array.isArray(newMutations) || newMutations.length === 0) return;

    const latestByKey = new Map();
    const orderKeys = [];
    for (const m of newMutations) {
      if (!m) continue;
      const targetId = m.entityId || m.data?.id;
      const normalized = targetId && !m.entityId ? { ...m, entityId: targetId } : m;
      const key = normalized.entityId ? `${normalized.type}:${normalized.entityId}` : normalized.id;
      if (!latestByKey.has(key)) orderKeys.push(key);
      latestByKey.set(key, normalized);
    }

    // Compact un-flushed entries in queue (leave in-flight entries untouched so SYNC_ACK only deletes acked IDs)
    const inFlight = this.inFlightMutationIds;
    if (this.mutationQueue.length > 0) {
      this.mutationQueue = this.mutationQueue.filter(existing => {
        if (inFlight && inFlight.has(existing.id)) return true;
        const targetId = existing.entityId || existing.data?.id;
        if (!targetId) return true;
        return !latestByKey.has(`${existing.type}:${targetId}`);
      });
    }

    for (const key of orderKeys) {
      this.mutationQueue.push(latestByKey.get(key));
    }

    if (saveImmediate) {
      this.saveStoredQueue();
    } else {
      this.scheduleSaveStoredQueue();
    }

    if (!flush) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.flushQueue();
    } else if (this.p2pEngine) {
      if (orderKeys.length === 1) {
        this.p2pEngine.broadcastMutationToPeers(latestByKey.get(orderKeys[0]));
      } else if (orderKeys.length > 1) {
        this.p2pEngine.syncAllPeers();
      }
    }
  }

  queueMutation(mutation) {
    this.enqueueMutations([mutation], { saveImmediate: true, flush: true });
  }

  flushQueue() {
    if (this.mutationQueue.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.inFlightMutationIds && this.inFlightMutationIds.size > 0) {
      this.pendingFlushAfterAck = true;
      return;
    }

    const toSend = [...this.mutationQueue];
    this.inFlightMutationIds = new Set(toSend.map(m => m.id));
    try {
      this.ws.send(JSON.stringify({
        type: 'SYNC_PUSH',
        deviceId: this.deviceId,
        mutations: toSend
      }));
    } catch (err) {
      console.warn('[SyncEngine] Failed to send SYNC_PUSH:', err);
      this.inFlightMutationIds = null;
      this.pendingFlushAfterAck = false;
    }

    this.notify();
  }

  reconcileLocalChangesWithServer(serverTodos, serverLists) {
    const isLocal = Boolean(this.serverUrl && (this.serverUrl.includes('localhost') || this.serverUrl.includes('127.0.0.1')));
    if ((!this.isPaired && !isLocal) || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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
          entityId: localTodo.id,
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
            entityId: localList.id,
            type: 'LIST_UPSERT',
            data: localList,
            timestamp: localList.updatedAt || now
          });
        }
      });
    }

    if (mutations.length > 0) {
      this.enqueueMutations(mutations, { saveImmediate: true, flush: true });
    }
  }

  importTasks(rawInput, options = {}) {
    const startHour = getStoredDayStartHour();
    const todayStr = options.todayStr || getLogicalDateStr(new Date(), startHour);
    const tomorrowStr = options.tomorrowStr || (() => {
      const [y, m, d] = todayStr.split('-').map(Number);
      const t = new Date(y, m - 1, d + 1);
      const pad = n => String(n).padStart(2, '0');
      return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    })();
    const now = Date.now();

    const { createdLists, importedTodos, summary } = buildImportBatch({
      rawInput,
      existingTodos: this.todos,
      existingLists: this.lists,
      todayStr,
      tomorrowStr,
      normalizeIconFn: normalizeListIcon,
      topMyDayOrder: this.getTopMyDayOrder(todayStr),
      now
    });

    const prevTodos = {};
    importedTodos.forEach(t => {
      prevTodos[t.id] = this.todos[t.id] ? JSON.parse(JSON.stringify(this.todos[t.id])) : null;
    });

    const mutations = [];
    if (createdLists.length > 0) {
      this.lists = this.sortListsArray([...this.lists, ...createdLists]);
      createdLists.forEach((l, idx) => {
        mutations.push({
          id: `mut-${now}-implist-${idx}-${l.id.slice(-5)}`,
          entityId: l.id,
          type: 'LIST_UPSERT',
          data: l,
          timestamp: now
        });
      });
      this.saveStoredLists();
    }

    importedTodos.forEach((t, idx) => {
      this.todos[t.id] = t;
      mutations.push({
        id: `mut-${now}-imptodo-${idx}-${t.id.slice(-5)}`,
        entityId: t.id,
        type: 'UPSERT',
        data: t,
        timestamp: now
      });
    });

    this.saveStoredTodos();
    this.enqueueMutations(mutations, { saveImmediate: true, flush: true });
    this.notify();

    return {
      createdLists,
      importedTodos,
      summary,
      undoSnapshot: {
        prevTodos,
        createdListIds: createdLists.map(l => l.id)
      }
    };
  }

  revertImportedBatch(undoSnapshot) {
    if (!undoSnapshot) return;
    const { prevTodos = {}, createdListIds = [] } = undoSnapshot;
    const now = Date.now();
    const mutations = [];

    Object.entries(prevTodos).forEach(([id, prev], idx) => {
      if (prev) {
        const ts = Math.max(this.nextTimestamp(this.todos[id]), this.nextTimestamp(prev));
        const restored = { ...prev, updatedAt: ts, version: Math.max((this.todos[id]?.version || 1), (prev.version || 1)) + 1 };
        this.todos[id] = restored;
        mutations.push({
          id: `mut-${ts}-undotodo-${idx}-${id.slice(-5)}`,
          entityId: id,
          type: 'UPSERT',
          data: { ...restored },
          timestamp: ts
        });
      } else if (this.todos[id]) {
        const ts = this.nextTimestamp(this.todos[id]);
        this.todos[id].deletedAt = ts;
        this.todos[id].updatedAt = ts;
        mutations.push({
          id: `mut-${ts}-deltodo-${idx}-${id.slice(-5)}`,
          entityId: id,
          type: 'DELETE',
          data: null,
          timestamp: ts
        });
      }
    });

    if (createdListIds.length > 0) {
      const createdSet = new Set(createdListIds);
      const activeListIds = new Set(
        Object.values(this.todos).filter(t => t && !t.deletedAt).map(t => t.listId)
      );
      const removable = createdListIds.filter(lid => createdSet.has(lid) && !activeListIds.has(lid));
      if (removable.length > 0) {
        const removeSet = new Set(removable);
        removable.forEach((lid, idx) => {
          const existingList = this.lists.find(l => l.id === lid);
          const ts = this.nextTimestamp(existingList);
          this.deletedLists[lid] = ts;
          mutations.push({
            id: `mut-${ts}-dellist-${idx}-${lid.slice(-5)}`,
            entityId: lid,
            type: 'LIST_DELETE',
            data: null,
            timestamp: ts
          });
        });
        this.lists = this.lists.filter(l => !removeSet.has(l.id));
        this.saveDeletedLists();
        this.saveStoredLists();
      }
    }

    this.saveStoredTodos();
    if (mutations.length > 0) {
      this.enqueueMutations(mutations, { saveImmediate: true, flush: true });
    }
    this.notify();
  }
}

export const syncEngine = new SyncEngine();
