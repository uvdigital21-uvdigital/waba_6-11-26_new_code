// ─────────────────────────────────────────────────────────────────────────────
// src/config/permissions.js
// Centralized RBAC Permission Definitions, Categories & Role Presets
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSION_CATEGORIES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard & Analytics' }
    ]
  },
  {
    key: 'campaigns',
    label: 'Campaigns & Broadcasts',
    icon: '🚀',
    permissions: [
      { key: 'campaigns.view', label: 'View Campaigns' },
      { key: 'campaigns.create', label: 'Create Campaigns' },
      { key: 'campaigns.edit', label: 'Edit Campaigns' },
      { key: 'campaigns.delete', label: 'Delete Campaigns' },
      { key: 'campaigns.send', label: 'Send & Launch Campaigns' }
    ]
  },
  {
    key: 'contacts',
    label: 'Contacts & Tags',
    icon: '👥',
    permissions: [
      { key: 'contacts.view', label: 'View Contacts' },
      { key: 'contacts.create', label: 'Create Contacts' },
      { key: 'contacts.edit', label: 'Edit Contacts' },
      { key: 'contacts.delete', label: 'Delete Contacts' },
      { key: 'contacts.import', label: 'Import Contacts (CSV/Excel)' },
      { key: 'contacts.export', label: 'Export Contacts' }
    ]
  },
  {
    key: 'templates',
    label: 'Official Templates',
    icon: '📝',
    permissions: [
      { key: 'templates.view', label: 'View Templates' },
      { key: 'templates.create', label: 'Create Templates' },
      { key: 'templates.edit', label: 'Edit Templates' },
      { key: 'templates.delete', label: 'Delete Templates' }
    ]
  },
  {
    key: 'inbox',
    label: 'Live Chat & Inbox',
    icon: '💬',
    permissions: [
      { key: 'inbox.view', label: 'View Live Chat / Inbox' },
      { key: 'inbox.reply', label: 'Reply & Send Messages' }
    ]
  },
  {
    key: 'reports',
    label: 'Reports & Logs',
    icon: '📈',
    permissions: [
      { key: 'reports.view', label: 'View Message History & Reports' },
      { key: 'reports.export', label: 'Export Reports' }
    ]
  },
  {
    key: 'whatsapp_numbers',
    label: 'WhatsApp Official Numbers',
    icon: '📱',
    permissions: [
      { key: 'whatsapp_numbers.view', label: 'View Connected Numbers' },
      { key: 'whatsapp_numbers.manage', label: 'Manage & Connect Numbers' }
    ]
  },
  {
    key: 'meta_billing',
    label: 'Meta WhatsApp Billing',
    icon: '💳',
    permissions: [
      { key: 'meta_billing.view', label: 'View Meta Billing & Insights' },
      { key: 'meta_billing.refresh', label: 'Trigger Real-time Meta Sync' }
    ]
  },
  {
    key: 'settings',
    label: 'Account & Workspace Settings',
    icon: '⚙️',
    permissions: [
      { key: 'settings.view', label: 'View Settings' },
      { key: 'settings.manage', label: 'Modify Settings' }
    ]
  },
  {
    key: 'team_members',
    label: 'Team Members & Staff Access',
    icon: '🛡️',
    permissions: [
      { key: 'team_members.view', label: 'View Team Members' },
      { key: 'team_members.create', label: 'Create Team Members' },
      { key: 'team_members.edit', label: 'Edit Team Members & Permissions' },
      { key: 'team_members.disable', label: 'Enable / Disable Member Access' },
      { key: 'team_members.delete', label: 'Delete Team Members' }
    ]
  },
  {
    key: 'audit_logs',
    label: 'Security & Audit Logs',
    icon: '📜',
    permissions: [
      { key: 'audit_logs.view', label: 'View Audit Trail & Activity Logs' }
    ]
  }
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap(cat => cat.permissions.map(p => p.key));

export const ROLE_PRESET_PERMISSIONS = {
  Admin: [
    'dashboard.view',
    'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.delete', 'campaigns.send',
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete', 'contacts.import', 'contacts.export',
    'templates.view', 'templates.create', 'templates.edit', 'templates.delete',
    'inbox.view', 'inbox.reply',
    'reports.view', 'reports.export',
    'whatsapp_numbers.view', 'whatsapp_numbers.manage',
    'meta_billing.view', 'meta_billing.refresh',
    'settings.view', 'settings.manage',
    'team_members.view', 'team_members.create', 'team_members.edit', 'team_members.disable', 'team_members.delete',
    'audit_logs.view'
  ],
  Marketing: [
    'dashboard.view',
    'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.send',
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.import', 'contacts.export',
    'templates.view', 'templates.create', 'templates.edit',
    'inbox.view', 'inbox.reply',
    'reports.view',
    'whatsapp_numbers.view',
    'meta_billing.view'
  ],
  Sales: [
    'dashboard.view',
    'campaigns.view',
    'contacts.view', 'contacts.create', 'contacts.edit',
    'inbox.view', 'inbox.reply',
    'templates.view',
    'reports.view'
  ],
  Support: [
    'dashboard.view',
    'contacts.view',
    'inbox.view', 'inbox.reply',
    'templates.view',
    'reports.view'
  ],
  Custom: [
    'dashboard.view'
  ]
};
