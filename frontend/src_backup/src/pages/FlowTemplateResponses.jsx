import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import DateRangePicker from '../components/DateRangePicker.jsx'

export default function FlowTemplateResponses() {
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [selectedRows, setSelectedRows] = useState([])
    const [dateRange, setDateRange] = useState('July 4, 2025 - July 4, 2026')

    // Mock data - replace with actual API call
    const mockData = []

    const handleDownloadAll = () => {
        console.log('Download All Flow Responses')
        // Implement download logic
    }

    const handleDownload = (id) => {
        console.log('Download:', id)
        // Implement download logic
    }

    return (
        <Layout title="Flow Template Responses">
            <div className="dashboard-content">
                <div className="flow-response-card">
                    {/* Header Section */}
                    <div className="flow-response-header">
                        <h1 className="page-title">Flow Response Report</h1>

                        <div className="header-actions">
                            <button className="btn-download-all" onClick={handleDownloadAll}>
                                Download Flow Response
                            </button>
                            <div className="date-range-wrapper">
                                <DateRangePicker value={dateRange} onChange={setDateRange} />
                            </div>
                        </div>
                    </div>

                    {/* Controls Section */}
                    <div className="flow-response-controls">
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
                                    <th className="th-sortable">From Number</th>
                                    <th className="th-sortable">To Number</th>
                                    <th className="th-sortable">Response Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockData.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="no-data">
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
                                            <td>{row.fromNumber}</td>
                                            <td>{row.toNumber}</td>
                                            <td>{row.responseDate}</td>
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