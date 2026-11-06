import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'
import { IconUser } from '../components/icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api.js'
import './Chatbot.css'

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = d.getDate();
        const month = d.toLocaleString('en-US', { month: 'short' });
        const year = d.getFullYear();
        const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
        return `${day} ${month} ${year}, ${time}`;
    } catch (e) {
        return dateStr;
    }
}

export default function Chatbot() {
    const navigate = useNavigate()
    const { setTitle } = useTitle()
    const { isSuperAdmin } = useAuth()

    // Interactive states
    const [flows, setFlows] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [togglingId, setTogglingId] = useState(null)

    const fetchFlows = async () => {
        setIsLoading(true)
        try {
            const res = await api.get('/chatbot/flows')
            setFlows(res.data?.flows || [])
        } catch (err) {
            console.error('Failed to load chatbot flows:', err)
        } finally {
            setIsLoading(false)
        }
    }

    // Total column count changes based on role
    const colSpan = isSuperAdmin ? 9 : 8

    useEffect(() => {
        setTitle('ChatBot')
        fetchFlows()
    }, [setTitle])

    // Toggle Active / Inactive Status
    const handleToggleStatus = async (flow) => {
        if (togglingId) return;
        const nextStatus = flow.status === 'active' ? 'inactive' : 'active'
        setTogglingId(flow.id)

        try {
            const res = await api.patch(`/chatbot/flow/${flow.id}/status`, {
                status: nextStatus,
                isActive: nextStatus === 'active'
            })

            if (res.data && res.data.success) {
                const confirmedStatus = res.data.data?.status || nextStatus
                setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, status: confirmedStatus } : f))
            }
        } catch (err) {
            console.error('Failed to toggle status:', err)
        } finally {
            setTogglingId(null)
        }
    }

    // Handlers
    const handleAddChatbotClick = () => {
        navigate('/chatbot/flow/new')
    }

    const handleDeleteFlow = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete "${name || 'Chatbot Flow'}"?`)) {
            try {
                await api.delete(`/chatbot/flow/${id}`)
                fetchFlows()
            } catch (err) {
                console.error('Failed to delete flow:', err)
                alert('Failed to delete chatbot flow')
            }
        }
    }

    // Filtered flows based on search
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const filteredFlows = flows.filter(f => {
        if (!trimmedQuery) return true;
        const nameMatch = (f.name || '').toLowerCase().includes(trimmedQuery);
        const kwMatch = Array.isArray(f.keywords) && f.keywords.some(k => typeof k === 'string' && k.toLowerCase().includes(trimmedQuery));
        const phoneMatch = (f.wa_display_phone || f.display_phone_number || '').toLowerCase().includes(trimmedQuery);
        const customerMatch = (f.organization_name || '').toLowerCase().includes(trimmedQuery);
        return nameMatch || kwMatch || phoneMatch || customerMatch;
    });

    return (
        <>
            <div className="chatbot-page-container">
                {/* Header (Avatar + Title + Actions) */}
                <div className="chatbot-page-header">
                    <div className="chatbot-header-left">
                        <div className="chatbot-avatar-container">
                            <IconUser />
                        </div>
                        <h1 className="chatbot-page-title">ChatFlow Manager</h1>
                        <div className="chatbot-header-actions">
                            <button className="btn-cb green" onClick={handleAddChatbotClick}>
                                Add ChatBot
                            </button>
                            <button 
                                className="btn-cb" 
                                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', boxShadow: 'none' }} 
                                onClick={fetchFlows} 
                                title="Refresh Flows"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search box row */}
                <div className="chatbot-manager-search-row">
                    <input
                        type="text"
                        placeholder="Search by Keywords, Actiontext, Keyaction, etc ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="chatbot-manager-search-input"
                    />
                </div>

                {/* Main Flow Grid Table matching ChatbotFlow page */}
                <div className="chatbot-table-card">
                    <div className="chatbot-table-wrapper">
                        <table className="chatbot-grid-table">
                            <thead>
                                <tr>
                                    <th>Flow Name</th>
                                    {isSuperAdmin && (
                                        <th style={{ minWidth: '160px' }}>Customer</th>
                                    )}
                                    <th style={{ width: '130px', textAlign: 'center' }}>Status</th>
                                    <th>Keywords</th>
                                    <th>Created On</th>
                                    <th>Updated On</th>
                                    <th style={{ textAlign: 'center' }}>Executions</th>
                                    <th>Last Executed</th>
                                    <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={colSpan} className="no-data-cell">Loading chatbot flows...</td>
                                    </tr>
                                ) : filteredFlows.length === 0 ? (
                                    <tr>
                                        <td colSpan={colSpan} className="no-data-cell">
                                            {searchQuery ? `No chatbot flows matched "${searchQuery}"` : 'No matching records found'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredFlows.map((flow) => (
                                        <tr key={flow.id} className={flow.status === 'inactive' ? 'flow-row-inactive' : ''}>

                                            {/* Flow Name */}
                                            <td className="flow-name-cell">
                                                <span
                                                    className="flow-title-text"
                                                    style={{ cursor: 'pointer', color: '#0f172a' }}
                                                    onClick={() => navigate(`/chatbot/flow/${flow.id}`)}
                                                >
                                                    {flow.name}
                                                </span>
                                            </td>

                                            {/* Customer / Organization — Super Admin only */}
                                            {isSuperAdmin && (
                                                <td className="flow-customer-cell">
                                                    {flow.organization_name ? (
                                                        <>
                                                            <div className="flow-org-name">
                                                                🏢 {flow.organization_name}
                                                            </div>
                                                            {flow.wa_display_phone && (
                                                                <div className="flow-wa-phone-badge">
                                                                    📱 {flow.wa_display_phone}
                                                                </div>
                                                            )}
                                                            {flow.wa_business_name && (
                                                                <div className="flow-wa-biz-name">
                                                                    {flow.wa_business_name}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Status Toggle */}
                                            <td style={{ textAlign: 'center' }}>
                                                <label className="status-toggle-switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={flow.status === 'active'}
                                                        disabled={togglingId === flow.id}
                                                        onChange={() => handleToggleStatus(flow)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                                <div className={`status-pill ${flow.status}`}>
                                                    {flow.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                                                </div>
                                            </td>

                                            {/* Keywords Pills */}
                                            <td>
                                                <div className="keyword-chips-wrap">
                                                    {flow.keywords && flow.keywords.length > 0 ? (
                                                        flow.keywords.map((kw, i) => (
                                                            <span key={i} className="kw-chip">{kw}</span>
                                                        ))
                                                    ) : (
                                                        <span className="no-kw-text">No keywords set</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Created On */}
                                            <td className="date-cell">{formatDate(flow.created_at)}</td>

                                            {/* Updated On */}
                                            <td className="date-cell">{formatDate(flow.updated_at)}</td>

                                            {/* Executions */}
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="execution-count-badge">
                                                    ⚡ {flow.execution_count || 0}
                                                </span>
                                            </td>

                                            {/* Last Executed */}
                                            <td className="date-cell">{formatDate(flow.last_executed_at)}</td>

                                            {/* Actions */}
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="table-actions-group">
                                                    <button
                                                        className="btn-action-flow-edit"
                                                        onClick={() => navigate(`/chatbot/flow/${flow.id}`)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn-action-flow-delete"
                                                        onClick={() => handleDeleteFlow(flow.id, flow.name)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Info */}
                    <div className="chatbot-pagination-row">
                        <div className="info-badge-card">
                            Showing {filteredFlows.length > 0 ? 1 : 0} to {filteredFlows.length} of {filteredFlows.length} entries
                        </div>
                        <div className="pagination-btn-group">
                            <button className="pagination-btn-cb" disabled>Previous</button>
                            <button className="pagination-btn-cb active" disabled={filteredFlows.length === 0}>1</button>
                            <button className="pagination-btn-cb" disabled>Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}