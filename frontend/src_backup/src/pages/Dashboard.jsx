import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout.jsx'
import OutgoingChart from '../components/OutgoingChart.jsx'
import { IconUser, IconPhone } from '../components/icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { API_BASE_URL } from '../config.js'

export default function Dashboard() {
  const { user, token } = useAuth()
  const [stats, setStats] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch(`${API_BASE_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to load dashboard')
        if (!cancelled) setStats(data)
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not reach the server')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (token) loadDashboard()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <Layout title="Dashboards">
      <div className="dashboard-content">
        <p className="notice-bar">
          From 1st July, 2025. Meta change rate as per Message instead of per conversion before, so every message will be chargeable.
        </p>

        <div className="greeting-row">
          <h2>Hello, {user?.name || 'there'}</h2>
          <div className="greeting-actions">
            <button className="pill-btn green">Signup with Facebook</button>
            <button className="pill-btn teal">Signup with Existing Whatsapp Bussiness</button>
          </div>
        </div>

        {loading && <p style={{ color: '#9296ab' }}>Loading dashboard data...</p>}

        {loadError && (
          <div className="error-banner">
            {loadError}. Make sure the backend server is running (`npm run dev` inside /backend) and MySQL/XAMPP is started.
          </div>
        )}

        {stats && (
          <>
            <div className="stats-row">
              <div className="license-card">
                <div className="icon-box">
                  <IconUser />
                </div>
                <div>
                  <div className="label">License:</div>
                  <div className="value">{stats.license}</div>
                </div>
              </div>

              <div className="stat-card orange">
                <div className="stat-head">Total Templates</div>
                <div className="stat-body">{stats.templates.total}</div>
                <div className="badge-row">
                  <span className="badge green">APPROVED: {stats.templates.approved}</span>
                  <span className="badge purple">REJECTED: {stats.templates.rejected}</span>
                </div>
              </div>

              <div className="stat-card teal">
                <div className="stat-head">Total Incoming Message</div>
                <div className="stat-body">
                  <span>{stats.incoming.today}</span>
                  <span>{stats.incoming.last7}</span>
                </div>
                <div className="stat-foot">
                  <span>today</span>
                  <span>last 7 days</span>
                </div>
              </div>

              <div className="stat-card red">
                <div className="stat-head">Total Outgoing Message</div>
                <div className="stat-body">
                  <span>{stats.outgoing.today}</span>
                  <span>{stats.outgoing.last7}</span>
                </div>
                <div className="stat-foot">
                  <span>today</span>
                  <span>last 7 days</span>
                </div>
              </div>
            </div>

            <div className="company-card">
              <div className="company-name">{stats.company.name}</div>
              <div className="company-phone">
                <IconPhone style={{ verticalAlign: 'middle', marginRight: 6 }} width={16} height={16} />
                {stats.company.phone}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-head">
                <h3>Outgoing Messages</h3>
              </div>
              <div className="chart-card-body">
                <OutgoingChart data={stats.chart} />
              </div>
            </div>

            <div className="bottom-cards">
              <div className="mini-card">
                <div className="mini-label">DURATION</div>
                <div className="mini-value">{stats.duration}</div>
                <button className="topup-btn">Top Up Now</button>
              </div>
              <div className="mini-card">
                <div className="mini-label">WAPP</div>
                <div className="mini-value">{stats.wapp}</div>
                <button className="topup-btn">Top Up Now</button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
