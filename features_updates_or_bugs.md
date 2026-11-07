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


## Bugs to Fix

- [x] When moving an item in a list over a long distance, the item won't be moved, it will just move up a little! (Fixed: continuous RAF auto-scroll loop for stationary touch/mouse pointers at container edges, exact active card query filtering, dynamic ID lookup & reorder commit)
- [x] Improve action/undo toast notification pop-up: fixed positioning overlap above mobile quick-add bar, isolated bidirectional text/RTL wrapping glitches, added action badge icons, styled pill undo button with icon, dismiss button, and animated countdown progress bar.

## Requests
