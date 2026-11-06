import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import DateRangePicker from '../components/DateRangePicker.jsx'

export default function SendingHistory() {
    const [selectedTemplate, setSelectedTemplate] = useState('')
    const [searchBy, setSearchBy] = useState('Number')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedType, setSelectedType] = useState('All Type')
    const [dateRange, setDateRange] = useState('27 June 2026 - 4 July 2026')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [selectedRows, setSelectedRows] = useState([])

    const typeFilters = ['All Type', 'WEB', 'API', 'CTBOT', 'B/A']

    // Mock data - replace with actual API call
    const mockData = []

    const handleSearch = () => {
        console.log('Search:', { template: selectedTemplate, searchBy, query: searchQuery, type: selectedType, dateRange })
        // Implement search logic
    }

    const handleDownloadAll = () => {
        console.log('Download All')
        // Implement download logic
    }

    const handleResend = (id) => {
        console.log('Resend:', id)
        // Implement resend logic
    }

    const handleDownload = (id) => {
        console.log('Download:', id)
        // Implement download logic
    }

    return (
        <Layout title="Sending History">
            <div className="dashboard-content">
                <div className="sending-history-card">
                    {/* Header Section */}
                    <div className="sending-history-header">
                        <div className="header-left">
                            <div className="official-message-icon">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="20" cy="20" r="20" fill="#4FC3F7" />
                                    <path d="M12 14h16v2H12zM12 20h16v2H12zM12 26h10v2H12z" fill="#fff" />
                                </svg>
                            </div>
                            <h1 className="page-title">Offical Message<br />History</h1>
                        </div>

                        <div className="header-filters">
                            <select
                                className="filter-select"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                            >
                                <option value="">Select Offical Template</option>
                                <option value="template1">Template 1</option>
                                <option value="template2">Template 2</option>
                            </select>

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

                            <button className="btn-download-all" onClick={handleDownloadAll}>
                                Download All
                            </button>

                            <select
                                className="filter-select"
                                value=""
                                onChange={(e) => console.log('Select All Total:', e.target.value)}
                            >
                                <option value="">Select All Total</option>
                                <option value="all">All</option>
                                <option value="selected">Selected</option>
                            </select>
                        </div>
                    </div>

                    {/* Controls Section */}
                    <div className="sending-history-controls">
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

                        <div className="type-filters">
                            {typeFilters.map((type) => (
                                <button
                                    key={type}
                                    className={`type-filter-btn ${selectedType === type ? 'active' : ''} ${type}`}
                                    onClick={() => setSelectedType(type)}
                                >
                                    {type}
                                </button>
                            ))}
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
                                    <th className="th-sortable">Type</th>
                                    <th className="th-sortable">Total</th>
                                    <th className="th-sortable">Message</th>
                                    <th className="th-sortable">Submit Date</th>
                                    <th className="th-sortable">READ</th>
                                    <th className="th-sortable">DLVD</th>
                                    <th className="th-sortable">FAILED</th>
                                    <th className="th-sortable">Other</th>
                                    <th className="th-sortable">Download</th>
                                    <th className="th-sortable">Resend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockData.length === 0 ? (
                                    <tr>
                                        <td colSpan="11" className="no-data">
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
                                            <td>{row.type}</td>
                                            <td>{row.total}</td>
                                            <td>{row.message}</td>
                                            <td>{row.submitDate}</td>
                                            <td>{row.read}</td>
                                            <td>{row.dlvd}</td>
                                            <td>{row.failed}</td>
                                            <td>{row.other}</td>
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
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleResend(row.id)}
                                                    title="Resend"
                                                >
                                                    ↻
                                                </button>
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