import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import AddNumbersModal from '../components/AddNumbersModal.jsx'
import AddTagsModal from '../components/AddTagsModal.jsx'
import EditKeysModal from '../components/EditKeysModal.jsx'

export default function TaggingNumbers() {
    const { setTitle } = useTitle()
    const [mobileNumbers, setMobileNumbers] = useState([
        { id: 1, number: '919321128486', tags: '' }
    ])
    const [selectedNumbers, setSelectedNumbers] = useState([])
    const [searchKey, setSearchKey] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')
    const [showEntries, setShowEntries] = useState('10')
    const [textareaValue, setTextareaValue] = useState('')
    const [isAddNumbersModalOpen, setIsAddNumbersModalOpen] = useState(false)
    const [isAddTagsModalOpen, setIsAddTagsModalOpen] = useState(false)
    const [isEditKeysModalOpen, setIsEditKeysModalOpen] = useState(false)

    useEffect(() => {
        setTitle('Tagging Numbers')
    }, [setTitle])

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedNumbers(mobileNumbers.map(num => num.id))
        } else {
            setSelectedNumbers([])
        }
    }

    const handleSelectNumber = (id) => {
        if (selectedNumbers.includes(id)) {
            setSelectedNumbers(selectedNumbers.filter(numId => numId !== id))
        } else {
            setSelectedNumbers([...selectedNumbers, id])
        }
    }

    const handleAddUserNumber = () => {
        setIsAddNumbersModalOpen(true)
    }

    const handleCloseAddNumbersModal = () => {
        setIsAddNumbersModalOpen(false)
    }

    const handleAddNewTag = () => {
        setIsAddTagsModalOpen(true)
    }

    const handleCloseAddTagsModal = () => {
        setIsAddTagsModalOpen(false)
    }

    const handleSaveTag = (tagData) => {
        console.log('Tag saved:', tagData)
        // Add your API call or state update logic here
        // You can add the tag to a tags list or send it to the backend
    }

    const handleEditKeys = () => {
        setIsEditKeysModalOpen(true)
    }

    const handleCloseEditKeysModal = () => {
        setIsEditKeysModalOpen(false)
    }

    const handleSearch = () => {
        console.log('Search:', { searchKey, searchQuery })
        // Add your search logic here
    }

    const handleEdit = (id) => {
        console.log('Edit:', id)
        // Add your edit logic here
    }

    const handleDelete = (id) => {
        console.log('Delete:', id)
        if (window.confirm('Are you sure you want to delete this number?')) {
            setMobileNumbers(mobileNumbers.filter(num => num.id !== id))
            setSelectedNumbers(selectedNumbers.filter(numId => numId !== id))
        }
    }

    return (
        <>
            <div className="tagging-numbers-container">
                {/* Header Section */}
                <div className="tagging-header">
                    <div className="header-left">
                        <div className="user-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                            </svg>
                        </div>
                        <span className="header-title">User Number</span>
                        <button className="btn-pill green" onClick={handleAddUserNumber}>
                            Add UserNumber
                        </button>
                        <button className="btn-pill blue" onClick={handleAddNewTag}>
                            Add New Tag
                        </button>
                        <button className="btn-pill purple" onClick={handleEditKeys}>
                            Edit UserNumber Keys
                        </button>
                    </div>
                </div>

                {/* Textarea and Search Section */}
                <div className="tagging-controls">
                    <div className="textarea-wrapper">
                        <textarea
                            value={textareaValue}
                            onChange={(e) => setTextareaValue(e.target.value)}
                            placeholder="Enter mobile numbers here..."
                            rows="6"
                            className="tagging-textarea"
                        />
                    </div>
                    <div className="search-wrapper">
                        <select
                            value={searchKey}
                            onChange={(e) => setSearchKey(e.target.value)}
                            className="search-select"
                        >
                            <option value="All">Search by keys (All)</option>
                            <option value="mobile">Mobile No</option>
                            <option value="tags">Tags</option>
                        </select>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search here..."
                            className="search-input"
                        />
                        <button className="btn-search" onClick={handleSearch}>
                            Search
                        </button>
                    </div>
                </div>

                {/* Table Controls */}
                <div className="table-controls">
                    <div className="entries-control">
                        <span>Show</span>
                        <select
                            value={showEntries}
                            onChange={(e) => setShowEntries(e.target.value)}
                            className="entries-select"
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                        <span>entries</span>
                    </div>
                    <div className="action-controls">
                        <button className="btn-action blue">Select All</button>
                        <button className="btn-action purple">More Action</button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr className="table-header">
                                <th className="th-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedNumbers.length === mobileNumbers.length && mobileNumbers.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="th-sortable">
                                    <div className="th-content">
                                        <span>Mobile No</span>
                                        <div className="sort-icons">
                                            <span className="sort-up">▲</span>
                                            <span className="sort-down">▼</span>
                                        </div>
                                    </div>
                                </th>
                                <th className="th-sortable">
                                    <div className="th-content">
                                        <span>Tags</span>
                                        <div className="sort-icons">
                                            <span className="sort-up">▲</span>
                                            <span className="sort-down">▼</span>
                                        </div>
                                    </div>
                                </th>
                                <th className="th-sortable">
                                    <div className="th-content">
                                        <span>Action</span>
                                        <div className="sort-icons">
                                            <span className="sort-up">▲</span>
                                            <span className="sort-down">▼</span>
                                        </div>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {mobileNumbers.map((item) => (
                                <tr key={item.id} className="table-row">
                                    <td className="td-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedNumbers.includes(item.id)}
                                            onChange={() => handleSelectNumber(item.id)}
                                        />
                                    </td>
                                    <td className="td-mobile">{item.number}</td>
                                    <td className="td-tags">{item.tags || '-'}</td>
                                    <td className="td-actions">
                                        <button className="btn-edit" onClick={() => handleEdit(item.id)}>
                                            EDIT
                                        </button>
                                        <button className="btn-delete" onClick={() => handleDelete(item.id)}>
                                            DELETE
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination-wrapper">
                    <div className="pagination-info">
                        Showing 1 to {mobileNumbers.length} of {mobileNumbers.length} entries
                    </div>
                    <div className="pagination-controls">
                        <button className="btn-page" disabled>
                            Previous
                        </button>
                        <button className="btn-page active">1</button>
                        <button className="btn-page" disabled>
                            Next
                        </button>
                    </div>
                </div>

                {/* Add Numbers Modal */}
                <AddNumbersModal
                    isOpen={isAddNumbersModalOpen}
                    onClose={handleCloseAddNumbersModal}
                />

                {/* Add Tags Modal */}
                <AddTagsModal
                    isOpen={isAddTagsModalOpen}
                    onClose={handleCloseAddTagsModal}
                    onSave={handleSaveTag}
                />

                {/* Edit Keys Modal */}
                <EditKeysModal
                    isOpen={isEditKeysModalOpen}
                    onClose={handleCloseEditKeysModal}
                />
            </div>
        </>
    )
}

