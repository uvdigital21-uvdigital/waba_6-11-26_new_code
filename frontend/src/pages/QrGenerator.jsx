import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import './QrGenerator.css'

export default function QrGenerator() {
    const { setTitle } = useTitle()

    // Initialize list from local storage
    const [qrList, setQrList] = useState(() => {
        const saved = localStorage.getItem('wa_qr_list')
        return saved ? JSON.parse(saved) : []
    })

    useEffect(() => {
        setTitle('Tiny QR Generator')
    }, [setTitle])

    // Save to localStorage when list changes
    useEffect(() => {
        localStorage.setItem('wa_qr_list', JSON.stringify(qrList))
    }, [qrList])

    // Modal Visibility States
    const [showQrModal, setShowQrModal] = useState(false)
    const [showWappModal, setShowWappModal] = useState(false)
    const [previewImage, setPreviewImage] = useState(null) // for showing larger QR preview

    // Form inputs states
    const [longUrl, setLongUrl] = useState('')
    const [mobileNumber, setMobileNumber] = useState('')
    const [wappMessage, setWappMessage] = useState('')

    // Table view states
    const [entriesCount, setEntriesCount] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)
    const [expandedRows, setExpandedRows] = useState({})
    const [copiedId, setCopiedId] = useState(null)

    // Form handlers
    const handleSaveStandardQr = (e) => {
        e.preventDefault()
        if (!longUrl) return

        const shortId = Math.random().toString(36).substring(2, 7)
        const mockShortUrl = `${window.location.origin}/r/${shortId}`
        
        // Generate QR code URL using a public qr server API
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(longUrl)}`

        const newQr = {
            id: Date.now(),
            shortUrl: mockShortUrl,
            originalUrl: longUrl,
            type: 'url',
            qrImage: qrImgUrl,
            createdOn: new Date().toLocaleString(),
            hits: 0
        }

        setQrList([newQr, ...qrList])
        setLongUrl('')
        setShowQrModal(false)
    }

    const handleSaveWappQr = (e) => {
        e.preventDefault()
        if (!mobileNumber) return

        // Format clean mobile link
        const cleanMobile = mobileNumber.replace(/\D/g, '')
        const waLink = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(wappMessage)}`
        
        const shortId = Math.random().toString(36).substring(2, 7)
        const mockShortUrl = `${window.location.origin}/r/${shortId}`
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(waLink)}`

        const newQr = {
            id: Date.now(),
            shortUrl: mockShortUrl,
            originalUrl: waLink,
            mobile: mobileNumber,
            message: wappMessage,
            type: 'wapp',
            qrImage: qrImgUrl,
            createdOn: new Date().toLocaleString(),
            hits: 0
        }

        setQrList([newQr, ...qrList])
        setMobileNumber('')
        setWappMessage('')
        setShowWappModal(false)
    }

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this QR Code?')) {
            setQrList(qrList.filter(item => item.id !== id))
        }
    }

    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
        })
    }

    // Pagination math
    const totalEntries = qrList.length
    const startIndex = (currentPage - 1) * entriesCount
    const endIndex = Math.min(startIndex + entriesCount, totalEntries)
    const paginatedList = qrList.slice(startIndex, endIndex)
    const totalPages = Math.ceil(totalEntries / entriesCount)

    return (
        <div className="qr-generator-page">
            <div className="qr-generator-card">
                {/* Header */}
                <div className="qr-header-row">
                    <div className="qr-header-left">
                        <div className="qr-device-icon-wrapper">
                            {/* Device Icon */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
                            </svg>
                            <span className="qr-plus-badge">+</span>
                        </div>
                        <h1 className="qr-header-title">Tiny QR Generator</h1>
                    </div>
                    <div className="qr-header-actions">
                        <button className="btn-generate-qr" onClick={() => setShowQrModal(true)}>
                            Generate QR
                        </button>
                        <button className="btn-generate-wapp-qr" onClick={() => setShowWappModal(true)}>
                            Generate WAPP Qr
                        </button>
                    </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="qr-controls-bar">
                    <div className="qr-entries-select">
                        Show 
                        <select 
                            value={entriesCount} 
                            onChange={(e) => {
                                setEntriesCount(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        entries
                    </div>
                    <div className="qr-date-badge">
                        July 7, 2025 - July 7, 2026
                    </div>
                </div>

                {/* Listing Table */}
                <div className="qr-table-container">
                    <table className="qr-data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>+</th>
                                <th>Short URL</th>
                                <th>Type</th>
                                <th>QR Image</th>
                                <th>Created On</th>
                                <th>Total Hits</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="qr-empty-row">No data available in table</td>
                                </tr>
                            ) : (
                                paginatedList.map((item) => (
                                    <React.Fragment key={item.id}>
                                        <tr>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    type="button" 
                                                    className="qr-expander-btn"
                                                    onClick={() => toggleRow(item.id)}
                                                >
                                                    {expandedRows[item.id] ? '−' : '+'}
                                                </button>
                                            </td>
                                            <td>
                                                <div className="qr-shorturl-cell">
                                                    <span>{item.shortUrl}</span>
                                                    <button 
                                                        className="qr-copy-btn" 
                                                        title="Copy URL"
                                                        onClick={() => copyToClipboard(item.shortUrl, item.id)}
                                                    >
                                                        {copiedId === item.id ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a085" strokeWidth="2.5">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        ) : (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`qr-type-badge ${item.type === 'url' ? 'type-url' : 'type-wapp'}`}>
                                                    {item.type === 'url' ? 'URL' : 'WAPP'}
                                                </span>
                                            </td>
                                            <td>
                                                <img 
                                                    src={item.qrImage} 
                                                    alt="QR code thumbnail" 
                                                    className="qr-thumbnail-img"
                                                    onClick={() => setPreviewImage(item)}
                                                />
                                            </td>
                                            <td>{item.createdOn}</td>
                                            <td>{item.hits}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    type="button" 
                                                    className="btn-delete-qr"
                                                    onClick={() => handleDelete(item.id)}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedRows[item.id] && (
                                            <tr className="qr-detail-row-expanded">
                                                <td colSpan="7">
                                                    <div className="qr-detail-expanded-card">
                                                        <div className="qr-detail-expanded-item">
                                                            <strong>Original URL: </strong> 
                                                            <a href={item.originalUrl} target="_blank" rel="noopener noreferrer">
                                                                {item.originalUrl}
                                                            </a>
                                                        </div>
                                                        {item.type === 'wapp' && (
                                                            <>
                                                                <div className="qr-detail-expanded-item">
                                                                    <strong>Mobile Number: </strong> {item.mobile}
                                                                </div>
                                                                <div className="qr-detail-expanded-item">
                                                                    <strong>Message: </strong> {item.message}
                                                                </div>
                                                            </>
                                                        )}
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

                {/* Table Footer Pagination */}
                <div className="qr-table-footer">
                    <div className="qr-showing-entries">
                        Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of {totalEntries} entries
                    </div>
                    <div className="qr-pagination">
                        <button 
                            className="btn-qr-pag" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            Previous
                        </button>
                        <button 
                            className="btn-qr-pag" 
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal 1: Generate QR (Long URL) */}
            {showQrModal && (
                <div className="qr-modal-overlay">
                    <div className="qr-modal-card">
                        <div className="qr-modal-header">
                            <h3 className="qr-modal-title">Generate QR Code</h3>
                        </div>
                        <form onSubmit={handleSaveStandardQr}>
                            <div className="qr-modal-body">
                                <div className="qr-form-group">
                                    <label className="qr-form-label">Enter Long Url</label>
                                    <textarea
                                        className="qr-form-textarea"
                                        placeholder="ex : http://xyz.com"
                                        value={longUrl}
                                        onChange={(e) => setLongUrl(e.target.value)}
                                        rows="4"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="qr-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn-qr-modal-discard"
                                    onClick={() => {
                                        setLongUrl('')
                                        setShowQrModal(false)
                                    }}
                                >
                                    Discard
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-qr-modal-save"
                                    disabled={!longUrl}
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Generate WAPP QR */}
            {showWappModal && (
                <div className="qr-modal-overlay">
                    <div className="qr-modal-card">
                        <div className="qr-modal-header">
                            <h3 className="qr-modal-title">Generate QR Code</h3>
                        </div>
                        <form onSubmit={handleSaveWappQr}>
                            <div className="qr-modal-body">
                                <div className="qr-form-group">
                                    <label className="qr-form-label">Enter Mobile</label>
                                    <input
                                        type="text"
                                        className="qr-form-input"
                                        placeholder="enter mobile"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        required
                                    />
                                    <span className="qr-form-warning">Note - Enter Mobile number with Your Country Code</span>
                                </div>
                                <div className="qr-form-group">
                                    <label className="qr-form-label">Message</label>
                                    <textarea
                                        className="qr-form-textarea"
                                        placeholder="enter message"
                                        value={wappMessage}
                                        onChange={(e) => setWappMessage(e.target.value)}
                                        rows="4"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="qr-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn-qr-modal-discard"
                                    onClick={() => {
                                        setMobileNumber('')
                                        setWappMessage('')
                                        setShowWappModal(false)
                                    }}
                                >
                                    Discard
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-qr-modal-save"
                                    disabled={!mobileNumber || !wappMessage}
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Preview Modal (Detail View) */}
            {previewImage && (
                <div className="qr-modal-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="qr-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="qr-modal-title">QR Code Preview</h3>
                            <button 
                                type="button" 
                                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
                                onClick={() => setPreviewImage(null)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="qr-modal-body" style={{ textAlign: 'center' }}>
                            <img 
                                src={previewImage.qrImage} 
                                alt="QR code full view" 
                                className="qr-preview-img-large"
                            />
                            <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
                                <div style={{ wordBreak: 'break-all', marginBottom: '8px' }}>
                                    <strong>Original URL: </strong> 
                                    <a href={previewImage.originalUrl} target="_blank" rel="noopener noreferrer">
                                        {previewImage.originalUrl}
                                    </a>
                                </div>
                                <a 
                                    href={previewImage.qrImage} 
                                    download={`qr_${previewImage.id}.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        backgroundColor: '#1abc9c',
                                        color: '#ffffff',
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        fontWeight: '600',
                                        marginTop: '8px'
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                    </svg>
                                    Download Image
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}