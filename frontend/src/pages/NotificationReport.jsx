import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import { API_BASE_URL } from '../config.js'
import './NotificationReport.css'

const DEFAULT_NOTIFICATIONS = [
  {
    id: 1,
    fromUser: 'vikram',
    header: 'vikram is opt out 919988780967 number',
    body: 'OPT-OUT:919988780967',
    type: 'OPT-OUT',
    time: '04-07-2026 09:38 am',
    timeAgo: '3 days ago',
    read: false,
  },
  {
    id: 2,
    fromUser: 'vikram',
    header: 'export.WhatsappMessage',
    body: 'whatsapp_6dwF2f5f8.csv',
    type: 'WhatsappMessage',
    time: '25-01-2026 04:04 pm',
    timeAgo: '2 months ago',
    read: false,
  },
  {
    id: 3,
    fromUser: 'vikram',
    header: 'TEMPLATE_CATAGORY_UPDATE',
    body: "dhanya_demo_util/s category updated from UTILITY to MARKETING",
    type: 'TEMPLATEUPDATE',
    time: '08-04-2026 10:13 am',
    timeAgo: '3 months ago',
    read: false,
  },
]

function loadNotifications() {
  const saved = localStorage.getItem('wa_notifications')
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return DEFAULT_NOTIFICATIONS
}

function saveNotifications(list) {
  localStorage.setItem('wa_notifications', JSON.stringify(list))
}

export default function NotificationReport() {
  const { setTitle } = useTitle()

  const [notifications, setNotifications] = useState([])
  const [activeAccount, setActiveAccount] = useState(null)
  const [typeFilter, setTypeFilter] = useState('ALL')   // ALL | OPT-OUT | WhatsappMessage | TEMPLATEUPDATE | success | info
  const [tabFilter, setTabFilter] = useState('ALL')     // ALL | Read | Unread
  const [entriesCount, setEntriesCount] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => { setTitle('Notification Report') }, [setTitle])

  // Load account-specific notifications from backend API
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const selectedId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id')
    const token = localStorage.getItem('wa_dashboard_token')

    if (token) {
      fetch(`${API_BASE_URL}/numbers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const list = data.numbers || data.data || []
          if (list.length > 0) {
            const match = selectedId ? list.find(a => a.id == selectedId) || list[0] : list[0]
            setActiveAccount(match)

            // Fetch specific notifications for active account
            fetch(`${API_BASE_URL}/whatsapp/${match.id}/notifications`, {
              headers: { Authorization: `Bearer ${token}` }
            })
              .then(nRes => nRes.json())
              .then(nData => {
                if (nData.success) {
                  const mapped = (nData.notifications || []).map(n => ({
                    id: n.id,
                    fromUser: match.name || match.verified_name || 'System',
                    header: n.title,
                    body: n.message,
                    type: n.type || 'info',
                    time: new Date(n.created_at).toLocaleString('en-IN'),
                    read: n.is_read === 1
                  }))
                  setNotifications(mapped)
                }
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }
  }, [])

  const handleMarkRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const handleMarkAllRead = async () => {
    if (!activeAccount) return
    const token = localStorage.getItem('wa_dashboard_token')
    try {
      await fetch(`${API_BASE_URL}/whatsapp/${activeAccount.id}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (e) {
      console.warn('Failed to mark all read:', e)
    }
  }

  // --- Filtering ---
  const filtered = notifications.filter(n => {
    const matchType = typeFilter === 'ALL' || n.type === typeFilter
    const matchTab = tabFilter === 'ALL'
      || (tabFilter === 'Read' && n.read)
      || (tabFilter === 'Unread' && !n.read)
    return matchType && matchTab
  })

  const totalEntries = filtered.length
  const startIndex = (currentPage - 1) * entriesCount
  const endIndex = Math.min(startIndex + entriesCount, totalEntries)
  const paginated = filtered.slice(startIndex, endIndex)
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesCount))

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="notif-page">
      <div className="notif-card">

        {/* Header Row */}
        <div className="notif-header-row">
          <div className="notif-header-left">
            <span className="notif-bell-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </span>
            <h1 className="notif-page-title">Notification Report</h1>
            <button className="btn-mark-all-read" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          </div>
          <div>
            <select
              className="notif-type-select"
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1) }}
            >
              <option value="ALL">Select Notification Type</option>
              <option value="OPT-OUT">OPT-OUT</option>
              <option value="WhatsappMessage">WhatsappMessage</option>
              <option value="TEMPLATEUPDATE">TEMPLATEUPDATE</option>
            </select>
          </div>
        </div>

        {/* Filters bar */}
        <div className="notif-filters-bar">
          <div className="notif-entries-select">
            Show
            <select
              value={entriesCount}
              onChange={e => { setEntriesCount(Number(e.target.value)); setCurrentPage(1) }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            entries
          </div>

          <div className="notif-tab-group">
            {['ALL', 'Read', 'Unread'].map(tab => {
              let cls = 'btn-notif-tab'
              if (tabFilter === tab) {
                if (tab === 'ALL') cls += ' tab-active'
                else if (tab === 'Read') cls += ' tab-read'
                else cls += ' tab-unread'
              }
              return (
                <button
                  key={tab}
                  className={cls}
                  onClick={() => { setTabFilter(tab); setCurrentPage(1) }}
                >
                  {tab}
                </button>
              )
            })}
            <span className="notif-date-badge">
              July 7, 2025 - July 7, 2026
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="notif-table-container">
          <table className="notif-data-table">
            <thead>
              <tr>
                <th></th>
                <th>From User</th>
                <th>Header</th>
                <th>Body</th>
                <th>Type</th>
                <th>Notification Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="7" className="notif-empty-row">No data available in table</td>
                </tr>
              ) : (
                paginated.map(n => (
                  <tr key={n.id}>
                    <td>
                      <span className={`notif-status-dot${n.read ? ' dot-read' : ''}`} />
                    </td>
                    <td>{n.fromUser}</td>
                    <td>{n.header}</td>
                    <td>{n.body}</td>
                    <td>{n.type}</td>
                    <td>
                      {n.time}
                      {n.timeAgo && (
                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: 4 }}>
                          ({n.timeAgo})
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-mark-read"
                        onClick={() => handleMarkRead(n.id)}
                        disabled={n.read}
                      >
                        {n.read ? 'Read' : 'Mark as Read'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="notif-table-footer">
          <div className="notif-showing-entries">
            Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of {totalEntries} entries
          </div>
          <div className="notif-pagination">
            <button
              className="btn-notif-pag"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                className={`btn-notif-pag${currentPage === num ? ' active' : ''}`}
                onClick={() => setCurrentPage(num)}
              >
                {num}
              </button>
            ))}
            <button
              className="btn-notif-pag"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
