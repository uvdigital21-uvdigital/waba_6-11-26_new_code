import React, { useState } from 'react'

export default function EditKeysModal({ isOpen, onClose }) {
    const [keys, setKeys] = useState([])
    const [selectedKeyId, setSelectedKeyId] = useState(null)

    if (!isOpen) return null

    const handleAddNewKey = () => {
        const newKey = {
            id: Date.now(),
            name: ''
        }
        setKeys([...keys, newKey])
    }

    const handleKeyNameChange = (keyId, newName) => {
        setKeys(keys.map(key =>
            key.id === keyId
                ? { ...key, name: newName }
                : key
        ))
    }

    const handleDeleteKey = (keyId) => {
        setKeys(keys.filter(key => key.id !== keyId))
        if (selectedKeyId === keyId) {
            setSelectedKeyId(null)
        }
    }

    const handleEditKey = () => {
        if (selectedKeyId) {
            const keyToEdit = keys.find(key => key.id === selectedKeyId)
            if (keyToEdit) {
                const newName = prompt('Edit key name:', keyToEdit.name)
                if (newName && newName.trim()) {
                    setKeys(keys.map(key =>
                        key.id === selectedKeyId
                            ? { ...key, name: newName.trim() }
                            : key
                    ))
                }
            }
        }
    }

    const handleClose = () => {
        setKeys([])
        setSelectedKeyId(null)
        onClose()
    }

    return (
        <div className="edit-keys-modal-overlay" onClick={onClose}>
            <div className="edit-keys-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="edit-keys-modal-header">
                    <h2>Edit UserNumbers Keys</h2>
                    <button className="btn-close-keys" onClick={handleClose}>
                        Close
                    </button>
                </div>

                {/* Modal Body */}
                <div className="edit-keys-modal-body">
                    <button className="btn-add-new-key" onClick={handleAddNewKey}>
                        Add New Key
                    </button>

                    {keys.length > 0 && (
                        <div className="keys-list">
                            {keys.map((key) => (
                                <div
                                    key={key.id}
                                    className={`key-item ${selectedKeyId === key.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedKeyId(key.id)}
                                >
                                    <input
                                        type="text"
                                        value={key.name}
                                        onChange={(e) => handleKeyNameChange(key.id, e.target.value)}
                                        placeholder="Enter key"
                                        className="keys-input"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                        className="btn-delete-key"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteKey(key.id)
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="edit-keys-modal-footer">
                    <button className="btn-edit-key" onClick={handleEditKey}>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    )
}