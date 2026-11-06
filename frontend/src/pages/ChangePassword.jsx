import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'
import api from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function EyeIcon({ hidden }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 8 9 8a16.8 16.8 0 0 1-2.1 3.2M6.6 6.6C4.4 8 3 12 3 12s3.5 8 9 8c1.5 0 2.8-.6 4-1.4"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8z"/><circle cx="12" cy="12" r="3"/></svg>
  )
}

export default function ChangePassword() {
  const { setTitle } = useTitle()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' }) // type: 'success' | 'error'
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false })
  const [sessions, setSessions] = useState([])
  const [activeCount, setActiveCount] = useState(0)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState('')

  const loadSessions = async (attempt = 0) => {
    setSessionsLoading(true)
    setSessionsError('')
    try {
      const { data } = await api.get('/auth/sessions', { silent: true })
      setSessions(data.sessions || [])
      setActiveCount(data.active_count || 0)
    } catch (err) {
      if (attempt < 2 && !err.response) {
        window.setTimeout(() => loadSessions(attempt + 1), 1200)
      } else {
        setSessionsError(err.response?.data?.message || 'Could not load login systems. Please try again.')
      }
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => { 
    setTitle('Change Password') 
    loadSessions()
  }, [setTitle, isAdmin])

  const sessionAction = async (session, action) => {
    const verb = action === 'block' ? 'permanently block this device' : action === 'unblock' ? 'unblock this device' : 'log out this system'
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return
    try {
      const { data } = await api.post(`/auth/sessions/${session.id}/${action}`)
      setMessage({ text: data.message, type: 'success' })
      if (session.is_current) {
        localStorage.removeItem('wa_dashboard_token')
        localStorage.removeItem('wa_dashboard_user')
        navigate('/login?revoked=true')
        return
      }
      await loadSessions()
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Session action failed.', type: 'error' })
    }
  }

  const renameDevice = async (session) => {
    const deviceName = window.prompt('Enter a name that will help you identify this device:', session.device_name || '')
    if (deviceName === null) return
    const cleanName = deviceName.trim().replace(/\s+/g, ' ')
    if (cleanName.length < 2) {
      setMessage({ text: 'Device name must contain at least 2 characters.', type: 'error' })
      return
    }
    try {
      const { data } = await api.patch(`/auth/sessions/${session.id}/name`, { deviceName: cleanName })
      setMessage({ text: data.message, type: 'success' })
      await loadSessions()
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Could not rename device.', type: 'error' })
    }
  }

  const deleteSession = async (session) => {
    const detail = session.is_current
      ? 'This is your current session. Deleting it will log you out immediately.'
      : session.status === 'Blocked'
        ? 'Deleting this blocked session will also remove its permanent device block.'
        : 'This session will be permanently removed from the list.'
    if (!window.confirm(`${detail}\n\nAre you sure you want to delete it?`)) return
    try {
      const { data } = await api.delete(`/auth/sessions/${session.id}`)
      if (session.is_current) {
        localStorage.removeItem('wa_dashboard_token')
        localStorage.removeItem('wa_dashboard_user')
        navigate('/login?revoked=true')
        return
      }
      setMessage({ text: data.message, type: 'success' })
      await loadSessions()
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Could not delete session.', type: 'error' })
    }
  }

  const passwordInput = (key, id, label, placeholder, value, setter, autoComplete) => (
    <div className="chpw-form-group">
      <label className="chpw-label" htmlFor={id}>{label} <span className="chpw-required">*</span></label>
      <div className="chpw-input-wrap">
        <input id={id} type={visible[key] ? 'text' : 'password'} className="chpw-input" placeholder={placeholder}
          value={value} onChange={e => setter(e.target.value)} autoComplete={autoComplete} />
        <button type="button" className="chpw-eye" onClick={() => setVisible(p => ({ ...p, [key]: !p[key] }))}
          aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible[key]}>
          <EyeIcon hidden={!visible[key]} />
        </button>
      </div>
    </div>
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ text: '', type: '' })

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ text: 'New Password must be at least 6 characters.', type: 'error' })
      return
    }
    if (currentPassword === newPassword) {
      setMessage({ text: 'New Password must be different from Current Password.', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New Password and Confirm Password do not match.', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      })

      if (response.data && response.data.success) {
        setMessage({ 
          text: response.data.message || 'Password changed successfully. Please login again with your new password.', 
          type: 'success' 
        })

        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        // Cleanly clear session and redirect to login after 2 seconds
        setTimeout(() => {
          localStorage.removeItem('wa_dashboard_token')
          localStorage.removeItem('wa_dashboard_user')
          navigate('/login')
        }, 2000)
      } else {
        setMessage({ 
          text: response.data?.message || 'Failed to change password.', 
          type: 'error' 
        })
      }
    } catch (err) {
      console.error('[ChangePassword] Request error:', err)
      const errorMsg = err.response?.data?.message || (err.response ? 'Failed to change password.' : 'Could not reach the server. Please try again.')
      setMessage({ text: errorMsg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chpw-page">
      <div className="chpw-card">

        {/* Header */}
        <div className="chpw-header">
          <div className="chpw-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="chpw-title">Change Password</h1>
        </div>

        {/* Form */}
        <form className="chpw-form" onSubmit={handleSubmit}>

          {message.text && (
            <div className={`chpw-alert chpw-alert-${message.type}`}>
              {message.text}
            </div>
          )}

          {passwordInput('current', 'chpw-current', 'CURRENT PASSWORD', 'Enter Current Password', currentPassword, setCurrentPassword, 'current-password')}
          {passwordInput('next', 'chpw-new', 'NEW PASSWORD', 'Enter New Password (min 6 chars)', newPassword, setNewPassword, 'new-password')}
          {passwordInput('confirm', 'chpw-confirm', 'CONFIRM PASSWORD', 'Enter Password Again', confirmPassword, setConfirmPassword, 'new-password')}

          <div className="chpw-submit-row">
            <button
              id="chpw-submit-btn"
              type="submit"
              className="btn-chpw-submit"
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>

        </form>
      </div>

        <section className="chpw-sessions-card">
          <div className="chpw-sessions-heading">
            <div><h2>Login Systems</h2><p>View and manage your active login sessions across devices.</p></div>
            <span className="chpw-count">{activeCount} active {activeCount === 1 ? 'system' : 'systems'}</span>
          </div>
          {sessionsLoading ? <div className="chpw-empty">Loading login systems...</div> : sessionsError ? (
            <div className="chpw-session-error">
              <span>{sessionsError}</span>
              <button type="button" onClick={() => loadSessions()}>Retry</button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="chpw-empty">No login systems found.</div>
          ) : (
            <div className="chpw-session-list">
              {sessions.map(session => (
                <div className="chpw-session" key={session.id}>
                  <div className="chpw-device-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
                  </div>
                  <div className="chpw-session-info">
                    <div className="chpw-device-name">{session.device_name || 'Unknown system'} {session.is_current && <span>Current</span>}</div>
                    <div className="chpw-session-meta">IP: {session.ip_address || 'Unknown'} &middot; Last active: {new Date(session.last_seen_at).toLocaleString()}</div>
                    <div className={`chpw-session-status chpw-status-${session.status.toLowerCase().replace(' ', '-')}`}>{session.status}</div>
                  </div>
                  <div className="chpw-session-actions">
                    <button type="button" className="chpw-rename-btn" onClick={() => renameDevice(session)}>Rename</button>
                    {session.status === 'Active' && <>
                      <button type="button" className="chpw-logout-btn" onClick={() => sessionAction(session, 'logout')}>Log out</button>
                      <button type="button" className="chpw-block-btn" onClick={() => sessionAction(session, 'block')}>Permanent block</button>
                    </>}
                    {session.status === 'Blocked' &&
                      <button type="button" className="chpw-unblock-btn" onClick={() => sessionAction(session, 'unblock')}>Unblock</button>}
                    <button type="button" className="chpw-delete-btn" onClick={() => deleteSession(session)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
    </div>
  )
}
