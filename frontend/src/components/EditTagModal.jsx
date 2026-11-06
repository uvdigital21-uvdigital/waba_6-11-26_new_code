import React, { useState, useEffect } from 'react'
import { updateTag } from '../services/tagService.js'

export default function EditTagModal({ isOpen, tag, onClose, onSave }) {
    const [tagName, setTagName] = useState('')
    const [tagColor, setTagColor] = useState('#4d8ef0')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen && tag) {
            setTagName(tag.name || tag.tagName || '')
            setTagColor(tag.color || tag.tagColor || '#4d8ef0')
            setError('')
            setSaving(false)
        }
    }, [isOpen, tag])

    if (!isOpen || !tag) return null

    const handleSave = async () => {
        const trimmedName = tagName.trim()
        if (!trimmedName) {
            setError('Tag name is required.')
            return
        }

        const cleanedName = trimmedName.replace(/[$%@!#^&*()_+=\-\[\]{};':"\\|,.<>/?]/g, '')
        if (!cleanedName) {
            setError('Tag name contains only invalid characters.')
            return
        }

        setSaving(true)
        setError('')

        try {
            const data = await updateTag(tag.id, { name: cleanedName, color: tagColor })
            onSave?.({ ...tag, name: cleanedName, color: tagColor, ...(data?.tag || {}) })
            onClose()
        } catch (err) {
            setError(err.message || 'Failed to update tag.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="add-tags-modal-overlay" onClick={onClose}>
            <div className="add-tags-modal" onClick={(e) => e.stopPropagation()}>
                <div className="add-tags-modal-header">
                    <h2>Edit Tag</h2>
                    <p>Update tag name and color theme.</p>
                </div>

                <div className="add-tags-modal-body">
                    {error && <div className="error-banner">{error}</div>}
                    <div className="add-tags-field">
                        <label>
                            Tag Name <span className="warning-text">(Letters, numbers, and spaces only)</span>
                        </label>
                        <input
                            type="text"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                            placeholder="Enter tag name"
                            className="add-tags-input"
                            autoFocus
                        />
                    </div>

                    <div className="add-tags-field">
                        <label>Tag Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="color"
                                value={tagColor}
                                onChange={(e) => setTagColor(e.target.value)}
                                className="add-tags-color-picker"
                            />
                            <span style={{ 
                                display: 'inline-block', 
                                padding: '4px 10px', 
                                borderRadius: '6px', 
                                backgroundColor: tagColor, 
                                color: '#fff', 
                                fontWeight: '600',
                                fontSize: '12px' 
                            }}>
                                {tagName || 'Preview'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="add-tags-modal-footer">
                    <button className="btn-discard" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button className="btn-save-tags" onClick={handleSave} disabled={saving}>
                        {saving ? 'Updating…' : 'Update Tag'}
                    </button>
                </div>
            </div>
        </div>
    )
}
