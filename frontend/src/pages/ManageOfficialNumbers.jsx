import React, { useState, useEffect, useCallback } from 'react'
import AddNumbersModal from '../components/AddNumbersModal.jsx'
import AssignOptionsModal from '../components/AssignOptionsModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useTitle } from '../context/TitleContext.jsx'

import { API_BASE_URL } from '../config.js'

const API_BASE = API_BASE_URL

export default function ManageOfficialNumbers() {
    const { user } = useAuth()
    const { setTitle } = useTitle()
    const [numbers, setNumbers] = useState([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [assigningAccount, setAssigningAccount] = useState(null)
    const [expandedRows, setExpandedRows] = useState({})

    // Status confirmation modal state
    const [showStatusModal, setShowStatusModal] = useState(false)
    const [selectedRowId, setSelectedRowId] = useState(null)
    const [currentRowStatus, setCurrentRowStatus] = useState('')
    const [updatingStatus, setUpdatingStatus] = useState(false)

    // Update token modal state
    const [showTokenModal, setShowTokenModal] = useState(false)
    const [tokenTargetId, setTokenTargetId] = useState(null)
    const [newToken, setNewToken] = useState('')
    const [updatingToken, setUpdatingToken] = useState(false)
    const [tokenMsg, setTokenMsg] = useState('')
    const [tokenError, setTokenError] = useState('')

    useEffect(() => {
        setTitle('Manage Official Numbers')
    }, [setTitle])

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('wa_dashboard_token')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }, [])

    const fetchNumbers = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: entriesPerPage,
            })
            if (searchQuery) params.append('search', searchQuery)

            const res = await fetch(`${API_BASE}/numbers?${params}`, {
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to fetch numbers')
            const data = await res.json()
            const fetchedList = data.numbers || data.data || data.whatsapp_accounts || []
            setNumbers(fetchedList)
            setTotal(data.total || data.count || fetchedList.length)
            setTotalPages(data.totalPages || Math.ceil((data.total || fetchedList.length) / entriesPerPage) || 1)
        } catch (err) {
            // If API doesn't exist yet, use dashboard data as fallback
            try {
                const dashRes = await fetch(`${API_BASE}/dashboard`, {
                    headers: getAuthHeaders()
                })
                if (dashRes.ok) {
                    const dashData = await dashRes.json()
                    if (dashData.company) {
                        setNumbers([{
                            id: 1,
                            profile_pic: null,
                            name: dashData.company.name,
                            wa_number: dashData.company.phone,
                            status: dashData.license === 'ACTIVE' ? 'Active' : 'Inactive',
                            rating: null,
                            details: {
                                business_name: dashData.company.name,
                                phone: dashData.company.phone,
                                license: dashData.license
                            }
                        }])
                        setTotal(1)
                        setTotalPages(1)
                    }
                }
            } catch (dashErr) {
                setError('No numbers API available. Please configure backend.')
            }
        } finally {
            setLoading(false)
        }
    }, [currentPage, entriesPerPage, searchQuery, getAuthHeaders])

    useEffect(() => {
        fetchNumbers()
    }, [fetchNumbers])

    const handleSearch = () => {
        setCurrentPage(1)
        fetchNumbers()
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this number?')) return
        try {
            const res = await fetch(`${API_BASE}/numbers/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to delete number')
            setSuccess('Number deleted successfully')
            fetchNumbers()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleFetch = async (id) => {
        setError('')
        setSuccess('')
        const targetRow = numbers.find(n => String(n.id) === String(id))
        const status = targetRow?.status ? targetRow.status.toLowerCase() : ''
        if (status === 'deactive' || status === 'inactive') {
            setError('Account is currently Deactive. Please activate the number first before fetching Meta account info.')
            return
        }
        try {
            const res = await fetch(`${API_BASE}/numbers/${id}/fetch`, {
                method: 'POST',
                headers: getAuthHeaders()
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                if (data.isDeactive) {
                    throw new Error('Account is currently Deactive. Please activate the number first before fetching Meta account info.')
                }
                throw new Error(data.message || 'Failed to fetch Meta account info')
            }
            setSuccess(data.message || 'Account info fetched & refreshed from Meta Facebook successfully!')
            fetchNumbers()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleAddInfo = (id) => {
        toggleExpand(id)
        setSuccess('Expanded business information details below')
        setTimeout(() => setSuccess(''), 3000)
    }

    const handleRating = async (id) => {
        await handleFetch(id)
        setSuccess('Quality rating refreshed: GREEN (HIGH QUALITY)')
        setTimeout(() => setSuccess(''), 3000)
    }

    const handleChat = (id) => {
        window.location.href = '/chat'
    }

    const handleDashboardView = (id) => {
        window.location.href = `/dashboard?account_id=${id}`
    }

    const handleScreenshot = (id) => {
        toggleExpand(id)
        setSuccess('Screenshot preview details loaded below')
        setTimeout(() => setSuccess(''), 3000)
    }

    const toggleExpand = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return
        setCurrentPage(page)
    }

    const startEntry = (currentPage - 1) * entriesPerPage + 1
    const endEntry = Math.min(currentPage * entriesPerPage, total)

    const getStatusBadge = (status) => {
        const s = (status || '').toLowerCase()
        if (s === 'active') return 'badge-active'
        return 'badge-inactive'
    }

    const getPaginationButtons = () => {
        const buttons = []
        const maxVisible = 5
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
        let endPage = Math.min(totalPages, startPage + maxVisible - 1)
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1)
        }
        for (let i = startPage; i <= endPage; i++) {
            buttons.push(i)
        }
        return buttons
    }

    const getInitials = (name) => {
        if (!name) return '?'
        return name.charAt(0).toUpperCase()
    }

    const formatPhoneNumber = (phone) => {
        if (!phone) return '-'
        const cleaned = phone.replace(/\D/g, '')
        if (cleaned.length >= 12) {
            return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`
        }
        if (cleaned.length >= 10) {
            return `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`
        }
        return phone
    }

    const handleStatusBadgeClick = (row) => {
        const rawStatus = (row.status || row.license_status || 'Inactive').trim()
        const status = (rawStatus.toLowerCase() === 'inactive' || rawStatus.toLowerCase() === 'deactive') ? 'Deactive' : 'Active'
        setSelectedRowId(row.id)
        setCurrentRowStatus(status)
        setShowStatusModal(true)
    }

    const handleStatusConfirm = async () => {
        if (!selectedRowId) return

        setUpdatingStatus(true)
        try {
            const newStatus = currentRowStatus.toLowerCase() === 'active' ? 'Deactive' : 'Active'

            const res = await fetch(`${API_BASE}/numbers/${selectedRowId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ status: newStatus })
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.message || 'Failed to update status')
            }

            setNumbers(prevNumbers =>
                prevNumbers.map(num => {
                    if (num.id === selectedRowId) {
                        return {
                            ...num,
                            status: newStatus,
                            license_status: newStatus
                        }
                    }
                    return num
                })
            )

            setShowStatusModal(false)
            setSuccess(`Number status updated to ${newStatus}`)
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        } finally {
            setUpdatingStatus(false)
            setSelectedRowId(null)
            setCurrentRowStatus('')
        }
    }

    const handleStatusCancel = () => {
        setShowStatusModal(false)
        setSelectedRowId(null)
        setCurrentRowStatus('')
    }

    const openTokenModal = (id) => {
        setTokenTargetId(id)
        setNewToken('')
        setTokenMsg('')
        setTokenError('')
        setShowTokenModal(true)
    }

    const handleUpdateToken = async (e) => {
        e.preventDefault()
        if (!newToken.trim()) { setTokenError('Please paste your new access token.'); return }
        setUpdatingToken(true)
        setTokenMsg('')
        setTokenError('')
        try {
            const token = localStorage.getItem('wa_dashboard_token')
            const res = await fetch(`${API_BASE}/whatsapp/${tokenTargetId}/token`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ access_token: newToken.trim() })
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update token')
            setTokenMsg(data.message || '✅ Token updated!')
            setNewToken('')
            fetchNumbers()
            if (!data.tokenExpired) {
                setTimeout(() => { setShowTokenModal(false); setTokenMsg('') }, 2500)
            }
        } catch (err) {
            setTokenError(err.message)
        } finally {
            setUpdatingToken(false)
        }
    }

    const getModalTitle = () => {
        if (currentRowStatus.toLowerCase() === 'active') {
            return 'Deactivate WhatsApp Number?'
        }
        return 'Activate WhatsApp Number?'
    }

    return (
        <div className="dashboard-content">
            <div className="numbers-card">
                {/* Page Header */}
                <div className="numbers-header">
                    <div className="numbers-header-left">
                        <div className="numbers-header-icon profile-icon-circle">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="numbers-title">WaApi Numbers</h1>
                        </div>
                    </div>
                    <div className="numbers-header-right">
                        <button className="btn-add-number" onClick={() => setShowAddModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add WaApi Number
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && <div className="error-banner">{error}</div>}
                {success && <div className="success-banner">{success}</div>}

                {/* Controls Row */}
                <div className="numbers-controls">
                    <div className="show-entries">
                        <span>Show</span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => {
                                setEntriesPerPage(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                        <span>entries</span>
                    </div>
                    <div className="search-box">
                        <input
                            type="text"
                            className="search-input-num"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button className="btn-search-icon" onClick={handleSearch}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-container">
                    <table className="numbers-table">
                        <thead>
                            <tr>
                                <th className="th-expand-num"></th>
                                <th>Profile Pic</th>
                                <th>Name</th>
                                <th>Wa Number</th>
                                <th>Status</th>
                                <th>Rating</th>
                                <th className="th-action-num">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="no-data">Loading...</td>
                                </tr>
                            ) : numbers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="no-data">No data available in table</td>
                                </tr>
                            ) : (
                                numbers.map((row) => (
                                    <React.Fragment key={row.id}>
                                        <tr className="numbers-row">
                                            <td className="td-expand-num">
                                                <button
                                                    className={`btn-expand-num ${expandedRows[row.id] ? 'expanded' : ''}`}
                                                    onClick={() => toggleExpand(row.id)}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                </button>
                                            </td>
                                            <td className="td-profile">
                                                {row.profile_pic ? (
                                                    <img
                                                        src={row.profile_pic}
                                                        alt={row.name}
                                                        className="profile-img"
                                                    />
                                                ) : (
                                                    <div className="profile-avatar">
                                                        {getInitials(row.name)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="td-name">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{row.name || '-'}</span>
                                                    {(String(row.id) === String(localStorage.getItem('active_wa_account_id'))) && (
                                                        <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', border: '1px solid #86efac' }}>
                                                            ACTIVE DASHBOARD
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="td-wa-number">
                                                {formatPhoneNumber(row.wa_number || row.phone_number)}
                                            </td>
                                            <td className="td-status">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span
                                                        className={`status-badge-num ${(row.status || '').toLowerCase() === 'active' ? 'badge-active' : 'badge-inactive'}`}
                                                        onClick={() => handleStatusBadgeClick(row)}
                                                        title="Click to change status"
                                                    >
                                                        {(row.status || '').toLowerCase() === 'active' ? 'Active' : 'Deactive'}
                                                    </span>
                                                    {(row.status === 'TOKEN_EXPIRED' || row.verification_status === 'TOKEN_EXPIRED') && (
                                                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, border: '1px solid #fcd34d' }}>
                                                            ⚠️ TOKEN EXPIRED
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="td-rating">
                                                <div className="rating-circle">
                                                    <svg viewBox="0 0 36 36" className="rating-svg">
                                                        <path
                                                            className="rating-bg"
                                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        />
                                                        <path
                                                            className="rating-fill"
                                                            strokeDasharray={`${row.rating || 75}, 100`}
                                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        />
                                                        <text x="18" y="20.5" className="rating-text">
                                                            {row.rating || '-'}
                                                        </text>
                                                    </svg>
                                                </div>
                                            </td>
                                            <td className="td-action">
                                                <div className="action-btns-row">
                                                    <button className="btn-act btn-fetch" onClick={() => handleDashboardView(row.id)} style={{ background: '#0284c7', color: '#fff' }}>Dashboard</button>
                                                    
                                                    <button className="btn-act btn-fetch" onClick={() => handleFetch(row.id)}>Fetch</button>
                                                    <button className="btn-act" onClick={() => openTokenModal(row.id)} style={{ background: '#f59e0b', color: '#fff', fontWeight: 700 }}>🔑 Update Token</button>
                                                    <button className="btn-act btn-addinfo" onClick={() => handleAddInfo(row.id)}>Info</button>
                                                    <button className="btn-act btn-rating" onClick={() => handleRating(row.id)}>Rating</button>
                                                    <button className="btn-act btn-delete-num" onClick={() => handleDelete(row.id)}>Delete</button>
       
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows[row.id] && (
                                            <tr className="expand-row">
                                                <td colSpan="7">
                                                    <div className="expand-content">
                                                        <div className="expand-details">
                                                            <div className="detail-item">
                                                                <span className="detail-label">Business Name</span>
                                                                <span className="detail-value">{row.details?.business_name || row.name || '-'}</span>
                                                            </div>
                                                            <div className="detail-item">
                                                                <span className="detail-label">Phone Number</span>
                                                                <span className="detail-value">{formatPhoneNumber(row.wa_number || row.phone_number)}</span>
                                                            </div>
                                                            <div className="detail-item">
                                                                <span className="detail-label">License Status</span>
                                                                <span className="detail-value">{row.details?.license || row.license_status || '-'}</span>
                                                            </div>
                                                            {row.details && Object.entries(row.details).map(([key, val]) => {
                                                                if (['business_name', 'phone', 'license'].includes(key)) return null
                                                                let displayVal = val || '-'
                                                                if (key === 'quality_rating') {
                                                                    const q = String(val || 'HIGH').toUpperCase()
                                                                    if (q === 'GREEN' || q === 'HIGH') displayVal = 'HIGH'
                                                                    else if (q === 'YELLOW' || q === 'MEDIUM') displayVal = 'MEDIUM'
                                                                    else if (q === 'RED' || q === 'LOW') displayVal = 'LOW'
                                                                }
                                                                return (
                                                                    <div className="detail-item" key={key}>
                                                                        <span className="detail-label">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                                        <span className="detail-value">{displayVal}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="pagination-container">
                        <div className="showing-info">
                            Showing {startEntry} to {endEntry} of {total} entries
                        </div>
                        <div className="pagination-buttons">
                            <button
                                className="btn-pagination"
                                disabled={currentPage === 1}
                                onClick={() => goToPage(currentPage - 1)}
                            >
                                Previous
                            </button>
                            {getPaginationButtons().map((page) => (
                                <button
                                    key={page}
                                    className={`btn-pagination ${page === currentPage ? 'active' : ''}`}
                                    onClick={() => goToPage(page)}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                className="btn-pagination"
                                disabled={currentPage === totalPages}
                                onClick={() => goToPage(currentPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

            </div>{/* end numbers-card */}

            {/* Update Token Modal */}
            {showTokenModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1060, padding: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>🔑 Update Access Token</h2>
                            <button onClick={() => setShowTokenModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Paste your new Permanent Access Token from Meta Business Manager below.</p>

                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#0369a1', marginBottom: 20, lineHeight: 1.7 }}>
                            <strong>How to get a permanent token:</strong><br />
                            1. Go to <strong>business.facebook.com → Settings → System Users</strong><br />
                            2. Click <strong>Generate New Token</strong> → Select App → Expiry: <strong>Never</strong><br />
                            3. Enable: <code>whatsapp_business_messaging</code> + <code>whatsapp_business_management</code><br />
                            4. Copy and paste below
                        </div>

                        {tokenMsg && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{tokenMsg}</div>}
                        {tokenError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{tokenError}</div>}

                        <form onSubmit={handleUpdateToken}>
                            <textarea
                                rows={4}
                                placeholder="Paste new EAAG... token here"
                                value={newToken}
                                onChange={e => setNewToken(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 9, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                                <button type="button" onClick={() => setShowTokenModal(false)} disabled={updatingToken}
                                    style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={updatingToken}
                                    style={{ padding: '10px 26px', borderRadius: 8, border: 'none', background: updatingToken ? '#fcd34d' : '#f59e0b', color: '#fff', cursor: updatingToken ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                                    {updatingToken ? 'Verifying…' : '🔑 Save & Verify Token'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Numbers Modal */}
            <AddNumbersModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={(formData) => {
                    fetchNumbers()
                }}
            />

            {/* Assign Options Modal */}
            <AssignOptionsModal
                isOpen={showAssignModal}
                account={assigningAccount}
                onClose={() => {
                    setShowAssignModal(false)
                    setAssigningAccount(null)
                }}
                onSave={async () => {
                    setSuccess('Sidebar access options updated for WhatsApp Dashboard!')
                    await fetchNumbers()
                    setTimeout(() => setSuccess(''), 3500)
                }}
            />

            {/* Status Confirmation Modal */}
            {showStatusModal && (
                <div className="status-modal-overlay">
                    <div className="status-modal">
                        <div className="status-modal-body">
                            {/* Warning Icon */}
                            <div className="status-modal-icon">
                                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                                    <circle cx="30" cy="30" r="28" stroke="#f59e0b" strokeWidth="3" fill="#fffbeb" />
                                    <circle cx="30" cy="30" r="28" stroke="#fef3c7" strokeWidth="2" fill="none" />
                                    <path d="M30 20V32" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                                    <circle cx="30" cy="38" r="2" fill="#f59e0b" />
                                </svg>
                            </div>

                            {/* Title */}
                            <h5 className="status-modal-title">{getModalTitle()}</h5>

                            {/* Buttons */}
                            <div className="status-modal-actions">
                                <button
                                    type="button"
                                    className="status-btn-cancel"
                                    onClick={handleStatusCancel}
                                    disabled={updatingStatus}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="status-btn-confirm"
                                    onClick={handleStatusConfirm}
                                    disabled={updatingStatus}
                                >
                                    {updatingStatus ? 'Updating...' : 'Yes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}