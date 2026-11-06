import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';
import ModuleAccessSelector from './ModuleAccessSelector.jsx';
import { DEFAULT_ALLOWED_MODULES } from '../config/modules.js';

export default function AssignOptionsModal({ isOpen, onClose, account, onSave }) {
  const [selectedModules, setSelectedModules] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (account && account.allowed_modules) {
      setSelectedModules(Array.isArray(account.allowed_modules) ? account.allowed_modules : []);
    } else {
      setSelectedModules([...DEFAULT_ALLOWED_MODULES]);
    }
    setError('');
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const res = await fetch(`${API_BASE_URL}/whatsapp/${account.id}/assigned-modules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ allowed_modules: selectedModules })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update assigned sidebar options');
      }

      if (onSave) {
        await onSave({ ...account, allowed_modules: selectedModules });
      }

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '620px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Assign Sidebar Access Options
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Dashboard: <strong>{account.name || account.verified_name || 'WhatsApp Account'}</strong> ({account.wa_number || account.display_phone_number})
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <ModuleAccessSelector
            selectedKeys={selectedModules}
            onChange={setSelectedModules}
            title="Allowed Sidebar Modules & Sub-Features for this Dashboard"
          />

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: '500' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#ffffff', cursor: 'pointer', fontWeight: '600', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)' }}
            >
              {submitting ? 'Saving Options...' : 'Save Assigned Options'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
