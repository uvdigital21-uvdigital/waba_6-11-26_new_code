/**
 * Single source of truth for BASE_URL & API_BASE_URL across the application.
 * 
 * Environment Variables supported:
 * - VITE_API_BASE_URL (Development: http://localhost:5173 or http://localhost:5000 | Production: https://yourdomain.com)
 * - VITE_BASE_URL
 * 
 * If no env variable is provided, falls back dynamically to window.location.origin.
 */

export const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BASE_URL || import.meta.env.VITE_API_BASE;
  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      // In production, use explicit public URL if configured and not pointing to localhost
      if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http') && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
      }
      return window.location.origin.replace(/\/+$/, '');
    }
  }
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  return 'http://localhost:5000';
};

export const BASE_URL = getBaseUrl();

export const getApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE;
  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.startsWith('http') && !envApiUrl.includes('localhost') && !envApiUrl.includes('127.0.0.1')) {
        const cleanEnv = envApiUrl.trim().replace(/\/+$/, '');
        return cleanEnv.endsWith('/api') ? cleanEnv : `${cleanEnv}/api`;
      }
      return `${window.location.origin.replace(/\/+$/, '')}/api`;
    }
  }
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim().length > 0) {
    const cleanEnv = envApiUrl.trim().replace(/\/+$/, '');
    return cleanEnv.endsWith('/api') ? cleanEnv : `${cleanEnv}/api`;
  }
  const base = getBaseUrl();
  return `${base}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const getImageUrl = (path, fallback = null) => {
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return fallback;
  }

  // If path is a Meta opaque handle (starts with "4::"), it is not a direct image URL
  if (path.startsWith('4::')) {
    return fallback;
  }

  // Strip legacy localhost / 127.0.0.1 URLs when running in production
  let clean = path.trim();
  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && (clean.includes('localhost:') || clean.includes('127.0.0.1:'))) {
      clean = clean.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
    }
  }

  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:') || clean.startsWith('data:')) {
    return clean;
  }

  let cleanPath = clean.startsWith('/') ? clean : `/${clean}`;

  // If path is a template or card file name, prefix with /uploads/templates/
  if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('/api/uploads/')) {
    if (cleanPath.startsWith('/template_') || cleanPath.startsWith('/card_')) {
      cleanPath = `/uploads/templates${cleanPath}`;
    } else if (cleanPath.match(/\.(png|jpg|jpeg|gif|webp|pdf|mp4)$/i)) {
      cleanPath = `/uploads${cleanPath}`;
    }
  }

  // Ensure uploads paths use /api/uploads in production so Nginx proxies them to Node.js
  const apiBase = getApiBaseUrl(); // e.g. "https://officialwaba.com/api" or "http://localhost:5000/api"
  if (cleanPath.startsWith('/uploads/')) {
    return `${apiBase}${cleanPath}`;
  }
  if (cleanPath.startsWith('/api/uploads/')) {
    return `${apiBase}${cleanPath.replace(/^\/api/, '')}`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      return `${window.location.origin.replace(/\/+$/, '')}${cleanPath}`;
    }
  }

  const host = getBaseUrl();
  return `${host}${cleanPath}`;
};

