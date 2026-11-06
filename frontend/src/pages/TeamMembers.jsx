import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTitle } from '../context/TitleContext.jsx';
import { API_BASE_URL } from '../config.js';
import api from '../services/api.js';
import ModuleAccessSelector from '../components/ModuleAccessSelector.jsx';
import { SIDEBAR_MODULE_CONFIG, ROLE_PRESET_MODULES, DEFAULT_ALLOWED_MODULES } from '../config/modules.js';
import './TeamMembers.css';

export default function TeamMembers() {
  const { user, refreshUser } = useAuth();
  const { setTitle } = useTitle();

  // Only true Super Admin can see global cross-user/multi-tenant views
  const isSuperAdmin = !user?.is_team_member && user?.role === 'Super Admin' && user?.username === 'admin';

  /**
   * creatorAllowedScopeKeys — the CANONICAL list of SIDEBAR module keys that the
   * currently-logged-in user is allowed to delegate to a team member.
   */
  const creatorAllowedScopeKeys = useMemo(() => {
    if (isSuperAdmin) return null;

    const isOwnerAdmin = !user?.is_team_member && (user?.role === 'Super Admin' || user?.role === 'Admin');
    if (isOwnerAdmin && !user?.allowed_modules) return null;

    let sidebarKeys = null;
    if (user?.allowed_modules) {
      try {
        const parsed = typeof user.allowed_modules === 'string'
          ? JSON.parse(user.allowed_modules)
          : user.allowed_modules;
        if (Array.isArray(parsed) && parsed.length > 0) {
          sidebarKeys = parsed;
        }
      } catch (e) { /* malformed JSON — fall through */ }
    }

    if (sidebarKeys) return sidebarKeys;

    return [];
  }, [isSuperAdmin, user?.allowed_modules, user?.is_team_member, user?.role]);

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'audit_logs'
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    adminMembers: 0,
    staffMembers: 0,
    adminCreatedMembers: 0,
    userCreatedMembers: 0
  });

  // Filters & Scope
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'admin' | 'users'
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [creators, setCreators] = useState([]);
  const [displayMode, setDisplayMode] = useState('grouped'); // 'grouped' (user-wise) | 'flat' (standard list)

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditModuleFilter, setAuditModuleFilter] = useState('All');
  const [auditActionFilter, setAuditActionFilter] = useState('All');
  const [auditLoading, setAuditLoading] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showResetPwdModal, setShowResetPwdModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState(null);
  const [detailsTab, setDetailsTab] = useState('overview'); // 'overview' | 'stats' | 'permissions' | 'activity'

  // Inline password view/update state (lives inside the Details/Overview drawer)
  const [showPlainPassword, setShowPlainPassword] = useState(false);
  const [inlinePwd, setInlinePwd] = useState({ new_password: '', confirm_password: '' });
  const [inlinePwdError, setInlinePwdError] = useState('');
  const [inlinePwdSubmitting, setInlinePwdSubmitting] = useState(false);

  // Toast / Messages
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form Data for Create / Edit
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm_password: '',
    email: '',
    phone: '',
    role: 'Staff',
    permissions: [...(ROLE_PRESET_MODULES['Staff'] || ['dashboard', 'dashboard:view'])]
  });

  // Password reset data (separate modal — kept for backward compatibility)
  const [resetPwdData, setResetPwdData] = useState({
    new_password: '',
    confirm_password: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  useEffect(() => {
    setTitle('Team Members & Staff Access');
  }, [setTitle]);

  // Fetch Team Members
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/team-members', {
        params: {
          search,
          role: roleFilter,
          status: statusFilter,
          scope: scopeFilter,
          creator_user_id: creatorFilter
        }
      });
      if (res.data?.success) {
        setMembers(res.data.members || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.creators) {
          setCreators(res.data.creators);
        }
      }
    } catch (err) {
      console.error('Fetch team members error:', err);
      showToast(err.response?.data?.message || 'Failed to load team members', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, scopeFilter, creatorFilter]);

  // Fetch Tenant Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/team-members/activity/all', {
        params: {
          page: auditPage,
          limit: 20,
          module: auditModuleFilter,
          action: auditActionFilter,
          search
        }
      });
      if (res.data?.success) {
        setAuditLogs(res.data.logs || []);
        setAuditTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditModuleFilter, auditActionFilter, search]);

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    } else {
      fetchAuditLogs();
    }
  }, [fetchMembers, fetchAuditLogs, activeTab]);

  // Open Create Modal with fresh state
  const handleOpenCreate = async () => {
    await refreshUser();
    setFormError('');

    const staffPreset = ROLE_PRESET_MODULES['Staff'] || ['dashboard', 'dashboard:view'];
    const safeInitialPerms = creatorAllowedScopeKeys === null
      ? [...staffPreset]
      : staffPreset.filter(k => creatorAllowedScopeKeys.includes(k));

    setFormData({
      full_name: '',
      username: '',
      password: '',
      confirm_password: '',
      email: '',
      phone: '',
      role: 'Staff',
      permissions: safeInitialPerms
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = async (member) => {
    await refreshUser();
    setFormError('');
    setSelectedMember(member);

    const rawPerms = Array.isArray(member.permissions)
      ? member.permissions
      : (ROLE_PRESET_MODULES[member.role] || ['dashboard', 'dashboard:view']);
    const safePerms = creatorAllowedScopeKeys === null
      ? rawPerms
      : rawPerms.filter(k => creatorAllowedScopeKeys.includes(k));

    setFormData({
      full_name: member.full_name || member.name || '',
      username: member.username || '',
      email: member.email || '',
      phone: member.phone || member.mobile || '',
      role: member.role || 'Staff',
      permissions: safePerms
    });
    setShowEditModal(true);
  };

  // Open Details Modal / Drawer
  const handleOpenDetails = async (member) => {
    setSelectedMember(member);
    setSelectedMemberDetails(null);
    setDetailsTab('overview');

    // Reset inline password view/update state every time the drawer opens
    setShowPlainPassword(false);
    setInlinePwd({ new_password: '', confirm_password: '' });
    setInlinePwdError('');
    setInlinePwdSubmitting(false);

    setShowDetailsModal(true);

    try {
      const res = await api.get(`/team-members/${member.id}`);
      if (res.data?.success) {
        setSelectedMemberDetails(res.data);
      }
    } catch (err) {
      console.error('Fetch member details error:', err);
      showToast('Failed to load full member details', 'error');
    }
  };

  // Open Reset Password Modal (separate, quick-access modal from the row's key icon)
  const handleOpenResetPwd = (member) => {
    setFormError('');
    setSelectedMember(member);
    setResetPwdData({ new_password: '', confirm_password: '' });
    setShowResetPwdModal(true);
  };

  // Open Status Toggle Modal
  const handleOpenStatusModal = (member) => {
    setSelectedMember(member);
    setShowStatusModal(true);
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (member) => {
    setSelectedMember(member);
    setShowDeleteModal(true);
  };

  // Role change in form: auto-select preset module permissions, filtered to current user's scope
  const handleRoleChange = (newRole) => {
    const preset = ROLE_PRESET_MODULES[newRole];
    if (!preset) {
      setFormData(prev => ({ ...prev, role: newRole }));
      return;
    }
    const safePreset = creatorAllowedScopeKeys === null
      ? [...preset]
      : preset.filter(k => creatorAllowedScopeKeys.includes(k));
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: safePreset
    }));
  };

  // Permission Checkbox Toggle
  const handlePermissionToggle = (permKey) => {
    setFormData(prev => {
      const exists = prev.permissions.includes(permKey);
      const newPerms = exists
        ? prev.permissions.filter(k => k !== permKey)
        : [...prev.permissions, permKey];
      return { ...prev, permissions: newPerms };
    });
  };

  // Category Select/Clear All
  const handleCategoryPerms = (category, selectAll) => {
    const catKeys = category.permissions.map(p => p.key);
    setFormData(prev => {
      let updated;
      if (selectAll) {
        updated = Array.from(new Set([...prev.permissions, ...catKeys]));
      } else {
        updated = prev.permissions.filter(k => !catKeys.includes(k));
      }
      return { ...prev, permissions: updated };
    });
  };

  // Submit Create Team Member
  const handleCreateSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError('');

    const trimmedUser = (formData.username || '').trim();
    if (!trimmedUser) {
      const msg = 'Username is required';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      const msg = 'Password and confirmation do not match';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/team-members', {
        full_name: formData.full_name || trimmedUser,
        username: trimmedUser,
        password: formData.password,
        email: formData.email,
        phone: formData.phone,
        role: formData.role || 'Staff',
        permissions: formData.permissions
      });

      if (res.data?.success) {
        showToast(`Team member "${trimmedUser}" created successfully!`);
        setShowCreateModal(false);
        fetchMembers();
      } else {
        const msg = res.data?.message || 'Failed to create team member';
        setFormError(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      console.error('[CreateTeamMember] Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to create team member';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Team Member
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const res = await api.put(`/team-members/${selectedMember.id}`, {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        permissions: formData.permissions
      });

      if (res.data?.success) {
        showToast('Team member updated successfully!');
        setShowEditModal(false);
        fetchMembers();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update team member');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Status Toggle (Enable / Disable)
  const handleStatusSubmit = async () => {
    if (!selectedMember) return;
    setSubmitting(true);
    try {
      const targetNextStatus = selectedMember.status === 'Active' ? 'Disabled' : 'Active';
      const res = await api.patch(`/team-members/${selectedMember.id}/status`, {
        status: targetNextStatus
      });
      if (res.data?.success) {
        showToast(`Access ${targetNextStatus.toLowerCase()} for "${selectedMember.username}"`);
        setShowStatusModal(false);
        fetchMembers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update access status', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Reset Password (separate quick-access modal)
  const handleResetPwdSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!resetPwdData.new_password || resetPwdData.new_password.length < 6) {
      setFormError('New password must be at least 6 characters');
      return;
    }
    if (resetPwdData.new_password !== resetPwdData.confirm_password) {
      setFormError('Password and confirmation do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/team-members/${selectedMember.id}/reset-password`, resetPwdData);
      if (res.data?.success) {
        showToast(`Password reset successfully for "${selectedMember.username}"`);
        setShowResetPwdModal(false);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  // Inline Password Update — used directly from within the Details / Overview drawer
  const handleInlinePasswordUpdate = async () => {
    setInlinePwdError('');

    if (!inlinePwd.new_password || inlinePwd.new_password.length < 6) {
      setInlinePwdError('New password must be at least 6 characters');
      return;
    }
    if (inlinePwd.new_password !== inlinePwd.confirm_password) {
      setInlinePwdError('Password and confirmation do not match');
      return;
    }

    setInlinePwdSubmitting(true);
    try {
      const res = await api.post(`/team-members/${selectedMember.id}/reset-password`, inlinePwd);
      if (res.data?.success) {
        showToast(`Password updated successfully for "${selectedMember.username}"`);
        setInlinePwd({ new_password: '', confirm_password: '' });

        // Refresh member details so "Current Password" reflects the newly set value
        const detailsRes = await api.get(`/team-members/${selectedMember.id}`);
        if (detailsRes.data?.success) {
          setSelectedMemberDetails(detailsRes.data);
          setShowPlainPassword(true);
        }
      }
    } catch (err) {
      setInlinePwdError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setInlinePwdSubmitting(false);
    }
  };

  // Submit Delete Member (Soft Delete)
  const handleDeleteSubmit = async () => {
    if (!selectedMember) return;
    setSubmitting(true);
    try {
      const res = await api.delete(`/team-members/${selectedMember.id}`);
      if (res.data?.success) {
        showToast(`Team member "${selectedMember.username}" deleted successfully`);
        setShowDeleteModal(false);
        fetchMembers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete team member', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Group members by their creator user account
  const groupedByCreator = useMemo(() => {
    const groups = {};
    members.forEach(m => {
      const key = m.created_by_user_id || (m.is_created_by_admin ? 'admin' : 'user');
      if (!groups[key]) {
        groups[key] = {
          creatorId: m.created_by_user_id,
          creatorName: m.creator_name || 'Admin',
          creatorUsername: m.creator_username || 'admin',
          creatorRole: m.creator_role || 'Admin',
          isCreatedByAdmin: m.is_created_by_admin,
          orgName: m.organization_name || 'Official WABA',
          members: []
        };
      }
      groups[key].members.push(m);
    });
    return Object.values(groups);
  }, [members]);

  const renderMemberRow = (m, showCreatorCol = false) => {
    const initials = (m.full_name || m.username || 'U').substring(0, 2).toUpperCase();
    const isOwner = m.is_owner;
    const roleClass = `role-${(m.role || 'custom').toLowerCase()}`;

    return (
      <tr key={m.id}>
        <td>
          <div className="team-user-cell">
            <div className="team-user-avatar">
              {initials}
              <span className={`team-status-dot ${m.status === 'Active' ? 'dot-active' : 'dot-disabled'}`} />
            </div>
            <div>
              <div className="team-user-name-title">
                <span>{m.full_name || m.username}</span>
                {isOwner && <span className="team-owner-badge">Owner</span>}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Joined {formatDateTime(m.created_at).split(',')[0]}
              </div>
            </div>
          </div>
        </td>

        <td>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>@{m.username}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {m.email || m.phone || 'No email/phone'}
          </div>
        </td>

        {showCreatorCol && (
          <td>
            <span className={`team-creator-badge ${m.is_created_by_admin ? 'badge-admin-creator' : 'badge-user-creator'}`}>
              {m.is_created_by_admin ? `👑 Admin (${m.creator_name})` : `👤 ${m.creator_name} (@${m.creator_username})`}
            </span>
          </td>
        )}

        <td>
          <span className={`team-role-badge ${roleClass}`}>
            {m.role === 'Admin' ? '🛡️ Admin' : (m.role === 'Marketing' ? '🚀 Marketing' : (m.role === 'Sales' ? '💼 Sales' : (m.role === 'Support' ? '🎧 Support' : `⚙️ ${m.role}`)))}
          </span>
        </td>

        <td>
          <span className={`team-status-pill ${m.status === 'Active' ? 'status-active' : 'status-disabled'}`}>
            <span style={{ fontSize: '8px' }}>●</span>
            {m.status}
          </span>
        </td>

        <td style={{ color: '#475569', fontSize: '12px' }}>
          {formatDateTime(m.last_login_at)}
        </td>

        <td style={{ color: '#475569', fontSize: '12px' }}>
          {formatDateTime(m.last_activity_at)}
        </td>

        <td>
          <div className="team-action-btn-group" style={{ justifyContent: 'flex-end' }}>
            {/* View — shows profile, password, real statistics & activity history */}
            <button
              type="button"
              className="team-icon-btn"
              title="View Profile, Password & Audit"
              onClick={() => handleOpenDetails(m)}
            >
              👁️
            </button>

            {/* Edit */}
            <button
              type="button"
              className="team-icon-btn"
              title="Edit Member & Permissions"
              onClick={() => handleOpenEdit(m)}
            >
              ✏️
            </button>

            {/* Disable / Enable Toggle */}
            {!isOwner && (
              <button
                type="button"
                className="team-icon-btn"
                title={m.status === 'Active' ? 'Disable Access Immediately' : 'Enable Access'}
                onClick={() => handleOpenStatusModal(m)}
              >
                {m.status === 'Active' ? '🔒' : '🔓'}
              </button>
            )}

            {/* Reset Password (quick modal) */}
            <button
              type="button"
              className="team-icon-btn"
              title="Reset Password"
              onClick={() => handleOpenResetPwd(m)}
            >
              🔑
            </button>

            {/* Delete */}
            {!isOwner && (
              <button
                type="button"
                className="team-icon-btn team-icon-btn-danger"
                title="Delete Member Permanently"
                onClick={() => handleOpenDeleteModal(m)}
              >
                🗑️
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="team-page-container">

      {/* Toast Banner */}
      {toast.show && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff', padding: '12px 20px', borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', fontSize: '13px',
          fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span>{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="team-header-section">
        <div>
          <h1 className="team-header-title">
            <span>🛡️</span> Team Members & Staff Access
          </h1>
          <p className="team-header-subtitle">
            Manage your organization's staff, assign granular RBAC capabilities, and inspect real-time audit trails.
          </p>
        </div>

        <div className="team-header-actions">
          <div className="team-view-tabs">
            <button
              type="button"
              className={`team-view-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              👥 Team Directory ({summary.totalMembers})
            </button>
            <button
              type="button"
              className={`team-view-tab-btn ${activeTab === 'audit_logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit_logs')}
            >
              📜 Audit Trail
            </button>
          </div>

          <button
            type="button"
            className="team-btn-primary"
            onClick={handleOpenCreate}
          >
            <span>+</span> Create Team Member
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="team-kpi-grid">
        <div className="team-kpi-card">
          <div className="team-kpi-icon-wrap kpi-blue">👥</div>
          <div>
            <div className="team-kpi-label">Total Members</div>
            <div className="team-kpi-val">{summary.totalMembers}</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon-wrap kpi-green">🟢</div>
          <div>
            <div className="team-kpi-label">Active Access</div>
            <div className="team-kpi-val">{summary.activeMembers}</div>
          </div>
        </div>

        {isSuperAdmin ? (
          <>
            <div className="team-kpi-card">
              <div className="team-kpi-icon-wrap kpi-purple">👑</div>
              <div>
                <div className="team-kpi-label">Admin's Staff</div>
                <div className="team-kpi-val">{summary.adminCreatedMembers || 0}</div>
              </div>
            </div>

            <div className="team-kpi-card">
              <div className="team-kpi-icon-wrap kpi-red">👤</div>
              <div>
                <div className="team-kpi-label">Users' Staff</div>
                <div className="team-kpi-val">{summary.userCreatedMembers || 0}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="team-kpi-card">
              <div className="team-kpi-icon-wrap kpi-red">🔴</div>
              <div>
                <div className="team-kpi-label">Disabled / Inactive</div>
                <div className="team-kpi-val">{summary.inactiveMembers}</div>
              </div>
            </div>

            <div className="team-kpi-card">
              <div className="team-kpi-icon-wrap kpi-purple">🛡️</div>
              <div>
                <div className="team-kpi-label">Delegated Staff</div>
                <div className="team-kpi-val">{summary.staffMembers}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main View: Team Directory */}
      {activeTab === 'members' && (
        <>
          {isSuperAdmin && (
            <div className="team-scope-bar">
              <div className="team-scope-tabs">
                <button
                  type="button"
                  className={`team-scope-tab-btn ${scopeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => { setScopeFilter('all'); setCreatorFilter('all'); }}
                >
                  <span>🌟 All Members</span>
                  <span className="team-scope-count-pill">{summary.totalMembers}</span>
                </button>

                <button
                  type="button"
                  className={`team-scope-tab-btn ${scopeFilter === 'admin' ? 'active' : ''}`}
                  onClick={() => { setScopeFilter('admin'); setCreatorFilter('all'); }}
                >
                  <span>👑 Admin's Staff</span>
                  <span className="team-scope-count-pill">{summary.adminCreatedMembers || 0}</span>
                </button>

                <button
                  type="button"
                  className={`team-scope-tab-btn ${scopeFilter === 'users' ? 'active' : ''}`}
                  onClick={() => { setScopeFilter('users'); setCreatorFilter('all'); }}
                >
                  <span>👥 Users' Staff</span>
                  <span className="team-scope-count-pill">{summary.userCreatedMembers || 0}</span>
                </button>
              </div>

              <div className="team-viewmode-toggle">
                <button
                  type="button"
                  className={`team-viewmode-btn ${displayMode === 'grouped' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('grouped')}
                  title="Display separated by Account Owner / User"
                >
                  <span>🗂️</span> Group User-wise
                </button>
                <button
                  type="button"
                  className={`team-viewmode-btn ${displayMode === 'flat' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('flat')}
                  title="Display standard single table list"
                >
                  <span>📋</span> Flat Table
                </button>
              </div>
            </div>
          )}

          <div className="team-filter-bar">
            <div className="team-search-wrap">
              <span className="team-search-icon"></span>
              <input
                type="text"
                className="team-search-input"
                placeholder={isSuperAdmin ? "Search by name, username, email, creator..." : "Search by name, username, email, phone..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="team-filter-group">
              {isSuperAdmin && creators.length > 1 && (
                <select
                  className="team-select-filter"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                >
                  <option value="all">All Account Owners</option>
                  {creators.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.isAdmin ? `👑 Admin (${c.name})` : `👤 User (${c.name} • @${c.username})`} ({c.count})
                    </option>
                  ))}
                </select>
              )}

              <select
                className="team-select-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
                <option value="Support">Support</option>
                <option value="Staff">Staff</option>
                <option value="Custom">Custom</option>
              </select>

              <select
                className="team-select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Disabled">Disabled Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="team-table-card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <div>Loading team members...</div>
            </div>
          ) : members.length === 0 ? (
            <div className="team-table-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>No team members found</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {search ? 'Try adjusting your search criteria.' : 'No team members matching this filter.'}
              </p>
            </div>
          ) : isSuperAdmin && displayMode === 'grouped' && groupedByCreator.length > 0 ? (
            <div className="team-grouped-container">
              {groupedByCreator.map((group) => (
                <div key={group.creatorId || group.creatorName} className="team-creator-group-card">
                  <div className={`team-creator-group-header ${group.isCreatedByAdmin ? 'team-creator-group-header-admin' : 'team-creator-group-header-user'}`}>
                    <div className="team-creator-title-area">
                      <div className={`team-creator-avatar ${group.isCreatedByAdmin ? 'avatar-admin-bg' : 'avatar-user-bg'}`}>
                        {group.isCreatedByAdmin ? '👑' : '👤'}
                      </div>
                      <div>
                        <div className="team-creator-name">
                          <span>{group.isCreatedByAdmin ? 'Admin Workspace Team' : `Client Account Team: ${group.creatorName}`}</span>
                          <span className={`team-creator-badge ${group.isCreatedByAdmin ? 'badge-admin-creator' : 'badge-user-creator'}`}>
                            {group.isCreatedByAdmin ? `Admin (${group.creatorName})` : `@${group.creatorUsername}`}
                          </span>
                        </div>
                        <div className="team-creator-sub">
                          Organization: <strong>{group.orgName}</strong> • Managed by {group.creatorName} (@{group.creatorUsername})
                        </div>
                      </div>
                    </div>

                    <span className="team-creator-tag-pill">
                      {group.members.length} {group.members.length === 1 ? 'Team Member' : 'Team Members'}
                    </span>
                  </div>

                  <table className="team-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Username & Contact</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Last Activity</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.members.map((m) => renderMemberRow(m, false))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div className="team-table-card">
              <table className="team-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Username & Contact</th>
                    {isSuperAdmin && <th>Account / Created By</th>}
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Last Activity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => renderMemberRow(m, isSuperAdmin))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Audit Trail View */}
      {activeTab === 'audit_logs' && (
        <div className="team-table-card">
          <div className="team-filter-bar" style={{ border: 'none', borderBottom: '1px solid #e2e8f0', borderRadius: 0, margin: 0 }}>
            <div className="team-search-wrap">
              <span className="team-search-icon"></span>
              <input
                type="text"
                className="team-search-input"
                placeholder="Search audit trail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="team-filter-group">
              <select
                className="team-select-filter"
                value={auditModuleFilter}
                onChange={(e) => setAuditModuleFilter(e.target.value)}
              >
                <option value="All">All Modules</option>
                <option value="AUTH">AUTH</option>
                <option value="TEAM">TEAM</option>
                <option value="CAMPAIGNS">CAMPAIGNS</option>
                <option value="CONTACTS">CONTACTS</option>
                <option value="TEMPLATES">TEMPLATES</option>
                <option value="SETTINGS">SETTINGS</option>
              </select>

              <select
                className="team-select-filter"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <option value="All">All Actions</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="FAILED_LOGIN">FAILED_LOGIN</option>
                <option value="TEAM_MEMBER_CREATED">TEAM_MEMBER_CREATED</option>
                <option value="TEAM_MEMBER_UPDATED">TEAM_MEMBER_UPDATED</option>
                <option value="TEAM_MEMBER_DISABLED">TEAM_MEMBER_DISABLED</option>
                <option value="PASSWORD_RESET">PASSWORD_RESET</option>
              </select>
            </div>
          </div>

          {auditLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <div>Loading audit trail...</div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📜</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>No activity records found</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>All authenticated staff and security actions will be recorded here.</p>
            </div>
          ) : (
            <div style={{ padding: '16px 20px' }}>
              <div className="team-audit-list">
                {auditLogs.map((log) => (
                  <div key={log.id} className="team-audit-row">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="team-audit-action-tag">{log.action}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                          {log.module}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          {log.user_name} (@{log.user_username || 'system'})
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        {log.description || 'System operation executed'}
                      </div>
                      {log.ip_address && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                          IP: {log.ip_address} {log.status === 'FAILED' && <span style={{ color: '#ef4444', fontWeight: 700 }}>• FAILED</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.created_at)}
                    </div>
                  </div>
                ))}
              </div>

              {auditTotal > 20 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Showing page {auditPage} of {Math.ceil(auditTotal / 20)} ({auditTotal} total records)
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="team-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className="team-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      disabled={auditPage >= Math.ceil(auditTotal / 20)}
                      onClick={() => setAuditPage(p => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE TEAM MEMBER MODAL */}
      {showCreateModal && (
        <div className="team-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="team-modal-card" onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Create Team Member
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Create credentials and assign granular RBAC capabilities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
              <div className="team-modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}

                <div className="team-form-grid">
                  <div>
                    <label className="team-form-label">Full Name</label>
                    <input
                      type="text"
                      className="team-form-input"
                      placeholder="e.g. John Smith"
                      value={formData.full_name}
                      onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="team-form-label">Username <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="team-form-input"
                      placeholder="e.g. john_marketing"
                      value={formData.username}
                      onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="team-form-grid">
                  <div>
                    <label className="team-form-label">Password <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password"
                      className="team-form-input"
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="team-form-label">Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password"
                      className="team-form-input"
                      placeholder="Re-type password"
                      value={formData.confirm_password}
                      onChange={e => setFormData(p => ({ ...p, confirm_password: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="team-form-grid">
                  <div>
                    <label className="team-form-label">Email (Optional)</label>
                    <input
                      type="email"
                      className="team-form-input"
                      placeholder="e.g. john@company.com"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="team-form-label">Phone / Mobile (Optional)</label>
                    <input
                      type="text"
                      className="team-form-input"
                      placeholder="e.g. +91 9876543210"
                      value={formData.phone}
                      onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="team-form-group">
                  <label className="team-form-label">Role Preset</label>
                  <select
                    className="team-form-select"
                    value={formData.role}
                    onChange={e => handleRoleChange(e.target.value)}
                  >
                    <option value="Admin">Admin (Full administrative & management control)</option>
                    <option value="Marketing">Marketing (Campaigns, Templates, Contacts, Inbox)</option>
                    <option value="Sales">Sales (Contacts, Live Inbox, Reports)</option>
                    <option value="Support">Support (Live Inbox, Contacts, Reports)</option>
                    <option value="Staff">Staff (Standard Staff Member)</option>
                    <option value="Custom">Custom (Manual Granular Permissions Checklist)</option>
                  </select>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <ModuleAccessSelector
                    title="SIDEBAR ACCESS CONTROLS (SELECT ALLOWED MODULES & SUB-FEATURES)"
                    selectedKeys={formData.permissions}
                    allowedScopeKeys={creatorAllowedScopeKeys}
                    onChange={(keys) => setFormData(p => ({ ...p, permissions: keys }))}
                  />
                </div>

              </div>

              <div className="team-modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formError && (
                  <div style={{ width: '100%', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
                    ⚠️ {formError}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
                  <button
                    type="button"
                    className="team-btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSubmit}
                    disabled={submitting}
                    className="team-btn-primary"
                  >
                    {submitting ? 'Creating Member...' : 'Create Team Member'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEAM MEMBER MODAL */}
      {showEditModal && selectedMember && (
        <div className="team-modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="team-modal-card" onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Edit Member: @{selectedMember.username}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Update contact information and fine-tune RBAC permissions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
              <div className="team-modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}

                <div className="team-form-grid">
                  <div>
                    <label className="team-form-label">Full Name</label>
                    <input
                      type="text"
                      className="team-form-input"
                      value={formData.full_name}
                      onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="team-form-label">Role</label>
                    <select
                      className="team-form-select"
                      value={formData.role}
                      disabled={selectedMember.is_owner}
                      onChange={e => handleRoleChange(e.target.value)}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="Support">Support</option>
                      <option value="Staff">Staff</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div className="team-form-grid">
                  <div>
                    <label className="team-form-label">Email</label>
                    <input
                      type="email"
                      className="team-form-input"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="team-form-label">Phone</label>
                    <input
                      type="text"
                      className="team-form-input"
                      value={formData.phone}
                      onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <ModuleAccessSelector
                    title="SIDEBAR ACCESS CONTROLS (SELECT ALLOWED MODULES & SUB-FEATURES)"
                    selectedKeys={formData.permissions}
                    allowedScopeKeys={creatorAllowedScopeKeys}
                    onChange={(keys) => setFormData(p => ({ ...p, permissions: keys }))}
                  />
                </div>

              </div>

              <div className="team-modal-footer">
                <button
                  type="button"
                  className="team-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="team-btn-primary"
                >
                  {submitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER DETAILS MODAL / DRAWER */}
      {showDetailsModal && selectedMember && (
        <div className="team-modal-backdrop" onClick={() => setShowDetailsModal(false)}>
          <div className="team-modal-card" style={{ maxWidth: '820px' }} onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="team-user-avatar" style={{ width: '42px', height: '42px', fontSize: '16px' }}>
                  {(selectedMember.full_name || selectedMember.username).substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{selectedMember.full_name || selectedMember.username}</span>
                    {selectedMember.is_owner && <span className="team-owner-badge">Owner</span>}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    @{selectedMember.username} • {selectedMember.role} • <span style={{ color: selectedMember.status === 'Active' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{selectedMember.status}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="team-modal-body">
              {/* Drawer Tabs */}
              <div className="team-drawer-tabs">
                <button
                  type="button"
                  className={`team-drawer-tab ${detailsTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('overview')}
                >
                  📋 Overview & Profile
                </button>
                <button
                  type="button"
                  className={`team-drawer-tab ${detailsTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('stats')}
                >
                  📊 Real Statistics
                </button>
                <button
                  type="button"
                  className={`team-drawer-tab ${detailsTab === 'permissions' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('permissions')}
                >
                  🛡️ Active Permissions ({selectedMember.permissions?.length || 0})
                </button>
                <button
                  type="button"
                  className={`team-drawer-tab ${detailsTab === 'activity' ? 'active' : ''}`}
                  onClick={() => setDetailsTab('activity')}
                >
                  📜 Activity History ({selectedMemberDetails?.activity?.length || 0})
                </button>
              </div>

              {/* Tab 1: Overview */}
              {detailsTab === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Full Name</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedMember.full_name || 'Not provided'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Username</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>@{selectedMember.username}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Email Address</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedMember.email || 'No email configured'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Phone Number</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedMember.phone || selectedMember.mobile || 'No phone configured'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Account Created</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{formatDateTime(selectedMember.created_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Last Login IP</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{selectedMember.last_login_ip || 'No IP record'}</div>
                    </div>
                  </div>

                  {/* Login Credentials — view current password & update it right here */}
                  <div style={{ marginTop: '16px', background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                      🔐 Login Credentials
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Password</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                          {!selectedMemberDetails
                            ? 'Loading...'
                            : (showPlainPassword
                                ? (selectedMemberDetails?.member?.plain_password || 'Not available')
                                : '••••••••')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="team-btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setShowPlainPassword(s => !s)}
                        disabled={!selectedMemberDetails}
                      >
                        {showPlainPassword ? '🙈 Hide' : '👁️ Show'}
                      </button>
                    </div>

                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Set New Password
                      </div>

                      {inlinePwdError && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>
                          {inlinePwdError}
                        </div>
                      )}

                      <div className="team-form-grid">
                        <input
                          type="password"
                          className="team-form-input"
                          placeholder="New password (min. 6 characters)"
                          value={inlinePwd.new_password}
                          onChange={e => setInlinePwd(p => ({ ...p, new_password: e.target.value }))}
                        />
                        <input
                          type="password"
                          className="team-form-input"
                          placeholder="Confirm new password"
                          value={inlinePwd.confirm_password}
                          onChange={e => setInlinePwd(p => ({ ...p, confirm_password: e.target.value }))}
                        />
                      </div>

                      <button
                        type="button"
                        className="team-btn-primary"
                        style={{ marginTop: '10px' }}
                        disabled={inlinePwdSubmitting}
                        onClick={handleInlinePasswordUpdate}
                      >
                        {inlinePwdSubmitting ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Stats */}
              {detailsTab === 'stats' && (
                <div>
                  <div className="team-stats-mini-grid">
                    <div className="team-stat-mini-box">
                      <div className="team-stat-mini-val">
                        {selectedMemberDetails?.member?.statistics?.campaignsSent ?? 0}
                      </div>
                      <div className="team-stat-mini-lbl">Campaigns Created</div>
                    </div>
                    <div className="team-stat-mini-box">
                      <div className="team-stat-mini-val">
                        {selectedMemberDetails?.member?.statistics?.contactsAdded ?? 0}
                      </div>
                      <div className="team-stat-mini-lbl">Contacts Managed</div>
                    </div>
                    <div className="team-stat-mini-box">
                      <div className="team-stat-mini-val">
                        {selectedMemberDetails?.member?.statistics?.messagesSent ?? 0}
                      </div>
                      <div className="team-stat-mini-lbl">Messages Logged</div>
                    </div>
                    <div className="team-stat-mini-box">
                      <div className="team-stat-mini-val">
                        {selectedMemberDetails?.member?.statistics?.templatesCreated ?? 0}
                      </div>
                      <div className="team-stat-mini-lbl">Official Templates</div>
                    </div>
                  </div>
                  {!selectedMemberDetails && (
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                      Loading statistics...
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Permissions */}
              {detailsTab === 'permissions' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {SIDEBAR_MODULE_CONFIG.map(mod => {
                    const subKeys = mod.subItems.map(s => s.key);
                    const activeCount = subKeys.filter(k => selectedMember.permissions?.includes(k)).length;
                    const isParentActive = selectedMember.permissions?.includes(mod.key) || activeCount > 0;

                    return (
                      <div key={mod.key} style={{
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: isParentActive ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: isParentActive ? '#f0f9ff' : '#f8fafc',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: isParentActive ? '#0369a1' : '#64748b'
                        }}>
                          <span>{isParentActive ? '🟢' : '⚪'} {mod.label}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{activeCount}/{subKeys.length}</span>
                        </div>
                        {mod.subItems.length > 0 && (
                          <div style={{ padding: '6px 12px 8px 24px', display: 'grid', gap: '4px', background: '#fafbfc' }}>
                            {mod.subItems.map(sub => {
                              const isSubActive = selectedMember.permissions?.includes(sub.key);
                              return (
                                <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isSubActive ? '#0f172a' : '#94a3b8', fontWeight: isSubActive ? 600 : 400 }}>
                                  <span>{isSubActive ? '✓' : '—'}</span>
                                  <span>{sub.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 4: Activity History */}
              {detailsTab === 'activity' && (
                <div>
                  {!selectedMemberDetails?.activity || selectedMemberDetails.activity.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                      No recent activity recorded for this member.
                    </div>
                  ) : (
                    <div className="team-audit-list">
                      {selectedMemberDetails.activity.map(act => (
                        <div key={act.id} className="team-audit-row">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span className="team-audit-action-tag">{act.action}</span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {act.description}
                              </span>
                            </div>
                            {act.ip_address && (
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>IP: {act.ip_address}</div>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDateTime(act.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="team-modal-footer">
              <button
                type="button"
                className="team-btn-secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="team-btn-primary"
                onClick={() => {
                  setShowDetailsModal(false);
                  handleOpenEdit(selectedMember);
                }}
              >
                Edit Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL (quick-access, from row's key icon) */}
      {showResetPwdModal && selectedMember && (
        <div className="team-modal-backdrop" onClick={() => setShowResetPwdModal(false)}>
          <div className="team-modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Reset Password: @{selectedMember.username}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Assign a new password. Existing active sessions will be terminated immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPwdModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPwdSubmit} style={{ margin: 0 }}>
              <div className="team-modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}

                <div className="team-form-group">
                  <label className="team-form-label">New Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="password"
                    required
                    className="team-form-input"
                    placeholder="Enter at least 6 characters"
                    value={resetPwdData.new_password}
                    onChange={e => setResetPwdData(p => ({ ...p, new_password: e.target.value }))}
                  />
                </div>

                <div className="team-form-group">
                  <label className="team-form-label">Confirm New Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="password"
                    required
                    className="team-form-input"
                    placeholder="Re-type new password"
                    value={resetPwdData.confirm_password}
                    onChange={e => setResetPwdData(p => ({ ...p, confirm_password: e.target.value }))}
                  />
                </div>
              </div>

              <div className="team-modal-footer">
                <button
                  type="button"
                  className="team-btn-secondary"
                  onClick={() => setShowResetPwdModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="team-btn-primary"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISABLE / ENABLE STATUS CONFIRMATION MODAL */}
      {showStatusModal && selectedMember && (
        <div className="team-modal-backdrop" onClick={() => setShowStatusModal(false)}>
          <div className="team-modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                {selectedMember.status === 'Active' ? 'Disable Member Access?' : 'Enable Member Access?'}
              </h3>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="team-modal-body">
              <p style={{ fontSize: '14px', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                {selectedMember.status === 'Active' ? (
                  <>
                    Are you sure you want to <strong>disable access</strong> for <strong>@{selectedMember.username}</strong> ({selectedMember.full_name || selectedMember.username})?
                    <br /><br />
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      ⚠️ Their active sessions will be revoked in real time, and any ongoing API requests will be rejected immediately.
                    </span>
                  </>
                ) : (
                  <>
                    Are you sure you want to <strong>restore and enable access</strong> for <strong>@{selectedMember.username}</strong>? They will be able to log in and access authorized features again.
                  </>
                )}
              </p>
            </div>

            <div className="team-modal-footer">
              <button
                type="button"
                className="team-btn-secondary"
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className={selectedMember.status === 'Active' ? 'team-btn-danger' : 'team-btn-primary'}
                onClick={handleStatusSubmit}
              >
                {submitting ? 'Updating...' : (selectedMember.status === 'Active' ? 'Disable Access Immediately' : 'Enable Access')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (SOFT DELETE) */}
      {showDeleteModal && selectedMember && (
        <div className="team-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="team-modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#dc2626' }}>
                Delete Team Member?
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="team-modal-body">
              <p style={{ fontSize: '14px', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>@{selectedMember.username}</strong> ({selectedMember.full_name || selectedMember.username})?
                <br /><br />
                <span style={{ color: '#475569', fontSize: '13px' }}>
                  ℹ️ This will soft-delete the user account, permanently block logins, and revoke active sessions while <strong>preserving all historical audit trails and campaign records</strong>.
                </span>
              </p>
            </div>

            <div className="team-modal-footer">
              <button
                type="button"
                className="team-btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className="team-btn-danger"
                onClick={handleDeleteSubmit}
              >
                {submitting ? 'Deleting...' : 'Delete Team Member'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}