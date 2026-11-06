import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { IconUser, IconLock, IconEye, IconEyeOff } from '../components/icons.jsx'
import './Login.css'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [revokedMessage, setRevokedMessage] = useState(() => {
    const msg = sessionStorage.getItem('access_revoked_message');
    if (msg) {
      sessionStorage.removeItem('access_revoked_message');
      return msg;
    }
    return '';
  })
  const { login, error, loading } = useAuth()
  const { hideLoader } = useLoading()
  const navigate = useNavigate()

  useEffect(() => {
    // Dismiss any pending or stuck loading state immediately on landing on the login page
    hideLoader(true)
  }, [hideLoader])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setRevokedMessage('')
    const ok = await login(identifier, password)
    if (ok) navigate('/')
  }

  return (
    <div className="login-page-root">
      {/* Dynamic Animated Glassmorphism Orbs */}
      <div className="login-orb login-orb-1"></div>
      <div className="login-orb login-orb-2"></div>
      <div className="login-orb login-orb-3"></div>
      <div className="login-orb login-orb-4"></div>

      {/* Glassmorphism Card */}
      <div className="login-glass-card">

        {/* Header with WhatsApp SaaS Branding */}
        <div className="login-header-wrap">
          <div className="login-brand-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div className="login-badge-pill">
            <span>●</span> Official WABA Cloud SaaS
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to access your business dashboard</p>
        </div>

        {/* Revocation / Session Alert */}
        {revokedMessage && (
          <div style={{
            background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b',
            padding: '12px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <span style={{ fontSize: '16px' }}>🚫</span>
            <span>{revokedMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="login-error-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-group">
            <label className="login-label" htmlFor="login-identifier">Username or Email</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <IconUser width={18} height={18} />
              </span>
              <input
                id="login-identifier"
                className="login-input"
                type="text"
                placeholder="Enter username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <IconLock width={18} height={18} />
              </span>
              <input
                id="login-password"
                className="login-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In to Dashboard'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
