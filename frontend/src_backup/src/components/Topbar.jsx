import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { IconMenu, IconBell } from './icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Topbar({ onToggleSidebar, title }) {
  const { user, logout } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
          <IconMenu />
        </button>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-right">
        <button className="bell-btn" aria-label="Notifications">
          <IconBell />
        </button>
        <div className="avatar" title={user?.name || 'admin'} onClick={logout}>
          {(user?.name || 'A').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
