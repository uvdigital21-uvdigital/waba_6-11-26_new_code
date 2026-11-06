import React, { useState, useEffect } from 'react';
import api from '../services/api.js';

export default function CreditHistoryModal({ isOpen, onClose, userId, userName }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, userId]);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const url = userId ? `/credits/history` : `/credits/admin/history`;
      const response = await api.get(url);
      if (response.data.success) {
        setHistory(response.data.data || []);
      } else {
        setError(response.data.message || 'Failed to load credit history');
      }
    } catch (err) {
      console.error('Error fetching credit history:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load credit history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="add-tags-modal-overlay">
      <div className="add-tags-modal" style={{ maxWidth: '750px', width: '90%' }}>
        <div className="add-tags-modal-header">
          <h2>Credit Audit Log {userName ? `- ${userName}` : ''}</h2>
          <button type="button" className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="add-tags-modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading credit history...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No credit transaction logs available.</div>
          ) : (
            <table className="tags-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>User</th>
                  <th style={{ textAlign: 'center', padding: '10px' }}>Type</th>
                  <th style={{ textAlign: 'right', padding: '10px' }}>Amount</th>
                  <th style={{ textAlign: 'right', padding: '10px' }}>Balance After</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Description / Admin</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const isPositive = item.amount > 0;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#475569' }}>{formatDate(item.created_at)}</td>
                      <td style={{ padding: '10px', fontWeight: '500', color: '#0f172a' }}>{item.user_name || item.user_email || `User #${item.user_id}`}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: item.type === 'ADMIN_ASSIGN' ? '#dcfce7' : '#f1f5f9',
                          color: item.type === 'ADMIN_ASSIGN' ? '#166534' : '#475569'
                        }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: isPositive ? '#16a34a' : '#dc2626' }}>
                        {isPositive ? `+${item.amount}` : item.amount}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                        {item.balance_after}
                      </td>
                      <td style={{ padding: '10px', color: '#64748b', fontSize: '12px' }}>
                        {item.description || (item.admin_name ? `Assigned by ${item.admin_name}` : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="add-tags-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
