import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import DateRangePicker from '../components/DateRangePicker.jsx'

export default function ScheduledLog() {
    const [searchBy, setSearchBy] = useState('Number')
    const [searchQuery, setSearchQuery] = useState('')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [selectedRows, setSelectedRows] = useState([])
    const [dateRange, setDateRange] = useState('July 4, 2026 - July 4, 2027')

    // Mock data - replace with actual API call
    const mockData = []

    const handleSearch = () => {
        console.log('Search:', { searchBy, query: searchQuery, dateRange })
        // Implement search logic
    }

    const handleSelectAll = () => {
        if (selectedRows.length === mockData.length) {
            setSelectedRows([])
        } else {
            setSelectedRows(mockData.map(row => row.id))
        }
    }

    const handleCancelAll = () => {
        console.log('Cancel All')
        // Implement cancel all logic
    }

    const handleCancel = (id) => {
        console.log('Cancel:', id)
        // Implement cancel logic
    }

    const handleDelete = (id) => {
        console.log('Delete:', id)
        // Implement delete logic
    }

    const handleDownloadAll = () => {
        console.log('Download All')
        // Implement download logic
    }

    const handleDownload = (id) => {
        console.log('Download:', id)
        // Implement download logic
    }

    const handleAction = (id, action) => {
        console.log('Action:', action, 'for', id)
        // Implement action logic
    }

    return (
        <Layout title="Scheduled Log">
            <div className="dashboard-content">
                <div className="scheduled-log-card">
                    {/* Header Section */}
                    <div className="scheduled-log-header">
                        <div className="header-left">
                            <div className="schedule-icon">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="20" cy="20" r="20" fill="#4FC3F7" />
                                    <path d="M12 14h16v2H12zM12 20h16v2H12zM12 26h10v2H12z" fill="#fff" />
                                </svg>
                            </div>
                            <h1 className="page-title">Schedule Message Log</h1>
                        </div>

                        <div className="header-filters">
                            <div className="search-by-group">
                                <span className="search-by-label">Search by</span>
                                <select
                                    className="filter-select"
                                    value={searchBy}
                                    onChange={(e) => setSearchBy(e.target.value)}
                                >
                                    <option value="Number">Number</option>
                                    <option value="Name">Name</option>
                                    <option value="Message">Message</option>
                                </select>
                            </div>

                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search here..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />

                            <button className="btn-search" onClick={handleSearch}>
                                Search
                            </button>
                        </div>
                    </div>

                    {/* Controls Section */}
                    <div className="scheduled-log-controls">
                        <div className="show-entries">
                            <span>Show</span>
                            <select
                                value={entriesPerPage}
                                onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                            >
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            <span>entries</span>
                        </div>

                        <div className="action-buttons">
                            <button className="btn-select-all" onClick={handleSelectAll}>
                                Select All
                            </button>
                            <button className="btn-cancel-all" onClick={handleCancelAll}>
                                CANCEL ALL
                            </button>
                            <button className="btn-cancel" onClick={() => handleCancel('selected')}>
                                CANCEL
                            </button>
                            <button className="btn-delete" onClick={() => handleDelete('selected')}>
                                DELETE
                            </button>
                            <button className="btn-download-all" onClick={handleDownloadAll}>
                                Download All
                            </button>
                        </div>

                        <div className="date-range-wrapper">
                            <DateRangePicker value={dateRange} onChange={setDateRange} />
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr className="table-header">
                                    <th className="th-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={mockData.length > 0 && selectedRows.length === mockData.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedRows(mockData.map(row => row.id))
                                                } else {
                                                    setSelectedRows([])
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="th-sortable">Camp Name</th>
                                    <th className="th-sortable">Total</th>
                                    <th className="th-sortable">Message</th>
                                    <th className="th-sortable">Schedule Date</th>
                                    <th className="th-sortable">Status</th>
                                    <th className="th-sortable">Download</th>
                                    <th className="th-sortable">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockData.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="no-data">
                                            No data available in table
                                        </td>
                                    </tr>
                                ) : (
                                    mockData.map((row) => (
                                        <tr key={row.id} className="table-row">
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.includes(row.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedRows([...selectedRows, row.id])
                                                        } else {
                                                            setSelectedRows(selectedRows.filter(id => id !== row.id))
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>{row.campName}</td>
                                            <td>{row.total}</td>
                                            <td>{row.message}</td>
                                            <td>{row.scheduleDate}</td>
                                            <td>
                                                <span className={`status-badge ${row.status?.toLowerCase()}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDownload(row.id)}
                                                    title="Download"
                                                >
                                                    ⬇
                                                </button>
                                            </td>
                                            <td>
                                                <div className="action-buttons-cell">
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => handleAction(row.id, 'edit')}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => handleAction(row.id, 'view')}
                                                        title="View"
                                                    >
                                                        👁️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination-container">
                        <div className="showing-info">
                            Showing 0 to 0 of 0 entries
                        </div>
                        <div className="pagination-buttons">
                            <button className="btn-pagination" disabled>
                                Previous
                            </button>
                            <button className="btn-pagination" disabled>
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}