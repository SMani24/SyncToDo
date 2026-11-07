import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  syncEngine,
  detectDeviceType,
  normalizeListIcon,
  hasPersianChar,
  detectBidiDirection,
  splitTitleForBidi
} from './syncEngine';
import HandwritingCanvas from './components/HandwritingCanvas';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ThemeSettingsModal, { ALL_THEMES } from './components/ThemeSettingsModal';
import DailyPlannerModal from './components/DailyPlannerModal';
import CustomListsModal from './components/CustomListsModal';
import EditListModal from './components/EditListModal';
import DevicesPairingModal from './components/DevicesPairingModal';
import SettingsModal from './components/SettingsModal';
import CalendarPickerModal from './components/CalendarPickerModal';
import {
  getStoredCalendarType,
  setStoredCalendarType,
  getStoredDayStartHour,
  setStoredDayStartHour,
  getLogicalDateStr,
  isSameLogicalDay,
  formatCalendarDate,
  formatDayDateHeader,
  formatDueDateBadge,
  formatFullHeaderDate
} from './utils/calendar';
import TaskDetailPanel from './components/TaskDetailPanel';
import { Icon, parseNaturalTaskInput } from './components/SvgIcons';

export function BidiTaskTitle({ title }) {
  if (!title) return null;
  const bidi = splitTitleForBidi(title);
  if (bidi.isSplit) {
    return (
      <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>
        {bidi.prefix}{' '}
        <bdi dir="rtl" style={{ display: 'inline-block', unicodeBidi: 'isolate' }}>
          {bidi.paren}
        </bdi>
      </span>
    );
  }
  const isRtl = bidi.dir === 'rtl';
  return (
    <span
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        unicodeBidi: 'plaintext',
        textAlign: isRtl ? 'right' : 'left',
        display: 'inline-block',
        width: '100%'
      }}
    >
      {title}
    </span>
  );
}

export const handwritingCropCache = new Map();

export function cropCanvasInk(canvas, pad = 6) {
  try {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hasInk = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = d[(y * w + x) * 4 + 3];
        if (alpha > 12) {
          hasInk = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasInk) return null;

    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);

    const cropW = Math.max(1, maxX - minX);
    const cropH = Math.max(1, maxY - minY);

    const c = document.createElement('canvas');
    c.width = cropW;
    c.height = cropH;
    const cCtx = c.getContext('2d');
    cCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return c.toDataURL('image/png');
  } catch (err) {
    return canvas.toDataURL('image/png');
  }
}

export function HandwrittenTitle({ src, isCompleted, isDarkTheme }) {
  const [trimmedSrc, setTrimmedSrc] = useState(src);

  useEffect(() => {
    if (!src || !src.startsWith('data:image')) {
      setTrimmedSrc(src);
      return;
    }
    if (handwritingCropCache.has(src)) {
      setTrimmedSrc(handwritingCropCache.get(src));
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
        let found = false;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const a = d[(y * c.width + x) * 4 + 3];
            if (a > 12) {
              found = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (found && (maxX - minX < c.width * 0.92 || maxY - minY < c.height * 0.92)) {
          const pad = 6;
          minX = Math.max(0, minX - pad);
          minY = Math.max(0, minY - pad);
          maxX = Math.min(c.width, maxX + pad);
          maxY = Math.min(c.height, maxY + pad);
          const cw = Math.max(1, maxX - minX);
          const ch = Math.max(1, maxY - minY);
          const c2 = document.createElement('canvas');
          c2.width = cw;
          c2.height = ch;
          const ctx2 = c2.getContext('2d');
          ctx2.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
          const croppedUrl = c2.toDataURL('image/png');
          handwritingCropCache.set(src, croppedUrl);
          setTrimmedSrc(croppedUrl);
        } else {
          handwritingCropCache.set(src, src);
        }
      } catch (err) {
        setTrimmedSrc(src);
      }
    };
    img.src = src;
  }, [src]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      minHeight: '34px',
      maxHeight: '44px',
      verticalAlign: 'middle',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <img
        src={trimmedSrc}
        alt="Handwritten note"
        style={{
          maxHeight: '42px',
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'contain',
          filter: isDarkTheme ? 'invert(1) brightness(1.2)' : 'none',
          opacity: isCompleted ? 0.45 : 1,
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}

export default function App() {
  const [syncState, setSyncState] = useState(() => ({
    status: syncEngine.status || 'SYNCING',
    todos: Object.values(syncEngine.todos || {}).filter(t => !t.deletedAt),
    lists: syncEngine.lists && syncEngine.lists.length > 0 ? syncEngine.lists : [],
    onlineDevices: syncEngine.onlineDevices || [],
    pendingCount: syncEngine.mutationQueue?.length || 0,
    p2pInfo: syncEngine.p2pEngine ? syncEngine.p2pEngine.getInfo() : { activeP2PCount: 0, peers: [], pairedDevices: [], nearbyPeers: [], pendingRequests: [] }
  }));

  // Restore persisted view & list if available
  const initialViewState = (() => {
    try {
      const raw = localStorage.getItem('synctodo_last_view_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.activeView === 'string') {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  })();

  // Navigation & View state
  const [activeView, setActiveView] = useState(initialViewState?.activeView || 'today');
  const [selectedListId, setSelectedListId] = useState(initialViewState?.selectedListId || null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRecurring, setFilterRecurring] = useState(false);
  const [filterHandwriting, setFilterHandwriting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTodoId, setSelectedTodoId] = useState(null);
  const [taskDrag, setTaskDrag] = useState(null);
  const [listDrag, setListDrag] = useState(null);
  const taskDragRef = useRef({ active: false });
  const listDragRef = useRef({ active: false });
  const pendingPointerDragRef = useRef(null);
  const sortedActiveRef = useRef([]);
  const listsRef = useRef([]);
  const didDragRef = useRef(false);
  const dragTimeoutRef = useRef(null);
  const [newHandwritingIsInline, setNewHandwritingIsInline] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isIgnoreClicksRef = useRef(false);
  const [isIgnoringClicks, setIsIgnoringClicks] = useState(false);
  const mainRef = useRef(null);


  const triggerClickLockout = (ms = 350) => {
    isIgnoreClicksRef.current = true;
    setIsIgnoringClicks(true);
    setTimeout(() => {
      isIgnoreClicksRef.current = false;
      setIsIgnoringClicks(false);
    }, ms);
  };

  // List Editing state (Option A header edit & Option B context menu / long-press)
  const [editingList, setEditingList] = useState(null);
  const [listContextMenu, setListContextMenu] = useState(null); // { x, y, list }

  // Save active view & list to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('synctodo_last_view_v1', JSON.stringify({ activeView, selectedListId }));
    } catch (_) {}
  }, [activeView, selectedListId]);

  // Keep scroll position map per view/list
  const currentViewKey = (activeView === 'list' && selectedListId) ? `list:${selectedListId}` : activeView;
  const scrollContainerRef = useRef(null);
  const viewScrollMap = useRef((() => {
    try {
      const raw = localStorage.getItem('synctodo_scroll_positions_v1');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  })());

  useLayoutEffect(() => {
    const targetScroll = viewScrollMap.current[currentViewKey] || 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = targetScroll;
    }
    const raf = requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = targetScroll;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [currentViewKey]);

  // Task creation state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('none');
  const [newRecurrenceInterval, setNewRecurrenceInterval] = useState(1);
  const [newHandwriting, setNewHandwriting] = useState(null);
  const [showInlinePenStrip, setShowInlinePenStrip] = useState(false);
  const [showQuickAddCalendar, setShowQuickAddCalendar] = useState(false);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [calendarType, setCalendarType] = useState(getStoredCalendarType);
  const [dayStartHour, setDayStartHour] = useState(getStoredDayStartHour);

  // Show weekday in task cards preference
  const [showWeekdayInTasks, setShowWeekdayInTasks] = useState(() => {
    try {
      return localStorage.getItem('synctodo_show_weekday_in_tasks') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleShowWeekdayInTasks = (val) => {
    setShowWeekdayInTasks(val);
    try {
      localStorage.setItem('synctodo_show_weekday_in_tasks', String(val));
    } catch {}
  };

  // Sort by date in lists (off by default)
  const [sortByDate, setSortByDate] = useState(() => {
    try {
      return localStorage.getItem('synctodo_sort_by_date') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSortByDate = () => {
    setSortByDate(prev => {
      const next = !prev;
      try { localStorage.setItem('synctodo_sort_by_date', String(next)); } catch {}
      return next;
    });
  };

  // Hold-to-drag timer & sheet touch scroll tracking refs
  const cardHoldTimerRef = useRef(null);
  const touchStartCoordRef = useRef(null);
  const isTouchScrollingRef = useRef(false);

  const handleSelectCalendarType = (type) => {
    setCalendarType(type);
    setStoredCalendarType(type);
  };

  const handleSelectDayStartHour = (hour) => {
    setDayStartHour(hour);
    setStoredDayStartHour(hour);
  };
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showPlannerModal, setShowPlannerModal] = useState(false);
  const [showListsModal, setShowListsModal] = useState(false);
  const [showListPickerSheet, setShowListPickerSheet] = useState(false);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [canvasTargetTodoId, setCanvasTargetTodoId] = useState(null);
  const [canvasInitialImage, setCanvasInitialImage] = useState(null);

  // Leftovers / Carry-Forward state
  const [leftoversDismissedDate, setLeftoversDismissedDate] = useState(null);
  const [showLeftoversPicker, setShowLeftoversPicker] = useState(false);
  const [selectedLeftoverIds, setSelectedLeftoverIds] = useState(new Set());
  const [carryForwardNotice, setCarryForwardNotice] = useState(null);

  // Undo Toast state
  const [undoToast, setUndoToast] = useState(null); // { message, onUndo }
  const undoTimerRef = useRef(null);

  // Touch Swipe state for task cards
  const [swipedTodoId, setSwipedTodoId] = useState(null); // todo.id with left-swipe actions open
  const touchSwipeRef = useRef({ id: null, startX: 0, startY: 0, deltaX: 0 });

  // Inline Quick-Add Pen Canvas refs
  const inlineCanvasRef = useRef(null);
  const inlineDrawingRef = useRef(false);
  const [inlineHasInk, setInlineHasInk] = useState(false);

  // List Selection & Hold-to-Delete state
  const [listSelectMode, setListSelectMode] = useState(false);
  const [selectedListIds, setSelectedListIds] = useState(new Set());
  const [listsToDelete, setListsToDelete] = useState(null);
  const listLongPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

  const searchInputRef = useRef(null);
  const quickAddInputRef = useRef(null);

  const [deviceType, setDeviceType] = useState(detectDeviceType());

  // Android hardware back button & modal management
  const anyModalOpen = Boolean(
    isInputFocused ||
    showListPickerSheet ||
    selectedTodoId ||
    showCanvasModal ||
    showSettingsModal ||
    showDevicesModal ||
    showThemeModal ||
    showPlannerModal ||
    showListsModal ||
    showQuickAddCalendar ||
    editingList ||
    (listsToDelete && listsToDelete.length > 0)
  );

  useEffect(() => {
    if (window.AndroidBridge && window.AndroidBridge.setModalOpen) {
      try {
        window.AndroidBridge.setModalOpen(anyModalOpen);
      } catch (_) {}
    }
  }, [anyModalOpen]);

  // Monitor keyboard visibility & dismissal
  useEffect(() => {
    const handleDismissKeyboard = () => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
      }
      setIsInputFocused(false);
    };

    window.addEventListener('keyboardhide', handleDismissKeyboard);

    if (window.visualViewport) {
      let lastVh = window.visualViewport.height;
      const onViewportResize = () => {
        const vh = window.visualViewport.height;
        const wh = window.innerHeight;
        // When keyboard closes on phone, visualViewport expands back towards innerHeight
        if (vh >= wh - 70 && lastVh < wh - 120) {
          handleDismissKeyboard();
        }
        lastVh = vh;
      };
      window.visualViewport.addEventListener('resize', onViewportResize);
      return () => {
        window.removeEventListener('keyboardhide', handleDismissKeyboard);
        window.visualViewport.removeEventListener('resize', onViewportResize);
      };
    }

    return () => {
      window.removeEventListener('keyboardhide', handleDismissKeyboard);
    };
  }, []);

  useEffect(() => {
    window.__handleAndroidBack = () => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
        setIsInputFocused(false);
        return true;
      }
      if (isInputFocused) {
        setIsInputFocused(false);
        return true;
      }
      if (showQuickAddCalendar) {
        setShowQuickAddCalendar(false);
        return true;
      }
      if (listsToDelete && listsToDelete.length > 0) {
        setListsToDelete(null);
        return true;
      }
      if (showCanvasModal) {
        setShowCanvasModal(false);
        return true;
      }
      if (editingList) {
        setEditingList(null);
        return true;
      }
      if (showListsModal) {
        setShowListsModal(false);
        return true;
      }
      if (showPlannerModal) {
        setShowPlannerModal(false);
        return true;
      }
      if (showThemeModal) {
        setShowThemeModal(false);
        return true;
      }
      if (showDevicesModal) {
        setShowDevicesModal(false);
        return true;
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
        return true;
      }
      if (showListPickerSheet) {
        setShowListPickerSheet(false);
        handleExitListSelect();
        return true;
      }
      if (selectedTodoId) {
        setSelectedTodoId(null);
        return true;
      }
      return false;
    };
  }, [
    isInputFocused, listsToDelete, showCanvasModal, editingList, showListsModal,
    showPlannerModal, showThemeModal, showDevicesModal, showSettingsModal,
    showQuickAddCalendar, showListPickerSheet, selectedTodoId
  ]);


  const triggerUndoToast = (config, onUndoFn) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const toastData = typeof config === 'string'
      ? { message: config, actionLabel: config, onUndo: onUndoFn }
      : { ...config, onUndo: onUndoFn };
    setUndoToast(toastData);
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 5200);
  };

  const handleUndoClick = () => {
    if (!undoToast) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    try {
      undoToast.onUndo?.();
    } catch (e) {
      console.error(e);
    }
    setUndoToast(null);
  };

  const handleDeleteTodoWithUndo = (todoObj) => {
    if (!todoObj) return;
    const snapshot = JSON.parse(JSON.stringify(todoObj));
    syncEngine.deleteTodo(todoObj.id);
    if (selectedTodoId === todoObj.id) {
      setSelectedTodoId(null);
    }
    triggerUndoToast({
      action: 'deleted',
      actionLabel: 'Task deleted',
      title: todoObj.title || 'Untitled task'
    }, () => {
      syncEngine.restoreTodoSnapshot(snapshot);
    });
  };

  const handleToggleTodoWithUndo = (todoObj) => {
    if (!todoObj) return;
    const snapshot = JSON.parse(JSON.stringify(todoObj));
    const wasCompleted = Boolean(todoObj.completed);
    syncEngine.toggleTodo(todoObj.id);
    if (!wasCompleted) {
      triggerUndoToast({
        action: 'completed',
        actionLabel: 'Task completed',
        title: todoObj.title || 'Untitled task'
      }, () => {
        syncEngine.restoreTodoSnapshot(snapshot);
      });
    }
  };

  const handleTogglePinTodo = (todoObj) => {
    if (!todoObj) return;
    const nextPinned = !todoObj.pinned;
    syncEngine.updateTodo(todoObj.id, {
      pinned: nextPinned,
      pinnedAt: nextPinned ? Date.now() : null
    });
  };

  const handleStartListSelect = (initialListId) => {
    if (initialListId === 'inbox') return;
    setListSelectMode(true);
    setSelectedListIds(new Set([initialListId]));
  };

  const handleToggleListSelect = (listId) => {
    if (listId === 'inbox') return;
    setSelectedListIds(prev => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  const handleSelectAllLists = () => {
    const customListIds = syncState.lists.filter(l => l.id !== 'inbox').map(l => l.id);
    if (selectedListIds.size === customListIds.length) {
      setSelectedListIds(new Set());
    } else {
      setSelectedListIds(new Set(customListIds));
    }
  };

  const handleExitListSelect = () => {
    setListSelectMode(false);
    setSelectedListIds(new Set());
  };

  const handleRequestDeleteLists = (lists) => {
    const target = Array.isArray(lists) ? lists : [lists];
    const deletable = target.filter(l => l && l.id !== 'inbox');
    if (deletable.length === 0) return;
    setListsToDelete(deletable);
  };

  const handleConfirmDeleteLists = () => {
    if (!listsToDelete || listsToDelete.length === 0) return;
    const listsSnapshot = JSON.parse(JSON.stringify(syncState.lists));
    const todosSnapshot = JSON.parse(JSON.stringify(syncState.todos));
    const deletedIds = new Set(listsToDelete.map(l => l.id));
    const isSingle = listsToDelete.length === 1;
    const actionLabel = isSingle ? 'List deleted' : `${listsToDelete.length} lists deleted`;
    const listTitle = isSingle ? listsToDelete[0].name : '';

    listsToDelete.forEach(l => {
      syncEngine.deleteList(l.id);
    });

    if (deletedIds.has(selectedListId)) {
      setSelectedListId('inbox');
      setActiveView('list');
    }

    setListsToDelete(null);
    handleExitListSelect();

    triggerUndoToast({
      action: 'deleted',
      actionLabel,
      title: listTitle
    }, () => {
      syncEngine.restoreListsSnapshot(listsSnapshot, todosSnapshot);
    });
  };

  const handleItemTouchStart = (listId, isSystem) => {
    if (isSystem || listSelectMode) return;
    isTouchScrollingRef.current = false;
    if (listLongPressTimerRef.current) clearTimeout(listLongPressTimerRef.current);
    didLongPressRef.current = false;
    listLongPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(50); } catch {}
      }
      handleStartListSelect(listId);
    }, 450);
  };

  const handleItemTouchEnd = (listId, isSystem, defaultAction) => {
    if (listLongPressTimerRef.current) {
      clearTimeout(listLongPressTimerRef.current);
      listLongPressTimerRef.current = null;
    }
    if (isTouchScrollingRef.current) {
      isTouchScrollingRef.current = false;
      didLongPressRef.current = false;
      return;
    }
    if (!didLongPressRef.current) {
      if (listSelectMode) {
        if (!isSystem) handleToggleListSelect(listId);
      } else if (defaultAction) {
        defaultAction();
      }
    }
    didLongPressRef.current = false;
  };

  const handleItemTouchCancel = () => {
    if (listLongPressTimerRef.current) {
      clearTimeout(listLongPressTimerRef.current);
      listLongPressTimerRef.current = null;
    }
    didLongPressRef.current = false;
  };

  // Theme configuration & auto-scheduler state
  const [themeConfig, setThemeConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('synctodo_theme_config_v2');
      return saved ? JSON.parse(saved) : {
        mode: 'manual',
        darkThemeId: 'nordic',
        lightThemeId: 'minimal',
        lightStartTime: '07:00',
        darkStartTime: '19:00',
        activeThemeId: 'nordic'
      };
    } catch {
      return {
        mode: 'manual',
        darkThemeId: 'nordic',
        lightThemeId: 'minimal',
        lightStartTime: '07:00',
        darkStartTime: '19:00',
        activeThemeId: 'nordic'
      };
    }
  });

  useEffect(() => {
    const evaluateTheme = () => {
      let targetTheme = themeConfig.activeThemeId || 'nordic';

      if (themeConfig.mode === 'system') {
        const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        targetTheme = isSystemDark ? themeConfig.darkThemeId : themeConfig.lightThemeId;
      } else if (themeConfig.mode === 'scheduled') {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const lightStart = themeConfig.lightStartTime || '07:00';
        const darkStart = themeConfig.darkStartTime || '19:00';

        const isDaytime = currentTime >= lightStart && currentTime < darkStart;
        targetTheme = isDaytime ? themeConfig.lightThemeId : themeConfig.darkThemeId;
      }

      document.body.setAttribute('data-theme', targetTheme);
    };

    evaluateTheme();
    const interval = setInterval(evaluateTheme, 30000);
    return () => clearInterval(interval);
  }, [themeConfig]);

  const updateThemeConfig = (patch) => {
    setThemeConfig(prev => {
      const updated = { ...prev, ...patch };
      localStorage.setItem('synctodo_theme_config_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const applyThemeDirectly = (themeId) => {
    document.body.setAttribute('data-theme', themeId);
    updateThemeConfig({ activeThemeId: themeId });
  };

  const activeAppliedTheme = themeConfig?.activeThemeId || (typeof document !== 'undefined' ? document.body.getAttribute('data-theme') : 'nordic') || 'nordic';
  const isDarkTheme = !['minimal', 'editorial', 'matcha', 'sakura'].includes(activeAppliedTheme);

  useEffect(() => {
    const onResize = () => setDeviceType(detectDeviceType());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view');
      const urlList = params.get('list');
      const urlSearch = params.get('search');
      const urlFocus = params.get('focus');
      if (urlView) setActiveView(urlView);
      if (urlList) {
        setActiveView('list');
        setSelectedListId(urlList);
      }
      if (urlSearch) setSearchQuery(urlSearch);
      if (urlFocus) {
        setTimeout(() => quickAddInputRef.current?.focus(), 400);
      }
    } catch {}
  }, []);

  const todayStr = getLogicalDateStr(new Date(), dayStartHour);

  // Check for overdue/yesterday's unfinished tasks (ONLY active tasks, NEVER completed!)
  const overdueTasks = syncState.todos.filter(t => {
    if (t.completed || t.deletedAt) return false;
    const isPastDue = t.dueDate && t.dueDate < todayStr;
    const isPastMyDay = t.inMyDay && t.plannedDate && t.plannedDate < todayStr;
    return isPastDue || isPastMyDay;
  });

  // Filter Todos based on active view and filters
  const filteredTodos = syncState.todos.filter(todo => {
    if (todo.deletedAt) return false;

    if (searchQuery.trim()) {
      // Global search across all lists & tasks
    } else {
      if (activeView === 'today') {
        if (!todo.completed) {
          // Active task belongs in My Day if due today OR planned for today
          const isDueToday = todo.dueDate === todayStr;
          const isPlannedToday = todo.inMyDay && (!todo.plannedDate || todo.plannedDate === todayStr);
          if (!isDueToday && !isPlannedToday) return false;
        } else {
          // Completed task belongs in today's My Day ONLY if it was completed on today's logical date
          const completedToday = todo.completedAt
            ? isSameLogicalDay(todo.completedAt, todayStr, dayStartHour)
            : (todo.plannedDate === todayStr || todo.dueDate === todayStr);
          if (!completedToday) return false;
        }
      } else if (activeView === 'all' || activeView === 'backlog') {
        // Show all tasks
      } else if (activeView === 'list' || activeView === 'projects') {
        if (selectedListId && todo.listId !== selectedListId) return false;
      } else if (activeView === 'recurring') {
        if (!todo.recurrence || todo.recurrence === 'none') return false;
      } else if (activeView === 'handwriting') {
        if (!todo.handwriting) return false;
      } else if (activeView === 'analytics') {
        return false;
      }
    }

    if (filterRecurring && (!todo.recurrence || todo.recurrence === 'none')) return false;
    if (filterHandwriting && !todo.handwriting) return false;

    if (filterStatus === 'active' && todo.completed) return false;
    if (filterStatus === 'completed' && !todo.completed) return false;

    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (todo.title || '').toLowerCase().includes(q);
      const matchNotes = (todo.notes || '').toLowerCase().includes(q);
      if (!matchTitle && !matchNotes) return false;
    }

    return true;
  });

  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const sortedActive = filteredTodos
    .filter(t => !t.completed)
    .sort((a, b) => {
      const isPinnedA = Boolean(a.pinned);
      const isPinnedB = Boolean(b.pinned);
      if (isPinnedA !== isPinnedB) {
        return isPinnedA ? -1 : 1;
      }
      if (sortByDate) {
        const hasDateA = Boolean(a.dueDate);
        const hasDateB = Boolean(b.dueDate);
        if (hasDateA && hasDateB) {
          if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        } else if (hasDateA) {
          return -1;
        } else if (hasDateB) {
          return 1;
        }
      }
      const hasOrderA = typeof a.order === 'number';
      const hasOrderB = typeof b.order === 'number';
      if (hasOrderA && hasOrderB) {
        if (a.order !== b.order) return a.order - b.order;
      } else if (hasOrderA) {
        return -1;
      } else if (hasOrderB) {
        return 1;
      }
      if (isPinnedA && isPinnedB && a.pinnedAt && b.pinnedAt && a.pinnedAt !== b.pinnedAt) {
        return b.pinnedAt - a.pinnedAt;
      }
      const pw = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pw !== 0) return pw;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const sortedCompleted = filteredTodos
    .filter(t => t.completed)
    .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0));

  sortedActiveRef.current = sortedActive;
  listsRef.current = syncState.lists;

  const moveTask = (todoId, direction) => {
    const currentIndex = sortedActive.findIndex(t => t.id === todoId);
    if (currentIndex === -1) return;

    const newItems = [...sortedActive];
    let targetIndex = currentIndex;
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < newItems.length - 1) {
      targetIndex = currentIndex + 1;
    } else {
      return;
    }

    const [moved] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, moved);

    const targetNeighbor = newItems[direction === 'up' ? targetIndex + 1 : targetIndex - 1];
    if (targetNeighbor && Boolean(moved.pinned) !== Boolean(targetNeighbor.pinned)) {
      const nextPinned = direction === 'up';
      moved.pinned = nextPinned;
      moved.pinnedAt = nextPinned ? Date.now() : null;
      syncEngine.updateTodo(moved.id, { pinned: nextPinned, pinnedAt: moved.pinnedAt });
    }

    syncEngine.reorderTodos(newItems.map(t => t.id));
  };

  // ====================================================
  // UNIFIED SLOT-CENTER REORDERING ENGINE (Tasks & Lists)
  // With Smooth Continuous Auto-Scroll RAF Loop
  // ====================================================
  const autoScrollRafRef = useRef(null);
  const autoScrollSpeedRef = useRef(0);
  const autoScrollTargetRef = useRef(null);

  const findScrollParent = (el) => {
    let parent = el ? el.parentElement : null;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY)) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  };

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
    autoScrollTargetRef.current = null;
  };

  const checkAndRunAutoScroll = (scrollEl, clientY) => {
    if (!scrollEl) {
      stopAutoScroll();
      return;
    }

    const sRect = scrollEl.getBoundingClientRect();
    // Edge zone: minimum 56px, up to 90px (or 22% of container height)
    const edgeZone = Math.min(90, Math.max(56, sRect.height * 0.22));

    let speed = 0;
    if (clientY < sRect.top + edgeZone) {
      const dist = (sRect.top + edgeZone) - clientY;
      const ratio = Math.max(0, Math.min(1.8, dist / edgeZone));
      speed = -Math.round(ratio * 22 + 3); // -3px to -42px per frame
    } else if (clientY > sRect.bottom - edgeZone) {
      const dist = clientY - (sRect.bottom - edgeZone);
      const ratio = Math.max(0, Math.min(1.8, dist / edgeZone));
      speed = Math.round(ratio * 22 + 3); // +3px to +42px per frame
    }

    autoScrollSpeedRef.current = speed;
    autoScrollTargetRef.current = scrollEl;

    if (speed !== 0) {
      if (!autoScrollRafRef.current) {
        const step = () => {
          const curSpeed = autoScrollSpeedRef.current;
          const target = autoScrollTargetRef.current;
          const isTaskActive = Boolean(taskDragRef.current && taskDragRef.current.active);
          const isListActive = Boolean(listDragRef.current && listDragRef.current.active);

          if (!target || curSpeed === 0 || (!isTaskActive && !isListActive)) {
            stopAutoScroll();
            return;
          }

          const prev = target.scrollTop;
          target.scrollTop += curSpeed;
          const didScroll = target.scrollTop !== prev;

          // Update drag slots dynamically while stationary pointer has content scrolling underneath
          if (isTaskActive) {
            updateTaskDrag(taskDragRef.current.currentY, true);
          } else if (isListActive) {
            updateListDrag(listDragRef.current.currentY, true);
          }

          if (didScroll && autoScrollSpeedRef.current !== 0) {
            autoScrollRafRef.current = requestAnimationFrame(step);
          } else {
            stopAutoScroll();
          }
        };
        autoScrollRafRef.current = requestAnimationFrame(step);
      }
    } else {
      stopAutoScroll();
    }
  };

  const startTaskDrag = (todo, index, clientY, cardEl) => {
    if (!cardEl || !todo) return;
    const rect = cardEl.getBoundingClientRect();
    const containerEl = cardEl.closest('[data-todo-list-container]') || document.querySelector('[data-todo-list-container]');
    const scrollEl = findScrollParent(containerEl) || scrollContainerRef.current;
    const cardEls = containerEl ? Array.from(containerEl.querySelectorAll('[data-todo-card][data-active-card="true"]')) : [];
    const itemHeights = cardEls.map(el => el.getBoundingClientRect().height || 60);
    const actualIndex = index >= 0 ? index : sortedActiveRef.current.findIndex(t => t.id === todo.id);
    const dragData = {
      active: true,
      id: todo.id,
      draggedIdx: actualIndex,
      dropIndex: actualIndex,
      draggedHeight: rect.height || 60,
      gap: 8,
      itemHeights,
      offsetY: clientY - rect.top,
      rect,
      containerEl,
      scrollEl,
      todo,
      currentY: clientY
    };
    taskDragRef.current = dragData;
    setTaskDrag({ ...dragData });
    setSwipedTodoId(null);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch {}
    }
  };

  const updateTaskDrag = (clientY, isAutoScroll = false) => {
    const d = taskDragRef.current;
    if (!d || !d.active) return;

    if (!isAutoScroll) {
      d.currentY = clientY;
      const scrollEl = d.scrollEl || scrollContainerRef.current || findScrollParent(d.containerEl);
      checkAndRunAutoScroll(scrollEl, clientY);
    }

    const floatingTop = clientY - d.offsetY;
    const dragCenterY = floatingTop + d.draggedHeight / 2;
    const containerTop = d.containerEl ? d.containerEl.getBoundingClientRect().top : d.rect.top;
    const remainingHeights = d.itemHeights.filter((_, i) => i !== d.draggedIdx);
    const numSlots = remainingHeights.length + 1;

    let slotTop = containerTop;
    let bestSlot = d.dropIndex;
    let minDistance = Infinity;

    for (let k = 0; k < numSlots; k++) {
      const slotCenter = slotTop + d.draggedHeight / 2;
      const dist = Math.abs(dragCenterY - slotCenter);
      if (dist < minDistance) {
        minDistance = dist;
        bestSlot = k;
      }
      if (k < remainingHeights.length) {
        slotTop += remainingHeights[k] + d.gap;
      }
    }

    if (bestSlot !== d.dropIndex && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(8); } catch {}
    }

    d.dropIndex = bestSlot;
    setTaskDrag({ ...d });
  };

  const endTaskDrag = () => {
    stopAutoScroll();
    const d = taskDragRef.current;
    if (!d || !d.active) return;
    taskDragRef.current = { active: false };
    setTaskDrag(null);
    didDragRef.current = true;
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    dragTimeoutRef.current = setTimeout(() => { didDragRef.current = false; }, 180);

    if (d.draggedIdx >= 0 && d.dropIndex >= 0) {
      if (sortByDate) {
        setSortByDate(false);
        try { localStorage.setItem('synctodo_sort_by_date', 'false'); } catch {}
      }
      const currentItems = [...sortedActiveRef.current];
      const actualFromIndex = currentItems.findIndex(t => t.id === d.id);
      if (actualFromIndex !== -1) {
        const targetIndex = Math.max(0, Math.min(d.dropIndex, currentItems.length - 1));
        if (actualFromIndex !== targetIndex) {
          const [moved] = currentItems.splice(actualFromIndex, 1);
          currentItems.splice(targetIndex, 0, moved);

          // Pinned partition sync when dragging across boundaries
          const otherPinnedCount = currentItems.filter(t => t.id !== moved.id && t.pinned).length;
          if (moved.pinned && targetIndex >= otherPinnedCount) {
            moved.pinned = false;
            moved.pinnedAt = null;
            syncEngine.updateTodo(moved.id, { pinned: false, pinnedAt: null });
          } else if (!moved.pinned && targetIndex < otherPinnedCount) {
            moved.pinned = true;
            moved.pinnedAt = Date.now();
            syncEngine.updateTodo(moved.id, { pinned: true, pinnedAt: moved.pinnedAt });
          }

          syncEngine.reorderTodos(currentItems.map(t => t.id));
        }
      }
    }
  };

  const getTaskDragOffset = (index) => {
    if (!taskDrag) return 0;
    const { draggedIdx, dropIndex, draggedHeight, gap } = taskDrag;
    if (index === draggedIdx || draggedIdx === dropIndex) return 0;
    const shift = draggedHeight + gap;
    if (draggedIdx < dropIndex) {
      if (index > draggedIdx && index <= dropIndex) return -shift;
    } else if (draggedIdx > dropIndex) {
      if (index >= dropIndex && index < draggedIdx) return shift;
    }
    return 0;
  };

  const startListDrag = (list, index, clientY, itemEl, gap = 4, source = 'sidebar') => {
    if (!itemEl || !list) return;
    handleItemTouchCancel();
    const rect = itemEl.getBoundingClientRect();
    const containerEl = itemEl.closest('[data-lists-container]');
    const scrollEl = findScrollParent(containerEl);
    const itemEls = containerEl ? Array.from(containerEl.querySelectorAll('[data-list-item]')) : [];
    const itemHeights = itemEls.map(el => el.getBoundingClientRect().height || 38);
    const actualIndex = index >= 0 ? index : listsRef.current.findIndex(l => l.id === list.id);
    const dragData = {
      active: true,
      id: list.id,
      draggedIdx: actualIndex,
      dropIndex: actualIndex,
      draggedHeight: rect.height || 38,
      gap,
      itemHeights,
      offsetY: clientY - rect.top,
      rect,
      containerEl,
      scrollEl,
      list,
      source,
      currentY: clientY
    };
    listDragRef.current = dragData;
    setListDrag({ ...dragData });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch {}
    }
  };

  const updateListDrag = (clientY, isAutoScroll = false) => {
    const d = listDragRef.current;
    if (!d || !d.active) return;

    if (!isAutoScroll) {
      d.currentY = clientY;
      const scrollEl = d.scrollEl || findScrollParent(d.containerEl);
      checkAndRunAutoScroll(scrollEl, clientY);
    }

    const floatingTop = clientY - d.offsetY;
    const dragCenterY = floatingTop + d.draggedHeight / 2;
    const containerTop = d.containerEl ? d.containerEl.getBoundingClientRect().top : d.rect.top;
    const remainingHeights = d.itemHeights.filter((_, i) => i !== d.draggedIdx);
    const numSlots = remainingHeights.length + 1;

    let slotTop = containerTop;
    let bestSlot = d.dropIndex;
    let minDistance = Infinity;

    for (let k = 0; k < numSlots; k++) {
      const slotCenter = slotTop + d.draggedHeight / 2;
      const dist = Math.abs(dragCenterY - slotCenter);
      if (dist < minDistance) {
        minDistance = dist;
        bestSlot = k;
      }
      if (k < remainingHeights.length) {
        slotTop += remainingHeights[k] + d.gap;
      }
    }

    if (bestSlot !== d.dropIndex && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(8); } catch {}
    }

    d.dropIndex = bestSlot;
    setListDrag({ ...d });
  };

  const endListDrag = () => {
    stopAutoScroll();
    const d = listDragRef.current;
    if (!d || !d.active) return;
    listDragRef.current = { active: false };
    setListDrag(null);
    didDragRef.current = true;
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    dragTimeoutRef.current = setTimeout(() => { didDragRef.current = false; }, 180);

    if (d.draggedIdx >= 0 && d.dropIndex >= 0) {
      const currentLists = [...listsRef.current];
      const actualFromIndex = currentLists.findIndex(l => l.id === d.id);
      if (actualFromIndex !== -1) {
        const targetIndex = Math.max(0, Math.min(d.dropIndex, currentLists.length - 1));
        if (actualFromIndex !== targetIndex) {
          const [moved] = currentLists.splice(actualFromIndex, 1);
          currentLists.splice(targetIndex, 0, moved);
          syncEngine.reorderLists(currentLists.map(l => l.id));
        }
      }
    }
  };

  const getListDragOffset = (index, source) => {
    if (!listDrag || listDrag.source !== source) return 0;
    const { draggedIdx, dropIndex, draggedHeight, gap } = listDrag;
    if (index === draggedIdx || draggedIdx === dropIndex) return 0;
    const shift = draggedHeight + gap;
    if (draggedIdx < dropIndex) {
      if (index > draggedIdx && index <= dropIndex) return -shift;
    } else if (draggedIdx > dropIndex) {
      if (index >= dropIndex && index < draggedIdx) return shift;
    }
    return 0;
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (taskDragRef.current.active) {
        e.preventDefault();
        updateTaskDrag(e.clientY);
        return;
      }
      if (listDragRef.current.active) {
        e.preventDefault();
        updateListDrag(e.clientY);
        return;
      }
      const p = pendingPointerDragRef.current;
      if (p) {
        const dy = Math.abs(e.clientY - p.startY);
        const dx = Math.abs(e.clientX - p.startX);
        if (dy > 5 && dy > dx) {
          pendingPointerDragRef.current = null;
          if (p.kind === 'task') {
            startTaskDrag(p.todo, p.index, e.clientY, p.el);
          } else if (p.kind === 'list') {
            startListDrag(p.list, p.index, e.clientY, p.el, p.gap, p.source);
          }
        }
      }
    };

    const onMouseUp = () => {
      pendingPointerDragRef.current = null;
      if (taskDragRef.current.active) endTaskDrag();
      if (listDragRef.current.active) endListDrag();
    };

    const onTouchMove = (e) => {
      if (taskDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        if (e.touches && e.touches[0]) updateTaskDrag(e.touches[0].clientY);
        return;
      }
      if (listDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        if (e.touches && e.touches[0]) updateListDrag(e.touches[0].clientY);
      }
    };

    const onTouchEnd = () => {
      pendingPointerDragRef.current = null;
      if (taskDragRef.current.active) endTaskDrag();
      if (listDragRef.current.active) endListDrag();
    };

    const onWindowBlur = () => {
      pendingPointerDragRef.current = null;
      if (taskDragRef.current.active) endTaskDrag();
      if (listDragRef.current.active) endListDrag();
    };

    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      stopAutoScroll();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  const selectedTodo = syncState.todos.find(t => t.id === selectedTodoId && !t.deletedAt) || null;

  // Desktop Keyboard Shortcuts (/, N, Space, T, Delete, Alt+Up/Down, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        quickAddInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSelectedTodoId(null);
        setSwipedTodoId(null);
        setShowSettingsModal(false);
        setShowThemeModal(false);
        setShowPlannerModal(false);
        setShowListsModal(false);
        setShowCanvasModal(false);
      } else if (selectedTodo) {
        if (e.key === ' ') {
          e.preventDefault();
          handleToggleTodoWithUndo(selectedTodo);
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          const nextInMyDay = !selectedTodo.inMyDay;
          syncEngine.updateTodo(selectedTodo.id, {
            inMyDay: nextInMyDay,
            plannedDate: nextInMyDay ? todayStr : null
          });
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          handleTogglePinTodo(selectedTodo);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteTodoWithUndo(selectedTodo);
        } else if (e.altKey && e.key === 'ArrowUp') {
          e.preventDefault();
          moveTask(selectedTodo.id, 'up');
        } else if (e.altKey && e.key === 'ArrowDown') {
          e.preventDefault();
          moveTask(selectedTodo.id, 'down');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Live Natural-Language Parsing on Quick-Add Input
  const parsedQuickAdd = parseNaturalTaskInput(newTitle, syncState.lists);

  // Inline Quick-Add Handwriting Strip handlers with High-DPI & S-Pen Button Eraser
  useEffect(() => {
    if (showInlinePenStrip && inlineCanvasRef.current) {
      const canvas = inlineCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) {
        const dpr = Math.max(2.5, window.devicePixelRatio || 2);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [showInlinePenStrip]);

  const inlineEraserActiveRef = useRef(false);

  useEffect(() => {
    const handleStylusEvent = (e) => {
      const action = e.detail?.action;
      if (action === 'down' || action === 'eraser_active') {
        inlineEraserActiveRef.current = true;
      } else if (action === 'up') {
        inlineEraserActiveRef.current = false;
      }
    };
    window.addEventListener('stylusbutton', handleStylusEvent);
    return () => window.removeEventListener('stylusbutton', handleStylusEvent);
  }, []);

  const isStylusEraser = (e) => {
    if (inlineEraserActiveRef.current) return true;
    if (!e) return false;
    const isPen = e.pointerType === 'pen' || e.pointerType === 'stylus' || (e.pointerType === 'touch' && ((e.buttons & 2) !== 0 || e.button === 2));
    const hasBarrelButtons = ((e.buttons & 2) !== 0) || ((e.buttons & 32) !== 0) || ((e.buttons & 4) !== 0);
    const hasBarrelButtonIndex = e.button === 2 || e.button === 5;
    const hasStylusModifier = (e.altKey || (e.ctrlKey && isPen));
    return Boolean(isPen && (hasBarrelButtons || hasBarrelButtonIndex || hasStylusModifier));
  };

  const getInlineCoords = (e) => {
    const canvas = inlineCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleInlinePointerDown = (e) => {
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    const ctx = canvas.getContext('2d');
    const { x, y } = getInlineCoords(e);
    inlineDrawingRef.current = true;
    setInlineHasInk(true);

    if (isStylusEraser(e)) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 26;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = e.pressure ? Math.max(2.5, e.pressure * 6) : 3.5;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const handleInlinePointerMove = (e) => {
    if (!inlineDrawingRef.current) return;
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getInlineCoords(e);

    if (isStylusEraser(e)) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 26;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = e.pressure ? Math.max(2.5, e.pressure * 6) : 3.5;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleInlinePointerUp = () => {
    if (!inlineDrawingRef.current) return;
    inlineDrawingRef.current = false;
    const canvas = inlineCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
      const cropped = cropCanvasInk(canvas) || canvas.toDataURL('image/png');
      setNewHandwriting(cropped);
      setNewHandwritingIsInline(true);
    }
  };

  const clearInlineCanvas = () => {
    const canvas = inlineCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setInlineHasInk(false);
    setNewHandwriting(null);
    setNewHandwritingIsInline(false);
  };

  // Add Task (incorporating natural language detections!)
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTitle.trim() && !newHandwriting) return;

    const inListView = (activeView === 'list' || activeView === 'projects') && selectedListId;
    const defaultList = inListView ? selectedListId : 'inbox';
    const targetList = parsedQuickAdd.detectedList ? parsedQuickAdd.detectedList.id : defaultList;
    const isMyDay = activeView === 'today' || parsedQuickAdd.detectedDate === todayStr;

    const isInline = newHandwritingIsInline === true || (!newTitle.trim() && !!newHandwriting && newHandwritingIsInline !== false);
    const finalTitle = parsedQuickAdd.cleanTitle || (isInline ? '' : (newHandwriting ? 'Handwritten sketch' : newTitle.trim()));
    const finalPriority = parsedQuickAdd.detectedPriority || newPriority;
    const finalDueDate = parsedQuickAdd.detectedDate || newDueDate || (activeView === 'today' ? todayStr : null);
    const finalRecurrence = parsedQuickAdd.detectedRecurrence || newRecurrence;
    const finalInterval = parsedQuickAdd.detectedRecurrence ? parsedQuickAdd.detectedInterval : newRecurrenceInterval;

    syncEngine.addTodo(
      finalTitle,
      targetList,
      finalPriority,
      finalDueDate,
      '',
      {
        inMyDay: isMyDay,
        plannedDate: isMyDay ? todayStr : null,
        reminderTime: parsedQuickAdd.detectedTime || null,
        recurrence: finalRecurrence,
        recurrenceInterval: finalInterval,
        handwriting: newHandwriting,
        isInlineHandwriting: isInline
      }
    );

    setNewTitle('');
    setNewDueDate('');
    setNewRecurrence('none');
    setNewRecurrenceInterval(1);
    setNewHandwriting(null);
    setNewHandwritingIsInline(false);
    if (inlineHasInk) clearInlineCanvas();
    setShowInlinePenStrip(false);
  };

  // Carry forward yesterday's unfinished tasks (all or selective)
  const handleCarryForward = (subsetIds = null) => {
    const count = syncEngine.carryForwardUnfinished(subsetIds, dayStartHour);
    setShowLeftoversPicker(false);
    setCarryForwardNotice(`Carried forward ${count} task${count === 1 ? '' : 's'} to My Day!`);
    setTimeout(() => setCarryForwardNotice(null), 3500);
  };

  const handleOpenCanvas = (todoId = null, initialImg = null) => {
    setCanvasTargetTodoId(todoId);
    setCanvasInitialImage(initialImg);
    setShowCanvasModal(true);
  };

  const handleSaveCanvas = (dataUrl) => {
    if (canvasTargetTodoId) {
      syncEngine.updateTodo(canvasTargetTodoId, { handwriting: dataUrl, isInlineHandwriting: false });
    } else {
      setNewHandwriting(dataUrl);
      setNewHandwritingIsInline(false);
    }
    setShowCanvasModal(false);
  };

  // Progress Ring calculation for My Day
  const myDayTodos = syncState.todos.filter(t => {
    if (t.deletedAt) return false;
    if (!t.completed) {
      return t.dueDate === todayStr || (t.inMyDay && (!t.plannedDate || t.plannedDate === todayStr));
    } else {
      return t.completedAt
        ? isSameLogicalDay(t.completedAt, todayStr, dayStartHour)
        : (t.plannedDate === todayStr || t.dueDate === todayStr);
    }
  });
  const myDayDoneCount = myDayTodos.filter(t => t.completed).length;
  const myDayTotalCount = myDayTodos.length;
  const myDayPct = myDayTotalCount > 0 ? Math.round((myDayDoneCount / myDayTotalCount) * 100) : 0;

  // Unified Sync Pill status
  const activePeerCount = syncState.p2pInfo?.activeP2PCount || 0;
  const pendingPairCount = syncState.p2pInfo?.pendingRequests?.length || 0;
  const isWsConnected = syncState.status === 'CONNECTED';
  const isSyncedLive = activePeerCount > 0 || isWsConnected;
  const isLandscapePhone = deviceType === 'phone' && window.innerWidth >= 560 && window.innerWidth > window.innerHeight;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
      paddingTop: 'var(--sat)',
      paddingBottom: deviceType === 'phone' ? 'var(--sab)' : '0px',
      paddingLeft: deviceType === 'phone' ? 'var(--sal)' : '0px',
      paddingRight: deviceType === 'phone' ? 'var(--sar)' : '0px',
      overflow: 'hidden'
    }}>
      {/* ==================================================== */}
      {/* APP HEADER                                          */}
      {/* ==================================================== */}
      <header style={{
        height: isLandscapePhone ? '46px' : (deviceType === 'phone' ? '54px' : '58px'),
        paddingLeft: 'max(12px, var(--sal))',
        paddingRight: 'max(12px, var(--sar))',
        paddingTop: 0,
        paddingBottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        flexShrink: 0,
        zIndex: 20
      }}>
        {/* Left: App Logo & Friendly Device Name Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isLandscapePhone ? '7px' : '9px' }}>
          <div style={{
            width: isLandscapePhone ? '28px' : '32px',
            height: isLandscapePhone ? '28px' : '32px',
            borderRadius: isLandscapePhone ? '8px' : '10px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            flexShrink: 0
          }}>
            <Icon name="check" size={isLandscapePhone ? 15 : 18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: isLandscapePhone ? '15px' : (deviceType === 'phone' ? '16px' : '17px'), fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: 'var(--text)' }}>
                SyncToDo
              </h1>
              {deviceType !== 'phone' && (
                <span style={{
                  fontSize: '9.5px',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--tag-bg)',
                  color: 'var(--tag-text)',
                  fontWeight: 700
                }}>
                  {syncEngine.deviceName || syncState.p2pInfo?.deviceName || deviceType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Search (Laptop/Tablet or wide landscape phone) */}
        {((deviceType !== 'phone') || (isLandscapePhone && window.innerWidth >= 680)) && (
          <div style={{
            position: 'relative',
            width: deviceType === 'laptop' ? '310px' : (isLandscapePhone ? '200px' : '220px'),
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={isLandscapePhone ? "Search tasks..." : "Search tasks, notes ( / )..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              dir="auto"
              style={{
                width: '100%',
                padding: isLandscapePhone ? '5px 24px 5px 28px' : (deviceType === 'phone' ? '8px 28px 8px 32px' : '7px 28px 7px 32px'),
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text)',
                fontSize: isLandscapePhone ? '12px' : (deviceType === 'phone' ? '16px' : '13px'),
                outline: 'none',
                textAlign: 'start'
              }}
            />
            <span style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)', display: 'flex' }}>
              <Icon name="search" size={isLandscapePhone ? 12 : 14} />
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        )}

        {/* Right: Unified Sync Status Pill & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isLandscapePhone ? '5px' : (deviceType === 'phone' ? '6px' : '8px'), flexShrink: 0 }}>
          {/* Unified Sync Pill */}
          <button
            onClick={() => setShowDevicesModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: isLandscapePhone ? '30px' : 'auto',
              padding: isLandscapePhone ? '0 10px' : (deviceType === 'phone' ? '5px 9px' : '6px 12px'),
              borderRadius: '999px',
              border: pendingPairCount > 0
                ? '1.5px solid #10b981'
                : '1px solid var(--border)',
              backgroundColor: pendingPairCount > 0
                ? 'rgba(16, 185, 129, 0.15)'
                : 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: isLandscapePhone ? '11px' : '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Pair & sync devices on your Wi-Fi"
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: pendingPairCount > 0
                ? '#10b981'
                : activePeerCount > 0
                ? '#10b981'
                : isSyncedLive
                ? '#38bdf8'
                : '#f59e0b',
              boxShadow: activePeerCount > 0 ? '0 0 8px rgba(16,185,129,0.6)' : 'none',
              flexShrink: 0
            }} />
            <span>
              {deviceType === 'phone'
                ? (pendingPairCount > 0 ? `${pendingPairCount}` : activePeerCount > 0 ? `${activePeerCount} device${activePeerCount > 1 ? 's' : ''}` : 'Sync')
                : (pendingPairCount > 0 ? `Pair Request (${pendingPairCount})` : activePeerCount > 0 ? `Synced · ${activePeerCount} device${activePeerCount > 1 ? 's' : ''}` : 'Pair Devices')}
            </span>
          </button>

          {/* Theme Modal Trigger */}
          <button
            onClick={() => setShowThemeModal(true)}
            style={{
              height: isLandscapePhone ? '30px' : 'auto',
              padding: isLandscapePhone ? '0 8px' : (deviceType === 'phone' ? '6px 8px' : '6px 10px'),
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Theme & Auto-Schedule"
          >
            <Icon name="palette" size={14} />
            {deviceType !== 'phone' && <span>Themes</span>}
          </button>

          {/* Settings & Calendars Modal Trigger */}
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{
              height: isLandscapePhone ? '30px' : 'auto',
              padding: isLandscapePhone ? '0 8px' : (deviceType === 'phone' ? '6px 8px' : '6px 10px'),
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Settings & Calendars"
          >
            <Icon name="gear" size={14} />
            {deviceType !== 'phone' && <span>Settings</span>}
          </button>

          {/* Daily Planner Trigger (Only on Laptop/Tablet, phone has dedicated tab in bottom nav) */}
          {deviceType !== 'phone' && (
            <button
              onClick={() => setShowPlannerModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '9px',
                border: 'none',
                background: 'var(--primary-gradient)',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Plan My Day from your lists"
            >
              <Icon name="sun" size={14} />
              <span>Plan Day</span>
            </button>
          )}
        </div>
      </header>

      {/* ==================================================== */}
      {/* MAIN WORKSPACE BODY                                  */}
      {/* ==================================================== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Sidebar Navigation (Laptop & Tablet) */}
        {deviceType !== 'phone' && (
          <aside style={{
            width: deviceType === 'laptop' ? '230px' : '190px',
            backgroundColor: 'var(--bg-subtle)',
            borderRight: '1px solid var(--border)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            flexShrink: 0
          }}>
            {/* Smart Views */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.6px', padding: '0 8px 6px 8px' }}>
                Smart Views
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {[
                  { id: 'today', icon: 'sun', label: 'My Day', count: syncState.todos.filter(t => !t.completed && !t.deletedAt && (t.dueDate === todayStr || (t.inMyDay && (!t.plannedDate || t.plannedDate === todayStr)))).length },
                  { id: 'all', icon: 'list', label: 'All Tasks', count: syncState.todos.filter(t => !t.completed && !t.deletedAt).length },
                ].map(v => {
                  const isActive = activeView === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => { setActiveView(v.id); setSelectedListId(null); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: '9px', border: 'none',
                        background: isActive ? 'var(--surface-elevated)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text)',
                        fontSize: '13px', fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer', textAlign: 'left'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name={v.icon} size={15} /> {v.label}
                      </span>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>{v.count}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setActiveView('analytics')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '9px', border: 'none',
                    background: activeView === 'analytics' ? 'var(--surface-elevated)' : 'transparent',
                    color: activeView === 'analytics' ? 'var(--primary)' : 'var(--text)',
                    fontSize: '13px', fontWeight: activeView === 'analytics' ? 700 : 500,
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="chart" size={15} /> Productivity Plots
                  </span>
                </button>
              </div>
            </div>

            {/* User Lists */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 6px 8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.6px' }}>
                  My Lists
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {listSelectMode ? (
                    <>
                      <button
                        onClick={handleSelectAllLists}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                      >
                        All
                      </button>
                      <button
                        onClick={() => handleRequestDeleteLists(syncState.lists.filter(l => selectedListIds.has(l.id)))}
                        disabled={selectedListIds.size === 0}
                        style={{
                          background: selectedListIds.size > 0 ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: selectedListIds.size > 0 ? '#ef4444' : 'var(--text-muted)',
                          cursor: selectedListIds.size > 0 ? 'pointer' : 'default',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Delete selected lists"
                      >
                        <Icon name="trash" size={11} /> {selectedListIds.size}
                      </button>
                      <button
                        onClick={handleExitListSelect}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      {syncState.lists.some(l => l.id !== 'inbox') && (
                        <button
                          onClick={() => setListSelectMode(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                          title="Select lists to delete (or hold on any list)"
                        >
                          Select
                        </button>
                      )}
                      <button
                        onClick={() => setShowListsModal(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                        title="Create or manage lists"
                      >
                        + New
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div
                data-lists-container="sidebar"
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
              >
                {syncState.lists.map((list, listIdx) => {
                  const count = syncState.todos.filter(t => !t.completed && !t.deletedAt && t.listId === list.id).length;
                  const isActive = activeView === 'list' && selectedListId === list.id;
                  const isSelected = selectedListIds.has(list.id);
                  const isSystem = list.id === 'inbox';
                  const listOffset = getListDragOffset(listIdx, 'sidebar');
                  const isBeingDragged = listDrag && listDrag.source === 'sidebar' && listDrag.id === list.id;

                  return (
                    <div
                      key={list.id}
                      data-list-item={list.id}
                      onTouchStart={() => handleItemTouchStart(list.id, isSystem)}
                      onTouchEnd={() => {
                        if (didDragRef.current) return;
                        handleItemTouchEnd(list.id, isSystem, () => {
                          setActiveView('list');
                          setSelectedListId(list.id);
                        });
                      }}
                      onTouchMove={handleItemTouchCancel}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        handleItemTouchStart(list.id, isSystem);
                        if (!listSelectMode) {
                          pendingPointerDragRef.current = {
                            kind: 'list',
                            list,
                            index: listIdx,
                            startX: e.clientX,
                            startY: e.clientY,
                            el: e.currentTarget,
                            gap: 4,
                            source: 'sidebar'
                          };
                        }
                      }}
                      onMouseUp={() => {
                        pendingPointerDragRef.current = null;
                        if (didDragRef.current) return;
                        handleItemTouchEnd(list.id, isSystem, () => {
                          setActiveView('list');
                          setSelectedListId(list.id);
                        });
                      }}
                      onMouseLeave={handleItemTouchCancel}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isSystem) {
                          setListContextMenu({ x: e.clientX, y: e.clientY, list });
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: '9px',
                        border: isSelected ? '1px solid #ef4444' : '1px solid transparent',
                        background: isSelected ? 'rgba(239, 68, 68, 0.1)' : isActive ? 'var(--surface-elevated)' : 'transparent',
                        color: isSelected ? '#ef4444' : isActive ? 'var(--primary)' : 'var(--text)',
                        fontSize: '13px', fontWeight: isActive || isSelected ? 700 : 500,
                        cursor: 'pointer', textAlign: 'left',
                        userSelect: 'none', WebkitUserSelect: 'none',
                        transform: listOffset ? `translateY(${listOffset}px)` : 'none',
                        transition: listDrag ? 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)' : 'background 0.15s ease, color 0.15s ease',
                        opacity: isBeingDragged ? 0 : 1,
                        visibility: isBeingDragged ? 'hidden' : 'visible',
                        pointerEvents: isBeingDragged ? 'none' : 'auto',
                        position: 'relative',
                        zIndex: 1
                      }}
                      title={isSystem ? 'Drag to reorder, or click to open' : 'Drag to reorder, hold to select & delete, or click to open'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        {!listSelectMode && (
                          <span
                            style={{
                              cursor: 'grab',
                              color: 'var(--text-muted)',
                              opacity: 0.45,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              touchAction: 'none',
                              padding: '2px',
                              flexShrink: 0
                            }}
                            title="Drag to reorder list"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (e.button !== 0) return;
                              const itemEl = e.currentTarget.closest('[data-list-item]');
                              if (itemEl) startListDrag(list, listIdx, e.clientY, itemEl, 4, 'sidebar');
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              if (!e.touches || !e.touches[0]) return;
                              const itemEl = e.currentTarget.closest('[data-list-item]');
                              if (itemEl) startListDrag(list, listIdx, e.touches[0].clientY, itemEl, 4, 'sidebar');
                            }}
                          >
                            <Icon name="grip" size={12} />
                          </span>
                        )}
                        {listSelectMode && (
                          <span style={{
                            width: '16px', height: '16px', borderRadius: '50%',
                            border: isSelected ? '2px solid #ef4444' : '2px solid var(--border)',
                            backgroundColor: isSelected ? '#ef4444' : 'transparent',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            color: '#ffffff', fontSize: '10px', fontWeight: 800, flexShrink: 0
                          }}>
                            {isSelected ? '✓' : ''}
                          </span>
                        )}
                        <span>{normalizeListIcon(list.icon)}</span>
                        <span dir="auto" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'plaintext' }}>{list.name}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', opacity: 0.7 }}>{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Center Task Workspace */}
        <main
          ref={mainRef}
          onScroll={() => { if (mainRef.current) mainRef.current.scrollTop = 0; }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg)',
            overflow: 'hidden',
            minWidth: 0,
            contain: 'paint'
          }}
        >
          {/* Sub-header / Filter Toolbar */}
          {activeView !== 'analytics' && (
            <div style={{
              padding: deviceType === 'phone' ? '10px 14px' : '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              backgroundColor: 'var(--surface)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Progress Ring on My Day */}
                {activeView === 'today' && (
                  <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }} title={`${myDayPct}% completed today`}>
                    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="22" cy="22" r="17.5" fill="none" stroke="var(--border)" strokeWidth="3.2" />
                      <circle
                        cx="22"
                        cy="22"
                        r="17.5"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeDasharray={`${(2 * Math.PI * 17.5).toFixed(2)}`}
                        strokeDashoffset={`${(2 * Math.PI * 17.5 * (1 - myDayPct / 100)).toFixed(2)}`}
                        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
                      />
                    </svg>
                    <span style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: `${myDayDoneCount}/${myDayTotalCount}`.length > 5 ? '9px' : `${myDayDoneCount}/${myDayTotalCount}`.length > 4 ? '10px' : '11.5px',
                      fontWeight: 800,
                      color: 'var(--text)',
                      letterSpacing: '-0.2px'
                    }}>
                      {myDayDoneCount}/{myDayTotalCount}
                    </span>
                  </div>
                )}

                <div>
                  <h2 style={{ fontSize: deviceType === 'phone' ? '16px' : '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {searchQuery.trim() ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="search" size={18} style={{ color: 'var(--primary)' }} />
                        <span>Search: “{searchQuery}”</span>
                      </span>
                    ) : (
                      <>
                        {activeView === 'today' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Icon name="sun" size={18} style={{ color: '#fbbf24' }} />
                              <span>My Day</span>
                            </span>
                            <span
                              style={{
                                fontSize: deviceType === 'phone' ? '12px' : '13px',
                                fontWeight: 700,
                                color: 'var(--primary)',
                                backgroundColor: 'var(--tag-bg)',
                                border: '1px solid var(--border)',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap'
                              }}
                              title={`Current Date (${calendarType})`}
                            >
                              <Icon name="cal" size={13} />
                              <span>{formatDayDateHeader(new Date(), calendarType, dayStartHour)}</span>
                            </span>
                          </span>
                        )}
                        {activeView === 'all' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name="list" size={18} style={{ color: 'var(--primary)' }} /> All Tasks
                          </span>
                        )}
                        {activeView === 'list' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span>
                              {normalizeListIcon(syncState.lists.find(l => l.id === selectedListId)?.icon) || '📁'}{' '}
                              {syncState.lists.find(l => l.id === selectedListId)?.name || 'List'}
                            </span>
                            {selectedListId && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => {
                                    const currList = syncState.lists.find(l => l.id === selectedListId);
                                    if (currList) setEditingList(currList);
                                  }}
                                  title="Edit list name, icon & color"
                                  style={{
                                    background: 'var(--tag-bg, rgba(99, 102, 241, 0.1))',
                                    border: '1px solid var(--border, rgba(99, 102, 241, 0.25))',
                                    borderRadius: '6px',
                                    color: 'var(--primary, #6366f1)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Icon name="pen" size={11} /> Edit List
                                </button>
                                {selectedListId !== 'inbox' && (
                                  <button
                                    onClick={() => handleRequestDeleteLists(syncState.lists.filter(l => l.id === selectedListId))}
                                    title="Delete this list"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      border: '1px solid rgba(239, 68, 68, 0.25)',
                                      borderRadius: '6px',
                                      color: '#ef4444',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Icon name="trash" size={11} /> Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </h2>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {sortedActive.length} active{sortedCompleted.length > 0 ? ` · ${sortedCompleted.length} completed` : ''}
                  </span>
                </div>
              </div>

              {/* Filter Chips & Sort Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={toggleSortByDate}
                  title={sortByDate ? 'Sorted chronologically by Due Date (earliest first) — click to disable' : 'Sort tasks by Due Date (off by default)'}
                  style={{
                    padding: deviceType === 'phone' ? '5px 8px' : '5px 10px',
                    borderRadius: '999px',
                    border: sortByDate ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: sortByDate ? 'var(--tag-bg)' : 'transparent',
                    color: sortByDate ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon name="sortDate" size={13} />
                  <span>{sortByDate ? 'By Date ✓' : 'By Date'}</span>
                </button>

                <button
                  onClick={() => setFilterRecurring(!filterRecurring)}
                  style={{
                    padding: '5px 10px', borderRadius: '999px',
                    border: '1px solid var(--border)',
                    backgroundColor: filterRecurring ? 'var(--tag-bg)' : 'transparent',
                    color: filterRecurring ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Icon name="repeat" size={12} /> Recurring
                </button>

                <button
                  onClick={() => setFilterHandwriting(!filterHandwriting)}
                  style={{
                    padding: '5px 10px', borderRadius: '999px',
                    border: '1px solid var(--border)',
                    backgroundColor: filterHandwriting ? 'var(--tag-bg)' : 'transparent',
                    color: filterHandwriting ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Icon name="pen" size={12} /> Stylus
                </button>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  style={{
                    padding: '5px 10px', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg)', color: 'var(--text)',
                    fontSize: '11px', fontWeight: 600, outline: 'none'
                  }}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          )}

          {/* Upgraded Leftovers / Yesterday Carry-Forward Banner */}
          {activeView === 'today' && overdueTasks.length > 0 && leftoversDismissedDate !== todayStr && (
            <div style={{
              margin: '12px 16px 0 16px',
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9px',
                    background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Icon name="clock" size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f59e0b' }}>
                      {overdueTasks.length} unfinished task{overdueTasks.length > 1 ? 's' : ''} from earlier
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Bring them into today's focus or pick which ones to carry forward
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => handleCarryForward(null)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#f59e0b',
                      color: '#0f172a',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Bring all
                  </button>
                  <button
                    onClick={() => {
                      if (!showLeftoversPicker) {
                        setSelectedLeftoverIds(new Set(overdueTasks.map(t => t.id)));
                      }
                      setShowLeftoversPicker(!showLeftoversPicker);
                    }}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Choose…
                  </button>
                  <button
                    onClick={() => setLeftoversDismissedDate(todayStr)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {showLeftoversPicker && (
                <div style={{
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {overdueTasks.map((t) => {
                    const checked = selectedLeftoverIds.has(t.id);
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: 'var(--surface)',
                          fontSize: '12.5px',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedLeftoverIds(prev => {
                              const next = new Set(prev);
                              if (next.has(t.id)) next.delete(t.id);
                              else next.add(t.id);
                              return next;
                            });
                          }}
                        />
                        <span style={{ flex: 1, fontWeight: 600 }}><BidiTaskTitle title={t.title} /></span>
                        {t.dueDate && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.dueDate}</span>}
                      </label>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleCarryForward(Array.from(selectedLeftoverIds))}
                      disabled={selectedLeftoverIds.size === 0}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--primary)',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: selectedLeftoverIds.size > 0 ? 'pointer' : 'default'
                      }}
                    >
                      Bring Selected ({selectedLeftoverIds.size})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {carryForwardNotice && (
            <div style={{
              margin: '10px 16px 0 16px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: 600
            }}>
              ✓ {carryForwardNotice}
            </div>
          )}

          {/* View Content Area */}
          <div
            ref={scrollContainerRef}
            onScroll={(e) => {
              const top = e.currentTarget.scrollTop;
              viewScrollMap.current[currentViewKey] = top;
              try {
                localStorage.setItem('synctodo_scroll_positions_v1', JSON.stringify(viewScrollMap.current));
              } catch (_) {}
            }}
            style={{ flex: 1, overflowY: 'auto', padding: deviceType === 'phone' ? '12px' : '16px 20px' }}
          >
            {activeView === 'analytics' ? (
              <AnalyticsDashboard
                todos={syncState.todos}
                lists={syncState.lists}
                onClose={() => setActiveView('today')}
              />
            ) : (() => {
              const renderTodoCard = (todo, isCompleted = false, index = -1) => {
                const listObj = syncState.lists.find(l => l.id === todo.listId);
                const isSelected = selectedTodoId === todo.id;
                const isSwipedOpen = swipedTodoId === todo.id;
                const steps = Array.isArray(todo.steps) ? todo.steps : [];
                const doneSteps = steps.filter(s => s.completed).length;

                const dragOffset = !isCompleted && index !== -1 ? getTaskDragOffset(index) : 0;
                const isCurrentlyDragged = !isCompleted && Boolean(taskDrag && taskDrag.id === todo.id);
                const isInlineNote = todo.isInlineHandwriting === true || (todo.isInlineHandwriting !== false && todo.handwriting && (!todo.title || todo.title === 'Handwritten task' || todo.title === 'Handwritten sketch' || todo.title.trim() === ''));

                return (
                  <div
                    key={todo.id}
                    data-todo-card={todo.id}
                    data-active-card={!isCompleted ? 'true' : 'false'}
                    style={{
                      position: 'relative',
                      overflow: isSwipedOpen ? 'hidden' : 'visible',
                      borderRadius: '12px',
                      transform: dragOffset ? `translateY(${dragOffset}px)` : 'none',
                      transition: taskDrag ? 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)' : 'none',
                      zIndex: isCurrentlyDragged ? 0 : 1,
                      opacity: isCurrentlyDragged ? 0 : 1,
                      visibility: isCurrentlyDragged ? 'hidden' : 'visible',
                      pointerEvents: isCurrentlyDragged ? 'none' : 'auto'
                    }}
                  >
                    {/* Reveal Actions behind card on Left Swipe (Phone/Touch) */}
                    {isSwipedOpen && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        paddingRight: '10px',
                        zIndex: 2
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwipedTodoId(null);
                            handleTogglePinTodo(todo);
                          }}
                          style={{
                            padding: '8px 11px',
                            borderRadius: '9px',
                            border: 'none',
                            background: todo.pinned ? '#3b82f6' : '#f59e0b',
                            color: todo.pinned ? '#ffffff' : '#0f172a',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Icon name={todo.pinned ? 'pin' : 'pinFilled'} size={12} />
                          <span>{todo.pinned ? 'Unpin' : 'Pin'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            const tmrw = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            syncEngine.updateTodo(todo.id, { dueDate: tmrw, inMyDay: false });
                            setSwipedTodoId(null);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '9px',
                            border: 'none',
                            background: '#fbbf24',
                            color: '#0f172a',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Tomorrow
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwipedTodoId(null);
                            handleDeleteTodoWithUndo(todo);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '9px',
                            border: 'none',
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    <div
                      onClick={() => {
                        if (isIgnoreClicksRef.current || didDragRef.current) return;
                        if (isSwipedOpen) {
                          setSwipedTodoId(null);
                          return;
                        }
                        setSelectedTodoId(isSelected ? null : todo.id);
                      }}
                      onMouseDown={(e) => {
                        if (isCompleted || e.button !== 0) return;
                        if (e.target.closest('button')) return;
                        const cardEl = e.currentTarget.closest('[data-todo-card]');
                        if (cardEl) {
                          pendingPointerDragRef.current = {
                            kind: 'task',
                            todo,
                            index,
                            startX: e.clientX,
                            startY: e.clientY,
                            el: cardEl
                          };
                        }
                      }}
                      onTouchStart={(e) => {
                        if (!e.touches || e.touches.length === 0) return;
                        const touch = e.touches[0];
                        touchSwipeRef.current = {
                          id: todo.id,
                          startX: touch.clientX,
                          startY: touch.clientY,
                          deltaX: 0
                        };
                        if (cardHoldTimerRef.current) clearTimeout(cardHoldTimerRef.current);
                        if (!isCompleted && !e.target.closest('button')) {
                          const cardEl = e.currentTarget.closest('[data-todo-card]');
                          cardHoldTimerRef.current = setTimeout(() => {
                            if (cardEl && !isSwipedOpen) {
                              startTaskDrag(todo, index, touch.clientY, cardEl);
                              touchSwipeRef.current = { id: null, startX: 0, startY: 0, deltaX: 0 };
                            }
                          }, 260);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (!e.touches || e.touches.length === 0) return;
                        const touch = e.touches[0];
                        if (touchSwipeRef.current.id === todo.id) {
                          const dx = touch.clientX - touchSwipeRef.current.startX;
                          const dy = touch.clientY - touchSwipeRef.current.startY;
                          if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
                            if (cardHoldTimerRef.current) {
                              clearTimeout(cardHoldTimerRef.current);
                              cardHoldTimerRef.current = null;
                            }
                          }
                          if (Math.abs(dx) > Math.abs(dy)) {
                            touchSwipeRef.current.deltaX = dx;
                          }
                        }
                      }}
                      onTouchEnd={() => {
                        if (cardHoldTimerRef.current) {
                          clearTimeout(cardHoldTimerRef.current);
                          cardHoldTimerRef.current = null;
                        }
                        if (taskDragRef.current && taskDragRef.current.active) return;
                        if (touchSwipeRef.current.id !== todo.id) return;
                        const dx = touchSwipeRef.current.deltaX;
                        if (dx > 65) {
                          // Swipe right -> toggle complete
                          handleToggleTodoWithUndo(todo);
                          setSwipedTodoId(null);
                        } else if (dx < -55) {
                          // Swipe left -> reveal Tomorrow / Delete actions
                          setSwipedTodoId(todo.id);
                        } else if (dx > 25 && isSwipedOpen) {
                          setSwipedTodoId(null);
                        }
                        touchSwipeRef.current = { id: null, startX: 0, startY: 0, deltaX: 0 };
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: deviceType === 'phone' ? '12px' : '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: isSelected
                          ? 'var(--surface-elevated)'
                          : isCompleted
                          ? 'var(--bg-subtle)'
                          : todo.pinned
                          ? (isDarkTheme ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.04)')
                          : 'var(--surface)',
                        border: isSelected
                          ? (todo.pinned ? '1.5px solid #f59e0b' : '1.5px solid var(--primary)')
                          : isCompleted
                          ? '1px dashed var(--border)'
                          : todo.pinned
                          ? '1px solid rgba(245, 158, 11, 0.38)'
                          : '1px solid var(--border)',
                        borderLeft: todo.pinned && !isCompleted
                          ? '3.5px solid #f59e0b'
                          : undefined,
                        boxShadow: isCompleted
                          ? 'none'
                          : todo.pinned
                          ? '0 2px 8px rgba(245, 158, 11, 0.08), var(--card-shadow)'
                          : 'var(--card-shadow)',
                        opacity: isCompleted ? 0.72 : 1,
                        cursor: 'pointer',
                        gap: deviceType === 'phone' ? '10px' : '12px',
                        transform: isSwipedOpen ? 'translateX(-220px)' : 'translateX(0)',
                        transition: 'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',
                        position: 'relative',
                        zIndex: 1,
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                      }}
                    >
                      {/* Drag Grip (Supports Desktop Drag & Mobile Touch Drag) */}
                      {!isCompleted && (
                        <div
                          style={{
                            cursor: 'grab',
                            userSelect: 'none',
                            color: isCurrentlyDragged ? 'var(--primary)' : 'var(--text-muted)',
                            opacity: isCurrentlyDragged ? 1 : 0.45,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '2px',
                            touchAction: 'none',
                            padding: '4px 3px'
                          }}
                          title="Drag to reorder (or Alt+↑/↓)"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (e.button !== 0) return;
                            const cardEl = e.currentTarget.closest('[data-todo-card]');
                            if (cardEl) startTaskDrag(todo, index, e.clientY, cardEl);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            if (!e.touches || !e.touches[0]) return;
                            const cardEl = e.currentTarget.closest('[data-todo-card]');
                            if (cardEl) startTaskDrag(todo, index, e.touches[0].clientY, cardEl);
                          }}
                        >
                          <Icon name="grip" size={14} />
                        </div>
                      )}

                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTodoWithUndo(todo);
                        }}
                        title={isCompleted ? 'Mark active' : 'Mark done for today'}
                        style={{
                          width: '22px',
                          height: '22px',
                          minWidth: '22px',
                          borderRadius: '50%',
                          border: isCompleted
                            ? 'none'
                            : todo.priority === 'high'
                            ? '2px solid #ef4444'
                            : '2px solid var(--text-muted)',
                          background: isCompleted ? '#10b981' : 'transparent',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          marginTop: '2px',
                          boxShadow: isCompleted ? '0 2px 6px rgba(16, 185, 129, 0.35)' : 'none'
                        }}
                      >
                        {isCompleted && <Icon name="check" size={13} />}
                      </button>

                      {/* Title & Metadata */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: deviceType === 'phone' ? '14.5px' : '15px',
                          fontWeight: isCompleted ? 500 : 600,
                          lineHeight: 1.4,
                          color: isCompleted ? 'var(--text-muted)' : 'var(--text)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          wordBreak: 'break-word'
                        }}>
                          {isInlineNote ? (
                            <HandwrittenTitle src={todo.handwriting} isCompleted={isCompleted} isDarkTheme={isDarkTheme} />
                          ) : (
                            <BidiTaskTitle title={todo.title} />
                          )}
                        </div>

                        {todo.notes && (
                          <div
                            dir={hasPersianChar(todo.notes) ? 'rtl' : 'ltr'}
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '3px',
                              lineHeight: 1.35,
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              unicodeBidi: 'plaintext',
                              textAlign: detectBidiDirection(todo.title) === 'rtl' ? 'right' : 'left'
                            }}
                          >
                            {todo.notes}
                          </div>
                        )}

                        {todo.handwriting && !isInlineNote && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCanvas(todo.id, todo.handwriting);
                            }}
                            style={{
                              marginTop: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer'
                            }}
                            title="View or edit sketch attachment"
                          >
                            <img
                              src={todo.handwriting}
                              alt="Handwriting attachment"
                              style={{
                                width: '36px',
                                height: '22px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                background: 'transparent',
                                filter: isDarkTheme ? 'invert(1) brightness(1.2)' : 'none'
                              }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                              Attachment
                            </span>
                          </div>
                        )}

                        {/* Clean Metadata Badges */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '6px',
                          justifyContent: detectBidiDirection(todo.title) === 'rtl' ? 'flex-end' : 'flex-start'
                        }}>
                          {todo.pinned && !isCompleted && (
                            <span style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(245, 158, 11, 0.16)',
                              color: '#f59e0b',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <Icon name="pinFilled" size={10} /> Pinned
                            </span>
                          )}

                          {listObj && (activeView !== 'list' || selectedListId !== listObj.id) && (
                            <span style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-muted)',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>{normalizeListIcon(listObj.icon)}</span> {listObj.name}
                            </span>
                          )}

                          {steps.length > 0 && (
                            <span style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: doneSteps === steps.length ? 'rgba(16, 185, 129, 0.14)' : 'var(--tag-bg)',
                              color: doneSteps === steps.length ? '#10b981' : 'var(--primary)',
                              fontWeight: 700
                            }}>
                              ✓ {doneSteps}/{steps.length}
                            </span>
                          )}

                          {!isCompleted && todo.priority === 'high' && (
                            <span style={{
                              fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.14)', color: '#ef4444', fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', gap: '3px'
                            }}>
                              <Icon name="flag" size={10} /> High
                            </span>
                          )}

                          {todo.dueDate && (
                            <span
                              dir={calendarType === 'gregorian' ? 'ltr' : 'rtl'}
                              style={{
                                fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                                background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontWeight: 600,
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                unicodeBidi: 'isolate'
                              }}
                            >
                              <Icon name="cal" size={11} />
                              <span style={{ unicodeBidi: 'isolate' }}>{formatDueDateBadge(todo.dueDate, todayStr, calendarType, showWeekdayInTasks)}</span>
                              {todo.reminderTime ? ` · ${todo.reminderTime}` : ''}
                            </span>
                          )}

                          {todo.recurrence && todo.recurrence !== 'none' && (
                            <span style={{
                              fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                              background: 'rgba(99, 102, 241, 0.14)', color: 'var(--primary)', fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', gap: '3px'
                            }}>
                              <Icon name="repeat" size={10} />
                              {todo.recurrence === 'custom' ? `Every ${todo.recurrenceInterval}d` : todo.recurrence}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Streamlined Right Quick Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePinTodo(todo);
                            }}
                            title={todo.pinned ? 'Unpin task from top' : 'Pin task to top'}
                            aria-label={todo.pinned ? 'Unpin task' : 'Pin task'}
                            style={{
                              background: todo.pinned ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
                              border: todo.pinned ? '1px solid rgba(245, 158, 11, 0.45)' : 'none',
                              borderRadius: '7px',
                              color: todo.pinned ? '#f59e0b' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '5px',
                              display: 'flex',
                              opacity: todo.pinned ? 1 : (deviceType === 'phone' ? 0.7 : 0.65),
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!todo.pinned) {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.color = '#f59e0b';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!todo.pinned) {
                                e.currentTarget.style.opacity = deviceType === 'phone' ? '0.7' : '0.65';
                                e.currentTarget.style.color = 'var(--text-muted)';
                              }
                            }}
                          >
                            <Icon name={todo.pinned ? 'pinFilled' : 'pin'} size={15} />
                          </button>
                        )}

                        {activeView !== 'today' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              syncEngine.updateTodo(todo.id, {
                                inMyDay: !todo.inMyDay,
                                plannedDate: !todo.inMyDay ? todayStr : null
                              });
                            }}
                            title={todo.inMyDay ? 'Remove from My Day' : 'Add to My Day'}
                            style={{
                              background: todo.inMyDay ? 'rgba(251,191,36,0.15)' : 'transparent',
                              border: todo.inMyDay ? '1px solid rgba(251,191,36,0.4)' : 'none',
                              borderRadius: '7px',
                              color: todo.inMyDay ? '#fbbf24' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '5px',
                              display: 'flex'
                            }}
                          >
                            <Icon name="sun" size={15} />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTodoWithUndo(todo);
                          }}
                          title="Delete task"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '5px',
                            display: 'flex',
                            opacity: 0.65
                          }}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              };

              const hasNoTasks = sortedActive.length === 0 && sortedCompleted.length === 0;

              return (
                <div
                  data-todo-list-container="true"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}
                >
                  {hasNoTasks ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '44px 20px',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '16px',
                        background: 'var(--tag-bg)', color: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 12px auto'
                      }}>
                        <Icon name="sparkles" size={24} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
                        All clear right now
                      </div>
                      <div>
                        Type below (e.g. <code>Call Alex tomorrow 6pm #Personal !high</code>) or tap <b>Plan Day</b>!
                      </div>
                    </div>
                  ) : (
                    <>
                      {sortedActive.map((todo, index) => renderTodoCard(todo, false, index))}

                      {sortedCompleted.length > 0 && (
                        <>
                          <div style={{
                            marginTop: sortedActive.length > 0 ? '18px' : '4px',
                            marginBottom: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Icon name="check" size={11} />
                              </span>
                              <span style={{
                                fontSize: '11.5px',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.6px'
                              }}>
                                Completed ({sortedCompleted.length})
                              </span>
                            </div>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)', margin: '0 12px' }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Done for today
                            </span>
                          </div>

                          {sortedCompleted.map(todo => renderTodoCard(todo, true))}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ==================================================== */}
          {/* NATURAL-LANGUAGE QUICK ADD & INLINE PEN BAR          */}
          {/* ==================================================== */}
          {activeView !== 'analytics' && (
            <form
              onSubmit={handleAddTodo}
              style={{
                padding: deviceType === 'phone' ? '10px 12px' : '12px 20px',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Inline Pen / S-Pen Scribble Strip */}
              {showInlinePenStrip && (
                <div style={{
                  padding: '8px 10px',
                  borderRadius: '12px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Icon name="pen" size={12} /> Handwrite directly with S-Pen / Stylus (or type title below)
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={clearInlineCanvas}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCanvas(null, newHandwriting)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Full Canvas ↗
                      </button>
                    </div>
                  </div>
                  <canvas
                    ref={inlineCanvasRef}
                    onPointerDown={handleInlinePointerDown}
                    onPointerMove={handleInlinePointerMove}
                    onPointerUp={handleInlinePointerUp}
                    onPointerCancel={handleInlinePointerUp}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    style={{
                      width: '100%',
                      height: '76px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px dashed #cbd5e1',
                      touchAction: 'none',
                      cursor: 'crosshair'
                    }}
                  />
                </div>
              )}

              {/* Live Natural-Language Detection Preview Chips */}
              {parsedQuickAdd.hasDetections && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Smart Add:
                  </span>
                  {parsedQuickAdd.detectedList && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: 'var(--tag-bg)', color: 'var(--primary)', fontWeight: 700
                    }}>
                      {normalizeListIcon(parsedQuickAdd.detectedList.icon)} {parsedQuickAdd.detectedList.name}
                    </span>
                  )}
                  {parsedQuickAdd.detectedDateLabel && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Icon name="cal" size={11} /> {parsedQuickAdd.detectedDateLabel}
                      {parsedQuickAdd.detectedTime ? ` at ${parsedQuickAdd.detectedTime}` : ''}
                    </span>
                  )}
                  {parsedQuickAdd.detectedPriority && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: parsedQuickAdd.detectedPriority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-subtle)',
                      color: parsedQuickAdd.detectedPriority === 'high' ? '#ef4444' : 'var(--text)',
                      fontWeight: 700
                    }}>
                      ! {parsedQuickAdd.detectedPriority.toUpperCase()}
                    </span>
                  )}
                  {parsedQuickAdd.detectedRecurrence && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 700
                    }}>
                      ↻ {parsedQuickAdd.detectedRecurrence === 'custom' ? `Every ${parsedQuickAdd.detectedInterval}d` : parsedQuickAdd.detectedRecurrence}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  ref={quickAddInputRef}
                  type="text"
                  placeholder={
                    activeView === 'today'
                      ? (deviceType === 'phone' ? 'Add task...' : 'Add task (e.g. "Buy milk tomorrow 6pm #Shopping !high")...')
                      : activeView === 'list' && selectedListId
                      ? `Add task to ${syncState.lists.find(l => l.id === selectedListId)?.name || 'list'}...`
                      : (deviceType === 'phone' ? 'Add a task...' : 'Add a task (supports #List, tomorrow, 6pm, !high, daily)...')
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onFocus={(e) => {
                    if (isIgnoreClicksRef.current) {
                      e.target.blur();
                      return;
                    }
                    setIsInputFocused(true);
                    if (window.scrollY !== 0) window.scrollTo(0, 0);
                    if (document.body) document.body.scrollTop = 0;
                    if (mainRef.current) mainRef.current.scrollTop = 0;
                  }}
                  onBlur={() => {
                    setIsInputFocused(false);
                    if (window.scrollY !== 0) window.scrollTo(0, 0);
                    if (document.body) document.body.scrollTop = 0;
                  }}
                  dir="auto"
                  autoCapitalize="sentences"
                  autoComplete="off"
                  style={{
                    flex: 1,
                    padding: deviceType === 'phone' ? '12px 14px' : '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text)',
                    fontSize: deviceType === 'phone' ? '16px' : '14px',
                    outline: 'none',
                    textAlign: 'start'
                  }}
                />

                {/* Due Date Button (Laptop / Tablet) */}
                {deviceType !== 'phone' && (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCalendar(true)}
                      title={newDueDate ? `Due: ${newDueDate} (click to change)` : 'Set task due date'}
                      style={{
                        padding: '8px 11px',
                        borderRadius: '10px',
                        border: newDueDate ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: newDueDate ? 'var(--tag-bg)' : 'var(--surface-elevated)',
                        color: newDueDate ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon name="cal" size={14} />
                      <span>
                        {newDueDate ? formatDueDateBadge(newDueDate, todayStr, calendarType, showWeekdayInTasks) : 'Due Date'}
                      </span>
                    </button>
                    {newDueDate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewDueDate('');
                        }}
                        title="Clear due date"
                        style={{
                          position: 'absolute',
                          right: '-5px',
                          top: '-4px',
                          width: '17px',
                          height: '17px',
                          borderRadius: '50%',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: 0,
                          zIndex: 2
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {/* Priority Selector (Laptop / Tablet) */}
                {deviceType !== 'phone' && (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      title="Set task priority"
                      style={{
                        padding: '8px 10px 8px 27px',
                        borderRadius: '10px',
                        border: newPriority === 'high'
                          ? '1.5px solid #ef4444'
                          : newPriority === 'low'
                          ? '1.5px solid #38bdf8'
                          : '1px solid var(--border)',
                        backgroundColor: newPriority === 'high'
                          ? 'rgba(239, 68, 68, 0.12)'
                          : 'var(--surface-elevated)',
                        color: newPriority === 'high'
                          ? '#ef4444'
                          : newPriority === 'low'
                          ? '#38bdf8'
                          : 'var(--text)',
                        fontSize: '12px',
                        fontWeight: 700,
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <option value="low" style={{ background: 'var(--surface)', color: 'var(--text)' }}>Low</option>
                      <option value="medium" style={{ background: 'var(--surface)', color: 'var(--text)' }}>Medium</option>
                      <option value="high" style={{ background: 'var(--surface)', color: '#ef4444' }}>High</option>
                    </select>
                    <span style={{
                      position: 'absolute',
                      left: '8px',
                      pointerEvents: 'none',
                      color: newPriority === 'high' ? '#ef4444' : newPriority === 'low' ? '#38bdf8' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <Icon name="flag" size={12} />
                    </span>
                  </div>
                )}

                {/* Inline Pen Strip Toggle */}
                <button
                  type="button"
                  onClick={() => setShowInlinePenStrip(!showInlinePenStrip)}
                  title="Write task with S-Pen / Stylus"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: (showInlinePenStrip || newHandwriting) ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: (showInlinePenStrip || newHandwriting) ? 'var(--tag-bg)' : 'var(--surface-elevated)',
                    color: (showInlinePenStrip || newHandwriting) ? 'var(--primary)' : 'var(--text)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Icon name="pen" size={14} />
                  {deviceType !== 'phone' && <span>{newHandwriting ? 'Sketch Ready' : 'Pen'}</span>}
                </button>

                <button
                  type="submit"
                  disabled={!newTitle.trim() && !newHandwriting}
                  style={{
                    padding: deviceType === 'phone' ? '10px 15px' : '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: (newTitle.trim() || newHandwriting) ? 'pointer' : 'default',
                    opacity: (newTitle.trim() || newHandwriting) ? 1 : 0.5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Add
                </button>
              </div>
            </form>
          )}
        </main>

        {/* Right Side Task Detail Inspector (Laptop & Tablet) */}
        {deviceType !== 'phone' && selectedTodo && (
          <TaskDetailPanel
            calendarType={calendarType}
            todo={selectedTodo}
            lists={syncState.lists}
            deviceType={deviceType}
            todayStr={todayStr}
            syncEngine={syncEngine}
            onOpenCanvas={handleOpenCanvas}
            onDeleteTodo={handleDeleteTodoWithUndo}
            onClose={() => setSelectedTodoId(null)}
          />
        )}
      </div>

      {/* Phone Bottom Sheet Task Detail Inspector */}
      {deviceType === 'phone' && selectedTodo && (
        <TaskDetailPanel
          calendarType={calendarType}
          todo={selectedTodo}
          lists={syncState.lists}
          deviceType={deviceType}
          todayStr={todayStr}
          syncEngine={syncEngine}
          onOpenCanvas={handleOpenCanvas}
          onDeleteTodo={handleDeleteTodoWithUndo}
          onClose={() => setSelectedTodoId(null)}
        />
      )}

      {/* ==================================================== */}
      {/* FLOATING ACTION & UNDO TOAST SNACKBAR                */}
      {/* ==================================================== */}
      {undoToast && (() => {
        const isCompleted = undoToast.action === 'completed';
        const isDeleted = undoToast.action === 'deleted';
        const primaryLabel = undoToast.actionLabel || (isCompleted ? 'Task completed' : isDeleted ? 'Task deleted' : undoToast.message || 'Action performed');
        const secondaryTitle = undoToast.title || '';

        // Position toast comfortably above bottom inputs / bottom nav
        const bottomPos = deviceType === 'phone'
          ? (activeView === 'analytics' ? '76px' : '136px')
          : (activeView === 'analytics' ? '24px' : '76px');

        return (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              left: '50%',
              bottom: bottomPos,
              transform: 'translateX(-50%)',
              zIndex: 350,
              backgroundColor: 'var(--surface-elevated, #1e293b)',
              color: 'var(--text, #f8fafc)',
              border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.16))',
              borderRadius: '16px',
              padding: '10px 14px 12px 14px',
              boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.5), 0 4px 14px rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: 'min(460px, calc(100vw - 32px))',
              minWidth: '280px',
              animation: 'toastSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              userSelect: 'none',
              overflow: 'hidden'
            }}
          >
            {/* Visual Icon Badge */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: isCompleted
                  ? 'rgba(16, 185, 129, 0.16)'
                  : isDeleted
                  ? 'rgba(239, 68, 68, 0.16)'
                  : 'var(--tag-bg, rgba(99, 102, 241, 0.16))',
                color: isCompleted
                  ? '#10b981'
                  : isDeleted
                  ? '#ef4444'
                  : 'var(--primary, #6366f1)'
              }}
            >
              <Icon name={isCompleted ? 'check' : isDeleted ? 'trash' : 'sparkles'} size={16} />
            </div>

            {/* Structured Text Content */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text, #f8fafc)',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {primaryLabel}
              </div>
              {secondaryTitle && (
                <div
                  dir="auto"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: 'var(--text-muted, #94a3b8)',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: deviceType === 'phone' ? '170px' : '240px',
                    unicodeBidi: 'plaintext',
                    textAlign: 'start'
                  }}
                  title={secondaryTitle}
                >
                  {secondaryTitle}
                </div>
              )}
            </div>

            {/* Actions: Undo Button + Dismiss */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {undoToast.onUndo && (
                <button
                  type="button"
                  onClick={handleUndoClick}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)';
                    e.currentTarget.style.borderColor = '#38bdf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                  }}
                  title="Undo action"
                >
                  <Icon name="undo" size={13} />
                  <span>Undo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                  setUndoToast(null);
                }}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  opacity: 0.7,
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                title="Dismiss"
              >
                <Icon name="x" size={13} />
              </button>
            </div>

            {/* Subtle Countdown Progress Bar */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: isCompleted ? '#10b981' : isDeleted ? '#ef4444' : '#38bdf8',
                animation: 'toastCountdown 5s linear forwards'
              }} />
            </div>
          </div>
        );
      })()}

      {/* ==================================================== */}
      {/* MOBILE BOTTOM NAVIGATION                             */}
      {/* ==================================================== */}
      {deviceType === 'phone' && (
        <>
          {showListPickerSheet && (
            <div
              onClick={() => {
                triggerClickLockout();
                setShowListPickerSheet(false);
                handleExitListSelect();
              }}
              style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 40, display: 'flex', alignItems: 'flex-end'
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                onScroll={() => {
                  isTouchScrollingRef.current = true;
                  handleItemTouchCancel();
                }}
                style={{
                  width: '100%', backgroundColor: 'var(--surface)',
                  borderRadius: '20px 20px 0 0',
                  padding: '16px 16px 32px 16px',
                  borderTop: '1px solid var(--border)',
                  maxHeight: '80vh',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  {listSelectMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={handleSelectAllLists}
                          style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text)',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '6px 10px',
                            cursor: 'pointer'
                          }}
                        >
                          {selectedListIds.size === syncState.lists.filter(l => l.id !== 'inbox').length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                          {selectedListIds.size} selected
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleRequestDeleteLists(syncState.lists.filter(l => selectedListIds.has(l.id)))}
                          disabled={selectedListIds.size === 0}
                          style={{
                            background: selectedListIds.size > 0 ? '#ef4444' : 'var(--bg-subtle)',
                            border: 'none',
                            borderRadius: '8px',
                            color: selectedListIds.size > 0 ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '6px 14px',
                            cursor: selectedListIds.size > 0 ? 'pointer' : 'default'
                          }}
                        >
                          Delete ({selectedListIds.size})
                        </button>
                        <button
                          onClick={handleExitListSelect}
                          style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text)',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '6px 12px',
                            cursor: 'pointer'
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>My Lists</h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Hold any list to select & delete
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {syncState.lists.some(l => l.id !== 'inbox') && (
                          <button
                            onClick={() => setListSelectMode(true)}
                            style={{
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              color: 'var(--text)',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '5px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            Select
                          </button>
                        )}
                        <button
                          onClick={() => { setShowListPickerSheet(false); setShowListsModal(true); }}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          + New List
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div data-lists-container="sheet" style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                  {syncState.lists.map((list, listIdx) => {
                    const count = syncState.todos.filter(t => !t.completed && !t.deletedAt && t.listId === list.id).length;
                    const isActive = activeView === 'list' && selectedListId === list.id;
                    const isSelected = selectedListIds.has(list.id);
                    const isSystem = list.id === 'inbox';
                    const listOffset = getListDragOffset(listIdx, 'sheet');
                    const isBeingDragged = Boolean(listDrag && listDrag.source === 'sheet' && listDrag.id === list.id);

                    return (
                      <div
                        key={list.id}
                        data-list-item={list.id}
                        onTouchStart={(e) => {
                          if (e.touches && e.touches[0]) {
                            touchStartCoordRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                            isTouchScrollingRef.current = false;
                          }
                          handleItemTouchStart(list.id, isSystem);
                        }}
                        onTouchMove={(e) => {
                          if (e.touches && e.touches[0] && touchStartCoordRef.current) {
                            const dx = Math.abs(e.touches[0].clientX - touchStartCoordRef.current.x);
                            const dy = Math.abs(e.touches[0].clientY - touchStartCoordRef.current.y);
                            if (dx > 7 || dy > 7) {
                              isTouchScrollingRef.current = true;
                              handleItemTouchCancel();
                            }
                          }
                        }}
                        onTouchEnd={() => {
                          if (didDragRef.current) return;
                          handleItemTouchEnd(list.id, isSystem, () => {
                            triggerClickLockout();
                            setActiveView('list');
                            setSelectedListId(list.id);
                            setShowListPickerSheet(false);
                          });
                        }}
                        onMouseDown={(e) => {
                          handleItemTouchStart(list.id, isSystem);
                          if (!listSelectMode && e.button === 0 && !e.target.closest('button')) {
                            const itemEl = e.currentTarget;
                            pendingPointerDragRef.current = {
                              kind: 'list',
                              list,
                              index: listIdx,
                              startX: e.clientX,
                              startY: e.clientY,
                              el: itemEl,
                              gap: 6,
                              source: 'sheet'
                            };
                          }
                        }}
                        onMouseUp={() => {
                          if (didDragRef.current) return;
                          handleItemTouchEnd(list.id, isSystem, () => {
                            triggerClickLockout();
                            setActiveView('list');
                            setSelectedListId(list.id);
                            setShowListPickerSheet(false);
                          });
                        }}
                        onMouseLeave={handleItemTouchCancel}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!isSystem) handleStartListSelect(list.id);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', borderRadius: '12px',
                          border: isSelected ? '1px solid #ef4444' : isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(239, 68, 68, 0.08)' : isActive ? 'var(--tag-bg)' : 'var(--bg-subtle)',
                          color: isSelected ? '#ef4444' : isActive ? 'var(--primary)' : 'var(--text)',
                          fontSize: '15px', fontWeight: isActive || isSelected ? 700 : 500,
                          cursor: 'pointer', textAlign: 'left',
                          userSelect: 'none', WebkitUserSelect: 'none',
                          transform: listOffset ? `translateY(${listOffset}px)` : 'none',
                          transition: listDrag ? 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)' : 'none',
                          opacity: isBeingDragged ? 0 : 1,
                          visibility: isBeingDragged ? 'hidden' : 'visible',
                          pointerEvents: isBeingDragged ? 'none' : 'auto'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {listSelectMode ? (
                            <div style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              border: isSelected ? '2px solid #ef4444' : '2px solid var(--border)',
                              backgroundColor: isSelected ? '#ef4444' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#ffffff', fontSize: '13px', fontWeight: 800,
                              flexShrink: 0
                            }}>
                              {isSelected ? '✓' : ''}
                            </div>
                          ) : (
                            <div
                              title="Drag to reorder list"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                opacity: 0.45,
                                cursor: 'grab',
                                touchAction: 'none',
                                padding: '4px 3px',
                                flexShrink: 0
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleItemTouchCancel();
                                if (e.button !== 0) return;
                                const itemEl = e.currentTarget.closest('[data-list-item]');
                                if (itemEl) startListDrag(list, listIdx, e.clientY, itemEl, 6, 'sheet');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                handleItemTouchCancel();
                                if (!e.touches || !e.touches[0]) return;
                                const itemEl = e.currentTarget.closest('[data-list-item]');
                                if (itemEl) startListDrag(list, listIdx, e.touches[0].clientY, itemEl, 6, 'sheet');
                              }}
                            >
                              <Icon name="grip" size={14} />
                            </div>
                          )}
                          <span style={{ fontSize: '20px' }}>{normalizeListIcon(list.icon)}</span>
                          <span dir="auto" style={{ unicodeBidi: 'plaintext' }}>{list.name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                          {!isSystem && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingList(list);
                              }}
                              title="Edit List"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Icon name="pen" size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!isInputFocused && (
          <nav style={{
            height: isLandscapePhone ? '46px' : '60px',
            backgroundColor: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            flexShrink: 0,
            zIndex: 30
          }}>
            <button
              onClick={() => { setActiveView('today'); setShowListPickerSheet(false); }}
              style={{
                flex: 1, height: '100%', background: 'none', border: 'none',
                color: activeView === 'today' ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', fontSize: '10px',
                fontWeight: activeView === 'today' ? 700 : 500, cursor: 'pointer'
              }}
            >
              <Icon name="sun" size={19} />
              <span>My Day</span>
            </button>

            <button
              onClick={() => { setShowListPickerSheet(!showListPickerSheet); }}
              style={{
                flex: 1, height: '100%', background: 'none', border: 'none',
                color: (activeView === 'list' || showListPickerSheet) ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', fontSize: '10px',
                fontWeight: (activeView === 'list' || showListPickerSheet) ? 700 : 500, cursor: 'pointer'
              }}
            >
              <Icon name="inbox" size={19} />
              <span>Lists</span>
            </button>

            <button
              onClick={() => { setActiveView('all'); setSelectedListId(null); setShowListPickerSheet(false); }}
              style={{
                flex: 1, height: '100%', background: 'none', border: 'none',
                color: activeView === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', fontSize: '10px',
                fontWeight: activeView === 'all' ? 700 : 500, cursor: 'pointer'
              }}
            >
              <Icon name="list" size={19} />
              <span>All</span>
            </button>

            <button
              onClick={() => { setShowPlannerModal(true); setShowListPickerSheet(false); }}
              style={{
                flex: 1, height: '100%', background: 'none', border: 'none',
                color: 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', fontSize: '10px',
                fontWeight: 500, cursor: 'pointer'
              }}
            >
              <Icon name="cal" size={19} />
              <span>Plan Day</span>
            </button>

            <button
              onClick={() => { setActiveView('analytics'); setShowListPickerSheet(false); }}
              style={{
                flex: 1, height: '100%', background: 'none', border: 'none',
                color: activeView === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', fontSize: '10px',
                fontWeight: activeView === 'analytics' ? 700 : 500, cursor: 'pointer'
              }}
            >
              <Icon name="chart" size={19} />
              <span>Plots</span>
            </button>
          </nav>
          )}
        </>
      )}

      {/* ==================================================== */}
      {/* MODALS & DRAWERS                                     */}
      {/* ==================================================== */}
      {showCanvasModal && (
        <HandwritingCanvas
          initialImage={canvasInitialImage}
          onSave={handleSaveCanvas}
          onCancel={() => setShowCanvasModal(false)}
        />
      )}

      {showThemeModal && (
        <ThemeSettingsModal
          themeConfig={themeConfig}
          onUpdateThemeConfig={updateThemeConfig}
          currentAppliedTheme={document.body.getAttribute('data-theme')}
          onApplyTheme={applyThemeDirectly}
          onClose={() => setShowThemeModal(false)}
        />
      )}

      {showPlannerModal && (
        <DailyPlannerModal
          deviceType={deviceType}
          calendarType={calendarType}
          dayStartHour={dayStartHour}
          todos={syncState.todos}
          lists={syncState.lists}
          onToggleInMyDay={(todoId, inMyDay) => {
            syncEngine.updateTodo(todoId, {
              inMyDay,
              plannedDate: inMyDay ? todayStr : null
            });
          }}
          onCarryForward={() => handleCarryForward(null)}
          onClose={() => setShowPlannerModal(false)}
        />
      )}

      {showListsModal && (
        <CustomListsModal
          lists={syncState.lists}
          onAddList={(name, icon, color) => syncEngine.addList(name, icon, color)}
          onUpdateList={(id, patch) => syncEngine.updateList(id, patch)}
          onDeleteList={(id) => syncEngine.deleteList(id)}
          onClose={() => setShowListsModal(false)}
        />
      )}

      {/* Friendly Devices & Pairing Modal */}
      {showDevicesModal && (
        <DevicesPairingModal
          syncEngine={syncEngine}
          p2pInfo={syncState.p2pInfo}
          deviceType={deviceType}
          onClose={() => setShowDevicesModal(false)}
        />
      )}

      {/* Settings & Preferences Modal (Calendars, Themes, Backups) */}
      {showSettingsModal && (
        <SettingsModal
          calendarType={calendarType}
          onSelectCalendarType={handleSelectCalendarType}
          showWeekdayInTasks={showWeekdayInTasks}
          onToggleShowWeekdayInTasks={handleToggleShowWeekdayInTasks}
          dayStartHour={dayStartHour}
          onSelectDayStartHour={handleSelectDayStartHour}
          onOpenThemeModal={() => setShowThemeModal(true)}
          onOpenDeviceModal={() => setShowDevicesModal(true)}
          syncEngine={syncEngine}
          syncState={syncState}
          deviceType={deviceType}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Quick Add Multi-Calendar Picker Modal (Laptop / Tablet) */}
      {showQuickAddCalendar && (
        <CalendarPickerModal
          isOpen={showQuickAddCalendar}
          value={newDueDate || todayStr}
          calendarType={calendarType}
          deviceType={deviceType}
          onSelect={(iso) => {
            setNewDueDate(iso || '');
            setShowQuickAddCalendar(false);
          }}
          onClose={() => setShowQuickAddCalendar(false)}
        />
      )}

      {/* List Deletion Confirmation Modal */}
      {listsToDelete && listsToDelete.length > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: 'var(--card-shadow)',
            color: 'var(--text)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{
                width: '38px', height: '38px', borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon name="trash" size={18} />
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {listsToDelete.length === 1 ? 'Delete List' : `Delete ${listsToDelete.length} Lists`}
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Are you sure you want to delete {listsToDelete.length === 1 ? (
                <strong style={{ color: 'var(--text)' }}>"{listsToDelete[0].name}"</strong>
              ) : (
                <strong style={{ color: 'var(--text)' }}>{listsToDelete.length} selected lists</strong>
              )}?
            </p>

            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              marginBottom: '20px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.45
            }}>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>Safe Deletion + Undo: </span>
              Tasks in {listsToDelete.length === 1 ? 'this list' : 'these lists'} will move to <b>Inbox</b>, and you can Undo immediately after.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setListsToDelete(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteLists}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {listsToDelete.length === 1 ? 'Delete List' : `Delete ${listsToDelete.length} Lists`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Card for Task Reordering (Exact visual replica of the lifted card) */}
      {taskDrag && (() => {
        const todo = taskDrag.todo;
        const listObj = syncState.lists.find(l => l.id === todo.listId);
        const steps = Array.isArray(todo.steps) ? todo.steps : [];
        const doneSteps = steps.filter(s => s.completed).length;
        const isInlineNote = todo.isInlineHandwriting === true || (todo.isInlineHandwriting !== false && todo.handwriting && (!todo.title || todo.title === 'Handwritten task' || todo.title === 'Handwritten sketch' || todo.title.trim() === ''));

        return (
          <div
            style={{
              position: 'fixed',
              top: `${taskDrag.currentY - taskDrag.offsetY}px`,
              left: `${taskDrag.rect.left}px`,
              width: `${taskDrag.rect.width}px`,
              minHeight: `${taskDrag.rect.height}px`,
              pointerEvents: 'none',
              zIndex: 999999,
              transform: 'scale(1.02)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 2px var(--primary)',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-elevated)',
              willChange: 'top, transform'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: deviceType === 'phone' ? '12px' : '12px 14px',
              borderRadius: '12px',
              gap: deviceType === 'phone' ? '10px' : '12px'
            }}>
              <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', marginTop: '2px', padding: '4px 3px' }}>
                <Icon name="grip" size={14} />
              </div>
              <div style={{
                width: '22px', height: '22px', minWidth: '22px',
                borderRadius: '50%',
                border: todo.priority === 'high' ? '2px solid #ef4444' : '2px solid var(--text-muted)',
                marginTop: '2px'
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: deviceType === 'phone' ? '14.5px' : '15px',
                  fontWeight: 600, lineHeight: 1.4, color: 'var(--text)',
                  wordBreak: 'break-word'
                }}>
                  {isInlineNote ? (
                    <HandwrittenTitle src={todo.handwriting} isCompleted={false} isDarkTheme={isDarkTheme} />
                  ) : (
                    <BidiTaskTitle title={todo.title} />
                  )}
                </div>

                {todo.notes && (
                  <div
                    dir={hasPersianChar(todo.notes) ? 'rtl' : 'ltr'}
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginTop: '3px',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      unicodeBidi: 'plaintext',
                      textAlign: detectBidiDirection(todo.title) === 'rtl' ? 'right' : 'left'
                    }}
                  >
                    {todo.notes}
                  </div>
                )}

                {todo.handwriting && !isInlineNote && (
                  <div style={{
                    marginTop: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                      Attachment
                    </span>
                  </div>
                )}

                {/* Badges in Floating Card */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '6px',
                  justifyContent: detectBidiDirection(todo.title) === 'rtl' ? 'flex-end' : 'flex-start'
                }}>
                  {listObj && (activeView !== 'list' || selectedListId !== listObj.id) && (
                    <span style={{
                      fontSize: '10.5px',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>{normalizeListIcon(listObj.icon)}</span> {listObj.name}
                    </span>
                  )}

                  {steps.length > 0 && (
                    <span style={{
                      fontSize: '10.5px',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      backgroundColor: doneSteps === steps.length ? 'rgba(16, 185, 129, 0.14)' : 'var(--tag-bg)',
                      color: doneSteps === steps.length ? '#10b981' : 'var(--primary)',
                      fontWeight: 700
                    }}>
                      ✓ {doneSteps}/{steps.length}
                    </span>
                  )}

                  {todo.priority === 'high' && (
                    <span style={{
                      fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.14)', color: '#ef4444', fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: '3px'
                    }}>
                      <Icon name="flag" size={10} /> High
                    </span>
                  )}

                  {todo.dueDate && (
                    <span
                      dir={calendarType === 'gregorian' ? 'ltr' : 'rtl'}
                      style={{
                        fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                        background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        unicodeBidi: 'isolate'
                      }}
                    >
                      <Icon name="cal" size={11} />
                      <span style={{ unicodeBidi: 'isolate' }}>
                        {formatDueDateBadge(todo.dueDate, todayStr, calendarType, showWeekdayInTasks)}
                      </span>
                      {todo.reminderTime ? ` · ${todo.reminderTime}` : ''}
                    </span>
                  )}

                  {todo.recurrence && todo.recurrence !== 'none' && (
                    <span style={{
                      fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.14)', color: 'var(--primary)', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: '3px'
                    }}>
                      <Icon name="repeat" size={10} />
                      {todo.recurrence === 'custom' ? `Every ${todo.recurrenceInterval}d` : todo.recurrence}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Action Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.65 }}>
                {activeView !== 'today' && todo.inMyDay && (
                  <div style={{ color: '#fbbf24', padding: '5px', display: 'flex' }}>
                    <Icon name="sun" size={15} />
                  </div>
                )}
                <div style={{ color: 'var(--text-muted)', padding: '5px', display: 'flex' }}>
                  <Icon name="trash" size={15} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Row for List Reordering (Sidebar & Mobile Bottom Sheet) */}
      {listDrag && (
        <div
          style={{
            position: 'fixed',
            top: `${listDrag.currentY - listDrag.offsetY}px`,
            left: `${listDrag.rect.left}px`,
            width: `${listDrag.rect.width}px`,
            height: `${listDrag.rect.height}px`,
            pointerEvents: 'none',
            zIndex: 999999,
            transform: 'scale(1.03)',
            boxShadow: '0 18px 36px rgba(0, 0, 0, 0.45), 0 0 0 1.5px var(--primary)',
            borderRadius: listDrag.source === 'sheet' ? '12px' : '8px',
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: listDrag.source === 'sheet' ? '12px 14px' : '7px 10px',
            fontSize: listDrag.source === 'sheet' ? '15px' : '13px',
            fontWeight: 700,
            willChange: 'top, transform'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: listDrag.source === 'sheet' ? '10px' : '8px' }}>
            <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <Icon name="grip" size={listDrag.source === 'sheet' ? 14 : 12} />
            </div>
            <span style={{ fontSize: listDrag.source === 'sheet' ? '20px' : '15px' }}>{normalizeListIcon(listDrag.list.icon)}</span>
            <span dir="auto" style={{ unicodeBidi: 'plaintext' }}>{listDrag.list.name}</span>
          </div>
          <span style={{ fontSize: listDrag.source === 'sheet' ? '13px' : '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {syncState.todos.filter(t => !t.completed && !t.deletedAt && t.listId === listDrag.list.id).length}
          </span>
        </div>
      )}

      {/* Invisible Click-Blocker Layer during sheet closure lockout */}
      {isIgnoringClicks && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'transparent',
            pointerEvents: 'auto'
          }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
        />
      )}
    </div>
  );
}
