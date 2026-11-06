import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { IconUser, IconMail, IconLock, IconEye, IconEyeOff } from '../components/icons.jsx'

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Australia']

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    country: 'India',
    referral: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const { register, error, loading } = useAuth()
  const navigate = useNavigate()

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setNotice('')
    const ok = await register(form)
    if (ok) {
      setNotice('Account created! Redirecting to login...')
      setTimeout(() => navigate('/login'), 1200)
    }
  }

  return (
    <div className="auth-screen">
      {/* Glassmorphism ambient background decor */}
      <div className="auth-bg-orb orb-1"></div>
      <div className="auth-bg-orb orb-2"></div>
      <div className="auth-bg-orb orb-3"></div>

      <div className="auth-card glass-morphism">
        <h1>Register</h1>
        <p className="auth-subtitle">
          Already have an account? <Link to="/login">Log in</Link>
        </p>

        {error && <div className="error-banner">{error}</div>}
        {notice && (
          <div className="error-banner" style={{ background: '#eafaf3', color: '#1abc9c', borderColor: '#bdeede' }}>
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <div className="input-wrap">
              <IconUser width={16} height={16} />
              <input type="text" placeholder="Your Name" value={form.name} onChange={update('name')} required />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <div className="input-wrap">
              <IconMail width={16} height={16} />
              <input type="email" placeholder="Email" value={form.email} onChange={update('email')} required />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrap">
              <IconLock width={16} height={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={form.password}
                onChange={update('password')}
                required
              />
              <button type="button" className="eye-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <IconEyeOff width={16} height={16} /> : <IconEye width={16} height={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Mobile</label>
            <div className="input-wrap">
              <input
                type="tel"
                placeholder="10 digit mobile number"
                maxLength={10}
                value={form.mobile}
                onChange={update('mobile')}
                style={{ paddingLeft: 14 }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Country</label>
            <div className="input-wrap">
              <select value={form.country} onChange={update('country')}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Referral Code (optinal)</label>
            <div className="input-wrap">
              <input type="text" placeholder="enter referral code" value={form.referral} onChange={update('referral')} style={{ paddingLeft: 14 }} />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Get Started!'}
          </button>
        </form>
      </div>
    </div>
  )
}
