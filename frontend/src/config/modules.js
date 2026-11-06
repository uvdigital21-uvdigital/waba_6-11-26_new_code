// ─────────────────────────────────────────────────────────────────────────────
// src/config/modules.js
// Centralized Sidebar & Sub-Module Access Permissions Definition
// ─────────────────────────────────────────────────────────────────────────────

export const SIDEBAR_MODULE_CONFIG = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'IconDashboard',
    subItems: [
      { key: 'dashboard:view', to: '/dashboard', label: 'View Dashboard & Analytics' },
    ]
  },
  {
    key: 'sendWa',
    label: 'Send Campaigns',
    icon: 'IconSend',
    subItems: [
      { key: 'sendWa:quick', to: '/send-wa/quick', label: 'Quick Broadcast' },
      { key: 'sendWa:csv', to: '/send-wa/csv', label: 'Upload CSV Campaign' },
      { key: 'sendWa:tags', to: '/send-wa/tags', label: 'Segment by Tags' },
      { key: 'sendWa:group', to: '/send-wa/group', label: 'Segment by Group' },
      { key: 'sendWa:birthday', to: '/send-wa/birthday', label: 'Birthday Automation' },
    ]
  },
  {
    key: 'followup',
    label: 'Follow-ups',
    icon: 'IconBot',
    subItems: [
      { key: 'followup:manage', to: '/followup', label: 'View & Manage Follow-ups' },
    ]
  },
  {
    key: 'reports',
    label: 'Report Insights',
    icon: 'IconReports',
    subItems: [
      { key: 'reports:history', to: '/reports/sending-history', label: 'Message History' },
      { key: 'reports:scheduled', to: '/reports/scheduled-log', label: 'Scheduled Campaigns' },
    ]
  },
  {
    key: 'template',
    label: 'Official Templates',
    icon: 'IconTemplate',
    subItems: [
      { key: 'template:manage', to: '/template/manage', label: 'Template Management' },
    ]
  },
  {
    key: 'chat',
    label: 'Chat Inbox',
    icon: 'IconChat',
    subItems: [
      { key: 'chat:inbox', to: '/chat', label: 'Live Chat (Inbox)' },
    ]
  },
  {
    key: 'chatbot',
    label: 'Chatbot Flow',
    icon: 'IconBot',
    subItems: [
      { key: 'chatbot:flow', to: '/chatbot', label: 'ChatBot & Flow Builder' },
    ]
  },
  {
    key: 'api',
    label: 'Developer API',
    icon: 'IconApi',
    subItems: [
      { key: 'api:developer', to: '/developer/api', label: 'API & Developer Tools' },
    ]
  },
  {
    key: 'setting',
    label: 'Settings',
    icon: 'IconSetting',
    subItems: [
      { key: 'setting:numbers', to: '/setting/manage-numbers', label: 'WhatsApp Numbers' },
      { key: 'setting:blacklist', to: '/setting/optout-blacklist', label: 'Opt-out / BlackList' },
      { key: 'setting:tags', to: '/setting/tags', label: 'Contact Tags' },
      { key: 'setting:billing', to: '/setting/meta-billing', label: 'Meta Billing & Insights' },
      { key: 'setting:team_members', to: '/settings/team-members', label: 'Team Members' },
    ]
  },
  {
    key: 'reseller',
    label: 'User Management & Access',
    icon: 'IconReseller',
    adminOnly: true,
    subItems: [
      { key: 'reseller:users', to: '/manage-users', label: 'Manage Users' },
      { key: 'reseller:credit', to: '/reseller/assign-credit', label: 'Assign Credit' },
      { key: 'reseller:days_users', to: '/reseller/days-based-users', label: 'Days Based Users' },
      { key: 'reseller:add_reseller', to: '/reseller/manage-resellers', label: 'Add Reseller' },
    ]
  },
];

// Returns all sub-item keys by default (for new users/full access)
export const DEFAULT_ALLOWED_MODULES = SIDEBAR_MODULE_CONFIG
  .filter(m => !m.adminOnly)
  .flatMap(m => [m.key, ...m.subItems.map(s => s.key)]);

export const ALL_AVAILABLE_MODULE_KEYS = SIDEBAR_MODULE_CONFIG
  .flatMap(m => [m.key, ...m.subItems.map(s => s.key)]);

export const ROLE_PRESET_MODULES = {
  Admin: DEFAULT_ALLOWED_MODULES,
  Marketing: [
    'dashboard', 'dashboard:view',
    'sendWa', 'sendWa:quick', 'sendWa:csv', 'sendWa:tags', 'sendWa:group', 'sendWa:birthday',
    'reports', 'reports:history', 'reports:scheduled',
    'followup', 'followup:manage',
    'chat', 'chat:inbox',
    'template', 'template:manage',
    'post_creator', 'post_creator:editor'
  ],
  Sales: [
    'dashboard', 'dashboard:view',
    'sendWa', 'sendWa:quick',
    'reports', 'reports:history',
    'followup', 'followup:manage',
    'chat', 'chat:inbox',
    'post_creator', 'post_creator:editor'
  ],
  Support: [
    'dashboard', 'dashboard:view',
    'chat', 'chat:inbox',
    'reports', 'reports:history',
    'post_creator', 'post_creator:editor'
  ],
  Staff: [
    'dashboard', 'dashboard:view',
    'sendWa', 'sendWa:quick',
    'chat', 'chat:inbox',
    'post_creator', 'post_creator:editor'
  ],
  Custom: [
    'dashboard', 'dashboard:view'
  ]
};

/**
 * Checks whether a user has access to a parent module or sub-module.
 * Strictly respects assigned modules: nothing is accessible by default unless selected.
 */
export function checkModuleAccess(allowedModules, parentKey, subKey = null, role = null, username = null) {
  // Only Super Admin and main system 'admin' have unrestricted access
  if (role === 'Super Admin' || username === 'admin') return true;

  if (!allowedModules) return false;

  let allowedList = [];
  try {
    allowedList = typeof allowedModules === 'string' ? JSON.parse(allowedModules) : allowedModules;
  } catch {
    allowedList = [];
  }

  if (!Array.isArray(allowedList) || allowedList.length === 0) return false;

  // 1. Direct sub-key match (e.g. 'sendWa:quick', 'dashboard:view')
  if (subKey && allowedList.includes(subKey)) {
    return true;
  }

  // 2. Direct parent match (e.g. 'sendWa', 'dashboard')
  if (allowedList.includes(parentKey)) {
    // If specific sub-keys are assigned for this parent in allowedList, ensure this subKey is one of them
    if (subKey) {
      const config = SIDEBAR_MODULE_CONFIG.find(m => m.key === parentKey);
      const configuredSubKeys = config?.subItems.map(s => s.key) || [];
      const hasAnySubKeyInList = allowedList.some(k => configuredSubKeys.includes(k));
      if (hasAnySubKeyInList) {
        return allowedList.includes(subKey);
      }
    }
    return true;
  }

  // 3. If checking parent and ANY sub-item of this parent is allowed, allow parent to show in sidebar
  if (!subKey) {
    const config = SIDEBAR_MODULE_CONFIG.find(m => m.key === parentKey);
    if (config) {
      return config.subItems.some(s => allowedList.includes(s.key));
    }
  }

  return false;
}
