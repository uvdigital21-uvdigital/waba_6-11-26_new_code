import React, { useState, useEffect, useCallback } from 'react'
import { getTagContacts, assignTagToPhone, unassignTagFromPhone } from '../services/tagService.js'

export default function ViewTagModal({ isOpen, tag, onClose, onTagUpdated }) {
    const [loading, setLoading] = useState(false)
    const [contacts, setContacts] = useState([])
    const [numbers, setNumbers] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [addingPhone, setAddingPhone] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [copied, setCopied] = useState(false)

    const fetchContacts = useCallback(async () => {
        if (!tag?.id) return
        setLoading(true)
        setError('')
        try {
            const data = await getTagContacts(tag.id)
            setContacts(data.contacts || [])
            setNumbers(data.numbers || [])
        } catch (err) {
            setError(err.message || 'Failed to load tag contacts')
            setContacts([])
            setNumbers([])
        } finally {
            setLoading(false)
        }
    }, [tag?.id])

    useEffect(() => {
        if (isOpen && tag?.id) {
            fetchContacts()
            setSearchQuery('')
            setNewPhone('')
            setError('')
            setSuccess('')
            setCurrentPage(1)
            setCopied(false)
        }
    }, [isOpen, tag?.id, fetchContacts])

    if (!isOpen || !tag) return null

    const handleAddPhone = async (e) => {
        e?.preventDefault()
        const cleanPhone = (newPhone || '').replace(/\D/g, '').trim()
        if (!cleanPhone || cleanPhone.length < 8) {
            setError('Please enter a valid phone number (with country code, e.g. 919876543210)')
            return
        }

        setAddingPhone(true)
        setError('')
        setSuccess('')
        try {
            await assignTagToPhone(tag.id, cleanPhone)
            setSuccess(`Number ${cleanPhone} added to tag successfully!`)
            setNewPhone('')
            await fetchContacts()
            onTagUpdated?.()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message || 'Failed to assign tag to number')
        } finally {
            setAddingPhone(false)
        }
    }

    const handleRemovePhone = async (phone) => {
        if (!window.confirm(`Are you sure you want to remove ${phone} from tag "${tag.name}"?`)) return
        setActionLoading(true)
        setError('')
        setSuccess('')
        try {
            await unassignTagFromPhone(tag.id, phone)
            setSuccess(`Number ${phone} removed from tag`)
            await fetchContacts()
            onTagUpdated?.()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.message || 'Failed to remove number from tag')
        } finally {
            setActionLoading(false)
        }
    }

    const handleCopyAllNumbers = () => {
        if (!numbers || numbers.length === 0) return
        const text = numbers.join(', ')
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
        })
    }

    // Filter contacts based on search query
    const filteredContacts = contacts.filter((c) => {
        const q = searchQuery.toLowerCase().trim()
        if (!q) return true
        return (
            (c.phoneNumber && c.phoneNumber.toLowerCase().includes(q)) ||
            (c.contactName && c.contactName.toLowerCase().includes(q)) ||
            (c.source && c.source.toLowerCase().includes(q))
        )
    })

    const totalFiltered = filteredContacts.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / entriesPerPage))
    const startIdx = (currentPage - 1) * entriesPerPage
    const paginatedContacts = filteredContacts.slice(startIdx, startIdx + entriesPerPage)

    return (
        <div className="add-tags-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div
                className="add-tags-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '780px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div className="add-tags-modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: tag.color || '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '16px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}
                            >
                                🏷️
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Tag: {tag.name}
                                    <span
                                        style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            backgroundColor: '#e0f2fe',
                                            color: '#0369a1'
                                        }}
                                    >
                                        {contacts.length} Numbers
                                    </span>
                                </h2>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                                    View and manage all contact numbers linked to this tag.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '20px',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '6px'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="add-tags-modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {error && <div className="error-banner" style={{ marginBottom: '16px' }}>{error}</div>}
                    {success && <div className="success-banner" style={{ marginBottom: '16px' }}>{success}</div>}

                    {/* Quick Add Number Form */}
                    <form
                        onSubmit={handleAddPhone}
                        style={{
                            display: 'flex',
                            gap: '10px',
                            backgroundColor: '#f8fafc',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            marginBottom: '20px'
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Enter phone number with country code (e.g. 919876543210)..."
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '8px 14px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '13.5px',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={addingPhone || !newPhone.trim()}
                            style={{
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '13.5px',
                                cursor: addingPhone || !newPhone.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: addingPhone || !newPhone.trim() ? 0.6 : 1
                            }}
                        >
                            {addingPhone ? 'Adding...' : '+ Add Number'}
                        </button>
                    </form>

                    {/* Toolbar: Search & Copy */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ position: 'relative', width: '280px' }}>
                            <input
                                type="text"
                                placeholder="Search number or name..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setCurrentPage(1)
                                }}
                                style={{
                                    width: '100%',
                                    padding: '7px 12px 7px 32px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '13px'
                                }}
                            />
                            <span style={{ position: 'absolute', left: '10px', top: '7px', color: '#94a3b8', fontSize: '13px' }}>🔍</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleCopyAllNumbers}
                                disabled={numbers.length === 0}
                                style={{
                                    backgroundColor: copied ? '#059669' : '#f1f5f9',
                                    color: copied ? '#ffffff' : '#334155',
                                    border: '1px solid #cbd5e1',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12.5px',
                                    fontWeight: '600',
                                    cursor: numbers.length === 0 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {copied ? '✓ Copied All!' : `📋 Copy Numbers (${numbers.length})`}
                            </button>
                        </div>
                    </div>

                    {/* Numbers Table */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '10px 14px', width: '50px' }}>#</th>
                                    <th style={{ padding: '10px 14px' }}>Phone Number</th>
                                    <th style={{ padding: '10px 14px' }}>Contact Name</th>
                                    <th style={{ padding: '10px 14px' }}>Source</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '90px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                                            Loading numbers for tag...
                                        </td>
                                    </tr>
                                ) : paginatedContacts.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                                            {searchQuery ? 'No contacts match your search.' : 'No phone numbers currently linked to this tag. Add one above!'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedContacts.map((c, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                                                {startIdx + idx + 1}
                                            </td>
                                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a' }}>
                                                {c.phoneNumber || '-'}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                                                {c.contactName || '-'}
                                            </td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span
                                                    style={{
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: c.source === 'chat' ? '#dcfce7' : '#e0e7ff',
                                                        color: c.source === 'chat' ? '#166534' : '#3730a3'
                                                    }}
                                                >
                                                    {c.source === 'chat' ? '💬 Chat' : '👤 Contact'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleRemovePhone(c.phoneNumber)}
                                                    disabled={actionLoading}
                                                    title="Remove from Tag"
                                                    style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#dc2626',
                                                        border: 'none',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: actionLoading ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '12.5px', color: '#64748b' }}>
                            <span>
                                Showing {Math.min(startIdx + 1, totalFiltered)} to {Math.min(startIdx + entriesPerPage, totalFiltered)} of {totalFiltered} entries
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#fff',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === 1 ? 0.5 : 1
                                    }}
                                >
                                    Prev
                                </button>
                                <span style={{ padding: '4px 10px', fontWeight: '600', color: '#0f172a' }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#fff',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === totalPages ? 0.5 : 1
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="add-tags-modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0' }}>
                    <button className="btn-discard" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
