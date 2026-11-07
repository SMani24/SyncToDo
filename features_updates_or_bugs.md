# Feature and Bug lists

## Features to Add

- [x] Pin tasks to the top of lists and daily activities across all platforms (Phone, Tablet, Laptop, Desktop):
  - Prioritized pinned sorting at the top of active tasks across My Day, custom lists, Inbox, and All Tasks.
  - Clean visual distinction: warm amber left accent border, `📌 Pinned` chip in metadata badges, and golden pin icon indicator.
  - Desktop / Laptop: One-click card pin toggle on hover/active, keyboard shortcut (`P` key when task is selected), and "Pin to Top" toggle button in TaskDetailPanel inspector.
  - Tablet: Direct tap card pin toggle and TaskDetailPanel toggle.
  - Mobile Phone: Direct tap card pin toggle, dedicated swipe-left action drawer button (`[Pin 📌]` / `[Unpin]`, `[Tomorrow]`, `[Delete]`), and TaskDetailPanel bottom sheet toggle.
  - Drag-and-drop support: Seamless slot-center reordering within pinned and unpinned partitions with automatic boundary partition syncing.
  - CRDT sync: Syncs pinned state and timestamps in real-time across all paired devices.
- [x] Preserve task due dates when adding to Today / My Day (working ahead of time):
  - Decoupled `dueDate` (hard deadline) from `inMyDay` / `plannedDate` (daily focus agenda).
  - Adding a task with a future due date (or no due date) to today's focus list retains its existing deadline without overwriting it with today's date.
  - Tasks scheduled for future dates can be brought into My Day to tackle ahead of time while their deadline badges clearly display the future due date.
- [x] Serve app across local network on `http://g16laptop.local:4000` via mDNS:
  - Configured Avahi mDNS publisher script `server/publish-mdns.sh` and systemd user services (`g16laptop-mdns.service` and `synctodo-server.service`).
  - Added self-healing mDNS detection in `server/server.js` and displayed the local hostname in Devices & Sync modal.

## Bugs to Fix

- [x] When moving an item in a list over a long distance, the item won't be moved, it will just move up a little! (Fixed: continuous RAF auto-scroll loop for stationary touch/mouse pointers at container edges, exact active card query filtering, dynamic ID lookup & reorder commit)
- [x] Improve action/undo toast notification pop-up: fixed positioning overlap above mobile quick-add bar, isolated bidirectional text/RTL wrapping glitches, added action badge icons, styled pill undo button with icon, dismiss button, and animated countdown progress bar.

## Requests
- [x] Serve the app on `g16laptop.local` (Available on `http://g16laptop.local:4000`).
- [x] Preserve due dates when adding tasks to today's list.
