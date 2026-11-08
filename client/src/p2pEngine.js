// Friendly Local Network P2P & Device Pairing Engine
// Discovers devices by name via UDP/mDNS, pairs with 6-digit code or 1-tap confirmation,
// and reconnects automatically by deviceId even when Wi-Fi IP addresses change.

const STORAGE_KEY_KNOWN_PEERS = 'synctodo_known_peers_v1';
const STORAGE_KEY_PEER_PORTS = 'synctodo_peer_ports_v1';
const STORAGE_KEY_PAIRED_DEVICES = 'synctodo_paired_devices_v2';
const P2P_PORT = 4567;
const LAPTOP_PORT = 4000;

export class P2PEngine {
  constructor(syncEngine) {
    this.syncEngine = syncEngine;
    this.peerPorts = this.loadPeerPorts(); // ip -> port number (4567 or 4000)
    this.pairedDevices = this.loadPairedDevices(); // Map: deviceId -> { deviceId, deviceName, deviceType, ip, port, token, pairedAt, lastSeen }
    this.knownPeers = this.loadKnownPeers(); // array of IP strings for paired/trusted peers
    this.activePeers = new Map(); // ip -> { deviceId, deviceName, lastSeen, status, deviceType, latency, port }
    this.nearbyPeers = new Map(); // key (deviceId or ip) -> { deviceId, deviceName, ip, port, deviceType, tasksCount, isPaired, lastSeen }
    this.pendingRequests = []; // incoming pair requests waiting for Allow / Decline on this device
    this.outgoingPairSession = null; // { peer, code, status: 'requesting'|'waiting'|'paired'|'declined'|'error', errorMsg }
    this.localServerInfo = {
      deviceId: this.syncEngine?.deviceId || null,
      deviceName: this.syncEngine?.deviceName || 'My Device',
      pairingCode: this.loadOrGeneratePairingCode()
    };

    this.listeners = new Set();
    this.myLocalIp = 'Detecting...';
    this.isScanning = false;
    this.syncInterval = null;
    this.pairPollTimer = null;

    // Detect our own local IP & device metadata
    this.detectLocalIp();

    // Start background discovery & paired-device sync
    this.startBackgroundSync();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getInfo());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const info = this.getInfo();
    this.listeners.forEach(cb => {
      try { cb(info); } catch (e) { console.error(e); }
    });
    if (this.syncEngine) {
      this.syncEngine.notifyP2POnly?.(info);
    }
  }

  isSelfDevice(item) {
    if (!item) return true;
    const myDevId = this.syncEngine?.deviceId;
    const localDevId = this.localServerInfo?.deviceId;
    const myName = (this.syncEngine?.deviceName || '').trim().toLowerCase();
    const localName = (this.localServerInfo?.deviceName || '').trim().toLowerCase();
    const myIp = this.myLocalIp !== 'Detecting...' ? this.myLocalIp : null;

    if (item.deviceId && ((myDevId && item.deviceId === myDevId) || (localDevId && item.deviceId === localDevId))) return true;
    if (item.ip && (item.ip === '127.0.0.1' || item.ip === 'localhost' || item.ip === '::1')) return true;
    if (item.ip && myIp && item.ip === myIp) return true;
    if (item.deviceName) {
      const devName = item.deviceName.trim().toLowerCase();
      if ((myName && devName === myName) || (localName && devName === localName)) return true;
    }
    return false;
  }

  getInfo() {
    const peerList = [];
    for (const [ip, data] of this.activePeers.entries()) {
      if (this.isSelfDevice({ ip, deviceId: data.deviceId, deviceName: data.deviceName })) continue;
      peerList.push({
        ip,
        port: data.port || this.peerPorts.get(ip) || P2P_PORT,
        deviceId: data.deviceId || `peer-${ip}`,
        deviceName: data.deviceName || (data.port === LAPTOP_PORT ? 'Laptop' : 'Device'),
        status: data.status,
        deviceType: data.deviceType,
        latency: data.latency,
        lastSeen: data.lastSeen
      });
    }

    const onlineDevs = this.syncEngine?.onlineDevices || [];

    // Deduplicate paired devices: merge by normalized deviceName
    const pairedByName = new Map();
    for (const pd of this.pairedDevices.values()) {
      if (this.isSelfDevice(pd)) {
        this.pairedDevices.delete(pd.deviceId);
        continue;
      }

      const normKey = (pd.deviceName || '').trim().toLowerCase() || pd.deviceId;
      const activeByIp = pd.ip ? this.activePeers.get(pd.ip) : null;
      const activeByDevId = pd.deviceId
        ? Array.from(this.activePeers.values()).find(p => p.deviceId === pd.deviceId)
        : null;
      const onlineInMesh = onlineDevs.some(od =>
        (od.deviceId && od.deviceId === pd.deviceId) ||
        (od.deviceName && pd.deviceName && od.deviceName.toLowerCase().trim() === pd.deviceName.toLowerCase().trim())
      );
      const isOnline = Boolean(
        (activeByIp && activeByIp.status === 'connected') ||
        (activeByDevId && activeByDevId.status === 'connected') ||
        onlineInMesh ||
        (pd.lastSeen && Date.now() - pd.lastSeen < 60000)
      );

      const candidate = {
        ...pd,
        status: isOnline ? 'connected' : 'offline',
        latency: activeByIp?.latency || activeByDevId?.latency || (onlineInMesh ? (isOnline ? 120 : null) : null)
      };

      const existing = pairedByName.get(normKey);
      if (!existing) {
        pairedByName.set(normKey, candidate);
      } else {
        if (candidate.status === 'connected' && existing.status !== 'connected') {
          pairedByName.set(normKey, candidate);
        } else if ((candidate.lastSeen || 0) > (existing.lastSeen || 0)) {
          pairedByName.set(normKey, {
            ...existing,
            ...candidate,
            token: candidate.token || existing.token
          });
        }
      }
    }
    const pairedList = Array.from(pairedByName.values());

    const nearbyByName = new Map();
    const now = Date.now();
    for (const np of this.nearbyPeers.values()) {
      if (this.isSelfDevice(np)) continue;
      if (now - (np.lastSeen || 0) < 120000) {
        const normKey = (np.deviceName || '').trim().toLowerCase() || np.deviceId || np.ip;
        // Don't show in nearby list if already paired
        if (pairedByName.has(normKey)) continue;

        if (!nearbyByName.has(normKey) || (np.lastSeen || 0) > (nearbyByName.get(normKey).lastSeen || 0)) {
          nearbyByName.set(normKey, {
            ...np,
            isPaired: false
          });
        }
      }
    }
    const nearbyList = Array.from(nearbyByName.values());

    const activePairedCount = pairedList.filter(p => p.status === 'connected').length;
    const activePeersCount = peerList.filter(p => p.status === 'connected').length;
    const connectedCount = Math.max(activePairedCount, activePeersCount);

    return {
      myLocalIp: this.myLocalIp,
      port: this.syncEngine?.deviceType === 'laptop' ? LAPTOP_PORT : P2P_PORT,
      deviceId: this.syncEngine?.deviceId || this.localServerInfo.deviceId,
      deviceName: this.syncEngine?.deviceName || this.localServerInfo.deviceName || 'My Device',
      pairingCode: this.localServerInfo.pairingCode || this.loadOrGeneratePairingCode(),
      knownPeers: this.knownPeers,
      activePeers: peerList,
      pairedDevices: pairedList,
      nearbyPeers: nearbyList,
      pendingRequests: this.pendingRequests,
      outgoingPairSession: this.outgoingPairSession,
      activeP2PCount: connectedCount,
      isScanning: this.isScanning
    };
  }

  getPeersInfo() {
    return this.getInfo();
  }

  loadOrGeneratePairingCode() {
    let code = localStorage.getItem('synctodo_pairing_code_v1');
    if (!code || code.length !== 6) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      localStorage.setItem('synctodo_pairing_code_v1', code);
    }
    return code;
  }

  getTokenForHost(host) {
    if (!host) return null;
    const cleanHost = String(host).replace(/^.*:\/\//, '').split(':')[0].toLowerCase();
    for (const pd of this.pairedDevices.values()) {
      if (pd.ip && pd.ip.toLowerCase() === cleanHost) return pd.token;
      if (cleanHost === 'g16laptop.local' && (pd.deviceType === 'laptop' || (pd.deviceName && pd.deviceName.toLowerCase().includes('laptop')))) {
        return pd.token;
      }
    }
    // Fallback: If on phone/tablet or connecting across a new network, check paired laptop token
    for (const pd of this.pairedDevices.values()) {
      if ((pd.deviceType === 'laptop' || (pd.deviceName && pd.deviceName.toLowerCase().includes('laptop'))) && pd.token) {
        return pd.token;
      }
    }
    // Universal fallback: if there is only 1 paired device with a token, use it!
    const allWithTokens = Array.from(this.pairedDevices.values()).filter(pd => pd.token);
    if (allWithTokens.length === 1) {
      return allWithTokens[0].token;
    }
    return null;
  }

  loadPairedDevices() {
    const map = new Map();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PAIRED_DEVICES);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(d => {
            if (d && d.deviceId) map.set(d.deviceId, d);
          });
        }
      }
    } catch {}
    return map;
  }

  savePairedDevices() {
    try {
      const arr = Array.from(this.pairedDevices.values());
      localStorage.setItem(STORAGE_KEY_PAIRED_DEVICES, JSON.stringify(arr));
      this.syncEngine?.mirrorToLocalEmbeddedServer();
    } catch (e) {
      console.error(e);
    }
  }

  loadKnownPeers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_KNOWN_PEERS);
      const parsed = raw ? JSON.parse(raw) : [];
      const fromPaired = Array.from(this.pairedDevices.values())
        .map(d => d.ip)
        .filter(Boolean);
      return [...new Set([...(Array.isArray(parsed) ? parsed : []), ...fromPaired])];
    } catch {
      return [];
    }
  }

  saveKnownPeers() {
    try {
      localStorage.setItem(STORAGE_KEY_KNOWN_PEERS, JSON.stringify(this.knownPeers));
    } catch (e) {
      console.error(e);
    }
  }

  loadPeerPorts() {
    const map = new Map();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PEER_PORTS);
      if (raw) {
        const obj = JSON.parse(raw);
        Object.entries(obj).forEach(([k, v]) => map.set(k, Number(v)));
      }
    } catch {}
    return map;
  }

  savePeerPorts() {
    try {
      const obj = {};
      for (const [k, v] of this.peerPorts.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_KEY_PEER_PORTS, JSON.stringify(obj));
    } catch (e) {
      console.error(e);
    }
  }

  recordNearbyPeer(peer) {
    if (!peer || !peer.ip || peer.ip === '127.0.0.1' || peer.ip === this.myLocalIp) return;
    if (this.isSelfDevice(peer)) return;

    const key = peer.deviceId || peer.ip;
    const existing = this.nearbyPeers.get(key) || {};
    const port = Number(peer.port) || existing.port || P2P_PORT;
    const merged = {
      deviceId: peer.deviceId || existing.deviceId || `peer-${peer.ip}`,
      deviceName: peer.deviceName || existing.deviceName || (port === LAPTOP_PORT ? 'Laptop' : 'Nearby Device'),
      deviceType: peer.deviceType || existing.deviceType || (port === LAPTOP_PORT ? 'laptop' : 'phone'),
      ip: peer.ip,
      port,
      tasksCount: typeof peer.tasksCount === 'number' ? peer.tasksCount : (existing.tasksCount || 0),
      lastSeen: Date.now()
    };
    this.nearbyPeers.set(key, merged);
    this.peerPorts.set(peer.ip, port);

    // If this deviceId is ALREADY paired with us, automatically heal its IP & sync!
    if (merged.deviceId && this.pairedDevices.has(merged.deviceId)) {
      const pd = this.pairedDevices.get(merged.deviceId);
      const oldIp = pd.ip;
      pd.ip = merged.ip;
      pd.port = merged.port;
      pd.deviceName = merged.deviceName || pd.deviceName;
      pd.lastSeen = Date.now();
      this.pairedDevices.set(merged.deviceId, pd);
      this.savePairedDevices();

      if (oldIp && oldIp !== merged.ip) {
        this.knownPeers = this.knownPeers.filter(x => x !== oldIp);
      }
      if (!this.knownPeers.includes(merged.ip)) {
        this.knownPeers.push(merged.ip);
        this.saveKnownPeers();
      }

      if (merged.port === LAPTOP_PORT && this.syncEngine) {
        const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isLocalHost) {
          const wsTarget = `ws://${merged.ip}:${LAPTOP_PORT}`;
          if (this.syncEngine.serverUrl !== wsTarget) {
            this.syncEngine.setServerUrl(wsTarget);
          }
        }
      }
    }
  }

  addPeer(ip, port = null, meta = {}) {
    let rawInput = String(ip || '').trim().replace(/^https?:\/\//, '').replace(/^ws:\/\//, '');
    let extractedPort = port;
    if (rawInput.includes(':')) {
      const [h, p] = rawInput.split(':');
      rawInput = h;
      if (!extractedPort && p) extractedPort = parseInt(p, 10);
    }
    const cleanIp = rawInput;
    if (!cleanIp) return;

    if (extractedPort) {
      this.peerPorts.set(cleanIp, Number(extractedPort));
      this.savePeerPorts();
    }

    const effectivePort = Number(extractedPort) || this.peerPorts.get(cleanIp) || P2P_PORT;
    const devId = meta.deviceId || `peer-${cleanIp}`;
    const devName = meta.deviceName || (effectivePort === LAPTOP_PORT ? 'Laptop' : `Device (${cleanIp})`);
    const devType = meta.deviceType || (effectivePort === LAPTOP_PORT ? 'laptop' : 'phone');

    this.pairedDevices.set(devId, {
      deviceId: devId,
      deviceName: devName,
      deviceType: devType,
      ip: cleanIp,
      port: effectivePort,
      token: meta.token || null,
      pairedAt: Date.now(),
      lastSeen: Date.now()
    });
    this.savePairedDevices();

    if (effectivePort === LAPTOP_PORT && this.syncEngine) {
      const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (!isLocalHost) {
        const wsTarget = `ws://${cleanIp}:${LAPTOP_PORT}`;
        if (this.syncEngine.serverUrl !== wsTarget) {
          this.syncEngine.setServerUrl(wsTarget);
        }
      }
    }

    if (!this.knownPeers.includes(cleanIp)) {
      this.knownPeers.push(cleanIp);
      this.saveKnownPeers();
    }

    this.syncWithPeer(cleanIp, effectivePort);
    this.notify();
  }

  removePeer(ipOrDeviceId) {
    // Remove by deviceId or IP
    for (const [devId, pd] of this.pairedDevices.entries()) {
      if (devId === ipOrDeviceId || pd.ip === ipOrDeviceId) {
        this.pairedDevices.delete(devId);
        if (pd.ip) {
          this.knownPeers = this.knownPeers.filter(p => p !== pd.ip);
          this.activePeers.delete(pd.ip);
          this.peerPorts.delete(pd.ip);
        }
      }
    }
    this.knownPeers = this.knownPeers.filter(p => p !== ipOrDeviceId);
    this.activePeers.delete(ipOrDeviceId);
    this.peerPorts.delete(ipOrDeviceId);
    this.savePairedDevices();
    this.saveKnownPeers();
    this.savePeerPorts();

    // Notify local server if applicable
    try {
      const host = window.location.hostname || 'localhost';
      const port = window.location.port || '4000';
      fetch(`http://${host}:${port}/api/p2p/unpair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: ipOrDeviceId })
      }).catch(() => {});
    } catch {}

    this.notify();
  }

  async renameThisDevice(newName) {
    const clean = String(newName || '').trim();
    if (!clean) return;
    this.localServerInfo.deviceName = clean;
    if (this.syncEngine) {
      this.syncEngine.setDeviceName(clean);
    }

    // Update Android embedded server if present
    try {
      await fetch(`http://127.0.0.1:${P2P_PORT}/api/p2p/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: clean })
      });
    } catch {}

    // Update Laptop server if running on laptop
    try {
      const host = window.location.hostname || 'localhost';
      const port = window.location.port || '4000';
      await fetch(`http://${host}:${port}/api/p2p/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: clean })
      });
    } catch {}

    this.notify();
  }

  // Step-by-step friendly pairing with a discovered peer
  async requestPairingWithPeer(peer, code = null) {
    if (!peer || !peer.ip) return { status: 'error', message: 'Device address unavailable' };
    const port = peer.port || this.peerPorts.get(peer.ip) || LAPTOP_PORT;

    this.outgoingPairSession = {
      peer,
      code: code || null,
      status: 'requesting',
      errorMsg: null
    };
    this.notify();

    try {
      const res = await fetch(`http://${peer.ip}:${port}/api/p2p/pair-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.localServerInfo.deviceId || this.syncEngine?.deviceId,
          deviceName: this.localServerInfo.deviceName || this.syncEngine?.deviceName,
          deviceType: this.syncEngine?.deviceType || 'phone',
          ip: this.myLocalIp !== 'Detecting...' ? this.myLocalIp : null,
          port: this.syncEngine?.deviceType === 'laptop' ? LAPTOP_PORT : P2P_PORT,
          code: code ? String(code).replace(/\s+/g, '') : undefined
        })
      });

      const data = await res.json();

      if (data.status === 'paired') {
        this.completePairingSuccess(peer, port, data);
        return { status: 'paired', data };
      } else if (data.status === 'pending') {
        this.outgoingPairSession = {
          peer: {
            ...peer,
            deviceName: data.serverDevice?.deviceName || peer.deviceName
          },
          code: data.code || '------',
          status: 'waiting',
          errorMsg: null
        };
        this.notify();
        this.startPollingPairApproval(peer, port);
        return { status: 'pending', code: data.code };
      } else {
        this.outgoingPairSession = {
          peer,
          code,
          status: 'error',
          errorMsg: data.message || 'Code did not match'
        };
        this.notify();
        return { status: 'error', message: data.message || 'Code did not match' };
      }
    } catch (err) {
      this.outgoingPairSession = {
        peer,
        code,
        status: 'error',
        errorMsg: 'Could not reach device on Wi-Fi'
      };
      this.notify();
      return { status: 'error', message: 'Could not reach device on Wi-Fi' };
    }
  }

  startPollingPairApproval(peer, port) {
    if (this.pairPollTimer) clearInterval(this.pairPollTimer);
    const myDevId = this.localServerInfo.deviceId || this.syncEngine?.deviceId;
    let attempts = 0;

    this.pairPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 60 || !this.outgoingPairSession || this.outgoingPairSession.status !== 'waiting') {
        clearInterval(this.pairPollTimer);
        this.pairPollTimer = null;
        return;
      }

      try {
        const res = await fetch(`http://${peer.ip}:${port}/api/p2p/pair-status?deviceId=${encodeURIComponent(myDevId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'paired') {
            clearInterval(this.pairPollTimer);
            this.pairPollTimer = null;
            this.completePairingSuccess(peer, port, data);
          } else if (data.status === 'declined') {
            clearInterval(this.pairPollTimer);
            this.pairPollTimer = null;
            this.outgoingPairSession = {
              peer,
              code: null,
              status: 'declined',
              errorMsg: 'Pairing was declined on the other device.'
            };
            this.notify();
          }
        }
      } catch {}
    }, 1500);
  }

  completePairingSuccess(peer, port, data) {
    const srv = data.serverDevice || {};
    const finalDevId = srv.deviceId || peer.deviceId || `peer-${peer.ip}`;
    const finalName = srv.deviceName || peer.deviceName || (port === LAPTOP_PORT ? 'Laptop' : 'Device');
    const finalType = srv.deviceType || peer.deviceType || (port === LAPTOP_PORT ? 'laptop' : 'phone');

    this.addPeer(peer.ip, port, {
      deviceId: finalDevId,
      deviceName: finalName,
      deviceType: finalType,
      token: data.token || null
    });

    if (Array.isArray(data.lists)) {
      data.lists.forEach(l => this.syncEngine?.mergeList(l));
      this.syncEngine?.saveStoredLists();
    }
    if (Array.isArray(data.todos)) {
      data.todos.forEach(t => this.syncEngine?.mergeTodo(t));
      this.syncEngine?.saveStoredTodos();
    }
    this.syncEngine?.notify();

    this.outgoingPairSession = {
      peer: {
        ...peer,
        deviceId: finalDevId,
        deviceName: finalName,
        deviceType: finalType
      },
      code: null,
      status: 'paired',
      errorMsg: null
    };
    this.notify();
  }

  cancelOutgoingPairSession() {
    if (this.pairPollTimer) {
      clearInterval(this.pairPollTimer);
      this.pairPollTimer = null;
    }
    this.outgoingPairSession = null;
    this.notify();
  }

  // Pair using only a 6-digit code (auto-locates which nearby device displays that code!)
  async pairBySixDigitCode(rawCode) {
    const cleanCode = String(rawCode || '').replace(/\s+/g, '').trim();
    if (cleanCode.length !== 6) {
      return { status: 'error', message: 'Please enter a 6-digit code.' };
    }

    // 1. Check already discovered nearby peers first
    let candidates = Array.from(this.nearbyPeers.values());
    if (candidates.length === 0) {
      // Run a quick discovery scan to find local devices
      await this.scanLocalNetwork();
      candidates = Array.from(this.nearbyPeers.values());
    }

    // Fallback: Probe mDNS g16laptop.local and paired peers if no candidates found yet
    if (candidates.length === 0) {
      const probeHosts = ['g16laptop.local'];
      if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        probeHosts.push(window.location.hostname);
      }
      this.knownPeers.forEach(p => { if (p) probeHosts.push(p); });
      for (const pd of this.pairedDevices.values()) {
        if (pd.ip) probeHosts.push(pd.ip);
      }

      for (const host of probeHosts) {
        for (const port of [LAPTOP_PORT, P2P_PORT]) {
          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 1200);
            const res = await fetch(`http://${host}:${port}/api/p2p/info`, { signal: ctrl.signal });
            clearTimeout(tid);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'ok') {
                const rec = this.recordNearbyPeer({
                  ip: host,
                  port: data.port || port,
                  deviceId: data.deviceId,
                  deviceName: data.deviceName,
                  deviceType: data.deviceType || data.device
                });
                if (rec) candidates.push(rec);
              }
            }
          } catch {}
        }
      }
    }

    for (const peer of candidates) {
      const result = await this.requestPairingWithPeer(peer, cleanCode);
      if (result.status === 'paired') {
        return result;
      }
    }

    return {
      status: 'error',
      message: candidates.length === 0
        ? 'No nearby SyncToDo devices found on this Wi-Fi yet. Check if Wi-Fi client isolation is active, or connect directly by IP / hostname.'
        : 'Code did not match any nearby device.'
    };
  }

  // Connect directly by IP or hostname (e.g. g16laptop.local or 172.18.x.x on campus Wi-Fi)
  async connectDirectlyByHost(rawHost) {
    if (!rawHost) return { status: 'error', message: 'Please enter an IP or hostname.' };
    const cleanHost = String(rawHost).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const parts = cleanHost.split(':');
    const host = parts[0];
    const ports = parts[1] ? [Number(parts[1])] : [LAPTOP_PORT, P2P_PORT];

    for (const port of ports) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(`http://${host}:${port}/api/p2p/info`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') {
            const devId = data.deviceId || `peer-${host}`;
            const devName = data.deviceName || 'Laptop';
            const devType = data.deviceType || (port === LAPTOP_PORT ? 'laptop' : 'phone');

            this.recordNearbyPeer({
              ip: host,
              port,
              deviceId: devId,
              deviceName: devName,
              deviceType: devType,
              tasksCount: data.tasksCount || 0
            });

            this.peerPorts.set(host, port);
            this.savePeerPorts();

            if (!this.knownPeers.includes(host)) {
              this.knownPeers.push(host);
              this.saveKnownPeers();
            }

            await this.syncWithPeer(host, port);

            if (port === LAPTOP_PORT && this.syncEngine) {
              const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
              if (!isLocalHost) {
                this.syncEngine.setServerUrl(`ws://${host}:${port}`);
              }
            }

            this.notify();
            return { status: 'ok', deviceName: devName, host, port };
          }
        }
      } catch (err) {
        console.warn(`[P2P] Failed direct connection to ${host}:${port}`, err);
      }
    }
    return { status: 'error', message: `Could not reach ${cleanHost} on port 4000 or 4567.` };
  }

  // Pair using QR Code data (URI string, JSON string, or object)
  async pairWithScannedQr(qrData) {
    if (!qrData) return { status: 'error', message: 'Invalid QR code' };

    let ip, port, code, deviceId, deviceName;

    if (typeof qrData === 'string') {
      try {
        if (qrData.startsWith('synctodo://')) {
          const url = new URL(qrData.replace('synctodo://', 'http://'));
          ip = url.hostname;
          port = url.port ? Number(url.port) : P2P_PORT;
          code = url.searchParams.get('code');
          deviceId = url.searchParams.get('deviceId');
          deviceName = url.searchParams.get('name') || url.searchParams.get('deviceName');
        } else if (qrData.startsWith('{')) {
          const parsed = JSON.parse(qrData);
          ip = parsed.ip;
          port = parsed.port || P2P_PORT;
          code = parsed.code;
          deviceId = parsed.deviceId;
          deviceName = parsed.name || parsed.deviceName;
        }
      } catch (err) {
        return { status: 'error', message: 'Could not parse QR code data' };
      }
    } else if (typeof qrData === 'object') {
      ip = qrData.ip;
      port = qrData.port || P2P_PORT;
      code = qrData.code;
      deviceId = qrData.deviceId;
      deviceName = qrData.name || qrData.deviceName;
    }

    if (!ip || !code) {
      return { status: 'error', message: 'QR code does not contain valid pairing data' };
    }

    const peer = {
      ip,
      port: port || P2P_PORT,
      deviceId: deviceId || `peer-${ip}`,
      deviceName: deviceName || `Device (${ip})`
    };

    return await this.requestPairingWithPeer(peer, code);
  }

  // Allow or Decline an incoming pair request on this device
  async respondToPairRequest(reqObj, action = 'allow') {
    if (!reqObj || !reqObj.deviceId) return;

    // Send response to local server (either laptop server or Android LocalPeerServer)
    const endpoints = [];
    if (this.syncEngine?.deviceType === 'laptop') {
      const host = window.location.hostname || 'localhost';
      const port = window.location.port || '4000';
      endpoints.push(`http://${host}:${port}/api/p2p/pair-respond`);
    } else {
      endpoints.push(`http://127.0.0.1:${P2P_PORT}/api/p2p/pair-respond`);
    }

    for (const url of endpoints) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: reqObj.deviceId, action })
        });
      } catch {}
    }

    if (action === 'allow' && reqObj.ip) {
      this.addPeer(reqObj.ip, reqObj.port || P2P_PORT, {
        deviceId: reqObj.deviceId,
        deviceName: reqObj.deviceName,
        deviceType: reqObj.deviceType
      });
    }

    this.pendingRequests = this.pendingRequests.filter(r => r.deviceId !== reqObj.deviceId);
    this.notify();
  }

  async detectLocalIp() {
    // 1. Try local Android embedded server on 127.0.0.1:4567
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${P2P_PORT}/api/p2p/info`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.deviceId) {
          this.localServerInfo.deviceId = data.deviceId;
          if (this.syncEngine && this.syncEngine.deviceId !== data.deviceId) {
            this.syncEngine.deviceId = data.deviceId;
            localStorage.setItem('synctodo_device_id_v1', data.deviceId);
          }
        }
        if (data.deviceName) {
          // Keep device name clean if not laptop
          if (!data.deviceName.toLowerCase().includes('laptop') && !data.deviceName.toLowerCase().includes('g16')) {
            this.localServerInfo.deviceName = data.deviceName;
            if (this.syncEngine && this.syncEngine.deviceName !== data.deviceName) {
              this.syncEngine.deviceName = data.deviceName;
              localStorage.setItem('synctodo_device_name_v1', data.deviceName);
            }
          }
        }
        if (data.pairingCode) this.localServerInfo.pairingCode = data.pairingCode;
        if (data.ip && data.ip !== '127.0.0.1') {
          this.myLocalIp = data.ip;
          this.notify();
          setTimeout(() => this.scanLocalNetwork(), 600);
          return;
        }
      }
    } catch {}

    // 2. Try local Laptop server ONLY if running on desktop/laptop on localhost (never overwrite on mobile!)
    const host = window.location.hostname || 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isLaptop = this.syncEngine?.deviceType === 'laptop';
    if (isLocalhost && isLaptop) {
      try {
        const port = window.location.port || '4000';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`http://${host}:${port}/api/p2p/info`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.deviceId) {
          this.localServerInfo.deviceId = data.deviceId;
          if (this.syncEngine && this.syncEngine.deviceId !== data.deviceId) {
            this.syncEngine.deviceId = data.deviceId;
            localStorage.setItem('synctodo_device_id_v1', data.deviceId);
          }
        }
          if (data.deviceName) this.localServerInfo.deviceName = data.deviceName;
          if (data.pairingCode) this.localServerInfo.pairingCode = data.pairingCode;
          if (data.ip && data.ip !== '127.0.0.1') {
            this.myLocalIp = data.ip;
            this.notify();
            return;
          }
        }
      } catch {}
    }

    // 3. Fallback to WebRTC ICE candidate local IP discovery
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(o => pc.setLocalDescription(o));
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const candidate = ice.candidate.candidate;
        const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (match && match[1] && !match[1].startsWith('127.')) {
          this.myLocalIp = match[1];
          this.notify();
          pc.close();
          setTimeout(() => this.scanLocalNetwork(), 600);
        }
      };
    } catch {
      this.myLocalIp = 'Local Wi-Fi';
      this.notify();
    }
  }

  startBackgroundSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.fetchDiscoveredPeers();
    this.syncAllPeers();

    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.fetchDiscoveredPeers();
        this.syncAllPeers();
      }
    }, 4000);
  }

  async fetchDiscoveredPeers() {
    // 1. Check local Android peer server on 127.0.0.1:4567
    try {
      const res = await fetch(`http://127.0.0.1:${P2P_PORT}/api/p2p/discovered-peers`);
      if (res.ok) {
        const data = await res.json();
        this.ingestDiscoveryResponse(data, true);
      }
    } catch {}

    // 2. Check laptop server ONLY if running locally
    const host = window.location.hostname || 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalhost) {
      try {
        const port = window.location.port || '4000';
        const res = await fetch(`http://${host}:${port}/api/p2p/discovered-peers`);
        if (res.ok) {
          const data = await res.json();
          this.ingestDiscoveryResponse(data, true);
        }
      } catch {}
    }
  }

  ingestDiscoveryResponse(data, isLocal = false) {
    if (!data) return;

    if (isLocal && data.serverInfo) {
      if (data.serverInfo.deviceId) this.localServerInfo.deviceId = data.serverInfo.deviceId;
      if (data.serverInfo.deviceName) this.localServerInfo.deviceName = data.serverInfo.deviceName;
      if (data.serverInfo.pairingCode) this.localServerInfo.pairingCode = data.serverInfo.pairingCode;
      if (data.serverInfo.ip && data.serverInfo.ip !== '127.0.0.1') {
        this.myLocalIp = data.serverInfo.ip;
      }
    } else if (!isLocal && data.serverInfo) {
      // Remote server info belongs to nearby peer, NEVER overwrite this device's identity!
      this.recordNearbyPeer({
        ip: data.serverInfo.ip,
        port: data.serverInfo.port || LAPTOP_PORT,
        deviceId: data.serverInfo.deviceId,
        deviceName: data.serverInfo.deviceName,
        deviceType: data.serverInfo.deviceType || 'laptop'
      });
    }

    if (Array.isArray(data.pairedDevices)) {
      data.pairedDevices.forEach(pd => {
        if (!pd || !pd.deviceId) return;
        if (this.isSelfDevice(pd)) return;
        this.pairedDevices.set(pd.deviceId, pd);
        if (pd.ip && !this.knownPeers.includes(pd.ip)) {
          this.knownPeers.push(pd.ip);
        }
        if (pd.ip && pd.port) {
          this.peerPorts.set(pd.ip, Number(pd.port));
        }
      });
      this.savePairedDevices();
      this.saveKnownPeers();
    }

    if (Array.isArray(data.peers)) {
      data.peers.forEach(p => this.recordNearbyPeer(p));
    }

    if (Array.isArray(data.pendingRequests)) {
      this.pendingRequests = data.pendingRequests;
    }

    this.notify();
  }

  handleSignalingMessage(msg) {
    if (msg.type === 'PAIRING_UPDATE') {
      this.ingestDiscoveryResponse(msg);
    }
  }

  ingestPresenceDevices(devices) {
    if (!Array.isArray(devices)) return;
    let changed = false;
    const now = Date.now();

    devices.forEach(dev => {
      if (!dev || !dev.deviceId) return;
      if (dev.deviceId === this.localServerInfo.deviceId || dev.deviceId === this.syncEngine?.deviceId) return;

      // Update in pairedDevices if paired
      if (this.pairedDevices.has(dev.deviceId)) {
        const pd = this.pairedDevices.get(dev.deviceId);
        pd.lastSeen = now;
        if (dev.deviceName) pd.deviceName = dev.deviceName;
        if (dev.localIp && dev.localIp !== '127.0.0.1') {
          pd.ip = dev.localIp;
          if (!this.knownPeers.includes(dev.localIp)) {
            this.knownPeers.push(dev.localIp);
            this.saveKnownPeers();
          }
        }
        this.savePairedDevices();
        changed = true;
      }

      // Record in nearbyPeers
      if (dev.localIp && dev.localIp !== '127.0.0.1' && dev.localIp !== this.myLocalIp) {
        this.recordNearbyPeer({
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          deviceType: dev.deviceType,
          ip: dev.localIp,
          port: dev.deviceType === 'laptop' ? LAPTOP_PORT : P2P_PORT
        });
      }
    });

    if (changed) {
      this.notify();
      this.syncAllPeers();
    }
  }

  async syncAllPeers() {
    // Gather all target IPs across knownPeers, pairedDevices, and onlineDevices
    const targets = new Set();
    this.knownPeers.forEach(ip => {
      if (ip && ip !== '127.0.0.1' && ip !== this.myLocalIp) targets.add(ip);
    });
    for (const pd of this.pairedDevices.values()) {
      if (pd.ip && pd.ip !== '127.0.0.1' && pd.ip !== this.myLocalIp) targets.add(pd.ip);
    }
    const onlineDevs = this.syncEngine?.onlineDevices || [];
    onlineDevs.forEach(od => {
      if (od.localIp && od.localIp !== '127.0.0.1' && od.localIp !== this.myLocalIp) {
        targets.add(od.localIp);
      }
    });

    // Add multi-network hostnames for automatic re-discovery
    if (this.syncEngine?.deviceType !== 'laptop') {
      targets.add('g16laptop.local');
    }
    if (typeof window !== 'undefined' && window.location.hostname &&
        window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      targets.add(window.location.hostname);
    }

    // Run parallel sync requests with Promise.allSettled so no peer blocks another
    await Promise.allSettled(Array.from(targets).map(ip => this.syncWithPeer(ip)));
  }

  // Direct Peer-to-Peer HTTP Delta & Full Merge Sync (Todos + Lists)
  async syncWithPeer(ip, forcedPort = null) {
    const candidatePorts = forcedPort
      ? [Number(forcedPort), Number(forcedPort) === LAPTOP_PORT ? P2P_PORT : LAPTOP_PORT]
      : this.peerPorts.has(ip)
        ? [this.peerPorts.get(ip), this.peerPorts.get(ip) === P2P_PORT ? LAPTOP_PORT : P2P_PORT]
        : [LAPTOP_PORT, P2P_PORT];

    // Resilient pairing token lookup for this peer
    let token = null;
    let peerMeta = null;
    for (const pd of this.pairedDevices.values()) {
      const matchIp = pd.ip === ip;
      const matchHost = (ip === 'g16laptop.local' && (pd.deviceType === 'laptop' || (pd.deviceName && pd.deviceName.toLowerCase().includes('laptop'))));
      const matchActive = (pd.deviceId && this.activePeers.get(ip)?.deviceId === pd.deviceId);
      const matchNearby = (this.nearbyPeers.get(ip)?.deviceId === pd.deviceId || (pd.deviceId && this.nearbyPeers.get(pd.deviceId)?.ip === ip));
      const matchOnline = (this.syncEngine?.onlineDevices || []).some(od => od.localIp === ip && od.deviceId === pd.deviceId);

      if (matchIp || matchHost || matchActive || matchNearby || matchOnline) {
        token = pd.token;
        peerMeta = pd;
        if (pd.ip !== ip && ip !== 'g16laptop.local' && !ip.includes('.')) {
          pd.ip = ip;
          this.savePairedDevices();
        }
        break;
      }
    }
    // Fallback: If targeting a remote peer or laptop without token, use paired laptop or peer token
    if (!token) {
      for (const pd of this.pairedDevices.values()) {
        if ((pd.deviceType === 'laptop' || (pd.deviceName && pd.deviceName.toLowerCase().includes('laptop'))) && pd.token) {
          token = pd.token;
          peerMeta = pd;
          break;
        }
      }
      if (!token) {
        const allWithTokens = Array.from(this.pairedDevices.values()).filter(pd => pd.token);
        if (allWithTokens.length === 1) {
          token = allWithTokens[0].token;
          peerMeta = allWithTokens[0];
        }
      }
    }

    for (const port of candidatePorts) {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const payload = {
          deviceId: this.localServerInfo.deviceId || this.syncEngine.deviceId,
          deviceName: this.syncEngine?.deviceName || this.localServerInfo.deviceName,
          deviceType: this.syncEngine.deviceType,
          port: this.syncEngine.deviceType === 'laptop' ? LAPTOP_PORT : P2P_PORT,
          todos: this.syncEngine.todos,
          lists: this.syncEngine.lists,
          mutations: this.syncEngine.mutationQueue,
          token,
          timestamp: Date.now()
        };

        const res = await fetch(`http://${ip}:${port}/api/p2p/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.status === 403) {
          // Peer rejected sync because device is not authenticated/paired
          console.warn(`[P2P] Peer ${ip}:${port} rejected sync (unpaired).`);
          if (this.activePeers.has(ip)) {
            this.activePeers.get(ip).status = 'unpaired';
            this.notify();
          }
          return;
        }

        if (res.ok) {
          const peerData = await res.json();
          const latency = Date.now() - startTime;

          this.peerPorts.set(ip, port);
          this.savePeerPorts();

          // Only switch WebSocket serverUrl if this peer is confirmed paired in pairedDevices and we are not localhost!
          if (port === LAPTOP_PORT && this.syncEngine && peerMeta) {
            const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (!isLocalHost) {
              const wsTarget = `ws://${ip}:${LAPTOP_PORT}`;
              if (this.syncEngine.serverUrl !== wsTarget) {
                this.syncEngine.setServerUrl(wsTarget);
              }
            }
          }

          const peerDevId = peerData.deviceId || `peer-${ip}`;
          const peerName = peerData.deviceName || (port === LAPTOP_PORT ? 'Laptop' : 'Device');
          const peerType = peerData.deviceType || (port === LAPTOP_PORT ? 'laptop' : 'phone');

          this.activePeers.set(ip, {
            deviceId: peerDevId,
            deviceName: peerName,
            status: 'connected',
            port,
            deviceType: peerType,
            latency,
            lastSeen: Date.now()
          });

          if (this.pairedDevices.has(peerDevId)) {
            const pd = this.pairedDevices.get(peerDevId);
            pd.ip = ip;
            pd.port = port;
            pd.deviceName = peerName;
            pd.lastSeen = Date.now();
            this.savePairedDevices();
          }

          let changed = false;
          // Merge incoming peer lists
          if (Array.isArray(peerData.lists)) {
            peerData.lists.forEach(l => {
              this.syncEngine.mergeList(l);
              changed = true;
            });
            this.syncEngine.saveStoredLists();
          }

          // Merge incoming peer todos using CRDT conflict resolution
          if (peerData.todos) {
            const incomingList = Array.isArray(peerData.todos) ? peerData.todos : Object.values(peerData.todos);
            incomingList.forEach(t => {
              this.syncEngine.mergeTodo(t);
              changed = true;
            });
            this.syncEngine.saveStoredTodos();
          }

          if (changed) {
            this.syncEngine.notify();
          }

          this.notify();
          return true;
        }
      } catch {}
    }

    const existing = this.activePeers.get(ip);
    if (existing) {
      existing.status = 'unreachable';
      this.notify();
    }
    return false;
  }

  // Discovers nearby SyncToDo devices on the detected Wi-Fi subnet without auto-pairing strangers
  async scanLocalNetwork(customSubnet = null) {
    if (this.isScanning) return;
    this.isScanning = true;
    this.notify();

    await this.fetchDiscoveredPeers();

    const subnetsToScan = new Set();
    if (customSubnet) {
      subnetsToScan.add(customSubnet);
    }

    if (this.myLocalIp && this.myLocalIp.includes('.')) {
      const parts = this.myLocalIp.split('.');
      if (parts.length === 4) {
        subnetsToScan.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }

    for (const subnetPrefix of subnetsToScan) {
      const scanBatches = [];
      const batchSize = 16;

      for (let i = 1; i <= 254; i += batchSize) {
        const batch = [];
        for (let j = i; j < i + batchSize && j <= 254; j++) {
          const targetIp = `${subnetPrefix}.${j}`;
          if (targetIp !== this.myLocalIp) {
            batch.push(targetIp);
          }
        }
        scanBatches.push(batch);
      }

      for (const batch of scanBatches) {
        await Promise.all(batch.map(async (ip) => {
          for (const port of [LAPTOP_PORT, P2P_PORT]) {
            try {
              const ctrl = new AbortController();
              const tid = setTimeout(() => ctrl.abort(), 950);
              const res = await fetch(`http://${ip}:${port}/api/p2p/info`, { signal: ctrl.signal });
              clearTimeout(tid);
              if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                  this.recordNearbyPeer({
                    ip,
                    port: data.port || port,
                    deviceId: data.deviceId,
                    deviceName: data.deviceName,
                    deviceType: data.deviceType || data.device,
                    tasksCount: data.tasksCount || 0
                  });
                  return;
                }
              }
            } catch {}
          }
        }));
      }
    }

    this.isScanning = false;
    this.notify();
  }

  // Broadcast local mutation directly to all active paired LAN peers
  broadcastMutationToPeers() {
    const targets = new Set();
    this.knownPeers.forEach(ip => {
      if (ip && ip !== '127.0.0.1' && ip !== this.myLocalIp) targets.add(ip);
    });
    for (const pd of this.pairedDevices.values()) {
      if (pd.ip && pd.ip !== '127.0.0.1' && pd.ip !== this.myLocalIp) targets.add(pd.ip);
    }
    const onlineDevs = this.syncEngine?.onlineDevices || [];
    onlineDevs.forEach(od => {
      if (od.localIp && od.localIp !== '127.0.0.1' && od.localIp !== this.myLocalIp) {
        targets.add(od.localIp);
      }
    });

    targets.forEach(ip => {
      this.syncWithPeer(ip).catch(() => {});
    });
  }
}
