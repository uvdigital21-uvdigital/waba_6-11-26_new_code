import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { IconUser, IconLock, IconEye } from '../components/icons.jsx'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, error, loading } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(identifier, password)
    if (ok) navigate('/')
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Log In</h1>
        <p className="auth-subtitle">Sign in to access your dashboard</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <div className="input-wrap">
              <IconUser width={16} height={16} />
              <input
                type="text"
                placeholder="e.g abc@xyz.com  (try: admin)"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label>Password</label>
              <span className="forgot">Forgot Password?</span>
            </div>
            <div className="input-wrap">
              <IconLock width={16} height={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password  (try: 123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label="Toggle password visibility"
              >
                <IconEye width={16} height={16} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="auth-footer">
          Not registered ? <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  )
}
