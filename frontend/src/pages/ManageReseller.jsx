import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTitle } from '../context/TitleContext.jsx';
import api from '../services/api.js';
import ModuleAccessSelector from '../components/ModuleAccessSelector.jsx';
import { SIDEBAR_MODULE_CONFIG } from '../config/modules.js';
import './ManageReseller.css';

// ── Helper: All module keys for default selection ────────────────────────────
const ALL_MODULE_KEYS = SIDEBAR_MODULE_CONFIG
  .filter(m => m.key !== 'reseller') // Resellers cannot add resellers themselves
  .flatMap(m => [m.key, ...m.subItems.map(s => s.key)]);

// ── Helper: Badge Component ──────────────────────────────────────────────────
function Badge({ children, color }) {
  const palettes = {
    green:  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    red:    { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
    blue:   { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
    amber:  { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    gray:   { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
    teal:   { bg: '#ccfbf1', text: '#0f766e', border: '#5eead4' },
  };
  const p = palettes[color] || palettes.gray;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: p.bg, color: p.text, border: `1px solid ${p.border}`,
      whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4
    }}>{children}</span>
  );
}

// ── Helper: format date ──────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

// ── Helper: add days to date ─────────────────────────────────────────────────
function addDaysToDate(dateStr, days) {
  const numDays = parseInt(days, 10) || 0;
  const base = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(base.getTime())) return '';
  const r = new Date(base);
  r.setDate(r.getDate() + numDays);
  return r.toISOString().split('T')[0];
}

const todayStr = new Date().toISOString().split('T')[0];

// ── Default form values ──────────────────────────────────────────────────────
function defaultForm() {
  return {
    company_name: '',
    owner_name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    access_type: 'credit_based',
    days_allocated: 30,
    start_date: todayStr,
    expiry_date: addDaysToDate(todayStr, 30),
    credits: 0,
    allowed_modules: [...ALL_MODULE_KEYS],
  };
}

// ────────────────────────────────────────────────────────────────────────────
export default function ManageReseller() {
  const { user } = useAuth();
  const { setTitle } = useTitle();

  const [resellerList, setResellerList] = useState([]);
  const [summary, setSummary] = useState({ totalResellers: 0, activeResellers: 0, disabledResellers: 0, totalSubUsers: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(defaultForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetResult, setResetResult] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sub-users preview
  const [showSubUsersModal, setShowSubUsersModal] = useState(false);
  const [subUsersTarget, setSubUsersTarget] = useState(null);
  const [subUsers, setSubUsers] = useState([]);
  const [subUsersLoading, setSubUsersLoading] = useState(false);

  useEffect(() => { setTitle('Manage Resellers'); }, [setTitle]);

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 5000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  // ── Fetch Resellers ──────────────────────────────────────────────────────
  const fetchResellers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'All') params.status = statusFilter;

      const res = await api.get('/resellers', { params, silent: true });
      if (res.data?.success) {
        setResellerList(res.data.resellers || []);
        if (res.data.summary) setSummary(res.data.summary);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch resellers');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => { fetchResellers(); }, [fetchResellers]);

  // ── Create Reseller ──────────────────────────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!createForm.owner_name || !createForm.username || !createForm.password || !createForm.email) {
      setFormError('Owner Name, Username, Password, and Email are required.');
      return;
    }
    if (createForm.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (createForm.access_type === 'days_based' && (!createForm.days_allocated || parseInt(createForm.days_allocated) <= 0)) {
      setFormError('Days must be greater than 0 for Days-Based access.');
      return;
    }
    if (createForm.allowed_modules.length === 0) {
      setFormError('Please select at least one module for this reseller.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/resellers', createForm);
      if (res.data?.success) {
        flash(`Reseller "${createForm.username}" created successfully!`);
        setShowCreateModal(false);
        setCreateForm(defaultForm());
        fetchResellers();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create reseller');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit Reseller ────────────────────────────────────────────────────────
  const openEditModal = (r) => {
    setEditTarget(r);
    setEditForm({
      full_name: r.full_name || r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      access_type: r.access_type || 'credit_based',
      days_allocated: r.days_allocated || 30,
      start_date: r.start_date ? r.start_date.split('T')[0] : todayStr,
      expiry_date: r.expiry_date ? r.expiry_date.split('T')[0] : addDaysToDate(todayStr, 30),
      credits: r.credits || 0,
      allowed_modules: Array.isArray(r.allowed_modules) ? r.allowed_modules : [...ALL_MODULE_KEYS],
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (!editForm.full_name) { setEditError('Owner Name is required.'); return; }
    if (editForm.allowed_modules.length === 0) { setEditError('Please select at least one module.'); return; }

    setEditSubmitting(true);
    try {
      const res = await api.put(`/resellers/${editTarget.id}`, editForm);
      if (res.data?.success) {
        flash('Reseller updated successfully!');
        setShowEditModal(false);
        fetchResellers();
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update reseller');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Toggle Status ────────────────────────────────────────────────────────
  const handleToggleStatus = async (r) => {
    const nextStatus = r.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await api.patch(`/resellers/${r.id}/status`, { status: nextStatus });
      flash(`Reseller ${nextStatus === 'Active' ? 'enabled' : 'disabled'} successfully`);
      fetchResellers();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to update status', true);
    }
  };

  // ── Reset Password ───────────────────────────────────────────────────────
  const openResetModal = (r) => {
    setResetTarget(r);
    setResetPw('');
    setResetResult('');
    setShowResetModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetSubmitting(true);
    try {
      const res = await api.post(`/resellers/${resetTarget.id}/reset-password`, { password: resetPw });
      if (res.data?.success) {
        setResetResult(`New password: ${res.data.temporaryPassword}`);
      }
    } catch (err) {
      setResetResult('Error: ' + (err.response?.data?.message || 'Failed'));
    } finally {
      setResetSubmitting(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const openDeleteModal = (r) => { setDeleteTarget(r); setShowDeleteModal(true); };
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/resellers/${deleteTarget.id}`);
      flash('Reseller deleted successfully');
      setShowDeleteModal(false);
      fetchResellers();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete reseller', true);
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── Sub-Users Preview ────────────────────────────────────────────────────
  const openSubUsers = async (r) => {
    setSubUsersTarget(r);
    setShowSubUsersModal(true);
    setSubUsersLoading(true);
    setSubUsers([]);
    try {
      // Call dedicated reseller sub-users endpoint
      const res = await api.get(`/resellers/${r.id}/users`, { silent: true });
      if (res.data?.success && Array.isArray(res.data.users)) {
        setSubUsers(res.data.users);
      } else {
        // Fallback with reseller_id query param
        const fallbackRes = await api.get('/users', { params: { reseller_id: r.id }, silent: true });
        if (fallbackRes.data?.success && Array.isArray(fallbackRes.data.users)) {
          setSubUsers(fallbackRes.data.users.filter(u => String(u.created_by_user_id) === String(r.id)));
        } else {
          setSubUsers([]);
        }
      }
    } catch {
      try {
        const fallbackRes = await api.get('/users', { params: { reseller_id: r.id }, silent: true });
        if (fallbackRes.data?.success && Array.isArray(fallbackRes.data.users)) {
          setSubUsers(fallbackRes.data.users.filter(u => String(u.created_by_user_id) === String(r.id)));
        } else {
          setSubUsers([]);
        }
      } catch {
        setSubUsers([]);
      }
    } finally {
      setSubUsersLoading(false);
    }
  };

  // ── Rendered UI ──────────────────────────────────────────────────────────
  return (
    <div className="manage-reseller-page">

      {/* Page Header */}
      <div className="mr-page-header">
        <div>
          <h1 className="mr-page-title">Reseller Management</h1>
          <p className="mr-page-subtitle">Create and manage reseller accounts. Grant module access and sub-user management permissions.</p>
        </div>
        <button id="btn-add-reseller" className="mr-btn-primary" onClick={() => { setCreateForm(defaultForm()); setFormError(''); setShowCreateModal(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Reseller
        </button>
      </div>

      {/* Flash Messages */}
      {error && <div className="mr-flash mr-flash--error">{error}</div>}
      {success && <div className="mr-flash mr-flash--success">{success}</div>}

      {/* Stats Cards */}
      <div className="mr-stats-grid">
        <div className="mr-stat-card mr-stat-card--total">
          <div className="mr-stat-icon">🏢</div>
          <div className="mr-stat-value">{summary.totalResellers}</div>
          <div className="mr-stat-label">Total Resellers</div>
        </div>
        <div className="mr-stat-card mr-stat-card--active">
          <div className="mr-stat-icon">✅</div>
          <div className="mr-stat-value">{summary.activeResellers}</div>
          <div className="mr-stat-label">Active</div>
        </div>
        <div className="mr-stat-card mr-stat-card--disabled">
          <div className="mr-stat-icon">🚫</div>
          <div className="mr-stat-value">{summary.disabledResellers}</div>
          <div className="mr-stat-label">Disabled</div>
        </div>
        <div className="mr-stat-card mr-stat-card--users">
          <div className="mr-stat-icon">👥</div>
          <div className="mr-stat-value">{summary.totalSubUsers}</div>
          <div className="mr-stat-label">Total Sub-Users</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mr-filters">
        <div className="mr-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            id="reseller-search"
            type="text"
            placeholder="Search resellers by name, email, username..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select id="reseller-status-filter" className="mr-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Disabled">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="mr-table-wrapper">
        {loading ? (
          <div className="mr-loading">
            <div className="mr-spinner"></div>
            <span>Loading resellers...</span>
          </div>
        ) : resellerList.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">🏢</div>
            <p>No resellers found.</p>
            <button className="mr-btn-primary" onClick={() => { setCreateForm(defaultForm()); setShowCreateModal(true); }}>
              Create First Reseller
            </button>
          </div>
        ) : (
          <table className="mr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Reseller</th>
                <th>Contact</th>
                <th>Access Type</th>
                <th>Credits / Days</th>
                <th>Sub-Users</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resellerList.map((r, idx) => (
                <tr key={r.id}>
                  <td className="mr-td-idx">{idx + 1}</td>
                  <td>
                    <div className="mr-user-cell">
                      <div className="mr-avatar">{(r.full_name || r.username || '?')[0].toUpperCase()}</div>
                      <div>
                        <div className="mr-user-name">{r.full_name || r.name}</div>
                        <div className="mr-user-username">@{r.username}</div>
                        {r.organization_name && <div className="mr-user-org">{r.organization_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{r.email}</div>
                    {r.phone && <div style={{ fontSize: 12, color: '#64748b' }}>{r.phone}</div>}
                  </td>
                  <td>
                    {r.is_days_based
                      ? <Badge color="teal">Days Based</Badge>
                      : <Badge color="blue">Credit Based</Badge>}
                  </td>
                  <td>
                    {r.is_days_based
                      ? <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{r.remaining_days ?? '—'} days left</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Exp: {formatDate(r.expiry_date)}</div>
                        </div>
                      : <div style={{ fontSize: 13, fontWeight: 600 }}>{r.credits?.toLocaleString()} credits</div>}
                  </td>
                  <td>
                    <button className="mr-subusers-btn" onClick={() => openSubUsers(r)}>
                      <span className="mr-subusers-count">{r.sub_user_count || 0}</span>
                      users
                    </button>
                  </td>
                  <td>
                    <Badge color={r.status === 'Active' ? 'green' : 'red'}>
                      {r.status === 'Active' ? '● Active' : '○ Disabled'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{formatDate(r.created_at)}</td>
                  <td>
                    <div className="mr-actions">
                      <button className="mr-action-btn mr-action-btn--edit" title="Edit" onClick={() => openEditModal(r)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="mr-action-btn mr-action-btn--reset" title="Reset Password" onClick={() => openResetModal(r)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </button>
                      <button
                        className={`mr-action-btn ${r.status === 'Active' ? 'mr-action-btn--disable' : 'mr-action-btn--enable'}`}
                        title={r.status === 'Active' ? 'Disable' : 'Enable'}
                        onClick={() => handleToggleStatus(r)}
                      >
                        {r.status === 'Active'
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                      </button>
                      <button className="mr-action-btn mr-action-btn--delete" title="Delete" onClick={() => openDeleteModal(r)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Reseller Modal ─────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="mr-modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="mr-modal mr-modal--wide">
            <div className="mr-modal-header">
              <h2>Create New Reseller</h2>
              <button className="mr-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="mr-modal-body">
              {formError && <div className="mr-flash mr-flash--error">{formError}</div>}

              <div className="mr-form-section">
                <h3 className="mr-form-section-title">Reseller Details</h3>
                <div className="mr-form-grid">
                  <div className="mr-form-group">
                    <label>Owner / Full Name *</label>
                    <input type="text" value={createForm.owner_name} onChange={e => setCreateForm(f => ({ ...f, owner_name: e.target.value }))} placeholder="e.g. Rahul Sharma" required />
                  </div>
                  <div className="mr-form-group">
                    <label>Company Name</label>
                    <input type="text" value={createForm.company_name} onChange={e => setCreateForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Rahul Digital Pvt Ltd" />
                  </div>
                  <div className="mr-form-group">
                    <label>Username *</label>
                    <input type="text" value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))} placeholder="e.g. rahuldigital" required />
                  </div>
                  <div className="mr-form-group">
                    <label>Email Address *</label>
                    <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="reseller@email.com" required />
                  </div>
                  <div className="mr-form-group">
                    <label>Phone Number</label>
                    <input type="tel" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9876543210" />
                  </div>
                  <div className="mr-form-group">
                    <label>Password *</label>
                    <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" required />
                  </div>
                </div>
              </div>

              <div className="mr-form-section">
                <h3 className="mr-form-section-title">Access Configuration</h3>
                <div className="mr-form-group mr-form-group--inline">
                  <label>Access Type</label>
                  <div className="mr-radio-group">
                    <label className={`mr-radio-option ${createForm.access_type === 'credit_based' ? 'mr-radio-option--active' : ''}`}>
                      <input type="radio" name="create_access_type" value="credit_based" checked={createForm.access_type === 'credit_based'} onChange={e => setCreateForm(f => ({ ...f, access_type: e.target.value }))} />
                      💳 Credit Based
                    </label>
                    <label className={`mr-radio-option ${createForm.access_type === 'days_based' ? 'mr-radio-option--active' : ''}`}>
                      <input type="radio" name="create_access_type" value="days_based" checked={createForm.access_type === 'days_based'} onChange={e => setCreateForm(f => ({ ...f, access_type: e.target.value }))} />
                      📅 Days Based
                    </label>
                  </div>
                </div>

                {createForm.access_type === 'credit_based' ? (
                  <div className="mr-form-group">
                    <label>Initial Credits</label>
                    <input type="number" min="0" value={createForm.credits} onChange={e => setCreateForm(f => ({ ...f, credits: parseInt(e.target.value) || 0 }))} placeholder="0" />
                  </div>
                ) : (
                  <div className="mr-form-grid">
                    <div className="mr-form-group">
                      <label>Number of Days *</label>
                      <input type="number" min="1" value={createForm.days_allocated} onChange={e => {
                        const d = parseInt(e.target.value) || 30;
                        setCreateForm(f => ({ ...f, days_allocated: d, expiry_date: addDaysToDate(f.start_date, d) }));
                      }} />
                    </div>
                    <div className="mr-form-group">
                      <label>Start Date</label>
                      <input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value, expiry_date: addDaysToDate(e.target.value, f.days_allocated) }))} />
                    </div>
                    <div className="mr-form-group">
                      <label>Expiry Date</label>
                      <input type="date" value={createForm.expiry_date} onChange={e => setCreateForm(f => ({ ...f, expiry_date: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              <div className="mr-form-section">
                <h3 className="mr-form-section-title">Module Access Permissions</h3>
                <p className="mr-form-hint">Select which modules and sub-features this reseller can access in their dashboard.</p>
                <ModuleAccessSelector
                  selectedKeys={createForm.allowed_modules}
                  onChange={keys => setCreateForm(f => ({ ...f, allowed_modules: keys }))}
                  showAdminModules={true}
                  title="Sidebar Access Controls (Select Allowed Modules & Sub-Features)"
                />
              </div>

              <div className="mr-modal-footer">
                <button type="button" className="mr-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="mr-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Reseller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Reseller Modal ───────────────────────────────────────────── */}
      {showEditModal && editTarget && (
        <div className="mr-modal-overlay" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="mr-modal mr-modal--wide">
            <div className="mr-modal-header">
              <h2>Edit Reseller — {editTarget.username}</h2>
              <button className="mr-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className="mr-modal-body">
              {editError && <div className="mr-flash mr-flash--error">{editError}</div>}

              <div className="mr-form-section">
                <h3 className="mr-form-section-title">Reseller Details</h3>
                <div className="mr-form-grid">
                  <div className="mr-form-group">
                    <label>Owner / Full Name *</label>
                    <input type="text" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <div className="mr-form-group">
                    <label>Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="mr-form-group">
                    <label>Phone Number</label>
                    <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="mr-form-section">
                <h3 className="mr-form-section-title">Access Configuration</h3>
                <div className="mr-form-group mr-form-group--inline">
                  <label>Access Type</label>
                  <div className="mr-radio-group">
                    <label className={`mr-radio-option ${editForm.access_type === 'credit_based' ? 'mr-radio-option--active' : ''}`}>
                      <input type="radio" name="edit_access_type" value="credit_based" checked={editForm.access_type === 'credit_based'} onChange={e => setEditForm(f => ({ ...f, access_type: e.target.value }))} />
                      💳 Credit Based
                    </label>
                    <label className={`mr-radio-option ${editForm.access_type === 'days_based' ? 'mr-radio-option--active' : ''}`}>
                      <input type="radio" name="edit_access_type" value="days_based" checked={editForm.access_type === 'days_based'} onChange={e => setEditForm(f => ({ ...f, access_type: e.target.value }))} />
                      📅 Days Based
                    </label>
                  </div>
                </div>

                {editForm.access_type === 'credit_based' ? (
                  <div className="mr-form-group">
                    <label>Credits</label>
                    <input type="number" min="0" value={editForm.credits} onChange={e => setEditForm(f => ({ ...f, credits: parseInt(e.target.value) || 0 }))} />
                  </div>
                ) : (
                  <div className="mr-form-grid">
                    <div className="mr-form-group">
                      <label>Number of Days</label>
                      <input type="number" min="1" value={editForm.days_allocated} onChange={e => {
                        const d = parseInt(e.target.value) || 30;
                        setEditForm(f => ({ ...f, days_allocated: d, expiry_date: addDaysToDate(f.start_date, d) }));
                      }} />
                    </div>
                    <div className="mr-form-group">
                      <label>Start Date</label>
                      <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value, expiry_date: addDaysToDate(e.target.value, f.days_allocated) }))} />
                    </div>
                    <div className="mr-form-group">
                      <label>Expiry Date</label>
                      <input type="date" value={editForm.expiry_date} onChange={e => setEditForm(f => ({ ...f, expiry_date: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              <div className="mr-form-section">
                <h3 className="mr-form-section-title">Module Access Permissions</h3>
                <ModuleAccessSelector
                  selectedKeys={editForm.allowed_modules}
                  onChange={keys => setEditForm(f => ({ ...f, allowed_modules: keys }))}
                  showAdminModules={true}
                  title="Sidebar Access Controls (Select Allowed Modules & Sub-Features)"
                />
              </div>

              <div className="mr-modal-footer">
                <button type="button" className="mr-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="mr-btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────── */}
      {showResetModal && resetTarget && (
        <div className="mr-modal-overlay" onClick={e => e.target === e.currentTarget && setShowResetModal(false)}>
          <div className="mr-modal mr-modal--sm">
            <div className="mr-modal-header">
              <h2>Reset Password — {resetTarget.username}</h2>
              <button className="mr-modal-close" onClick={() => setShowResetModal(false)}>✕</button>
            </div>
            <div className="mr-modal-body">
              {resetResult ? (
                <div>
                  <div className="mr-flash mr-flash--success" style={{ marginBottom: 16 }}>
                    ✅ Password reset successfully!
                  </div>
                  <div className="mr-password-display">
                    <strong>New Password:</strong>
                    <code id="reseller-new-password">{resetResult.replace('New password: ', '')}</code>
                  </div>
                  <div className="mr-modal-footer">
                    <button className="mr-btn-primary" onClick={() => setShowResetModal(false)}>Done</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword}>
                  <div className="mr-form-group" style={{ marginBottom: 20 }}>
                    <label>New Password (leave empty to auto-generate)</label>
                    <input type="text" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="Enter new password or leave blank..." />
                  </div>
                  <div className="mr-modal-footer">
                    <button type="button" className="mr-btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
                    <button type="submit" className="mr-btn-primary" disabled={resetSubmitting}>
                      {resetSubmitting ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {showDeleteModal && deleteTarget && (
        <div className="mr-modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}>
          <div className="mr-modal mr-modal--sm">
            <div className="mr-modal-header mr-modal-header--danger">
              <h2>⚠️ Delete Reseller</h2>
              <button className="mr-modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="mr-modal-body">
              <p style={{ marginBottom: 8 }}>Are you sure you want to delete reseller <strong>{deleteTarget.username}</strong>?</p>
              <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 20 }}>
                ⚠️ This action cannot be undone. Resellers with existing sub-users cannot be deleted.
              </p>
              <div className="mr-modal-footer">
                <button className="mr-btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="mr-btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete Reseller'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Users Modal ───────────────────────────────────────────────── */}
      {showSubUsersModal && subUsersTarget && (
        <div className="mr-modal-overlay" onClick={e => e.target === e.currentTarget && setShowSubUsersModal(false)}>
          <div className="mr-modal mr-modal--wide">
            <div className="mr-modal-header">
              <h2>Sub-Users — {subUsersTarget.username} ({subUsersLoading ? (subUsersTarget.sub_user_count || 0) : subUsers.length} users)</h2>
              <button className="mr-modal-close" onClick={() => setShowSubUsersModal(false)}>✕</button>
            </div>
            <div className="mr-modal-body">
              {subUsersLoading ? (
                <div className="mr-loading"><div className="mr-spinner"></div><span>Loading...</span></div>
              ) : subUsers.length === 0 ? (
                <div className="mr-empty" style={{ minHeight: 120 }}>
                  <p>No sub-users created yet by this reseller.</p>
                </div>
              ) : (
                <table className="mr-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Username</th><th>Email</th><th>Status</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {subUsers.map((u, i) => (
                      <tr key={u.id}>
                        <td>{i + 1}</td>
                        <td>{u.full_name || u.name}</td>
                        <td>@{u.username}</td>
                        <td>{u.email}</td>
                        <td><Badge color={u.status === 'Active' ? 'green' : 'red'}>{u.status}</Badge></td>
                        <td>{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mr-modal-footer">
                <button className="mr-btn-secondary" onClick={() => setShowSubUsersModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
