package com.synctodo.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Decentralized Local Peer-to-Peer HTTP, mDNS & UDP Sync Server
 * Runs directly on Android Phone and Tablet with CRDT merge and friendly pairing.
 */
public class LocalPeerServer {
    private static final String TAG = "LocalPeerServer";
    public static final int HTTP_PORT = 4567;
    public static final int UDP_DISCOVERY_PORT = 4568;
    private static final String NSD_SERVICE_TYPE = "_synctodo._tcp.";

    private final Context context;
    private ServerSocket serverSocket;
    private DatagramSocket udpSocket;
    private boolean isRunning = false;
    private String localIp = "127.0.0.1";
    private final File dataFile;
    private final File metaFile;

    private String deviceId;
    private String deviceName;
    private String pairingCode;

    // key (deviceId or ip) -> JSONObject { deviceId, deviceName, ip, port, deviceType, tasksCount, lastSeen }
    private final Map<String, JSONObject> discoveredPeers = new ConcurrentHashMap<>();
    // deviceId -> JSONObject { requestId, deviceId, deviceName, deviceType, ip, port, code, status, token, createdAt }
    private final Map<String, JSONObject> pendingPairRequests = new ConcurrentHashMap<>();
    // deviceId -> JSONObject { deviceId, deviceName, deviceType, ip, port, token, pairedAt, lastSeen }
    private final Map<String, JSONObject> pairedDevices = new ConcurrentHashMap<>();

    private WifiManager.MulticastLock multicastLock;
    private NsdManager nsdManager;
    private NsdManager.RegistrationListener nsdRegistrationListener;
    private NsdManager.DiscoveryListener nsdDiscoveryListener;

    public LocalPeerServer(Context context) {
        this.context = context;
        File filesDir = context.getFilesDir();
        this.dataFile = new File(filesDir, "synctodo_store.json");
        this.metaFile = new File(filesDir, "synctodo_meta.json");
        loadOrInitMeta();
    }

    private synchronized void loadOrInitMeta() {
        String defaultModel = Build.MODEL != null && !Build.MODEL.isEmpty() ? Build.MODEL : "Android Phone";
        this.deviceId = "android-" + UUID.randomUUID().toString().substring(0, 8);
        this.deviceName = defaultModel;
        this.pairingCode = String.valueOf(100000 + new Random().nextInt(900000));

        if (metaFile.exists()) {
            try (BufferedReader r = new BufferedReader(new FileReader(metaFile))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                JSONObject meta = new JSONObject(sb.toString());
                this.deviceId = meta.optString("deviceId", this.deviceId);
                this.deviceName = meta.optString("deviceName", this.deviceName);
                this.pairingCode = meta.optString("pairingCode", this.pairingCode);
                JSONObject pairedObj = meta.optJSONObject("pairedDevices");
                if (pairedObj != null) {
                    Iterator<String> keys = pairedObj.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        JSONObject pd = pairedObj.optJSONObject(k);
                        if (pd != null) pairedDevices.put(k, pd);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to read meta file, using defaults", e);
            }
        }
        saveMeta();
    }

    private synchronized void saveMeta() {
        try {
            JSONObject meta = new JSONObject();
            meta.put("deviceId", deviceId);
            meta.put("deviceName", deviceName);
            meta.put("pairingCode", pairingCode);
            JSONObject pairedObj = new JSONObject();
            for (Map.Entry<String, JSONObject> entry : pairedDevices.entrySet()) {
                pairedObj.put(entry.getKey(), entry.getValue());
            }
            meta.put("pairedDevices", pairedObj);
            try (FileWriter fw = new FileWriter(metaFile)) {
                fw.write(meta.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to save meta", e);
        }
    }

    public void start() {
        if (isRunning) return;
        isRunning = true;
        this.localIp = getLocalWifiIp();

        try {
            WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                multicastLock = wifiManager.createMulticastLock("SyncToDoMulticast");
                multicastLock.setReferenceCounted(true);
                multicastLock.acquire();
                Log.i(TAG, "MulticastLock acquired for UDP & mDNS discovery");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire MulticastLock", e);
        }

        Log.i(TAG, "Starting Decentralized P2P Server on " + localIp + ":" + HTTP_PORT + " as " + deviceName);

        new Thread(this::runHttpLoop, "SyncToDo-P2P-HTTP").start();
        new Thread(this::runUdpDiscoveryLoop, "SyncToDo-P2P-UDP").start();
        new Thread(this::runUdpBeaconBroadcastLoop, "SyncToDo-P2P-Beacon").start();
        startMdnsDiscovery();
    }

    public void stop() {
        isRunning = false;
        stopMdnsDiscovery();
        try {
            if (multicastLock != null && multicastLock.isHeld()) {
                multicastLock.release();
            }
        } catch (Exception ignored) {}
        try {
            if (serverSocket != null) serverSocket.close();
            if (udpSocket != null) udpSocket.close();
        } catch (IOException e) {
            Log.e(TAG, "Error stopping server", e);
        }
    }

    private void startMdnsDiscovery() {
        try {
            nsdManager = (NsdManager) context.getApplicationContext().getSystemService(Context.NSD_SERVICE);
            if (nsdManager == null) return;

            NsdServiceInfo serviceInfo = new NsdServiceInfo();
            serviceInfo.setServiceName("SyncToDo-" + deviceName.replaceAll("[^a-zA-Z0-9_-]", "") + "-" + deviceId.substring(Math.max(0, deviceId.length() - 4)));
            serviceInfo.setServiceType(NSD_SERVICE_TYPE);
            serviceInfo.setPort(HTTP_PORT);

            nsdRegistrationListener = new NsdManager.RegistrationListener() {
                @Override public void onServiceRegistered(NsdServiceInfo info) {}
                @Override public void onRegistrationFailed(NsdServiceInfo info, int err) {}
                @Override public void onServiceUnregistered(NsdServiceInfo info) {}
                @Override public void onUnregistrationFailed(NsdServiceInfo info, int err) {}
            };
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, nsdRegistrationListener);

            nsdDiscoveryListener = new NsdManager.DiscoveryListener() {
                @Override public void onDiscoveryStarted(String regType) {}
                @Override public void onServiceFound(NsdServiceInfo service) {
                    if (!service.getServiceType().contains("_synctodo")) return;
                    try {
                        nsdManager.resolveService(service, new NsdManager.ResolveListener() {
                            @Override public void onResolveFailed(NsdServiceInfo s, int err) {}
                            @Override public void onServiceResolved(NsdServiceInfo resolved) {
                                InetAddress host = resolved.getHost();
                                if (host != null) {
                                    String ip = host.getHostAddress();
                                    int port = resolved.getPort();
                                    if (ip != null && !ip.equals(localIp) && !ip.equals("127.0.0.1")) {
                                        recordDiscoveredPeer(ip, port, "peer", null, resolved.getServiceName(), 0);
                                    }
                                }
                            }
                        });
                    } catch (Exception ignored) {}
                }
                @Override public void onServiceLost(NsdServiceInfo service) {}
                @Override public void onDiscoveryStopped(String serviceType) {}
                @Override public void onStartDiscoveryFailed(String serviceType, int errorCode) {}
                @Override public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
            };
            nsdManager.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, nsdDiscoveryListener);
        } catch (Exception e) {
            Log.w(TAG, "mDNS setup note", e);
        }
    }

    private void stopMdnsDiscovery() {
        try {
            if (nsdManager != null) {
                if (nsdRegistrationListener != null) nsdManager.unregisterService(nsdRegistrationListener);
                if (nsdDiscoveryListener != null) nsdManager.stopServiceDiscovery(nsdDiscoveryListener);
            }
        } catch (Exception ignored) {}
    }

    private void recordDiscoveredPeer(String ip, int port, String deviceType, String peerId, String peerName, int tasksCount) {
        if (ip == null || ip.isEmpty() || ip.equals("127.0.0.1") || ip.equals(localIp)) return;
        if (peerId != null && peerId.equals(this.deviceId)) return;

        try {
            String key = (peerId != null && !peerId.isEmpty()) ? peerId : ip;
            JSONObject existing = discoveredPeers.get(key);
            JSONObject obj = existing != null ? existing : new JSONObject();

            String finalId = (peerId != null && !peerId.isEmpty()) ? peerId : obj.optString("deviceId", "peer-" + ip);
            String finalName = (peerName != null && !peerName.isEmpty()) ? peerName : obj.optString("deviceName", "laptop".equals(deviceType) ? "Laptop" : "Nearby Device");

            obj.put("deviceId", finalId);
            obj.put("deviceName", finalName);
            obj.put("ip", ip);
            obj.put("port", port > 0 ? port : 4567);
            obj.put("deviceType", deviceType != null ? deviceType : "peer");
            obj.put("tasksCount", tasksCount > 0 ? tasksCount : obj.optInt("tasksCount", 0));
            obj.put("lastSeen", System.currentTimeMillis());

            discoveredPeers.put(key, obj);

            if (pairedDevices.containsKey(finalId)) {
                JSONObject pd = pairedDevices.get(finalId);
                if (pd != null) {
                    pd.put("ip", ip);
                    pd.put("port", port > 0 ? port : 4567);
                    pd.put("deviceName", finalName);
                    pd.put("lastSeen", System.currentTimeMillis());
                    saveMeta();
                }
            }
        } catch (Exception ignored) {}
    }

    private void runHttpLoop() {
        try {
            serverSocket = new ServerSocket(HTTP_PORT);
            serverSocket.setReuseAddress(true);
            while (isRunning) {
                try {
                    Socket client = serverSocket.accept();
                    new Thread(() -> handleHttpClient(client)).start();
                } catch (IOException e) {
                    if (!isRunning) break;
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "Could not bind HTTP server to port " + HTTP_PORT, e);
        }
    }

    private void handleHttpClient(Socket socket) {
        try (
            InputStream in = socket.getInputStream();
            OutputStream out = socket.getOutputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))
        ) {
            String line = reader.readLine();
            if (line == null) return;

            String[] parts = line.split(" ");
            String method = parts.length > 0 ? parts[0] : "GET";
            String fullPath = parts.length > 1 ? parts[1] : "/";

            int contentLength = 0;
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                if (line.toLowerCase().startsWith("content-length:")) {
                    try {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    } catch (NumberFormatException ignored) {}
                }
            }

            if ("OPTIONS".equalsIgnoreCase(method)) {
                sendResponse(out, "200 OK", "application/json", "{}");
                return;
            }

            String body = "";
            if (contentLength > 0) {
                char[] buf = new char[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int r = reader.read(buf, read, contentLength - read);
                    if (r == -1) break;
                    read += r;
                }
                body = new String(buf, 0, read);
            }

            this.localIp = getLocalWifiIp();

            if (fullPath.startsWith("/api/p2p/info")) {
                JSONObject info = new JSONObject();
                info.put("status", "ok");
                info.put("device", "android");
                info.put("deviceType", "phone");
                info.put("deviceId", deviceId);
                info.put("deviceName", deviceName);
                info.put("pairingCode", pairingCode);
                info.put("tasksCount", getActiveTasksCount());
                info.put("ip", localIp);
                info.put("port", HTTP_PORT);
                sendResponse(out, "200 OK", "application/json", info.toString());

            } else if (fullPath.startsWith("/api/p2p/rename")) {
                if (!body.isEmpty()) {
                    JSONObject req = new JSONObject(body);
                    String newName = req.optString("deviceName", "").trim();
                    if (!newName.isEmpty()) {
                        this.deviceName = newName;
                        saveMeta();
                    }
                }
                JSONObject res = new JSONObject();
                res.put("status", "ok");
                res.put("deviceId", deviceId);
                res.put("deviceName", deviceName);
                res.put("pairingCode", pairingCode);
                sendResponse(out, "200 OK", "application/json", res.toString());

            } else if (fullPath.startsWith("/api/p2p/discovered-peers")) {
                JSONObject res = new JSONObject();
                res.put("status", "ok");

                JSONObject serverInfo = new JSONObject();
                serverInfo.put("deviceId", deviceId);
                serverInfo.put("deviceName", deviceName);
                serverInfo.put("deviceType", "phone");
                serverInfo.put("pairingCode", pairingCode);
                serverInfo.put("ip", localIp);
                serverInfo.put("port", HTTP_PORT);
                res.put("serverInfo", serverInfo);

                JSONArray peersArr = new JSONArray();
                long now = System.currentTimeMillis();
                for (JSONObject p : discoveredPeers.values()) {
                    if (now - p.optLong("lastSeen", 0) < 90000) {
                        JSONObject copy = new JSONObject(p.toString());
                        copy.put("isPaired", pairedDevices.containsKey(copy.optString("deviceId")));
                        peersArr.put(copy);
                    }
                }
                res.put("peers", peersArr);

                JSONArray pairedArr = new JSONArray();
                for (JSONObject pd : pairedDevices.values()) {
                    pairedArr.put(pd);
                }
                res.put("pairedDevices", pairedArr);

                JSONArray pendingArr = new JSONArray();
                for (JSONObject pr : pendingPairRequests.values()) {
                    if (now - pr.optLong("createdAt", 0) < 120000 && "pending".equals(pr.optString("status"))) {
                        pendingArr.put(pr);
                    }
                }
                res.put("pendingRequests", pendingArr);
                sendResponse(out, "200 OK", "application/json", res.toString());

            } else if (fullPath.startsWith("/api/p2p/pair-request")) {
                JSONObject req = body.isEmpty() ? new JSONObject() : new JSONObject(body);
                String reqDevId = req.optString("deviceId", "peer-" + System.currentTimeMillis());
                String reqName = req.optString("deviceName", "Nearby Device");
                String reqType = req.optString("deviceType", "peer");
                String reqIp = req.optString("ip", socket.getInetAddress().getHostAddress());
                int reqPort = req.optInt("port", 4567);
                String code = req.optString("code", "").replaceAll("\\s+", "");

                recordDiscoveredPeer(reqIp, reqPort, reqType, reqDevId, reqName, 0);

                if (!code.isEmpty() && code.equals(pairingCode)) {
                    String token = "tok-" + UUID.randomUUID().toString().substring(0, 8);
                    JSONObject pd = new JSONObject();
                    pd.put("deviceId", reqDevId);
                    pd.put("deviceName", reqName);
                    pd.put("deviceType", reqType);
                    pd.put("ip", reqIp);
                    pd.put("port", reqPort);
                    pd.put("token", token);
                    pd.put("pairedAt", System.currentTimeMillis());
                    pd.put("lastSeen", System.currentTimeMillis());
                    pairedDevices.put(reqDevId, pd);
                    pendingPairRequests.remove(reqDevId);
                    saveMeta();

                    JSONObject store = readCurrentStoreJson();
                    JSONObject res = new JSONObject();
                    res.put("status", "paired");
                    res.put("token", token);
                    JSONObject srv = new JSONObject();
                    srv.put("deviceId", deviceId);
                    srv.put("deviceName", deviceName);
                    srv.put("deviceType", "phone");
                    srv.put("ip", localIp);
                    srv.put("port", HTTP_PORT);
                    res.put("serverDevice", srv);
                    res.put("todos", store.optJSONArray("todosArray") != null ? store.optJSONArray("todosArray") : todosMapToArray(store.optJSONObject("todos")));
                    res.put("lists", store.optJSONArray("lists"));
                    sendResponse(out, "200 OK", "application/json", res.toString());
                } else if (!code.isEmpty()) {
                    sendResponse(out, "400 Bad Request", "application/json", "{\"status\":\"invalid_code\",\"message\":\"Code did not match\"}");
                } else {
                    JSONObject pr = new JSONObject();
                    pr.put("requestId", "req-" + System.currentTimeMillis());
                    pr.put("deviceId", reqDevId);
                    pr.put("deviceName", reqName);
                    pr.put("deviceType", reqType);
                    pr.put("ip", reqIp);
                    pr.put("port", reqPort);
                    pr.put("code", pairingCode);
                    pr.put("status", "pending");
                    pr.put("createdAt", System.currentTimeMillis());
                    pendingPairRequests.put(reqDevId, pr);

                    JSONObject res = new JSONObject();
                    res.put("status", "pending");
                    res.put("code", pairingCode);
                    sendResponse(out, "200 OK", "application/json", res.toString());
                }

            } else if (fullPath.startsWith("/api/p2p/pair-respond")) {
                JSONObject req = body.isEmpty() ? new JSONObject() : new JSONObject(body);
                String targetId = req.optString("deviceId");
                String action = req.optString("action");
                JSONObject pr = pendingPairRequests.get(targetId);
                if (pr != null && "allow".equals(action)) {
                    String token = "tok-" + UUID.randomUUID().toString().substring(0, 8);
                    pr.put("status", "paired");
                    pr.put("token", token);
                    JSONObject pd = new JSONObject();
                    pd.put("deviceId", targetId);
                    pd.put("deviceName", pr.optString("deviceName", "Device"));
                    pd.put("deviceType", pr.optString("deviceType", "peer"));
                    pd.put("ip", pr.optString("ip"));
                    pd.put("port", pr.optInt("port", 4567));
                    pd.put("token", token);
                    pd.put("pairedAt", System.currentTimeMillis());
                    pd.put("lastSeen", System.currentTimeMillis());
                    pairedDevices.put(targetId, pd);
                    saveMeta();
                    sendResponse(out, "200 OK", "application/json", "{\"status\":\"paired\"}");
                } else {
                    if (pr != null) pr.put("status", "declined");
                    sendResponse(out, "200 OK", "application/json", "{\"status\":\"declined\"}");
                }

            } else if (fullPath.startsWith("/api/p2p/sync")) {
                if ("POST".equalsIgnoreCase(method) && !body.isEmpty()) {
                    mergeIncomingSyncPayload(body, socket.getInetAddress().getHostAddress());
                }
                JSONObject currentStore = readCurrentStoreJson();
                JSONObject res = new JSONObject();
                res.put("status", "ok");
                res.put("deviceId", deviceId);
                res.put("deviceName", deviceName);
                res.put("deviceType", "phone");
                res.put("todos", todosMapToArray(currentStore.optJSONObject("todos")));
                res.put("lists", currentStore.optJSONArray("lists") != null ? currentStore.optJSONArray("lists") : new JSONArray());
                res.put("mutations", currentStore.optJSONArray("mutations") != null ? currentStore.optJSONArray("mutations") : new JSONArray());
                res.put("timestamp", System.currentTimeMillis());
                sendResponse(out, "200 OK", "application/json", res.toString());
            } else {
                sendResponse(out, "404 Not Found", "text/plain", "Not Found");
            }
        } catch (Exception e) {
            Log.e(TAG, "HTTP client handling error", e);
        }
    }

    private JSONArray todosMapToArray(JSONObject todosMap) {
        JSONArray arr = new JSONArray();
        if (todosMap == null) return arr;
        Iterator<String> keys = todosMap.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            JSONObject t = todosMap.optJSONObject(k);
            if (t != null) arr.put(t);
        }
        return arr;
    }

    private int getActiveTasksCount() {
        try {
            JSONObject store = readCurrentStoreJson();
            JSONObject todos = store.optJSONObject("todos");
            if (todos == null) return 0;
            int count = 0;
            Iterator<String> keys = todos.keys();
            while (keys.hasNext()) {
                JSONObject t = todos.optJSONObject(keys.next());
                if (t != null && t.isNull("deletedAt")) count++;
            }
            return count;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Proper Last-Write-Wins CRDT merge for both Todos and Lists on Android
     */
    private synchronized void mergeIncomingSyncPayload(String body, String senderIp) {
        try {
            JSONObject incoming = new JSONObject(body);
            String peerDevId = incoming.optString("deviceId", null);
            String peerDevName = incoming.optString("deviceName", null);
            String peerDevType = incoming.optString("deviceType", "peer");
            int peerPort = incoming.optInt("port", 4567);

            if (senderIp != null && !senderIp.equals("127.0.0.1")) {
                recordDiscoveredPeer(senderIp, peerPort, peerDevType, peerDevId, peerDevName, 0);
            }

            JSONObject store = readCurrentStoreJson();
            JSONObject todosMap = store.optJSONObject("todos");
            if (todosMap == null) {
                todosMap = new JSONObject();
                store.put("todos", todosMap);
            }
            JSONArray listsArr = store.optJSONArray("lists");
            if (listsArr == null) {
                listsArr = new JSONArray();
                store.put("lists", listsArr);
            }

            // 1. Merge incoming todos (either JSONObject map or JSONArray)
            Object rawTodos = incoming.opt("todos");
            if (rawTodos instanceof JSONObject) {
                JSONObject inMap = (JSONObject) rawTodos;
                Iterator<String> keys = inMap.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject inTodo = inMap.optJSONObject(id);
                    mergeSingleTodo(todosMap, inTodo);
                }
            } else if (rawTodos instanceof JSONArray) {
                JSONArray inArr = (JSONArray) rawTodos;
                for (int i = 0; i < inArr.length(); i++) {
                    mergeSingleTodo(todosMap, inArr.optJSONObject(i));
                }
            }

            // 2. Merge incoming lists by id
            JSONArray inLists = incoming.optJSONArray("lists");
            if (inLists != null) {
                Map<String, JSONObject> listById = new LinkedHashMap<>();
                for (int i = 0; i < listsArr.length(); i++) {
                    JSONObject l = listsArr.optJSONObject(i);
                    if (l != null && l.has("id")) listById.put(l.optString("id"), l);
                }
                for (int i = 0; i < inLists.length(); i++) {
                    JSONObject inList = inLists.optJSONObject(i);
                    if (inList != null && inList.has("id")) {
                        String lid = inList.optString("id");
                        listById.put(lid, inList);
                    }
                }
                JSONArray mergedLists = new JSONArray();
                for (JSONObject l : listById.values()) mergedLists.put(l);
                store.put("lists", mergedLists);
            }

            store.put("lastUpdated", System.currentTimeMillis());
            try (FileWriter writer = new FileWriter(dataFile)) {
                writer.write(store.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error merging sync payload", e);
        }
    }

    private void mergeSingleTodo(JSONObject todosMap, JSONObject inTodo) {
        if (inTodo == null) return;
        String id = inTodo.optString("id", "");
        if (id.isEmpty()) return;
        try {
            JSONObject existing = todosMap.optJSONObject(id);
            long inUpdated = inTodo.optLong("updatedAt", 0);
            long exUpdated = existing != null ? existing.optLong("updatedAt", 0) : -1;
            if (existing == null || inUpdated >= exUpdated) {
                todosMap.put(id, inTodo);
            }
        } catch (Exception ignored) {}
    }

    private synchronized JSONObject readCurrentStoreJson() {
        if (!dataFile.exists()) {
            try {
                JSONObject empty = new JSONObject();
                empty.put("todos", new JSONObject());
                empty.put("lists", new JSONArray());
                empty.put("mutations", new JSONArray());
                empty.put("lastUpdated", System.currentTimeMillis());
                return empty;
            } catch (Exception e) {
                return new JSONObject();
            }
        }
        try (BufferedReader reader = new BufferedReader(new FileReader(dataFile))) {
            StringBuilder sb = new StringBuilder();
            String l;
            while ((l = reader.readLine()) != null) sb.append(l);
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private void runUdpDiscoveryLoop() {
        try {
            udpSocket = new DatagramSocket(UDP_DISCOVERY_PORT);
            udpSocket.setBroadcast(true);
            byte[] buf = new byte[1024];

            while (isRunning) {
                DatagramPacket packet = new DatagramPacket(buf, buf.length);
                udpSocket.receive(packet);

                String msg = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
                if (msg.startsWith("SYNCTODO_DISCOVER")) {
                    String encName = URLEncoder.encode(deviceName, "UTF-8");
                    String reply = "SYNCTODO_OFFER:" + localIp + ":" + HTTP_PORT + ":phone:" + deviceId + ":" + encName + ":" + getActiveTasksCount();
                    byte[] replyBytes = reply.getBytes(StandardCharsets.UTF_8);
                    DatagramPacket replyPacket = new DatagramPacket(replyBytes, replyBytes.length, packet.getAddress(), packet.getPort());
                    udpSocket.send(replyPacket);
                } else if (msg.startsWith("SYNCTODO_BEACON:") || msg.startsWith("SYNCTODO_OFFER:")) {
                    String[] parts = msg.split(":");
                    if (parts.length >= 2) {
                        String peerIp = parts[1].trim();
                        int peerPort = HTTP_PORT;
                        if (parts.length >= 3) {
                            try { peerPort = Integer.parseInt(parts[2].trim()); } catch (Exception ignored) {}
                        }
                        String peerDevType = parts.length >= 4 ? parts[3].trim() : "peer";
                        String peerDevId = parts.length >= 5 ? parts[4].trim() : null;
                        String peerDevName = parts.length >= 6 ? URLDecoder.decode(parts[5].trim(), "UTF-8") : null;
                        int peerTasks = 0;
                        if (parts.length >= 7) {
                            try { peerTasks = Integer.parseInt(parts[6].trim()); } catch (Exception ignored) {}
                        }

                        recordDiscoveredPeer(peerIp, peerPort, peerDevType, peerDevId, peerDevName, peerTasks);
                    }
                }
            }
        } catch (IOException e) {
            if (isRunning) Log.e(TAG, "UDP discovery error", e);
        }
    }

    private List<InetAddress> getBroadcastAddresses() {
        List<InetAddress> broadcastList = new ArrayList<>();
        try {
            for (Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces(); en.hasMoreElements();) {
                NetworkInterface intf = en.nextElement();
                if (intf.isLoopback() || !intf.isUp()) continue;
                for (InterfaceAddress address : intf.getInterfaceAddresses()) {
                    InetAddress broadcast = address.getBroadcast();
                    if (broadcast != null && broadcast instanceof Inet4Address) {
                        broadcastList.add(broadcast);
                    }
                }
            }
        } catch (Exception ignored) {}
        try {
            broadcastList.add(InetAddress.getByName("255.255.255.255"));
        } catch (Exception ignored) {}
        return broadcastList;
    }

    private void runUdpBeaconBroadcastLoop() {
        while (isRunning) {
            try {
                this.localIp = getLocalWifiIp();
                if (localIp != null && !localIp.equals("127.0.0.1") && udpSocket != null && !udpSocket.isClosed()) {
                    String encName = URLEncoder.encode(deviceName, "UTF-8");
                    String beacon = "SYNCTODO_BEACON:" + localIp + ":" + HTTP_PORT + ":phone:" + deviceId + ":" + encName + ":" + getActiveTasksCount();
                    byte[] bytes = beacon.getBytes(StandardCharsets.UTF_8);
                    String discover = "SYNCTODO_DISCOVER";
                    byte[] discoverBytes = discover.getBytes(StandardCharsets.UTF_8);

                    for (InetAddress bcast : getBroadcastAddresses()) {
                        try {
                            udpSocket.send(new DatagramPacket(bytes, bytes.length, bcast, UDP_DISCOVERY_PORT));
                            udpSocket.send(new DatagramPacket(discoverBytes, discoverBytes.length, bcast, UDP_DISCOVERY_PORT));
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception ignored) {}

            try {
                Thread.sleep(4000);
            } catch (InterruptedException e) {
                break;
            }
        }
    }

    private void sendResponse(OutputStream out, String status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String header = "HTTP/1.1 " + status + "\r\n" +
                "Content-Type: " + contentType + "; charset=utf-8\r\n" +
                "Content-Length: " + bytes.length + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: *\r\n" +
                "Connection: close\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(bytes);
        out.flush();
    }

    private String getLocalWifiIp() {
        try {
            WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null && wifiManager.getConnectionInfo() != null) {
                int ip = wifiManager.getConnectionInfo().getIpAddress();
                if (ip != 0) {
                    return String.format(Locale.US, "%d.%d.%d.%d",
                            (ip & 0xff),
                            (ip >> 8 & 0xff),
                            (ip >> 16 & 0xff),
                            (ip >> 24 & 0xff));
                }
            }
        } catch (Exception ignored) {}

        try {
            for (Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces(); en.hasMoreElements();) {
                NetworkInterface intf = en.nextElement();
                if (intf.isLoopback() || !intf.isUp()) continue;
                for (Enumeration<InetAddress> enumIpAddr = intf.getInetAddresses(); enumIpAddr.hasMoreElements();) {
                    InetAddress inetAddress = enumIpAddr.nextElement();
                    if (!inetAddress.isLoopbackAddress() && inetAddress instanceof Inet4Address) {
                        String addr = inetAddress.getHostAddress();
                        if (addr != null && (addr.startsWith("192.168.") || addr.startsWith("10.") || addr.startsWith("172."))) {
                            return addr;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }
}
