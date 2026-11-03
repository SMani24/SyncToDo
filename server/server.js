import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dgram from 'dgram';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ICON_NAME_MAP = {
  inbox: '📥',
  briefcase: '💼',
  work: '💼',
  heart: '❤️',
  personal: '❤️',
  cart: '🛒',
  shopping: '🛒',
  folder: '📁'
};

function normalizeListIcon(icon) {
  if (!icon) return '📁';
  const lower = String(icon).trim().toLowerCase();
  return ICON_NAME_MAP[lower] || icon;
}

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getDefaultHostName() {
  try {
    const h = os.hostname();
    if (h && h !== 'localhost') {
      return `${h} (Laptop)`;
    }
  } catch {}
  return 'My Laptop';
}

let state = {
  serverDeviceId: `laptop-${Math.random().toString(36).substring(2, 9)}`,
  serverDeviceName: getDefaultHostName(),
  pairingCode: generateSixDigitCode(),
  pairedDevices: {}, // deviceId -> { deviceId, deviceName, deviceType, token, ip, port, pairedAt, lastSeen }
  todos: {}, // id -> todo object
  lists: [
    { id: 'inbox', name: 'Inbox', icon: '📥', color: '#6366f1' },
    { id: 'work', name: 'Work', icon: '💼', color: '#a855f7' },
    { id: 'personal', name: 'Personal', icon: '❤️', color: '#10b981' },
    { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#f59e0b' }
  ],
  mutations: [], // Changelog for delta sync: { id, entityId, type, data, timestamp }
  lastUpdated: Date.now()
};

// Ephemeral pending pair requests: deviceId -> { requestId, deviceId, deviceName, deviceType, ip, port, code, status, token, createdAt }
const pendingPairRequests = new Map();

function loadState() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      state = {
        ...state,
        ...parsed,
        serverDeviceId: parsed.serverDeviceId || state.serverDeviceId,
        serverDeviceName: parsed.serverDeviceName || state.serverDeviceName,
        pairingCode: parsed.pairingCode || state.pairingCode,
        pairedDevices: parsed.pairedDevices || {}
      };
      if (Array.isArray(state.lists)) {
        let changed = false;
        state.lists.forEach(l => {
          const norm = normalizeListIcon(l.icon);
          if (norm !== l.icon) {
            l.icon = norm;
            changed = true;
          }
        });
        if (changed) saveState();
      }
      console.log(`[Store] Loaded ${Object.keys(state.todos).length} todos and ${state.mutations.length} mutations.`);
    } else {
      const sampleTodos = [
        {
          id: 'task-1',
          title: 'Install SyncToDo on Phone & Tablet',
          notes: 'Open the app URL in Safari or Chrome, tap Share / Settings, and select "Add to Home Screen".',
          completed: false,
          listId: 'inbox',
          priority: 'high',
          dueDate: new Date().toISOString().split('T')[0],
          steps: [
            { id: 'st-1', title: 'Download the Android APK', completed: true },
            { id: 'st-2', title: 'Open Devices & Pair with 6-digit code', completed: false }
          ],
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now() - 3600000,
          deletedAt: null,
          version: 1
        },
        {
          id: 'task-2',
          title: 'Test offline sync mode',
          notes: 'Turn off Wi-Fi on your phone, check off this task, turn Wi-Fi back on, and watch it auto-sync to your laptop!',
          completed: false,
          listId: 'work',
          priority: 'medium',
          dueDate: null,
          steps: [],
          createdAt: Date.now() - 1800000,
          updatedAt: Date.now() - 1800000,
          deletedAt: null,
          version: 1
        },
        {
          id: 'task-3',
          title: 'Switch between custom themes',
          notes: 'Try Nordic Glass, Cyber Matrix, Clean Studio, and Warm Journal directly from the settings bar.',
          completed: true,
          listId: 'personal',
          priority: 'low',
          dueDate: null,
          steps: [],
          createdAt: Date.now() - 7200000,
          updatedAt: Date.now() - 600000,
          deletedAt: null,
          version: 2
        }
      ];

      sampleTodos.forEach(t => {
        state.todos[t.id] = t;
        state.mutations.push({
          id: 'init-' + t.id,
          entityId: t.id,
          type: 'UPSERT',
          data: t,
          timestamp: t.updatedAt
        });
      });
      saveState();
    }
  } catch (err) {
    console.error('[Store] Failed to load store:', err);
  }
}

function saveState() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save store:', err);
  }
}

loadState();

// Express HTTP Server
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built frontend client
const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

// Direct APK download route for phone and tablet
const APK_PATH = path.join(__dirname, 'public/SyncToDo.apk');
app.get(['/download/app.apk', '/download/SyncToDo.apk', '/SyncToDo.apk', '/app.apk'], (req, res) => {
  if (fs.existsSync(APK_PATH)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.download(APK_PATH, 'SyncToDo.apk');
  } else {
    res.status(404).send('APK not found. Please build it first.');
  }
});

// Friendly mobile download landing page at /download
app.get(['/download', '/download/'], (req, res) => {
  if (!fs.existsSync(APK_PATH)) {
    return res.status(404).send('APK not found. Please build it first.');
  }
  const stats = fs.statSync(APK_PATH);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download SyncToDo for Android</title>
  <style>
    body {
      margin: 0; padding: 24px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090e17; color: #f8fafc;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 90vh; text-align: center;
    }
    .card {
      background: #1e293b; border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 24px; padding: 32px 24px; max-width: 400px; width: 100%;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }
    .logo {
      width: 64px; height: 64px; border-radius: 18px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 32px; color: #fff; font-weight: 800; margin-bottom: 16px;
    }
    h1 { font-size: 22px; margin: 0 0 8px 0; font-weight: 800; }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5; }
    .btn {
      display: block; width: 100%; padding: 14px 20px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: #fff; font-weight: 700; font-size: 16px; text-decoration: none;
      border-radius: 14px; box-sizing: border-box; margin-bottom: 12px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn:active { transform: scale(0.98); }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 11px;
      font-weight: 700; margin-bottom: 16px;
    }
    .meta { font-size: 12px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✓</div>
    <h1>SyncToDo for Android</h1>
    <span class="badge">Target Android 14 · Friendly Device Pairing</span>
    <p>Install the dedicated Android app on your phone or tablet to sync offline-first across your local network.</p>
    <a href="/download/SyncToDo.apk" class="btn" download="SyncToDo.apk">⬇️ Download APK (${sizeMb} MB)</a>
    <div class="meta">Version 2.0 · Ready to install</div>
  </div>
</body>
</html>`);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    todosCount: Object.keys(state.todos).length,
    mutationsCount: state.mutations.length,
    activeConnections: wss.clients.size
  });
});

// Helper to compute local broadcast addresses
function getBroadcastAddresses() {
  const nets = os.networkInterfaces();
  const bcasts = ['255.255.255.255'];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        try {
          const ipParts = net.address.split('.').map(Number);
          const maskParts = net.netmask.split('.').map(Number);
          const bcastParts = ipParts.map((part, i) => (part | (~maskParts[i] & 255)));
          bcasts.push(bcastParts.join('.'));
        } catch (e) {}
      }
    }
  }
  return [...new Set(bcasts)];
}

function getActiveTasksCount() {
  return Object.values(state.todos).filter(t => !t.deletedAt).length;
}

// Decentralized P2P LAN endpoints (Phone, Tablet & Laptop friendly discovery + pairing)
app.get('/api/p2p/info', (req, res) => {
  const ips = getLocalIpAddresses();
  res.json({
    status: 'ok',
    device: 'laptop',
    deviceType: 'laptop',
    deviceId: state.serverDeviceId,
    deviceName: state.serverDeviceName,
    pairingCode: state.pairingCode,
    tasksCount: getActiveTasksCount(),
    listsCount: state.lists.length,
    ip: ips[0] || '127.0.0.1',
    port: PORT
  });
});

// Rename server device
app.post('/api/p2p/rename', (req, res) => {
  const { deviceName } = req.body || {};
  if (deviceName && String(deviceName).trim()) {
    state.serverDeviceName = String(deviceName).trim().slice(0, 40);
    saveState();
    broadcastPairingUpdate();
  }
  res.json({
    status: 'ok',
    deviceId: state.serverDeviceId,
    deviceName: state.serverDeviceName,
    pairingCode: state.pairingCode
  });
});

// Regenerate 6-digit pairing code
app.post('/api/p2p/regenerate-code', (req, res) => {
  state.pairingCode = generateSixDigitCode();
  saveState();
  broadcastPairingUpdate();
  res.json({ status: 'ok', pairingCode: state.pairingCode });
});

// Dynamic UDP Peer Discovery for Zero-Configuration Local Network Sync
const UDP_PORT = 4568;
const discoveredPeers = new Map(); // key (deviceId or ip) -> { deviceId, deviceName, ip, port, deviceType, tasksCount, lastSeen }

function recordDiscoveredPeer({ ip, port, deviceType, deviceId, deviceName, tasksCount }) {
  const myIps = getLocalIpAddresses();
  if (!ip || ip === '127.0.0.1' || myIps.includes(ip) || ip === 'Detecting...' || !ip.includes('.')) {
    return;
  }
  if (deviceId && deviceId === state.serverDeviceId) return;

  const key = deviceId || ip;
  const existing = discoveredPeers.get(key) || {};
  const cleanName = deviceName
    ? String(deviceName).trim()
    : existing.deviceName || (deviceType === 'tablet' ? 'Android Tablet' : deviceType === 'laptop' ? 'Laptop' : 'Android Phone');

  const peerRecord = {
    deviceId: deviceId || existing.deviceId || `peer-${ip}`,
    deviceName: cleanName,
    ip,
    port: Number(port) || existing.port || 4567,
    deviceType: deviceType || existing.deviceType || 'phone',
    tasksCount: typeof tasksCount === 'number' && !isNaN(tasksCount) ? tasksCount : (existing.tasksCount || 0),
    lastSeen: Date.now()
  };
  discoveredPeers.set(key, peerRecord);

  // If this deviceId is already paired, automatically keep its IP & port up to date!
  if (peerRecord.deviceId && state.pairedDevices[peerRecord.deviceId]) {
    const pd = state.pairedDevices[peerRecord.deviceId];
    const ipChanged = pd.ip !== ip || pd.port !== peerRecord.port;
    pd.ip = ip;
    pd.port = peerRecord.port;
    pd.deviceName = cleanName || pd.deviceName;
    pd.lastSeen = Date.now();
    if (ipChanged) {
      saveState();
    }
  }
}

let udpSocket = null;
try {
  udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udpSocket.on('error', (err) => {
    console.log('[UDP] Discovery socket note:', err.message);
  });
  udpSocket.on('message', (msg, rinfo) => {
    try {
      const text = msg.toString();
      if (text.startsWith('SYNCTODO_OFFER:') || text.startsWith('SYNCTODO_BEACON:')) {
        const parts = text.split(':');
        const ip = parts[1] || rinfo.address;
        const port = parseInt(parts[2] || '4567', 10);
        const deviceType = parts[3] || 'phone';
        const deviceId = parts[4] || null;
        const deviceName = parts[5] ? decodeURIComponent(parts[5]) : null;
        const tasksCount = parts[6] ? parseInt(parts[6], 10) : 0;

        recordDiscoveredPeer({ ip, port, deviceType, deviceId, deviceName, tasksCount });
      } else if (text.startsWith('SYNCTODO_DISCOVER')) {
        const myIps = getLocalIpAddresses();
        const myIp = myIps[0] || '127.0.0.1';
        const encodedName = encodeURIComponent(state.serverDeviceName);
        const reply = Buffer.from(
          `SYNCTODO_OFFER:${myIp}:${PORT}:laptop:${state.serverDeviceId}:${encodedName}:${getActiveTasksCount()}`
        );
        udpSocket.send(reply, 0, reply.length, rinfo.port, rinfo.address);
      }
    } catch {}
  });

  udpSocket.bind(UDP_PORT, '0.0.0.0', () => {
    try {
      udpSocket.setBroadcast(true);
      console.log(`[UDP] Discovery beacon listener active on port ${UDP_PORT}`);
    } catch (e) {}
  });

  // Periodic UDP broadcast discovery beacon every 4 seconds
  setInterval(() => {
    try {
      if (udpSocket) {
        const myIps = getLocalIpAddresses();
        const myIp = myIps[0] || '127.0.0.1';
        const encodedName = encodeURIComponent(state.serverDeviceName);
        const beacon = Buffer.from(
          `SYNCTODO_BEACON:${myIp}:${PORT}:laptop:${state.serverDeviceId}:${encodedName}:${getActiveTasksCount()}`
        );
        const discover = Buffer.from('SYNCTODO_DISCOVER');
        const bcasts = getBroadcastAddresses();
        bcasts.forEach(bcast => {
          try {
            udpSocket.send(beacon, 0, beacon.length, UDP_PORT, bcast, () => {});
            udpSocket.send(discover, 0, discover.length, UDP_PORT, bcast, () => {});
          } catch (e) {}
        });
      }
    } catch (e) {}
  }, 4000);
} catch (err) {
  console.log('[UDP] Could not initialize UDP socket:', err.message);
}

// Endpoint to fetch auto-discovered local peers + paired devices + pending pair requests
app.get('/api/p2p/discovered-peers', (req, res) => {
  const now = Date.now();
  const peers = [];
  for (const [key, data] of discoveredPeers.entries()) {
    if (now - data.lastSeen < 90000) {
      peers.push({
        ...data,
        isPaired: Boolean(data.deviceId && state.pairedDevices[data.deviceId])
      });
    }
  }

  // Clean up expired pending pair requests (> 2 minutes)
  const pending = [];
  for (const [reqDevId, reqObj] of pendingPairRequests.entries()) {
    if (now - reqObj.createdAt > 120000) {
      pendingPairRequests.delete(reqDevId);
    } else if (reqObj.status === 'pending') {
      pending.push(reqObj);
    }
  }

  const ips = getLocalIpAddresses();
  res.json({
    status: 'ok',
    serverInfo: {
      deviceId: state.serverDeviceId,
      deviceName: state.serverDeviceName,
      deviceType: 'laptop',
      pairingCode: state.pairingCode,
      ip: ips[0] || '127.0.0.1',
      port: PORT,
      tasksCount: getActiveTasksCount()
    },
    peers,
    pairedDevices: Object.values(state.pairedDevices),
    pendingRequests: pending
  });
});

// Initiate pairing (by 6-digit code OR interactive confirmation prompt)
app.post('/api/p2p/pair-request', (req, res) => {
  const { deviceId, deviceName, deviceType = 'phone', ip, port = 4567, code } = req.body || {};
  const cleanIp = ip || (req.ip ? req.ip.replace('::ffff:', '') : null);
  const devId = deviceId || `peer-${cleanIp || Date.now()}`;
  const devName = deviceName || (deviceType === 'tablet' ? 'Android Tablet' : 'Android Phone');

  if (cleanIp && cleanIp !== '127.0.0.1') {
    recordDiscoveredPeer({ ip: cleanIp, port, deviceType, deviceId: devId, deviceName: devName });
  }

  const cleanCode = code ? String(code).replace(/\s+/g, '').trim() : '';

  // Case 1: User entered the matching 6-digit code or scanned the QR code -> instant pairing!
  if (cleanCode && cleanCode === state.pairingCode) {
    const token = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    state.pairedDevices[devId] = {
      deviceId: devId,
      deviceName: devName,
      deviceType,
      ip: cleanIp,
      port: Number(port) || 4567,
      token,
      pairedAt: Date.now(),
      lastSeen: Date.now()
    };
    pendingPairRequests.delete(devId);
    saveState();
    broadcastPairingUpdate();

    const ips = getLocalIpAddresses();
    return res.json({
      status: 'paired',
      token,
      serverDevice: {
        deviceId: state.serverDeviceId,
        deviceName: state.serverDeviceName,
        deviceType: 'laptop',
        ip: ips[0] || '127.0.0.1',
        port: PORT
      },
      todos: Object.values(state.todos),
      lists: state.lists
    });
  }

  if (cleanCode && cleanCode !== state.pairingCode) {
    return res.status(400).json({
      status: 'invalid_code',
      message: 'The 6-digit code did not match. Check the code shown on the other device.'
    });
  }

  // Case 2: User tapped "Pair" on a nearby device -> create confirmation request showing matching code on both screens
  const reqObj = {
    requestId: `req-${Date.now()}`,
    deviceId: devId,
    deviceName: devName,
    deviceType,
    ip: cleanIp,
    port: Number(port) || 4567,
    code: state.pairingCode,
    status: 'pending',
    token: null,
    createdAt: Date.now()
  };
  pendingPairRequests.set(devId, reqObj);
  broadcastPairingUpdate();

  res.json({
    status: 'pending',
    code: state.pairingCode,
    serverDevice: {
      deviceId: state.serverDeviceId,
      deviceName: state.serverDeviceName,
      deviceType: 'laptop'
    }
  });
});

// Check status of a pending interactive pair request
app.get('/api/p2p/pair-status', (req, res) => {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ status: 'error' });

  const paired = state.pairedDevices[deviceId];
  if (paired) {
    const ips = getLocalIpAddresses();
    return res.json({
      status: 'paired',
      token: paired.token,
      serverDevice: {
        deviceId: state.serverDeviceId,
        deviceName: state.serverDeviceName,
        deviceType: 'laptop',
        ip: ips[0] || '127.0.0.1',
        port: PORT
      },
      todos: Object.values(state.todos),
      lists: state.lists
    });
  }

  const pending = pendingPairRequests.get(deviceId);
  if (!pending) {
    return res.json({ status: 'none' });
  }
  res.json({
    status: pending.status,
    code: pending.code,
    token: pending.token
  });
});

// Allow or decline a pending pair request on the laptop
app.post('/api/p2p/pair-respond', (req, res) => {
  const { deviceId, action } = req.body || {};
  const pending = pendingPairRequests.get(deviceId);
  if (!pending) {
    return res.status(404).json({ status: 'not_found' });
  }

  if (action === 'allow') {
    const token = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    pending.status = 'paired';
    pending.token = token;
    state.pairedDevices[deviceId] = {
      deviceId: pending.deviceId,
      deviceName: pending.deviceName,
      deviceType: pending.deviceType,
      ip: pending.ip,
      port: pending.port,
      token,
      pairedAt: Date.now(),
      lastSeen: Date.now()
    };
    saveState();
    broadcastPairingUpdate();
    return res.json({ status: 'paired', device: state.pairedDevices[deviceId] });
  } else {
    pending.status = 'declined';
    setTimeout(() => pendingPairRequests.delete(deviceId), 10000);
    broadcastPairingUpdate();
    return res.json({ status: 'declined' });
  }
});

// Unpair a device
app.post('/api/p2p/unpair', (req, res) => {
  const { deviceId } = req.body || {};
  if (deviceId && state.pairedDevices[deviceId]) {
    delete state.pairedDevices[deviceId];
    saveState();
    broadcastPairingUpdate();
  }
  res.json({ status: 'ok', pairedDevices: Object.values(state.pairedDevices) });
});

// Unified P2P Sync (Merges Todos, Lists, and Mutations safely using LWW CRDT)
app.all('/api/p2p/sync', (req, res) => {
  if (req.method === 'POST') {
    const {
      todos = {},
      lists = [],
      mutations = [],
      deviceId = 'unknown',
      deviceName = null,
      deviceType = 'phone',
      port = 4567
    } = req.body || {};

    const senderIp = req.ip ? req.ip.replace('::ffff:', '') : null;
    if (senderIp && senderIp !== '127.0.0.1') {
      recordDiscoveredPeer({ ip: senderIp, port, deviceType, deviceId, deviceName });
    }

    if (deviceId && state.pairedDevices[deviceId]) {
      state.pairedDevices[deviceId].lastSeen = Date.now();
      if (deviceName) state.pairedDevices[deviceId].deviceName = deviceName;
    }

    let stateChanged = false;

    // 1. Apply delta mutations if provided
    if (Array.isArray(mutations) && mutations.length > 0) {
      applyMutations(mutations, deviceId, null);
    }

    // 2. Merge Lists by ID
    if (Array.isArray(lists) && lists.length > 0) {
      lists.forEach(incomingList => {
        if (!incomingList || !incomingList.id) return;
        const normList = { ...incomingList, icon: normalizeListIcon(incomingList.icon) };
        const existingIdx = state.lists.findIndex(l => l.id === normList.id);
        if (existingIdx >= 0) {
          const existing = state.lists[existingIdx];
          if ((normList.updatedAt || normList.createdAt || 0) >= (existing.updatedAt || existing.createdAt || 0)) {
            state.lists[existingIdx] = { ...existing, ...normList };
            stateChanged = true;
          }
        } else {
          state.lists.push(normList);
          stateChanged = true;
        }
      });
    }

    // 3. Merge Todos by ID & updatedAt (Last-Write-Wins)
    const todoValues = Array.isArray(todos) ? todos : Object.values(todos || {});
    if (todoValues.length > 0) {
      todoValues.forEach(t => {
        if (t && t.id) {
          const current = state.todos[t.id];
          if (!current || (t.updatedAt || 0) > (current.updatedAt || 0)) {
            state.todos[t.id] = { ...current, ...t };
            stateChanged = true;
          }
        }
      });
    }

    if (stateChanged) {
      state.lastUpdated = Date.now();
      saveState();
      broadcastFullSyncState(deviceId);
    }
  }

  res.json({
    status: 'ok',
    deviceId: state.serverDeviceId,
    deviceName: state.serverDeviceName,
    deviceType: 'laptop',
    todos: Object.values(state.todos),
    lists: state.lists,
    mutations: state.mutations.slice(-200),
    timestamp: Date.now()
  });
});

// Delta sync endpoint
app.get('/api/sync', (req, res) => {
  const since = parseInt(req.query.since || '0', 10);
  const deltas = state.mutations.filter(m => m.timestamp > since);
  const activeTodos = Object.values(state.todos);

  res.json({
    timestamp: Date.now(),
    deltas,
    todos: activeTodos,
    lists: state.lists
  });
});

// Push mutations endpoint
app.post('/api/sync', (req, res) => {
  const { mutations = [], deviceId = 'unknown' } = req.body;
  const applied = applyMutations(mutations, deviceId, null);
  res.json({ success: true, appliedCount: applied.length, timestamp: Date.now() });
});

// Create HTTP server and bind WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const connectedClients = new Map(); // ws -> { deviceId, deviceName, deviceType, localIp, connectedAt }

function getActiveDeviceList() {
  const devices = [];
  for (const client of connectedClients.values()) {
    devices.push({
      deviceId: client.deviceId,
      deviceName: client.deviceName || client.deviceType || 'Device',
      deviceType: client.deviceType,
      localIp: client.localIp || null,
      connectedAt: client.connectedAt
    });
  }
  return devices;
}

function broadcastDevices() {
  const payload = JSON.stringify({
    type: 'DEVICES_PRESENCE',
    count: connectedClients.size,
    devices: getActiveDeviceList(),
    pairedDevices: Object.values(state.pairedDevices)
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastPairingUpdate() {
  const now = Date.now();
  const pending = [];
  for (const reqObj of pendingPairRequests.values()) {
    if (now - reqObj.createdAt <= 120000 && reqObj.status === 'pending') {
      pending.push(reqObj);
    }
  }
  const payload = JSON.stringify({
    type: 'PAIRING_UPDATE',
    serverInfo: {
      deviceId: state.serverDeviceId,
      deviceName: state.serverDeviceName,
      pairingCode: state.pairingCode
    },
    pairedDevices: Object.values(state.pairedDevices),
    pendingRequests: pending
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastFullSyncState(originDevice) {
  const payload = JSON.stringify({
    type: 'WELCOME',
    serverTime: Date.now(),
    originDevice,
    todos: Object.values(state.todos),
    lists: state.lists
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// CRDT Last-Write-Wins mutation applier
function applyMutations(mutations, deviceId, senderWs = null) {
  const applied = [];
  const now = Date.now();

  for (const mutation of mutations) {
    const { entityId, type, data, timestamp } = mutation;

    if (type === 'LIST_UPSERT') {
      const normalizedData = data ? { ...data, icon: normalizeListIcon(data.icon), updatedAt: timestamp || now } : data;
      const listIdx = state.lists.findIndex(l => l.id === entityId);
      if (listIdx >= 0) {
        state.lists[listIdx] = { ...state.lists[listIdx], ...normalizedData };
      } else if (normalizedData) {
        state.lists.push(normalizedData);
      }
      const entry = { id: mutation.id || `mut-${now}`, entityId, type, data: normalizedData, timestamp: timestamp || now, originDevice: deviceId };
      state.mutations.push(entry);
      applied.push(entry);
      continue;
    } else if (type === 'LIST_DELETE') {
      state.lists = state.lists.filter(l => l.id !== entityId);
      const entry = { id: mutation.id || `mut-${now}`, entityId, type, data: null, timestamp: timestamp || now, originDevice: deviceId };
      state.mutations.push(entry);
      applied.push(entry);
      continue;
    }

    const existing = state.todos[entityId];

    // Conflict resolution: Last-Write-Wins based on mutation timestamp
    if (!existing || (timestamp || now) >= (existing.updatedAt || 0)) {
      if (type === 'DELETE') {
        if (existing) {
          existing.deletedAt = timestamp || now;
          existing.updatedAt = timestamp || now;
        } else {
          state.todos[entityId] = {
            id: entityId,
            deletedAt: timestamp || now,
            updatedAt: timestamp || now
          };
        }
      } else {
        // UPSERT
        state.todos[entityId] = {
          ...existing,
          ...data,
          updatedAt: timestamp || now
        };
      }

      const changelogEntry = {
        id: mutation.id || `mut-${now}-${Math.random().toString(36).substring(2, 7)}`,
        entityId,
        type,
        data: state.todos[entityId],
        timestamp: timestamp || now,
        originDevice: deviceId
      };

      state.mutations.push(changelogEntry);
      applied.push(changelogEntry);
    }
  }

  if (applied.length > 0) {
    state.lastUpdated = now;
    saveState();

    // Broadcast to all other connected WebSocket clients
    const broadcastMsg = JSON.stringify({
      type: 'SYNC_BROADCAST',
      mutations: applied,
      originDevice: deviceId,
      timestamp: now
    });

    for (const [wsClient] of connectedClients) {
      if (wsClient !== senderWs && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(broadcastMsg);
      }
    }
  }

  return applied;
}

wss.on('connection', (ws, req) => {
  const clientId = `client-${Math.random().toString(36).substring(2, 9)}`;
  connectedClients.set(ws, {
    deviceId: clientId,
    deviceName: 'Device',
    deviceType: 'unknown',
    connectedAt: Date.now()
  });

  console.log(`[WS] Client connected: ${clientId}. Total active: ${connectedClients.size}`);

  // Send initial welcome & device list
  ws.send(JSON.stringify({
    type: 'WELCOME',
    clientId,
    serverTime: Date.now(),
    serverInfo: {
      deviceId: state.serverDeviceId,
      deviceName: state.serverDeviceName,
      pairingCode: state.pairingCode
    },
    todos: Object.values(state.todos),
    lists: state.lists
  }));

  broadcastDevices();
  broadcastPairingUpdate();

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === 'IDENTIFY') {
        const clientInfo = connectedClients.get(ws);
        if (clientInfo) {
          clientInfo.deviceId = msg.deviceId || clientInfo.deviceId;
          clientInfo.deviceName = msg.deviceName || msg.deviceType || 'Device';
          clientInfo.deviceType = msg.deviceType || 'desktop';
          clientInfo.localIp = msg.localIp || null;
          if (msg.localIp && msg.localIp !== '127.0.0.1' && msg.localIp !== 'Detecting...' && msg.localIp.includes('.')) {
            recordDiscoveredPeer({
              ip: msg.localIp,
              port: msg.deviceType === 'laptop' ? PORT : 4567,
              deviceType: msg.deviceType || 'phone',
              deviceId: clientInfo.deviceId,
              deviceName: clientInfo.deviceName
            });
          }
        }
        broadcastDevices();
      } else if (msg.type === 'SYNC_PUSH') {
        const mutations = msg.mutations || [];
        const deviceId = msg.deviceId || 'unknown';
        const applied = applyMutations(mutations, deviceId, ws);

        ws.send(JSON.stringify({
          type: 'SYNC_ACK',
          appliedCount: applied.length,
          timestamp: Date.now()
        }));
      } else if (msg.type === 'SYNC_PULL') {
        const since = msg.since || 0;
        const deltas = state.mutations.filter(m => m.timestamp > since);
        ws.send(JSON.stringify({
          type: 'SYNC_RESPONSE',
          deltas,
          todos: Object.values(state.todos),
          lists: state.lists,
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.error('[WS] Error processing message:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected. Total active: ${connectedClients.size}`);
    broadcastDevices();
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
  });
});

function getLocalIpAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    if (/tun|tap|wg|vpn|docker|veth|br-/i.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  results.sort((a, b) => {
    const a192 = a.startsWith('192.168.') ? 0 : 1;
    const b192 = b.startsWith('192.168.') ? 0 : 1;
    return a192 - b192;
  });
  return results;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 SyncToDo Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket ready on ws://0.0.0.0:${PORT}`);
  console.log(`🔑 Pairing Code: ${state.pairingCode} (${state.serverDeviceName})`);
  const ips = getLocalIpAddresses();
  if (ips.length > 0) {
    console.log(`🌐 Available on local network:`);
    ips.forEach(ip => {
      console.log(`   - Web App:       http://${ip}:${PORT}`);
      console.log(`   - APK Download:  http://${ip}:${PORT}/download/SyncToDo.apk`);
      console.log(`   - Download Page: http://${ip}:${PORT}/download`);
    });
  } else {
    console.log(`🌐 Notice: No external IP detected (running sandboxed or offline).`);
  }
  console.log(`===============================================`);
});
