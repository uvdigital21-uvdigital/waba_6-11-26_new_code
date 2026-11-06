import React, { useState, useEffect, useCallback } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

import { API_BASE_URL } from '../config.js'

const API_BASE = API_BASE_URL

const countryCodes = [
    { code: '+91', name: 'India' },
    { code: '+1', name: 'USA' },
    { code: '+44', name: 'UK' },
    { code: '+61', name: 'Australia' },
    { code: '+971', name: 'UAE' },
    { code: '+966', name: 'Saudi Arabia' },
    { code: '+92', name: 'Pakistan' },
    { code: '+880', name: 'Bangladesh' },
    { code: '+62', name: 'Indonesia' },
    { code: '+63', name: 'Philippines' },
    { code: '+65', name: 'Singapore' },
    { code: '+60', name: 'Malaysia' },
    { code: '+64', name: 'New Zealand' },
    { code: '+27', name: 'South Africa' },
    { code: '+234', name: 'Nigeria' },
    { code: '+254', name: 'Kenya' },
]

export default function OptOutBlackList() {
    const { user } = useAuth()
    const { setTitle } = useTitle()
    const [numbers, setNumbers] = useState([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form state
    const [mobileNumbers, setMobileNumbers] = useState('')
    const [selectedCountry, setSelectedCountry] = useState('+91')
    const [adding, setAdding] = useState(false)

    // Date range filter
    const [dateRangeFrom, setDateRangeFrom] = useState('')
    const [dateRangeTo, setDateRangeTo] = useState('')

    // Delete confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteId, setDeleteId] = useState(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        setTitle('OptOut / BlackList')
    }, [setTitle])

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('wa_dashboard_token')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }, [])

    // Search query state
    const [searchQuery, setSearchQuery] = useState('')

    const fetchBlacklist = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: entriesPerPage,
                ...(searchQuery ? { search: searchQuery } : {}),
                ...(dateRangeFrom ? { from: dateRangeFrom } : {}),
                ...(dateRangeTo ? { to: dateRangeTo } : {})
            })

            const res = await fetch(`${API_BASE}/blacklist?${params}`, {
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to fetch blacklist')
            const data = await res.json()
            setNumbers(data.numbers || [])
            setTotal(data.total || 0)
            setTotalPages(data.totalPages || 0)
        } catch (err) {
            setError(err.message)
            setNumbers([])
            setTotal(0)
            setTotalPages(0)
        } finally {
            setLoading(false)
        }
    }, [currentPage, entriesPerPage, searchQuery, dateRangeFrom, dateRangeTo, getAuthHeaders])

    useEffect(() => {
        fetchBlacklist()
    }, [fetchBlacklist])

    const handleAdd = async () => {
        if (!mobileNumbers.trim()) {
            setError('Please enter at least one mobile number')
            return
        }
        setAdding(true)
        setError('')

        try {
            const res = await fetch(`${API_BASE}/blacklist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    mobile: mobileNumbers,
                    countryCode: selectedCountry
                })
            })
            const data = await res.json()
            if (res.ok) {
                setSuccess(data.message || 'Number(s) added to blacklist successfully')
                setMobileNumbers('')
                setCurrentPage(1)
                fetchBlacklist()
                setTimeout(() => setSuccess(''), 3000)
            } else {
                setError(data.message || 'Failed to add numbers')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setAdding(false)
        }
    }

    const handleDeleteClick = (id) => {
        setDeleteId(id)
        setShowDeleteModal(true)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        setDeleting(true)
        try {
            const res = await fetch(`${API_BASE}/blacklist/${deleteId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to remove number')
            setSuccess('Number removed from blacklist successfully')
            setShowDeleteModal(false)
            setDeleteId(null)
            fetchBlacklist()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        } finally {
            setDeleting(false)
        }
    }

    const handleDeleteCancel = () => {
        setShowDeleteModal(false)
        setDeleteId(null)
    }

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return
        setCurrentPage(page)
    }

    const formatPhone = (phone) => {
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

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const startEntry = total === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1
    const endEntry = Math.min(currentPage * entriesPerPage, total)

    return (
        <div className="dashboard-content">
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            <div className="optout-layout">
                {/* Left Panel - Add Black List Number Form */}
                <div className="optout-form-panel">
                    <div className="optout-form-card">
                        <div className="optout-form-header">
                            <h3>Add Black List Number</h3>
                        </div>
                        <div className="optout-form-body">
                            <div className="optout-form-group">
                                <label>Mobile</label>
                                <textarea
                                    className="optout-form-textarea"
                                    placeholder="enter comma separated mobile no"
                                    value={mobileNumbers}
                                    onChange={(e) => setMobileNumbers(e.target.value)}
                                    rows="4"
                                />
                            </div>
                            <div className="optout-form-group">
                                <label>Country</label>
                                <div className="optout-country-select-wrapper">
                                    <select
                                        className="optout-country-select"
                                        value={selectedCountry}
                                        onChange={(e) => setSelectedCountry(e.target.value)}
                                    >
                                        {countryCodes.map((c) => (
                                            <option key={c.code} value={c.code}>
                                                {c.name} ({c.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="optout-form-actions">
                                <button
                                    className="optout-save-btn"
                                    onClick={handleAdd}
                                    disabled={adding}
                                >
                                    {adding ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Data Table */}
                <div className="optout-table-panel">
                    <div className="optout-table-card">
                        {/* Controls Row */}
                        <div className="optout-table-controls">
                            <div className="optout-show-entries">
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
                            <div className="optout-date-range-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="Search mobile no..."
                                    className="optout-date-input"
                                    style={{ minWidth: '160px', padding: '4px 8px' }}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                />

                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="optout-table-container">
                            <table className="optout-table">
                                <thead>
                                    <tr>
                                        <th className="optout-th-plus">+</th>
                                        <th>Mobile no</th>
                                        <th>Black List Time</th>
                                        <th className="optout-th-action">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="optout-no-data">Loading...</td>
                                        </tr>
                                    ) : numbers.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="optout-no-data">No data available in table</td>
                                        </tr>
                                    ) : (
                                        numbers.map((row, idx) => (
                                            <tr className="optout-table-row" key={row.id}>
                                                <td className="optout-td-plus">{startEntry + idx}</td>
                                                <td className="optout-td-mobile">{formatPhone(row.phone_number)}</td>
                                                <td className="optout-td-time">{formatDate(row.created_at)}</td>
                                                <td className="optout-td-action">
                                                    <button
                                                        className="optout-btn-delete"
                                                        onClick={() => handleDeleteClick(row.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="optout-pagination">
                            <div className="optout-showing-info">
                                Showing {startEntry} to {endEntry} of {total} entries
                            </div>
                            <div className="optout-pagination-buttons">
                                <button
                                    className="optout-btn-page"
                                    disabled={currentPage === 1}
                                    onClick={() => goToPage(currentPage - 1)}
                                >
                                    Previous
                                </button>
                                <button
                                    className="optout-btn-page"
                                    disabled={currentPage === totalPages}
                                    onClick={() => goToPage(currentPage + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="status-modal-overlay">
                    <div className="status-modal" style={{ maxWidth: '420px' }}>
                        <div className="status-modal-body">
                            <div className="status-modal-icon">
                                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                                    <circle cx="30" cy="30" r="28" stroke="#f59e0b" strokeWidth="3" fill="#fffbeb" />
                                    <circle cx="30" cy="30" r="28" stroke="#fef3c7" strokeWidth="2" fill="none" />
                                    <path d="M30 20V32" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                                    <circle cx="30" cy="38" r="2" fill="#f59e0b" />
                                </svg>
                            </div>
                            <h5 className="status-modal-title">Remove from Blacklist?</h5>
                            <p style={{ fontSize: 13, color: '#9296ab', margin: '0 0 20px', textAlign: 'center' }}>
                                This number will be allowed to receive messages again.
                            </p>
                            <div className="status-modal-actions">
                                <button
                                    type="button"
                                    className="status-btn-cancel"
                                    onClick={handleDeleteCancel}
                                    disabled={deleting}
                                >
                                    No
                                </button>
                                <button
                                    type="button"
                                    className="status-btn-confirm"
                                    onClick={handleDeleteConfirm}
                                    disabled={deleting}
                                    style={{ background: '#1abc9c' }}
                                >
                                    {deleting ? 'Removing...' : 'Yes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}