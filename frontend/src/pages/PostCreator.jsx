import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTitle } from '../context/TitleContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import html2canvas from 'html2canvas';
import { POST_TEMPLATES, TEMPLATE_CATEGORIES } from '../config/postTemplates.js';
import './PostCreator.css';

// Preset Background Colors & Gradients
const PRESET_SOLID_COLORS = [
  '#ffffff', '#f8fafc', '#0f172a', '#1e293b',
  '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#451a03', '#064e3b', '#581c87'
];

const PRESET_GRADIENTS = [
  { name: 'Sunset Warm', type: 'linear', angle: 135, color1: '#7f1d1d', color2: '#18181b' },
  { name: 'Diwali Gold', type: 'radial', angle: 0, color1: '#451a03', color2: '#0f0702' },
  { name: 'Royal Purple', type: 'linear', angle: 135, color1: '#581c87', color2: '#831843' },
  { name: 'Emerald Forest', type: 'linear', angle: 135, color1: '#064e3b', color2: '#022c22' },
  { name: 'Executive Blue', type: 'linear', angle: 135, color1: '#0f172a', color2: '#1e3a8a' },
  { name: 'Clean White Soft', type: 'linear', angle: 180, color1: '#ffedd5', color2: '#ffffff' }
];

const SHAPE_ITEMS = [
  { id: 'rect', name: 'Rectangle', shapeType: 'rect' },
  { id: 'rounded', name: 'Rounded Card', shapeType: 'rounded' },
  { id: 'circle', name: 'Circle', shapeType: 'circle' },
  { id: 'pill', name: 'Pill Badge', shapeType: 'pill' },
  { id: 'line', name: 'Line Divider', shapeType: 'line' },
  { id: 'star', name: 'Star Icon', shapeType: 'star' },
  { id: 'triangle', name: 'Triangle', shapeType: 'triangle' },
  { id: 'badge', name: 'Ribbon / Badge', shapeType: 'badge' }
];

const FONT_FAMILIES = [
  { name: 'System Sans', value: 'inherit' },
  { name: 'Inter / Modern', value: 'Inter, sans-serif' },
  { name: 'Impact / Bold', value: 'Impact, sans-serif' },
  { name: 'Georgia / Serif', value: 'Georgia, serif' },
  { name: 'Monospace', value: 'monospace' }
];

export default function PostCreator() {
  const { setTitle } = useTitle();
  const { user } = useAuth();

  useEffect(() => {
    setTitle('Post Creator');
  }, [setTitle]);

  // ── Mode State: 'gallery' or 'editor' ───────────────────────────
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'editor'
  const [activeCategory, setActiveCategory] = useState('all');

  // ── Editor Canvas State ─────────────────────────────────────────
  const [currentTemplate, setCurrentTemplate] = useState(() => POST_TEMPLATES[0]);
  const [canvasElements, setCanvasElements] = useState(() => POST_TEMPLATES[0].elements);
  const [canvasBackground, setCanvasBackground] = useState(() => POST_TEMPLATES[0].background);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [activePropTab, setActivePropTab] = useState('content'); // content | style | shapes | background | layers
  const [zoomScale, setZoomScale] = useState(1);

  // Interaction State for Dragging / Resizing / Rotating
  const [interactionState, setInteractionState] = useState(null);
  const [snappingGuides, setSnappingGuides] = useState({ x: null, y: null });

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Preview & Export Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [exportingState, setExportingState] = useState({ isExporting: false, status: '' });

  const canvasRef = useRef(null);

  const selectedElement = canvasElements.find(el => el.id === selectedElementId) || null;

  // ── HISTORY STACK (UNDO / REDO) ─────────────────────────────────
  const pushHistory = useCallback((newElements, newBg) => {
    const snapshot = {
      elements: JSON.parse(JSON.stringify(newElements)),
      background: JSON.parse(JSON.stringify(newBg || canvasBackground))
    };
    setHistoryStack(prev => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, snapshot].slice(-25); // max 25 steps
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex, canvasBackground]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetState = historyStack[historyIndex - 1];
      setCanvasElements(JSON.parse(JSON.stringify(targetState.elements)));
      setCanvasBackground(JSON.parse(JSON.stringify(targetState.background)));
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const targetState = historyStack[historyIndex + 1];
      setCanvasElements(JSON.parse(JSON.stringify(targetState.elements)));
      setCanvasBackground(JSON.parse(JSON.stringify(targetState.background)));
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, historyStack]);

  // ── KEYBOARD SHORTCUTS ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== 'editor') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!selectedElementId || !selectedElement) return;

      // Duplicate element: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateElement();
        return;
      }

      // Delete: Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteElement();
        return;
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedElementId(null);
        return;
      }

      // Arrow keys movement
      const step = e.shiftKey ? 10 : 2;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        handleUpdateElement(selectedElementId, {
          x: Math.round(selectedElement.x + dx),
          y: Math.round(selectedElement.y + dy)
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, selectedElementId, selectedElement, handleUndo, handleRedo]);

  // ── TEMPLATE SELECTION ──────────────────────────────────────────
  const handleSelectTemplate = (template) => {
    const cloned = JSON.parse(JSON.stringify(template));
    setCurrentTemplate(cloned);
    setCanvasElements(cloned.elements);
    setCanvasBackground(cloned.background);
    setSelectedElementId(null);
    setViewMode('editor');
    setActivePropTab('content');

    // Initialize history
    setHistoryStack([{
      elements: JSON.parse(JSON.stringify(cloned.elements)),
      background: JSON.parse(JSON.stringify(cloned.background))
    }]);
    setHistoryIndex(0);
  };

  // ── ELEMENT ACTIONS ─────────────────────────────────────────────
  const handleUpdateElement = (elementId, updates) => {
    setCanvasElements(prev => {
      const updated = prev.map(el => el.id === elementId ? { ...el, ...updates } : el);
      return updated;
    });
  };

  const handleDuplicateElement = () => {
    if (!selectedElement) return;
    const cloned = {
      ...JSON.parse(JSON.stringify(selectedElement)),
      id: 'el-clone-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      x: Math.min(currentTemplate.width - 100, selectedElement.x + 30),
      y: Math.min(currentTemplate.height - 100, selectedElement.y + 30),
      zIndex: canvasElements.length + 1
    };
    const updated = [...canvasElements, cloned];
    setCanvasElements(updated);
    setSelectedElementId(cloned.id);
    pushHistory(updated, canvasBackground);
  };

  const handleDeleteElement = () => {
    if (!selectedElementId) return;
    const updated = canvasElements.filter(el => el.id !== selectedElementId);
    setCanvasElements(updated);
    setSelectedElementId(null);
    pushHistory(updated, canvasBackground);
  };

  const handleAddShape = (shapeType) => {
    const isLine = shapeType === 'line';
    const isPill = shapeType === 'pill';
    const newShape = {
      id: 'shape-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'shape',
      shapeType: shapeType || 'rect',
      x: Math.round(currentTemplate.width / 2 - (isLine ? 250 : 100)),
      y: Math.round(currentTemplate.height / 2 - (isLine ? 4 : 100)),
      width: isLine ? 500 : (isPill ? 300 : 200),
      height: isLine ? 6 : (isPill ? 70 : 200),
      rotation: 0,
      zIndex: canvasElements.length + 1,
      opacity: 1,
      fillColor: currentTemplate.themeColor || '#4f46e5',
      borderColor: '#ffffff',
      borderWidth: 0,
      cornerRadius: shapeType === 'rounded' ? 20 : 0,
      isEditable: true
    };

    const updated = [...canvasElements, newShape];
    setCanvasElements(updated);
    setSelectedElementId(newShape.id);
    setActivePropTab('style');
    pushHistory(updated, canvasBackground);
  };

  const handleAddCustomText = () => {
    const newText = {
      id: 'text-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'text',
      text: 'Add Custom Heading / Callout',
      x: Math.round(currentTemplate.width / 2 - 250),
      y: Math.round(currentTemplate.height / 2 - 40),
      width: 500,
      height: 70,
      fontSize: 36,
      fontWeight: 800,
      textColor: '#ffffff',
      textAlign: 'center',
      rotation: 0,
      zIndex: canvasElements.length + 2,
      opacity: 1,
      isEditable: true
    };

    const updated = [...canvasElements, newText];
    setCanvasElements(updated);
    setSelectedElementId(newText.id);
    setActivePropTab('style');
    pushHistory(updated, canvasBackground);
  };

  // ── LAYER MANAGEMENT ────────────────────────────────────────────
  const handleLayerOrder = (action) => {
    if (!selectedElement) return;
    const sorted = [...canvasElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const currentIndex = sorted.findIndex(el => el.id === selectedElement.id);
    if (currentIndex === -1) return;

    if (action === 'front') {
      sorted.splice(currentIndex, 1);
      sorted.push(selectedElement);
    } else if (action === 'back') {
      sorted.splice(currentIndex, 1);
      sorted.unshift(selectedElement);
    } else if (action === 'forward') {
      if (currentIndex < sorted.length - 1) {
        const next = sorted[currentIndex + 1];
        sorted[currentIndex + 1] = selectedElement;
        sorted[currentIndex] = next;
      }
    } else if (action === 'backward') {
      if (currentIndex > 0) {
        const prev = sorted[currentIndex - 1];
        sorted[currentIndex - 1] = selectedElement;
        sorted[currentIndex] = prev;
      }
    }

    const reindexed = sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
    setCanvasElements(reindexed);
    pushHistory(reindexed, canvasBackground);
  };

  // ── MOUSE INTERACTION (DRAG & RESIZE) ───────────────────────────
  const handleElementMouseDown = (e, el) => {
    e.stopPropagation();
    setSelectedElementId(el.id);

    // Calculate canvas scale
    const displayScale = (canvasRef.current ? canvasRef.current.clientWidth / currentTemplate.width : 0.5) * zoomScale;

    setInteractionState({
      mode: 'drag',
      elementId: el.id,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation || 0 },
      displayScale
    });
  };

  const handleResizeHandleMouseDown = (e, handle, el) => {
    e.stopPropagation();
    const displayScale = (canvasRef.current ? canvasRef.current.clientWidth / currentTemplate.width : 0.5) * zoomScale;

    setInteractionState({
      mode: 'resize',
      handle,
      elementId: el.id,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation || 0 },
      displayScale
    });
  };

  const handleRotationHandleMouseDown = (e, el) => {
    e.stopPropagation();
    const elBox = e.target.parentElement.getBoundingClientRect();
    const centerX = elBox.left + elBox.width / 2;
    const centerY = elBox.top + elBox.height / 2;

    setInteractionState({
      mode: 'rotate',
      elementId: el.id,
      centerX,
      centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI),
      startRotation: el.rotation || 0
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!interactionState) return;

    const { mode, elementId, startX, startY, startBounds, handle, displayScale } = interactionState;
    const currentScale = displayScale || 0.5;
    const dx = (e.clientX - startX) / currentScale;
    const dy = (e.clientY - startY) / currentScale;

    if (mode === 'drag') {
      let newX = Math.round(startBounds.x + dx);
      let newY = Math.round(startBounds.y + dy);

      // Snap to center X
      const canvasCenterX = currentTemplate.width / 2;
      const elCenterX = newX + startBounds.width / 2;
      let snapX = null;
      if (Math.abs(elCenterX - canvasCenterX) <= 8) {
        newX = Math.round(canvasCenterX - startBounds.width / 2);
        snapX = canvasCenterX;
      }

      setSnappingGuides({ x: snapX, y: null });
      handleUpdateElement(elementId, { x: newX, y: newY });
    } else if (mode === 'resize') {
      let { x, y, width, height } = startBounds;

      if (handle.includes('e')) width = Math.max(40, Math.round(startBounds.width + dx));
      if (handle.includes('s')) height = Math.max(20, Math.round(startBounds.height + dy));
      if (handle.includes('w')) {
        const potentialW = Math.max(40, Math.round(startBounds.width - dx));
        x = startBounds.x + (startBounds.width - potentialW);
        width = potentialW;
      }
      if (handle.includes('n')) {
        const potentialH = Math.max(20, Math.round(startBounds.height - dy));
        y = startBounds.y + (startBounds.height - potentialH);
        height = potentialH;
      }

      handleUpdateElement(elementId, { x, y, width, height });
    } else if (mode === 'rotate') {
      const { centerX, centerY, startAngle, startRotation } = interactionState;
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const angleDiff = currentAngle - startAngle;
      let newRotation = Math.round((startRotation + angleDiff) % 360);
      if (newRotation < 0) newRotation += 360;

      // Snap to 0, 90, 180, 270 degrees
      if (Math.abs(newRotation - 0) < 4 || Math.abs(newRotation - 360) < 4) newRotation = 0;
      if (Math.abs(newRotation - 90) < 4) newRotation = 90;
      if (Math.abs(newRotation - 180) < 4) newRotation = 180;
      if (Math.abs(newRotation - 270) < 4) newRotation = 270;

      handleUpdateElement(elementId, { rotation: newRotation });
    }
  };

  const handleCanvasMouseUp = () => {
    if (interactionState) {
      setInteractionState(null);
      setSnappingGuides({ x: null, y: null });
      pushHistory(canvasElements, canvasBackground);
    }
  };

  // Image Upload Helper
  const handleImageUpload = (e, callback) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      alert('Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      callback(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // ── DIRECT EXPORT TO PNG / JPG ──────────────────────────────────
  const handleExportImage = async (format = 'png') => {
    if (!canvasRef.current) return;

    setExportingState({ isExporting: true, status: `Generating high-resolution ${format.toUpperCase()} image...` });

    try {
      // Temporarily deselect element for clean capture
      const previousSelected = selectedElementId;
      setSelectedElementId(null);

      await new Promise(r => setTimeout(r, 250));

      const canvasEl = canvasRef.current;
      const targetWidth = currentTemplate.width || 1080;
      const targetHeight = currentTemplate.height || 1080;

      const renderedCanvas = await html2canvas(canvasEl, {
        scale: 2, // 2x scaling for crisp quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        onclone: (clonedDoc, clonedEl) => {
          clonedEl.style.transform = 'none';
          clonedEl.style.width = `${targetWidth}px`;
          clonedEl.style.height = `${targetHeight}px`;
        }
      });

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const dataUrl = renderedCanvas.toDataURL(mimeType, 0.95);

      // Download file
      const link = document.createElement('a');
      const cleanName = currentTemplate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `post-${cleanName}-${Date.now()}.${format}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSelectedElementId(previousSelected);
      setExportingState({ isExporting: false, status: '' });
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to export post image. Please try again.');
      setExportingState({ isExporting: false, status: '' });
    }
  };

  // ── SHAPE SVG RENDERER ──────────────────────────────────────────
  const renderShapeElement = (el) => {
    const fill = el.fillColor || currentTemplate.themeColor || '#4f46e5';
    const stroke = el.borderColor || '#000000';
    const strokeWidth = el.borderWidth || 0;

    if (el.shapeType === 'rect' || el.shapeType === 'rounded') {
      return (
        <rect
          width="100%"
          height="100%"
          rx={el.shapeType === 'rounded' ? (el.cornerRadius || 20) : 0}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (el.shapeType === 'circle') {
      return (
        <ellipse
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (el.shapeType === 'pill') {
      return (
        <rect
          width="100%"
          height="100%"
          rx="999"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (el.shapeType === 'line') {
      return (
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke={fill}
          strokeWidth={Math.max(2, el.height || 6)}
        />
      );
    }
    if (el.shapeType === 'star') {
      return (
        <polygon
          points="50%,0% 61%,35% 98%,35% 68%,57% 79%,91% 50%,70% 21%,91% 32%,57% 2%,35% 39%,35%"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (el.shapeType === 'triangle') {
      return (
        <polygon
          points="50%,0% 0%,100% 100%,100%"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (el.shapeType === 'badge') {
      return (
        <polygon
          points="0%,0% 100%,0% 100%,75% 50%,100% 0%,75%"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }

    return <rect width="100%" height="100%" fill={fill} />;
  };

  // ── RENDER LIVE CANVAS SHEET ────────────────────────────────────
  const renderLiveCanvas = (isForPreview = false) => {
    const bg = canvasBackground || { type: 'solid', color: '#0f172a' };
    let bgStyle = {};

    if (bg.type === 'solid') {
      bgStyle.backgroundColor = bg.color || '#0f172a';
    } else if (bg.type === 'gradient') {
      const g = bg.gradient || { type: 'linear', angle: 135, color1: '#0f172a', color2: '#1e293b' };
      if (g.type === 'radial') {
        bgStyle.background = `radial-gradient(circle, ${g.color1} 0%, ${g.color2} 100%)`;
      } else {
        bgStyle.background = `linear-gradient(${g.angle || 135}deg, ${g.color1} 0%, ${g.color2} 100%)`;
      }
    } else if (bg.type === 'image' && bg.image) {
      bgStyle.backgroundImage = `url(${bg.image})`;
      bgStyle.backgroundSize = bg.imageFit || 'cover';
      bgStyle.backgroundPosition = 'center';
      bgStyle.opacity = bg.imageOpacity ?? 1;
    }

    const tplW = currentTemplate.width || 1080;
    const tplH = currentTemplate.height || 1080;

    // Display scale to fit comfortably in viewport (around 520px)
    const baseDisplayWidth = isForPreview ? Math.min(680, window.innerWidth - 60) : 520;
    const canvasScale = (baseDisplayWidth / tplW) * (isForPreview ? 1 : zoomScale);

    return (
      <div
        ref={isForPreview ? null : canvasRef}
        className="post-canvas-sheet"
        style={{
          width: `${tplW}px`,
          height: `${tplH}px`,
          transform: `scale(${canvasScale})`,
          transformOrigin: 'top center',
          marginBottom: `${tplH * (canvasScale - 1) + 20}px`
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget || e.target.classList.contains('post-canvas-bg-layer')) {
            setSelectedElementId(null);
          }
        }}
      >
        {/* Background Layer */}
        <div className="post-canvas-bg-layer" style={bgStyle} />

        {/* Snapping guide line */}
        {!isForPreview && snappingGuides.x !== null && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${snappingGuides.x}px`, width: 1, background: '#f43f5e', zIndex: 999, pointerEvents: 'none' }} />
        )}

        {/* Canvas Elements */}
        {canvasElements.map((el) => {
          const isSelected = !isForPreview && el.id === selectedElementId;

          return (
            <div
              key={el.id}
              className={`post-element ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
                zIndex: el.zIndex || 1,
                opacity: el.opacity ?? 1
              }}
              onMouseDown={(e) => !isForPreview && handleElementMouseDown(e, el)}
            >
              {/* Type: Text */}
              {el.type === 'text' && (
                <div
                  style={{
                    fontSize: `${el.fontSize || 28}px`,
                    fontWeight: el.fontWeight || 600,
                    fontStyle: el.isItalic ? 'italic' : 'normal',
                    fontFamily: el.fontFamily || 'inherit',
                    color: el.textColor || '#ffffff',
                    textAlign: el.textAlign || 'center',
                    letterSpacing: `${el.letterSpacing || 0}px`,
                    lineHeight: el.lineHeight || 1.3,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: el.textAlign === 'left' ? 'flex-start' : (el.textAlign === 'right' ? 'flex-end' : 'center'),
                    wordBreak: 'break-word',
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}
                >
                  {el.text}
                </div>
              )}

              {/* Type: Image / Product Slot */}
              {el.type === 'image' && (
                <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {el.image ? (
                    <img src={el.image} alt="Slot" style={{ width: '100%', height: '100%', objectFit: el.imageFit || 'contain', pointerEvents: 'none' }} />
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.1)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, border: '2px dashed rgba(255,255,255,0.4)', borderRadius: 8 }}>
                      📷 Upload Image
                    </div>
                  )}
                </div>
              )}

              {/* Type: Logo Slot */}
              {el.type === 'logo' && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {el.image || user?.app_logo ? (
                    <img src={el.image || user?.app_logo} alt="Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24 }}>
                      LOGO
                    </div>
                  )}
                </div>
              )}

              {/* Type: Shape */}
              {el.type === 'shape' && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                  {renderShapeElement(el)}
                </svg>
              )}

              {/* Selection Resize Handles */}
              {isSelected && (
                <>
                  <div className="selection-handle handle-nw" onMouseDown={(e) => handleResizeHandleMouseDown(e, 'nw', el)} />
                  <div className="selection-handle handle-n"  onMouseDown={(e) => handleResizeHandleMouseDown(e, 'n', el)} />
                  <div className="selection-handle handle-ne" onMouseDown={(e) => handleResizeHandleMouseDown(e, 'ne', el)} />
                  <div className="selection-handle handle-e"  onMouseDown={(e) => handleResizeHandleMouseDown(e, 'e', el)} />
                  <div className="selection-handle handle-se" onMouseDown={(e) => handleResizeHandleMouseDown(e, 'se', el)} />
                  <div className="selection-handle handle-s"  onMouseDown={(e) => handleResizeHandleMouseDown(e, 's', el)} />
                  <div className="selection-handle handle-sw" onMouseDown={(e) => handleResizeHandleMouseDown(e, 'sw', el)} />
                  <div className="selection-handle handle-w"  onMouseDown={(e) => handleResizeHandleMouseDown(e, 'w', el)} />

                  <div className="handle-rot-line" />
                  <div className="handle-rot" title="Drag to Rotate" onMouseDown={(e) => handleRotationHandleMouseDown(e, el)} />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── VIEW 1: TEMPLATE GALLERY (HOME) ─────────────────────────────
  if (viewMode === 'gallery') {
    const filteredTemplates = activeCategory === 'all'
      ? POST_TEMPLATES
      : POST_TEMPLATES.filter(t => t.category === activeCategory);

    return (
      <div className="post-creator-container">
        {/* Top Header */}
        <div className="post-topbar">
          <div className="post-topbar-left">
            <div className="post-icon-badge">🎨</div>
            <div className="post-title-group">
              <h1 className="post-topbar-title">Post Creator Studio</h1>
              <p className="post-topbar-subtitle">
                Create ready-to-share festival greetings, offers & business promo graphics
              </p>
            </div>
          </div>

          <div className="post-topbar-actions">
            <button
              type="button"
              className="post-btn post-btn-primary"
              onClick={() => handleSelectTemplate(POST_TEMPLATES[0])}
            >
              ✨ Create from Scratch / Default
            </button>
          </div>
        </div>

        {/* Gallery View */}
        <div className="post-gallery-view">
          {/* Hero Banner */}
          <div className="post-gallery-header">
            <div>
              <h1>🚀 Professional Marketing & Festival Post Templates</h1>
              <p>
                Select any ready-made design below to customize with your business name, logo, phone, discount offers, and images. Drag elements anywhere and download high-resolution images instantly.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <span className="post-format-tag">✨ 100% Free & Client-Side</span>
              <span className="post-format-tag">⚡ Ultra-HD 1080px Export</span>
            </div>
          </div>

          {/* Category Tabs Filter */}
          <div className="post-category-tabs">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`post-category-tab ${activeCategory === cat.id ? 'post-category-tab--active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Templates Grid */}
          <div className="post-template-grid">
            {filteredTemplates.map(tpl => (
              <div key={tpl.id} className="post-template-card">
                <div
                  className="post-template-preview-box"
                  style={{
                    background: tpl.background?.type === 'gradient'
                      ? (tpl.background.gradient.type === 'radial'
                          ? `radial-gradient(circle, ${tpl.background.gradient.color1} 0%, ${tpl.background.gradient.color2} 100%)`
                          : `linear-gradient(${tpl.background.gradient.angle || 135}deg, ${tpl.background.gradient.color1} 0%, ${tpl.background.gradient.color2} 100%)`)
                      : (tpl.background?.color || '#0f172a')
                  }}
                >
                  <div className="post-template-badge-pill">
                    {tpl.badge || tpl.category.toUpperCase()}
                  </div>

                  <div className="post-template-format-pill">
                    {tpl.format === 'story' ? '1080×1920 (Story)' : '1080×1080 (Square)'}
                  </div>

                  {/* Icon & Mini Preview Title */}
                  <div style={{ textAlign: 'center', padding: 20, zIndex: 2 }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>{tpl.thumbnail}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                      {tpl.name}
                    </div>
                  </div>
                </div>

                <div className="post-template-card-body">
                  <div>
                    <h3 className="post-template-name">{tpl.name}</h3>
                    <span className="post-template-cat-label">{tpl.category}</span>
                  </div>

                  <button
                    type="button"
                    className="post-btn post-btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '9px 12px' }}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    ✏️ Customize & Edit Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW 2: 3-COLUMN VISUAL CANVAS EDITOR ───────────────────────
  return (
    <div className="post-creator-container">
      {/* Top Action Bar */}
      <div className="post-topbar">
        <div className="post-topbar-left">
          <button
            type="button"
            className="post-btn post-btn-secondary"
            onClick={() => setViewMode('gallery')}
          >
            ← Templates
          </button>

          <div className="post-icon-badge">🎨</div>
          <div className="post-title-group">
            <h1 className="post-topbar-title">
              {currentTemplate.name}
              <span className="post-format-tag">{currentTemplate.format === 'story' ? '1080×1920 Story' : '1080×1080 Square'}</span>
            </h1>
          </div>
        </div>

        {/* Center Canvas Tools (Undo, Redo, Zoom) */}
        <div className="post-topbar-center">
          <button
            type="button"
            className="cat-icon-btn"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            ↩️
          </button>
          <button
            type="button"
            className="cat-icon-btn"
            onClick={handleRedo}
            disabled={historyIndex >= historyStack.length - 1}
            title="Redo (Ctrl+Y)"
          >
            ↪️
          </button>

          <span style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 4px' }} />

          <button
            type="button"
            className="cat-icon-btn"
            onClick={() => setZoomScale(s => Math.max(0.5, Number((s - 0.1).toFixed(1))))}
            title="Zoom Out"
          >
            -
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 38, textAlign: 'center' }}>
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            className="cat-icon-btn"
            onClick={() => setZoomScale(s => Math.min(1.5, Number((s + 0.1).toFixed(1))))}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="post-btn post-btn-secondary"
            style={{ padding: '2px 6px', fontSize: 11 }}
            onClick={() => setZoomScale(1)}
          >
            100%
          </button>
        </div>

        {/* Right Topbar Actions */}
        <div className="post-topbar-actions">
          <button
            type="button"
            className="post-btn post-btn-secondary"
            onClick={() => setShowPreviewModal(true)}
          >
            👁️ Preview
          </button>

          <button
            type="button"
            className="post-btn post-btn-primary"
            onClick={() => handleExportImage('png')}
            disabled={exportingState.isExporting}
          >
            📥 Download PNG
          </button>

          <button
            type="button"
            className="post-btn post-btn-success"
            onClick={() => handleExportImage('jpg')}
            disabled={exportingState.isExporting}
          >
            📥 Download JPG
          </button>
        </div>
      </div>

      {/* 3-Column Workspace */}
      <div
        className="post-workspace"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
      >
        {/* Left Column: Quick Template Switcher & Element Tools */}
        <div className="post-left-panel">
          <div className="post-panel-header">
            <h3 className="post-panel-title">📑 Quick Templates</h3>
            <button
              type="button"
              className="post-btn post-btn-secondary"
              style={{ padding: '2px 6px', fontSize: 11 }}
              onClick={() => setViewMode('gallery')}
            >
              Gallery
            </button>
          </div>

          <div className="post-left-content">
            {POST_TEMPLATES.map(t => {
              const isActive = t.id === currentTemplate.id;
              return (
                <div
                  key={t.id}
                  className={`post-quick-tpl-card ${isActive ? 'post-quick-tpl-card--active' : ''}`}
                  onClick={() => handleSelectTemplate(t)}
                >
                  <span style={{ fontSize: 22 }}>{t.thumbnail}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{t.category}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Live Movable Canvas Area */}
        <div className="post-canvas-area">
          {/* Quick Floating Element Inserters */}
          <div className="post-floating-toolbar">
            <button
              type="button"
              className="post-btn post-btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11.5 }}
              onClick={handleAddCustomText}
            >
              ➕ Text Box
            </button>

            <button
              type="button"
              className="post-btn post-btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11.5 }}
              onClick={() => setActivePropTab('shapes')}
            >
              🔷 Add Shape
            </button>

            <button
              type="button"
              className="post-btn post-btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11.5 }}
              onClick={() => setActivePropTab('background')}
            >
              🎨 Background
            </button>

            {selectedElement && (
              <>
                <span style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 4px' }} />
                <button
                  type="button"
                  className="post-btn post-btn-danger-outline"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={handleDeleteElement}
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>

          {/* Render Live Canvas Sheet */}
          {renderLiveCanvas(false)}
        </div>

        {/* Right Column: Properties & Content Inspector */}
        <div className="post-props-panel">
          {/* Tabs */}
          <div className="post-props-tabs">
            <button
              type="button"
              className={`post-props-tab ${activePropTab === 'content' ? 'post-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('content')}
            >
              Content
            </button>
            <button
              type="button"
              className={`post-props-tab ${activePropTab === 'style' ? 'post-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('style')}
            >
              Styles
            </button>
            <button
              type="button"
              className={`post-props-tab ${activePropTab === 'shapes' ? 'post-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('shapes')}
            >
              Shapes
            </button>
            <button
              type="button"
              className={`post-props-tab ${activePropTab === 'background' ? 'post-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('background')}
            >
              Background
            </button>
            <button
              type="button"
              className={`post-props-tab ${activePropTab === 'layers' ? 'post-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('layers')}
            >
              Layers
            </button>
          </div>

          <div className="post-props-body">
            {/* ── TAB 1: TEMPLATE CONTENT FIELDS ── */}
            {activePropTab === 'content' && (
              <>
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>✏️ Edit Template Text & Details</span>
                  </div>

                  {canvasElements.filter(el => el.type === 'text').map(el => (
                    <div key={el.id} className="cat-form-group">
                      <label>{el.slot ? el.slot.toUpperCase().replace('_', ' ') : 'TEXT BLOCK'}</label>
                      {el.text && el.text.length > 50 ? (
                        <textarea
                          className="cat-textarea"
                          rows="2"
                          value={el.text}
                          onChange={(e) => handleUpdateElement(el.id, { text: e.target.value })}
                        />
                      ) : (
                        <input
                          type="text"
                          className="cat-input"
                          value={el.text}
                          onChange={(e) => handleUpdateElement(el.id, { text: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Image & Logo Upload Slots */}
                {canvasElements.some(el => el.type === 'image' || el.type === 'logo') && (
                  <div className="cat-panel-section">
                    <div className="cat-panel-section-title">
                      <span>🖼️ Upload Custom Images & Logo</span>
                    </div>

                    {canvasElements.filter(el => el.type === 'image' || el.type === 'logo').map(el => (
                      <div key={el.id} className="cat-form-group">
                        <label>{el.type === 'logo' ? 'Business Logo' : 'Hero / Product Image'}</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="cat-input"
                          onChange={(e) => handleImageUpload(e, (b64) => handleUpdateElement(el.id, { image: b64 }))}
                        />
                        {el.image && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <img src={el.image} alt="Preview" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 4, border: '1px solid #cbd5e1' }} />
                            <button
                              type="button"
                              className="post-btn post-btn-danger-outline"
                              style={{ padding: '2px 6px', fontSize: 10, alignSelf: 'center' }}
                              onClick={() => handleUpdateElement(el.id, { image: '' })}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── TAB 2: SELECTED ELEMENT STYLES & POSITION ── */}
            {activePropTab === 'style' && (
              <>
                {selectedElement ? (
                  <>
                    <div className="cat-panel-section">
                      <div className="cat-panel-section-title">
                        <span>Selected: {selectedElement.type.toUpperCase()}</span>
                      </div>

                      {/* Text Specific Styling */}
                      {selectedElement.type === 'text' && (
                        <>
                          <div className="cat-form-group">
                            <label>Text Content</label>
                            <textarea
                              className="cat-textarea"
                              rows="2"
                              value={selectedElement.text || ''}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { text: e.target.value })}
                            />
                          </div>

                          <div className="cat-grid-2">
                            <div className="cat-form-group">
                              <label>Font Size ({selectedElement.fontSize || 28}px)</label>
                              <input
                                type="range"
                                min="12"
                                max="130"
                                value={selectedElement.fontSize || 28}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                              />
                            </div>
                            <div className="cat-form-group">
                              <label>Font Weight</label>
                              <select
                                className="cat-select"
                                value={selectedElement.fontWeight || 600}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { fontWeight: parseInt(e.target.value, 10) })}
                              >
                                <option value="400">Regular (400)</option>
                                <option value="600">Semi-Bold (600)</option>
                                <option value="800">Bold (800)</option>
                                <option value="900">Black / Extra Bold (900)</option>
                              </select>
                            </div>
                          </div>

                          <div className="cat-grid-2">
                            <div className="cat-form-group">
                              <label>Text Color</label>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                  type="color"
                                  value={selectedElement.textColor || '#ffffff'}
                                  onChange={(e) => handleUpdateElement(selectedElement.id, { textColor: e.target.value })}
                                  style={{ width: 34, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                />
                                <input
                                  type="text"
                                  className="cat-input"
                                  value={selectedElement.textColor || '#ffffff'}
                                  onChange={(e) => handleUpdateElement(selectedElement.id, { textColor: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="cat-form-group">
                              <label>Alignment</label>
                              <select
                                className="cat-select"
                                value={selectedElement.textAlign || 'center'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { textAlign: e.target.value })}
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Shape Specific Styling */}
                      {selectedElement.type === 'shape' && (
                        <>
                          <div className="cat-grid-2">
                            <div className="cat-form-group">
                              <label>Fill Color</label>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                  type="color"
                                  value={selectedElement.fillColor || '#4f46e5'}
                                  onChange={(e) => handleUpdateElement(selectedElement.id, { fillColor: e.target.value })}
                                  style={{ width: 34, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                />
                                <input
                                  type="text"
                                  className="cat-input"
                                  value={selectedElement.fillColor || '#4f46e5'}
                                  onChange={(e) => handleUpdateElement(selectedElement.id, { fillColor: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="cat-form-group">
                              <label>Border Width ({selectedElement.borderWidth || 0}px)</label>
                              <input
                                type="range"
                                min="0"
                                max="16"
                                value={selectedElement.borderWidth || 0}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { borderWidth: parseInt(e.target.value, 10) })}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Coordinates & Geometry */}
                      <div className="cat-grid-2" style={{ marginTop: 8 }}>
                        <div className="cat-form-group">
                          <label>X Position (px)</label>
                          <input
                            type="number"
                            className="cat-input"
                            value={selectedElement.x}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { x: parseInt(e.target.value, 10) || 0 })}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Y Position (px)</label>
                          <input
                            type="number"
                            className="cat-input"
                            value={selectedElement.y}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { y: parseInt(e.target.value, 10) || 0 })}
                          />
                        </div>
                      </div>

                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>Width (px)</label>
                          <input
                            type="number"
                            className="cat-input"
                            value={selectedElement.width}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { width: parseInt(e.target.value, 10) || 40 })}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Height (px)</label>
                          <input
                            type="number"
                            className="cat-input"
                            value={selectedElement.height}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { height: parseInt(e.target.value, 10) || 20 })}
                          />
                        </div>
                      </div>

                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>Rotation ({selectedElement.rotation || 0}°)</label>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={selectedElement.rotation || 0}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { rotation: parseInt(e.target.value, 10) })}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Opacity ({Math.round((selectedElement.opacity ?? 1) * 100)}%)</label>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={selectedElement.opacity ?? 1}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>No Element Selected</div>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Click any element on the canvas to customize position, size, colors and fonts.</p>
                  </div>
                )}
              </>
            )}

            {/* ── TAB 3: SHAPES LIBRARY ── */}
            {activePropTab === 'shapes' && (
              <div className="cat-panel-section">
                <div className="cat-panel-section-title">
                  <span>🔷 Vector Shapes</span>
                </div>
                <div className="cat-grid-2">
                  {SHAPE_ITEMS.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="shape-picker-btn"
                      onClick={() => handleAddShape(s.shapeType)}
                    >
                      <span style={{ fontSize: 16 }}>
                        {s.shapeType === 'circle' ? '⭕' : s.shapeType === 'star' ? '⭐' : s.shapeType === 'triangle' ? '🔺' : '⬛'}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 600 }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 4: BACKGROUND EDITOR ── */}
            {activePropTab === 'background' && (
              <>
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>Background Type</span>
                  </div>

                  <div className="cat-grid-3">
                    <button
                      type="button"
                      className={`post-btn ${canvasBackground?.type === 'solid' ? 'post-btn-primary' : 'post-btn-secondary'}`}
                      style={{ fontSize: 11 }}
                      onClick={() => setCanvasBackground({ type: 'solid', color: canvasBackground?.color || '#0f172a' })}
                    >
                      Solid Color
                    </button>
                    <button
                      type="button"
                      className={`post-btn ${canvasBackground?.type === 'gradient' ? 'post-btn-primary' : 'post-btn-secondary'}`}
                      style={{ fontSize: 11 }}
                      onClick={() => setCanvasBackground({
                        type: 'gradient',
                        gradient: { type: 'linear', angle: 135, color1: '#4f46e5', color2: '#18181b' }
                      })}
                    >
                      Gradient
                    </button>
                    <button
                      type="button"
                      className={`post-btn ${canvasBackground?.type === 'image' ? 'post-btn-primary' : 'post-btn-secondary'}`}
                      style={{ fontSize: 11 }}
                      onClick={() => setCanvasBackground({ type: 'image', image: '', imageFit: 'cover', imageOpacity: 1 })}
                    >
                      Image
                    </button>
                  </div>

                  {/* Solid Color Picker */}
                  {canvasBackground?.type === 'solid' && (
                    <div className="cat-form-group" style={{ marginTop: 8 }}>
                      <label>Background Color</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="color"
                          value={canvasBackground.color || '#0f172a'}
                          onChange={(e) => setCanvasBackground({ type: 'solid', color: e.target.value })}
                          style={{ width: 34, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          className="cat-input"
                          value={canvasBackground.color || '#0f172a'}
                          onChange={(e) => setCanvasBackground({ type: 'solid', color: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Gradient Controls */}
                  {canvasBackground?.type === 'gradient' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>Color 1 (Start)</label>
                          <input
                            type="color"
                            value={canvasBackground.gradient?.color1 || '#4f46e5'}
                            onChange={(e) => setCanvasBackground({
                              ...canvasBackground,
                              gradient: { ...(canvasBackground.gradient || {}), color1: e.target.value }
                            })}
                            style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Color 2 (End)</label>
                          <input
                            type="color"
                            value={canvasBackground.gradient?.color2 || '#18181b'}
                            onChange={(e) => setCanvasBackground({
                              ...canvasBackground,
                              gradient: { ...(canvasBackground.gradient || {}), color2: e.target.value }
                            })}
                            style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                        </div>
                      </div>

                      <div className="cat-form-group">
                        <label>Angle ({canvasBackground.gradient?.angle || 135}°)</label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={canvasBackground.gradient?.angle || 135}
                          onChange={(e) => setCanvasBackground({
                            ...canvasBackground,
                            gradient: { ...(canvasBackground.gradient || {}), angle: parseInt(e.target.value, 10) }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Background Image Upload */}
                  {canvasBackground?.type === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="cat-input"
                        onChange={(e) => handleImageUpload(e, (b64) => setCanvasBackground({ ...canvasBackground, image: b64 }))}
                      />
                      {canvasBackground.image && (
                        <button
                          type="button"
                          className="post-btn post-btn-danger-outline"
                          style={{ fontSize: 11 }}
                          onClick={() => setCanvasBackground({ ...canvasBackground, image: '' })}
                        >
                          Remove Background Image
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Preset Gradients */}
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>✨ Preset Themes</span>
                  </div>
                  <div className="cat-grid-2">
                    {PRESET_GRADIENTS.map((p, i) => (
                      <div
                        key={i}
                        className="bg-preset-card"
                        style={{
                          background: p.type === 'radial'
                            ? `radial-gradient(circle, ${p.color1} 0%, ${p.color2} 100%)`
                            : `linear-gradient(${p.angle}deg, ${p.color1} 0%, ${p.color2} 100%)`
                        }}
                        onClick={() => setCanvasBackground({ type: 'gradient', gradient: p })}
                        title={p.name}
                      >
                        <span style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 9, fontWeight: 700, color: '#ffffff', background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 3 }}>
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── TAB 5: LAYERS ── */}
            {activePropTab === 'layers' && (
              <>
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>Layer Controls</span>
                  </div>
                  <div className="cat-grid-2">
                    <button type="button" className="post-btn post-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('front')}>
                      Bring to Front
                    </button>
                    <button type="button" className="post-btn post-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('forward')}>
                      Bring Forward
                    </button>
                    <button type="button" className="post-btn post-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('backward')}>
                      Send Backward
                    </button>
                    <button type="button" className="post-btn post-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('back')}>
                      Send to Back
                    </button>
                  </div>
                </div>

                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>Elements on Canvas</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
                    {[...canvasElements].reverse().map(el => {
                      const isSelected = el.id === selectedElementId;
                      return (
                        <div
                          key={el.id}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: isSelected ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                            background: isSelected ? '#eef2ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 11.5,
                            fontWeight: isSelected ? 700 : 500
                          }}
                          onClick={() => setSelectedElementId(el.id)}
                        >
                          <span>{el.slot ? el.slot.toUpperCase() : el.type.toUpperCase()}</span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>z: {el.zIndex || 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── FULLSCREEN PREVIEW MODAL ───────────────────────────────── */}
      {showPreviewModal && (
        <div className="cat-modal-overlay">
          <div className="cat-modal post-preview-modal">
            <div className="cat-modal-header">
              <h2 className="cat-modal-title">👁️ Post Preview</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="post-btn post-btn-primary"
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleExportImage('png');
                  }}
                >
                  📥 Download PNG
                </button>
                <button type="button" className="cat-icon-btn" onClick={() => setShowPreviewModal(false)}>✕</button>
              </div>
            </div>

            <div className="post-preview-body">
              {renderLiveCanvas(true)}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT PROGRESS OVERLAY ────────────────────────────────── */}
      {exportingState.isExporting && (
        <div className="cat-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="cat-modal" style={{ width: 380, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎨</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 17, color: '#0f172a' }}>Exporting Post Image</h3>
            <p style={{ margin: '0', fontSize: 13, color: '#64748b' }}>{exportingState.status}</p>
          </div>
        </div>
      )}
    </div>
  );
}
