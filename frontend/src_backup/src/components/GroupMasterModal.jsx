import React, { useState } from 'react'
import CreateGroupModal from './CreateGroupModal.jsx'
import DateRangePicker from './DateRangePicker.jsx'

export default function GroupMasterModal({ isOpen, onClose, onGroupCreated }) {
    const [groupName, setGroupName] = useState('')
    const [groups, setGroups] = useState([
        { id: 1, name: 'Marketing', createdOn: '2024-01-15', total: 150 },
        { id: 2, name: 'Sales', createdOn: '2024-01-20', total: 89 },
        { id: 3, name: 'Support', createdOn: '2024-02-01', total: 45 }
    ])
    const [selectedGroups, setSelectedGroups] = useState([])
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
    const [dateRange, setDateRange] = useState('July 4, 2011 - July 4, 2026')

    const handleCreateGroup = (e) => {
        e.preventDefault()
        if (groupName.trim()) {
            const newGroup = {
                id: Date.now(),
                name: groupName,
                createdOn: new Date().toISOString().split('T')[0],
                total: 0
            }
            setGroups([...groups, newGroup])
            setGroupName('')
            if (onGroupCreated) {
                onGroupCreated(newGroup)
            }
        }
    }

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedGroups(groups.map(g => g.id))
        } else {
            setSelectedGroups([])
        }
    }

    const handleSelectGroup = (id) => {
        if (selectedGroups.includes(id)) {
            setSelectedGroups(selectedGroups.filter(gId => gId !== id))
        } else {
            setSelectedGroups([...selectedGroups, id])
        }
    }

    const handleDeleteSelected = () => {
        if (selectedGroups.length > 0 && window.confirm(`Are you sure you want to delete ${selectedGroups.length} group(s)?`)) {
            setGroups(groups.filter(g => !selectedGroups.includes(g.id)))
            setSelectedGroups([])
        }
    }

    const handleMergeGroups = () => {
        if (selectedGroups.length < 2) {
            alert('Please select at least 2 groups to merge')
            return
        }
        alert(`Merging ${selectedGroups.length} groups`)
        setSelectedGroups([])
    }

    const handleFetchFromWAChannel = () => {
        alert('Fetching groups from WA Channel...')
    }

    const handleOpenCreateGroup = () => {
        setShowCreateGroupModal(true)
    }

    const handleCloseCreateGroup = () => {
        setShowCreateGroupModal(false)
    }

    const handleSaveGroup = (groupData) => {
        const newGroup = {
            id: Date.now(),
            name: groupData.name,
            createdOn: new Date().toISOString().split('T')[0],
            total: 0
        }
        setGroups([...groups, newGroup])
        if (onGroupCreated) {
            onGroupCreated(newGroup)
        }
    }

    const handleDateRangeChange = (newRange) => {
        setDateRange(newRange)
        console.log('Date range changed:', newRange)
    }

    if (!isOpen) return null

    return (
        <div className="group-master-overlay" onClick={onClose}>
            <div className="group-master-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="group-master-header">
                    <div className="group-master-title">
                        <div className="group-master-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </div>
                        <h1>Group Master</h1>
                    </div>
                    <div className="group-master-actions">
                        <button
                            type="button"
                            className="btn-create-group"
                            onClick={handleOpenCreateGroup}
                        >
                            Create Group
                        </button>
                        <button
                            type="button"
                            className="btn-fetch-wa"
                            onClick={handleFetchFromWAChannel}
                        >
                            Fetch from WAChannel
                        </button>
                    </div>
                </div>

                {/* Create Group Form */}
                <form onSubmit={handleCreateGroup} className="create-group-form">
                    <div className="create-group-input-wrapper">
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            className="create-group-input"
                        />
                        <button type="submit" className="btn-create-submit">
                            Create
                        </button>
                    </div>
                </form>

                {/* Table Controls */}
                <div className="group-table-controls">
                    <div className="table-controls-left">
                        <label className="show-entries-label">
                            Show
                            <select className="show-entries-select" defaultValue="10">
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            entries
                        </label>
                    </div>
                    <div className="table-controls-right">
                        <button
                            type="button"
                            className="btn-select-all"
                            onClick={(e) => handleSelectAll(e)}
                        >
                            Select All
                        </button>
                        <button
                            type="button"
                            className="btn-delete"
                            onClick={handleDeleteSelected}
                            disabled={selectedGroups.length === 0}
                        >
                            DELETE
                        </button>
                        <button
                            type="button"
                            className="btn-merge"
                            onClick={handleMergeGroups}
                            disabled={selectedGroups.length < 2}
                        >
                            Merge Group
                        </button>
                        <DateRangePicker
                            value={dateRange}
                            onChange={handleDateRangeChange}
                        />
                    </div>
                </div>

                {/* Groups Table */}
                <div className="group-table-wrapper">
                    <table className="group-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="th-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedGroups.length === groups.length && groups.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="th-group-name">Group Name</th>
                                <th className="th-created-on">Created On</th>
                                <th className="th-total">Total</th>
                                <th className="th-action">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="no-data-cell">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                groups.map(group => (
                                    <tr key={group.id} className="table-data-row">
                                        <td className="td-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(group.id)}
                                                onChange={() => handleSelectGroup(group.id)}
                                            />
                                        </td>
                                        <td className="td-group-name">{group.name}</td>
                                        <td className="td-created-on">{group.createdOn}</td>
                                        <td className="td-total">{group.total}</td>
                                        <td className="td-action">
                                            <div className="action-buttons-group">
                                                <button type="button" className="btn-edit-group">Edit</button>
                                                <button type="button" className="btn-delete-group">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="group-pagination">
                    <div className="pagination-info">
                        Showing {groups.length === 0 ? 0 : 1} to {groups.length} of {groups.length} entries
                    </div>
                    <div className="pagination-buttons">
                        <button type="button" className="btn-pagination" disabled>
                            Previous
                        </button>
                        <button type="button" className="btn-pagination" disabled>
                            Next
                        </button>
                    </div>
                </div>

                {/* Close Button */}
                <button
                    type="button"
                    className="group-master-close-btn"
                    onClick={onClose}
                >
                    ×
                </button>
            </div>

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={showCreateGroupModal}
                onClose={handleCloseCreateGroup}
                onSave={handleSaveGroup}
            />
        </div>
    )
}
