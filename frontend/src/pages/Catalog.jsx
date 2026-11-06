import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTitle } from '../context/TitleContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { generateCatalogPDF } from '../utils/pdfGenerator.js';
import { API_BASE_URL } from '../config.js';
import './Catalog.css';

// ── THEME PRESETS ────────────────────────────────────────────────────────
const THEME_COLORS = [
  { name: 'Emerald Green', hex: '#059669', light: '#f0fdf4', border: '#86efac' },
  { name: 'Royal Blue', hex: '#2563eb', light: '#eff6ff', border: '#93c5fd' },
  { name: 'Indigo Sleek', hex: '#4f46e5', light: '#eef2ff', border: '#a5b4fc' },
  { name: 'Crimson Red', hex: '#dc2626', light: '#fef2f2', border: '#fca5a5' },
  { name: 'Luxury Purple', hex: '#7c3aed', light: '#f5f3ff', border: '#c4b5fd' },
  { name: 'Dark Gold', hex: '#b45309', light: '#fffbeb', border: '#fcd34d' },
  { name: 'Slate Modern', hex: '#334155', light: '#f8fafc', border: '#cbd5e1' },
  { name: 'Sunset Amber', hex: '#d97706', light: '#fffbeb', border: '#fde68a' },
  { name: 'Teal Modern', hex: '#0d9488', light: '#f0fdfa', border: '#99f6e4' }
];

const BACKGROUND_PRESETS = [
  { name: 'Pure White', type: 'solid', color: '#ffffff' },
  { name: 'Light Gray', type: 'solid', color: '#f8fafc' },
  { name: 'Soft Green', type: 'solid', color: '#f0fdf4' },
  { name: 'Soft Blue', type: 'solid', color: '#eff6ff' },
  { name: 'Warm Cream', type: 'solid', color: '#fdfbf7' },
  { name: 'Modern Mint Gradient', type: 'gradient', gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#e8f5e9' } },
  { name: 'Sky Soft Gradient', type: 'gradient', gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#e0f2fe' } },
  { name: 'Sunset Aura Gradient', type: 'gradient', gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#fef2f2' } },
  { name: 'Executive Slate Gradient', type: 'gradient', gradient: { type: 'linear', angle: 135, color1: '#f8fafc', color2: '#e2e8f0' } },
  { name: 'Purple Whisper Gradient', type: 'gradient', gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f3e8ff' } }
];

// Complete 20+ Vector Shapes
const SHAPE_TEMPLATES = [
  { id: 'rect', name: 'Rectangle', shapeType: 'rect', icon: '⬛' },
  { id: 'rounded', name: 'Rounded Rect', shapeType: 'rounded', icon: '▢' },
  { id: 'circle', name: 'Circle', shapeType: 'circle', icon: '⭕' },
  { id: 'ellipse', name: 'Ellipse', shapeType: 'ellipse', icon: '⬭' },
  { id: 'square', name: 'Square', shapeType: 'square', icon: '⏹' },
  { id: 'triangle', name: 'Triangle', shapeType: 'triangle', icon: '🔺' },
  { id: 'diamond', name: 'Diamond', shapeType: 'diamond', icon: '🔷' },
  { id: 'star', name: '5-Star', shapeType: 'star', icon: '⭐' },
  { id: 'hexagon', name: 'Hexagon', shapeType: 'hexagon', icon: '⬡' },
  { id: 'pentagon', name: 'Pentagon', shapeType: 'pentagon', icon: '⬠' },
  { id: 'line', name: 'Horiz Line', shapeType: 'line', icon: '━' },
  { id: 'vline', name: 'Vert Line', shapeType: 'vline', icon: '┃' },
  { id: 'arrow', name: 'Arrow Right', shapeType: 'arrow', icon: '➔' },
  { id: 'double_arrow', name: 'Double Arrow', shapeType: 'double_arrow', icon: '⬌' },
  { id: 'heart', name: 'Heart', shapeType: 'heart', icon: '❤️' },
  { id: 'badge', name: 'Badge Ribbon', shapeType: 'badge', icon: '🏷️' },
  { id: 'burst', name: 'Starburst', shapeType: 'burst', icon: '💥' },
  { id: 'plus', name: 'Plus Sign', shapeType: 'plus', icon: '➕' },
  { id: 'cross', name: 'Cross / X', shapeType: 'cross', icon: '✖️' },
  { id: 'pill', name: 'Pill / Tag', shapeType: 'pill', icon: '💊' }
];

const MASK_SHAPES = [
  { id: 'rect', label: 'Standard Rect' },
  { id: 'rounded', label: 'Rounded Corner' },
  { id: 'circle', label: 'Circle Mask' },
  { id: 'squircle', label: 'Squircle' },
  { id: 'hexagon', label: 'Hexagon Mask' },
  { id: 'pentagon', label: 'Pentagon Mask' },
  { id: 'star', label: 'Star Mask' },
  { id: 'diamond', label: 'Diamond Mask' },
  { id: 'shield', label: 'Shield Badge' },
  { id: 'heart', label: 'Heart Mask' }
];

const FONT_FAMILIES = [
  { name: 'System Sans', value: 'inherit' },
  { name: 'Inter / Clean Modern', value: "'Inter', sans-serif" },
  { name: 'Roboto / Tech', value: "'Roboto', sans-serif" },
  { name: 'Outfit / Elegant', value: "'Outfit', sans-serif" },
  { name: 'Poppins / Geometric', value: "'Poppins', sans-serif" },
  { name: 'Georgia / Luxury Serif', value: 'Georgia, serif' },
  { name: 'Impact / Heavy Bold', value: 'Impact, sans-serif' },
  { name: 'Monospace / Code', value: 'Courier New, monospace' }
];

const DEFAULT_CURRENCY = '₹';

// Helper to generate default A4 elements for a page
function createDefaultElementsForProduct(product = {}, pageIndex = 0, totalPages = 1, themeColor = '#059669', currencySymbol = DEFAULT_CURRENCY) {
  const ts = Date.now() + Math.floor(Math.random() * 1000);
  return [
    {
      id: `el-header-${ts}`,
      type: 'header',
      x: 32,
      y: 24,
      width: 730,
      height: 56,
      rotation: 0,
      zIndex: 1,
      opacity: 1
    },
    {
      id: `el-image-${ts + 1}`,
      type: 'image',
      x: 32,
      y: 96,
      width: 350,
      height: 350,
      rotation: 0,
      zIndex: 2,
      opacity: 1,
      maskShape: 'rect',
      maskRadius: 10,
      maskZoom: 100,
      maskPanX: 0,
      maskPanY: 0,
      imageFit: 'cover',
      borderWidth: 0,
      borderColor: themeColor,
      shadow: 'md'
    },
    {
      id: `el-badge-${ts + 2}`,
      type: 'badge',
      x: 44,
      y: 108,
      width: 120,
      height: 28,
      rotation: 0,
      zIndex: 10,
      opacity: 1
    },
    {
      id: `el-category-${ts + 3}`,
      type: 'category',
      x: 406,
      y: 96,
      width: 356,
      height: 24,
      rotation: 0,
      zIndex: 2,
      opacity: 1
    },
    {
      id: `el-title-${ts + 4}`,
      type: 'title',
      x: 406,
      y: 124,
      width: 356,
      height: 60,
      rotation: 0,
      zIndex: 2,
      opacity: 1,
      fontSize: 22,
      fontWeight: 800,
      textColor: '#0f172a'
    },
    {
      id: `el-price-${ts + 5}`,
      type: 'price',
      x: 406,
      y: 190,
      width: 356,
      height: 42,
      rotation: 0,
      zIndex: 2,
      opacity: 1
    },
    {
      id: `el-shortdesc-${ts + 6}`,
      type: 'short_desc',
      x: 406,
      y: 238,
      width: 356,
      height: 46,
      rotation: 0,
      zIndex: 2,
      opacity: 1
    },
    {
      id: `el-fulldesc-${ts + 7}`,
      type: 'full_desc',
      x: 406,
      y: 290,
      width: 356,
      height: 70,
      rotation: 0,
      zIndex: 2,
      opacity: 1
    },
    {
      id: `el-highlights-${ts + 8}`,
      type: 'highlights',
      x: 32,
      y: 464,
      width: 350,
      height: 200,
      rotation: 0,
      zIndex: 2,
      opacity: 1
    },
    {
      id: `el-specs-${ts + 9}`,
      type: 'specs',
      x: 406,
      y: 374,
      width: 356,
      height: 290,
      rotation: 0,
      zIndex: 2,
      opacity: 1
    },
    {
      id: `el-cta-${ts + 10}`,
      type: 'cta',
      x: 32,
      y: 955,
      width: 730,
      height: 80,
      rotation: 0,
      zIndex: 3,
      opacity: 1
    },
    {
      id: `el-footer-${ts + 11}`,
      type: 'footer',
      x: 32,
      y: 1055,
      width: 730,
      height: 38,
      rotation: 0,
      zIndex: 1,
      opacity: 1
    }
  ];
}

// Starter Sample Products
const SAMPLE_PRODUCTS = [
  {
    id: 'sample-p1',
    name: 'Ultra Wireless Noise-Cancelling Headphones',
    sku: 'AUDIO-HP-001',
    category: 'Audio & Wearables',
    regularPrice: '4999',
    discountPrice: '2999',
    badgeText: 'BESTSELLER',
    shortDescription: 'Experience pure acoustic clarity with industry-leading Active Noise Cancellation.',
    description: 'Engineered with custom 40mm neodymium drivers, ultra-soft memory foam earcups, and dual beamforming microphones for crystal-clear calls and immersive listening.',
    features: [
      '40-Hour Battery Life with Fast Charge (10m = 5hrs)',
      'Hybrid Active Noise Cancellation with Transparency Mode',
      'Multipoint Bluetooth 5.3 Connection for 2 Devices',
      'Ultra-comfortable lightweight ergonomic headband'
    ],
    specs: [
      { key: 'Driver Size', value: '40mm Titanium Drivers' },
      { key: 'Weight', value: '250 grams' },
      { key: 'Connectivity', value: 'Bluetooth 5.3 + 3.5mm Aux' },
      { key: 'Warranty', value: '1 Year Full Replacement' }
    ],
    whatsappNumber: '+919876543210',
    phone: '+91 98765 43210',
    website: 'www.mybrand.com',
    ctaText: 'Order via WhatsApp',
    mainImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    background: {
      type: 'solid',
      color: '#ffffff',
      gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f0fdf4' },
      image: '',
      imageFit: 'cover',
      imageOpacity: 1
    }
  },
  {
    id: 'sample-p2',
    name: 'Smart AMOLED Fitness Tracker Watch',
    sku: 'WEAR-SW-002',
    category: 'Smart Wearables',
    regularPrice: '3499',
    discountPrice: '1999',
    badgeText: 'NEW ARRIVAL',
    shortDescription: 'Sleek 1.43" AMOLED display with real-time health metrics & SpO2 sensor.',
    description: 'Designed for high performers and athletes. Features 5ATM water resistance, sleep stage tracking, all-day heart rate monitoring, and Bluetooth calling directly from your wrist.',
    features: [
      '1.43" Ultra-Bright AMOLED Display with Always-On Mode',
      'Precision SpO2, Heart Rate & Sleep Quality Monitoring',
      '5ATM Water Resistant up to 50 meters depth',
      'Long-lasting 12-Day Battery Life on single charge'
    ],
    specs: [
      { key: 'Display', value: '1.43" AMOLED (466x466 px)' },
      { key: 'Sensors', value: 'PPG, SpO2, 3-Axis Gyro' },
      { key: 'Water Rating', value: '5 ATM Waterproof' },
      { key: 'Compatibility', value: 'Android 7.0+ / iOS 12.0+' }
    ],
    whatsappNumber: '+919876543210',
    phone: '+91 98765 43210',
    website: 'www.mybrand.com',
    ctaText: 'Order via WhatsApp',
    mainImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    background: {
      type: 'gradient',
      color: '#ffffff',
      gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#e0f2fe' },
      image: '',
      imageFit: 'cover',
      imageOpacity: 1
    }
  },
  {
    id: 'sample-p3',
    name: 'Professional 4K Drone with Gimbal Camera',
    sku: 'DRONE-PRO-003',
    category: 'Aerial Photography',
    regularPrice: '38999',
    discountPrice: '29999',
    badgeText: 'PRO GEAR',
    shortDescription: 'Ultra-stable 3-axis gimbal camera with 4K 60fps HDR video & 10km video transmission.',
    description: 'Empower your aerial creativity with 45 minutes of flight time per battery, omnidirectional obstacle sensing, intelligent flight modes, and level-7 wind resistance.',
    features: [
      'True 4K/60fps HDR Video Recording with 48MP Photos',
      '45 Minutes Extended Maximum Flight Time',
      'Omnidirectional Obstacle Sensing with APAS 5.0',
      '10km FHD Low-Latency Video Transmission'
    ],
    specs: [
      { key: 'Camera Sensor', value: '1/1.3-inch CMOS 48MP' },
      { key: 'Max Speed', value: '57.6 km/h' },
      { key: 'Weight', value: '249 grams (Ultralight)' },
      { key: 'Storage', value: '64GB Internal + MicroSD 512GB' }
    ],
    whatsappNumber: '+919876543210',
    phone: '+91 98765 43210',
    website: 'www.mybrand.com',
    ctaText: 'Order via WhatsApp',
    mainImage: 'https://images.unsplash.com/photo-1507582020432-2a3bc4ff7a8b?w=800&auto=format&fit=crop&q=80',
    background: {
      type: 'solid',
      color: '#f8fafc',
      gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f3e8ff' },
      image: '',
      imageFit: 'cover',
      imageOpacity: 1
    }
  }
];

export default function Catalog() {
  const { setTitle } = useTitle();
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    setTitle('Catalog Builder');
  }, [setTitle]);

  // ── Permission Flags ────────────────────────────────────────────
  const canEdit = hasPermission('catalog.edit') || hasPermission('catalog') || !user?.is_team_member;
  const canCreate = hasPermission('catalog.create') || hasPermission('catalog') || !user?.is_team_member;
  const canDelete = hasPermission('catalog.delete') || hasPermission('catalog') || !user?.is_team_member;
  const canDownload = hasPermission('catalog.download') || hasPermission('catalog') || !user?.is_team_member;

  // ── VIEW MODE: 'history' (Front Intro / Landing) | 'editor' ────
  const [viewMode, setViewMode] = useState('history'); // default to front intro page

  // ── CURRENT CATALOG ID & METADATA ───────────────────────────────
  const [currentCatalogId, setCurrentCatalogId] = useState(null);
  const [catalogInfo, setCatalogInfo] = useState({
    catalogName: 'Product Catalog 2026',
    businessName: user?.organization_name || user?.app_name || 'My Business',
    logo: user?.app_logo || '',
    businessPhone: user?.mobile || '',
    whatsappNumber: user?.mobile || '',
    email: user?.email || '',
    website: '',
    address: '',
    description: 'Explore our latest collection of premium products and special offers.',
    primaryHeading: 'Official Product Catalog',
    footerText: 'Prices are subject to revision • Contact us for bulk orders & dealer inquiries',
    themeColor: '#059669',
    currencySymbol: DEFAULT_CURRENCY
  });

  // ── PAGES STATE ─────────────────────────────────────────────────
  const [pages, setPages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isBuilderActive, setIsBuilderActive] = useState(false);

  // ── MY CATALOGS HISTORY & TABS STATE ────────────────────────────
  const [savedCatalogs, setSavedCatalogs] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [catalogTab, setCatalogTab] = useState('my'); // 'my' | 'team'
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const [catalogStats, setCatalogStats] = useState({ total: 0, my_catalogs: 0, team_catalogs: 0, recently_updated: 0 });
  const [catalogAccessDenied, setCatalogAccessDenied] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  // ── AUTO-SAVE STATE ─────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const autoSaveTimeoutRef = useRef(null);

  // ── SELECTION & INSPECTOR ───────────────────────────────────────
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [activePropTab, setActivePropTab] = useState('product'); // 'product' | 'canvas' | 'shapes' | 'background' | 'layers'
  const [zoomScale, setZoomScale] = useState(1);
  const [inlineEditingTextId, setInlineEditingTextId] = useState(null);

  // ── DRAGGING / RESIZING / ROTATING ──────────────────────────────
  const [interactionState, setInteractionState] = useState(null);
  const [snappingGuides, setSnappingGuides] = useState({ x: null, y: null });

  // ── UNDO / REDO ─────────────────────────────────────────────────
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ── MODALS ──────────────────────────────────────────────────────
  const [showBasicDetailsModal, setShowBasicDetailsModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [pageToDeleteIndex, setPageToDeleteIndex] = useState(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // ── PDF EXPORT STATE ────────────────────────────────────
  const [pdfState, setPdfState] = useState({
    exporting: false,
    current: 0,
    total: 0,
    percentage: 0,
    status: '',
    error: ''
  });

  // ── NEW PRODUCT PAGE FORM STATE ─────────────────────────────────
  const [newPageForm, setNewPageForm] = useState({
    name: '',
    sku: '',
    category: '',
    regularPrice: '',
    discountPrice: '',
    badgeText: 'FEATURED',
    shortDescription: '',
    description: '',
    features: ['100% Quality Guaranteed', 'Fast Dispatch within 24 Hours'],
    specs: [{ key: 'Condition', value: 'Brand New' }],
    whatsappNumber: '',
    phone: '',
    website: '',
    ctaText: 'Order via WhatsApp',
    mainImage: ''
  });

  // Hidden references for PDF rendering
  const pdfPagesRef = useRef([]);
  const canvasContainerRef = useRef(null);

  // Active page object & selected element
  const activePage = pages[activePageIndex] || null;
  const activeElements = activePage?.elements || [];
  const selectedElement = activeElements.find(el => el.id === selectedElementId) || null;

  // ── FETCH USER'S SAVED CATALOGS FROM DATABASE ───────────────────
  const fetchSavedCatalogs = useCallback(async () => {
    setLoadingCatalogs(true);
    try {
      const token = localStorage.getItem('wa_dashboard_token');
      // Fetch ALL catalogs for the current user (backend already enforces ownership scoping)
      // Pass a high limit so we get everything; frontend filters by tab
      const params = new URLSearchParams({ limit: '200', sort_by: 'updated_at', sort_dir: 'desc' });
      const res = await fetch(`${API_BASE_URL}/catalogs?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status === 403) {
        setCatalogAccessDenied(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setSavedCatalogs(data.catalogs || []);
      }
    } catch (err) {
      console.warn('[Catalog] Error fetching catalogs:', err);
    } finally {
      setLoadingCatalogs(false);
    }
  }, []);

  // ── FETCH CATALOG STATS ─────────────────────────────────────────
  const fetchCatalogStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const res = await fetch(`${API_BASE_URL}/catalogs/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status === 403) { setCatalogAccessDenied(true); return; }
      const data = await res.json();
      if (data.success) setCatalogStats(data);
    } catch (err) {
      console.warn('[Catalog] Stats fetch error:', err);
    }
  }, []);

  // ── FETCH TEAM MEMBERS FOR FILTER DROPDOWN ──────────────────────
  const fetchTeamMembers = useCallback(async () => {
    const isAdminUser = !user?.is_team_member && (user?.role === 'Admin' || user?.role === 'Super Admin' || user?.username === 'admin');
    if (!isAdminUser) return;
    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const res = await fetch(`${API_BASE_URL}/users?role=team_member&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) setTeamMembers(data.users || data.data || []);
    } catch (err) {
      console.warn('[Catalog] Team members fetch error:', err);
    }
  }, [user]);

  // Initial load: fetch saved catalogs + stats and display management page
  useEffect(() => {
    fetchSavedCatalogs();
    fetchCatalogStats();
    fetchTeamMembers();
    setViewMode('history'); // always open management page first on navigation
  }, [fetchSavedCatalogs, fetchCatalogStats, fetchTeamMembers]);

  // ── HISTORY MANAGEMENT (UNDO / REDO) ────────────────────────────
  const pushHistory = useCallback((newPages) => {
    setHistoryStack(prev => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, JSON.stringify(newPages)].slice(-35); // max 35 states
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetState = JSON.parse(historyStack[historyIndex - 1]);
      setPages(targetState);
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const targetState = JSON.parse(historyStack[historyIndex + 1]);
      setPages(targetState);
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, historyStack]);

  // ── PERSISTENCE / AUTO-SAVE ENGINE ──────────────────────────────
  const triggerSave = useCallback(async (forcedCatalogInfo = catalogInfo, forcedPages = pages, forcedCatalogId = currentCatalogId) => {
    if (!isBuilderActive || forcedPages.length === 0) return;
    if (!canEdit) return;

    setSaveStatus('saving');
    const userKey = user?.id || 'default';

    // Local Storage Immediate Backup scoped to user
    try {
      localStorage.setItem(`wa_catalog_active_pages_${userKey}`, JSON.stringify(forcedPages));
      localStorage.setItem(`wa_catalog_active_info_${userKey}`, JSON.stringify(forcedCatalogInfo));
      if (forcedCatalogId) localStorage.setItem(`wa_catalog_active_id_${userKey}`, String(forcedCatalogId));
    } catch (e) {}

    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const payload = {
        title: forcedCatalogInfo.catalogName || 'Product Catalog',
        business_name: forcedCatalogInfo.businessName || '',
        description: forcedCatalogInfo.description || '',
        status: 'Draft',
        settings: forcedCatalogInfo,
        thumbnail: forcedPages[0]?.mainImage || '',
        pages: forcedPages
      };

      let res;
      if (forcedCatalogId) {
        res = await fetch(`${API_BASE_URL}/catalogs/${forcedCatalogId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/catalogs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.success) {
        if (!forcedCatalogId && data.catalogId) {
          setCurrentCatalogId(data.catalogId);
          localStorage.setItem(`wa_catalog_active_id_${userKey}`, String(data.catalogId));
        }
        setSaveStatus('saved');
        const now = new Date();
        setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        fetchSavedCatalogs();
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.warn('[Catalog] Auto-save error:', err);
      setSaveStatus('error');
    }
  }, [catalogInfo, pages, currentCatalogId, isBuilderActive, canEdit]);

  // Debounced auto-save on state changes
  useEffect(() => {
    if (!isBuilderActive || pages.length === 0) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      triggerSave();
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [pages, catalogInfo, triggerSave, isBuilderActive]);

  // ── LOAD CATALOG FROM DB ────────────────────────────────────────
  const handleOpenCatalog = async (catalogId) => {
    try {
      setLoadingCatalogs(true);
      const token = localStorage.getItem('wa_dashboard_token');
      const userKey = user?.id || 'default';
      const res = await fetch(`${API_BASE_URL}/catalogs/${catalogId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!data.success || !data.catalog) {
        alert(data.message || 'Failed to load catalog');
        return;
      }

      const cat = data.catalog;
      setCurrentCatalogId(cat.id);
      localStorage.setItem(`wa_catalog_active_id_${userKey}`, String(cat.id));

      if (cat.settings && typeof cat.settings === 'object') {
        setCatalogInfo(prev => ({ ...prev, ...cat.settings }));
      }

      const loadedPages = (cat.pages || []).map((p, idx) => ({
        ...p,
        background: p.background || { type: 'solid', color: '#ffffff' },
        elements: Array.isArray(p.elements) && p.elements.length > 0
          ? p.elements
          : createDefaultElementsForProduct(p, idx, cat.pages.length, cat.settings?.themeColor || '#059669', cat.settings?.currencySymbol || DEFAULT_CURRENCY)
      }));

      setPages(loadedPages);
      setActivePageIndex(0);
      setSelectedElementId(null);
      setIsBuilderActive(true);
      setViewMode('editor');
      setHistoryStack([JSON.stringify(loadedPages)]);
      setHistoryIndex(0);
    } catch (err) {
      console.error('[Catalog] Load error:', err);
      alert('Error opening catalog.');
    } finally {
      setLoadingCatalogs(false);
    }
  };

  // ── CREATE NEW CATALOG (PRISTINE BLANK START) ───────────────────
  const handleCreateNewCatalog = () => {
    if (!canCreate) return alert('You do not have permission to create catalogs.');
    const userKey = user?.id || 'default';

    setCurrentCatalogId(null);
    localStorage.removeItem(`wa_catalog_active_id_${userKey}`);
    localStorage.removeItem(`wa_catalog_active_pages_${userKey}`);
    localStorage.removeItem(`wa_catalog_active_info_${userKey}`);

    const initialInfo = {
      catalogName: 'My Product Catalog',
      businessName: user?.organization_name || user?.app_name || user?.full_name || 'My Business',
      logo: user?.app_logo || '',
      businessPhone: user?.mobile || '',
      whatsappNumber: user?.mobile || '',
      email: user?.email || '',
      website: '',
      address: '',
      description: 'Explore our collection of quality products.',
      primaryHeading: 'Official Product Catalog',
      footerText: 'Prices are subject to revision • Contact us for orders & inquiries',
      themeColor: '#059669',
      currencySymbol: DEFAULT_CURRENCY
    };

    setCatalogInfo(initialInfo);

    const firstPage = {
      id: 'page-' + Date.now() + '-1',
      name: 'Product Page 1',
      sku: 'SKU-001',
      category: 'General',
      regularPrice: '',
      discountPrice: '',
      badgeText: 'NEW',
      shortDescription: '',
      description: '',
      features: ['100% Quality Guaranteed', 'Fast Dispatch within 24 Hours'],
      specs: [{ key: 'Condition', value: 'Brand New' }],
      whatsappNumber: user?.mobile || '',
      phone: user?.mobile || '',
      website: '',
      ctaText: 'Order via WhatsApp',
      mainImage: '',
      background: {
        type: 'solid',
        color: '#ffffff',
        gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f0fdf4' },
        image: '',
        imageFit: 'cover',
        imageOpacity: 1
      },
      elements: []
    };

    firstPage.elements = createDefaultElementsForProduct(firstPage, 0, 1, initialInfo.themeColor, initialInfo.currencySymbol);

    const newPages = [firstPage];
    setPages(newPages);
    setActivePageIndex(0);
    setSelectedElementId(null);
    setIsBuilderActive(true);
    setViewMode('editor');
    setHistoryStack([JSON.stringify(newPages)]);
    setHistoryIndex(0);
  };

  // ── DUPLICATE CATALOG IN DB ─────────────────────────────────────
  const handleDuplicateCatalogInDb = async (catalogId, e) => {
    if (e) e.stopPropagation();
    if (!canCreate) return alert('You do not have permission to duplicate catalogs.');

    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const res = await fetch(`${API_BASE_URL}/catalogs/${catalogId}/duplicate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        fetchSavedCatalogs();
      } else {
        alert(data.message || 'Failed to duplicate catalog');
      }
    } catch (err) {
      console.error('[Catalog] Duplicate error:', err);
    }
  };

  // ── DELETE CATALOG FROM DB ──────────────────────────────────────
  const handleDeleteCatalogFromDb = async (catalogId, e) => {
    if (e) e.stopPropagation();
    if (!canDelete) return alert('You do not have permission to delete catalogs.');
    if (!window.confirm('Are you sure you want to permanently delete this catalog?')) return;

    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const userKey = user?.id || 'default';
      const res = await fetch(`${API_BASE_URL}/catalogs/${catalogId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        if (currentCatalogId === catalogId) {
          setCurrentCatalogId(null);
          setPages([]);
          setIsBuilderActive(false);
          setViewMode('history');
          localStorage.removeItem(`wa_catalog_active_id_${userKey}`);
          localStorage.removeItem(`wa_catalog_active_pages_${userKey}`);
          localStorage.removeItem(`wa_catalog_active_info_${userKey}`);
        }
        fetchSavedCatalogs();
      } else {
        alert(data.message || 'Failed to delete catalog');
      }
    } catch (err) {
      console.error('[Catalog] Delete error:', err);
    }
  };

  // ── KEYBOARD SHORTCUTS ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when user is typing in form inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!selectedElementId || !activePage) return;

      // Duplicate element: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelectedElement();
        return;
      }

      // Delete element: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelectedElement();
        return;
      }

      // Escape: deselect
      if (e.key === 'Escape') {
        setSelectedElementId(null);
        setInlineEditingTextId(null);
        return;
      }

      // Arrow keys movement
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        handleUpdateElement(selectedElementId, {
          x: Math.round((selectedElement?.x || 0) + dx),
          y: Math.round((selectedElement?.y || 0) + dy)
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedElement, activePage, handleUndo, handleRedo]);

  // ── CATALOG INITIALIZATION & CREATION ───────────────────────────
  const handleStartCatalog = (withSamples = false) => {
    if (withSamples) {
      const initialized = SAMPLE_PRODUCTS.map((p, idx) => ({
        ...p,
        elements: createDefaultElementsForProduct(p, idx, SAMPLE_PRODUCTS.length, catalogInfo.themeColor, catalogInfo.currencySymbol)
      }));
      setPages(initialized);
      setIsBuilderActive(true);
      setActivePageIndex(0);
      setViewMode('editor');
      pushHistory(initialized);
      triggerSave(catalogInfo, initialized, null);
    } else {
      setShowBasicDetailsModal(true);
    }
  };

  const handleBasicDetailsSubmit = (e) => {
    e.preventDefault();
    if (!catalogInfo.catalogName.trim() || !catalogInfo.businessName.trim()) {
      alert('Please enter both Catalog Name and Business Name.');
      return;
    }
    setShowBasicDetailsModal(false);
    setIsBuilderActive(true);
    setViewMode('editor');

    if (pages.length === 0) {
      // Add first standard blank page directly
      handleAddDirectBlankPage();
    } else {
      triggerSave(catalogInfo, pages, currentCatalogId);
    }
  };

  // ── 1-CLICK DIRECT ADD PAGE (NO COMPLICATED MODAL FORCED) ───────
  const handleAddDirectBlankPage = () => {
    const newIdx = pages.length;
    const pageObj = {
      id: 'page-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: `Product Page ${newIdx + 1}`,
      sku: `SKU-${String(newIdx + 1).padStart(3, '0')}`,
      category: 'General',
      regularPrice: '',
      discountPrice: '',
      badgeText: '',
      shortDescription: '',
      description: '',
      features: ['High Quality Standard', 'Full Manufacturer Warranty'],
      specs: [{ key: 'Status', value: 'In Stock' }],
      whatsappNumber: catalogInfo.whatsappNumber || '',
      phone: catalogInfo.businessPhone || '',
      website: catalogInfo.website || '',
      ctaText: 'Order via WhatsApp',
      mainImage: '',
      background: {
        type: 'solid',
        color: '#ffffff',
        gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f0fdf4' },
        image: '',
        imageFit: 'cover',
        imageOpacity: 1
      },
      elements: []
    };

    pageObj.elements = createDefaultElementsForProduct(
      pageObj,
      newIdx,
      newIdx + 1,
      catalogInfo.themeColor,
      catalogInfo.currencySymbol
    );

    const updated = [...pages, pageObj];
    setPages(updated);
    setActivePageIndex(updated.length - 1);
    setSelectedElementId(null);
    setIsBuilderActive(true);
    pushHistory(updated);
  };

  const handleCreateProductPageSubmit = (e) => {
    e.preventDefault();
    if (!newPageForm.name.trim()) {
      alert('Product Name is required.');
      return;
    }

    const newPageObj = {
      id: 'page-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      ...newPageForm,
      background: {
        type: 'solid',
        color: '#ffffff',
        gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f0fdf4' },
        image: '',
        imageFit: 'cover',
        imageOpacity: 1
      },
      elements: []
    };

    newPageObj.elements = createDefaultElementsForProduct(
      newPageObj,
      pages.length,
      pages.length + 1,
      catalogInfo.themeColor,
      catalogInfo.currencySymbol
    );

    const updated = [...pages, newPageObj];
    setPages(updated);
    setActivePageIndex(updated.length - 1);
    setSelectedElementId(null);
    setShowAddProductModal(false);
    pushHistory(updated);

    // Reset new page form
    setNewPageForm({
      name: '',
      sku: '',
      category: '',
      regularPrice: '',
      discountPrice: '',
      badgeText: 'FEATURED',
      shortDescription: '',
      description: '',
      features: ['100% Quality Guaranteed', 'Fast Dispatch within 24 Hours'],
      specs: [{ key: 'Condition', value: 'Brand New' }],
      whatsappNumber: catalogInfo.whatsappNumber || '',
      phone: catalogInfo.businessPhone || '',
      website: catalogInfo.website || '',
      ctaText: 'Order via WhatsApp',
      mainImage: ''
    });
  };

  // ── TWO-WAY ELEMENT SYNCHRONIZATION ─────────────────────────────
  const handleUpdateElement = (elementId, updates) => {
    if (!activePage) return;
    setPages(prev => {
      const updated = [...prev];
      const pageElements = [...(updated[activePageIndex]?.elements || [])];
      const elIdx = pageElements.findIndex(e => e.id === elementId);
      if (elIdx !== -1) {
        pageElements[elIdx] = { ...pageElements[elIdx], ...updates };
        updated[activePageIndex] = { ...updated[activePageIndex], elements: pageElements };
      }
      return updated;
    });
  };

  const handleUpdateActivePageField = (field, value) => {
    if (!activePage) return;
    setPages(prev => {
      const updated = [...prev];
      updated[activePageIndex] = {
        ...updated[activePageIndex],
        [field]: value
      };
      return updated;
    });
  };

  const handleUpdateBackground = (bgUpdates) => {
    if (!activePage) return;
    const currentBg = activePage.background || { type: 'solid', color: '#ffffff' };
    const newBg = { ...currentBg, ...bgUpdates };
    handleUpdateActivePageField('background', newBg);
  };

  // ── PERSISTENT IMAGE UPLOAD HELPER (BACKEND + LOCAL FALLBACK) ───
  const handlePersistentImageUpload = async (file, callback) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Unsupported format. Please upload JPG, PNG, WEBP, or SVG image.');
      return;
    }

    // Direct upload to backend
    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`${API_BASE_URL}/catalogs/upload-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      const data = await res.json();
      if (data.success && data.url) {
        callback(data.url);
        return;
      }
    } catch (err) {
      console.warn('[Catalog] Backend upload fallback to base64:', err);
    }

    // Fallback: FileReader Base64
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      callback(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  // ── ADD TEXT BOX (AUTO SELECT & OPEN RIGHT PANEL) ───────────────
  const handleAddCustomText = () => {
    if (!activePage) return;

    const newTextElement = {
      id: 'text-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'custom_text',
      text: 'Add Custom Heading / Callout',
      x: 180,
      y: 260,
      width: 320,
      height: 52,
      rotation: 0,
      zIndex: activeElements.length + 5,
      opacity: 1,
      fontFamily: "'Inter', sans-serif",
      fontSize: 20,
      fontWeight: 700,
      fontStyle: 'normal',
      textDecoration: 'none',
      textColor: '#0f172a',
      textAlign: 'left',
      backgroundColor: 'transparent',
      borderColor: '#0f172a',
      borderWidth: 0,
      borderRadius: 0,
      padding: 6,
      lineHeight: 1.3,
      letterSpacing: 0
    };

    const updatedElements = [...activeElements, newTextElement];
    handleUpdateActivePageField('elements', updatedElements);
    setSelectedElementId(newTextElement.id);
    setActivePropTab('canvas'); // Immediately open Element Inspector in right panel
    pushHistory(pages);
  };

  // ── ADD VECTOR SHAPE (AUTO SELECT & OPEN RIGHT PANEL) ───────────
  const handleAddShape = (shapeType) => {
    if (!activePage) return;

    const isLine = shapeType === 'line' || shapeType === 'vline';
    const isPill = shapeType === 'pill';
    const isArrow = shapeType === 'arrow' || shapeType === 'double_arrow';

    const newShapeElement = {
      id: 'shape-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'shape',
      shapeType: shapeType || 'rect',
      x: 200,
      y: 200,
      width: isLine ? (shapeType === 'vline' ? 6 : 300) : (isPill ? 160 : (isArrow ? 180 : 120)),
      height: isLine ? (shapeType === 'vline' ? 300 : 6) : (isPill ? 44 : (isArrow ? 60 : 120)),
      rotation: 0,
      zIndex: activeElements.length + 3,
      opacity: 1,
      fillColor: catalogInfo.themeColor || '#059669',
      borderColor: '#0f172a',
      borderWidth: 0,
      borderStyle: 'solid',
      cornerRadius: shapeType === 'rounded' ? 16 : 0,
      shadow: 'none'
    };

    const updatedElements = [...activeElements, newShapeElement];
    handleUpdateActivePageField('elements', updatedElements);
    setSelectedElementId(newShapeElement.id);
    setActivePropTab('canvas'); // Immediately open Element Inspector in right panel
    pushHistory(pages);
  };

  const handleDuplicateSelectedElement = () => {
    if (!selectedElement || !activePage) return;

    const cloned = {
      ...selectedElement,
      id: 'el-clone-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      x: Math.min(700, selectedElement.x + 20),
      y: Math.min(1000, selectedElement.y + 20),
      zIndex: activeElements.length + 1
    };

    const updatedElements = [...activeElements, cloned];
    handleUpdateActivePageField('elements', updatedElements);
    setSelectedElementId(cloned.id);
    pushHistory(pages);
  };

  const handleDeleteSelectedElement = () => {
    if (!selectedElementId || !activePage) return;
    const updatedElements = activeElements.filter(el => el.id !== selectedElementId);
    handleUpdateActivePageField('elements', updatedElements);
    setSelectedElementId(null);
    pushHistory(pages);
  };

  // ── LAYER CONTROLS ──────────────────────────────────────────────
  const handleLayerOrder = (action) => {
    if (!selectedElement || !activePage) return;

    const sorted = [...activeElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
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

    // Re-index zIndices cleanly
    const reindexed = sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
    handleUpdateActivePageField('elements', reindexed);
    pushHistory(pages);
  };

  // ── ALIGNMENT CONTROLS ──────────────────────────────────────────
  const handleAlignElement = (alignment) => {
    if (!selectedElement || !activePage) return;

    const pageW = 794;
    const pageH = 1123;
    const w = selectedElement.width || 100;
    const h = selectedElement.height || 50;

    let updates = {};
    if (alignment === 'left') updates.x = 32;
    if (alignment === 'center') updates.x = Math.round((pageW - w) / 2);
    if (alignment === 'right') updates.x = pageW - 32 - w;
    if (alignment === 'top') updates.y = 24;
    if (alignment === 'middle') updates.y = Math.round((pageH - h) / 2);
    if (alignment === 'bottom') updates.y = pageH - 32 - h;

    handleUpdateElement(selectedElement.id, updates);
  };

  // ── MOUSE INTERACTION (DRAGGING / RESIZING / ROTATING) ───────────
  const handleElementMouseDown = (e, el) => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setActivePropTab('canvas'); // Automatically show element's properties on click

    setInteractionState({
      mode: 'drag',
      elementId: el.id,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation || 0 }
    });
  };

  const handleResizeHandleMouseDown = (e, handle, el) => {
    e.stopPropagation();
    setInteractionState({
      mode: 'resize',
      handle,
      elementId: el.id,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation || 0 }
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

    const { mode, elementId, startX, startY, startBounds, handle } = interactionState;
    const currentScale = zoomScale || 1;
    const dx = (e.clientX - startX) / currentScale;
    const dy = (e.clientY - startY) / currentScale;

    if (mode === 'drag') {
      let newX = Math.round(startBounds.x + dx);
      let newY = Math.round(startBounds.y + dy);

      // Snap guidelines
      const snapDist = 6;
      let snapX = null;
      let snapY = null;

      const pageCenter = 397;
      const elCenter = newX + startBounds.width / 2;
      if (Math.abs(elCenter - pageCenter) <= snapDist) {
        newX = pageCenter - startBounds.width / 2;
        snapX = pageCenter;
      }

      setSnappingGuides({ x: snapX, y: snapY });
      handleUpdateElement(elementId, { x: newX, y: newY });
    } else if (mode === 'resize') {
      let { x, y, width, height } = startBounds;

      if (handle.includes('e')) width = Math.max(20, Math.round(startBounds.width + dx));
      if (handle.includes('s')) height = Math.max(10, Math.round(startBounds.height + dy));
      if (handle.includes('w')) {
        const potentialW = Math.max(20, Math.round(startBounds.width - dx));
        x = startBounds.x + (startBounds.width - potentialW);
        width = potentialW;
      }
      if (handle.includes('n')) {
        const potentialH = Math.max(10, Math.round(startBounds.height - dy));
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
      pushHistory(pages);
    }
  };

  // ── PDF EXPORT ──────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!canDownload) {
      alert('You do not have permission to download catalog PDFs.');
      return;
    }

    if (pages.length === 0) {
      alert('Please add at least one page before exporting PDF.');
      return;
    }

    setPdfState({
      exporting: true,
      current: 0,
      total: pages.length,
      percentage: 5,
      status: 'Preparing high-resolution A4 pages...',
      error: ''
    });

    try {
      await new Promise(r => setTimeout(r, 400));
      const elements = pdfPagesRef.current.filter(Boolean);
      if (!elements || elements.length !== pages.length) {
        throw new Error('Failed to capture pages for PDF export.');
      }

      await generateCatalogPDF(elements, {
        catalogName: catalogInfo.catalogName,
        businessName: catalogInfo.businessName,
        onProgress: (prog) => {
          setPdfState(prev => ({
            ...prev,
            current: prog.current,
            total: prog.total,
            percentage: prog.percentage,
            status: prog.status
          }));
        }
      });

      setTimeout(() => {
        setPdfState(prev => ({ ...prev, exporting: false }));
      }, 1200);
    } catch (err) {
      console.error('PDF Export Error:', err);
      setPdfState(prev => ({
        ...prev,
        error: err.message || 'Export failed',
        status: 'Export Failed'
      }));
    }
  };

  // ── COMPLETE 20+ VECTOR SVG SHAPES RENDERER ─────────────────────
  const renderShapeSVG = (el) => {
    const fill = el.fillColor || catalogInfo.themeColor || '#059669';
    const stroke = el.borderColor || '#000000';
    const strokeWidth = el.borderWidth || 0;
    const strokeDash = el.borderStyle === 'dashed' ? '6,6' : (el.borderStyle === 'dotted' ? '2,4' : 'none');

    switch (el.shapeType) {
      case 'rect':
      case 'square':
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={`calc(100% - ${strokeWidth}px)`}
            height={`calc(100% - ${strokeWidth}px)`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
          />
        );

      case 'rounded':
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={`calc(100% - ${strokeWidth}px)`}
            height={`calc(100% - ${strokeWidth}px)`}
            rx={el.cornerRadius || 16}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
          />
        );

      case 'circle':
      case 'ellipse':
        return (
          <ellipse
            cx="50%"
            cy="50%"
            rx={`calc(50% - ${strokeWidth / 2}px)`}
            ry={`calc(50% - ${strokeWidth / 2}px)`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
          />
        );

      case 'pill':
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={`calc(100% - ${strokeWidth}px)`}
            height={`calc(100% - ${strokeWidth}px)`}
            rx="999"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
          />
        );

      case 'line':
        return (
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke={fill}
            strokeWidth={Math.max(2, el.height || 4)}
            strokeDasharray={strokeDash}
          />
        );

      case 'vline':
        return (
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke={fill}
            strokeWidth={Math.max(2, el.width || 4)}
            strokeDasharray={strokeDash}
          />
        );

      case 'triangle':
        return (
          <polygon
            points="50,0 0,100 100,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'diamond':
        return (
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'star':
        return (
          <polygon
            points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'hexagon':
        return (
          <polygon
            points="25,0 75,0 100,50 75,100 25,100 0,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'pentagon':
        return (
          <polygon
            points="50,0 100,38 82,100 18,100 0,38"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'arrow':
        return (
          <polygon
            points="0,35 60,35 60,15 100,50 60,85 60,65 0,65"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'double_arrow':
        return (
          <polygon
            points="0,50 30,20 30,35 70,35 70,20 100,50 70,80 70,65 30,65 30,80"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'heart':
        return (
          <path
            d="M50,85 C20,60 0,40 0,22 C0,10 10,0 22,0 C32,0 44,8 50,18 C56,8 68,0 78,0 C90,0 100,10 100,22 C100,40 80,60 50,85 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'badge':
        return (
          <polygon
            points="0,0 100,0 100,75 50,100 0,75"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'burst':
        return (
          <polygon
            points="50,0 63,12 80,5 88,22 100,35 95,53 100,70 85,80 80,98 62,92 50,100 38,92 20,98 15,80 0,70 5,53 0,35 12,22 20,5 37,12"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'plus':
        return (
          <polygon
            points="35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'cross':
        return (
          <polygon
            points="20,0 50,30 80,0 100,20 70,50 100,80 80,100 50,70 20,100 0,80 30,50 0,20"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      default:
        return <rect width="100%" height="100%" fill={fill} />;
    }
  };

  // ── MASK CLIP-PATH HELPER ───────────────────────────────────────
  const getMaskClipPath = (maskShape) => {
    switch (maskShape) {
      case 'circle': return 'circle(50% at 50% 50%)';
      case 'rounded': return 'inset(0 round 16px)';
      case 'squircle': return 'inset(0 round 28px)';
      case 'hexagon': return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
      case 'pentagon': return 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
      case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
      case 'diamond': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'shield': return 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)';
      case 'heart': return 'path("M50,85 C20,60 0,40 0,22 C0,10 10,0 22,0 C32,0 44,8 50,18 C56,8 68,0 78,0 C90,0 100,10 100,22 C100,40 80,60 50,85 Z")';
      default: return 'none';
    }
  };

  // ── CANVAS ELEMENT INNER RENDERER ───────────────────────────────
  const renderElementInner = (el, page, pageNum, totalPages) => {
    const theme = THEME_COLORS.find(t => t.hex === catalogInfo.themeColor) || THEME_COLORS[0];

    switch (el.type) {
      case 'header':
        return (
          <div className="el-header-brand" style={{ borderBottom: `2px solid ${theme.hex}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {catalogInfo.logo ? (
                <img src={catalogInfo.logo} alt="Logo" style={{ height: 38, maxWidth: 120, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: theme.light, color: theme.hex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  {catalogInfo.businessName?.charAt(0)?.toUpperCase() || 'C'}
                </div>
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{catalogInfo.businessName}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.hex, textTransform: 'uppercase' }}>
                  {catalogInfo.primaryHeading || catalogInfo.catalogName}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10.5, color: '#64748b', lineHeight: 1.4 }}>
              {catalogInfo.businessPhone && <div>📞 {catalogInfo.businessPhone}</div>}
              {catalogInfo.email && <div>✉️ {catalogInfo.email}</div>}
            </div>
          </div>
        );

      case 'image':
        const clipPath = getMaskClipPath(el.maskShape);
        return (
          <div
            className="el-product-image-box"
            style={{
              clipPath,
              borderRadius: el.maskShape === 'rounded' ? `${el.maskRadius || 12}px` : (el.maskShape === 'rect' ? '8px' : '0'),
              border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || theme.hex}` : '1px solid #e2e8f0',
              boxShadow: el.shadow === 'lg' ? '0 10px 25px rgba(0,0,0,0.12)' : (el.shadow === 'md' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none')
            }}
          >
            {page.mainImage ? (
              <img
                src={page.mainImage}
                alt={page.name}
                className="el-product-img"
                style={{
                  objectFit: el.imageFit || 'cover',
                  transform: `scale(${(el.maskZoom || 100) / 100}) translate(${el.maskPanX || 0}px, ${el.maskPanY || 0}px)`
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                <span style={{ fontSize: 36 }}>🖼️</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Click to Upload Product Image</span>
              </div>
            )}
          </div>
        );

      case 'badge':
        return page.badgeText ? (
          <div className="el-badge" style={{ backgroundColor: theme.hex }}>
            {page.badgeText}
          </div>
        ) : null;

      case 'category':
        return (
          <div className="el-category-tag" style={{ color: theme.hex }}>
            {page.category || 'Category'} {page.sku ? `• SKU: ${page.sku}` : ''}
          </div>
        );

      case 'title':
        return (
          <div
            className="el-title"
            style={{
              fontSize: el.fontSize ? `${el.fontSize}px` : '22px',
              fontWeight: el.fontWeight || 800,
              color: el.textColor || '#0f172a'
            }}
          >
            {page.name || 'Product Name'}
          </div>
        );

      case 'price':
        const regular = parseFloat(page.regularPrice);
        const discount = parseFloat(page.discountPrice);
        const hasDisc = !isNaN(discount) && !isNaN(regular) && regular > discount;
        const discPercent = hasDisc ? Math.round(((regular - discount) / regular) * 100) : 0;

        return (
          <div className="el-price-box">
            {page.discountPrice ? (
              <>
                <span className="el-price-main" style={{ color: theme.hex }}>
                  {catalogInfo.currencySymbol}{Number(page.discountPrice).toLocaleString()}
                </span>
                {page.regularPrice && (
                  <span className="el-price-original">
                    {catalogInfo.currencySymbol}{Number(page.regularPrice).toLocaleString()}
                  </span>
                )}
                {discPercent > 0 && (
                  <span className="el-discount-pill">
                    {discPercent}% OFF
                  </span>
                )}
              </>
            ) : page.regularPrice ? (
              <span className="el-price-main" style={{ color: theme.hex }}>
                {catalogInfo.currencySymbol}{Number(page.regularPrice).toLocaleString()}
              </span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Price upon inquiry</span>
            )}
          </div>
        );

      case 'short_desc':
        return page.shortDescription ? (
          <div className="el-short-desc">
            {page.shortDescription}
          </div>
        ) : null;

      case 'full_desc':
        return page.description ? (
          <div className="el-full-desc">
            {page.description}
          </div>
        ) : null;

      case 'highlights':
        return page.features && page.features.length > 0 ? (
          <div className="el-card-box">
            <div className="el-card-heading">Key Highlights</div>
            {page.features.map((f, i) => f ? (
              <div key={i} className="el-bullet-item">
                <span style={{ color: theme.hex, fontWeight: 800 }}>✓</span>
                <span>{f}</span>
              </div>
            ) : null)}
          </div>
        ) : null;

      case 'specs':
        return page.specs && page.specs.length > 0 ? (
          <div className="el-card-box">
            <div className="el-card-heading">Technical Specifications</div>
            {page.specs.map((sp, i) => sp.key ? (
              <div key={i} className="el-spec-row">
                <span style={{ fontWeight: 600, color: '#64748b' }}>{sp.key}</span>
                <span style={{ color: '#0f172a', fontWeight: 500 }}>{sp.value || '—'}</span>
              </div>
            ) : null)}
          </div>
        ) : null;

      case 'cta':
        return (
          <div className="el-cta-card" style={{ background: theme.light, borderColor: theme.border }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#25d366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                💬
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.hex }}>
                  {page.ctaText || 'Direct Order & Inquiries on WhatsApp'}
                </div>
                <div style={{ fontSize: 11.5, color: '#047857', fontWeight: 600 }}>
                  WhatsApp: <strong>{page.whatsappNumber || catalogInfo.whatsappNumber || 'Available on request'}</strong>
                </div>
              </div>
            </div>
            <div style={{ background: theme.hex, color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 5, textTransform: 'uppercase' }}>
              ⚡ Instant Order
            </div>
          </div>
        );

      case 'footer':
        return (
          <div className="el-footer-box">
            <div>{catalogInfo.footerText || `${catalogInfo.businessName} • All Rights Reserved`}</div>
            <div style={{ fontWeight: 700 }}>Page {pageNum} of {totalPages}</div>
          </div>
        );

      case 'shape':
        return (
          <svg className="canvas-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {renderShapeSVG(el)}
          </svg>
        );

      case 'custom_text':
        return inlineEditingTextId === el.id ? (
          <textarea
            autoFocus
            className="cat-inline-textarea"
            value={el.text || ''}
            onChange={(e) => handleUpdateElement(el.id, { text: e.target.value })}
            onBlur={() => setInlineEditingTextId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setInlineEditingTextId(null);
            }}
            style={{
              fontFamily: el.fontFamily || 'inherit',
              fontSize: `${el.fontSize || 16}px`,
              fontWeight: el.fontWeight || 600,
              fontStyle: el.fontStyle || 'normal',
              textDecoration: el.textDecoration || 'none',
              color: el.textColor || '#0f172a',
              textAlign: el.textAlign || 'left',
              lineHeight: el.lineHeight || 1.3,
              letterSpacing: `${el.letterSpacing || 0}px`
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              setInlineEditingTextId(el.id);
            }}
            style={{
              fontFamily: el.fontFamily || 'inherit',
              fontSize: `${el.fontSize || 16}px`,
              fontWeight: el.fontWeight || 600,
              fontStyle: el.fontStyle || 'normal',
              textDecoration: el.textDecoration || 'none',
              color: el.textColor || '#0f172a',
              textAlign: el.textAlign || 'left',
              padding: `${el.padding || 4}px`,
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              backgroundColor: el.backgroundColor || 'transparent',
              borderColor: el.borderColor || '#0f172a',
              borderWidth: `${el.borderWidth || 0}px`,
              borderRadius: `${el.borderRadius || 0}px`,
              borderStyle: el.borderWidth ? 'solid' : 'none',
              lineHeight: el.lineHeight || 1.3,
              letterSpacing: `${el.letterSpacing || 0}px`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'hidden'
            }}
            title="Double-click to inline edit text"
          >
            {el.text}
          </div>
        );

      default:
        return null;
    }
  };

  // ── RENDER COMPLETE A4 CANVAS SHEET ─────────────────────────────
  const renderA4VisualSheet = (page, pageNum, totalPages, isHiddenExport = false) => {
    if (!page) return null;

    const bg = page.background || { type: 'solid', color: '#ffffff' };
    let bgStyle = {};

    if (bg.type === 'solid') {
      bgStyle.backgroundColor = bg.color || '#ffffff';
    } else if (bg.type === 'gradient') {
      const g = bg.gradient || { type: 'linear', angle: 135, color1: '#ffffff', color2: '#e8f5e9' };
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

    return (
      <div
        className="a4-sheet-container"
        ref={isHiddenExport ? null : canvasContainerRef}
        style={{
          transform: isHiddenExport ? 'none' : `scale(${zoomScale})`
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget || e.target.classList.contains('a4-bg-layer')) {
            setSelectedElementId(null);
            setInlineEditingTextId(null);
          }
        }}
      >
        {/* Background Layer */}
        <div className="a4-bg-layer" style={bgStyle} />

        {/* Snapping guidelines */}
        {!isHiddenExport && snappingGuides.x !== null && (
          <div className="a4-guide-line-v" style={{ left: `${snappingGuides.x}px` }} />
        )}
        {!isHiddenExport && snappingGuides.y !== null && (
          <div className="a4-guide-line-h" style={{ top: `${snappingGuides.y}px` }} />
        )}

        {/* Canvas Elements */}
        {(page.elements || []).map((el) => {
          const isSelected = !isHiddenExport && el.id === selectedElementId;

          return (
            <div
              key={el.id}
              className={`canvas-element ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
                zIndex: el.zIndex || 1,
                opacity: el.opacity ?? 1
              }}
              onMouseDown={(e) => !isHiddenExport && handleElementMouseDown(e, el)}
            >
              {/* Inner Component Content */}
              {renderElementInner(el, page, pageNum, totalPages)}

              {/* Selection Resize & Rotation Handles */}
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

  // ── VIEW: PROFESSIONAL CATALOG MANAGEMENT DASHBOARD ─────────────
  if (viewMode === 'history') {
    const isAdminUser = !user?.is_team_member && (user?.role === 'Admin' || user?.role === 'Super Admin' || user?.username === 'admin');

    // Live counts
    const myCount = isAdminUser ? savedCatalogs.filter(c => Number(c.user_id) === Number(user?.id)).length : savedCatalogs.length;
    const teamCount = isAdminUser ? savedCatalogs.filter(c => Number(c.user_id) !== Number(user?.id)).length : 0;
    const totalCount = isAdminUser ? (catalogStats.total || savedCatalogs.length) : savedCatalogs.length;
    const recentCount = catalogStats.recently_updated || savedCatalogs.filter(c => {
      const diff = (Date.now() - new Date(c.updated_at || c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;

    // Build filtered catalogs for current tab
    const tabCatalogs = savedCatalogs.filter(c => {
      if (isAdminUser) {
        if (catalogTab === 'my') return Number(c.user_id) === Number(user?.id);
        if (catalogTab === 'team') return Number(c.user_id) !== Number(user?.id);
      }
      return true;
    }).filter(c => {
      const q = historySearch.toLowerCase().trim();
      if (!q) return true;
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.business_name || '').toLowerCase().includes(q) ||
        (c.creator_name || '').toLowerCase().includes(q) ||
        (c.creator_username || '').toLowerCase().includes(q)
      );
    }).filter(c => {
      if (!filterStatus) return true;
      return (c.status || '').toLowerCase() === filterStatus.toLowerCase();
    }).filter(c => {
      if (!filterMemberId) return true;
      return Number(c.user_id) === Number(filterMemberId);
    });

    // Client-side instant sorting
    tabCatalogs.sort((a, b) => {
      if (sortBy === 'title') {
        const tA = (a.title || '').toLowerCase();
        const tB = (b.title || '').toLowerCase();
        return sortDir === 'asc' ? tA.localeCompare(tB) : tB.localeCompare(tA);
      }
      if (sortBy === 'created_at') {
        const dA = new Date(a.created_at || 0).getTime();
        const dB = new Date(b.created_at || 0).getTime();
        return sortDir === 'asc' ? dA - dB : dB - dA;
      }
      const dA = new Date(a.last_edited_at || a.updated_at || a.created_at || 0).getTime();
      const dB = new Date(b.last_edited_at || b.updated_at || b.created_at || 0).getTime();
      return sortDir === 'asc' ? dA - dB : dB - dA;
    });

    // Group team catalogs by member
    const teamGrouped = {};
    if (isAdminUser && catalogTab === 'team') {
      tabCatalogs.forEach(c => {
        const key = c.user_id;
        if (!teamGrouped[key]) {
          teamGrouped[key] = {
            userId: c.user_id,
            name: c.creator_name || 'Unknown',
            username: c.creator_username || '',
            role: c.creator_role || 'Staff',
            catalogs: []
          };
        }
        teamGrouped[key].catalogs.push(c);
      });
    }

    const fmtDate = (dt) => {
      if (!dt) return '—';
      return new Date(dt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    const renderCatalogCard = (c, showOwner = false) => (
      <div key={c.id} className="cm-catalog-card">
        {/* Thumbnail strip */}
        <div className="cm-card-thumb">
          {c.thumbnail ? (
            <img src={c.thumbnail} alt={c.title} className="cm-card-thumb-img" />
          ) : (
            <div className="cm-card-thumb-placeholder">📖</div>
          )}
          <span className="cm-card-page-badge">
            {c.page_count || 0} {Number(c.page_count) === 1 ? 'Page' : 'Pages'}
          </span>
          <span className={`cm-card-status-badge cm-status-${(c.status || 'draft').toLowerCase()}`}>
            {c.status || 'Draft'}
          </span>
        </div>

        {/* Info */}
        <div className="cm-card-body">
          <h3 className="cm-card-title" title={c.title}>{c.title || 'Untitled'}</h3>

          {showOwner && (
            <div className="cm-card-owner">
              <span className="cm-owner-avatar">{(c.creator_name || 'U')[0].toUpperCase()}</span>
              <span className="cm-owner-name">{c.creator_name || 'Unknown'}</span>
              {c.creator_username && <span className="cm-owner-username">@{c.creator_username}</span>}
            </div>
          )}

          <div className="cm-card-meta">
            <div className="cm-meta-row">
              <span className="cm-meta-label">Created</span>
              <span className="cm-meta-val">{fmtDate(c.created_at)}</span>
            </div>
            <div className="cm-meta-row">
              <span className="cm-meta-label">Last Edited</span>
              <span className="cm-meta-val">{fmtDate(c.last_edited_at || c.updated_at)}</span>
            </div>
            {c.last_editor_name && c.last_editor_name !== c.creator_name && (
              <div className="cm-meta-row">
                <span className="cm-meta-label">Edited by</span>
                <span className="cm-meta-val cm-edited-by">{c.last_editor_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="cm-card-actions">
          <button
            type="button"
            className="cm-action-btn cm-btn-edit"
            onClick={() => handleOpenCatalog(c.id)}
            title="Edit Catalog"
          >
            ✏️ Edit
          </button>
          {canDownload && (
            <button
              type="button"
              className="cm-action-btn cm-btn-preview"
              onClick={() => handleOpenCatalog(c.id)}
              title="Preview & Download PDF"
            >
              📄 PDF
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              className="cm-action-btn cm-btn-dup"
              onClick={(e) => handleDuplicateCatalogInDb(c.id, e)}
              title="Duplicate Catalog"
            >
              📋
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="cm-action-btn cm-btn-del"
              onClick={(e) => handleDeleteCatalogFromDb(c.id, e)}
              title="Delete Catalog"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    );

    // Access denied state
    if (catalogAccessDenied) {
      return (
        <div className="catalog-container cm-access-denied-wrap">
          <div className="cm-access-denied">
            <div className="cm-access-denied-icon">🚫</div>
            <h2>Access Removed</h2>
            <p>You no longer have permission to access the Catalog module.<br/>Please contact your administrator.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="catalog-container cm-management-wrap">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="cm-header">
          <div className="cm-header-left">
            <div className="cm-header-icon">📚</div>
            <div>
              <h1 className="cm-header-title">
                {isAdminUser ? 'Catalog Management' : 'My Catalogs'}
              </h1>
              <p className="cm-header-sub">
                {isAdminUser
                  ? 'Manage your catalogs and team member catalogs from one place.'
                  : 'Create, edit, and download your professional product catalogs.'}
              </p>
            </div>
          </div>

          <div className="cm-header-right">
            {pages.length > 0 && (
              <button type="button" className="cm-btn-secondary" onClick={() => setViewMode('editor')}>
                ← Back to Editor
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                className="cm-btn-create"
                onClick={handleCreateNewCatalog}
              >
                ✚ Create Catalog
              </button>
            )}
          </div>
        </div>

        {/* ── STATS ROW (Admin only) ──────────────────── */}
        {isAdminUser && (
          <div className="cm-stats-row">
            <div className="cm-stat-card cm-stat-total">
              <div className="cm-stat-num">{totalCount}</div>
              <div className="cm-stat-label">Total Catalogs</div>
            </div>
            <div className="cm-stat-card cm-stat-mine">
              <div className="cm-stat-num">{myCount}</div>
              <div className="cm-stat-label">My Catalogs</div>
            </div>
            <div className="cm-stat-card cm-stat-team">
              <div className="cm-stat-num">{teamCount}</div>
              <div className="cm-stat-label">Team Catalogs</div>
            </div>
            <div className="cm-stat-card cm-stat-recent">
              <div className="cm-stat-num">{recentCount}</div>
              <div className="cm-stat-label">Updated This Week</div>
            </div>
          </div>
        )}

        {/* ── TABS (Admin only) ───────────────────────── */}
        {isAdminUser && (
          <div className="cm-tabs-row">
            <button
              type="button"
              className={`cm-tab-btn ${catalogTab === 'my' ? 'cm-tab-active' : ''}`}
              onClick={() => { setCatalogTab('my'); setFilterMemberId(''); }}
            >
              <span>🗂️</span> My Catalogs
              <span className="cm-tab-count">{myCount}</span>
            </button>
            <button
              type="button"
              className={`cm-tab-btn ${catalogTab === 'team' ? 'cm-tab-active' : ''}`}
              onClick={() => { setCatalogTab('team'); setFilterMemberId(''); }}
            >
              <span>👥</span> Team Member Catalogs
              <span className="cm-tab-count">{teamCount}</span>
            </button>
          </div>
        )}

        {/* ── FILTERS BAR ─────────────────────────────────────── */}
        <div className="cm-filters-bar">
          <div className="cm-search-wrap">
            <span className="cm-search-icon">🔍</span>
            <input
              type="text"
              placeholder={isAdminUser && catalogTab === 'team'
                ? 'Search by catalog name or member name...'
                : 'Search catalogs...'}
              className="cm-search-input"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
            {historySearch && (
              <button type="button" className="cm-search-clear" onClick={() => setHistorySearch('')}>✕</button>
            )}
          </div>

          <div className="cm-filter-controls">
            <select
              className="cm-filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Ready">Ready</option>
              <option value="Published">Published</option>
            </select>

            <select
              className="cm-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="updated_at">Recently Updated</option>
              <option value="created_at">Recently Created</option>
              <option value="title">Name A–Z</option>
            </select>

            <button
              type="button"
              className="cm-sort-dir-btn"
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
            >
              {sortDir === 'desc' ? '↓' : '↑'}
            </button>

            <button
              type="button"
              className="cm-refresh-btn"
              onClick={fetchSavedCatalogs}
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────── */}
        {loadingCatalogs ? (
          <div className="cm-loading-state">
            <div className="cm-loading-spinner" />
            <div className="cm-loading-text">Loading catalogs...</div>
          </div>
        ) : tabCatalogs.length === 0 ? (
          <div className="cm-empty-state">
            <div className="cm-empty-icon">
              {catalogTab === 'team' ? '👥' : '📂'}
            </div>
            <h3 className="cm-empty-title">
              {historySearch
                ? 'No catalogs match your search'
                : catalogTab === 'team'
                  ? 'No team member catalogs yet'
                  : 'No catalogs yet'}
            </h3>
            <p className="cm-empty-sub">
              {historySearch
                ? 'Try a different search term or clear filters.'
                : catalogTab === 'team'
                  ? 'Team members have not created any catalogs yet.'
                  : 'Create your first professional product catalog.'}
            </p>
            {!historySearch && catalogTab !== 'team' && canCreate && (
              <button
                type="button"
                className="cm-btn-create"
                onClick={handleCreateNewCatalog}
              >
                ✚ Create Your First Catalog
              </button>
            )}
          </div>
        ) : isAdminUser && catalogTab === 'team' ? (
          // ── TEAM MEMBER GROUPED VIEW ─────────────────────
          <div className="cm-team-sections">
            {Object.values(teamGrouped).map(member => (
              <div key={member.userId} className="cm-member-section">
                <div className="cm-member-header">
                  <div className="cm-member-avatar">
                    {(member.name || 'U')[0].toUpperCase()}
                  </div>
                  <div className="cm-member-info">
                    <span className="cm-member-name">{member.name}</span>
                    {member.username && (
                      <span className="cm-member-username">@{member.username}</span>
                    )}
                    <span className="cm-member-role-badge">{member.role}</span>
                  </div>
                  <span className="cm-member-catalog-count">
                    {member.catalogs.length} {member.catalogs.length === 1 ? 'catalog' : 'catalogs'}
                  </span>
                </div>
                <div className="cm-cards-grid">
                  {member.catalogs.map(c => renderCatalogCard(c, false))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // ── REGULAR GRID VIEW ────────────────────────────
          <div className="cm-cards-grid">
            {tabCatalogs.map(c => renderCatalogCard(c, false))}
          </div>
        )}

        {/* Basic Details Modal */}
        {showBasicDetailsModal && renderBasicDetailsModal()}
      </div>
    );
  }

  // If in editor mode but pages is empty, ensure at least one page is initialized
  if (viewMode === 'editor' && (!isBuilderActive || pages.length === 0)) {
    const userKey = user?.id || 'default';
    const firstPage = {
      id: 'page-' + Date.now() + '-1',
      name: 'Product Page 1',
      sku: 'SKU-001',
      category: 'General',
      regularPrice: '',
      discountPrice: '',
      badgeText: 'NEW',
      shortDescription: '',
      description: '',
      features: ['100% Quality Guaranteed', 'Fast Dispatch within 24 Hours'],
      specs: [{ key: 'Condition', value: 'Brand New' }],
      whatsappNumber: user?.mobile || '',
      phone: user?.mobile || '',
      website: '',
      ctaText: 'Order via WhatsApp',
      mainImage: '',
      background: {
        type: 'solid',
        color: '#ffffff',
        gradient: { type: 'linear', angle: 135, color1: '#ffffff', color2: '#f0fdf4' },
        image: '',
        imageFit: 'cover',
        imageOpacity: 1
      },
      elements: []
    };
    firstPage.elements = createDefaultElementsForProduct(firstPage, 0, 1, catalogInfo.themeColor, catalogInfo.currencySymbol);
    setPages([firstPage]);
    setIsBuilderActive(true);
  }

  // ── RENDER: BASIC DETAILS MODAL ─────────────────────────────────
  function renderBasicDetailsModal() {
    return (
      <div className="cat-modal-overlay">
        <div className="cat-modal">
          <div className="cat-modal-header">
            <h2 className="cat-modal-title">⚙️ Catalog & Business Details</h2>
            <button type="button" className="cat-icon-btn" onClick={() => setShowBasicDetailsModal(false)}>✕</button>
          </div>

          <form onSubmit={handleBasicDetailsSubmit}>
            <div className="cat-modal-body">
              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>Catalog Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Collection 2026"
                    className="cat-input"
                    value={catalogInfo.catalogName}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, catalogName: e.target.value })}
                  />
                </div>
                <div className="cat-form-group">
                  <label>Business / Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UV Digital Solutions"
                    className="cat-input"
                    value={catalogInfo.businessName}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, businessName: e.target.value })}
                  />
                </div>
              </div>

              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    className="cat-input"
                    value={catalogInfo.whatsappNumber}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, whatsappNumber: e.target.value })}
                  />
                </div>
                <div className="cat-form-group">
                  <label>Business Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    className="cat-input"
                    value={catalogInfo.businessPhone}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, businessPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="sales@mycompany.com"
                    className="cat-input"
                    value={catalogInfo.email}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, email: e.target.value })}
                  />
                </div>
                <div className="cat-form-group">
                  <label>Website</label>
                  <input
                    type="text"
                    placeholder="www.mycompany.com"
                    className="cat-input"
                    value={catalogInfo.website}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, website: e.target.value })}
                  />
                </div>
              </div>

              <div className="cat-form-group">
                <label>Business Logo Upload</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {catalogInfo.logo && (
                    <img src={catalogInfo.logo} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="cat-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePersistentImageUpload(file, (url) => setCatalogInfo({ ...catalogInfo, logo: url }));
                    }}
                  />
                  {catalogInfo.logo && (
                    <button type="button" className="cat-btn cat-btn-danger-outline" onClick={() => setCatalogInfo({ ...catalogInfo, logo: '' })}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>Primary Heading / Subtitle</label>
                  <input
                    type="text"
                    placeholder="e.g. Official Product Catalog"
                    className="cat-input"
                    value={catalogInfo.primaryHeading}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, primaryHeading: e.target.value })}
                  />
                </div>

                <div className="cat-form-group">
                  <label>Currency Symbol</label>
                  <select
                    className="cat-select"
                    value={catalogInfo.currencySymbol}
                    onChange={(e) => setCatalogInfo({ ...catalogInfo, currencySymbol: e.target.value })}
                  >
                    <option value="₹">₹ (INR)</option>
                    <option value="$">$ (USD)</option>
                    <option value="€">€ (EUR)</option>
                    <option value="£">£ (GBP)</option>
                    <option value="AED">AED</option>
                    <option value="SAR">SAR</option>
                  </select>
                </div>
              </div>

              <div className="cat-form-group">
                <label>Brand Theme Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {THEME_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setCatalogInfo({ ...catalogInfo, themeColor: c.hex })}
                      style={{
                        backgroundColor: c.hex,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: catalogInfo.themeColor === c.hex ? '3px solid #0f172a' : '2px solid #ffffff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        cursor: 'pointer'
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn-secondary" onClick={() => setShowBasicDetailsModal(false)}>
                Cancel
              </button>
              <button type="submit" className="cat-btn cat-btn-success">
                Save Details
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── RENDER: ADD NEW PRODUCT PAGE MODAL ──────────────────────────
  function renderAddProductModal() {
    return (
      <div className="cat-modal-overlay">
        <div className="cat-modal" style={{ width: 680 }}>
          <div className="cat-modal-header">
            <h2 className="cat-modal-title">➕ Add Product Page</h2>
            <button type="button" className="cat-icon-btn" onClick={() => setShowAddProductModal(false)}>✕</button>
          </div>

          <form onSubmit={handleCreateProductPageSubmit}>
            <div className="cat-modal-body">
              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wireless Headphones"
                    className="cat-input"
                    value={newPageForm.name}
                    onChange={(e) => setNewPageForm({ ...newPageForm, name: e.target.value })}
                  />
                </div>
                <div className="cat-form-group">
                  <label>Product Code / SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. AUDIO-HP-001"
                    className="cat-input"
                    value={newPageForm.sku}
                    onChange={(e) => setNewPageForm({ ...newPageForm, sku: e.target.value })}
                  />
                </div>
              </div>

              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Electronics, Fashion"
                    className="cat-input"
                    value={newPageForm.category}
                    onChange={(e) => setNewPageForm({ ...newPageForm, category: e.target.value })}
                  />
                </div>
                <div className="cat-form-group">
                  <label>Badge / Ribbon Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. BESTSELLER, 40% OFF"
                    className="cat-input"
                    value={newPageForm.badgeText}
                    onChange={(e) => setNewPageForm({ ...newPageForm, badgeText: e.target.value })}
                  />
                </div>
              </div>

              <div className="cat-grid-2">
                <div className="cat-form-group">
                  <label>Regular Price ({catalogInfo.currencySymbol})</label>
                  <input
                    type="number"
                    placeholder="e.g. 4999"
                    className="cat-input"
                    value={newPageForm.regularPrice}
                    onChange={(e) => setNewPageForm({ ...newPageForm, regularPrice: e.target.value })}
                  />
                </div>
                <div className="cat-form-group">
                  <label>Discount Price ({catalogInfo.currencySymbol})</label>
                  <input
                    type="number"
                    placeholder="e.g. 2999"
                    className="cat-input"
                    value={newPageForm.discountPrice}
                    onChange={(e) => setNewPageForm({ ...newPageForm, discountPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="cat-form-group">
                <label>Main Product Image Upload</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {newPageForm.mainImage && (
                    <img src={newPageForm.mainImage} alt="Preview" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="cat-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePersistentImageUpload(file, (url) => setNewPageForm({ ...newPageForm, mainImage: url }));
                    }}
                  />
                </div>
              </div>

              <div className="cat-form-group">
                <label>Short Description (Lead)</label>
                <input
                  type="text"
                  placeholder="Key highlight or one-sentence pitch"
                  className="cat-input"
                  value={newPageForm.shortDescription}
                  onChange={(e) => setNewPageForm({ ...newPageForm, shortDescription: e.target.value })}
                />
              </div>

              <div className="cat-form-group">
                <label>Detailed Description</label>
                <textarea
                  placeholder="Product specifications, materials, warranty, benefits..."
                  className="cat-textarea"
                  value={newPageForm.description}
                  onChange={(e) => setNewPageForm({ ...newPageForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn-secondary" onClick={() => setShowAddProductModal(false)}>
                Cancel
              </button>
              <button type="submit" className="cat-btn cat-btn-success">
                Create Page
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── RENDER: PREVIEW CATALOG MODAL ───────────────────────────────
  function renderPreviewModal() {
    const previewPage = pages[previewPageIndex] || pages[0];

    return (
      <div className="cat-modal-overlay">
        <div className="cat-modal cat-preview-modal">
          <div className="cat-modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 className="cat-modal-title">👁️ Multi-Page Catalog Preview</h2>
              <span className="catalog-badge-pages">
                Page {previewPageIndex + 1} of {pages.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {canDownload && (
                <button
                  type="button"
                  className="cat-btn cat-btn-primary"
                  onClick={handleDownloadPDF}
                >
                  📥 Download PDF
                </button>
              )}
              <button type="button" className="cat-icon-btn" onClick={() => setShowPreviewModal(false)}>✕</button>
            </div>
          </div>

          <div className="cat-preview-body">
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center', marginBottom: 20 }}>
              {renderA4VisualSheet(previewPage, previewPageIndex + 1, pages.length, true)}
            </div>
          </div>

          <div className="cat-modal-footer" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              disabled={previewPageIndex <= 0}
              onClick={() => setPreviewPageIndex(p => Math.max(0, p - 1))}
            >
              ← Previous Page
            </button>

            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              {previewPage?.name}
            </span>

            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              disabled={previewPageIndex >= pages.length - 1}
              onClick={() => setPreviewPageIndex(p => Math.min(pages.length - 1, p + 1))}
            >
              Next Page →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN BUILDER INTERFACE (CANVA VISUAL EDITOR) ───────────────
  return (
    <div className="catalog-container">
      {/* Top Main Toolbar */}
      <div className="catalog-topbar">
        <div className="catalog-topbar-left">
          <button
            type="button"
            className="cat-btn cat-btn-secondary"
            onClick={() => {
              triggerSave();
              setViewMode('history');
            }}
            style={{ padding: '6px 12px', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Back to My Catalogs"
          >
            ← Back
          </button>
          <div className="catalog-icon-badge">📖</div>
          <div className="catalog-title-group">
            <h1 className="catalog-topbar-title">
              {catalogInfo.catalogName}
              <span className="catalog-badge-pages">{pages.length} {pages.length === 1 ? 'Page' : 'Pages'}</span>
            </h1>
            <p className="catalog-topbar-subtitle">
              {catalogInfo.businessName} • Canva-Style Visual Editor
            </p>
          </div>
        </div>

        {/* Center Canvas Tools (Undo, Redo, Zoom, Auto-save status) */}
        <div className="catalog-topbar-center">
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
            className="cat-btn cat-btn-secondary"
            style={{ padding: '2px 6px', fontSize: 11 }}
            onClick={() => setZoomScale(1)}
          >
            100%
          </button>

          {/* Auto-Save Indicator */}
          <span style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 4px' }} />
          <div className="catalog-autosave-indicator">
            {saveStatus === 'saving' && <span className="save-tag saving">💾 Saving...</span>}
            {saveStatus === 'saved' && <span className="save-tag saved">✓ Saved {lastSavedTime ? `at ${lastSavedTime}` : ''}</span>}
            {saveStatus === 'error' && (
              <span className="save-tag error" onClick={() => triggerSave()} title="Click to Retry Save">
                ⚠️ Save Failed (Retry)
              </span>
            )}
          </div>
        </div>

        {/* Right Topbar Actions */}
        <div className="catalog-topbar-actions">
          {canEdit && (
            <button
              type="button"
              className="cat-btn cat-btn-success"
              onClick={() => triggerSave()}
              disabled={saveStatus === 'saving'}
              style={{ fontWeight: 700, padding: '7px 15px' }}
              title="Save changes to database"
            >
              💾 {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          )}

          <button
            type="button"
            className="cat-btn cat-btn-secondary"
            onClick={() => setViewMode('history')}
            title="View saved catalogs"
          >
            📁 My Catalogs
          </button>

          <button
            type="button"
            className="cat-btn cat-btn-secondary"
            onClick={() => setShowBasicDetailsModal(true)}
          >
            ⚙️ Details
          </button>

          {canCreate && (
            <button
              type="button"
              className="cat-btn cat-btn-success"
              onClick={handleAddDirectBlankPage}
              title="Add a new blank page directly"
            >
              ➕ Add Page
            </button>
          )}

          <button
            type="button"
            className="cat-btn cat-btn-secondary"
            onClick={() => {
              setPreviewPageIndex(activePageIndex);
              setShowPreviewModal(true);
            }}
          >
            👁️ Preview
          </button>

          {canDownload && (
            <button
              type="button"
              className="cat-btn cat-btn-primary"
              onClick={handleDownloadPDF}
              disabled={pdfState.exporting}
            >
              📥 {pdfState.exporting ? 'Exporting...' : 'Download PDF'}
            </button>
          )}

          <button
            type="button"
            className="cat-btn cat-btn-danger-outline"
            onClick={() => setShowClearConfirmModal(true)}
            title="Clear Catalog and reset"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 3-Column Workspace */}
      <div
        className="catalog-workspace"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
      >
        {/* Left Column: Pages List Strip */}
        <div className="catalog-pages-panel">
          <div className="catalog-panel-header">
            <h3 className="catalog-panel-title">📑 Pages ({pages.length})</h3>
            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={handleAddDirectBlankPage}
            >
              + Add
            </button>
          </div>

          <div className="catalog-pages-list">
            {pages.map((p, idx) => {
              const isActive = idx === activePageIndex;
              return (
                <div
                  key={p.id}
                  className={`catalog-page-card ${isActive ? 'catalog-page-card--active' : ''}`}
                  onClick={() => {
                    setActivePageIndex(idx);
                    setSelectedElementId(null);
                    setInlineEditingTextId(null);
                  }}
                >
                  <div className="catalog-page-card-top">
                    <span className="catalog-page-number">Page {idx + 1}</span>

                    <div className="catalog-page-card-actions">
                      <button
                        type="button"
                        className="cat-icon-btn"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = [...pages];
                          const [moved] = updated.splice(idx, 1);
                          updated.splice(idx - 1, 0, moved);
                          setPages(updated);
                          setActivePageIndex(idx - 1);
                          pushHistory(updated);
                        }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn"
                        disabled={idx === pages.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = [...pages];
                          const [moved] = updated.splice(idx, 1);
                          updated.splice(idx + 1, 0, moved);
                          setPages(updated);
                          setActivePageIndex(idx + 1);
                          pushHistory(updated);
                        }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const cloned = JSON.parse(JSON.stringify(p));
                          cloned.id = 'page-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
                          cloned.name = `${p.name} (Copy)`;
                          const updated = [...pages];
                          updated.splice(idx + 1, 0, cloned);
                          setPages(updated);
                          setActivePageIndex(idx + 1);
                          pushHistory(updated);
                        }}
                        title="Duplicate Page"
                      >
                        📋
                      </button>
                      {pages.length > 1 && (
                        <button
                          type="button"
                          className="cat-icon-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPageToDeleteIndex(idx);
                            setShowDeleteConfirmModal(true);
                          }}
                          title="Delete Page"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="catalog-page-thumb-box">
                    {p.mainImage ? (
                      <img src={p.mainImage} alt={p.name} className="catalog-page-thumb-img" />
                    ) : (
                      <div className="catalog-page-thumb-placeholder">📄</div>
                    )}
                  </div>

                  <div className="catalog-page-card-info">
                    <span className="catalog-page-card-name" title={p.name}>{p.name || 'Untitled Page'}</span>
                    <span className="catalog-page-card-price">
                      {p.discountPrice ? `${catalogInfo.currencySymbol}${Number(p.discountPrice).toLocaleString()}` : (p.regularPrice ? `${catalogInfo.currencySymbol}${Number(p.regularPrice).toLocaleString()}` : '—')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="catalog-pages-footer" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className="cat-btn cat-btn-success"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleAddDirectBlankPage}
            >
              ➕ Add Blank Page
            </button>
            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 11.5 }}
              onClick={() => setShowAddProductModal(true)}
            >
              📦 Add Product Page Form
            </button>
          </div>
        </div>

        {/* Center Column: Canva Visual Editor Canvas */}
        <div className="catalog-canvas-area">
          {/* Quick Floating Action Tools */}
          <div className="catalog-floating-toolbar">
            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => handleAddCustomText()}
            >
              🔤 Add Text Box
            </button>

            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => {
                setActivePropTab('shapes');
              }}
            >
              🔷 Add Shape
            </button>

            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => {
                setActivePropTab('background');
              }}
            >
              🎨 Background
            </button>

            {selectedElement && (
              <>
                <span style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 4px' }} />
                <button
                  type="button"
                  className="cat-btn cat-btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11.5 }}
                  onClick={handleDuplicateSelectedElement}
                  title="Duplicate Selected Element (Ctrl+D)"
                >
                  📋 Clone
                </button>
                <button
                  type="button"
                  className="cat-btn cat-btn-danger-outline"
                  style={{ padding: '4px 8px', fontSize: 11.5 }}
                  onClick={handleDeleteSelectedElement}
                  title="Delete Element (Delete)"
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>

          {/* Render Interactive A4 Visual Sheet */}
          {renderA4VisualSheet(activePage, activePageIndex + 1, pages.length)}
        </div>

        {/* Right Column: Visual Properties & Inspector Panel */}
        <div className="catalog-props-panel">
          {/* Tabs */}
          <div className="catalog-props-tabs">
            <button
              type="button"
              className={`catalog-props-tab ${activePropTab === 'product' ? 'catalog-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('product')}
            >
              Product
            </button>
            <button
              type="button"
              className={`catalog-props-tab ${activePropTab === 'canvas' ? 'catalog-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('canvas')}
            >
              Inspector
            </button>
            <button
              type="button"
              className={`catalog-props-tab ${activePropTab === 'shapes' ? 'catalog-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('shapes')}
            >
              Shapes
            </button>
            <button
              type="button"
              className={`catalog-props-tab ${activePropTab === 'background' ? 'catalog-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('background')}
            >
              Background
            </button>
            <button
              type="button"
              className={`catalog-props-tab ${activePropTab === 'layers' ? 'catalog-props-tab--active' : ''}`}
              onClick={() => setActivePropTab('layers')}
            >
              Layers
            </button>
          </div>

          <div className="catalog-props-body">
            {/* ── TAB 1: PRODUCT DETAILS ── */}
            {activePropTab === 'product' && activePage && (
              <>
                <div className="cat-form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    className="cat-input"
                    value={activePage.name || ''}
                    onChange={(e) => handleUpdateActivePageField('name', e.target.value)}
                  />
                </div>

                <div className="cat-grid-2">
                  <div className="cat-form-group">
                    <label>SKU / Code</label>
                    <input
                      type="text"
                      className="cat-input"
                      value={activePage.sku || ''}
                      onChange={(e) => handleUpdateActivePageField('sku', e.target.value)}
                    />
                  </div>
                  <div className="cat-form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      className="cat-input"
                      value={activePage.category || ''}
                      onChange={(e) => handleUpdateActivePageField('category', e.target.value)}
                    />
                  </div>
                </div>

                <div className="cat-grid-2">
                  <div className="cat-form-group">
                    <label>Regular Price ({catalogInfo.currencySymbol})</label>
                    <input
                      type="number"
                      className="cat-input"
                      value={activePage.regularPrice || ''}
                      onChange={(e) => handleUpdateActivePageField('regularPrice', e.target.value)}
                    />
                  </div>
                  <div className="cat-form-group">
                    <label>Discount Price ({catalogInfo.currencySymbol})</label>
                    <input
                      type="number"
                      className="cat-input"
                      value={activePage.discountPrice || ''}
                      onChange={(e) => handleUpdateActivePageField('discountPrice', e.target.value)}
                    />
                  </div>
                </div>

                <div className="cat-form-group">
                  <label>Badge / Ribbon Text</label>
                  <input
                    type="text"
                    className="cat-input"
                    placeholder="e.g. BESTSELLER"
                    value={activePage.badgeText || ''}
                    onChange={(e) => handleUpdateActivePageField('badgeText', e.target.value)}
                  />
                </div>

                <div className="cat-form-group">
                  <label>Product Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="cat-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePersistentImageUpload(file, (url) => handleUpdateActivePageField('mainImage', url));
                    }}
                  />
                  {activePage.mainImage && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <img src={activePage.mainImage} alt="Main" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                      <button
                        type="button"
                        className="cat-btn cat-btn-danger-outline"
                        style={{ padding: '2px 8px', fontSize: 10, alignSelf: 'center' }}
                        onClick={() => handleUpdateActivePageField('mainImage', '')}
                      >
                        Remove Image
                      </button>
                    </div>
                  )}
                </div>

                <div className="cat-form-group">
                  <label>Short Description (Lead)</label>
                  <input
                    type="text"
                    className="cat-input"
                    value={activePage.shortDescription || ''}
                    onChange={(e) => handleUpdateActivePageField('shortDescription', e.target.value)}
                  />
                </div>

                <div className="cat-form-group">
                  <label>Detailed Description</label>
                  <textarea
                    className="cat-textarea"
                    rows="3"
                    value={activePage.description || ''}
                    onChange={(e) => handleUpdateActivePageField('description', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ── TAB 2: SELECTED ELEMENT INSPECTOR ── */}
            {activePropTab === 'canvas' && (
              <>
                {selectedElement ? (
                  <>
                    <div className="cat-panel-section">
                      <div className="cat-panel-section-title">
                        <span>Selected: {selectedElement.type?.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>ID: {selectedElement.id.slice(-6)}</span>
                      </div>

                      {/* Precise Coordinate & Dimension Inputs (LIVE TWO-WAY SYNC) */}
                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>X Position (px)</label>
                          <input
                            type="number"
                            className="cat-input"
                            value={selectedElement.x ?? 0}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { x: parseInt(e.target.value, 10) || 0 })}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Y Position (px)</label>
                          <input
                            type="number"
                            className="cat-input"
                            value={selectedElement.y ?? 0}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { y: parseInt(e.target.value, 10) || 0 })}
                          />
                        </div>
                      </div>

                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>Width (px)</label>
                          <input
                            type="number"
                            min="10"
                            className="cat-input"
                            value={selectedElement.width ?? 100}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { width: Math.max(10, parseInt(e.target.value, 10) || 10) })}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Height (px)</label>
                          <input
                            type="number"
                            min="10"
                            className="cat-input"
                            value={selectedElement.height ?? 50}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { height: Math.max(10, parseInt(e.target.value, 10) || 10) })}
                          />
                        </div>
                      </div>

                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>Rotation ({selectedElement.rotation || 0}°)</label>
                          <input
                            type="number"
                            min="0"
                            max="360"
                            className="cat-input"
                            value={selectedElement.rotation || 0}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { rotation: parseInt(e.target.value, 10) || 0 })}
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

                    {/* CUSTOM TEXT ELEMENT CONTROLS */}
                    {selectedElement.type === 'custom_text' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>🔤 Text Content & Typography</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Text Content</label>
                          <textarea
                            rows="3"
                            className="cat-textarea"
                            value={selectedElement.text || ''}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { text: e.target.value })}
                            placeholder="Type your text here..."
                          />
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Font Family</label>
                            <select
                              className="cat-select"
                              value={selectedElement.fontFamily || "'Inter', sans-serif"}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { fontFamily: e.target.value })}
                            >
                              {FONT_FAMILIES.map(f => (
                                <option key={f.value} value={f.value}>{f.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="cat-form-group">
                            <label>Font Size ({selectedElement.fontSize || 16}px)</label>
                            <input
                              type="range"
                              min="8"
                              max="72"
                              value={selectedElement.fontSize || 16}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                            />
                          </div>
                        </div>

                        {/* Text Styling: Bold, Italic, Underline, Alignment */}
                        <div className="cat-grid-2" style={{ alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className={`cat-icon-btn ${selectedElement.fontWeight >= 700 ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight >= 700 ? 400 : 700 })}
                              title="Bold"
                            >
                              <strong>B</strong>
                            </button>
                            <button
                              type="button"
                              className={`cat-icon-btn ${selectedElement.fontStyle === 'italic' ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}
                              title="Italic"
                            >
                              <em>I</em>
                            </button>
                            <button
                              type="button"
                              className={`cat-icon-btn ${selectedElement.textDecoration === 'underline' ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })}
                              title="Underline"
                            >
                              <u>U</u>
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className={`cat-icon-btn ${selectedElement.textAlign === 'left' ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { textAlign: 'left' })}
                              title="Align Left"
                            >
                              ⇤
                            </button>
                            <button
                              type="button"
                              className={`cat-icon-btn ${selectedElement.textAlign === 'center' ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { textAlign: 'center' })}
                              title="Align Center"
                            >
                              ≡
                            </button>
                            <button
                              type="button"
                              className={`cat-icon-btn ${selectedElement.textAlign === 'right' ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { textAlign: 'right' })}
                              title="Align Right"
                            >
                              ⇥
                            </button>
                          </div>
                        </div>

                        <div className="cat-grid-2" style={{ marginTop: 8 }}>
                          <div className="cat-form-group">
                            <label>Text Color</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="color"
                                value={selectedElement.textColor || '#0f172a'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { textColor: e.target.value })}
                                style={{ width: 34, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                className="cat-input"
                                value={selectedElement.textColor || '#0f172a'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { textColor: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="cat-form-group">
                            <label>Background Color</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="color"
                                value={selectedElement.backgroundColor === 'transparent' ? '#ffffff' : (selectedElement.backgroundColor || '#ffffff')}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { backgroundColor: e.target.value })}
                                style={{ width: 34, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              />
                              <button
                                type="button"
                                className="cat-btn cat-btn-secondary"
                                style={{ fontSize: 10, padding: '2px 6px' }}
                                onClick={() => handleUpdateElement(selectedElement.id, { backgroundColor: 'transparent' })}
                              >
                                None
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SHAPE SPECIFIC CONTROLS */}
                    {selectedElement.type === 'shape' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>🔷 Shape Properties</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Shape Type</label>
                          <select
                            className="cat-select"
                            value={selectedElement.shapeType || 'rect'}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { shapeType: e.target.value })}
                          >
                            {SHAPE_TEMPLATES.map(s => (
                              <option key={s.shapeType} value={s.shapeType}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Fill Color</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="color"
                                value={selectedElement.fillColor || '#059669'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { fillColor: e.target.value })}
                                style={{ width: 34, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                className="cat-input"
                                value={selectedElement.fillColor || '#059669'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { fillColor: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="cat-form-group">
                            <label>Border Color</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="color"
                                value={selectedElement.borderColor || '#0f172a'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { borderColor: e.target.value })}
                                style={{ width: 34, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                className="cat-input"
                                value={selectedElement.borderColor || '#0f172a'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { borderColor: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="cat-grid-2">
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

                          <div className="cat-form-group">
                            <label>Border Style</label>
                            <select
                              className="cat-select"
                              value={selectedElement.borderStyle || 'solid'}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { borderStyle: e.target.value })}
                            >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PRODUCT IMAGE MASKING SECTION */}
                    {selectedElement.type === 'image' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>🔷 Image Shape Mask & Framing</span>
                        </div>

                        <div className="cat-grid-2">
                          {MASK_SHAPES.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              className={`mask-picker-btn ${selectedElement.maskShape === m.id ? 'active' : ''}`}
                              onClick={() => handleUpdateElement(selectedElement.id, { maskShape: m.id })}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>

                        <div className="cat-form-group" style={{ marginTop: 8 }}>
                          <label>Zoom Inside Mask: {selectedElement.maskZoom || 100}%</label>
                          <input
                            type="range"
                            min="50"
                            max="250"
                            value={selectedElement.maskZoom || 100}
                            onChange={(e) => handleUpdateElement(selectedElement.id, { maskZoom: parseInt(e.target.value, 10) })}
                          />
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Pan X: {selectedElement.maskPanX || 0}px</label>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={selectedElement.maskPanX || 0}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { maskPanX: parseInt(e.target.value, 10) })}
                            />
                          </div>
                          <div className="cat-form-group">
                            <label>Pan Y: {selectedElement.maskPanY || 0}px</label>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={selectedElement.maskPanY || 0}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { maskPanY: parseInt(e.target.value, 10) })}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="cat-btn cat-btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleUpdateElement(selectedElement.id, { maskZoom: 100, maskPanX: 0, maskPanY: 0 })}
                        >
                          Reset Image Positioning
                        </button>
                      </div>
                    )}

                    {/* CTA (CALL TO ACTION) CONTROLS */}
                    {selectedElement.type === 'cta' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>💬 Call-To-Action (CTA) Settings</span>
                        </div>

                        <div className="cat-form-group">
                          <label>CTA Title / Heading</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={activePage.ctaText || 'Direct Order & Inquiries on WhatsApp'}
                            onChange={(e) => handleUpdateActivePageField('ctaText', e.target.value)}
                            placeholder="e.g. Order via WhatsApp"
                          />
                        </div>

                        <div className="cat-form-group">
                          <label>WhatsApp Number</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={activePage.whatsappNumber || catalogInfo.whatsappNumber || ''}
                            onChange={(e) => handleUpdateActivePageField('whatsappNumber', e.target.value)}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </div>
                      </div>
                    )}

                    {/* PRODUCT TITLE CONTROLS */}
                    {selectedElement.type === 'title' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>🏷️ Product Title / Name</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Product Name</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={activePage.name || ''}
                            onChange={(e) => handleUpdateActivePageField('name', e.target.value)}
                            placeholder="Product Title"
                          />
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Font Size ({selectedElement.fontSize || 22}px)</label>
                            <input
                              type="range"
                              min="14"
                              max="48"
                              value={selectedElement.fontSize || 22}
                              onChange={(e) => handleUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                            />
                          </div>

                          <div className="cat-form-group">
                            <label>Text Color</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="color"
                                value={selectedElement.textColor || '#0f172a'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { textColor: e.target.value })}
                                style={{ width: 34, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                className="cat-input"
                                value={selectedElement.textColor || '#0f172a'}
                                onChange={(e) => handleUpdateElement(selectedElement.id, { textColor: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PRICE & DISCOUNT CONTROLS */}
                    {selectedElement.type === 'price' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>💰 Pricing & Discount</span>
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Regular MRP ({catalogInfo.currencySymbol})</label>
                            <input
                              type="number"
                              className="cat-input"
                              value={activePage.regularPrice || ''}
                              onChange={(e) => handleUpdateActivePageField('regularPrice', e.target.value)}
                              placeholder="e.g. 4999"
                            />
                          </div>

                          <div className="cat-form-group">
                            <label>Discount / Offer Price ({catalogInfo.currencySymbol})</label>
                            <input
                              type="number"
                              className="cat-input"
                              value={activePage.discountPrice || ''}
                              onChange={(e) => handleUpdateActivePageField('discountPrice', e.target.value)}
                              placeholder="e.g. 2999"
                            />
                          </div>
                        </div>

                        <div className="cat-form-group">
                          <label>Currency Symbol</label>
                          <select
                            className="cat-select"
                            value={catalogInfo.currencySymbol}
                            onChange={(e) => setCatalogInfo({ ...catalogInfo, currencySymbol: e.target.value })}
                          >
                            <option value="₹">₹ (INR)</option>
                            <option value="$">$ (USD)</option>
                            <option value="€">€ (EUR)</option>
                            <option value="£">£ (GBP)</option>
                            <option value="AED">AED</option>
                            <option value="SAR">SAR</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* BADGE / RIBBON CONTROLS */}
                    {selectedElement.type === 'badge' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>🏷️ Badge / Ribbon Tag</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Badge Text</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={activePage.badgeText || ''}
                            onChange={(e) => handleUpdateActivePageField('badgeText', e.target.value)}
                            placeholder="e.g. BESTSELLER, 40% OFF, NEW"
                          />
                        </div>
                      </div>
                    )}

                    {/* CATEGORY & SKU CONTROLS */}
                    {selectedElement.type === 'category' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>📁 Category & SKU Code</span>
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Category</label>
                            <input
                              type="text"
                              className="cat-input"
                              value={activePage.category || ''}
                              onChange={(e) => handleUpdateActivePageField('category', e.target.value)}
                              placeholder="e.g. Electronics"
                            />
                          </div>

                          <div className="cat-form-group">
                            <label>SKU / Model Code</label>
                            <input
                              type="text"
                              className="cat-input"
                              value={activePage.sku || ''}
                              onChange={(e) => handleUpdateActivePageField('sku', e.target.value)}
                              placeholder="e.g. AUDIO-HP-001"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SHORT DESCRIPTION CONTROLS */}
                    {selectedElement.type === 'short_desc' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>📝 Short Description (Lead)</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Short Description</label>
                          <textarea
                            rows="2"
                            className="cat-textarea"
                            value={activePage.shortDescription || ''}
                            onChange={(e) => handleUpdateActivePageField('shortDescription', e.target.value)}
                            placeholder="Brief product pitch or highlight sentence"
                          />
                        </div>
                      </div>
                    )}

                    {/* FULL DESCRIPTION CONTROLS */}
                    {selectedElement.type === 'full_desc' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>📄 Detailed Description</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Product Details & Overview</label>
                          <textarea
                            rows="4"
                            className="cat-textarea"
                            value={activePage.description || ''}
                            onChange={(e) => handleUpdateActivePageField('description', e.target.value)}
                            placeholder="Complete product details, materials, warranty, advantages..."
                          />
                        </div>
                      </div>
                    )}

                    {/* KEY HIGHLIGHTS CONTROLS */}
                    {selectedElement.type === 'highlights' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>✨ Key Highlights (Bullet Points)</span>
                        </div>

                        {(activePage.features || []).map((feat, fIdx) => (
                          <div key={fIdx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                            <input
                              type="text"
                              className="cat-input"
                              value={feat}
                              onChange={(e) => {
                                const updatedFeats = [...(activePage.features || [])];
                                updatedFeats[fIdx] = e.target.value;
                                handleUpdateActivePageField('features', updatedFeats);
                              }}
                              placeholder={`Highlight #${fIdx + 1}`}
                            />
                            <button
                              type="button"
                              className="cat-icon-btn danger"
                              onClick={() => {
                                const updatedFeats = (activePage.features || []).filter((_, i) => i !== fIdx);
                                handleUpdateActivePageField('features', updatedFeats);
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="cat-btn cat-btn-secondary"
                          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                          onClick={() => {
                            const updatedFeats = [...(activePage.features || []), ''];
                            handleUpdateActivePageField('features', updatedFeats);
                          }}
                        >
                          + Add Bullet Point
                        </button>
                      </div>
                    )}

                    {/* SPECIFICATIONS CONTROLS */}
                    {selectedElement.type === 'specs' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>⚙️ Technical Specifications</span>
                        </div>

                        {(activePage.specs || []).map((sp, sIdx) => (
                          <div key={sIdx} style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                            <input
                              type="text"
                              className="cat-input"
                              style={{ width: '45%' }}
                              value={sp.key || ''}
                              placeholder="Feature (e.g. Weight)"
                              onChange={(e) => {
                                const updatedSpecs = [...(activePage.specs || [])];
                                updatedSpecs[sIdx] = { ...updatedSpecs[sIdx], key: e.target.value };
                                handleUpdateActivePageField('specs', updatedSpecs);
                              }}
                            />
                            <input
                              type="text"
                              className="cat-input"
                              style={{ width: '45%' }}
                              value={sp.value || ''}
                              placeholder="Value (e.g. 250g)"
                              onChange={(e) => {
                                const updatedSpecs = [...(activePage.specs || [])];
                                updatedSpecs[sIdx] = { ...updatedSpecs[sIdx], value: e.target.value };
                                handleUpdateActivePageField('specs', updatedSpecs);
                              }}
                            />
                            <button
                              type="button"
                              className="cat-icon-btn danger"
                              onClick={() => {
                                const updatedSpecs = (activePage.specs || []).filter((_, i) => i !== sIdx);
                                handleUpdateActivePageField('specs', updatedSpecs);
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="cat-btn cat-btn-secondary"
                          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                          onClick={() => {
                            const updatedSpecs = [...(activePage.specs || []), { key: '', value: '' }];
                            handleUpdateActivePageField('specs', updatedSpecs);
                          }}
                        >
                          + Add Spec Row
                        </button>
                      </div>
                    )}

                    {/* HEADER CONTROLS */}
                    {selectedElement.type === 'header' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>🏢 Header Brand & Business Info</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Business Name</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={catalogInfo.businessName || ''}
                            onChange={(e) => setCatalogInfo({ ...catalogInfo, businessName: e.target.value })}
                          />
                        </div>

                        <div className="cat-form-group">
                          <label>Header Heading / Subtitle</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={catalogInfo.primaryHeading || ''}
                            onChange={(e) => setCatalogInfo({ ...catalogInfo, primaryHeading: e.target.value })}
                          />
                        </div>

                        <div className="cat-grid-2">
                          <div className="cat-form-group">
                            <label>Phone</label>
                            <input
                              type="text"
                              className="cat-input"
                              value={catalogInfo.businessPhone || ''}
                              onChange={(e) => setCatalogInfo({ ...catalogInfo, businessPhone: e.target.value })}
                            />
                          </div>

                          <div className="cat-form-group">
                            <label>Email</label>
                            <input
                              type="email"
                              className="cat-input"
                              value={catalogInfo.email || ''}
                              onChange={(e) => setCatalogInfo({ ...catalogInfo, email: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FOOTER CONTROLS */}
                    {selectedElement.type === 'footer' && (
                      <div className="cat-panel-section">
                        <div className="cat-panel-section-title">
                          <span>📑 Footer Text & Copyright</span>
                        </div>

                        <div className="cat-form-group">
                          <label>Footer Text</label>
                          <input
                            type="text"
                            className="cat-input"
                            value={catalogInfo.footerText || ''}
                            onChange={(e) => setCatalogInfo({ ...catalogInfo, footerText: e.target.value })}
                            placeholder="e.g. Prices subject to revision • All rights reserved"
                          />
                        </div>
                      </div>
                    )}

                    {/* ALIGNMENT SHORTCUTS */}
                    <div className="cat-panel-section">
                      <div className="cat-panel-section-title">
                        <span>Align to Canvas</span>
                      </div>

                      <div className="cat-grid-3">
                        <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleAlignElement('left')}>Left</button>
                        <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleAlignElement('center')}>Center</button>
                        <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleAlignElement('right')}>Right</button>
                      </div>
                      <div className="cat-grid-3">
                        <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleAlignElement('top')}>Top</button>
                        <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleAlignElement('middle')}>Middle</button>
                        <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleAlignElement('bottom')}>Bottom</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>No Element Selected</div>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      Click on any text box, image, title, price, or shape on the canvas to inspect and edit its position, size, and styles.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── TAB 3: COMPLETE SHAPES LIBRARY ── */}
            {activePropTab === 'shapes' && (
              <div className="cat-panel-section">
                <div className="cat-panel-section-title">
                  <span>🔷 Vector Shapes Library</span>
                </div>
                <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 8px 0' }}>
                  Click any vector shape to place it on the canvas:
                </p>

                <div className="cat-grid-2">
                  {SHAPE_TEMPLATES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="shape-picker-btn"
                      onClick={() => handleAddShape(s.shapeType)}
                    >
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 4: BACKGROUND EDITOR ── */}
            {activePropTab === 'background' && activePage && (
              <>
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>Background Type</span>
                  </div>

                  <div className="cat-grid-3">
                    <button
                      type="button"
                      className={`cat-btn ${activePage.background?.type === 'solid' ? 'cat-btn-primary' : 'cat-btn-secondary'}`}
                      style={{ fontSize: 11 }}
                      onClick={() => handleUpdateBackground({ type: 'solid' })}
                    >
                      Solid Color
                    </button>
                    <button
                      type="button"
                      className={`cat-btn ${activePage.background?.type === 'gradient' ? 'cat-btn-primary' : 'cat-btn-secondary'}`}
                      style={{ fontSize: 11 }}
                      onClick={() => handleUpdateBackground({ type: 'gradient' })}
                    >
                      Gradient
                    </button>
                    <button
                      type="button"
                      className={`cat-btn ${activePage.background?.type === 'image' ? 'cat-btn-primary' : 'cat-btn-secondary'}`}
                      style={{ fontSize: 11 }}
                      onClick={() => handleUpdateBackground({ type: 'image' })}
                    >
                      Image
                    </button>
                  </div>

                  {/* Solid Color Picker */}
                  {activePage.background?.type === 'solid' && (
                    <div className="cat-form-group" style={{ marginTop: 8 }}>
                      <label>Page Color</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="color"
                          value={activePage.background?.color || '#ffffff'}
                          onChange={(e) => handleUpdateBackground({ color: e.target.value })}
                          style={{ width: 36, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          className="cat-input"
                          value={activePage.background?.color || '#ffffff'}
                          onChange={(e) => handleUpdateBackground({ color: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Gradient Controls */}
                  {activePage.background?.type === 'gradient' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <div className="cat-grid-2">
                        <div className="cat-form-group">
                          <label>Color 1 (Start)</label>
                          <input
                            type="color"
                            value={activePage.background?.gradient?.color1 || '#ffffff'}
                            onChange={(e) => handleUpdateBackground({
                              gradient: { ...(activePage.background?.gradient || {}), color1: e.target.value }
                            })}
                            style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                        </div>
                        <div className="cat-form-group">
                          <label>Color 2 (End)</label>
                          <input
                            type="color"
                            value={activePage.background?.gradient?.color2 || '#e8f5e9'}
                            onChange={(e) => handleUpdateBackground({
                              gradient: { ...(activePage.background?.gradient || {}), color2: e.target.value }
                            })}
                            style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                        </div>
                      </div>

                      <div className="cat-form-group">
                        <label>Gradient Angle: {activePage.background?.gradient?.angle || 135}°</label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={activePage.background?.gradient?.angle || 135}
                          onChange={(e) => handleUpdateBackground({
                            gradient: { ...(activePage.background?.gradient || {}), angle: parseInt(e.target.value, 10) }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Background Image Upload */}
                  {activePage.background?.type === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <input
                        type="file"
                        accept="image/*"
                        className="cat-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePersistentImageUpload(file, (url) => handleUpdateBackground({ image: url }));
                        }}
                      />
                      {activePage.background?.image && (
                        <>
                          <div className="cat-grid-2">
                            <div className="cat-form-group">
                              <label>Image Fit</label>
                              <select
                                className="cat-select"
                                value={activePage.background?.imageFit || 'cover'}
                                onChange={(e) => handleUpdateBackground({ imageFit: e.target.value })}
                              >
                                <option value="cover">Cover (Full Sheet)</option>
                                <option value="contain">Contain</option>
                              </select>
                            </div>
                            <div className="cat-form-group">
                              <label>Opacity</label>
                              <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={activePage.background?.imageOpacity ?? 1}
                                onChange={(e) => handleUpdateBackground({ imageOpacity: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            className="cat-btn cat-btn-danger-outline"
                            style={{ fontSize: 11 }}
                            onClick={() => handleUpdateBackground({ image: '' })}
                          >
                            Remove Background Image
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Preset Library */}
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>✨ Preset Backgrounds</span>
                  </div>

                  <div className="cat-grid-2">
                    {BACKGROUND_PRESETS.map((p, i) => (
                      <div
                        key={i}
                        className="bg-preset-card"
                        style={{
                          background: p.type === 'gradient'
                            ? `linear-gradient(${p.gradient.angle}deg, ${p.gradient.color1} 0%, ${p.gradient.color2} 100%)`
                            : p.color
                        }}
                        onClick={() => handleUpdateBackground(p)}
                        title={p.name}
                      >
                        <span style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 9, fontWeight: 700, color: '#334155', background: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: 3 }}>
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── TAB 5: LAYERS ORDERING & LAYER LIST ── */}
            {activePropTab === 'layers' && (
              <>
                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>Layer Controls</span>
                  </div>

                  <div className="cat-grid-2">
                    <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('front')}>
                      Bring to Front
                    </button>
                    <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('forward')}>
                      Bring Forward
                    </button>
                    <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('backward')}>
                      Send Backward
                    </button>
                    <button type="button" className="cat-btn cat-btn-secondary" style={{ fontSize: 11 }} onClick={() => handleLayerOrder('back')}>
                      Send to Back
                    </button>
                  </div>
                </div>

                <div className="cat-panel-section">
                  <div className="cat-panel-section-title">
                    <span>Layers Stack (Top to Bottom)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
                    {[...activeElements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map((el) => {
                      const isSelected = el.id === selectedElementId;
                      const label = el.type === 'custom_text' ? `Text: "${(el.text || '').slice(0, 14)}..."` : (el.type === 'shape' ? `Shape: ${el.shapeType}` : el.type.toUpperCase());

                      return (
                        <div
                          key={el.id}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 11.5,
                            fontWeight: isSelected ? 700 : 500
                          }}
                          onClick={() => {
                            setSelectedElementId(el.id);
                            setActivePropTab('canvas');
                          }}
                        >
                          <span>{label}</span>
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

      {/* ── HIDDEN CONTAINER FOR BATCH PDF RENDERING ───────────────── */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: 794,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1
        }}
      >
        {pages.map((p, idx) => (
          <div key={`pdf-${p.id}`} ref={el => pdfPagesRef.current[idx] = el}>
            {renderA4VisualSheet(p, idx + 1, pages.length, true)}
          </div>
        ))}
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}

      {/* Basic Details Modal */}
      {showBasicDetailsModal && renderBasicDetailsModal()}

      {/* Add Product Modal */}
      {showAddProductModal && renderAddProductModal()}

      {/* Preview Modal */}
      {showPreviewModal && renderPreviewModal()}

      {/* Delete Page Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="cat-modal-overlay">
          <div className="cat-modal" style={{ width: 400 }}>
            <div className="cat-modal-header">
              <h2 className="cat-modal-title" style={{ color: '#dc2626' }}>🗑️ Delete Page</h2>
              <button type="button" className="cat-icon-btn" onClick={() => setShowDeleteConfirmModal(false)}>✕</button>
            </div>
            <div className="cat-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: '#334155' }}>
                Are you sure you want to delete this catalog page? This action cannot be undone.
              </p>
            </div>
            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn-secondary" onClick={() => setShowDeleteConfirmModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cat-btn cat-btn-danger-outline"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  if (pageToDeleteIndex === null) return;
                  const updated = pages.filter((_, idx) => idx !== pageToDeleteIndex);
                  setPages(updated);
                  setShowDeleteConfirmModal(false);
                  setPageToDeleteIndex(null);
                  if (updated.length === 0) setActivePageIndex(0);
                  else if (activePageIndex >= updated.length) setActivePageIndex(updated.length - 1);
                  pushHistory(updated);
                }}
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Catalog Modal */}
      {showClearConfirmModal && (
        <div className="cat-modal-overlay">
          <div className="cat-modal" style={{ width: 420 }}>
            <div className="cat-modal-header">
              <h2 className="cat-modal-title" style={{ color: '#dc2626' }}>⚠️ Clear Catalog</h2>
              <button type="button" className="cat-icon-btn" onClick={() => setShowClearConfirmModal(false)}>✕</button>
            </div>
            <div className="cat-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: '#334155' }}>
                This will reset the entire visual catalog and all pages for this session. Are you sure?
              </p>
            </div>
            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn-secondary" onClick={() => setShowClearConfirmModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cat-btn cat-btn-danger-outline"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  setPages([]);
                  setIsBuilderActive(false);
                  setCurrentCatalogId(null);
                  localStorage.removeItem('wa_catalog_active_id');
                  localStorage.removeItem('wa_catalog_active_pages');
                  localStorage.removeItem('wa_catalog_active_info');
                  setShowClearConfirmModal(false);
                }}
              >
                Reset Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Progress Modal */}
      {pdfState.exporting && (
        <div className="cat-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="cat-modal" style={{ width: 420, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📥</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18, color: '#0f172a' }}>Generating PDF Catalog</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>{pdfState.status}</p>

            <div style={{ width: '100%', height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
              <div
                style={{
                  width: `${pdfState.percentage}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                  transition: 'width 0.2s ease'
                }}
              />
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
              {pdfState.percentage}% Complete
            </div>

            {pdfState.error && (
              <div style={{ marginTop: 12, padding: 8, background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 12 }}>
                {pdfState.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
