import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'

export default function WappFormResponses() {
    const navigate = useNavigate()
    const [entries, setEntries] = useState(10)
    const [dateRange, setDateRange] = useState('July 6, 2025 - July 6, 2026')

    // Sample data - replace with actual API data
    const responses = []

    return (
        <Layout title="WappForm Response">
            <div className="dashboard-content">
                {/* Header Section */}
                <div className="wappform-header">
                    <h1 className="wappform-title">WappForm Response</h1>
                </div>

                {/* Table Card */}
                <div className="wappform-card">
                    {/* Toolbar */}
                    <div className="wappform-toolbar">
                        <div className="wappform-show-entries">
                            <span>Show</span>
                            <select
                                value={entries}
                                onChange={(e) => setEntries(Number(e.target.value))}
                                className="wappform-select"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>entries</span>
                        </div>
                        <div className="wappform-date-range">
                            <button className="btn-date-range">{dateRange}</button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="wappform-table-wrapper">
                        <table className="wappform-table">
                            <thead>
                                <tr>
                                    <th className="wappform-th-add">
                                        <button className="btn-add-icon">+</button>
                                        <span className="sort-icon">^</span>
                                    </th>
                                    <th className="wappform-th">
                                        Form name
                                        <span className="sort-icon">^</span>
                                    </th>
                                    <th className="wappform-th">
                                        From Number
                                        <span className="sort-icon">^</span>
                                    </th>
                                    <th className="wappform-th">
                                        Response Time
                                        <span className="sort-icon">^</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {responses.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="wappform-no-data">
                                            No data available in table
                                        </td>
                                    </tr>
                                ) : (
                                    responses.map((response) => (
                                        <tr key={response.id} className="wappform-tr">
                                            <td className="wappform-td">
                                                <button className="btn-plus-icon">
                                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <circle cx="10" cy="10" r="9" stroke="#1abc9c" strokeWidth="1.5" />
                                                        <path d="M10 6V14M6 10H14" stroke="#1abc9c" strokeWidth="1.5" strokeLinecap="round" />
                                                    </svg>
                                                </button>
                                            </td>
                                            <td className="wappform-td">{response.formName}</td>
                                            <td className="wappform-td">{response.fromNumber}</td>
                                            <td className="wappform-td">{response.responseTime}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Pagination */}
                    <div className="wappform-footer">
                        <div className="wappform-info">
                            Showing 0 to 0 of 0 entries
                        </div>
                        <div className="wappform-pagination">
                            <button className="btn-pagination" disabled>Previous</button>
                            <button className="btn-pagination btn-pagination-active">1</button>
                            <button className="btn-pagination" disabled>Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}