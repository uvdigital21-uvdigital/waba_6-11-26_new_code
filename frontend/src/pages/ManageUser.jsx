import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTitle } from '../context/TitleContext.jsx';
import api from '../services/api.js';
import ModuleAccessSelector from '../components/ModuleAccessSelector.jsx';
import { DEFAULT_ALLOWED_MODULES } from '../config/modules.js';
import './ManageUser.css';
import './Campaigns.css';

const ROLE_OPTIONS = ['Admin', 'User', 'Super Admin'];
const STATUS_OPTIONS = ['Active', 'Disabled'];

function Badge({ children, color }) {
  const palettes = {
    green: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    red: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
    blue: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
    amber: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    gray: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  };
  const p = palettes[color] || palettes.gray;
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: p.bg,
      color: p.text,
      border: `1px solid ${p.border || '#cbd5e1'}`,
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      {children}
    </span>
  );
}

function roleBadgeColor(role) {
  if (role === 'Super Admin') return 'purple';
  if (role === 'Admin') return 'blue';
  if (role === 'Staff') return 'gray';
  return 'gray';
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function addDaysToDate(dateStr, days) {
  const numDays = parseInt(days, 10) || 0;
  let base;
  if (dateStr) {
    const parts = String(dateStr).split('T')[0].split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      base = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      base = new Date(dateStr);
    }
  } else {
    base = new Date();
  }
  if (isNaN(base.getTime())) base = new Date();
  const result = new Date(base);
  result.setDate(result.getDate() + numDays);
  const y = result.getFullYear();
  const m = String(result.getMonth() + 1).padStart(2, '0');
  const d = String(result.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRemainingTimeDisplay(u) {
  if (u.remaining_time) return u.remaining_time;
  if (u.remaining_time_human) return u.remaining_time_human;
  if (!u.expiry_date) return u.days_allocated ? `${u.days_allocated}d` : '—';
  try {
    const parts = String(u.expiry_date).split('T')[0].split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0])) {
      const expDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      const diffMs = expDate.getTime() - Date.now();
      if (diffMs <= 0) return 'Expired';
      const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
      const d = Math.floor(totalHours / 24);
      const h = totalHours % 24;
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (d > 0) return `${d}d ${h}h left`;
      if (h > 0) return `${h}h ${m}m left`;
      return `${Math.max(1, m)}m left`;
    }
  } catch (e) { }
  return u.remaining_days != null ? `${u.remaining_days}d left` : `${u.days_allocated || 0}d`;
}

export default function ManageUser() {
  const { user, isSuperAdmin } = useAuth();
  const { setTitle } = useTitle();

  const [usersList, setUsersList] = useState([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    adminUsers: 0,
    recentlyActiveUsers: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Filters & Search ────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [accessTypeFilter, setAccessTypeFilter] = useState('All');

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // ── Modals & Drawers State ──────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [createForm, setCreateForm] = useState({
    company_name: '',
    owner_name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    role: 'User',
    access_type: 'credit_based',
    days_allocated: 30,
    start_date: todayStr,
    expiry_date: addDaysToDate(todayStr, 30),
    credits: 0,
    allowed_modules: [...DEFAULT_ALLOWED_MODULES]
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: '',
    status: '',
    access_type: 'credit_based',
    days_allocated: 30,
    start_date: todayStr,
    expiry_date: addDaysToDate(todayStr, 30),
    credits: 0,
    allowed_modules: []
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(false);
  const [userActivityList, setUserActivityList] = useState([]);

  const [showAllActivityModal, setShowAllActivityModal] = useState(false);
  const [allActivityList, setAllActivityList] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    setTitle('Manage Users');
  }, [setTitle]);

  const flash = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  // ── Fetch users list and stats ──────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (roleFilter !== 'All') params.role = roleFilter;
      if (accessTypeFilter !== 'All') params.access_type = accessTypeFilter;

      const res = await api.get('/users', { params });
      if (res.data && res.data.success) {
        setUsersList(res.data.users || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, roleFilter, accessTypeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Create User ─────────────────────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!createForm.username || !createForm.password) {
      setFormError('Username and Password are required.');
      return;
    }

    if (createForm.access_type === 'days_based' && (!createForm.days_allocated || parseInt(createForm.days_allocated, 10) <= 0)) {
      setFormError('Number of Days must be greater than 0 for Days-Based users.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/users', createForm);
      if (res.data && res.data.success) {
        flash(`✅ User "${createForm.owner_name}" created successfully!`);
        setShowCreateModal(false);
        setCreateForm({
          company_name: '',
          owner_name: '',
          username: '',
          password: '',
          email: '',
          phone: '',
          role: 'User',
          access_type: 'credit_based',
          days_allocated: 30,
          start_date: todayStr,
          expiry_date: addDaysToDate(todayStr, 30),
          credits: 0,
          allowed_modules: [...DEFAULT_ALLOWED_MODULES]
        });
        fetchUsers();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Edit Modal ─────────────────────────────────────────────
  const openEdit = (u) => {
    setEditTarget(u);
    const initialDays = parseInt(u.days_allocated, 10) || 30;
    const computedExpiry = addDaysToDate(todayStr, initialDays);

    setEditForm({
      full_name: u.full_name || u.name || '',
      email: u.email || '',
      phone: u.phone || u.mobile || '',
      role: u.role || 'User',
      status: u.status || 'Active',
      access_type: u.access_type || 'credit_based',
      days_allocated: initialDays,
      start_date: todayStr,
      expiry_date: computedExpiry,
      credits: u.credits || 0,
      allowed_modules: u.allowed_modules || []
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await api.put(`/users/${editTarget.id}`, editForm);
      if (res.data && res.data.success) {
        flash(`✅ User "${editForm.full_name}" updated successfully!`);
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Status Toggle (Disable / Enable) ────────────────────────────
  const handleToggleStatus = async (u) => {
    const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
    const confirmMsg = nextStatus === 'Disabled'
      ? `Are you sure you want to DISABLE "${u.full_name || u.username}"? They will be logged out and unable to access the system.`
      : `Enable account for "${u.full_name || u.username}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.patch(`/users/${u.id}/status`, { status: nextStatus });
      if (res.data && res.data.success) {
        flash(`✅ User status updated to ${nextStatus}.`);
        fetchUsers();
      }
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to update status', true);
    }
  };

  // ── Logout All Sessions ─────────────────────────────────────────
  const handleLogoutAllSessions = async (u) => {
    if (!window.confirm(`Terminate all active sessions for "${u.full_name || u.username}"? They will need to log in again.`)) return;

    try {
      const res = await api.post(`/users/${u.id}/logout-all`);
      if (res.data && res.data.success) {
        flash(`✅ All active sessions revoked for "${u.full_name || u.username}".`);
      }
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to revoke sessions', true);
    }
  };

  // ── Delete User ─────────────────────────────────────────────────
  const handleDeleteUser = (u) => {
    if (user && (user.id === u.id || user.id === Number(u.id))) {
      flash('You cannot delete your own account.', true);
      return;
    }
    setDeleteTarget(u);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeletingUser(true);
    try {
      const res = await api.delete(`/users/${deleteTarget.id}`);
      if (res.data && res.data.success) {
        flash(`🗑️ User "${deleteTarget.full_name || deleteTarget.username}" deleted successfully.`);
        setShowDeleteModal(false);
        setDeleteTarget(null);
        await fetchUsers();
      } else {
        flash(res.data?.message || 'Failed to delete user', true);
      }
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete user', true);
    } finally {
      setDeletingUser(false);
    }
  };

  // ── Reset Password Modal ────────────────────────────────────────
  const openResetPassword = (u) => {
    setResetTarget(u);
    setResetPasswordVal('');
    setResetSuccessMsg('');
    setShowResetModal(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetSubmitting(true);
    try {
      const res = await api.post(`/users/${resetTarget.id}/reset-password`, {
        password: resetPasswordVal
      });
      if (res.data && res.data.success) {
        setResetSuccessMsg(res.data.temporaryPassword || resetPasswordVal);
        flash(`✅ Password for "${resetTarget.username}" has been reset successfully!`);
      }
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to reset password', true);
    } finally {
      setResetSubmitting(false);
    }
  };

  // ── View User Details Drawer/Modal ──────────────────────────────
  const openUserDetails = async (u) => {
    setDetailsTarget(u);
    setShowDetailsModal(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/users/${u.id}`);
      if (res.data && res.data.success) {
        setDetailsTarget(res.data.user);
        setUserActivityList(res.data.activity || []);
      }
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Open All Activity Logs ──────────────────────────────────────
  const openAllActivity = async () => {
    setShowAllActivityModal(true);
    setActivityLoading(true);
    try {
      const res = await api.get('/users/activity/all');
      if (res.data && res.data.success) {
        setAllActivityList(res.data.activity || []);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div className="user-accounts-page" style={{ padding: '24px', backgroundColor: '#f8fafc' }}>

      {/* Alert notifications */}
      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: '500' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: '500' }}>
          {success}
        </div>
      )}

      {/* ── Top Summary Metrics Cards ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Users</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>{summary.totalUsers}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '600', textTransform: 'uppercase' }}>Active Users</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#16a34a', marginTop: '4px' }}>{summary.activeUsers}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '600', textTransform: 'uppercase' }}>Disabled Users</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#dc2626', marginTop: '4px' }}>{summary.disabledUsers}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: '600', textTransform: 'uppercase' }}>Admin Users</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0284c7', marginTop: '4px' }}>{summary.adminUsers}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#7e22ce', fontWeight: '600', textTransform: 'uppercase' }}>Recently Active (7d)</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#9333ea', marginTop: '4px' }}>{summary.recentlyActiveUsers}</div>
        </div>
      </div>

      {/* ── Main Users Management Card ────────────────────────────── */}
      <div className="user-accounts-card">
        {/* Header */}
        <div className="user-header-row">
          <div className="user-header-left">
            <div className="user-avatar-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h1 className="user-header-title">User Management</h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Manage accounts, access models (Credit / Days Based), permissions & security</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openAllActivity}
              style={{
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 Audit Activity Logs
            </button>

            <button
              type="button"
              className="btn-add-account"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ➕ Add User / Account
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by name, email, phone, username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13.5px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <select
              value={accessTypeFilter}
              onChange={(e) => setAccessTypeFilter(e.target.value)}
              style={{
                padding: '9px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13.5px',
                background: '#fff',
                color: '#334155',
                fontWeight: '500'
              }}
            >
              <option value="All">All Access Types</option>
              <option value="credit_based">🟢 Credit Based</option>
              <option value="days_based">🔵 Days Based</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '9px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13.5px',
                background: '#fff',
                color: '#334155'
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Disabled">Disabled Only</option>
            </select>
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '9px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13.5px',
                background: '#fff',
                color: '#334155'
              }}
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="User">User</option>
              {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchUsers}
            style={{
              padding: '9px 16px',
              backgroundColor: '#e2e8f0',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Users Table */}
        <div className="user-table-container">
          <table className="user-data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Access Type</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created Date</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="user-empty-row">Loading users...</td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan="10" className="user-empty-row">No users found matching the filter criteria.</td>
                </tr>
              ) : (
                usersList.map((u, idx) => (
                  <tr key={u.id}>
                    <td style={{ color: '#64748b', fontWeight: '500' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                          {(u.full_name || u.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{u.full_name || u.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#334155' }}>{u.email || '—'}</td>
                    <td style={{ color: '#334155', fontFamily: 'monospace' }}>{u.phone || u.mobile || '—'}</td>
                    <td>
                      <Badge color={roleBadgeColor(u.role)}>{u.role}</Badge>
                    </td>
                    <td>
                      {u.is_days_based || u.access_type === 'days_based' ? (
                        <Badge color="blue">
                          🔵 Days Based ({getRemainingTimeDisplay(u)})
                        </Badge>
                      ) : (
                        <Badge color="green">
                          🟢 Credit Based
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Badge color={u.status === 'Active' ? 'green' : 'red'}>
                        {u.status === 'Active' ? '● Active' : '● Disabled'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openUserDetails(u)}
                          title="View Details & Security"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          👁️ View
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Edit User & Access Type"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #c7d2fe',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => openResetPassword(u)}
                          title="Reset Password"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #fed7aa',
                            background: '#fff7ed',
                            color: '#9a3412',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🔑 Reset
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: u.status === 'Active' ? '1px solid #fca5a5' : '1px solid #86efac',
                            background: u.status === 'Active' ? '#fef2f2' : '#f0fdf4',
                            color: u.status === 'Active' ? '#dc2626' : '#16a34a',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {u.status === 'Active' ? '🚫 Disable' : '✅ Enable'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          title="Delete User"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE USER MODAL ─────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '620px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Add New User Account</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {formError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. johndoe"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>



              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="User">User</option>
                  </select>
                </div>
              </div>

              {/* ── Access Type Selector ── */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                marginBottom: '16px'
              }}>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Access Type *
                </label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <label style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: createForm.access_type === 'credit_based' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: createForm.access_type === 'credit_based' ? '#f0fdf4' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: createForm.access_type === 'credit_based' ? '#15803d' : '#475569'
                  }}>
                    <input
                      type="radio"
                      name="access_type"
                      value="credit_based"
                      checked={createForm.access_type === 'credit_based'}
                      onChange={() => setCreateForm({ ...createForm, access_type: 'credit_based' })}
                    />
                    <span>🟢 Credit Based</span>
                  </label>

                  <label style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: createForm.access_type === 'days_based' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: createForm.access_type === 'days_based' ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: createForm.access_type === 'days_based' ? '#0369a1' : '#475569'
                  }}>
                    <input
                      type="radio"
                      name="access_type"
                      value="days_based"
                      checked={createForm.access_type === 'days_based'}
                      onChange={() => setCreateForm({ ...createForm, access_type: 'days_based' })}
                    />
                    <span>🔵 Days Based</span>
                  </label>
                </div>

                {createForm.access_type === 'credit_based' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Initial Credit Allocation</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={createForm.credits}
                      onChange={(e) => setCreateForm({ ...createForm, credits: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Number of Days *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={createForm.days_allocated}
                        onChange={(e) => {
                          const d = parseInt(e.target.value, 10) || 0;
                          setCreateForm({
                            ...createForm,
                            days_allocated: d,
                            expiry_date: addDaysToDate(createForm.start_date || todayStr, d)
                          });
                        }}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={createForm.start_date}
                        onChange={(e) => {
                          setCreateForm({
                            ...createForm,
                            start_date: e.target.value,
                            expiry_date: addDaysToDate(e.target.value, createForm.days_allocated || 30)
                          });
                        }}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2', padding: '8px 12px', backgroundColor: '#e0f2fe', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12.5px', color: '#0369a1', fontWeight: 600 }}>Calculated Expiry Date:</span>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0284c7' }}>{formatDateDisplay(createForm.expiry_date)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Company / Organization Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to use current organization"
                  value={createForm.company_name}
                  onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              {/* Module Access Checkboxes with Sub-Item Granularity */}
              <ModuleAccessSelector
                selectedKeys={createForm.allowed_modules}
                onChange={(keys) => setCreateForm({ ...createForm, allowed_modules: keys })}
                showAdminModules={true}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#1abc9c', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL (Allows Switching Access Type) ─────────── */}
      {showEditModal && editTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '580px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Edit User & Access Type — @{editTarget.username}</h2>
              <button onClick={() => setShowEditModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {editError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>


              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="User">User</option>
                    {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* ── Switch Access Type: Credit Based <-> Days Based ── */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                marginBottom: '16px'
              }}>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Access & Billing Model
                </label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <label style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: editForm.access_type === 'credit_based' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: editForm.access_type === 'credit_based' ? '#f0fdf4' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: editForm.access_type === 'credit_based' ? '#15803d' : '#475569'
                  }}>
                    <input
                      type="radio"
                      name="edit_access_type"
                      value="credit_based"
                      checked={editForm.access_type === 'credit_based'}
                      onChange={() => setEditForm({ ...editForm, access_type: 'credit_based' })}
                    />
                    <span>🟢 Credit Based</span>
                  </label>

                  <label style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: editForm.access_type === 'days_based' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: editForm.access_type === 'days_based' ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: editForm.access_type === 'days_based' ? '#0369a1' : '#475569'
                  }}>
                    <input
                      type="radio"
                      name="edit_access_type"
                      value="days_based"
                      checked={editForm.access_type === 'days_based'}
                      onChange={() => {
                        const d = parseInt(editForm.days_allocated, 10) || 30;
                        setEditForm({
                          ...editForm,
                          access_type: 'days_based',
                          days_allocated: d,
                          start_date: todayStr,
                          expiry_date: addDaysToDate(todayStr, d)
                        });
                      }}
                    />
                    <span>🔵 Days Based</span>
                  </label>
                </div>

                {editForm.access_type === 'credit_based' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Available Credits</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.credits}
                      onChange={(e) => setEditForm({ ...editForm, credits: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Number of Days</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.days_allocated}
                        onChange={(e) => {
                          const d = parseInt(e.target.value, 10) || 0;
                          setEditForm({
                            ...editForm,
                            days_allocated: d,
                            start_date: todayStr,
                            expiry_date: addDaysToDate(todayStr, d)
                          });
                        }}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Expiry Date</label>
                      <input
                        type="date"
                        value={editForm.expiry_date || ''}
                        onChange={(e) => {
                          const newExp = e.target.value;
                          let diffDays = editForm.days_allocated;
                          if (newExp) {
                            const start = new Date(todayStr);
                            const exp = new Date(newExp);
                            const diffTime = exp.getTime() - start.getTime();
                            diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
                          }
                          setEditForm({
                            ...editForm,
                            expiry_date: newExp,
                            days_allocated: diffDays
                          });
                        }}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Module Access Checkboxes with Sub-Item Granularity */}
              <ModuleAccessSelector
                selectedKeys={Array.isArray(editForm.allowed_modules) ? editForm.allowed_modules : []}
                onChange={(keys) => setEditForm({ ...editForm, allowed_modules: keys })}
                showAdminModules={true}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={editSubmitting} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ──────────────────────────────────── */}
      {showResetModal && resetTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '480px', maxWidth: '95%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>🔑 Reset Password</h2>
              <button onClick={() => setShowResetModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Reset password for user <strong>{resetTarget.full_name || resetTarget.username}</strong>. All active sessions will be revoked.
            </p>

            {resetSuccessMsg ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ color: '#15803d', fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>
                  ✅ Password Reset Successfully!
                </div>
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  Temporary Password:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    readOnly
                    value={resetSuccessMsg}
                    style={{ flex: 1, padding: '8px 12px', fontFamily: 'monospace', fontWeight: '700', fontSize: '15px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetSuccessMsg);
                      alert('Password copied to clipboard!');
                    }}
                    style={{ padding: '8px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Copy
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{ marginTop: '16px', width: '100%', padding: '8px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600' }}>
                      New Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const random = 'WA_' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6) + '!';
                        setResetPasswordVal(random);
                      }}
                      style={{ fontSize: '12px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                    >
                      ⚡ Generate Secure Password
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter or generate new password"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowResetModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>Cancel</button>
                  <button type="submit" disabled={resetSubmitting || !resetPasswordVal} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#f59e0b', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                    {resetSubmitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── USER DETAILS DRAWER / MODAL ───────────────────────────── */}
      {showDetailsModal && detailsTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '650px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px' }}>
                  {(detailsTarget.full_name || detailsTarget.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>{detailsTarget.full_name || detailsTarget.username}</h2>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>@{detailsTarget.username} • {detailsTarget.organization_name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => openUserDetails(detailsTarget)}
                  disabled={detailsLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}
                >
                  🔄 {detailsLoading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button onClick={() => setShowDetailsModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>
            </div>

            {/* Access Model Card */}
            <div style={{
              padding: '16px',
              backgroundColor: detailsTarget.is_days_based ? '#f0f9ff' : '#f0fdf4',
              border: detailsTarget.is_days_based ? '1px solid #bae6fd' : '1px solid #bbf7d0',
              borderRadius: '10px',
              marginBottom: '18px'
            }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: detailsTarget.is_days_based ? '#0369a1' : '#15803d', marginBottom: '10px' }}>
                {detailsTarget.is_days_based ? '🔵 Days-Based Subscription Model' : '🟢 Credit-Based Access Model'}
              </div>

              {detailsTarget.is_days_based ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div><strong>Total Allocated:</strong> {detailsTarget.days_allocated || 0} Days</div>
                  <div><strong>Start Date:</strong> {formatDateDisplay(detailsTarget.start_date)}</div>
                  <div><strong>Expiry Date:</strong> {formatDateDisplay(detailsTarget.expiry_date)}</div>
                  <div><strong>Remaining:</strong> <span style={{ fontWeight: 700, color: detailsTarget.is_expired ? '#dc2626' : '#16a34a' }}>{detailsTarget.remaining_days || 0} Days</span></div>
                  <div><strong>Access Status:</strong> <Badge color={detailsTarget.is_expired ? 'red' : 'green'}>{detailsTarget.days_status || 'Active'}</Badge></div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div><strong>Available Credits:</strong> <span style={{ fontSize: '15px', fontWeight: 700 }}>{Number(detailsTarget.credits || 0).toLocaleString()}</span></div>
                  <div><strong>Access Model:</strong> Credit Deductions</div>
                </div>
              )}
            </div>

            {/* Account Info Grid */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div><strong>Email:</strong> {detailsTarget.email || '—'}</div>
                <div><strong>Phone:</strong> {detailsTarget.phone || detailsTarget.mobile || '—'}</div>
                <div><strong>Role:</strong> <Badge color={roleBadgeColor(detailsTarget.role)}>{detailsTarget.role}</Badge></div>
                <div><strong>Status:</strong> <Badge color={detailsTarget.status === 'Active' ? 'green' : 'red'}>{detailsTarget.status}</Badge></div>
                <div><strong>Created On:</strong> {detailsTarget.created_at ? new Date(detailsTarget.created_at).toLocaleString() : '—'}</div>
                <div><strong>Last IP:</strong> {detailsTarget.last_login_ip || '—'}</div>
              </div>
            </div>

            {/* Security & Sessions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security & Authentication</h3>
                <button
                  type="button"
                  onClick={() => openUserDetails(detailsTarget)}
                  style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                >
                  🔄 Live Sync
                </button>
              </div>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '6px' }}>Current Password:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '700', color: showDetailPassword ? '#0f172a' : '#64748b', background: '#e2e8f0', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', letterSpacing: showDetailPassword ? '0px' : '2px' }}>
                        {showDetailPassword ? (detailsTarget.plain_password || '••••••••••') : '••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDetailPassword(!showDetailPassword)}
                        style={{ padding: '4px 8px', fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        {showDetailPassword ? '🙈 Hide' : '👁 Show'}
                      </button>
                      {showDetailPassword && detailsTarget.plain_password && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(detailsTarget.plain_password);
                            alert('Password copied to clipboard!');
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                        >
                          📋 Copy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailsModal(false);
                          openResetPassword(detailsTarget);
                        }}
                        style={{ fontSize: '12px', padding: '4px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        🔑 Reset
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>Password Changed:</div>
                    <div style={{ color: '#0f172a', fontWeight: '600' }}>
                      {detailsTarget.password_changed_at ? new Date(detailsTarget.password_changed_at).toLocaleString() : 'Never'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>Last Login:</div>
                    <div>{detailsTarget.last_login_at ? new Date(detailsTarget.last_login_at).toLocaleString() : 'Never'}</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>Failed Login Attempts:</div>
                    <div>{detailsTarget.failed_login_attempts || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Log */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Audit Activity</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {userActivityList.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No activity records found for this user.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Action</th>
                        <th style={{ padding: '8px 12px' }}>Module</th>
                        <th style={{ padding: '8px 12px' }}>Description</th>
                        <th style={{ padding: '8px 12px' }}>Date / Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userActivityList.map((act) => (
                        <tr key={act.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '600' }}>{act.action}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{act.module}</td>
                          <td style={{ padding: '8px 12px' }}>{act.description || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{act.created_at ? new Date(act.created_at).toLocaleString() : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                style={{ padding: '8px 20px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL AUDIT ACTIVITY LOGS MODAL ─────────────────────────── */}
      {showAllActivityModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '850px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>📋 System Audit Activity Trail</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Complete log of user authentication, administration and security events</p>
              </div>
              <button onClick={() => setShowAllActivityModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              {activityLoading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading audit logs...</div>
              ) : allActivityList.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No audit activity records found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Action</th>
                      <th style={{ padding: '10px 14px' }}>Module</th>
                      <th style={{ padding: '10px 14px' }}>User</th>
                      <th style={{ padding: '10px 14px' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allActivityList.map((act) => (
                      <tr key={act.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(act.created_at).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600' }}>{act.action}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{act.module}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a' }}>{act.user_name || act.username || 'System'}</td>
                        <td style={{ padding: '10px 14px', color: '#334155' }}>{act.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAllActivityModal(false)}
                style={{ padding: '8px 20px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────── */}
      {showDeleteModal && deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            width: '440px',
            maxWidth: '92%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: '24px'
              }}>
                🗑️
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#111827', fontWeight: '700' }}>
                Delete User Account?
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete user <strong style={{ color: '#0f172a' }}>"{deleteTarget.full_name || deleteTarget.username}"</strong>? All associated messages, templates, and permissions will be permanently removed.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                disabled={deletingUser}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deletingUser}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {deletingUser ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}