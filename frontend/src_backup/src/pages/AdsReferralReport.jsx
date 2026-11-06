import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import DateRangePicker from '../components/DateRangePicker.jsx'

export default function AdsReferralReport() {
    const [dateRange, setDateRange] = useState('July 4, 2025 - July 4, 2026')
    const [entriesPerPage, setEntriesPerPage] = useState(10)

    // Mock data - replace with actual API call
    const mockData = []

    return (
        <Layout title="Ads Referral Report">
            <div className="dashboard-content">
                <div className="ads-referral-card">
                    {/* Header Section */}
                    <div className="ads-referral-header">
                        <div className="header-left">
                            <div className="official-message-icon">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="20" cy="20" r="20" fill="#4FC3F7" />
                                    <path d="M12 14h16v2H12zM12 20h16v2H12zM12 26h10v2H12z" fill="#fff" />
                                </svg>
                            </div>
                            <h1 className="page-title">Meta Ad Referral<br />Report</h1>
                        </div>

                        <div className="date-range-wrapper">
                            <DateRangePicker value={dateRange} onChange={setDateRange} />
                        </div>
                    </div>

                    {/* Controls Section */}
                    <div className="ads-referral-controls">
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
                                    <th className="th-sortable">From</th>
                                    <th className="th-sortable">To</th>
                                    <th className="th-sortable">Head Line</th>
                                    <th className="th-sortable">CreatedOn</th>
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
                                            <td>{row.from}</td>
                                            <td>{row.to}</td>
                                            <td>{row.headLine}</td>
                                            <td>{row.createdOn}</td>
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