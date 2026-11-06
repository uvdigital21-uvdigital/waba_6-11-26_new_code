import React, { useState } from 'react'

export default function AddTagsModal({ isOpen, onClose, onSave }) {
    const [tagName, setTagName] = useState('')
    const [tagColor, setTagColor] = useState('#1abc9c')

    if (!isOpen) return null

    const handleSave = () => {
        if (tagName.trim()) {
            onSave({ name: tagName, color: tagColor })
            setTagName('')
            setTagColor('#1abc9c')
            onClose()
        }
    }

    const handleDiscard = () => {
        setTagName('')
        setTagColor('#1abc9c')
        onClose()
    }

    return (
        <div className="add-tags-modal-overlay" onClick={onClose}>
            <div className="add-tags-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="add-tags-modal-header">
                    <h2>Add Tags</h2>
                </div>

                {/* Modal Body */}
                <div className="add-tags-modal-body">
                    <div className="add-tags-field">
                        <label>
                            Tags: <span className="warning-text">(Special Characters are not allowed like $,%,@..)</span>
                        </label>
                        <input
                            type="text"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                            placeholder="enter tag"
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

                {/* Modal Footer */}
                <div className="add-tags-modal-footer">
                    <button className="btn-discard" onClick={handleDiscard}>
                        Discard
                    </button>
                    <button className="btn-save-tags" onClick={handleSave}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}