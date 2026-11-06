import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { API_BASE_URL, getImageUrl } from '../config.js';
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
  IconCatalog,
} from './icons.jsx';
import './Sidebar.css';
import { useAuth } from '../context/AuthContext.jsx';

import { checkModuleAccess, SIDEBAR_MODULE_CONFIG } from '../config/modules.js';

const ALL_NAV_GROUPS = [
  {
    key: 'sendWa',
    permission: 'campaign',
    label: 'Send Campaigns',
    icon: IconSend,
    items: [
      { to: '/send-wa/quick', label: 'Quick Broadcast', permission: 'campaign', subKey: 'sendWa:quick' },
      { to: '/send-wa/csv', label: 'Upload CSV Campaign', permission: 'bulk_sender', subKey: 'sendWa:csv' },
      { to: '/send-wa/tags', label: 'Segment by Tags', permission: 'contacts', subKey: 'sendWa:tags' },
      { to: '/send-wa/group', label: 'Segment by Group', permission: 'contacts', subKey: 'sendWa:group' },
      { to: '/send-wa/birthday', label: 'Birthday Automation', permission: 'campaign', subKey: 'sendWa:birthday' },
    ],
  },
  {
    key: 'reports',
    permission: 'reports',
    label: 'Report Insights',
    icon: IconReports,
    items: [
      { to: '/reports/sending-history', label: 'Message History', permission: 'reports', subKey: 'reports:history' },
      { to: '/reports/scheduled-log', label: 'Scheduled Campaigns', permission: 'reports', subKey: 'reports:scheduled' },
    ],
  },
  {
    key: 'followup',
    permission: 'followup',
    label: 'Follow-ups',
    icon: IconBot,
    to: '/followup',
    subKey: 'followup:manage',
  },
  {
    key: 'template',
    permission: 'templates',
    label: 'Official Templates',
    icon: IconTemplate,
    to: '/template/manage',
    subKey: 'template:manage',
  },
  {
    key: 'chat',
    permission: 'inbox',
    label: 'Chat Inbox',
    icon: IconChat,
    to: '/chat',
    subKey: 'chat:inbox',
  },
  {
    key: 'chatbot',
    permission: 'chatbot',
    label: 'Chatbot Flow',
    icon: IconBot,
    items: [
      { to: '/chatbot', label: 'ChatBot', permission: 'chatbot', subKey: 'chatbot:flow' },
    ],
  },
  {
    key: 'api',
    permission: 'api',
    label: 'Developer API',
    icon: IconApi,
    to: '/developer/api',
    subKey: 'api:developer',
  },
  {
    key: 'setting',
    permission: 'settings',
    label: 'Settings',
    icon: IconSetting,
    items: [
      { to: '/setting/manage-numbers', label: 'WhatsApp Numbers', permission: 'whatsapp_numbers', subKey: 'setting:numbers' },
      { to: '/setting/optout-blacklist', label: 'Opt-out/BlackList', permission: 'settings', subKey: 'setting:blacklist' },
      { to: '/setting/tags', label: 'Contact Tags', permission: 'contacts', subKey: 'setting:tags' },
      { to: '/setting/meta-billing', label: 'Meta Billing & Insights', permission: 'settings', subKey: 'setting:billing' },
      { to: '/settings/team-members', label: 'Team Members', permission: 'settings', subKey: 'setting:team_members' },
    ],
  },
  {
    key: 'reseller',
    permission: 'team',
    label: 'User Management & Access',
    icon: IconReseller,
    items: [
      { to: '/manage-users', label: 'Manage Users', permission: 'team', subKey: 'reseller:users' },
      { to: '/reseller/assign-credit', label: 'Assign Credit', permission: 'billing', subKey: 'reseller:credit' },
      { to: '/reseller/days-based-users', label: 'Days Based Users', permission: 'team', subKey: 'reseller:days_users' },
      { to: '/reseller/manage-resellers', label: 'Add Reseller', permission: 'team', subKey: 'reseller:add_reseller', adminOnly: true },
    ],
  },
];

const getItemPaths = (items) => items ? items.map((item) => item.to) : [];

export default function Sidebar({ collapsed, mobileOpen, onExpand, onToggleMobile }) {
  const { user, hasPermission, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [activeAccount, setActiveAccount] = useState(null);

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  const isResellerUser = user?.role === 'Reseller';

  // Fetch active account to read allowed_modules
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id');
    const token = localStorage.getItem('wa_dashboard_token');

    if (token) {
      fetch(`${API_BASE_URL}/numbers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const list = data.numbers || data.data || [];
          if (list.length > 0) {
            const match = selectedId ? list.find(a => a.id == selectedId) || list[0] : list[0];
            setActiveAccount(match);
            localStorage.setItem('active_wa_account_id', match.id);
          }
        })
        .catch(() => { });
    }
  }, [location.search]);

  const userAllowedModules = user?.allowed_modules
    ? (typeof user.allowed_modules === 'string' ? JSON.parse(user.allowed_modules) : user.allowed_modules)
    : null;

  // Use user's own allowed_modules if explicitly defined (even if empty array)
  // Otherwise fall back to activeAccount level modules
  const allowedModuleKeys = userAllowedModules !== null
    ? userAllowedModules
    : (activeAccount?.allowed_modules || []);

  const isTeamMember = !!user?.is_team_member;
  const isOwnerAdmin = !isTeamMember && (user?.role === 'Super Admin' || user?.username === 'admin');


  // Filter groups and items based on permissions AND user/active account assigned modules
  const visibleGroups = ALL_NAV_GROUPS.filter((group) => {
    // User management / Reseller group: Admin sees all, Resellers see only if granted module keys
    if (group.key === 'reseller') {
      if (isOwnerAdmin) return true;
      // Resellers can see this group if they have any reseller:* module keys assigned
      if (isResellerUser) {
        const hasAnyResellerModule = group.items && group.items.some(item =>
          item.subKey && checkModuleAccess(allowedModuleKeys, 'reseller', item.subKey, user?.role)
        );
        return hasAnyResellerModule;
      }
      return false;
    }

    // For team members: check granular capabilities
    if (isTeamMember) {
      if (group.items && group.items.length > 0) {
        const hasAnySubAllowed = group.items.some(item => hasPermission(item.permission) || hasPermission(item.subKey));
        if (!hasAnySubAllowed) return false;
      } else {
        if (!hasPermission(group.permission) && !hasPermission(group.subKey)) return false;
      }
    } else if (!isOwnerAdmin) {
      if (!checkModuleAccess(allowedModuleKeys, group.key, group.subKey || null, user?.role, user?.username)) return false;
      // Newly assigned module access is authoritative for regular account users.
      // Follow-ups has its own backend action permissions and is not part of the
      // legacy generic RBAC permission list, so do not hide it after module access passes.
      if (group.key !== 'followup' && !isResellerUser && group.permission && !hasPermission(group.permission)) return false;
    }

    return true;
  }).map(group => {
    if (!group.items) return group;
    const filteredSubItems = group.items.filter(item => {
      if (item.to === '/setting/tags' && !isOwnerAdmin) return false;
      // 'Add Reseller' is admin-only — not visible to Resellers even if they have other reseller modules
      if (item.adminOnly && !isOwnerAdmin) return false;
      if (isTeamMember) {
        return hasPermission(item.permission) || hasPermission(item.subKey);
      }
      if (!checkModuleAccess(allowedModuleKeys, group.key, item.subKey, user?.role, user?.username)) return false;
      return isOwnerAdmin || isResellerUser || !item.permission || hasPermission(item.permission);
    });
    return { ...group, items: filteredSubItems };
  }).filter(group => !group.items || group.items.length > 0);

  const [openDropdown, setOpenDropdown] = useState(() => {
    const path = location.pathname;
    for (const dd of visibleGroups) {
      if (dd.items && getItemPaths(dd.items).some((p) => path.startsWith(p))) {
        return dd.key;
      }
    }
    return null;
  });

  const toggleDropdown = useCallback((key) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }, []);

  const handleMobileToggle = useCallback(() => {
    onToggleMobile?.();
  }, [onToggleMobile]);

  const isDropdownActive = (items) => {
    if (!items) return false;
    const path = location.pathname;
    return items.some((item) => path.startsWith(item.to));
  };

  const isDashboardActive = () => {
    return location.pathname === '/dashboard' || location.pathname === '/';
  };

  const appBrandName = user?.app_name || user?.organization_name || 'Official WABA';
  const logoSrc = getImageUrl(user?.app_logo || '/uploads/image.png');

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}
      onClick={() => {
        if (collapsed) {
          onExpand?.();
        }
      }}
      title={collapsed ? 'Click anywhere to open sidebar' : undefined}
    >
      {/* Logo/Brand: Square Logo Container Box followed by Brand Name */}
      <div
        className="sidebar-brand"
        onClick={(e) => {
          if (collapsed) {
            e.stopPropagation();
            onExpand?.();
          }
        }}
      >
        <div className="sidebar-logo-box">
          <img
            src={logoSrc}
            alt="App Logo"
            className="sidebar-brand-img"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = getImageUrl('/uploads/image.png');
            }}
          />
        </div>
        <span className="sidebar-brand-text">{appBrandName}</span>
      </div>

      {/* Menu */}
      <nav className="sidebar-nav">
        {/* Mobile menu toggle button */}
        {mobileOpen && (
          <button
            type="button"
            className="mobile-close-btn"
            onClick={handleMobileToggle}
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Dashboard - Standalone Link: only visible if user has dashboard access */}
        {(isOwnerAdmin || (isTeamMember ? (hasPermission('dashboard:view') || hasPermission('dashboard')) : checkModuleAccess(allowedModuleKeys, 'dashboard', 'dashboard:view', user?.role, user?.username))) && (
          <NavLink
            to="/dashboard"
            onClick={() => {
              if (collapsed) {
                onExpand?.();
              }
            }}
            title={collapsed ? 'Dashboard' : undefined}
            className={() => `nav-item ${isDashboardActive() ? 'nav-item--active' : ''}`}
          >
            <span className="nav-item-icon">
              <IconDashboard />
            </span>
            <span className="nav-item-label">Dashboard</span>
          </NavLink>
        )}

        {/* Parent Menu Items with Dropdowns */}
        {visibleGroups.map((dd) => {
          if (!dd.items) {
            return (
              <NavLink
                key={dd.key}
                to={dd.to}
                onClick={() => {
                  if (collapsed) {
                    onExpand?.();
                  }
                }}
                title={collapsed ? dd.label : undefined}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
              >
                <span className="nav-item-icon">
                  <dd.icon />
                </span>
                <span className="nav-item-label">{dd.label}</span>
              </NavLink>
            );
          }

          const isOpen = openDropdown === dd.key;
          const isActive = isDropdownActive(dd.items);

          return (
            <div
              key={dd.key}
              className={`nav-dropdown ${isOpen ? 'nav-dropdown--open' : ''} ${isActive ? 'nav-dropdown--active' : ''}`}
            >
              {/* Parent Trigger */}
              <button
                type="button"
                className="nav-dropdown-trigger"
                onClick={(e) => {
                  if (collapsed) {
                    e.stopPropagation();
                    onExpand?.();
                    setOpenDropdown(dd.key);
                  } else {
                    toggleDropdown(dd.key);
                  }
                }}
                title={collapsed ? dd.label : undefined}
                aria-expanded={isOpen}
              >
                <span className="nav-dropdown-icon">
                  <dd.icon />
                </span>
                <span className="nav-dropdown-label">{dd.label}</span>
                <span className="nav-dropdown-arrow" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {/* Submenu */}
              <div className={`nav-dropdown-menu ${isOpen ? 'nav-dropdown-menu--open' : ''}`}>
                <div className="nav-dropdown-menu-inner">
                  {dd.items.map(({ to: itemTo, label: itemLabel }) => (
                    <NavLink
                      key={itemTo}
                      to={itemTo}
                      className={({ isActive: navActive }) =>
                        `nav-dropdown-item ${navActive ? 'nav-dropdown-item--active' : ''}`
                      }
                    >
                      {itemLabel}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
