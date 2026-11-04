# Feature and Bug lists

All reported features, updates, and bugs have been resolved and verified:
- [x] Camera QR Code Scanner for instant device pairing on Android (`synctodo://` URI + fallback 6-digit code)
- [x] S-Pen / Stylus hardware barrel button dynamic eraser switching on both full canvas and quick scribble strip
- [x] Strict pairing code verification (mismatched 6-digit codes are rejected and denied sync tokens)
- [x] Multi-device CRDT concurrent offline mutation convergence verified via automated 3-device mock test suite
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
