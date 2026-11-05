# Feature and Bug lists

All reported features, updates, and bugs have been resolved and verified:
- [x] Multi-Calendar Task Date Picker (`CalendarPickerModal`): enables selecting task due dates directly within the user's chosen calendar system (Solar Hijri / Shamsi, Islamic / Hijri Qamari, or Gregorian) with interactive month grids, month & year dropdowns, Saturday-to-Friday Persian/Arabic layouts, and Today/Tomorrow/Clear shortcuts.
- [x] Desktop & App Launcher Icon unified with logo: updated `/home/smani24/Desktop/SyncToDo.desktop`, `/home/smani24/.local/share/applications/synctodo.desktop`, Android mipmap launcher icons, and PWA favicons to match the official SyncToDo vibrant emerald green squircle with white checkmark logo.
- [x] Configurable "Start of New Day" (Day Rollover Time) in Settings (Midnight 00:00, 1 AM, 2 AM, 3 AM, 4 AM Night Owl, 5 AM Early Bird, 6 AM Morning, etc.)
- [x] Completed tasks isolation (tasks completed yesterday remain locked in yesterday's history and never carry over into the new day's My Day)
- [x] Current date badge displayed next to "My Day" title based on selected calendar (e.g. `پنجشنبه ۱۴ آبان` in Shamsi, `Thu, Nov 5` in Gregorian, `پنجشنبه ۲۵ جمادی‌الاول` in Islamic)
- [x] Restored and enlarged high-DPI QR Code (160px × 160px) in Devices & Sync modal with zero card truncation or flex clipping
- [x] Eliminated duplicate and self-device entries in paired devices list across phone, tablet, and laptop (deduplicated by normalized device name, guaranteed exact physical device count)
- [x] S-Pen hardware barrel button momentary hold-to-erase behavior matching Samsung Notes (switches to Eraser while pressed, instantly restores active pen upon release)
- [x] Concurrent multi-device sync mesh (simultaneous Phone, Tablet, and Laptop synchronization without false offline states)
- [x] Pairing input & submit button boundary overflow fix (guaranteed zero overflow past card borders on all screen widths)
- [x] Paired devices mobile card layout redesign (spacious 2-row layout, zero text wrapping, live status badge pills, matched action buttons)
- [x] Camera QR Code Scanner for instant device pairing on Android (`synctodo://` URI + fallback 6-digit code)
- [x] Strict pairing code verification (mismatched 6-digit codes are rejected and denied sync tokens)
- [x] Multi-device CRDT concurrent offline mutation convergence verified via automated test suite
- [x] Android-to-Android decentralized peer discovery over local Wi-Fi (LAN multicast & multi-subnet broadcast)
- [x] Local device name identity isolation (prevented mobile devices from adopting remote laptop identity)
- [x] High-DPI canvas stroke resolution (`Math.max(2.5, window.devicePixelRatio)` with anti-aliasing)
- [x] Seamless inline handwritten note task title fitting designated task card space
- [x] Multi-calendar date format correction (Solar Hijri: Day on right, Month in middle, Year on left; Islamic: era-clean RTL token order)
- [x] Settings modal calendar descriptions shortened and sample pill formatting protected from truncation
- [x] Phone typing layout fix (zero displacement, no grey void, inputs pinned directly above keyboard with scrollable task list)

## Features to Add
*(Add any new feature requests here)*

## Bugs to Fix
*(Add any new bug reports here)*

## Requests
*(Add any new design or general requests here)*
