import React, { useState, useMemo } from 'react';
import { SIDEBAR_MODULE_CONFIG } from '../config/modules.js';

/**
 * Reusable Nested Access Control Selector with sub-item granularity.
 * Responsive, clean layout that fits smoothly in all screen sizes without overflowing.
 */
export default function ModuleAccessSelector({
  selectedKeys: rawSelectedKeys = [],
  selectedModules = null,
  onChange,
  showAdminModules = false,
  allowedScopeKeys = null,
  title = "Sidebar Access Controls (Select Allowed Modules & Sub-Features)"
}) {
  const selectedKeys = (selectedModules !== null ? selectedModules : rawSelectedKeys) || [];

  const [expandedModules, setExpandedModules] = useState(() => {
    const init = {};
    SIDEBAR_MODULE_CONFIG.forEach(m => {
      init[m.key] = true;
    });
    return init;
  });

  const availableModules = useMemo(() => {
    return SIDEBAR_MODULE_CONFIG
      .filter(m => showAdminModules || !m.adminOnly)
      .map(m => {
        if (allowedScopeKeys && Array.isArray(allowedScopeKeys)) {
          const isParentAllowed = allowedScopeKeys.includes(m.key);
          const hasSpecificSubKeys = allowedScopeKeys.some(k => k.startsWith(`${m.key}:`));

          const filteredSubs = m.subItems.filter(s => {
            if (allowedScopeKeys.includes(s.key)) return true;
            if (isParentAllowed && !hasSpecificSubKeys) return true;
            return false;
          });

          if (!isParentAllowed && filteredSubs.length === 0) {
            return null; // Omit module completely if user has no access to it
          }

          return {
            ...m,
            subItems: filteredSubs
          };
        }
        return m;
      })
      .filter(Boolean);
  }, [showAdminModules, allowedScopeKeys]);

  const toggleExpand = (modKey) => {
    setExpandedModules(prev => ({
      ...prev,
      [modKey]: !prev[modKey]
    }));
  };

  const handleParentToggle = (mod) => {
    const subKeys = mod.subItems.map(s => s.key);
    const allModuleKeys = [mod.key, ...subKeys];
    const isAllChecked = allModuleKeys.every(k => selectedKeys.includes(k));

    let newKeys;
    if (isAllChecked) {
      newKeys = selectedKeys.filter(k => !allModuleKeys.includes(k));
    } else {
      const toAdd = allModuleKeys.filter(k => !selectedKeys.includes(k));
      newKeys = [...selectedKeys, ...toAdd];
    }
    onChange?.(newKeys);
  };

  const handleSubItemToggle = (mod, sub) => {
    const isSubChecked = selectedKeys.includes(sub.key);
    let newKeys;

    if (isSubChecked) {
      newKeys = selectedKeys.filter(k => k !== sub.key);
      const remainingSubs = mod.subItems.filter(s => s.key !== sub.key && newKeys.includes(s.key));
      if (remainingSubs.length === 0) {
        newKeys = newKeys.filter(k => k !== mod.key);
      }
    } else {
      newKeys = [...selectedKeys, sub.key];
      if (!newKeys.includes(mod.key)) {
        newKeys.push(mod.key);
      }
    }
    onChange?.(newKeys);
  };

  const handleSelectAll = () => {
    const allKeys = availableModules.flatMap(m => [m.key, ...m.subItems.map(s => s.key)]);
    onChange?.(allKeys);
  };

  const handleClearAll = () => {
    onChange?.([]);
  };

  return (
    <div style={{
      background: '#f8fafc',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      marginBottom: '16px'
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
            {title}
          </label>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Select main sections and specific sub-features for this user.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleSelectAll}
            style={{
              fontSize: '12px',
              background: '#e0f2fe',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              padding: '3px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              transition: 'all 0.15s ease'
            }}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            style={{
              fontSize: '12px',
              background: '#ffffff',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              padding: '3px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Responsive Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '10px'
      }}>
        {availableModules.map((mod) => {
          const subKeys = mod.subItems.map(s => s.key);
          const checkedSubsCount = subKeys.filter(k => selectedKeys.includes(k)).length;
          const isFullyChecked = selectedKeys.includes(mod.key) && (subKeys.length === 0 || checkedSubsCount === subKeys.length);
          const isPartiallyChecked = checkedSubsCount > 0 && !isFullyChecked;
          const isExpanded = expandedModules[mod.key] !== false;

          return (
            <div
              key={mod.key}
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                border: isFullyChecked ? '1px solid #93c5fd' : (isPartiallyChecked ? '1px solid #fed7aa' : '1px solid #e2e8f0'),
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Parent Module Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isFullyChecked ? '#f0f9ff' : (isPartiallyChecked ? '#fffbeb' : '#ffffff'),
                  borderBottom: mod.subItems.length > 0 && isExpanded ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isFullyChecked ? '#0369a1' : (isPartiallyChecked ? '#b45309' : '#1e293b'),
                    flex: 1,
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isFullyChecked}
                    ref={el => {
                      if (el) el.indeterminate = isPartiallyChecked;
                    }}
                    onChange={() => handleParentToggle(mod)}
                    style={{ width: '15px', height: '15px', accentColor: '#0284c7', cursor: 'pointer' }}
                  />
                  <span>{mod.label}</span>
                </label>

                {mod.subItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(mod.key)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px 4px',
                      color: '#64748b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                      {checkedSubsCount}/{mod.subItems.length}
                    </span>
                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', display: 'inline-block', fontSize: '10px' }}>
                      ▼
                    </span>
                  </button>
                )}
              </div>

              {/* Sub-Items List */}
              {mod.subItems.length > 0 && isExpanded && (
                <div style={{ padding: '6px 12px 8px 28px', display: 'grid', gap: '4px', background: '#fafbfc' }}>
                  {mod.subItems.map(sub => {
                    const isSubChecked = selectedKeys.includes(sub.key);
                    return (
                      <label
                        key={sub.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          fontSize: '12px',
                          color: isSubChecked ? '#0f172a' : '#64748b',
                          cursor: 'pointer',
                          fontWeight: isSubChecked ? 500 : 400,
                          userSelect: 'none',
                          padding: '2px 0'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSubChecked}
                          onChange={() => handleSubItemToggle(mod, sub)}
                          style={{ width: '13px', height: '13px', accentColor: '#0284c7', cursor: 'pointer' }}
                        />
                        <span>{sub.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
