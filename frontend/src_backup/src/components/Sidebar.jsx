import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './Sidebar.css'
import {
  IconDashboard,
  IconSend,
  IconReports,
  IconChat,
  IconBot,
  IconApi,
  IconTemplate,
  IconSetting,
  IconReseller,
} from './icons.jsx'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboards', icon: IconDashboard, end: true },
  { to: '/chat', label: 'Chat', icon: IconChat },
  { to: '/api', label: 'API', icon: IconApi },
]

const DROPDOWN_MAP = [
  {
    key: 'sendWa', label: 'SEND WA', icon: IconSend, items: [
      { to: '/send-wa/quick', label: 'Send Quick Campaign' },
      { to: '/send-wa/csv', label: 'Send CSV Campaign' },
      { to: '/send-wa/tags', label: 'Send By Tags' },
      { to: '/send-wa/group', label: 'Send By Group' },
      { to: '/send-wa/birthday', label: 'Send BirthDay Campaign' },
    ]
  },
  {
    key: 'reports', label: 'Reports', icon: IconReports, items: [
      { to: '/reports/sending-history', label: 'Sending History' },
      { to: '/reports/scheduled-log', label: 'Scheduled Log' },
      { to: '/reports/ads-referral', label: 'Ads Referral Report' },
      { to: '/reports/tagging-numbers', label: 'Tagging Numbers' },
      { to: '/reports/whatsapp-forms', label: 'Whatsapp Forms' },
      { to: '/reports/flow-template-responses', label: 'Flow Template Responses' },
    ]
  },
  {
    key: 'chatbot', label: 'ChatBot', icon: IconBot, items: [
      { to: '/chatbot', label: 'ChatBot' },
      { to: '/chatbot/flow', label: 'ChatBot Flow' },
    ]
  },
  {
    key: 'template', label: 'Template', icon: IconTemplate, items: [
      { to: '/template/manage', label: 'Manage Official Template' },
    ]
  },
  {
    key: 'setting', label: 'Setting', icon: IconSetting, items: [
      { to: '/setting/manage-numbers', label: 'Manage Official Numbers' },
      { to: '/setting/optout', label: 'OptOut/BlackList' },
      { to: '/setting/tags', label: 'Tags' },
      { to: '/setting/manage-agent', label: 'Manage Agent' },
      { to: '/setting/agent-report', label: 'Agent Report' },
      { to: '/setting/catalog-orders', label: 'Catalog Orders' },
      { to: '/setting/qr-generator', label: 'QR Generator' },
    ]
  },
  {
    key: 'reseller', label: 'Reseller', icon: IconReseller, items: [
      { to: '/reseller/manage-user', label: 'Manage User' },
      { to: '/reseller/manage-credit', label: 'Manage Credit' },
      { to: '/reseller/credit-history', label: 'Credit History' },
      { to: '/reseller/credit-licence', label: 'Credit Licence' },
      { to: '/reseller/duration-licence', label: 'Duration Licence' },
      { to: '/reseller/voucher-manage', label: 'Voucher Manage' },
    ]
  },
]

function getItemPaths(items) {
  return items.map((item) => item.to)
}

export default function Sidebar({ collapsed }) {
  const location = useLocation()
  const [openDropdown, setOpenDropdown] = useState(null)

  useEffect(() => {
    const path = location.pathname
    for (const dd of DROPDOWN_MAP) {
      const itemPaths = getItemPaths(dd.items)
      if (itemPaths.some((p) => path.startsWith(p))) {
        setOpenDropdown(dd.key)
        return
      }
    }
    setOpenDropdown(null)
  }, [location.pathname])

  const toggleDropdown = (key) => {
    setOpenDropdown((prev) => (prev === key ? null : key))
  }

  const isDropdownOpen = (key) => openDropdown === key

  const scrollRefs = useRef({})

  useEffect(() => {
    if (openDropdown && scrollRefs.current[openDropdown]) {
      scrollRefs.current[openDropdown].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [openDropdown])

  const isDropdownActive = (items) => {
    const path = location.pathname
    return items.some((item) => path.startsWith(item.to))
  }

  const isItemActive = (to) => {
    const path = location.pathname
    if (to === '/') return path === '/'
    return path.startsWith(to)
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="logo-dot">W</div>
        <span>OfficialWA</span>
      </div>
      <nav className="sidebar-nav">
        {DROPDOWN_MAP.map((dd) => {
          const isOpen = isDropdownOpen(dd.key)
          const isActive = isDropdownActive(dd.items)
          return (
            <div key={`dd-${dd.key}`} className="nav-item-dropdown" ref={(el) => (scrollRefs.current[dd.key] = el)}>
              <button
                className={`nav-item dropdown-toggle${isOpen ? ' active' : ''}`}
                onClick={() => toggleDropdown(dd.key)}
                title={dd.label}
              >
                <dd.icon />
                <span>{dd.label}</span>
                <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={`dropdown-menu${isOpen ? ' open' : ''}`}>
                <div className="dropdown-menu-inner">
                  {dd.items.map(({ to: itemTo, label: itemLabel }) => (
                    <NavLink
                      key={itemTo}
                      to={itemTo}
                      className={({ isActive: navIsActive }) =>
                        `dropdown-item${isItemActive(itemTo) ? ' active' : ''}`
                      }
                    >
                      {itemLabel}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">v1.0 &middot; officialwa.in</div>
    </aside>
  )
}