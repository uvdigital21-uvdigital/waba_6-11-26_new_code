import React, { useState } from 'react'
import api from '../services/api.js'
import * as XLSX from 'xlsx'

export default function CreateGroupModal({ isOpen, onClose, onSave }) {
    const [groupName, setGroupName] = useState('')
    const [numbersText, setNumbersText] = useState('')
    const [fileName, setFileName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)

    if (!isOpen) return null

    // Calculate parsed number count
    const parseNumbers = () => {
        if (!numbersText.trim()) return []
        const rawList = numbersText.split(/[\n,;\s]+/)
        const valid = []
        const seen = new Set()
        rawList.forEach(item => {
            const str = String(item).trim()
            if (!str || /[a-zA-Z]/.test(str)) return
            let digits = str.replace(/[^0-9]/g, '')
            if (digits.length === 11 && digits.startsWith('0')) {
                digits = digits.slice(1)
            }
            if (digits.length >= 7 && digits.length <= 15 && !seen.has(digits)) {
                seen.add(digits)
                valid.push(digits)
            }
        })
        return valid
    }

    const numbersList = parseNumbers()

    const handleFileUpload = (e) => {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        setFileName(file.name)

        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result)
                const workbook = XLSX.read(data, { type: 'array' })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

                const extracted = []
                rawRows.forEach(row => {
                    if (Array.isArray(row)) {
                        row.forEach(cell => {
                            const val = String(cell).trim()
                            if (val && !/[a-zA-Z]/.test(val)) {
                                const digits = val.replace(/[^0-9]/g, '')
                                if (digits.length >= 7 && digits.length <= 15) {
                                    extracted.push(digits)
                                }
                            }
                        })
                    }
                })

                if (extracted.length > 0) {
                    const combinedText = numbersText
                        ? `${numbersText}\n${extracted.join('\n')}`
                        : extracted.join('\n')
                    setNumbersText(combinedText)
                }
            } catch (err) {
                console.error('File read error:', err)
                setErrorMsg('Failed to parse file numbers.')
            }
        }
        reader.readAsArrayBuffer(file)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setErrorMsg(null)

        if (!groupName.trim()) {
            setErrorMsg('Please enter a group name.')
            return
        }

        if (numbersList.length === 0) {
            setErrorMsg('Please enter or upload at least one valid phone number.')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await api.post('/groups', {
                name: groupName.trim(),
                numbers: numbersList
            })

            if (onSave) {
                onSave(response.data.group)
            }
            handleDiscard()
        } catch (err) {
            console.error('Create group failed:', err)
            setErrorMsg(err.response?.data?.message || 'Failed to create group in database.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDiscard = () => {
        setGroupName('')
        setNumbersText('')
        setFileName('')
        setErrorMsg(null)
        onClose()
    }

    return (
        <div className="preview-modal-overlay" onClick={handleDiscard} style={{ zIndex: 1100 }}>
            <div className="preview-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '24px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                        👥 Add New Contact Group
                    </h2>
                    <button type="button" onClick={handleDiscard} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>×</button>
                </div>

                <form onSubmit={handleSave}>
                    {errorMsg && (
                        <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                            ⚠️ {errorMsg}
                        </div>
                    )}

                    {/* Group Name */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>
                            Group Name: <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="e.g. VIP Customers, Marketing Leads..."
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                            required
                        />
                    </div>

                    {/* Numbers Textarea */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                Mobile Numbers: <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '12px' }}>
                                {numbersList.length} Valid Number(s) Ready
                            </span>
                        </div>
                        <textarea
                            value={numbersText}
                            onChange={(e) => setNumbersText(e.target.value)}
                            placeholder="Paste mobile numbers here (separated by newlines or commas)&#10;e.g.&#10;9913847423&#10;9925323735"
                            rows={6}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical' }}
                        />
                    </div>

                    {/* File Upload Shortcut */}
                    <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '6px', textAlign: 'center' }}>
                        <label htmlFor="group-file-upload" style={{ cursor: 'pointer', fontSize: '13px', color: '#4f46e5', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            📁 Or Upload Numbers from CSV / Excel File
                        </label>
                        <input
                            type="file"
                            id="group-file-upload"
                            accept=".csv,.xls,.xlsx"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        {fileName && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#10b981' }}>
                                Loaded from file: {fileName}
                            </p>
                        )}
                    </div>

                    {/* Footer buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={handleDiscard}
                            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                        >
                            {isSubmitting ? 'Saving to DB...' : 'Save Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}