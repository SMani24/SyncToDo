import React, { useRef, useState, useEffect } from 'react';

// Crops blank whitespace from drawn canvas so export is crisp and tightly fitted
export function cropInkBounds(canvas, pad = 12) {
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
        if (alpha > 14) {
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

export default function HandwritingCanvas({ initialImage = null, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen'); // 'pen' | 'highlighter' | 'eraser'
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [historyState, setHistoryState] = useState({ stack: [], step: -1 });
  const historyRef = useRef({ stack: [], step: -1 });
  const loadSeqRef = useRef(0);
  const lastPointRef = useRef(null);
  const highlightPointsRef = useRef(null);
  const highlightBaseRef = useRef(null);
  const hardwareBarrelDownRef = useRef(false);
  const dprRef = useRef(2.5);
  const [usePenOnly, setUsePenOnly] = useState(false); // Palm rejection mode
  const [isBarrelEraser, setIsBarrelEraser] = useState(false); // S-Pen side button eraser mode

  const history = historyState.stack;
  const historyStep = historyState.step;

  const colors = [
    { label: 'Indigo', hex: '#6366f1' },
    { label: 'Emerald', hex: '#10b981' },
    { label: 'Amber', hex: '#f59e0b' },
    { label: 'Rose', hex: '#f43f5e' },
    { label: 'Cyan', hex: '#06b6d4' },
    { label: 'Ink', hex: '#1e293b' },
    { label: 'White', hex: '#ffffff' }
  ];

  const resetHistoryWithCurrentCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    const next = { stack: [dataUrl], step: 0 };
    historyRef.current = next;
    setHistoryState(next);
  };

  // Initialize canvas with high-resolution Retina / High-DPI scaling
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set internal resolution matching display aspect with High-DPI multiplier
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(2.5, window.devicePixelRatio || 2);
    dprRef.current = dpr;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Canvas is transparent — the white background div shows through.
    // This lets the eraser (destination-out) reveal white cleanly.

    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        ctx.globalCompositeOperation = 'source-over';
        const pad = 16;
        const maxW = Math.max(1, rect.width - pad * 2);
        const maxH = Math.max(1, rect.height - pad * 2);
        // Preserve aspect ratio instead of stretching cropped ink across the whole canvas
        const naturalCssW = (img.naturalWidth || rect.width) / dpr;
        const naturalCssH = (img.naturalHeight || rect.height) / dpr;
        const scale = Math.min(1, maxW / Math.max(1, naturalCssW), maxH / Math.max(1, naturalCssH));
        const drawW = naturalCssW * scale;
        const drawH = naturalCssH * scale;
        const drawX = (rect.width - drawW) / 2;
        const drawY = (rect.height - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        resetHistoryWithCurrentCanvas();
      };
      img.src = initialImage;
    } else {
      resetHistoryWithCurrentCanvas();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    const cur = historyRef.current;
    const nextStack = [...cur.stack.slice(0, cur.step + 1), dataUrl];
    const next = { stack: nextStack, step: nextStack.length - 1 };
    historyRef.current = next;
    setHistoryState(next);
  };

  const renderHistoryIndex = (targetStep) => {
    const cur = historyRef.current;
    if (targetStep < 0 || targetStep >= cur.stack.length) return;
    const next = { stack: cur.stack, step: targetStep };
    historyRef.current = next;
    setHistoryState(next);

    const dataUrl = cur.stack[targetStep];
    const seq = ++loadSeqRef.current;
    const img = new Image();
    img.onload = () => {
      if (loadSeqRef.current !== seq) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  };

  const undo = () => {
    const cur = historyRef.current;
    if (cur.step <= 0) return;
    renderHistoryIndex(cur.step - 1);
  };

  const redo = () => {
    const cur = historyRef.current;
    if (cur.step >= cur.stack.length - 1) return;
    renderHistoryIndex(cur.step + 1);
  };

  const previousToolRef = useRef(tool);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  useEffect(() => {
    // Intercept S-Pen / stylus hardware barrel button events dispatched from Android bridge
    const handleStylusEvent = (e) => {
      const action = e.detail?.action;
      if (action === 'down' || action === 'eraser_active') {
        hardwareBarrelDownRef.current = true;
        if (toolRef.current !== 'eraser') {
          previousToolRef.current = toolRef.current;
        }
        setTool('eraser');
        setIsBarrelEraser(true);
      } else if (action === 'up') {
        hardwareBarrelDownRef.current = false;
        setIsBarrelEraser(false);
        setTool(previousToolRef.current || 'pen');
      }
    };
    // Suppress context menu triggers from Samsung S-Pen secondary button
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('stylusbutton', handleStylusEvent);
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => {
      window.removeEventListener('stylusbutton', handleStylusEvent);
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, rect.width, rect.height);
    saveHistoryState();
  };

  const isStylusButtonEraser = (e) => {
    if (!e) return false;
    const isPen = e.pointerType === 'pen' || e.pointerType === 'stylus' || (e.pointerType === 'touch' && ((e.buttons & 2) !== 0 || e.button === 2));
    const hasBarrelButtons = ((e.buttons & 2) !== 0) || ((e.buttons & 32) !== 0) || ((e.buttons & 4) !== 0);
    const hasBarrelButtonIndex = e.button === 2 || e.button === 5;
    const hasStylusModifier = (e.altKey || (e.ctrlKey && isPen));
    return Boolean(isPen && (hasBarrelButtons || hasBarrelButtonIndex || hasStylusModifier));
  };

  // Pointer event handlers with Stylus pressure & hardware button eraser support
  const handlePointerDown = (e) => {
    // If palm rejection is enabled, reject touches that are not pen
    if (usePenOnly && e.pointerType !== 'pen') return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const barrel = hardwareBarrelDownRef.current || isStylusButtonEraser(e);
    setIsBarrelEraser(barrel);
    if (barrel) {
      if (tool !== 'eraser') previousToolRef.current = tool;
      setTool('eraser');
    }

    const effectiveHighlighter = !barrel && tool === 'highlighter';
    lastPointRef.current = { x, y };

    if (effectiveHighlighter) {
      // Snapshot current ink once so continuous highlighter stroke never compounds/darkens over itself
      highlightBaseRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      highlightPointsRef.current = [{ x, y }];
      applyContextStyle(ctx, 0.5, false);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
    } else {
      highlightBaseRef.current = null;
      highlightPointsRef.current = null;
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      applyContextStyle(ctx, pressure, barrel);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
    }

    setIsDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    if (usePenOnly && e.pointerType !== 'pen') return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const barrel = hardwareBarrelDownRef.current || isStylusButtonEraser(e);
    if (barrel !== isBarrelEraser) {
      setIsBarrelEraser(barrel);
      if (barrel) {
        if (tool !== 'eraser') previousToolRef.current = tool;
        setTool('eraser');
        highlightBaseRef.current = null;
        highlightPointsRef.current = null;
      } else {
        setTool(previousToolRef.current || 'pen');
      }
      lastPointRef.current = { x, y };
    }

    const effectiveHighlighter = !barrel && tool === 'highlighter' && highlightBaseRef.current && highlightPointsRef.current;
    if (effectiveHighlighter) {
      highlightPointsRef.current.push({ x, y });
      ctx.putImageData(highlightBaseRef.current, 0, 0);
      applyContextStyle(ctx, 0.5, false);
      ctx.beginPath();
      const pts = highlightPointsRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    } else {
      const prev = lastPointRef.current || { x, y };
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      applyContextStyle(ctx, pressure, barrel);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastPointRef.current = { x, y };
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    try {
      if (e?.pointerId !== undefined) {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      }
    } catch (_) {}
    if (isBarrelEraser && !hardwareBarrelDownRef.current) {
      setIsBarrelEraser(false);
      setTool(previousToolRef.current || 'pen');
    }
    lastPointRef.current = null;
    highlightBaseRef.current = null;
    highlightPointsRef.current = null;
    // Reset composite mode so history snapshots always capture correctly
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'source-over';
    }
    setIsDrawing(false);
    saveHistoryState();
  };

  const applyContextStyle = (ctx, pressure = 0.5, forceEraser = false) => {
    const effectiveEraser = forceEraser || tool === 'eraser';
    if (effectiveEraser) {
      // destination-out punches transparent holes through the ink layer.
      // The white background canvas underneath remains untouched and shows through.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = Math.max(22, strokeWidth * 7.5);
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = strokeColor + '66'; // 40% translucent
      ctx.lineWidth = strokeWidth * 5;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      // Stylus pressure variation (0.6x to 1.6x)
      ctx.lineWidth = strokeWidth * (0.6 + pressure * 1.0);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cropped = cropInkBounds(canvas, 10);
    onSave(cropped || null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '680px',
        backgroundColor: 'var(--surface)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✍️</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Handwritten Task & Stylus Sketch
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Pressure-sensitive stylus & touch drawing
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          gap: '10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-subtle)'
        }}>
          {/* Tool selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setTool('pen')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: tool === 'pen' ? 'var(--primary)' : 'transparent',
                color: tool === 'pen' ? '#ffffff' : 'var(--text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ✏️ Pen
            </button>
            <button
              onClick={() => setTool('highlighter')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: tool === 'highlighter' ? 'var(--primary)' : 'transparent',
                color: tool === 'highlighter' ? '#ffffff' : 'var(--text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🖍️ Highlighter
            </button>
            <button
              onClick={() => setTool('eraser')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: (tool === 'eraser' || isBarrelEraser) ? 'var(--primary)' : 'transparent',
                color: (tool === 'eraser' || isBarrelEraser) ? '#ffffff' : 'var(--text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isBarrelEraser ? '0 0 8px var(--primary)' : 'none'
              }}
            >
              🧹 {isBarrelEraser ? 'Eraser (S-Pen)' : 'Eraser'}
            </button>
          </div>

          {/* Color palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {colors.map(c => (
              <button
                key={c.hex}
                onClick={() => { setStrokeColor(c.hex); if (tool === 'eraser') setTool('pen'); }}
                title={c.label}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  border: strokeColor === c.hex ? '2px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transform: strokeColor === c.hex ? 'scale(1.2)' : 'scale(1)'
                }}
              />
            ))}
          </div>

          {/* Actions: Undo / Redo / Palm Rejection / Clear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={undo}
              disabled={historyStep <= 0}
              title="Undo"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                opacity: historyStep <= 0 ? 0.4 : 1,
                cursor: historyStep <= 0 ? 'default' : 'pointer'
              }}
            >
              ↩
            </button>
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              title="Redo"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                opacity: historyStep >= history.length - 1 ? 0.4 : 1,
                cursor: historyStep >= history.length - 1 ? 'default' : 'pointer'
              }}
            >
              ↪
            </button>
            <button
              onClick={() => setUsePenOnly(!usePenOnly)}
              title="Stylus-only mode (Palm Rejection)"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: usePenOnly ? 'var(--primary)' : 'transparent',
                color: usePenOnly ? '#ffffff' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {usePenOnly ? '🖊️ Stylus Only (Active)' : '🖐️ Palm Rejection'}
            </button>
            <button
              onClick={clearCanvas}
              title="Clear Canvas"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: '#f43f5e',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Drawing Canvas Area — two-layer: white bg div + transparent ink canvas */}
        <div style={{
          position: 'relative',
          flex: 1,
          minHeight: '360px',
          maxHeight: '520px',
          backgroundColor: '#ffffff',   /* permanent white background */
          overflow: 'hidden',
          touchAction: 'none'
        }}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: (tool === 'eraser' || isBarrelEraser) ? 'cell' : 'crosshair',
              touchAction: 'none',
              /* canvas itself is transparent so eraser reveals white bg div */
              background: 'transparent'
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            💡 Tip: Use your stylus naturally. Pressure affects stroke weight.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary-gradient)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Attach to Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
