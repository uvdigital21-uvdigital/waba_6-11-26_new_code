import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

export default function ManageOfficialTemplate() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [searchBy, setSearchBy] = useState('Template name')
    const [searchQuery, setSearchQuery] = useState('')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [selectedRows, setSelectedRows] = useState([])
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [templates, setTemplates] = useState([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewTemplate, setPreviewTemplate] = useState(null)
    const [newTemplate, setNewTemplate] = useState({ name: '', message: '', category: 'UTILITY' })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('wa_dashboard_token')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }, [])

    const fetchTemplates = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: entriesPerPage,
                searchBy,
                searchQuery
            })
            if (dateFrom) params.append('dateFrom', dateFrom)
            if (dateTo) params.append('dateTo', dateTo)

            const res = await fetch(`${API_BASE}/templates?${params}`, {
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to fetch templates')
            const data = await res.json()
            setTemplates(data.templates)
            setTotal(data.total)
            setTotalPages(data.totalPages)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [currentPage, entriesPerPage, searchBy, searchQuery, dateFrom, dateTo, getAuthHeaders])

    useEffect(() => {
        fetchTemplates()
    }, [fetchTemplates])

    const handleSearch = () => {
        setCurrentPage(1)
        fetchTemplates()
    }

    const handlePreview = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/templates/${id}`, {
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to fetch template')
            const data = await res.json()
            setPreviewTemplate(data.template)
            setShowPreviewModal(true)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this template?')) return
        try {
            const res = await fetch(`${API_BASE}/templates/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to delete template')
            setSuccess('Template deleted successfully')
            fetchTemplates()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleViewCampaign = (id) => {
        console.log('View Campaign:', id)
    }

    const handleSummary = (id) => {
        console.log('Summary:', id)
    }

    const handleAddNewTemplate = () => {
        navigate('/template/manage/add')
    }

    const handleCreateTemplate = async (e) => {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch(`${API_BASE}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(newTemplate)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to create template')
            setSuccess('Template created successfully')
            setShowAddModal(false)
            fetchTemplates()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleFetchFromFacebook = async () => {
        try {
            const res = await fetch(`${API_BASE}/templates/fetch-facebook`, {
                method: 'POST',
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to fetch from Facebook')
            const data = await res.json()
            setSuccess(data.message)
            fetchTemplates()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const selectAll = (checked) => {
        if (checked) {
            setSelectedRows(templates.map(row => row.id))
        } else {
            setSelectedRows([])
        }
    }

    const selectRow = (id, checked) => {
        if (checked) {
            setSelectedRows([...selectedRows, id])
        } else {
            setSelectedRows(selectedRows.filter(sid => sid !== id))
        }
    }

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return
        setCurrentPage(page)
    }

    const startEntry = (currentPage - 1) * entriesPerPage + 1
    const endEntry = Math.min(currentPage * entriesPerPage, total)

    const getStatusClass = (status) => {
        switch (status) {
            case 'APPROVED': return 'status-approved'
            case 'REJECTED': return 'status-rejected'
            case 'PENDING': return 'status-pending'
            default: return ''
        }
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

    return (
        <Layout title="Manage Official Template">
            <div className="dashboard-content">
                <div className="template-management-card">
                    {/* Header Section */}
                    <div className="template-management-header">
                        <div className="header-left">
                            <div className="official-template-icon">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="20" cy="20" r="20" fill="#4FC3F7" />
                                    <path d="M12 14h16v2H12zM12 20h16v2H12zM12 26h10v2H12z" fill="#fff" />
                                </svg>
                            </div>
                            <h1 className="page-title">Offical WAPP Template<br />Report</h1>
                        </div>
                        <div className="header-actions">
                            <button className="btn-add-new" onClick={handleAddNewTemplate}>
                                Add New Offical Template
                            </button>
                        </div>
                    </div>

                    {/* Search Section */}
                    <div className="template-search-section">
                        <div className="search-controls">
                            <div className="search-by-group">
                                <span className="search-by-label">Search by</span>
                                <select
                                    className="filter-select"
                                    value={searchBy}
                                    onChange={(e) => setSearchBy(e.target.value)}
                                >
                                    <option value="Template name">Template name</option>
                                    <option value="Category">Category</option>
                                    <option value="Status">Status</option>
                                </select>
                            </div>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search here..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button className="btn-search" onClick={handleSearch}>
                                Search
                            </button>
                        </div>
                        <div className="date-range-control">
                            <div className="date-range-picker">
                                <input
                                    type="date"
                                    className="date-input"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                                <span className="date-sep">to</span>
                                <input
                                    type="date"
                                    className="date-input"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>
                            <button className="btn-fetch-facebook" onClick={handleFetchFromFacebook}>
                                Fetch Template from Facebook
                            </button>
                        </div>
                    </div>

                    {/* Controls Section */}
                    <div className="template-controls">
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
                    </div>

                    {/* Messages */}
                    {error && <div className="error-banner">{error}</div>}
                    {success && <div className="success-banner">{success}</div>}

                    {/* Data Table */}
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr className="table-header">
                                    <th className="th-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={templates.length > 0 && selectedRows.length === templates.length}
                                            onChange={(e) => selectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="th-sortable">Template</th>
                                    <th className="th-sortable">Message</th>
                                    <th className="th-sortable">Category</th>
                                    <th className="th-sortable">Submit Date</th>
                                    <th className="th-sortable">Status</th>
                                    <th className="th-sortable">Quality</th>
                                    <th className="th-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="no-data">Loading...</td>
                                    </tr>
                                ) : templates.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="no-data">No data available in table</td>
                                    </tr>
                                ) : (
                                    templates.map((row) => (
                                        <tr key={row.id} className={`table-row ${selectedRows.includes(row.id) ? 'row-selected' : ''}`}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.includes(row.id)}
                                                    onChange={(e) => selectRow(row.id, e.target.checked)}
                                                />
                                            </td>
                                            <td>{row.template}</td>
                                            <td className="msg-cell">{row.message}</td>
                                            <td>{row.category}</td>
                                            <td>{row.submitDate}</td>
                                            <td>
                                                <span className={`status-badge ${getStatusClass(row.status)}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td>{row.quality || '-'}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-action btn-preview" onClick={() => handlePreview(row.id)} title="Preview">PREVIEW</button>
                                                    <button className="btn-action btn-delete" onClick={() => handleDelete(row.id)} title="Delete">DELETE</button>
                                                    <button className="btn-action btn-campaign" onClick={() => handleViewCampaign(row.id)} title="View Campaign">VIEW CAMPAIGN</button>
                                                    <button className="btn-action btn-summary" onClick={() => handleSummary(row.id)} title="Summary">SUMMARY</button>
                                                </div>
                                            </td>
                                        </tr>
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
                                <button className="btn-pagination" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>Previous</button>
                                {getPaginationButtons().map((page) => (
                                    <button key={page} className={`btn-pagination ${page === currentPage ? 'active' : ''}`} onClick={() => goToPage(page)}>{page}</button>
                                ))}
                                <button className="btn-pagination" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>Next</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Add New Template Modal */}
                {showAddModal && (
                    <div className="modal-overlay-add" onClick={() => setShowAddModal(false)}>
                        <div className="modal-content-add" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header-add">
                                <h2>Add New Official Template</h2>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleCreateTemplate}>
                                <div className="modal-body-add">
                                    <div className="form-group-add">
                                        <label className="form-label-add">Template Name *</label>
                                        <input
                                            type="text"
                                            className="form-input-add"
                                            value={newTemplate.name}
                                            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                            placeholder="Enter template name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group-add">
                                        <label className="form-label-add">Category</label>
                                        <select
                                            className="form-input-add"
                                            value={newTemplate.category}
                                            onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                        >
                                            <option value="UTILITY">UTILITY</option>
                                            <option value="MARKETING">MARKETING</option>
                                            <option value="AUTHENTICATION">AUTHENTICATION</option>
                                        </select>
                                    </div>
                                    <div className="form-group-add">
                                        <label className="form-label-add">Message Body *</label>
                                        <textarea
                                            className="form-textarea-add"
                                            value={newTemplate.message}
                                            onChange={(e) => setNewTemplate({ ...newTemplate, message: e.target.value })}
                                            placeholder="Enter template message content"
                                            rows="6"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer-add">
                                    <button type="button" className="btn-modal-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button type="submit" className="btn-modal-save" disabled={!newTemplate.name || !newTemplate.message}>Create Template</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Preview Modal */}
                {showPreviewModal && previewTemplate && (
                    <div className="modal-overlay-add" onClick={() => setShowPreviewModal(false)}>
                        <div className="modal-content-add" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header-add">
                                <h2>Template Preview</h2>
                                <button className="modal-close" onClick={() => setShowPreviewModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body-add">
                                <div className="preview-field">
                                    <label>Template Name</label>
                                    <p className="preview-value">{previewTemplate.template}</p>
                                </div>
                                <div className="preview-field">
                                    <label>Category</label>
                                    <p className="preview-value">{previewTemplate.category}</p>
                                </div>
                                <div className="preview-field">
                                    <label>Status</label>
                                    <span className={`status-badge ${getStatusClass(previewTemplate.status)}`}>{previewTemplate.status}</span>
                                </div>
                                <div className="preview-field">
                                    <label>Submit Date</label>
                                    <p className="preview-value">{previewTemplate.submitDate}</p>
                                </div>
                                <div className="preview-field">
                                    <label>Message</label>
                                    <div className="preview-message-box">{previewTemplate.message}</div>
                                </div>
                            </div>
                            <div className="modal-footer-add">
                                <button className="btn-modal-cancel" onClick={() => setShowPreviewModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}