import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTitle } from '../context/TitleContext.jsx';
import { API_BASE_URL } from '../config.js';

export default function RolePermissions() {
  const { isSuperAdmin } = useAuth();
  const { setTitle } = useTitle();

  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleMatrix, setRoleMatrix] = useState({});
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setTitle('Role Permissions Matrix');
  }, [setTitle]);

  const fetchPermissionsData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const res = await fetch(`${API_BASE_URL}/permissions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch permissions');

      setPermissions(data.permissions || []);
      setRoles(data.roles || []);
      setRoleMatrix(data.roleMatrix || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissionsData();
  }, [fetchPermissionsData]);

  const handleTogglePermission = (permId) => {
    if (!isSuperAdmin) return;
    setRoleMatrix(prev => {
      const currentList = prev[selectedRole] || [];
      const exists = currentList.includes(permId);
      const updatedList = exists
        ? currentList.filter(id => id !== permId)
        : [...currentList, permId];

      return {
        ...prev,
        [selectedRole]: updatedList
      };
    });
  };

  const handleSavePermissions = async () => {
    if (!isSuperAdmin) {
      setError('Only Super Admin can edit permissions.');
      return;
    }

    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const permIds = roleMatrix[selectedRole] || [];

      const res = await fetch(`${API_BASE_URL}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          role_name: selectedRole,
          permission_ids: permIds
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update permissions');

      setSuccess(`Permissions for role "${selectedRole}" updated successfully!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-content" style={{ padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
              Role Based Access Control (RBAC)
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
              Configure feature access permissions for each user role in the SaaS system. Only Super Admin can modify permissions.
            </p>
          </div>

          {isSuperAdmin && (
            <button
              onClick={handleSavePermissions}
              disabled={saving}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
              }}
            >
              {saving ? 'Saving...' : 'Save Matrix Permissions'}
            </button>
          )}
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}

        {/* Role Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.name)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: selectedRole === r.name ? '#0284c7' : '#f1f5f9',
                color: selectedRole === r.name ? '#ffffff' : '#475569',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Permission Checkbox Matrix Grid */}
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading permissions matrix...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {permissions.map((p) => {
              const isChecked = (roleMatrix[selectedRole] || []).includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => handleTogglePermission(p.id)}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: isChecked ? '1px solid #38bdf8' : '1px solid #e2e8f0',
                    background: isChecked ? '#f0f9ff' : '#fafafa',
                    cursor: isSuperAdmin ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Module: {p.module} ({p.slug})</div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    readOnly
                    disabled={!isSuperAdmin}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
