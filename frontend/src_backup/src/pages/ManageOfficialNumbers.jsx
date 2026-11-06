import React, { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout.jsx'
import AddNumbersModal from '../components/AddNumbersModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

export default function ManageOfficialNumbers() {
    const { user } = useAuth()
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
    const [expandedRows, setExpandedRows] = useState({})

    // Status confirmation modal state
    const [showStatusModal, setShowStatusModal] = useState(false)
    const [selectedRowId, setSelectedRowId] = useState(null)
    const [currentRowStatus, setCurrentRowStatus] = useState('')
    const [updatingStatus, setUpdatingStatus] = useState(false)

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
            setNumbers(data.numbers || [])
            setTotal(data.total || 0)
            setTotalPages(data.totalPages || 0)
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
        try {
            const res = await fetch(`${API_BASE}/numbers/${id}/fetch`, {
                method: 'POST',
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to fetch')
            setSuccess('Fetch initiated successfully')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleAddInfo = (id) => {
        console.log('Add Info:', id)
    }

    const handleRating = (id) => {
        console.log('Rating:', id)
    }

    const handleChat = (id) => {
        console.log('Chat:', id)
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
        if (s === 'inactive') return 'badge-inactive'
        if (s === 'pending') return 'badge-pending'
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
        // Format as +XX XXXX XXXXXX
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
        const status = row.status || row.license_status || 'Inactive'
        setSelectedRowId(row.id)
        setCurrentRowStatus(status)
        setShowStatusModal(true)
    }

    const handleStatusConfirm = async () => {
        if (!selectedRowId) return

        setUpdatingStatus(true)
        try {
            // Determine the new status (toggle between Active and Inactive)
            const newStatus = currentRowStatus.toLowerCase() === 'active' ? 'Inactive' : 'Active'

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

            // Update the specific row in the numbers array
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

    // Determine modal title based on current status
    const getModalTitle = () => {
        if (currentRowStatus.toLowerCase() === 'active') {
            return 'Deactivate it?'
        }
        if (currentRowStatus.toLowerCase() === 'inactive') {
            return 'Activate it?'
        }
        return 'Change status?'
    }

    return (
        <Layout title="Manage Official Numbers">
            <div className="dashboard-content">
                <div className="numbers-card">
                    {/* Page Header */}
                    <div className="numbers-header">
                        <div className="numbers-header-left">
                            <div className="profile-icon-circle">
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
                                className="search-input"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button className="btn-search" onClick={handleSearch}>
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
                                    <th className="th-expand"></th>
                                    <th>Profile Pic</th>
                                    <th>Name</th>
                                    <th>Wa Number</th>
                                    <th>Status</th>
                                    <th>Rating</th>
                                    <th className="th-action">Action</th>
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
                                            <tr className={`numbers-row ${expandedRows[row.id] ? 'row-expanded' : ''}`}>
                                                <td className="td-expand">
                                                    <button
                                                        className={`btn-expand ${expandedRows[row.id] ? 'expanded' : ''}`}
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
                                                <td className="td-name">{row.name || '-'}</td>
                                                <td className="td-wa-number">
                                                    {formatPhoneNumber(row.wa_number || row.phone_number)}
                                                </td>
                                                <td className="td-status">
                                                    <span
                                                        className={`status-badge-num ${getStatusBadge(row.status || row.license_status)}`}
                                                        onClick={() => handleStatusBadgeClick(row)}
                                                        style={{ cursor: 'pointer' }}
                                                        title="Click to change status"
                                                    >
                                                        {row.status || row.license_status || 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="td-rating">
                                                    <div className="rating-circle">
                                                        <svg viewBox="0 0 36 36" className="rating-svg">
                                                            <path
                                                                className="rating-bg"
                                                                d="M18 2.0845
                                                                    a 15.9155 15.9155 0 0 1 0 31.831
                                                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                                            />
                                                            <path
                                                                className="rating-fill"
                                                                strokeDasharray={`${row.rating || 75}, 100`}
                                                                d="M18 2.0845
                                                                    a 15.9155 15.9155 0 0 1 0 31.831
                                                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                                            />
                                                            <text x="18" y="20.5" className="rating-text">
                                                                {row.rating || '-'}
                                                            </text>
                                                        </svg>
                                                    </div>
                                                </td>
                                                <td className="td-action">
                                                    <div className="action-btns-row">
                                                        <button className="btn-act btn-fetch" onClick={() => handleFetch(row.id)} title="Fetch">Fetch</button>
                                                        <button className="btn-act btn-addinfo" onClick={() => handleAddInfo(row.id)} title="Add Info">Add Info</button>
                                                        <button className="btn-act btn-rating" onClick={() => handleRating(row.id)} title="Rating">Rating</button>
                                                        <button className="btn-act btn-delete-num" onClick={() => handleDelete(row.id)} title="Delete">Delete</button>
                                                        <button className="btn-act btn-chat" onClick={() => handleChat(row.id)} title="Chat">Chat</button>
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
                                                                    return (
                                                                        <div className="detail-item" key={key}>
                                                                            <span className="detail-label">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                                            <span className="detail-value">{val || '-'}</span>
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
                </div>

                {/* Add Numbers Modal */}
                <AddNumbersModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onAdd={(formData) => {
                        fetchNumbers()
                    }}
                />

                {/* Status Confirmation Modal */}
                <div
                    className={`modal fade ${showStatusModal ? 'show' : ''}`}
                    style={{ display: showStatusModal ? 'block' : 'none' }}
                    tabIndex="-1"
                    role="dialog"
                    aria-labelledby="statusModalLabel"
                    aria-hidden={!showStatusModal}
                >
                    <div className="modal-dialog modal-dialog-centered" role="document">
                        <div className="modal-content">
                            <div className="modal-body text-center p-4">
                                {/* Warning Icon */}
                                <div className="mb-3">
                                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="30" cy="30" r="28" stroke="#f59e0b" strokeWidth="3" fill="none" />
                                        <circle cx="30" cy="30" r="28" stroke="#fef3c7" strokeWidth="2" fill="#fffbeb" />
                                        <path d="M30 20V32" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                                        <circle cx="30" cy="38" r="2" fill="#f59e0b" />
                                    </svg>
                                </div>

                                {/* Title */}
                                <h5 className="modal-title mb-4" id="statusModalLabel" style={{
                                    fontSize: '22px',
                                    fontWeight: 'bold',
                                    color: '#1f2937'
                                }}>
                                    {getModalTitle()}
                                </h5>

                                {/* Buttons */}
                                <div className="d-flex justify-content-center gap-3 mt-4">
                                    <button
                                        type="button"
                                        className="btn btn-danger px-4 py-2"
                                        onClick={handleStatusCancel}
                                        disabled={updatingStatus}
                                        style={{
                                            minWidth: '120px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary px-4 py-2"
                                        onClick={handleStatusConfirm}
                                        disabled={updatingStatus}
                                        style={{
                                            minWidth: '120px',
                                            fontWeight: '600',
                                            backgroundColor: '#0d6efd',
                                            borderColor: '#0d6efd'
                                        }}
                                    >
                                        {updatingStatus ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Updating...
                                            </>
                                        ) : (
                                            'Yes'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Backdrop */}
                {showStatusModal && (
                    <div
                        className="modal-backdrop fade show"
                        onClick={handleStatusCancel}
                    ></div>
                )}

                <style>{`
                    .modal.show {
                        padding-right: 0 !important;
                    }
                    .modal-backdrop.show {
                        opacity: 0.5;
                    }
                    .modal-content {
                        border-radius: 12px;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                        border: none;
                    }
                    .modal-dialog {
                        max-width: 525px;
                        margin: 1.75rem auto;
                    }
                    .status-badge-num {
                        cursor: pointer;
                        transition: opacity 0.15s, transform 0.1s;
                    }
                    .status-badge-num:hover {
                        opacity: 0.8;
                        transform: scale(1.05);
                    }
                    .btn-danger {
                        background-color: #dc3545;
                        border-color: #dc3545;
                    }
                    .btn-danger:hover:not(:disabled) {
                        background-color: #bb2d3b;
                        border-color: #b02a37;
                    }
                    .btn-primary:hover:not(:disabled) {
                        background-color: #0b5ed7;
                        border-color: #0b5ed7;
                    }
                    button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    @media (max-width: 768px) {
                        .modal-dialog {
                            margin: 0.5rem;
                            max-width: calc(100% - 1rem);
                        }
                        .modal-content {
                            border-radius: 10px;
                        }
                        .modal-body {
                            padding: 1.5rem 1rem !important;
                        }
                    }
                `}</style>
            </div>
        </Layout>
    )
}