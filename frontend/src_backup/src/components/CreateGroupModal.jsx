import React, { useState } from 'react'

export default function CreateGroupModal({ isOpen, onClose, onSave }) {
    const [groupName, setGroupName] = useState('')
    const [selectedFields, setSelectedFields] = useState({
        number: true,
        name: false,
        email: false
    })

    const handleFieldChange = (field) => {
        setSelectedFields({
            ...selectedFields,
            [field]: !selectedFields[field]
        })
    }

    const handleSave = (e) => {
        e.preventDefault()
        if (groupName.trim()) {
            const selectedFieldsList = Object.keys(selectedFields).filter(
                field => selectedFields[field]
            )
            onSave({
                name: groupName,
                fields: selectedFieldsList
            })
            setGroupName('')
            setSelectedFields({
                number: true,
                name: false,
                email: false
            })
            onClose()
        }
    }

    const handleDiscard = () => {
        setGroupName('')
        setSelectedFields({
            number: true,
            name: false,
            email: false
        })
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="create-group-overlay" onClick={onClose}>
            <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
                <div className="create-group-header">
                    <h2>Create Group</h2>
                </div>

                <form onSubmit={handleSave}>
                    <div className="create-group-body">
                        {/* Group Name Field */}
                        <div className="form-group-create">
                            <label className="label-create">Group Name:</label>
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="eg, abc_123, abc, 123_abc, etc ..."
                                className="input-create"
                                required
                            />
                        </div>

                        {/* Select Fields */}
                        <div className="form-group-create">
                            <label className="label-create">Select Fields:</label>
                            <div className="fields-checkbox-group">
                                <label className="checkbox-label-create">
                                    <input
                                        type="checkbox"
                                        checked={selectedFields.number}
                                        onChange={() => handleFieldChange('number')}
                                    />
                                    <span>Number</span>
                                </label>
                                <label className="checkbox-label-create">
                                    <input
                                        type="checkbox"
                                        checked={selectedFields.name}
                                        onChange={() => handleFieldChange('name')}
                                    />
                                    <span>Name</span>
                                </label>
                                <label className="checkbox-label-create">
                                    <input
                                        type="checkbox"
                                        checked={selectedFields.email}
                                        onChange={() => handleFieldChange('email')}
                                    />
                                    <span>Email</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="create-group-footer">
                        <button
                            type="button"
                            className="btn-discard"
                            onClick={handleDiscard}
                        >
                            Discard
                        </button>
                        <button
                            type="submit"
                            className="btn-save"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}