import React, { useState, useEffect } from 'react'
import api from '../services/api.js'
import CreateGroupModal from './CreateGroupModal.jsx'
import DateRangePicker from './DateRangePicker.jsx'

export default function GroupMasterModal({ isOpen, onClose, onGroupCreated }) {
    const [groups, setGroups] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedGroups, setSelectedGroups] = useState([])
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
    const [dateRange, setDateRange] = useState('July 4, 2011 - July 4, 2026')

    useEffect(() => {
        if (isOpen) {
            fetchGroups()
        }
    }, [isOpen])

    const fetchGroups = async () => {
        setIsLoading(true)
        try {
            const response = await api.get('/groups')
            if (response.data && Array.isArray(response.data.data)) {
                setGroups(response.data.data)
            }
        } catch (err) {
            console.error('Failed to fetch groups:', err)
        } finally {
            setIsLoading(false)
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

    const handleDeleteSingle = async (id) => {
        if (!window.confirm('Are you sure you want to delete this group?')) return
        try {
            await api.delete(`/groups/${id}`)
            fetchGroups()
            if (onGroupCreated) onGroupCreated({ name: '' })
        } catch (err) {
            console.error('Failed to delete group:', err)
            alert('Failed to delete group')
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedGroups.length > 0 && window.confirm(`Are you sure you want to delete ${selectedGroups.length} group(s)?`)) {
            try {
                await Promise.all(selectedGroups.map(id => api.delete(`/groups/${id}`)))
                setSelectedGroups([])
                fetchGroups()
                if (onGroupCreated) onGroupCreated({ name: '' })
            } catch (err) {
                console.error('Failed deleting selected groups:', err)
            }
        }
    }

    const handleOpenCreateGroup = () => {
        setShowCreateGroupModal(true)
    }

    const handleCloseCreateGroup = () => {
        setShowCreateGroupModal(false)
    }

    const handleSaveGroup = (newGroup) => {
        setShowCreateGroupModal(false)
        fetchGroups()
        if (onGroupCreated) {
            onGroupCreated(newGroup)
        }
    }

    const handleDateRangeChange = (newRange) => {
        setDateRange(newRange)
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
                            + Add New Group
                        </button>
                    </div>
                </div>

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
                                <th className="th-total">Total Contacts</th>
                                <th className="th-action">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="no-data-cell">
                                        Loading groups...
                                    </td>
                                </tr>
                            ) : groups.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="no-data-cell">
                                        No groups available in database
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
                                        <td className="td-total">{group.totalContacts}</td>
                                        <td className="td-action">
                                            <div className="action-buttons-group">
                                                <button type="button" className="btn-delete-group" onClick={() => handleDeleteSingle(group.id)}>Delete</button>
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

            {/* Create Group Modal Popup */}
            <CreateGroupModal
                isOpen={showCreateGroupModal}
                onClose={handleCloseCreateGroup}
                onSave={handleSaveGroup}
            />
        </div>
    )
}

