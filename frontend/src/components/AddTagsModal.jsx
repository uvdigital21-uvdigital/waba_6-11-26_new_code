import React, { useState, useEffect } from 'react'
import { createTag } from '../services/tagService.js'

export default function AddTagsModal({ isOpen, onClose, onSave }) {
    const [tagName, setTagName] = useState('')
    const [tagColor, setTagColor] = useState('#4d8ef0')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            setTagName('')
            setTagColor('#4d8ef0')
            setError('')
            setSaving(false)
        }
    }, [isOpen])

    if (!isOpen) return null

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
            const data = await createTag({ name: cleanedName, color: tagColor })

            onSave?.({ name: cleanedName, color: tagColor, ...data.tag })
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDiscard = () => {
        setTagName('')
        setTagColor('#4d8ef0')
        setError('')
        onClose()
    }

    return (
        <div className="add-tags-modal-overlay" onClick={handleDiscard}>
            <div className="add-tags-modal" onClick={(e) => e.stopPropagation()}>
                <div className="add-tags-modal-header">
                    <h2>Create Tag</h2>
                    <p>Add a new tag that will be available in chats and future modules.</p>
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
                        <input
                            type="color"
                            value={tagColor}
                            onChange={(e) => setTagColor(e.target.value)}
                            className="add-tags-color-picker"
                        />
                    </div>
                </div>

                <div className="add-tags-modal-footer">
                    <button className="btn-discard" onClick={handleDiscard}>
                        Cancel
                    </button>
                    <button className="btn-save-tags" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}