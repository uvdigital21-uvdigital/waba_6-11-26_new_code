import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IconMenu, IconBell } from './icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { API_BASE_URL, getImageUrl } from '../config.js'

export default function Topbar({ onToggleSidebar, title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileRef = useRef(null)

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileMenu])

  const handleProfileInfo = () => {
    setShowProfileMenu(false)
    navigate('/profile-info')
  }

  const handleChangePassword = () => {
    setShowProfileMenu(false)
    navigate('/change-password')
  }

  const handleLogout = () => {
    setShowProfileMenu(false)
    logout()
  }

  const userDisplayName = user?.full_name || user?.name || user?.username || 'User'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
          <IconMenu />
        </button>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-right">

        {/* Profile Avatar with Dropdown */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div
            className="topbar-logo-button"
            title={userDisplayName}
            onClick={() => setShowProfileMenu(prev => !prev)}
            style={{ cursor: 'pointer', overflow: 'hidden' }}
          >
            <img
              className="topbar-brand-logo"
              src={getImageUrl(user?.app_logo || '/uploads/image.png')}
              alt="Logo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = getImageUrl('/uploads/image.png');
              }}
            />
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown">
              {/* Header displaying Name */}
              <div className="profile-dropdown-header" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="profile-dropdown-welcome">Welcome {userDisplayName}</span>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
                  @{user?.username} • {user?.is_team_member ? `${user.role} (Staff)` : (user?.role || 'Owner')}
                </span>
              </div>

              {/* Menu Items */}
              <button className="profile-menu-item" onClick={handleProfileInfo}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Profile Info
              </button>

              <div className="profile-menu-separator" />

              <button className="profile-menu-item" onClick={handleChangePassword}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Change Password
              </button>

              <div className="profile-menu-separator" />

              <button className="profile-menu-item profile-menu-logout" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
