# Feature and Bug lists

## Features to Add


## Bugs to Fix

- [x] **Phone bottom bar disappears after closing keyboard** (Fixed):
  - Added native IME insets listener & `dispatchKeyEvent` back handler in `MainActivity.java` to blur the active input and dispatch `keyboardhide`.
  - Added `visualViewport` resize listener and `keyboardhide` listener in `App.jsx`, and included `isInputFocused` in `anyModalOpen` so Android back press directly blurs the active input and immediately restores the bottom navigation bar without requiring any extra taps.

- [x] **Add list visual elements truncated/wrapping on phone** (Fixed - pic2.jpg):
  - Added `minWidth: 0` to the list name input and updated placeholder to fit mobile screens.
  - Added `whiteSpace: 'nowrap'`, `flexShrink: 0`, and clean horizontal alignment to the `+ Add List` button so it stays on one neat row.
  - Added `.no-scrollbar` with hidden scrollbar styling, `width: '100%'`, and `flexShrink: 0` to emoji buttons in `CustomListsModal.jsx`.

- [x] **Plan My Day tabs cut off & obscured by scrollbar on phone** (Fixed - pic3.jpg):
  - Added `flexShrink: 0` to the filter pill buttons so they never shrink or deform on mobile.
  - Added `.no-scrollbar` and `scrollbarWidth: 'none'` to the tabs container to eliminate the native scrollbar track that was cutting across the bottom half of the buttons.
  - Cleaned up vertical padding and pill borders for seamless horizontal scrolling.

## Requests
