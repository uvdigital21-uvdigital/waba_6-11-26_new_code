import React, { useState, useEffect } from 'react';
import api from '../services/api.js';

export default function AssignCreditModal({ isOpen, onClose, user, initialAction = 'ADD', onSuccess }) {
  const [action, setAction] = useState('ADD'); // 'ADD' or 'DEDUCT'
  const [featureKey, setFeatureKey] = useState('general');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAction(initialAction || 'ADD');
      setFeatureKey('general');
      setAmount('');
      setDescription('');
      setError('');
    }
  }, [isOpen, initialAction]);

  if (!isOpen || !user) return null;

  const currentFeatBalance = user.features ? (user.features[featureKey] || 0) : user.credits || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive number for credits.');
      return;
    }

    if (action === 'DEDUCT' && numericAmount > currentFeatBalance) {
      setError(`Cannot deduct ${numericAmount} credits. User only has ${currentFeatBalance} credits for this category.`);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/credits/admin/assign', {
        userId: user.id,
        featureKey,
        action,
        amount: numericAmount,
        description: description.trim() || `Admin ${action === 'ADD' ? 'Assigned' : 'Deducted'} ${numericAmount} credits for ${featureKey}`
      });

      if (response.data.success) {
        onSuccess(response.data.message || `Operation successful!`);
        onClose();
      } else {
        setError(response.data.message || 'Failed to update credits');
      }
    } catch (err) {
      console.error('Error updating credits:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update credits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-tags-modal-overlay">
      <div className="add-tags-modal" style={{ maxWidth: '480px' }}>
        <div className="add-tags-modal-header" style={{ backgroundColor: action === 'DEDUCT' ? '#fef2f2' : '#f8fafc' }}>
          <h2 style={{ color: action === 'DEDUCT' ? '#dc2626' : '#0f172a' }}>
            {action === 'ADD' ? '➕ Assign / Add Credits' : '➖ Deduct / Delete Credits'}
          </h2>
          <button type="button" className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="add-tags-modal-body" style={{ gap: '16px' }}>
            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {/* Recipient info & balances */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>RECIPIENT USER</div>
              <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '600', marginTop: '2px' }}>
                {user.name || user.username || 'User'}
              </div>
              <div style={{ fontSize: '13px', color: '#475569' }}>{user.email}</div>
              
              <div style={{ marginTop: '10px', fontSize: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Selected Category Balance:</span>
                <span style={{ fontWeight: '700', color: action === 'DEDUCT' ? '#dc2626' : '#2563eb', fontSize: '14px' }}>
                  {currentFeatBalance.toLocaleString()} Credits
                </span>
              </div>
            </div>

            {/* Action Selector */}
            <div className="add-tags-field">
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Action Type</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: action === 'ADD' ? '#16a34a' : '#64748b' }}>
                  <input
                    type="radio"
                    name="creditAction"
                    value="ADD"
                    checked={action === 'ADD'}
                    onChange={() => setAction('ADD')}
                  />
                  ➕ Add Credits
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: action === 'DEDUCT' ? '#dc2626' : '#64748b' }}>
                  <input
                    type="radio"
                    name="creditAction"
                    value="DEDUCT"
                    checked={action === 'DEDUCT'}
                    onChange={() => setAction('DEDUCT')}
                  />
                  ➖ Deduct / Delete Credits
                </label>
              </div>
            </div>

            {/* Feature Category Selector */}
            <div className="add-tags-field">
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Feature / Campaign Category</label>
              <select
                value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
                className="add-tags-input"
                style={{ padding: '8px 12px' }}
              >
                <option value="general">General / Shared Credits</option>
                <option value="quick">Send Quick Campaign</option>
                <option value="csv">Send CSV Campaign</option>
                <option value="tags">Send By Tags</option>
                <option value="group">Send By Group</option>
                <option value="birthday">Send Birthday Campaign</option>
              </select>
            </div>

            {/* Credit Amount */}
            <div className="add-tags-field">
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                Credits to {action === 'ADD' ? 'Add' : 'Deduct'} <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder={action === 'ADD' ? 'e.g. 500' : 'e.g. 100'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="add-tags-input"
                required
                autoFocus
              />
            </div>

            {/* Description / Note */}
            <div className="add-tags-field">
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Note / Reason (Optional)</label>
              <input
                type="text"
                placeholder={action === 'ADD' ? 'e.g. Monthly Top-up' : 'e.g. Correction / Adjustment'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="add-tags-input"
              />
            </div>
          </div>

          <div className="add-tags-modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save-tags"
              disabled={loading}
              style={{ background: action === 'DEDUCT' ? '#dc2626' : '#2563eb' }}
            >
              {loading ? 'Processing...' : (action === 'ADD' ? 'Add Credits' : 'Deduct Credits')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
