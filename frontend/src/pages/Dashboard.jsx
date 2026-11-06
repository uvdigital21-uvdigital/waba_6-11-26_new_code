import React, { useEffect, useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconUser, IconPhone } from '../components/icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useTitle } from '../context/TitleContext.jsx'
import { API_BASE_URL } from '../config.js'
import api from '../services/api.js'
import ModuleAccessSelector from '../components/ModuleAccessSelector.jsx'
import { DEFAULT_ALLOWED_MODULES } from '../config/modules.js'
import { initFacebookSdk, launchWhatsAppEmbeddedSignup } from '../services/facebookSdk.js'
import './Dashboard.css'

export default function Dashboard() {
  const { user, token, isSuperAdmin, hasPermission } = useAuth()
  const { setTitle } = useTitle()
  const location = useLocation()
  const navigate = useNavigate()

  const [fbConnecting, setFbConnecting] = useState(false)
  const [fbNotification, setFbNotification] = useState(null)

  // Pre-load Meta Facebook JavaScript SDK so popup triggers without blocker delay
  useEffect(() => {
    initFacebookSdk().catch(err => {
      console.warn('[Dashboard] Pre-loading Facebook SDK notice:', err.message)
    })
  }, [])

  const handleFacebookEmbeddedSignup = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (fbConnecting) return

    setFbNotification(null)
    setFbConnecting(true)

    try {
      await initFacebookSdk()

      launchWhatsAppEmbeddedSignup({
        onSessionInfo: (payload, sessionData) => {
          console.log('[Dashboard] WhatsApp Embedded Signup Event:', payload.event, sessionData)
        },
        onSuccess: async ({ code, access_token, sessionData }) => {
          try {
            console.log('[Dashboard] Meta OAuth authorization response received. Connecting with backend...')
            const actualToken = token || localStorage.getItem('wa_dashboard_token')
            const payloadBody = {
              code: code || undefined,
              access_token: access_token || undefined,
              phone_number_id: sessionData?.phone_number_id || undefined,
              waba_id: sessionData?.waba_id || undefined
            }

            const res = await fetch(`${API_BASE_URL}/whatsapp/connect`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(actualToken ? { Authorization: `Bearer ${actualToken}` } : {})
              },
              body: JSON.stringify(payloadBody)
            })

            const data = await res.json()
            if (!res.ok || !data.success) {
              throw new Error(data.message || 'Failed to connect WhatsApp account with Meta.')
            }

            setFbNotification({
              type: 'success',
              text: data.message || 'WhatsApp Account successfully connected via Facebook!'
            })

            // Refresh dashboard account status and KPIs
            await loadDashboard()
          } catch (connErr) {
            console.error('[Dashboard] Backend connection error:', connErr)
            setFbNotification({
              type: 'error',
              text: connErr.message || 'Failed to complete WhatsApp connection with server.'
            })
          } finally {
            setFbConnecting(false)
          }
        },
        onError: (err) => {
          console.error('[Dashboard] Facebook Login error:', err)
          setFbNotification({
            type: 'error',
            text: err.message || 'Meta WhatsApp Embedded Signup failed. Please try again.'
          })
          setFbConnecting(false)
        },
        onCancel: (reason) => {
          console.log('[Dashboard] Facebook Login cancelled:', reason)
          setFbNotification({
            type: 'error',
            text: reason || 'Facebook Login was cancelled.'
          })
          setFbConnecting(false)
        }
      })
    } catch (sdkErr) {
      console.error('[Dashboard] SDK load error:', sdkErr)
      setFbNotification({
        type: 'error',
        text: sdkErr.message || 'Could not load Facebook SDK. Please check your network connection or ad blocker.'
      })
      setFbConnecting(false)
    }
  }

  const [dashboardData, setDashboardData] = useState(null)
  const [metaBillingSummary, setMetaBillingSummary] = useState(null)
  const [userCredits, setUserCredits] = useState(0)
  const [userFeatureCredits, setUserFeatureCredits] = useState({})
  const [accessTypeInfo, setAccessTypeInfo] = useState({
    isDaysBased: false,
    accessType: 'credit_based',
    remainingDays: null,
    daysStatus: 'Active',
    expiryDate: null
  })
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('')

  const searchParams = new URLSearchParams(location.search)
  // Keep every dashboard request scoped to the number currently selected in
  // the global account switcher, even when the URL has no account_id query.
  const selectedAccountId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id') || ''

  // Compute which modules this user can access
  const userAllowedModules = (() => {
    if (!user?.allowed_modules) return null
    try {
      return typeof user.allowed_modules === 'string'
        ? JSON.parse(user.allowed_modules)
        : user.allowed_modules
    } catch { return null }
  })()
  const isAdminUser = user?.role === 'Super Admin' || user?.role === 'Admin'
  const isTeamMember = !!user?.is_team_member
  const canAccessSetting = isAdminUser || (isTeamMember ? hasPermission('settings') || hasPermission('whatsapp_numbers') : (!userAllowedModules || userAllowedModules.length === 0 || userAllowedModules.includes('setting')))
  const canAccessBilling = isAdminUser || (isTeamMember ? hasPermission('meta_billing') || hasPermission('settings') : (!userAllowedModules || userAllowedModules.length === 0 || userAllowedModules.includes('setting')))
  // Permission gates for dashboard KPI widgets
  const canSeeTemplates = !isTeamMember || hasPermission('template:manage') || hasPermission('template') || hasPermission('templates')
  const canSeeCredits = !isTeamMember // Credits/subscription info is owner-only
  // Message analytics (sent/delivered/read/error chart) — visible to Admins AND regular (non-team-member) Users.
  // Team members only see it if explicitly granted the 'reports' / 'report_insights' permission.
  const canSeeMessageAnalytics = isAdminUser || !isTeamMember || hasPermission('reports') || hasPermission('report_insights')

  // ---- Message Analytics (Outgoing message stats by date range) ----
  const [messageStats, setMessageStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [statsPreset, setStatsPreset] = useState('7d') // 'today' | '7d' | '30d' | 'month' | 'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const getStatsDateRange = useCallback(() => {
    // Keep dashboard filters as local calendar dates. Converting a local Date
    // through toISOString() can move it to the previous/next day depending on
    // the browser timezone.
    const fmt = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    if (statsPreset === 'custom') {
      if (!customStart || !customEnd) return null
      return { start_date: customStart, end_date: customEnd }
    }
    const today = new Date()
    const end = fmt(today)
    let start = new Date(today)
    if (statsPreset === 'today') {
      // start === end, no change needed
    } else if (statsPreset === '7d') {
      start.setDate(start.getDate() - 6)
    } else if (statsPreset === '30d') {
      start.setDate(start.getDate() - 29)
    } else if (statsPreset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
    }
    return { start_date: fmt(start), end_date: end }
  }, [statsPreset, customStart, customEnd])

  const loadMessageStats = useCallback(async () => {
    const range = getStatsDateRange()
    if (!range) return // waiting on custom dates
    setStatsLoading(true)
    setStatsError('')
    try {
      const actualToken = token || localStorage.getItem('wa_dashboard_token')
      const params = new URLSearchParams(range)
      if (selectedAccountId) params.set('account_id', selectedAccountId)

      const res = await fetch(`${API_BASE_URL}/dashboard/message-stats?${params.toString()}`, {
        headers: actualToken ? { Authorization: `Bearer ${actualToken}` } : {},
        cache: 'no-store'
      })

      // If the route doesn't exist yet, servers usually respond with an HTML
      // 404/error page instead of JSON. Detect that before calling res.json()
      // so we show a clear message instead of "Unexpected token '<'".
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Message analytics API is not set up on the server yet (expected GET /dashboard/message-stats to return JSON).')
      }

      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to load message statistics')
      }
      setMessageStats(data.data || data)
    } catch (err) {
      console.warn('[Dashboard] Could not load message stats:', err.message)
      setStatsError(err.message || 'Could not load message statistics')
      setMessageStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [token, selectedAccountId, getStatsDateRange])

  useEffect(() => {
    if (!canSeeMessageAnalytics) return
    if (statsPreset === 'custom') return // wait for explicit "Apply" click
    loadMessageStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsPreset, selectedAccountId, canSeeMessageAnalytics])

  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [userSuccessMsg, setUserSuccessMsg] = useState('')
  const [userErrorMsg, setUserErrorMsg] = useState('')
  const [userFormData, setUserFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    email: '',
    role: 'User',
    access_type: 'credit_based',
    days_allocated: 30,
    start_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    credits: 0,
    allowed_modules: [...DEFAULT_ALLOWED_MODULES]
  })

  useEffect(() => {
    setTitle('Dashboard')
  }, [setTitle])

  // Show access denied toast when redirected from a protected route
  useEffect(() => {
    if (location.state?.accessDenied) {
      const moduleName = location.state.module || 'this page'
      setAccessDeniedMsg(`Access denied: You do not have permission to access "${moduleName}". Please contact your admin.`)
      window.history.replaceState({}, '')
      const timer = setTimeout(() => setAccessDeniedMsg(''), 6000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  // Fetch Dashboard Stats from Backend API
  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      if (selectedAccountId) {
        localStorage.setItem('active_wa_account_id', selectedAccountId)
      }
      const url = selectedAccountId
        ? `${API_BASE_URL}/dashboard?account_id=${selectedAccountId}`
        : `${API_BASE_URL}/dashboard`

      const actualToken = token || localStorage.getItem('wa_dashboard_token');

      let res = await fetch(url, {
        headers: actualToken ? { Authorization: `Bearer ${actualToken}` } : {},
      })

      if (res.status === 401 || res.status === 403) {
        // Retry once after a short delay in case token was just set
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryToken = localStorage.getItem('wa_dashboard_token');
        res = await fetch(url, {
          headers: retryToken ? { Authorization: `Bearer ${retryToken}` } : {},
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load dashboard statistics')
      setDashboardData(data.data || data)

      // Fetch credits and meta billing concurrently in parallel so the page loads instantly
      await Promise.allSettled([
        api.get('/credits/balance', { silent: true }).then(creditRes => {
          if (creditRes.data) {
            setUserCredits(creditRes.data.credits || 0)
            setUserFeatureCredits(creditRes.data.features || {})
            setAccessTypeInfo({
              isDaysBased: !!creditRes.data.isDaysBased,
              accessType: creditRes.data.accessType || 'credit_based',
              remainingDays: creditRes.data.remainingDays,
              daysStatus: creditRes.data.daysStatus || 'Active',
              expiryDate: creditRes.data.expiryDate || null
            })
          }
        }).catch(cErr => console.warn('Could not load user credits balance:', cErr.message)),

        api.get('/meta/billing-insights?dateRange=today', { silent: true }).then(metaRes => {
          if (metaRes.data) {
            setMetaBillingSummary(metaRes.data)
          }
        }).catch(mErr => console.warn('Could not load Meta billing summary:', mErr.message))
      ])
    } catch (err) {
      setLoadError(err.message || 'Could not connect to backend server')
    } finally {
      setLoading(false)
    }
  }, [token, selectedAccountId])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleModuleToggle = (key) => {
    setUserFormData(prev => {
      const current = prev.allowed_modules || []
      if (current.includes(key)) {
        return { ...prev, allowed_modules: current.filter(k => k !== key) }
      } else {
        return { ...prev, allowed_modules: [...current, key] }
      }
    })
  }

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault()
    setUserErrorMsg('')
    setUserSuccessMsg('')

    if (!userFormData.username.trim() || !userFormData.password.trim()) {
      setUserErrorMsg('Username and Password are required.')
      return
    }

    setCreatingUser(true)
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(userFormData)
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create user')
      }

      setUserSuccessMsg(`User "${userFormData.username}" created successfully with selected sidebar access!`)
      setShowAddUserModal(false)
      setUserFormData({
        full_name: '',
        username: '',
        password: '',
        email: '',
        role: 'User',
        allowed_modules: ['sendWa', 'reports', 'chat', 'chatbot', 'api', 'template', 'setting']
      })
      setTimeout(() => setUserSuccessMsg(''), 5000)
    } catch (err) {
      setUserErrorMsg(err.message)
    } finally {
      setCreatingUser(false)
    }
  }

  const userName = user?.full_name || user?.name || user?.username || 'Customer'
  const orgName = user?.organization_name || 'My Organization'

  const stats = dashboardData?.stats || {}
  const waAccount = dashboardData?.whatsapp_account || null

  return (
    <div className="dashboard-container">

      {/* Access Denied Toast */}
      {accessDeniedMsg && (
        <div className="dashboard-toast-denied">
          <span>🚫 {accessDeniedMsg}</span>
          <button onClick={() => setAccessDeniedMsg('')} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}

      {/* Messages */}
      {userSuccessMsg && (
        <div className="dashboard-toast-success">
          {userSuccessMsg}
        </div>
      )}

      {/* Welcome Hero Banner */}
      <div className="dashboard-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="dashboard-hero-badge">
              {orgName}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              {user?.is_team_member ? `@${user.username} • ${user.role} (Staff)` : (user?.role || 'Admin Account')}
            </span>
          </div>

          <h1 className="dashboard-hero-title">
            Welcome Back, {(() => {
              const raw = user?.full_name || user?.name || user?.username || 'User';
              return String(raw).charAt(0).toUpperCase() + String(raw).slice(1);
            })()} 👋
          </h1>
          <p className="dashboard-hero-subtitle">
            Manage Official WhatsApp Numbers, Campaign Broadcasts, Templates, and Contacts For {orgName}.
          </p>
        </div>

        <div className="dashboard-hero-controls">
          {dashboardData?.connected_accounts?.length > 0 && (
            <select
              className="dashboard-account-select"
              value={waAccount?.id || ''}
              onChange={(e) => {
                if (e.target.value) {
                  localStorage.setItem('active_wa_account_id', e.target.value)
                  navigate(`/dashboard?account_id=${e.target.value}`)
                }
              }}
            >
              {dashboardData.connected_accounts.map(acc => (
                <option key={acc.id} value={acc.id} style={{ color: '#0f172a', background: '#fff' }}>
                  📱 {acc.verified_name || acc.business_name || 'WA Number'} ({acc.display_phone_number || acc.phone_number})
                </option>
              ))}
            </select>
          )}



          {canAccessSetting && (
            <>
              <Link
                to="/setting/manage-numbers"
                className="btn-hero-action btn-hero-blue"
              >
                + Add WhatsApp Number
              </Link>

              <button
                type="button"
                onClick={handleFacebookEmbeddedSignup}
                disabled={fbConnecting}
                className="btn-hero-action btn-hero-facebook"
                title="Login with Facebook for WhatsApp Embedded Signup"
                style={{ cursor: fbConnecting ? 'not-allowed' : 'pointer', border: 'none' }}
              >
                {fbConnecting ? (
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                    style={{ width: 18, height: 18, borderWidth: 2, marginRight: 6, display: 'inline-block' }}
                  />
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                )}
                <span>{fbConnecting ? 'Connecting with Meta...' : 'Login with Facebook'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {fbNotification && (
        <div style={{
          background: fbNotification.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${fbNotification.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: fbNotification.type === 'success' ? '#166534' : '#991b1b',
          padding: '14px 20px',
          borderRadius: 14,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 14,
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <span>{fbNotification.text}</span>
          <button
            type="button"
            onClick={() => setFbNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit', fontSize: 16, marginLeft: 16 }}
          >
            ✕
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ height: 140, background: '#f1f5f9', borderRadius: 16 }} />
          ))}
        </div>
      )}

      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: 20, borderRadius: 16, marginBottom: 24 }}>
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {!loading && (
        <>
          {/* Connected WhatsApp Account Status Card */}
          <div className="status-card">
            <div className="status-card-header">
              <h3 className="status-card-title">
                WhatsApp Official Account Status
              </h3>

              <span className={`status-pill ${stats.connected ? 'status-pill-connected' : 'status-pill-disconnected'}`}>
                ● {stats.connected ? 'CONNECTED & VERIFIED' : 'NOT CONNECTED'}
              </span>
            </div>

            {stats.connected && waAccount ? (
              <div className="status-grid">
                <div className="status-item status-item-1">
                  <div className="status-label" style={{ color: '#0369a1' }}>BUSINESS NAME</div>
                  <div className="status-value">{waAccount.verified_name || waAccount.business_name || 'N/A'}</div>
                </div>

                <div className="status-item status-item-3">
                  <div className="status-label" style={{ color: '#1d4ed8' }}>PHONE NUMBER</div>
                  <div className="status-value status-value-blue">{waAccount.display_phone_number || waAccount.phone_number}</div>
                </div>

                <div className="status-item status-item-4">
                  <div className="status-label" style={{ color: '#047857' }}>QUALITY RATING</div>
                  <div className={`status-value ${(() => {
                    const q = String(waAccount.quality_rating || '').toUpperCase();
                    if (q === 'RED' || q === 'LOW') return 'status-value-red';
                    if (q === 'YELLOW' || q === 'MEDIUM') return 'status-value-yellow';
                    return 'status-value-green';
                  })()
                    }`}>
                    {(() => {
                      const q = String(waAccount.quality_rating || 'HIGH').toUpperCase();
                      if (q === 'GREEN' || q === 'HIGH') return 'HIGH';
                      if (q === 'YELLOW' || q === 'MEDIUM') return 'MEDIUM';
                      if (q === 'RED' || q === 'LOW') return 'LOW';
                      return q;
                    })()}
                  </div>
                </div>

                <div className="status-item status-item-5">
                  <div className="status-label" style={{ color: '#b45309' }}>META STATUS</div>
                  <div className="status-value">{waAccount.verification_status || 'CONNECTED'}</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', background: '#f8fafc', borderRadius: 12, color: '#64748b' }}>
                No WhatsApp official number connected yet for <strong>{orgName}</strong>. {canAccessSetting ? 'Click "+ Add WhatsApp Number" to verify Meta credentials.' : 'Please contact your administrator.'}
              </div>
            )}
          </div>

          {/* Message Analytics: Sent / Delivered / Read / Error, filterable by date range */}
          {canSeeMessageAnalytics && (
            <div className="message-analytics-section">
              <div className="message-analytics-header">
                <h3 className="quick-actions-title" style={{ margin: 0 }}>📊 Outgoing Message Analytics</h3>
                <div className="date-range-controls">
                  {[
                    { key: 'today', label: 'Today' },
                    { key: '7d', label: '7 Days' },
                    { key: '30d', label: '30 Days' },
                    { key: 'month', label: 'This Month' },
                    { key: 'custom', label: 'Custom' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`date-range-btn ${statsPreset === opt.key ? 'active' : ''}`}
                      onClick={() => setStatsPreset(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {statsPreset === 'custom' && (
                <div className="custom-date-row">
                  <label>
                    From
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd || undefined}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart || undefined}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="date-range-apply-btn"
                    onClick={loadMessageStats}
                    disabled={!customStart || !customEnd}
                  >
                    Apply
                  </button>
                </div>
              )}

              {statsLoading && (
                <div className="message-chart-skeleton">Loading message statistics…</div>
              )}

              {!statsLoading && statsError && (
                <div className="message-chart-error">⚠️ {statsError}</div>
              )}

              {!statsLoading && !statsError && messageStats && (
                <>
                  <div className="message-summary-pills">
                    <span className="message-summary-pill">
                      Total: <strong>{Number(messageStats.totals?.total ?? (Number(messageStats.totals?.sent || 0) + Number(messageStats.totals?.error || 0))).toLocaleString()}</strong>
                    </span>
                    <span className="message-summary-pill pill-sent">
                      Sent: <strong>{Number(messageStats.totals?.sent || 0).toLocaleString()}</strong>
                    </span>
                    <span className="message-summary-pill pill-delivered">
                      Delivered: <strong>{Number(messageStats.totals?.delivered || 0).toLocaleString()}</strong>
                    </span>
                    <span className="message-summary-pill pill-read">
                      Read: <strong>{Number(messageStats.totals?.read || 0).toLocaleString()}</strong>
                    </span>
                    <span className="message-summary-pill pill-error">
                      Error: <strong>{Number(messageStats.totals?.error || 0).toLocaleString()}</strong>
                    </span>
                  </div>

                  {Array.isArray(messageStats.daily) && messageStats.daily.length > 0 ? (
                    <>
                      <div className="message-chart-container">
                        {(() => {
                          const maxBarHeight = 200
                          const maxTotal = Math.max(
                            1,
                            ...messageStats.daily.map(d => Number(d.sent || 0) + Number(d.error || 0))
                          )
                          return messageStats.daily.map((d, idx) => {
                            // Sent/delivered/read are cumulative lifecycle
                            // metrics. Make exclusive segments for a truthful
                            // stacked bar where each message appears once.
                            const readCount = Math.max(0, Number(d.read || 0))
                            const deliveredOnly = Math.max(0, Number(d.delivered || 0) - readCount)
                            const sentOnly = Math.max(0, Number(d.sent || 0) - Number(d.delivered || 0))
                            const errorCount = Math.max(0, Number(d.error || 0))
                            const total = Number(d.sent || 0) + errorCount
                            const barHeight = total > 0 ? Math.max(6, Math.round((total / maxTotal) * maxBarHeight)) : 2
                            const segments = [
                              { key: 'sent', value: sentOnly, cls: 'segment-sent' },
                              { key: 'delivered', value: deliveredOnly, cls: 'segment-delivered' },
                              { key: 'read', value: readCount, cls: 'segment-read' },
                              { key: 'error', value: errorCount, cls: 'segment-error' }
                            ]
                            // Parse a date-only API value as a local calendar
                            // date, not as UTC midnight (which displayed the
                            // previous day in some browser timezones).
                            const dateParts = String(d.date || '').split('-').map(Number)
                            const labelDate = dateParts.length === 3 && dateParts.every(Number.isFinite)
                              ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
                              : null
                            const label = labelDate
                              ? labelDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                              : `#${idx + 1}`
                            return (
                              <div className="message-chart-col" key={d.date || idx}>
                                <div className="message-chart-total">{total.toLocaleString()}</div>
                                <div
                                  className="message-chart-bar-wrap"
                                  data-summary={`${label} — Sent: ${d.sent || 0}, Delivered: ${d.delivered || 0}, Read: ${d.read || 0}, Error: ${d.error || 0}`}
                                >
                                  <div className="message-chart-bar" style={{ height: `${barHeight}px` }}>
                                    {segments.map(seg => {
                                      const cumulativeValue = seg.key === 'sent'
                                        ? Number(d.sent || 0)
                                        : seg.key === 'delivered'
                                          ? Number(d.delivered || 0)
                                          : seg.key === 'read'
                                            ? Number(d.read || 0)
                                            : Number(d.error || 0)
                                      const statusLabel = seg.key === 'error' ? 'ERROR' : seg.key.toUpperCase()
                                      return seg.value > 0 && total > 0 && (
                                        <div
                                          key={seg.key}
                                          className={`message-chart-segment ${seg.cls}`}
                                          style={{ height: `${Math.max(1, Math.round((seg.value / total) * barHeight))}px` }}
                                          data-date={label}
                                          data-status={statusLabel}
                                          data-value={cumulativeValue.toLocaleString()}
                                          aria-label={`${label}, ${statusLabel}: ${cumulativeValue.toLocaleString()}`}
                                          tabIndex="0"
                                        />
                                      )
                                    })}
                                  </div>
                                </div>
                                <div className="message-chart-label">{label}</div>
                              </div>
                            )
                          })
                        })()}
                      </div>

                      <div className="message-chart-legend">
                        <span><span className="legend-dot dot-sent" />Sent</span>
                        <span><span className="legend-dot dot-delivered" />Delivered</span>
                        <span><span className="legend-dot dot-read" />Read</span>
                        <span><span className="legend-dot dot-error" />Error</span>
                      </div>
                    </>
                  ) : (
                    <div className="message-chart-skeleton">No message data for the selected range.</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Key Metric Live Stats Grid & Quick Actions Launchpad (Visible only to Admin / Super Admin) */}
          {isAdminUser && (
            <>
              {/* Key Metric Live Stats Grid */}
              <div className="kpi-grid">

                {/* Templates KPI — hidden for team members without template permission */}
                {canSeeTemplates && (
                  <div className="kpi-card kpi-card-sky">
                    <div className="kpi-card-header">
                      <div className="kpi-label">TEMPLATES</div>
                      <div className="kpi-icon-wrapper">📄</div>
                    </div>
                    <div className="kpi-value">{stats.templates_count || 0}</div>
                    <div className="kpi-footer">
                      <span className="kpi-trend-up">★ Approved</span>
                      <span>Official Meta templates</span>
                    </div>
                  </div>
                )}

                {/* Credits / Subscription — owner-only, not shown to team members */}
                {canSeeCredits && (
                  accessTypeInfo.isDaysBased ? (
                    <div
                      className="kpi-card"
                      style={{
                        background: accessTypeInfo.daysStatus === 'Expired' || (accessTypeInfo.remainingDays !== null && accessTypeInfo.remainingDays <= 0)
                          ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                          : (accessTypeInfo.remainingDays !== null && accessTypeInfo.remainingDays <= 5)
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                            : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff'
                      }}
                    >
                      <div className="kpi-card-header">
                        <div className="kpi-label" style={{ color: '#e0f2fe' }}>SUBSCRIPTION VALIDITY</div>
                        <div className="kpi-icon-wrapper">
                          {accessTypeInfo.remainingDays !== null && accessTypeInfo.remainingDays <= 0 ? '🔴' : (accessTypeInfo.remainingDays !== null && accessTypeInfo.remainingDays <= 5 ? '⏳' : '📅')}
                        </div>
                      </div>
                      <div className="kpi-value" style={{ color: '#ffffff' }}>
                        {accessTypeInfo.remainingDays != null
                          ? (accessTypeInfo.remainingDays <= 0 ? 'Expired' : `${accessTypeInfo.remainingDays} ${accessTypeInfo.remainingDays === 1 ? 'Day' : 'Days'} Left`)
                          : 'Active'}
                      </div>
                      <div className="kpi-footer" style={{ color: '#e0f2fe' }}>
                        <span>
                          {accessTypeInfo.expiryDate
                            ? `Expires: ${new Date(accessTypeInfo.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${!String(accessTypeInfo.expiryDate).includes(':') ? ', 11:59 PM' : ''}`
                            : 'Active Subscription'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="kpi-card kpi-card-amber">
                      <div className="kpi-card-header">
                        <div className="kpi-label">TOTAL CREDITS</div>
                        <div className="kpi-icon-wrapper">💳</div>
                      </div>
                      <div className="kpi-value">
                        {userCredits === 'Unlimited' ? '♾️ Unlimited' : Number(userCredits || 0).toLocaleString()}
                      </div>
                      {userCredits === 'Unlimited' ? (
                        <div className="kpi-footer">
                          <span className="kpi-trend-up">∞ Unlimited</span>
                          <span>All features active</span>
                        </div>
                      ) : userFeatureCredits ? (
                        <div className="credits-pill-group">
                          <span className="credit-pill">Quick: <strong>{userFeatureCredits.quick || 0}</strong></span>
                          <span className="credit-pill">CSV: <strong>{userFeatureCredits.csv || 0}</strong></span>
                          <span className="credit-pill">Tags: <strong>{userFeatureCredits.tags || 0}</strong></span>
                          <span className="credit-pill">Group: <strong>{userFeatureCredits.group || 0}</strong></span>
                          <span className="credit-pill">Birthday: <strong>{userFeatureCredits.birthday || 0}</strong></span>
                        </div>
                      ) : (
                        <div className="kpi-footer">
                          <span className="kpi-trend-up">Credits</span>
                          <span>Available balance</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Quick Actions Launchpad (Filtered by Permissions) */}
              <div className="quick-actions-section">
                <h3 className="quick-actions-title">⚡ Quick Actions & Launchpad</h3>
                <div className="quick-actions-grid">
                  {(isAdminUser || hasPermission('campaign') || hasPermission('sendWa')) && (
                    <Link to="/send-wa/quick" className="quick-action-btn">
                      <div className="quick-action-icon icon-indigo">💬</div>
                      <span>Send Quick Message</span>
                    </Link>
                  )}

                  {(isAdminUser || hasPermission('bulk_sender') || hasPermission('sendWa')) && (
                    <Link to="/send-wa/csv" className="quick-action-btn">
                      <div className="quick-action-icon icon-emerald">📊</div>
                      <span>Send CSV Campaign</span>
                    </Link>
                  )}

                  {(isAdminUser || hasPermission('contacts') || hasPermission('sendWa')) && (
                    <Link to="/send-wa/tags" className="quick-action-btn">
                      <div className="quick-action-icon icon-sky">🏷️</div>
                      <span>Send By Contact Tags</span>
                    </Link>
                  )}

                  {(isAdminUser || hasPermission('templates') || hasPermission('template')) && (
                    <Link to="/template/manage" className="quick-action-btn">
                      <div className="quick-action-icon icon-amber">📝</div>
                      <span>Manage Templates</span>
                    </Link>
                  )}

                  {(isAdminUser || hasPermission('inbox') || hasPermission('chat')) && (
                    <Link to="/chat" className="quick-action-btn">
                      <div className="quick-action-icon icon-purple">📥</div>
                      <span>Open Live Chat Inbox</span>
                    </Link>
                  )}

                  {(isAdminUser || hasPermission('catalog')) && (
                    <Link to="/catalog" className="quick-action-btn">
                      <div className="quick-action-icon icon-emerald" style={{ background: '#ecfdf5', color: '#059669' }}>📖</div>
                      <span>Product Catalog</span>
                    </Link>
                  )}
                </div>
              </div>

            </>
          )}
        </>
      )}

      {/* Add User Modal with Perfect Responsive Sizing */}
      {showAddUserModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '740px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            {/* Fixed Header */}
            <div style={{
              padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Add New User & Select Access
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Create credentials and assign specific sidebar access permissions for this user.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                style={{
                  background: 'none', border: 'none', fontSize: '18px',
                  cursor: 'pointer', color: '#64748b', padding: '4px 8px',
                  borderRadius: '6px', lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={handleCreateUserSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}
            >
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {userErrorMsg && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                    {userErrorMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Username <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. john_doe"
                      value={userFormData.username}
                      onChange={(e) => setUserFormData(p => ({ ...p, username: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData(p => ({ ...p, password: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={userFormData.full_name}
                      onChange={(e) => setUserFormData(p => ({ ...p, full_name: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Role
                    </label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData(p => ({ ...p, role: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                    >
                      <option value="User">User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData(p => ({ ...p, email: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Sidebar Access Selection with Granular Sub-Features */}
                <ModuleAccessSelector
                  selectedKeys={userFormData.allowed_modules}
                  onChange={(keys) => setUserFormData(p => ({ ...p, allowed_modules: keys }))}
                />
              </div>

              {/* Sticky Footer */}
              <div style={{
                padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  style={{
                    padding: '9px 18px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    background: '#ffffff', color: '#475569', fontWeight: 600, fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingUser}
                  style={{
                    padding: '9px 22px', borderRadius: '8px', border: 'none',
                    background: '#16a34a', color: '#ffffff', fontWeight: 700, fontSize: '13px',
                    cursor: 'pointer', opacity: creatingUser ? 0.7 : 1,
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                  }}
                >
                  {creatingUser ? 'Creating...' : 'Create User & Save Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
