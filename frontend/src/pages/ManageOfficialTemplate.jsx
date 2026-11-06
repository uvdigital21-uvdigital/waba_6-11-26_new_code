import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import './Template.css'

import { API_BASE_URL, getImageUrl } from '../config.js'

const API_BASE = API_BASE_URL

export default function ManageOfficialTemplate() {
    const navigate = useNavigate()
    const { setTitle } = useTitle()
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

    useEffect(() => {
        setTitle('Manage Official Template')
    }, [setTitle])

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
            setTemplates(prev => prev.filter(t => t.id !== id))
            const res = await fetch(`${API_BASE}/templates/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            })
            if (!res.ok) throw new Error('Failed to delete template')
            setSuccess('Template deleted successfully from Meta and database')
            fetchTemplates()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message)
            fetchTemplates()
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
            setError('')
            setSuccess('Syncing latest template approval statuses from Meta...')
            const res = await fetch(`${API_BASE}/meta/templates/sync`, {
                method: 'GET',
                headers: getAuthHeaders()
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to sync templates from Meta Facebook')
            }
            setSuccess(data.message || 'Official templates synced successfully!')
            fetchTemplates()
            setTimeout(() => setSuccess(''), 3500)
        } catch (err) {
            setError(err.message)
            setTimeout(() => setError(''), 4000)
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
        switch (String(status).toUpperCase()) {
            case 'APPROVED': return 'status-approved'
            case 'REJECTED': return 'status-rejected'
            case 'PENDING': return 'status-pending'
            case 'PAUSED': return 'status-paused'
            case 'DISABLED': return 'status-disabled'
            default: return 'status-pending'
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

    const handleEdit = (id) => {
        navigate(`/template/manage/edit/${id}`)
    }

    const renderFormattedMessage = (msg) => {
        if (!msg) return ''
        let html = msg
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>')
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/~(.*?)~/g, '<del>$1</del>')
            .replace(/\{\{(\d+)\}\}/g, '<span class="preview-variable-chip">{{$1}}</span>')
        return html
    }

    return (
        <>
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
                            <h1 className="page-title">Official WABA Template<br />Report</h1>
                        </div>
                        <div className="header-actions">
                            <button className="btn-add-new" onClick={handleAddNewTemplate}>
                                Add New Official Template
                            </button>
                        </div>
                    </div>

                    {/* Search Section */}
                    <div className="template-search-section">
                        <div className="search-controls">
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
                                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.template}</td>
                                            <td className="msg-cell">{row.message}</td>
                                            <td>
                                                <span className="category-pill-table">{row.category}</span>
                                            </td>
                                            <td>{row.submitDate}</td>
                                            <td>
                                                <span className={`status-badge ${getStatusClass(row.status)}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td>{row.quality || 'HIGH'}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-action btn-preview" onClick={() => handlePreview(row.id)} title="Preview">PREVIEW</button>
                                                    <button className="btn-action btn-edit" onClick={() => handleEdit(row.id)} title="Edit Template">EDIT</button>
                                                    <button className="btn-action btn-delete" onClick={() => handleDelete(row.id)} title="Delete">DELETE</button>
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

                {/* Rich WhatsApp Preview Modal */}
                {showPreviewModal && previewTemplate && (
                    <div className="modal-overlay-add" onClick={() => setShowPreviewModal(false)}>
                        <div className="modal-content-preview-rich" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header-preview-rich">
                                <div className="preview-modal-title-group">
                                    <div className="wa-icon-badge">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                                            Template Preview
                                        </h2>
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Live WhatsApp Client Simulation</span>
                                    </div>
                                </div>
                                <div className="preview-header-actions">
                                    <button
                                        type="button"
                                        className="btn-modal-edit-quick"
                                        onClick={() => {
                                            setShowPreviewModal(false);
                                            navigate(`/template/manage/edit/${previewTemplate.id}`);
                                        }}
                                    >
                                        ✏️ Edit Template
                                    </button>
                                    <button className="modal-close" onClick={() => setShowPreviewModal(false)}>
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="modal-body-preview-grid">
                                {/* Left: Template Metadata Details */}
                                <div className="preview-meta-details-col">
                                    <h3 className="meta-col-heading">Template Information</h3>

                                    <div className="p-meta-card">
                                        <div className="p-info-row">
                                            <span className="p-info-label">TEMPLATE NAME</span>
                                            <span className="p-info-val highlight">{previewTemplate.name || previewTemplate.template}</span>
                                        </div>
                                        <div className="p-info-row">
                                            <span className="p-info-label">STATUS</span>
                                            <span className={`status-badge ${getStatusClass(previewTemplate.status)}`}>
                                                {previewTemplate.status}
                                            </span>
                                        </div>
                                        <div className="p-info-row">
                                            <span className="p-info-label">CATEGORY</span>
                                            <span className="category-pill-table">{previewTemplate.category}</span>
                                        </div>
                                        <div className="p-info-row">
                                            <span className="p-info-label">TYPE</span>
                                            <span className="p-info-val">
                                                {(() => {
                                                    const t = String(previewTemplate.template_type || '').toUpperCase();
                                                    if (t === 'CAROUSEL' || (Array.isArray(previewTemplate.cards) && previewTemplate.cards.length > 0)) return 'CAROUSEL';
                                                    if (t === 'MEDIA' || previewTemplate.header_media_url || (previewTemplate.media_type && previewTemplate.media_type !== 'text')) {
                                                        return `MEDIA (${(previewTemplate.media_type || 'image').toUpperCase()})`;
                                                    }
                                                    return 'STANDARD';
                                                })()}
                                            </span>
                                        </div>
                                        <div className="p-info-row">
                                            <span className="p-info-label">LANGUAGE</span>
                                            <span className="p-info-val">{previewTemplate.language || 'en_US'}</span>
                                        </div>
                                        <div className="p-info-row">
                                            <span className="p-info-label">QUALITY</span>
                                            <span className="p-info-val">{previewTemplate.quality || 'HIGH'}</span>
                                        </div>
                                        <div className="p-info-row">
                                            <span className="p-info-label">SUBMITTED ON</span>
                                            <span className="p-info-val">{previewTemplate.submitDate}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Authentic WhatsApp Mobile Screen */}
                                <div className="preview-phone-col">
                                    <div className="wa-phone-container">
                                        {/* Phone Notch/Status */}
                                        <div className="wa-phone-status-bar">
                                            <span>09:41</span>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <span>📶</span>
                                                <span>🔋</span>
                                            </div>
                                        </div>

                                        {/* WhatsApp App Bar */}
                                        <div className="wa-phone-app-bar">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '16px', color: '#ffffff' }}>←</span>
                                                <div className="wa-app-avatar">🏢</div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', lineHeight: 1.2 }}>Official Account</div>
                                                    <div style={{ fontSize: '10px', color: '#dcfce7' }}>WhatsApp Verified Business</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chat Wallpaper Area */}
                                        <div className="wa-phone-chat-body">
                                            <div className="wa-chat-date-pill">TODAY</div>

                                            <div className="wa-received-msg-wrapper">
                                                <div className="wa-msg-bubble">
                                                    {/* Media Header (Image / Video / Document) */}
                                                    {(() => {
                                                        // A Carousel template CANNOT have a top-level media header!
                                                        const isCarousel = String(previewTemplate.template_type || '').toUpperCase() === 'CAROUSEL' ||
                                                            (Array.isArray(previewTemplate.cards) && previewTemplate.cards.length > 0) ||
                                                            (previewTemplate.meta_response?.components || []).some(c => (c.type || '').toUpperCase() === 'CAROUSEL');
                                                        if (isCarousel) return null;

                                                        // Compute effective header URL from all available sources
                                                        let effectiveHeaderUrl = previewTemplate.header_media_url || previewTemplate.headerMediaUrl || previewTemplate.media_url || previewTemplate.sampleMedia || null;
                                                        let effectiveMediaType = previewTemplate.media_type || 'image';
                                                        let isOpaqueHandle = false;

                                                        const comps = previewTemplate.meta_response?.components || previewTemplate.components || [];
                                                        if (comps.length > 0) {
                                                            const hComp = comps.find(c => (c.type || '').toUpperCase() === 'HEADER');
                                                            if (hComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((hComp.format || '').toUpperCase())) {
                                                                const exHandle = hComp.example?.header_handle?.[0];
                                                                const exUrl    = hComp.example?.header_url?.[0];
                                                                const fmt = (hComp.format || '').toLowerCase();
                                                                if (fmt === 'video') effectiveMediaType = 'video';
                                                                else if (fmt === 'document') effectiveMediaType = 'document';
                                                                else effectiveMediaType = 'image';

                                                                if (!effectiveHeaderUrl) {
                                                                    if (exHandle && typeof exHandle === 'string' && exHandle.startsWith('http')) {
                                                                        effectiveHeaderUrl = exHandle;
                                                                    } else if (exUrl && typeof exUrl === 'string' && exUrl.startsWith('http')) {
                                                                        effectiveHeaderUrl = exUrl;
                                                                    } else if (hComp.media_url) {
                                                                        effectiveHeaderUrl = hComp.media_url;
                                                                    } else if (exHandle && typeof exHandle === 'string') {
                                                                        isOpaqueHandle = true;
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        const resolvedSrc = effectiveHeaderUrl ? getImageUrl(effectiveHeaderUrl) : null;
                                                        const isVideo = effectiveMediaType === 'video' || (effectiveHeaderUrl && (String(effectiveHeaderUrl).includes('.mp4') || String(effectiveHeaderUrl).includes('.webm') || String(effectiveHeaderUrl).startsWith('data:video')));

                                                        if (!resolvedSrc && !isOpaqueHandle) return null;

                                                        return (
                                                            <div className="wa-msg-media-box" style={{ marginBottom: '8px', borderRadius: '6px', overflow: 'hidden' }}>
                                                                {isOpaqueHandle ? (
                                                                    // Can't display opaque Meta handle directly — show a placeholder
                                                                    <div style={{ width: '100%', height: '120px', background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2142 100%)', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                        <span style={{ fontSize: '28px' }}>{effectiveMediaType === 'video' ? '🎬' : effectiveMediaType === 'document' ? '📄' : '🖼️'}</span>
                                                                        <span style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', padding: '0 8px' }}>{effectiveMediaType === 'document' ? 'Document' : `Header ${effectiveMediaType}`} (Meta-managed media)</span>
                                                                    </div>
                                                                ) : isVideo ? (
                                                                    <video src={resolvedSrc} controls style={{ width: '100%', borderRadius: '6px', maxHeight: '160px', objectFit: 'cover' }} />
                                                                ) : effectiveMediaType === 'document' ? (
                                                                    <div className="wa-msg-doc-pill">📄 Document.pdf</div>
                                                                ) : (
                                                                    <img
                                                                        src={resolvedSrc}
                                                                        alt="Header Media"
                                                                        style={{ width: '100%', borderRadius: '6px', maxHeight: '160px', objectFit: 'cover' }}
                                                                        onError={(e) => {
                                                                            // On image load failure, show placeholder instead of blank
                                                                            e.target.parentNode.innerHTML = '<div style="width:100%;height:120px;background:linear-gradient(135deg,#1e3a5f 0%,#0f2142 100%);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px"><span style=\'font-size:28px\'>🖼️</span><span style=\'font-size:10px;color:#94a3b8;text-align:center\'>Header image (could not load)</span></div>';
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Carousel Cards (If Carousel Template) */}
                                                    {Array.isArray(previewTemplate.cards) && previewTemplate.cards.length > 0 && (
                                                        <div className="wa-msg-carousel-slider" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 0', marginTop: '6px', scrollbarWidth: 'thin' }}>
                                                            {previewTemplate.cards.map((card, cIdx) => {
                                                                const cardHeader = card.components?.find(c => (c.type || '').toUpperCase() === 'HEADER');
                                                                const cardButtonsComponent = card.components?.find(c => (c.type || '').toUpperCase() === 'BUTTONS');
                                                                const cardButtons = Array.isArray(card.buttons) && card.buttons.length > 0
                                                                    ? card.buttons
                                                                    : (cardButtonsComponent?.buttons || []);
                                                                const rawCardMedia = card.headerMedia || card.media_url || card.mediaUrl || card.previewUrl || card.mediaBase64 || cardHeader?.example?.header_handle?.[0];
                                                                const cardMediaUrl = rawCardMedia ? getImageUrl(rawCardMedia) : null;
                                                                const isCardVideo = (cardHeader?.format || '').toUpperCase() === 'VIDEO' || card.mediaType === 'video' || (cardMediaUrl && (String(cardMediaUrl).includes('.mp4') || String(cardMediaUrl).includes('.webm') || String(cardMediaUrl).startsWith('data:video')));

                                                                return (
                                                                    <div key={cIdx} className="wa-carousel-single-card" style={{ minWidth: '130px', maxWidth: '140px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px', fontSize: '11px', flexShrink: 0 }}>
                                                                        <div className="wa-carousel-card-img" style={{ height: '65px', background: '#0f172a', borderRadius: '4px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                                                            {cardMediaUrl ? (
                                                                                isCardVideo ? (
                                                                                    <video src={cardMediaUrl} controls muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                ) : (
                                                                                    <img src={cardMediaUrl} alt={`Card ${cIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                                                                )
                                                                            ) : (
                                                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{isCardVideo ? `🎬 Card #${cIdx + 1}` : `🖼 Card #${cIdx + 1}`}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="wa-carousel-card-body" style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {card.body || card.components?.find(c => (c.type || '').toUpperCase() === 'BODY')?.text || `Card ${cIdx + 1}`}
                                                                        </div>
                                                                        {cardButtons.map((button, buttonIdx) => (
                                                                            <div
                                                                                key={buttonIdx}
                                                                                style={{
                                                                                    borderTop: '1px solid #dbeafe',
                                                                                    color: '#0284c7',
                                                                                    fontWeight: 600,
                                                                                    textAlign: 'center',
                                                                                    padding: '5px 2px 1px',
                                                                                    marginTop: buttonIdx === 0 ? '3px' : '4px',
                                                                                    whiteSpace: 'nowrap',
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis'
                                                                                }}
                                                                            >
                                                                                {button.type === 'PHONE_NUMBER' || button.type === 'CALL_TO_ACTION' ? '☎ ' : button.type === 'URL' || button.type === 'URL_LINK' ? '↗ ' : '💬 '}
                                                                                {button.text || `Button ${buttonIdx + 1}`}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Body Message */}
                                                    <div
                                                        className="wa-msg-body-content"
                                                        dangerouslySetInnerHTML={{ __html: renderFormattedMessage(previewTemplate.message) }}
                                                    />

                                                    {/* Footer Text */}
                                                    {previewTemplate.footer && (
                                                        <div className="wa-msg-footer-content">{previewTemplate.footer}</div>
                                                    )}

                                                    {/* Timestamp */}
                                                    <div className="wa-msg-timestamp-row">
                                                        <span>10:26 AM</span>
                                                        <span style={{ color: '#53bdeb', marginLeft: '3px' }}>✓✓</span>
                                                    </div>
                                                </div>

                                                {/* Action / Quick Reply Buttons */}
                                                {Array.isArray(previewTemplate.buttons) && previewTemplate.buttons.length > 0 && (
                                                    <div className="wa-msg-buttons-container">
                                                        {previewTemplate.buttons.map((b, bIdx) => (
                                                            <div key={bIdx} className="wa-msg-btn-pill">
                                                                {b.type === 'CALL_TO_ACTION' || b.type === 'PHONE_NUMBER' ? (
                                                                    <span>📞 {b.text || 'Call Us'}</span>
                                                                ) : b.type === 'URL_LINK' || b.type === 'URL' ? (
                                                                    <span>🔗 {b.text || 'Visit Website'}</span>
                                                                ) : b.type === 'COPY_CODE' ? (
                                                                    <span>📋 Copy Code: {b.couponCode || 'SAVE50'}</span>
                                                                ) : (
                                                                    <span>💬 {b.text || 'Quick Reply'}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer-add" style={{ justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>ID: {previewTemplate.id} • Category: {previewTemplate.category}</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn-modal-save"
                                        style={{ background: '#0284c7' }}
                                        onClick={() => {
                                            setShowPreviewModal(false);
                                            navigate(`/template/manage/edit/${previewTemplate.id}`);
                                        }}
                                    >
                                        ✏️ Edit Template
                                    </button>
                                    <button className="btn-modal-cancel" onClick={() => setShowPreviewModal(false)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
