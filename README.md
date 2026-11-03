# 🚀 SyncToDo

> **Decentralized, Local-First, Peer-to-Peer Cross-Device Task & Life Manager**  
> Seamlessly syncing across **Android Phone**, **Android Tablet (S-Pen / Stylus)**, and **Laptop / Desktop (Web)** with **zero cloud or external server dependency**.

---

## 🌟 Overview

**SyncToDo** is designed for people who value privacy, speed, and reliability. It runs entirely on your local Wi-Fi network and device storage. Whether you are on an airplane, working on a home network, or sharing a mobile hotspot, your tasks, notes, checklists, and stylus handwriting stay in sync without touching any third-party cloud.

---

## ✨ Key Features

### ⚡ 1. Friendly Device Discovery & Zero-Config Pairing
- **No IP Entry Required**: Devices automatically discover each other over local Wi-Fi using **UDP broadcast beacons** (`port 4568`) and Android **mDNS / DNS-SD** (`_synctodo._tcp`).
- **Friendly Device Names**: Devices appear as editable friendly names (e.g. `My Laptop`, `Galaxy S24`, `Tab S9`) instead of raw IP addresses.
- **1-Tap Pairing & 6-Digit Code**: Tap **Pair** next to any discovered peer to show an **Allow / Decline** banner on the other screen, or match with a visual 6-digit security code.
- **Auto-Healing Wi-Fi Reconnection**: Paired devices remember each other by unique `deviceId`. When your Wi-Fi router assigns new IP addresses via DHCP, devices automatically heal their connection and continue syncing.
- **Embedded Mobile Peer Server**: Android devices run their own background peer listener (`LocalPeerServer.java` on port `4567`). Phone and tablet can sync directly peer-to-peer even when your laptop is turned off.
- **Full CRDT LWW Sync**: Conflict-free resolution ensures tasks and custom lists merge smoothly across all active devices.

### ✍️ 2. Stylus & Samsung S-Pen Support
- **Inline Handwriting Strip**: Toggle an inline drawing strip directly inside the quick-add bar to write or scribble notes on the fly.
- **Full Canvas Modal**: High-resolution drawing pad with stylus pressure sensitivity, stroke smoothing, pen color/thickness presets, and dedicated eraser mode.
- **Attached Sketches**: View and edit handwritten notes directly inside task cards and the inspector panel.

### 🧠 3. Natural-Language Smart Quick-Add
- Type naturally into the task creation input and watch real-time preview chips appear:
  - `Call dentist tomorrow 6pm #Personal !high every week`
  - Detects:
    - 📅 **Dates**: `today`, `tomorrow`, `monday`–`sunday`, `next week`, `in 3 days`
    - ⏰ **Times**: `6pm`, `17:30`, `9:15am`
    - 📁 **Lists**: `#Work`, `#Personal`, `#Shopping`, `#Homework`
    - 🚩 **Priorities**: `!high`, `!med`, `!low`
    - 🔁 **Recurrence**: `daily`, `weekdays`, `weekly`, `monthly`, `every N days`

### 📋 4. Task Details Inspector & Subtasks (Steps)
- Click or tap any task to open the **Inspector Panel** (right-side drawer on desktop/tablet, bottom sheet on phone):
  - Inline Title & Notes editing
  - Subtasks / Checklist (`✓ 2/4 steps completed`) with easy add & toggle
  - Due Date chips (`Today`, `Tomorrow`, custom date picker) and reminder times
  - Recurrence interval configuration
  - List & Priority selectors
  - Attached stylus handwriting previews

### ☀️ 5. My Day & Smart Leftovers Management
- **My Day Focus View**: Plan your focus for today with a live circular SVG progress ring (`done / total`).
- **Overdue & Leftovers Banner**: Unfinished tasks from yesterday or earlier days trigger an intelligent carry-forward banner with:
  - **Bring all**: Instantly move all leftovers to today's focus.
  - **Choose…**: Pick individual tasks from a checklist.
  - **Dismiss**: Hide the reminder for the day.
- **Daily Planner / Triage Modal**: Quickly review backlog tasks across all lists and toggle them into My Day.

### 🎨 6. 8 Aesthetic Themes & Auto-Scheduler
- Includes 4 Dark and 4 Light themes:
  - **Nordic Glass**: Frosted translucent slate and indigo accents.
  - **Cyber Matrix**: Deep OLED black with vivid emerald highlights.
  - **Clean Studio**: Crisp Swiss monochrome typography.
  - **Warm Journal**: Cozy cream and terracotta paper tone.
  - Plus **Minimalist Light**, **Solar Warmth**, **Soft Lavender**, and **Ocean Mist**.
- **Theme Scheduling Engine**: Automatically switch themes based on system dark mode or user-configured sunrise/sunset times.

### 📊 7. Productivity Plots & Analytics
- Visual dashboard showing task completion velocity, priority distribution, list volume, and focus ratios.

### 🛡️ 8. 5-Second Safety Undo & Gestures
- **Undo Toast**: Accidental deletions or completions trigger a floating 5-second **Undo** pill that restores the exact snapshot.
- **Touch Swipe**: Swipe right on phone task cards to complete; swipe left to reveal **Tomorrow** or **Delete**.
- **Desktop Shortcuts**:
  - `/` : Focus search
  - `N` : Focus quick-add
  - `Space` : Toggle complete on selected task
  - `T` : Toggle My Day on selected task
  - `Delete` : Delete selected task with undo
  - `Alt + ↑ / ↓` : Reorder tasks

---

## 🏗️ Project Architecture

```
SyncToDo/
├── android/               # Native Android project (Capacitor 6, Java, Gradle)
│   ├── app/src/main/java/com/synctodo/app/
│   │   ├── MainActivity.java
│   │   └── LocalPeerServer.java   # Embedded P2P server & mDNS NsdManager
│   └── app/build/outputs/apk/debug/
│       └── app-debug.apk          # Built Android application
├── client/                # React 18 + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── DevicesPairingModal.jsx  # P2P mesh, 6-digit code & discovery UI
│   │   │   ├── TaskDetailPanel.jsx      # Task inspector & subtasks checklist
│   │   │   ├── HandwritingCanvas.jsx    # Stylus & S-Pen drawing canvas
│   │   │   ├── DailyPlannerModal.jsx    # Backlog triage & My Day planner
│   │   │   ├── CustomListsModal.jsx     # List manager & color picker
│   │   │   ├── AnalyticsDashboard.jsx   # Productivity plots & statistics
│   │   │   ├── ThemeSettingsModal.jsx   # 8 themes & auto-scheduling
│   │   │   └── SvgIcons.jsx             # Cross-platform SVG icon suite & NLP parser
│   │   ├── p2pEngine.js                 # P2P LAN discovery & auto-healing engine
│   │   ├── syncEngine.js                # Offline-first CRDT LWW sync engine
│   │   └── App.jsx                      # Main UI workspace
│   ├── index.html
│   └── package.json
├── server/                # Node.js backend & LAN signaling daemon
│   ├── server.js          # Express HTTP, WebSocket server & UDP beacon
│   ├── public/            # Static assets & Android APK download portal
│   │   └── SyncToDo.apk
│   └── data/
│       └── store.json     # Persistent database
├── build_apk.sh           # Automated APK build script
├── launch.sh              # 1-click Linux desktop launcher
├── SyncToDo.apk           # Standalone Android installer APK (3.7 MB)
└── package.json           # Workspace scripts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- *(Optional for Android builds)*: JDK 21, Android SDK (API 34)

---

### 💻 Running on Laptop / Desktop

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SMani24/SyncToDo.git
   cd SyncToDo
   ```

2. **Install dependencies**:
   ```bash
   # Install root, client, and server dependencies
   npm install
   cd client && npm install && cd ..
   cd server && npm install && cd ..
   ```

3. **Build the web client**:
   ```bash
   cd client && npm run build && cd ..
   ```

4. **Start the server**:
   ```bash
   npm start
   # or run directly:
   node server/server.js
   ```

5. **Open in browser**:
   Navigate to [http://localhost:4000](http://localhost:4000).

*(Tip: On Linux systems, you can also run `./launch.sh` to start the server and open the app window in dedicated app mode.)*

---

### 📱 Installing on Android Phone or Tablet

#### Option A: Direct Local Wi-Fi Download (Recommended)
1. Start the server on your laptop (`node server/server.js`).
2. Notice your laptop's local IP printed in the terminal (e.g. `http://192.168.1.100:4000`).
3. On your Android phone or tablet, open Chrome and navigate to:
   ```
   http://<laptop-ip>:4000/download
   ```
4. Tap **Download APK** and install `SyncToDo.apk`.

#### Option B: Direct File Transfer
- Copy the pre-built [`SyncToDo.apk`](SyncToDo.apk) directly to your Android device via USB cable, Bluetooth, or file transfer, and tap to install.

#### Option C: Build from Source
```bash
./build_apk.sh
```
The compiled APK will be output to `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔗 How Device Pairing Works

1. Ensure both devices are connected to the same Wi-Fi network (or one device is sharing a mobile hotspot).
2. Open **SyncToDo** on both devices.
3. Tap **Pair Devices** in the top navigation bar.
4. Your other device will appear in the **Nearby on this Wi-Fi** section. Tap **Pair**.
5. An **Allow & Sync** confirmation banner will appear on the other device with matching 6-digit verification codes.
6. Once confirmed, tasks and lists will merge immediately and sync in real-time.

---

## 📄 License

MIT License. Designed and built with local-first, privacy-first principles.
