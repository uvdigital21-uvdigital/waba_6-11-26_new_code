import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'

export default function WhatsappForms() {
    const navigate = useNavigate()
    const { setTitle } = useTitle()
    const [entries, setEntries] = useState(10)
    const [dateRange, setDateRange] = useState('July 4, 2021 - July 4, 2026')

    useEffect(() => {
        setTitle('Whatsapp Forms')
    }, [setTitle])

    // Sample data - replace with actual API data
    const forms = [
        {
            id: 1,
            name: 'Customer Feedback Form',
            notes: '',
            createdAt: '04-07-2026 14:57',
            createdAtRelative: '(2 days ago)',
        },
        {
            id: 2,
            name: 'Customer Feedback Form',
            notes: '',
            createdAt: '03-07-2026 17:36',
            createdAtRelative: '(3 days ago)',
        },
    ]

    return (
        <>
            <div className="dashboard-content">
                {/* Header Section */}
                <div className="wappform-header">
                    <h1 className="wappform-title">WappForm Report</h1>
                    <div className="wappform-actions">
                        <Link to="/reports/whatsapp-forms/create" className="btn-create-form">
                            Create Form
                        </Link>
                        <button
                            className="btn-view-responses"
                            onClick={() => navigate('/reports/whatsapp-forms/responses')}
                        >
                            View All Form Responses
                        </button>
                    </div>
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
                                        Notes
                                        <span className="sort-icon">^</span>
                                    </th>
                                    <th className="wappform-th">
                                        Created On
                                        <span className="sort-icon">^</span>
                                    </th>
                                    <th className="wappform-th">
                                        Action
                                        <span className="sort-icon">^</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {forms.map((form) => (
                                    <tr key={form.id} className="wappform-tr">
                                        <td className="wappform-td">
                                            <button className="btn-plus-icon">
                                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <circle cx="10" cy="10" r="9" stroke="#1abc9c" strokeWidth="1.5" />
                                                    <path d="M10 6V14M6 10H14" stroke="#1abc9c" strokeWidth="1.5" strokeLinecap="round" />
                                                </svg>
                                            </button>
                                        </td>
                                        <td className="wappform-td">{form.name}</td>
                                        <td className="wappform-td">{form.notes}</td>
                                        <td className="wappform-td">
                                            <div className="created-on-cell">
                                                <span>{form.createdAt}</span>
                                                <span className="relative-time">{form.createdAtRelative}</span>
                                            </div>
                                        </td>
                                        <td className="wappform-td">
                                            <div className="action-buttons">
                                                <button className="btn-action btn-view">View Response</button>
                                                <button className="btn-action btn-edit">Edit</button>
                                                <button className="btn-action btn-delete">Delete</button>
                                                <button className="btn-action btn-export">Export Excel</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Pagination */}
                    <div className="wappform-footer">
                        <div className="wappform-info">
                            Showing 1 to 2 of 2 entries
                        </div>
                        <div className="wappform-pagination">
                            <button className="btn-pagination" disabled>Previous</button>
                            <button className="btn-pagination btn-pagination-active">1</button>
                            <button className="btn-pagination" disabled>Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}