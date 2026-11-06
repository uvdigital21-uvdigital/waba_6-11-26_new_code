import React, { useState, useEffect, useCallback } from 'react';
import { useTitle } from '../context/TitleContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import AssignCreditModal from '../components/AssignCreditModal.jsx';
import CreditHistoryModal from '../components/CreditHistoryModal.jsx';

export default function AssignCredit() {
  const { user } = useAuth();
  const { setTitle } = useTitle();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [selectedUserForAssign, setSelectedUserForAssign] = useState(null);
  const [assignAction, setAssignAction] = useState('ADD'); // 'ADD' or 'DEDUCT'
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState(null);

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';

  useEffect(() => {
    setTitle('Assign Credits');
  }, [setTitle]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/credits/admin/users?search=${encodeURIComponent(search)}`);
      if (response.data.success) {
        setUsers(response.data.users || []);
      } else {
        setError(response.data.message || 'Failed to fetch users list');
      }
    } catch (err) {
      console.error('Error fetching admin users:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAssignSuccess = (message) => {
    setSuccess(message);
    fetchUsers();
    setTimeout(() => setSuccess(''), 4000);
  };

  const openAssignModal = (u, act = 'ADD') => {
    setAssignAction(act);
    setSelectedUserForAssign(u);
  };

  if (!isAdmin) {
    return (
      <div className="dashboard-content">
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '8px' }}>Access Restricted</h2>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px auto' }}>
            Assigning and deducting credits is restricted to Administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <div className="tags-card">
        {/* Header */}
        <div className="tags-header">
          <div className="tags-header-left">
            <div className="tags-header-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h1 className="tags-title">Assign Credits (Feature Breakdown)</h1>
          </div>

          <div className="tags-header-right">
            <button
              type="button"
              className="tags-btn-add"
              style={{ background: '#0284c7' }}
              onClick={() => {
                setSelectedUserForHistory(null);
                setShowHistoryModal(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: '6px' }}>
                <polyline points="12 8 12 12 14 14" />
                <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
              </svg>
              Global Audit History
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {/* Search Bar */}
        <div className="tags-controls" style={{ marginBottom: '20px' }}>
          <div className="tags-controls-left" style={{ width: '100%', maxWidth: '400px' }}>
            
              <input
                type="text"
                placeholder="   Search user by name, email or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                style={{ position: 'absolute', left: '10px', top: '10px' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            
          </div>
        </div>

        {/* Table */}
        <div className="tags-table-container">
          <table className="tags-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '16px' }}>User Name</th>
                <th>Email</th>
                <th style={{ textAlign: 'center' }}>Quick</th>
                <th style={{ textAlign: 'center' }}>CSV</th>
                <th style={{ textAlign: 'center' }}>Tags</th>
                <th style={{ textAlign: 'center' }}>Group</th>
                <th style={{ textAlign: 'center' }}>Birthday</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th className="tags-th-action" style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="tags-no-data">Loading user feature balances...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="9" className="tags-no-data">No users found matching search criteria.</td>
                </tr>
              ) : (
                users.map((u) => {
                  const feats = u.features || {};
                  return (
                    <tr key={u.id} className="tags-row">
                      <td className="tags-td-name" style={{ paddingLeft: '16px', fontWeight: '600', color: '#0f172a' }}>
                        {u.name}
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '400' }}>
                          @{u.username || 'user'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#475569' }}>{u.email}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: (feats.quick || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                        {feats.quick || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: (feats.csv || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                        {feats.csv || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: (feats.tags || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                        {feats.tags || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: (feats.group || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                        {feats.group || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: (feats.birthday || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                        {feats.birthday || 0}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '14px', color: u.credits > 0 ? '#2563eb' : '#dc2626' }}>
                        {u.credits.toLocaleString()}
                      </td>
                      <td className="tags-td-action">
                        <div className="tags-action-btns" style={{ justifyContent: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="tags-btn-act"
                            style={{ backgroundColor: '#2563eb', color: '#ffffff', fontWeight: '600', padding: '5px 10px', fontSize: '11px' }}
                            onClick={() => openAssignModal(u, 'ADD')}
                            title="Add / Assign Credits"
                          >
                            + ASSIGN
                          </button>
                          <button
                            type="button"
                            className="tags-btn-act"
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: '600', padding: '5px 10px', fontSize: '11px' }}
                            onClick={() => openAssignModal(u, 'DEDUCT')}
                            title="Deduct / Delete Credits"
                          >
                            - DEDUCT
                          </button>
                          <button
                            type="button"
                            className="tags-btn-act"
                            style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '500', padding: '5px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setSelectedUserForHistory(u);
                              setShowHistoryModal(true);
                            }}
                          >
                            HISTORY
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign / Deduct Modal */}
      <AssignCreditModal
        isOpen={Boolean(selectedUserForAssign)}
        onClose={() => setSelectedUserForAssign(null)}
        user={selectedUserForAssign}
        initialAction={assignAction}
        onSuccess={handleAssignSuccess}
      />

      {/* History Modal */}
      <CreditHistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedUserForHistory(null);
        }}
        userId={selectedUserForHistory?.id}
        userName={selectedUserForHistory?.name}
      />
    </div>
  );
}
