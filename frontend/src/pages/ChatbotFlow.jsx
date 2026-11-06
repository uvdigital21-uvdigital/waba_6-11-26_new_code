import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'
import api from '../services/api.js'
import './Chatbot.css'

export default function ChatbotFlow() {
    const navigate = useNavigate()
    const { setTitle } = useTitle()
    
    // State definitions
    const [flows, setFlows] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [toastMessage, setToastMessage] = useState(null)
    const [showEntries, setShowEntries] = useState(10)

    // Add Flow Modal State
    const [showAddFlowModal, setShowAddFlowModal] = useState(false)
    const [newFlowName, setNewFlowName] = useState('')
    const [flowNameError, setFlowNameError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Delete Modal State
    const [deleteModalState, setDeleteModalState] = useState({ open: false, flow: null })

    useEffect(() => {
        setTitle('ChatBot Flow')
        fetchFlows()
    }, [setTitle])

    const showToast = (msg, type = 'success') => {
        setToastMessage({ text: msg, type })
        setTimeout(() => setToastMessage(null), 3500)
    }

    const fetchFlows = async () => {
        setIsLoading(true)
        try {
            const res = await api.get('/chatbot/flows')
            setFlows(res.data.flows || [])
        } catch (err) {
            console.error('Failed to load chatbot flows:', err)
            showToast('Failed to load chatbot flows', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // Toggle Active / Inactive Status
    const [togglingId, setTogglingId] = useState(null)

    const handleToggleStatus = async (flow) => {
        if (togglingId) return; // Prevent multiple clicks while toggling

        const nextStatus = flow.status === 'active' ? 'inactive' : 'active'
        const nextIsActive = nextStatus === 'active'
        setTogglingId(flow.id)
        
        console.log(`[FRONTEND_TOGGLE] Sending PATCH /api/chatbot/flow/${flow.id}/status`, { status: nextStatus, isActive: nextIsActive })

        try {
            const res = await api.patch(`/chatbot/flow/${flow.id}/status`, {
                status: nextStatus,
                isActive: nextIsActive
            })

            console.log('[FRONTEND_TOGGLE] API Response:', res.data)

            if (res.data && res.data.success) {
                const confirmedStatus = res.data.data?.status || nextStatus
                setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, status: confirmedStatus } : f))
                showToast(res.data.message || 'Flow status updated successfully', 'success')
            } else {
                showToast(res.data?.message || 'Failed to update flow status', 'error')
            }
        } catch (err) {
            console.error('[FRONTEND_TOGGLE] API Error:', err.response?.data || err.message)
            showToast(err.response?.data?.message || 'Failed to update flow status', 'error')
        } finally {
            setTogglingId(null)
        }
    }

    // Create New Flow Handler
    const handleCreateFlowSubmit = async (e) => {
        e.preventDefault()
        const trimmed = newFlowName.trim()

        if (!trimmed) {
            setFlowNameError('Flow name is required')
            return
        }
        if (trimmed.length < 3) {
            setFlowNameError('Flow name must be at least 3 characters long')
            return
        }
        if (trimmed.length > 100) {
            setFlowNameError('Flow name must not exceed 100 characters')
            return
        }

        setIsSubmitting(true)
        setFlowNameError('')

        try {
            const res = await api.post('/chatbot/flow', {
                name: trimmed,
                status: 'active',
                keywords: ['hello', 'hi', 'start']
            })

            if (res.data.success) {
                showToast(`Flow "${trimmed}" created successfully!`)
                setShowAddFlowModal(false)
                setNewFlowName('')
                // Navigate directly to builder for newly created flow
                navigate(`/chatbot/flow/${res.data.flowId}`)
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to create flow'
            setFlowNameError(errorMsg)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Confirm Delete Handler
    const confirmDeleteFlow = (flow) => {
        setDeleteModalState({ open: true, flow })
    }

    const executeDeleteFlow = async () => {
        const target = deleteModalState.flow
        if (!target) return

        try {
            await api.delete(`/chatbot/flow/${target.id}`)
            setFlows(prev => prev.filter(f => f.id !== target.id))
            showToast(`Flow "${target.name}" deleted successfully.`)
            setDeleteModalState({ open: false, flow: null })
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete flow', 'error')
        }
    }

    // Filter & Sort Flows (Newest first)
    const filteredFlows = useMemo(() => {
        const q = searchQuery.toLowerCase().trim()
        let result = flows

        if (q) {
            result = result.filter(f => {
                const nameMatch = (f.name || '').toLowerCase().includes(q)
                const keywordMatch = (f.keywords || []).some(k => k.toLowerCase().includes(q))
                return nameMatch || keywordMatch
            })
        }

        // Newest updated first
        return result.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    }, [flows, searchQuery])

    const formatDate = (dateStr) => {
        if (!dateStr) return '—'
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return '—'
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    }

    return (
        <div className="chatbot-page-container">

            {/* Toast Notification Banner */}
            {toastMessage && (
                <div className={`chatbot-toast-banner ${toastMessage.type}`}>
                    <span>{toastMessage.text}</span>
                    <button className="toast-close" onClick={() => setToastMessage(null)}>×</button>
                </div>
            )}

            {/* Header Bar */}
            <div className="chatbot-page-header">
                <div className="chatbot-header-left">
                    <h1 className="chatbot-page-title">ChatBot Flow Management</h1>
                    <div className="chatbot-header-actions">
                        <button className="btn-cb green" onClick={() => { setNewFlowName(''); setFlowNameError(''); setShowAddFlowModal(true); }}>
                            + Create New Flow
                        </button>
                    </div>
                </div>

                <div className="chatbot-header-search">
                    <input
                        type="text"
                        placeholder="Search by flow name or keyword (e.g. hello, support)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input-box-wide"
                    />
                </div>
            </div>

            {/* Controls Bar */}
            <div className="chatbot-controls-bar">
                <div className="entries-selection">
                    <span>Show</span>
                    <select
                        value={showEntries}
                        onChange={(e) => setShowEntries(Number(e.target.value))}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                    <span>entries</span>
                </div>

                <div className="total-flows-badge">
                    Total Active Flows: <strong>{flows.filter(f => f.status === 'active').length}</strong> / {flows.length}
                </div>
            </div>

            {/* Main Flow Grid Table */}
            <div className="chatbot-table-card">
                <div className="chatbot-table-wrapper">
                    <table className="chatbot-grid-table">
                        <thead>
                            <tr>
                                <th>Flow Name</th>
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
                                    <td colSpan="8" className="no-data-cell">Loading chatbot flows...</td>
                                </tr>
                            ) : filteredFlows.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="no-data-cell">
                                        {searchQuery ? `No chatbot flows matched "${searchQuery}"` : 'No chatbot flows found. Click "+ Create New Flow" to get started.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredFlows.slice(0, showEntries).map((flow) => (
                                    <tr key={flow.id} className={flow.status === 'inactive' ? 'flow-row-inactive' : ''}>
                                        
                                        {/* Flow Name */}
                                        <td className="flow-name-cell">
                                            <span className="flow-title-text">{flow.name}</span>
                                            {flow.priority && flow.priority > 1 && (
                                                <span className="priority-badge">Priority #{flow.priority}</span>
                                            )}
                                        </td>

                                        {/* Active / Inactive Toggle Switch */}
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

                                        {/* Keyword Chips */}
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

                                        {/* Total Executions Count */}
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
                                                    onClick={() => confirmDeleteFlow(flow)}
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
            </div>

            {/* Create Flow Modal */}
            {showAddFlowModal && (
                <div className="modal-overlay-cb">
                    <div className="modal-card-cb">
                        <div className="modal-header-cb">
                            <h2>Create New Chatbot Flow</h2>
                            <button className="modal-close-btn-cb" onClick={() => setShowAddFlowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateFlowSubmit}>
                            <div className="modal-body-cb">
                                <div className="form-group-cb">
                                    <label>Flow Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input
                                        type="text"
                                        className={`modal-input-text ${flowNameError ? 'input-error' : ''}`}
                                        value={newFlowName}
                                        onChange={(e) => { setNewFlowName(e.target.value); setFlowNameError(''); }}
                                        placeholder="e.g. Welcome Flow, Support Flow, Sales Bot"
                                        maxLength={100}
                                        autoFocus
                                    />
                                    {flowNameError && (
                                        <div className="field-error-text">{flowNameError}</div>
                                    )}
                                    <div className="field-hint-text">
                                        Enter a unique, descriptive flow name (3 to 100 characters).
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-cb">
                                <button type="submit" className="btn-modal-cb save" disabled={isSubmitting}>
                                    {isSubmitting ? 'Creating...' : 'Create & Open Flow Builder'}
                                </button>
                                <button type="button" className="btn-modal-cb discard" onClick={() => setShowAddFlowModal(false)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Flow Modal */}
            {deleteModalState.open && deleteModalState.flow && (
                <div className="modal-overlay-cb">
                    <div className="modal-card-cb">
                        <div className="modal-header-cb">
                            <h2 style={{ color: '#dc2626' }}>Confirm Delete Flow</h2>
                            <button className="modal-close-btn-cb" onClick={() => setDeleteModalState({ open: false, flow: null })}>×</button>
                        </div>
                        <div className="modal-body-cb">
                            {deleteModalState.flow.status === 'active' ? (
                                <div className="warning-callout-box">
                                    ⚠️ <strong>This flow is currently active.</strong>
                                    <p style={{ marginTop: '8px', marginBottom: 0 }}>Are you sure you want to delete <strong>"{deleteModalState.flow.name}"</strong>?</p>
                                </div>
                            ) : (
                                <p>Are you sure you want to delete <strong>"{deleteModalState.flow.name}"</strong>?</p>
                            )}
                        </div>
                        <div className="modal-footer-cb">
                            <button className="btn-modal-cb danger" onClick={executeDeleteFlow}>
                                Yes, Delete Flow
                            </button>
                            <button className="btn-modal-cb discard" onClick={() => setDeleteModalState({ open: false, flow: null })}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
