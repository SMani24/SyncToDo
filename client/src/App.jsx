import React, { useState, useEffect, useRef } from 'react';
import { syncEngine, detectDeviceType, normalizeListIcon } from './syncEngine';
import HandwritingCanvas from './components/HandwritingCanvas';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ThemeSettingsModal, { ALL_THEMES } from './components/ThemeSettingsModal';
import DailyPlannerModal from './components/DailyPlannerModal';
import CustomListsModal from './components/CustomListsModal';
import DevicesPairingModal from './components/DevicesPairingModal';
import TaskDetailPanel from './components/TaskDetailPanel';
import { Icon, parseNaturalTaskInput } from './components/SvgIcons';

export default function App() {
  const [syncState, setSyncState] = useState({
    status: 'SYNCING',
    todos: [],
    lists: [],
    onlineDevices: [],
    pendingCount: 0,
    p2pInfo: { activeP2PCount: 0, peers: [], pairedDevices: [], nearbyPeers: [], pendingRequests: [] }
  });

  // Navigation & View state
  const [activeView, setActiveView] = useState('today');
  const [selectedListId, setSelectedListId] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRecurring, setFilterRecurring] = useState(false);
  const [filterHandwriting, setFilterHandwriting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTodoId, setSelectedTodoId] = useState(null);
  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const [dragOverTodoId, setDragOverTodoId] = useState(null);

  // Task creation state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('none');
  const [newRecurrenceInterval, setNewRecurrenceInterval] = useState(1);
  const [newHandwriting, setNewHandwriting] = useState(null);
  const [showInlinePenStrip, setShowInlinePenStrip] = useState(false);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  const triggerUndoToast = (message, onUndoFn) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, onUndo: onUndoFn });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 5500);
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
    triggerUndoToast(`Deleted “${todoObj.title.slice(0, 28)}”`, () => {
      syncEngine.restoreTodoSnapshot(snapshot);
    });
  };

  const handleToggleTodoWithUndo = (todoObj) => {
    if (!todoObj) return;
    const snapshot = JSON.parse(JSON.stringify(todoObj));
    const wasCompleted = Boolean(todoObj.completed);
    syncEngine.toggleTodo(todoObj.id);
    if (!wasCompleted) {
      triggerUndoToast(`Completed “${todoObj.title.slice(0, 28)}”`, () => {
        syncEngine.restoreTodoSnapshot(snapshot);
      });
    }
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
    const label = listsToDelete.length === 1 ? `Deleted list “${listsToDelete[0].name}”` : `Deleted ${listsToDelete.length} lists`;

    listsToDelete.forEach(l => {
      syncEngine.deleteList(l.id);
    });

    if (deletedIds.has(selectedListId)) {
      setSelectedListId('inbox');
      setActiveView('list');
    }

    setListsToDelete(null);
    handleExitListSelect();

    triggerUndoToast(label, () => {
      syncEngine.restoreListsSnapshot(listsSnapshot, todosSnapshot);
    });
  };

  const handleItemTouchStart = (listId, isSystem) => {
    if (isSystem || listSelectMode) return;
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

  const todayStr = new Date().toISOString().split('T')[0];

  // Check for overdue/yesterday's unfinished tasks
  const overdueTasks = syncState.todos.filter(t => {
    if (t.completed || t.deletedAt) return false;
    const isPastDue = t.dueDate && t.dueDate < todayStr;
    const isPastMyDay = t.inMyDay && t.plannedDate && t.plannedDate < todayStr;
    return isPastDue || isPastMyDay;
  });

  // Filter Todos based on active view and filters
  const filteredTodos = syncState.todos.filter(todo => {
    if (todo.deletedAt) return false;

    if (activeView === 'today') {
      const isDueToday = todo.dueDate === todayStr;
      const isMyDay = todo.inMyDay;
      if (!isDueToday && !isMyDay) return false;
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
      const hasOrderA = typeof a.order === 'number';
      const hasOrderB = typeof b.order === 'number';
      if (hasOrderA && hasOrderB) {
        if (a.order !== b.order) return a.order - b.order;
      } else if (hasOrderA) {
        return -1;
      } else if (hasOrderB) {
        return 1;
      }
      const pw = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pw !== 0) return pw;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const sortedCompleted = filteredTodos
    .filter(t => t.completed)
    .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0));

  const moveTask = (todoId, direction) => {
    const currentIndex = sortedActive.findIndex(t => t.id === todoId);
    if (currentIndex === -1) return;

    const newItems = [...sortedActive];
    if (direction === 'up' && currentIndex > 0) {
      const [moved] = newItems.splice(currentIndex, 1);
      newItems.splice(currentIndex - 1, 0, moved);
    } else if (direction === 'down' && currentIndex < newItems.length - 1) {
      const [moved] = newItems.splice(currentIndex, 1);
      newItems.splice(currentIndex + 1, 0, moved);
    } else {
      return;
    }

    syncEngine.reorderTodos(newItems.map(t => t.id));
  };

  const handleDrop = (targetTodoId) => {
    if (!draggedTodoId || draggedTodoId === targetTodoId) {
      setDraggedTodoId(null);
      setDragOverTodoId(null);
      return;
    }
    const fromIndex = sortedActive.findIndex(t => t.id === draggedTodoId);
    const toIndex = sortedActive.findIndex(t => t.id === targetTodoId);
    if (fromIndex === -1 || toIndex === -1) return;

    const newItems = [...sortedActive];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);

    syncEngine.reorderTodos(newItems.map(t => t.id));
    setDraggedTodoId(null);
    setDragOverTodoId(null);
  };

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

  // Inline Quick-Add Handwriting Strip handlers
  const getInlineCoords = (e) => {
    const canvas = inlineCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
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
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = e.pressure ? Math.max(2, e.pressure * 5) : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleInlinePointerMove = (e) => {
    if (!inlineDrawingRef.current) return;
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getInlineCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleInlinePointerUp = () => {
    if (!inlineDrawingRef.current) return;
    inlineDrawingRef.current = false;
    const canvas = inlineCanvasRef.current;
    if (canvas) {
      setNewHandwriting(canvas.toDataURL('image/png'));
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
  };

  // Add Task (incorporating natural language detections!)
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTitle.trim() && !newHandwriting) return;

    const inListView = (activeView === 'list' || activeView === 'projects') && selectedListId;
    const defaultList = inListView ? selectedListId : 'inbox';
    const targetList = parsedQuickAdd.detectedList ? parsedQuickAdd.detectedList.id : defaultList;
    const isMyDay = activeView === 'today' || parsedQuickAdd.detectedDate === todayStr;

    const finalTitle = parsedQuickAdd.cleanTitle || (newHandwriting ? 'Handwritten task' : newTitle.trim());
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
        handwriting: newHandwriting
      }
    );

    setNewTitle('');
    setNewDueDate('');
    setNewRecurrence('none');
    setNewRecurrenceInterval(1);
    setNewHandwriting(null);
    if (inlineHasInk) clearInlineCanvas();
    setShowInlinePenStrip(false);
  };

  // Carry forward yesterday's unfinished tasks (all or selective)
  const handleCarryForward = (subsetIds = null) => {
    const count = syncEngine.carryForwardUnfinished(subsetIds);
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
      syncEngine.updateTodo(canvasTargetTodoId, { handwriting: dataUrl });
    } else {
      setNewHandwriting(dataUrl);
    }
    setShowCanvasModal(false);
  };

  // Progress Ring calculation for My Day
  const myDayTodos = syncState.todos.filter(t => !t.deletedAt && (t.dueDate === todayStr || t.inMyDay));
  const myDayDoneCount = myDayTodos.filter(t => t.completed).length;
  const myDayTotalCount = myDayTodos.length;
  const myDayPct = myDayTotalCount > 0 ? Math.round((myDayDoneCount / myDayTotalCount) * 100) : 0;

  // Unified Sync Pill status
  const activePeerCount = syncState.p2pInfo?.activeP2PCount || 0;
  const pendingPairCount = syncState.p2pInfo?.pendingRequests?.length || 0;
  const isWsConnected = syncState.status === 'CONNECTED';
  const isSyncedLive = activePeerCount > 0 || isWsConnected;

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
      overflow: 'hidden'
    }}>
      {/* ==================================================== */}
      {/* APP HEADER                                          */}
      {/* ==================================================== */}
      <header style={{
        height: deviceType === 'phone' ? '54px' : '58px',
        padding: deviceType === 'phone' ? '0 12px' : '0 20px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
          }}>
            <Icon name="check" size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: deviceType === 'phone' ? '15px' : '17px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: 'var(--text)' }}>
                SyncToDo
              </h1>
              <span style={{
                fontSize: '9.5px',
                padding: '2px 7px',
                borderRadius: '999px',
                backgroundColor: 'var(--tag-bg)',
                color: 'var(--tag-text)',
                fontWeight: 700
              }}>
                {syncState.p2pInfo?.deviceName || syncEngine.deviceName || deviceType}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search (Laptop/Tablet) */}
        {deviceType !== 'phone' && (
          <div style={{
            position: 'relative',
            width: deviceType === 'laptop' ? '310px' : '220px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tasks, notes ( / )..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 28px 7px 32px',
                borderRadius: '9px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text)',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', display: 'flex' }}>
              <Icon name="search" size={14} />
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        )}

        {/* Right: Unified Sync Status Pill & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Unified Sync Pill */}
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: deviceType === 'phone' ? '5px 10px' : '6px 12px',
              borderRadius: '999px',
              border: pendingPairCount > 0
                ? '1.5px solid #10b981'
                : '1px solid var(--border)',
              backgroundColor: pendingPairCount > 0
                ? 'rgba(16, 185, 129, 0.15)'
                : 'var(--surface-elevated)',
              color: 'var(--text)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer'
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
              boxShadow: activePeerCount > 0 ? '0 0 8px rgba(16,185,129,0.6)' : 'none'
            }} />
            <span>
              {pendingPairCount > 0
                ? `Pair Request (${pendingPairCount})`
                : activePeerCount > 0
                ? `Synced · ${activePeerCount} device${activePeerCount > 1 ? 's' : ''}`
                : 'Pair Devices'}
            </span>
          </button>

          {/* Theme Modal Trigger */}
          <button
            onClick={() => setShowThemeModal(true)}
            style={{
              padding: deviceType === 'phone' ? '6px 8px' : '6px 10px',
              borderRadius: '9px',
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

          {/* Daily Planner Trigger */}
          <button
            onClick={() => setShowPlannerModal(true)}
            style={{
              padding: deviceType === 'phone' ? '6px 9px' : '6px 12px',
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
            {deviceType !== 'phone' && <span>Plan Day</span>}
          </button>
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
                  { id: 'today', icon: 'sun', label: 'My Day', count: syncState.todos.filter(t => !t.completed && !t.deletedAt && (t.dueDate === todayStr || t.inMyDay)).length },
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {syncState.lists.map(list => {
                  const count = syncState.todos.filter(t => !t.completed && !t.deletedAt && t.listId === list.id).length;
                  const isActive = activeView === 'list' && selectedListId === list.id;
                  const isSelected = selectedListIds.has(list.id);
                  const isSystem = list.id === 'inbox';

                  return (
                    <div
                      key={list.id}
                      onTouchStart={() => handleItemTouchStart(list.id, isSystem)}
                      onTouchEnd={() => handleItemTouchEnd(list.id, isSystem, () => {
                        setActiveView('list');
                        setSelectedListId(list.id);
                      })}
                      onTouchMove={handleItemTouchCancel}
                      onMouseDown={() => handleItemTouchStart(list.id, isSystem)}
                      onMouseUp={() => handleItemTouchEnd(list.id, isSystem, () => {
                        setActiveView('list');
                        setSelectedListId(list.id);
                      })}
                      onMouseLeave={handleItemTouchCancel}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isSystem) handleStartListSelect(list.id);
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
                        transition: 'all 0.15s ease'
                      }}
                      title={isSystem ? 'Default list' : 'Hold to select & delete, or click to open'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
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
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg)',
          overflow: 'hidden',
          minWidth: 0
        }}>
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
                  <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }} title={`${myDayPct}% completed today`}>
                    <svg width="38" height="38" viewBox="0 0 38 38" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="19" cy="19" r="15" fill="none" stroke="var(--border)" strokeWidth="3.5" />
                      <circle
                        cx="19"
                        cy="19"
                        r="15"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 15}`}
                        strokeDashoffset={`${2 * Math.PI * 15 * (1 - myDayPct / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
                      />
                    </svg>
                    <span style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: 'var(--text)'
                    }}>
                      {myDayDoneCount}/{myDayTotalCount}
                    </span>
                  </div>
                )}

                <div>
                  <h2 style={{ fontSize: deviceType === 'phone' ? '16px' : '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeView === 'today' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="sun" size={18} style={{ color: '#fbbf24' }} /> My Day
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
                        {selectedListId && selectedListId !== 'inbox' && (
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
                            <Icon name="trash" size={12} /> Delete
                          </button>
                        )}
                      </span>
                    )}
                  </h2>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {sortedActive.length} active{sortedCompleted.length > 0 ? ` · ${sortedCompleted.length} completed` : ''}
                  </span>
                </div>
              </div>

              {/* Filter Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
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
                        <span style={{ flex: 1, fontWeight: 600 }}>{t.title}</span>
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
          <div style={{ flex: 1, overflowY: 'auto', padding: deviceType === 'phone' ? '12px' : '16px 20px' }}>
            {activeView === 'analytics' ? (
              <AnalyticsDashboard
                todos={syncState.todos}
                lists={syncState.lists}
                onClose={() => setActiveView('today')}
              />
            ) : (() => {
              const renderTodoCard = (todo, isCompleted = false) => {
                const listObj = syncState.lists.find(l => l.id === todo.listId);
                const isSelected = selectedTodoId === todo.id;
                const isSwipedOpen = swipedTodoId === todo.id;
                const steps = Array.isArray(todo.steps) ? todo.steps : [];
                const doneSteps = steps.filter(s => s.completed).length;

                return (
                  <div
                    key={todo.id}
                    style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}
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
                            background: '#f59e0b',
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
                        if (isSwipedOpen) {
                          setSwipedTodoId(null);
                          return;
                        }
                        setSelectedTodoId(isSelected ? null : todo.id);
                      }}
                      onTouchStart={(e) => {
                        if (!e.touches || e.touches.length === 0) return;
                        touchSwipeRef.current = {
                          id: todo.id,
                          startX: e.touches[0].clientX,
                          startY: e.touches[0].clientY,
                          deltaX: 0
                        };
                      }}
                      onTouchMove={(e) => {
                        if (!e.touches || e.touches.length === 0) return;
                        if (touchSwipeRef.current.id !== todo.id) return;
                        const dx = e.touches[0].clientX - touchSwipeRef.current.startX;
                        const dy = e.touches[0].clientY - touchSwipeRef.current.startY;
                        if (Math.abs(dx) > Math.abs(dy)) {
                          touchSwipeRef.current.deltaX = dx;
                        }
                      }}
                      onTouchEnd={() => {
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
                      draggable={!isCompleted}
                      onDragStart={(e) => {
                        if (isCompleted) return;
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', todo.id);
                        setDraggedTodoId(todo.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!isCompleted && draggedTodoId && draggedTodoId !== todo.id) {
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverTodoId !== todo.id) setDragOverTodoId(todo.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverTodoId === todo.id) setDragOverTodoId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!isCompleted) handleDrop(todo.id);
                      }}
                      onDragEnd={() => {
                        setDraggedTodoId(null);
                        setDragOverTodoId(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: deviceType === 'phone' ? '12px' : '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? 'var(--surface-elevated)' : isCompleted ? 'var(--bg-subtle)' : 'var(--surface)',
                        border: (!isCompleted && dragOverTodoId === todo.id)
                          ? '2px solid var(--primary)'
                          : isSelected
                          ? '1.5px solid var(--primary)'
                          : isCompleted
                          ? '1px dashed var(--border)'
                          : '1px solid var(--border)',
                        boxShadow: (!isCompleted && dragOverTodoId === todo.id)
                          ? '0 0 16px rgba(99, 102, 241, 0.4)'
                          : isCompleted
                          ? 'none'
                          : 'var(--card-shadow)',
                        opacity: (!isCompleted && draggedTodoId === todo.id) ? 0.4 : isCompleted ? 0.72 : 1,
                        cursor: 'pointer',
                        gap: deviceType === 'phone' ? '10px' : '12px',
                        transform: isSwipedOpen ? 'translateX(-158px)' : 'translateX(0)',
                        transition: 'all 0.18s ease',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      {/* Drag Grip */}
                      {!isCompleted && (
                        <div
                          style={{
                            cursor: 'grab',
                            userSelect: 'none',
                            color: 'var(--text-muted)',
                            opacity: 0.45,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '4px',
                            touchAction: 'none'
                          }}
                          title="Drag to reorder (or Alt+↑/↓)"
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
                          {todo.title}
                        </div>

                        {todo.notes && (
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '3px',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {todo.notes}
                          </div>
                        )}

                        {todo.handwriting && (
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
                              border: '1px solid var(--border)'
                            }}
                          >
                            <img
                              src={todo.handwriting}
                              alt="Handwriting preview"
                              style={{
                                width: '44px',
                                height: '24px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                background: '#fff'
                              }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                              Sketch
                            </span>
                          </div>
                        )}

                        {/* Clean Metadata Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
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
                            <span style={{
                              fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px',
                              background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}>
                              <Icon name="cal" size={11} />
                              {todo.dueDate === todayStr ? 'Today' : todo.dueDate}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      {sortedActive.map(todo => renderTodoCard(todo, false))}

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
                    width={640}
                    height={92}
                    onPointerDown={handleInlinePointerDown}
                    onPointerMove={handleInlinePointerMove}
                    onPointerUp={handleInlinePointerUp}
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
                      ? 'Add task (e.g. "Buy milk tomorrow 6pm #Shopping !high")...'
                      : activeView === 'list' && selectedListId
                      ? `Add task to ${syncState.lists.find(l => l.id === selectedListId)?.name || 'list'}...`
                      : 'Add a task (supports #List, tomorrow, 6pm, !high, daily)...'
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    flex: 1,
                    padding: deviceType === 'phone' ? '10px 12px' : '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />

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
      {/* FLOATING 5-SECOND UNDO TOAST                         */}
      {/* ==================================================== */}
      {undoToast && (
        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: deviceType === 'phone' ? '74px' : '24px',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: '999px',
          padding: '9px 16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          zIndex: 260,
          fontSize: '13px',
          fontWeight: 600
        }}>
          <span>{undoToast.message}</span>
          <button
            onClick={handleUndoClick}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: 0
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* MOBILE BOTTOM NAVIGATION                             */}
      {/* ==================================================== */}
      {deviceType === 'phone' && (
        <>
          {showListPickerSheet && (
            <div
              onClick={() => {
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {syncState.lists.map(list => {
                    const count = syncState.todos.filter(t => !t.completed && !t.deletedAt && t.listId === list.id).length;
                    const isActive = activeView === 'list' && selectedListId === list.id;
                    const isSelected = selectedListIds.has(list.id);
                    const isSystem = list.id === 'inbox';

                    return (
                      <div
                        key={list.id}
                        onTouchStart={() => handleItemTouchStart(list.id, isSystem)}
                        onTouchEnd={() => handleItemTouchEnd(list.id, isSystem, () => {
                          setActiveView('list');
                          setSelectedListId(list.id);
                          setShowListPickerSheet(false);
                        })}
                        onTouchMove={handleItemTouchCancel}
                        onMouseDown={() => handleItemTouchStart(list.id, isSystem)}
                        onMouseUp={() => handleItemTouchEnd(list.id, isSystem, () => {
                          setActiveView('list');
                          setSelectedListId(list.id);
                          setShowListPickerSheet(false);
                        })}
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
                          userSelect: 'none', WebkitUserSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {listSelectMode && (
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
                          )}
                          <span style={{ fontSize: '20px' }}>{normalizeListIcon(list.icon)}</span>
                          <span>{list.name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <nav style={{
            height: '60px',
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
      {showSettingsModal && (
        <DevicesPairingModal
          syncEngine={syncEngine}
          p2pInfo={syncState.p2pInfo}
          deviceType={deviceType}
          onClose={() => setShowSettingsModal(false)}
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
    </div>
  );
}
