import React, { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function Layout({ title, children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} />
      <div className="main-area">
        <Topbar title={title} onToggleSidebar={() => setCollapsed((c) => !c)} />
        {children}
      </div>
    </div>
  )
}
