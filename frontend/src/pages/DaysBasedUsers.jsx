import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTitle } from '../context/TitleContext.jsx';
import api from '../services/api.js';
import ModuleAccessSelector from '../components/ModuleAccessSelector.jsx';
import { DEFAULT_ALLOWED_MODULES } from '../config/modules.js';
import './ManageUser.css';
import './Campaigns.css';

const ROLE_OPTIONS = ['Admin', 'Staff', 'User', 'Super Admin'];
const STATUS_OPTIONS = ['All', 'Active', 'Expiring Soon', 'Expired', 'Disabled'];

function Badge({ children, color }) {
  const palettes = {
    green:  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    amber:  { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    red:    { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
    blue:   { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
    gray:   { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
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
      border: `1px solid ${p.border}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      whiteSpace: 'nowrap' 
    }}>
      {children}
    </span>
  );
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
  } catch (e) {}
  return u.remaining_days != null ? `${u.remaining_days}d left` : `${u.days_allocated || 0}d`;
}

export default function DaysBasedUsers() {
  const { user, isSuperAdmin } = useAuth();
  const { setTitle } = useTitle();

  const [usersList, setUsersList] = useState([]);
  const [summary, setSummary] = useState({
    totalDaysUsers: 0,
    activeDaysUsers: 0,
    expiringSoonDaysUsers: 0,
    expiredDaysUsers: 0,
    disabledUsers: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Filters & Search ────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

  // ── Modals State ────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const [createForm, setCreateForm] = useState({
    company_name: '',
    owner_name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    role: 'User',
    access_type: 'days_based',
    days_allocated: 30,
    start_date: todayStr,
    expiry_date: addDaysToDate(todayStr, 30),
    allowed_modules: [...DEFAULT_ALLOWED_MODULES]
  });

  // Extend Days Modal State
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendDaysVal, setExtendDaysVal] = useState(30);
  const [extendStartDateVal, setExtendStartDateVal] = useState(todayStr);
  const [extendSubmitting, setExtendSubmitting] = useState(false);
  const [extendError, setExtendError] = useState('');

  // Edit Modal State
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
    access_type: 'days_based',
    days_allocated: 30,
    start_date: '',
    expiry_date: '',
    credits: 0,
    allowed_modules: []
  });

  // View Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userActivityList, setUserActivityList] = useState([]);

  useEffect(() => {
    setTitle('Days Based Users');
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

  // ── Fetch Days-Based Users ──────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { access_type: 'days_based' };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (roleFilter !== 'All') params.role = roleFilter;

      const res = await api.get('/users', { params });
      if (res.data && res.data.success) {
        setUsersList(res.data.users || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch days-based users:', err);
      setError(err.response?.data?.message || 'Failed to fetch days-based users');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Create User Submit ──────────────────────────────────────────
  const handleCreateDaysChange = (days) => {
    const num = parseInt(days, 10) || 0;
    const newExpiry = addDaysToDate(createForm.start_date || todayStr, num);
    setCreateForm(prev => ({
      ...prev,
      days_allocated: num,
      expiry_date: newExpiry
    }));
  };

  const handleCreateStartDateChange = (date) => {
    const newExpiry = addDaysToDate(date, createForm.days_allocated || 30);
    setCreateForm(prev => ({
      ...prev,
      start_date: date,
      expiry_date: newExpiry
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!createForm.owner_name || !createForm.username || !createForm.password || !createForm.email) {
      setFormError('Owner Name, Username, Password, and Email are required.');
      return;
    }
    if (!createForm.days_allocated || parseInt(createForm.days_allocated, 10) <= 0) {
      setFormError('Number of Days must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/users', {
        ...createForm,
        access_type: 'days_based'
      });
      if (res.data && res.data.success) {
        flash(`✅ Days-Based User "${createForm.owner_name}" created successfully! (${createForm.days_allocated} Days)`);
        setShowCreateModal(false);
        setCreateForm({
          company_name: '',
          owner_name: '',
          username: '',
          password: '',
          email: '',
          phone: '',
          role: 'User',
          access_type: 'days_based',
          days_allocated: 30,
          start_date: todayStr,
          expiry_date: addDaysToDate(todayStr, 30),
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

  // ── Extend Days Modal ───────────────────────────────────────────
  const openExtendDays = (u) => {
    setExtendTarget(u);
    setExtendDaysVal(30);
    setExtendStartDateVal(todayStr);
    setExtendError('');
    setShowExtendModal(true);
  };

  const calculatePreviewExpiry = () => {
    if (!extendTarget) return '—';
    const numDays = parseInt(extendDaysVal, 10) || 0;
    if (extendTarget.days_status !== 'Expired' && extendTarget.expiry_date) {
      return formatDateDisplay(addDaysToDate(extendTarget.expiry_date, numDays));
    }
    return formatDateDisplay(addDaysToDate(extendStartDateVal || todayStr, numDays));
  };

  const handleExtendSubmit = async (e) => {
    e.preventDefault();
    if (!extendTarget) return;
    const num = parseInt(extendDaysVal, 10);
    if (isNaN(num) || num <= 0) {
      setExtendError('Please specify a positive number of days to add.');
      return;
    }

    setExtendSubmitting(true);
    setExtendError('');
    try {
      const res = await api.post(`/users/${extendTarget.id}/extend-days`, {
        daysToAdd: num,
        startDate: extendStartDateVal
      });
      if (res.data && res.data.success) {
        flash(`✅ Added ${num} days for "${extendTarget.full_name || extendTarget.username}". New expiry: ${formatDateDisplay(res.data.user.expiry_date)}`);
        setShowExtendModal(false);
        fetchUsers();
      }
    } catch (err) {
      setExtendError(err.response?.data?.message || 'Failed to extend days');
    } finally {
      setExtendSubmitting(false);
    }
  };

  // ── Edit User Modal ─────────────────────────────────────────────
  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({
      full_name: u.full_name || u.name || '',
      email: u.email || '',
      phone: u.phone || u.mobile || '',
      role: u.role || 'User',
      status: u.status || 'Active',
      access_type: u.access_type || 'days_based',
      days_allocated: u.days_allocated || 30,
      start_date: u.start_date || todayStr,
      expiry_date: u.expiry_date || addDaysToDate(todayStr, 30),
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

  // ── Status Toggle ───────────────────────────────────────────────
  const handleToggleStatus = async (u) => {
    const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
    const confirmMsg = nextStatus === 'Disabled' 
      ? `Are you sure you want to DISABLE "${u.full_name || u.username}"? Their days-based access will be paused immediately.`
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

  // ── View User Details Modal ─────────────────────────────────────
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

  const getStatusBadge = (u) => {
    if (u.status === 'Disabled') {
      return <Badge color="red">🔴 Disabled</Badge>;
    }
    const timeStr = getRemainingTimeDisplay(u);
    if (u.days_status === 'Expired' || u.is_expired || u.remaining_days <= 0 || timeStr === 'Expired') {
      return <Badge color="red">⚠️ Expired</Badge>;
    }
    if (u.days_status === 'Expiring Soon' || u.remaining_days <= 5) {
      return <Badge color="amber">⏳ Expiring Soon ({timeStr})</Badge>;
    }
    return <Badge color="green">● Active</Badge>;
  };

  const getRemainingDaysPill = (u) => {
    if (u.status === 'Disabled') {
      return <span style={{ color: '#94a3b8', fontWeight: 600 }}>0 Days (Disabled)</span>;
    }
    const timeStr = getRemainingTimeDisplay(u);
    if (u.is_expired || u.remaining_days <= 0 || timeStr === 'Expired') {
      return <span style={{ color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>Expired</span>;
    }
    if (u.remaining_days <= 5) {
      return <span style={{ color: '#d97706', fontWeight: 700, background: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>{timeStr}</span>;
    }
    return <span style={{ color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>{timeStr}</span>;
  };

  return (
    <div className="user-accounts-page" style={{ padding: '24px', backgroundColor: '#f8fafc' }}>
      
      {/* Notifications */}
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
          <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: '600', textTransform: 'uppercase' }}>Total Days-Based Users</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0284c7', marginTop: '4px' }}>{summary.totalDaysUsers ?? usersList.length}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '600', textTransform: 'uppercase' }}>Active Subscriptions</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#16a34a', marginTop: '4px' }}>{summary.activeDaysUsers ?? 0}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#b45309', fontWeight: '600', textTransform: 'uppercase' }}>Expiring Soon (≤5d)</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#d97706', marginTop: '4px' }}>{summary.expiringSoonDaysUsers ?? 0}</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '600', textTransform: 'uppercase' }}>Expired Users</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#dc2626', marginTop: '4px' }}>{summary.expiredDaysUsers ?? 0}</div>
        </div>
      </div>

      {/* ── Main Days-Based Users Table Card ──────────────────────── */}
      <div className="user-accounts-card">
        {/* Header */}
        <div className="user-header-row">
          <div className="user-header-left">
            <div className="user-avatar-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h1 className="user-header-title">Days Based Users</h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                Manage validity duration, track expiry dates & extend subscriptions
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-add-account"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7' }}
            >
              ➕ Add Days-Based User
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
              <option value="Expiring Soon">Expiring Soon (≤5 Days)</option>
              <option value="Expired">Expired Only</option>
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

        {/* Days-Based Users Table */}
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
                <th>Total Days</th>
                <th>Start Date</th>
                <th>Expiry Date</th>
                <th>Remaining Days</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" className="user-empty-row">Loading days-based users...</td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan="13" className="user-empty-row">
                    No Days-Based users found. Click "+ Add Days-Based User" or convert an existing user from Manage Users.
                  </td>
                </tr>
              ) : (
                usersList.map((u, idx) => (
                  <tr key={u.id}>
                    <td style={{ color: '#64748b', fontWeight: '500' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: '#e0f2fe', 
                          color: '#0284c7', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: '700', 
                          fontSize: '13px' 
                        }}>
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
                      <Badge color="purple">{u.role}</Badge>
                    </td>
                    <td>
                      <Badge color="blue">🔵 Days Based</Badge>
                    </td>
                    <td style={{ fontWeight: '600', color: '#0f172a' }}>
                      {u.days_allocated ? `${u.days_allocated} Days` : '—'}
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#475569' }}>
                      {formatDateDisplay(u.start_date)}
                    </td>
                    <td style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>
                      {formatDateDisplay(u.expiry_date)}
                    </td>
                    <td>
                      {getRemainingDaysPill(u)}
                    </td>
                    <td>
                      {getStatusBadge(u)}
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openUserDetails(u)}
                          title="View Details"
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
                          onClick={() => openExtendDays(u)}
                          title="Extend Days"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #7dd3fc',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          ⏳ Extend
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Edit User / Access Type"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✏️ Edit
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
                          {u.status === 'Active' ? 'Disable' : 'Enable'}
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

      {/* ── Modal: Add Days-Based User ────────────────────────────── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '650px', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔵</span> Add Days-Based User
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Create an account with duration-based subscription access
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {formError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Company / Tenant Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Enterprise"
                      value={createForm.company_name}
                      onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Owner / Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      required
                      value={createForm.owner_name}
                      onChange={(e) => setCreateForm({ ...createForm, owner_name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Username *</label>
                    <input
                      type="text"
                      placeholder="e.g. johndoe"
                      required
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Password *</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address *</label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Phone Number</label>
                    <input
                      type="text"
                      placeholder="919876543210"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Assigned Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', background: '#fff' }}
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                    {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
                  </select>
                </div>

                {/* ── Days-Based Validity Configuration Box ── */}
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⏳</span> Subscription Validity Setup
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#0c4a6e', marginBottom: '5px' }}>Number of Days *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={createForm.days_allocated}
                        onChange={(e) => handleCreateDaysChange(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #7dd3fc', fontSize: '13.5px', background: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#0c4a6e', marginBottom: '5px' }}>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={createForm.start_date}
                        onChange={(e) => handleCreateStartDateChange(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #7dd3fc', fontSize: '13.5px', background: '#fff' }}
                      />
                    </div>
                  </div>

                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: '#e0f2fe',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600 }}>
                      Calculated Expiry Date:
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
                      {formatDateDisplay(createForm.expiry_date)}
                    </span>
                  </div>
                </div>

                {/* Module Permissions */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Allowed Module Permissions</label>
                  <ModuleAccessSelector
                    selectedModules={createForm.allowed_modules}
                    onChange={(modules) => setCreateForm({ ...createForm, allowed_modules: modules })}
                    role={createForm.role}
                    showAdminModules={true}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '9px 20px', background: '#0284c7', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer' }}
                  >
                    {submitting ? 'Creating User...' : 'Create Days-Based User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Extend Days ─────────────────────────────────────── */}
      {showExtendModal && extendTarget && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏳</span> Extend Days Access
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Extend validity duration for <strong>{extendTarget.full_name || extendTarget.username}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {extendError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  {extendError}
                </div>
              )}

              {/* Current Status Box */}
              <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Current Expiry Date:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatDateDisplay(extendTarget.expiry_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Current Remaining Days:</span>
                  <span style={{ fontWeight: 700, color: extendTarget.is_expired ? '#dc2626' : '#16a34a' }}>
                    {extendTarget.is_expired ? 'Expired (0 Days)' : `${extendTarget.remaining_days} Days`}
                  </span>
                </div>
              </div>

              <form onSubmit={handleExtendSubmit}>
                {/* Presets */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Quick Add Presets</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[7, 15, 30, 60, 90, 180, 365].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setExtendDaysVal(d)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: extendDaysVal === d ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: extendDaysVal === d ? '#e0f2fe' : '#ffffff',
                          color: extendDaysVal === d ? '#0369a1' : '#334155',
                          fontWeight: extendDaysVal === d ? 700 : 500,
                          cursor: 'pointer',
                          fontSize: '12.5px'
                        }}
                      >
                        +{d} Days
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Days to Add *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={extendDaysVal}
                    onChange={(e) => setExtendDaysVal(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                {extendTarget.is_expired && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>New Start Date (Since Expired)</label>
                    <input
                      type="date"
                      value={extendStartDateVal}
                      onChange={(e) => setExtendStartDateVal(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                )}

                {/* Live Preview Box */}
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#ecfdf5',
                  borderRadius: '10px',
                  border: '1px solid #a7f3d0',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 600 }}>New Expiry Date:</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#047857' }}>{calculatePreviewExpiry()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowExtendModal(false)}
                    style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={extendSubmitting}
                    style={{ padding: '9px 20px', background: '#0284c7', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#fff', cursor: extendSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    {extendSubmitting ? 'Extending...' : 'Confirm & Extend Days'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit User (Supports Switching Access Type) ──────── */}
      {showEditModal && editTarget && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '650px', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  ✏️ Edit User & Access Model
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Edit account profile, permissions, or switch access between Credit Based & Days Based
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {editError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  {editError}
                </div>
              )}

              <form onSubmit={handleEditSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Full Name</label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Phone Number</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', background: '#fff' }}
                    >
                      <option value="User">User</option>
                      <option value="Admin">Admin</option>
                      {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
                    </select>
                  </div>
                </div>

                {/* ── Access Type Selector ── */}
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '18px'
                }}>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                    Access & Billing Model
                  </label>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
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
                        onChange={() => setEditForm({ ...editForm, access_type: 'days_based' })}
                      />
                      <span>🔵 Days Based</span>
                    </label>

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
                  </div>

                  {editForm.access_type === 'days_based' ? (
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
                              expiry_date: addDaysToDate(editForm.start_date || todayStr, d)
                            });
                          }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Expiry Date</label>
                        <input
                          type="date"
                          value={editForm.expiry_date || ''}
                          onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Credit Balance</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.credits}
                        onChange={(e) => setEditForm({ ...editForm, credits: parseInt(e.target.value, 10) || 0 })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Modules */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Allowed Module Permissions</label>
                  <ModuleAccessSelector
                    selectedModules={editForm.allowed_modules}
                    onChange={(modules) => setEditForm({ ...editForm, allowed_modules: modules })}
                    role={editForm.role}
                    showAdminModules={true}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    style={{ padding: '9px 20px', background: '#0284c7', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#fff', cursor: editSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    {editSubmitting ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: View User Details ──────────────────────────────── */}
      {showDetailsModal && detailsTarget && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '650px', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  User Details & Access Status
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  @{detailsTarget.username} — {detailsTarget.organization_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {detailsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading details...</div>
              ) : (
                <>
                  {/* Access Status Card */}
                  <div style={{
                    padding: '18px',
                    backgroundColor: detailsTarget.is_days_based ? '#f0f9ff' : '#f0fdf4',
                    border: detailsTarget.is_days_based ? '1px solid #bae6fd' : '1px solid #bbf7d0',
                    borderRadius: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: detailsTarget.is_days_based ? '#0369a1' : '#15803d', marginBottom: '12px' }}>
                      {detailsTarget.is_days_based ? '🔵 Days-Based Subscription Details' : '🟢 Credit-Based Access Details'}
                    </div>

                    {detailsTarget.is_days_based ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Access Model:</span>
                          <strong style={{ color: '#0369a1' }}>Days Based</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Total Days:</span>
                          <strong>{detailsTarget.days_allocated || 0} Days</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Start Date:</span>
                          <strong>{formatDateDisplay(detailsTarget.start_date)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Expiry Date:</span>
                          <strong>{formatDateDisplay(detailsTarget.expiry_date)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Remaining Days:</span>
                          {getRemainingDaysPill(detailsTarget)}
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Status:</span>
                          {getStatusBadge(detailsTarget)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Access Model:</span>
                          <strong style={{ color: '#15803d' }}>Credit Based</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Available Credits:</span>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>{Number(detailsTarget.credits || 0).toLocaleString()}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px', fontSize: '13.5px' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Full Name</span>
                      <strong>{detailsTarget.full_name || detailsTarget.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Email</span>
                      <strong>{detailsTarget.email || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Phone</span>
                      <strong>{detailsTarget.phone || detailsTarget.mobile || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Role</span>
                      <Badge color="purple">{detailsTarget.role}</Badge>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Last Login</span>
                      <span>{detailsTarget.last_login_at ? new Date(detailsTarget.last_login_at).toLocaleString() : 'Never'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Account Status</span>
                      <Badge color={detailsTarget.status === 'Active' ? 'green' : 'red'}>{detailsTarget.status}</Badge>
                    </div>
                  </div>

                  {/* Audit Activity */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>Recent Activity Logs</h3>
                    {userActivityList.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No audit activity recorded yet.</div>
                    ) : (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                        {userActivityList.map((log) => (
                          <div key={log.id} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                              <strong>{log.action}</strong>
                              <span style={{ color: '#94a3b8' }}>{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ color: '#64748b', marginTop: '2px' }}>{log.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '14px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                style={{ padding: '8px 18px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
