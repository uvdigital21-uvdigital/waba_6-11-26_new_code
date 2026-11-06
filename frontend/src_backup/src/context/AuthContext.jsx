import React, { createContext, useContext, useState } from 'react'
import { API_BASE_URL } from '../config.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('wa_dashboard_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('wa_dashboard_token'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Calls the Node.js/Express backend, which checks the `users` table
  // in MySQL (see database/schema.sql) and returns a JWT token.
  const login = async (username, password) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
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
      setError('Could not reach the server. Is the backend running on port 5000?')
      return false
    } finally {
      setLoading(false)
    }
  }

  const register = async (payload) => {
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

      return true
    } catch (err) {
      setError('Could not reach the server. Is the backend running on port 5000?')
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('wa_dashboard_user')
    localStorage.removeItem('wa_dashboard_token')
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, error, setError, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
