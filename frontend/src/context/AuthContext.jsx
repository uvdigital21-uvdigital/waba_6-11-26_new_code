import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { API_BASE_URL, getImageUrl } from '../config.js'
import { globalLoadingEvents } from './LoadingContext.jsx'
import { getDeviceId } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('wa_dashboard_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('wa_dashboard_token'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const faviconUrl = getImageUrl(user?.app_logo || '/uploads/image.png');
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.id = 'app-favicon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = faviconUrl;
  }, [user?.app_logo]);

  const login = async (username, password) => {
    globalLoadingEvents.start('Signing In...')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          deviceId: getDeviceId(),
          deviceName: `${navigator.platform || 'Device'} • ${navigator.userAgent.includes('Mobile') ? 'Mobile browser' : 'Web browser'}`
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Login failed')
        return false
      }

      localStorage.setItem('wa_dashboard_user', JSON.stringify(data.user))
      localStorage.setItem('wa_dashboard_token', data.token)
      setUser(data.user)
      setToken(data.token)
      return true
    } catch (err) {
      setError('Could not reach the server. Is backend running?')
      return false
    } finally {
      setLoading(false)
      globalLoadingEvents.stop()
    }
  }

  const register = async (payload) => {
    globalLoadingEvents.start('Creating Account...')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Registration failed')
        return false
      }

      if (data.token && data.user) {
        localStorage.setItem('wa_dashboard_user', JSON.stringify(data.user))
        localStorage.setItem('wa_dashboard_token', data.token)
        setUser(data.user)
        setToken(data.token)
      }

      return true
    } catch (err) {
      setError('Could not reach server.')
      return false
    } finally {
      setLoading(false)
      globalLoadingEvents.stop()
    }
  }

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => { })
      }
    } catch (e) {
      console.warn('Logout notification error:', e)
    } finally {
      localStorage.removeItem('wa_dashboard_user')
      localStorage.removeItem('wa_dashboard_token')
      setUser(null)
      setToken(null)
    }
  }

  const hasPermission = useCallback((slug) => {
    if (!user) return false;

    // Super Admin and Main Account Owner/Admin have unrestricted access
    if (!user.is_team_member && (user.role === 'Super Admin' || user.role === 'Admin' || user.username === 'admin')) {
      return true;
    }

    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.length === 0) return false;

    if (!slug) return true;

    // Direct match
    if (perms.includes(slug)) return true;

    // Granular slug alias and prefix mappings
    const aliasMap = {
      dashboard: ['dashboard.view', 'dashboard'],
      'dashboard.view': ['dashboard.view', 'dashboard'],
      campaign: ['campaigns.view', 'campaigns.create', 'campaigns.send', 'campaigns.edit', 'campaigns.delete', 'campaigns'],
      campaigns: ['campaigns.view', 'campaigns.create', 'campaigns.send', 'campaigns.edit', 'campaigns.delete', 'campaigns'],
      'sendWa:quick': ['campaigns.view', 'campaigns.create', 'campaigns.send'],
      'sendWa:csv': ['campaigns.view', 'campaigns.create', 'campaigns.send'],
      'sendWa:tags': ['campaigns.view', 'contacts.view'],
      'sendWa:group': ['campaigns.view', 'contacts.view'],
      'sendWa:birthday': ['campaigns.view', 'campaigns.send'],
      bulk_sender: ['campaigns.view', 'campaigns.send', 'campaigns.create'],
      contacts: ['contacts.view', 'contacts.create', 'contacts.edit', 'contacts.import', 'contacts.export', 'contacts.delete'],
      reports: ['reports.view', 'reports.export'],
      'reports:history': ['reports.view'],
      'reports:scheduled': ['reports.view'],
      inbox: ['inbox.view', 'inbox.reply'],
      chat: ['inbox.view', 'inbox.reply'],
      'chat:inbox': ['inbox.view', 'inbox.reply'],
      templates: ['templates.view', 'templates.create', 'templates.edit', 'templates.delete'],
      template: ['templates.view', 'templates.create', 'templates.edit', 'templates.delete'],
      'template:manage': ['templates.view', 'templates.create', 'templates.edit'],
      chatbot: ['chatbot.view', 'chatbot.manage', 'settings.manage'],
      'chatbot:flow': ['chatbot.view', 'chatbot.manage', 'settings.manage'],
      api: ['api.view', 'developer_api.view'],
      'api:developer': ['api.view', 'developer_api.view'],
      whatsapp_numbers: ['whatsapp_numbers.view', 'whatsapp_numbers.manage'],
      'setting:numbers': ['whatsapp_numbers.view', 'whatsapp_numbers.manage'],
      'setting:blacklist': ['settings.view', 'settings.manage'],
      'setting:tags': ['contacts.view', 'contacts.edit'],
      'setting:billing': ['meta_billing.view', 'meta_billing.refresh'],
      'setting:team_members': ['team_members.view', 'team_members.create', 'team_members.edit'],
      meta_billing: ['meta_billing.view', 'meta_billing.refresh'],
      settings: ['settings.view', 'settings.manage', 'whatsapp_numbers.view', 'meta_billing.view', 'team_members.view'],
      setting: ['settings.view', 'settings.manage', 'whatsapp_numbers.view', 'meta_billing.view', 'team_members.view'],
      team_members: ['team_members.view', 'team_members.create', 'team_members.edit', 'team_members.disable', 'team_members.delete'],
      team: ['team_members.view', 'team_members.create', 'team_members.edit'],
      catalog: ['catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete', 'catalog'],
      'catalog:builder': ['catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete', 'catalog'],
      'catalog.view': ['catalog.view', 'catalog'],
      'catalog.create': ['catalog.create', 'catalog'],
      'catalog.edit': ['catalog.edit', 'catalog'],
      'catalog.delete': ['catalog.delete', 'catalog']
    };

    const targets = aliasMap[slug] || [slug];
    return targets.some(t => perms.includes(t) || perms.some(p => p.startsWith(t.split('.')[0] + '.')));
  }, [user]);

  const updateUser = useCallback((updatedUserData) => {
    setUser(prev => {
      const merged = { ...(prev || {}), ...updatedUserData }
      localStorage.setItem('wa_dashboard_user', JSON.stringify(merged))
      return merged
    })
  }, [])

  const refreshInFlight = React.useRef(false)

  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem('wa_dashboard_token')
    if (!savedToken) return

    if (refreshInFlight.current) return
    refreshInFlight.current = true

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
      const data = await res.json()

      if (res.ok && data.user) {
        setUser(data.user)
        localStorage.setItem('wa_dashboard_user', JSON.stringify(data.user))
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wa_dashboard_user')
        localStorage.removeItem('wa_dashboard_token')
        setUser(null)
        setToken(null)
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to refresh user from /auth/me:', err)
    } finally {
      refreshInFlight.current = false
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const isSuperAdmin = user?.role === 'Super Admin' || user?.username === 'admin';
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.username === 'admin';

  return (
    <AuthContext.Provider value={{
      user, token, login, register, logout, updateUser, error, setError, loading,
      hasPermission, isSuperAdmin, isAdmin, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
