import React, { useState, useEffect, useCallback } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AddTagsModal from '../components/AddTagsModal.jsx'
import EditTagModal from '../components/EditTagModal.jsx'
import ViewTagModal from '../components/ViewTagModal.jsx'
import { getTags, createTag, updateTag, deleteTag } from '../services/tagService.js'

export default function Tags() {
    const { user } = useAuth()
    const { setTitle } = useTitle()
    const [tags, setTags] = useState([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [expandedRows, setExpandedRows] = useState({})
    const [selectedAll, setSelectedAll] = useState(false)
    const [selectedTags, setSelectedTags] = useState([])
    const [showAddTagModal, setShowAddTagModal] = useState(false)
    const [selectedTagToEdit, setSelectedTagToEdit] = useState(null)
    const [selectedTagToView, setSelectedTagToView] = useState(null)

    // Date range filter state
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin'

    useEffect(() => {
        setTitle('Tags & Contact Groups (Admin)')
    }, [setTitle])

    const fetchTags = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const data = await getTags({
                page: currentPage,
                limit: entriesPerPage,
                date_from: dateFrom,
                date_to: dateTo,
            })
            setTags(data.tags || data.data || [])
            setTotal(data.total || 0)
            setTotalPages(data.totalPages || 0)
        } catch (err) {
            setError(err.message || 'Failed to fetch tags')
            setTags([])
            setTotal(0)
            setTotalPages(0)
        } finally {
            setLoading(false)
        }
    }, [currentPage, entriesPerPage, dateFrom, dateTo])

    useEffect(() => {
        fetchTags()
    }, [fetchTags])

    const handleSelectAll = () => {
        if (selectedAll) {
            setSelectedTags([])
        } else {
            setSelectedTags(tags.map(t => t.id))
        }
        setSelectedAll(!selectedAll)
    }

    const handleSelectTag = (id) => {
        setSelectedTags(prev => {
            if (prev.includes(id)) {
                return prev.filter(tid => tid !== id)
            }
            return [...prev, id]
        })
    }

    const handleBulkDelete = async () => {
        if (selectedTags.length === 0) return
        if (!window.confirm(`Are you sure you want to delete ${selectedTags.length} tag(s)?`)) return

        try {
            for (const id of selectedTags) {
                await deleteTag(id)
            }
            setSuccess(`${selectedTags.length} tag(s) deleted successfully`)
            setSelectedTags([])
            setSelectedAll(false)
            await fetchTags()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleView = (tag) => {
        setSelectedTagToView(tag)
    }

    const handleEdit = (tag) => {
        setSelectedTagToEdit(tag)
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this tag?')) return
        try {
            await deleteTag(id)
            setSuccess('Tag deleted successfully')
            await fetchTags()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const toggleExpand = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    const handleSaveTag = async (tagData) => {
        try {
            if (tagData?.id) {
                await updateTag(tagData.id, { name: tagData.name, color: tagData.color })
                setSuccess('Tag updated successfully')
            } else {
                await createTag({ name: tagData.name, color: tagData.color })
                setSuccess('Tag created successfully')
            }
            await fetchTags()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
        }
    }

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return
        setCurrentPage(page)
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
    const displayData = tags

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

    if (!isAdmin) {
        return (
            <div className="dashboard-content">
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                    <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '8px' }}>Access Restricted</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px auto' }}>
                        Admin Tag Management is restricted to Admin users. Please use <strong>Send WA &rarr; Send By Tags</strong> to send campaign broadcasts to your tags.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="dashboard-content">
            <div className="tags-card">
                {/* Page Header */}
                <div className="tags-header">
                    <div className="tags-header-left">
                        <div className="tags-header-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                        </div>
                        <h1 className="tags-title">Tags</h1>
                    </div>
                    <div className="tags-header-right">
                        <button className="tags-btn-add" onClick={() => setShowAddTagModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Tag
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && <div className="error-banner">{error}</div>}
                {success && <div className="success-banner">{success}</div>}

                {/* Controls Row */}
                <div className="tags-controls">
                    <div className="tags-controls-left">
                        <div className="tags-show-entries">
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
                    <div className="tags-controls-right">
                    </div>
                </div>

                {/* Data Table */}
                <div className="tags-table-container">
                    <table className="tags-table">
                        <thead>
                            <tr>
                                <th className="tags-th-expand"></th>
                                <th>Tag</th>
                                <th>Total Numbers</th>
                                <th>Created on</th>
                                <th className="tags-th-action">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="tags-no-data">Loading...</td>
                                </tr>
                            ) : displayData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="tags-no-data">No data available in table</td>
                                </tr>
                            ) : (
                                displayData.map((tag) => (
                                    <React.Fragment key={tag.id}>
                                        <tr className="tags-row">
                                            <td className="tags-td-expand">
                                                <button
                                                    className={`tags-btn-expand ${expandedRows[tag.id] ? 'expanded' : ''}`}
                                                    onClick={() => toggleExpand(tag.id)}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                </button>
                                            </td>
                                            <td className="tags-td-name">{tag.name || '-'}</td>
                                            <td className="tags-td-numbers">{Number(tag.contactCount ?? tag.total_numbers ?? 0)}</td>
                                            <td className="tags-td-date">{formatDate(tag.created_at)}</td>
                                            <td className="tags-td-action">
                                                <div className="tags-action-btns">
                                                    <button className="tags-btn-act tags-btn-view" onClick={() => handleView(tag)}>VIEW</button>
                                                    <button className="tags-btn-act tags-btn-edit" onClick={() => handleEdit(tag)}>EDIT</button>
                                                    <button className="tags-btn-act tags-btn-delete" onClick={() => handleDelete(tag.id)}>DELETE</button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows[tag.id] && (
                                            <tr className="tags-expand-row">
                                                <td colSpan="5">
                                                    <div className="tags-expand-content">
                                                        <div className="tags-expand-details">
                                                            <div className="tags-detail-item">
                                                                <span className="tags-detail-label">Tag Name</span>
                                                                <span className="tags-detail-value">{tag.name || '-'}</span>
                                                            </div>
                                                            <div className="tags-detail-item">
                                                                <span className="tags-detail-label">Total Numbers</span>
                                                                <span className="tags-detail-value">{Number(tag.contactCount ?? tag.total_numbers ?? 0)}</span>
                                                            </div>
                                                            <div className="tags-detail-item">
                                                                <span className="tags-detail-label">Created On</span>
                                                                <span className="tags-detail-value">{formatDate(tag.created_at)}</span>
                                                            </div>
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
                    <div className="tags-pagination">
                        <div className="tags-pagination-info">
                            Showing {startEntry} to {endEntry} of {total} entries
                        </div>
                        <div className="tags-pagination-buttons">
                            <button
                                className="tags-btn-page"
                                disabled={currentPage === 1}
                                onClick={() => goToPage(currentPage - 1)}
                            >
                                Previous
                            </button>
                            {getPaginationButtons().map((page) => (
                                <button
                                    key={page}
                                    className={`tags-btn-page ${page === currentPage ? 'active' : ''}`}
                                    onClick={() => goToPage(page)}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                className="tags-btn-page"
                                disabled={currentPage === totalPages}
                                onClick={() => goToPage(currentPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Tags Modal */}
            <AddTagsModal
                isOpen={showAddTagModal}
                onClose={() => setShowAddTagModal(false)}
                onSave={handleSaveTag}
            />

            {/* Edit Tag Modal */}
            <EditTagModal
                isOpen={Boolean(selectedTagToEdit)}
                tag={selectedTagToEdit}
                onClose={() => setSelectedTagToEdit(null)}
                onSave={async (updatedTag) => {
                    setSelectedTagToEdit(null)
                    setSuccess('Tag updated successfully!')
                    await fetchTags()
                    setTimeout(() => setSuccess(''), 3000)
                }}
            />

            {/* View Tag Modal */}
            <ViewTagModal
                isOpen={Boolean(selectedTagToView)}
                tag={selectedTagToView}
                onClose={() => setSelectedTagToView(null)}
                onTagUpdated={async () => {
                    await fetchTags()
                }}
            />
        </div>
    )
}