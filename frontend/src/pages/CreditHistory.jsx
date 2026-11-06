import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import './CreditHistory.css'

const DEFAULT_HISTORY_LOGS = [
    { id: 1, username: 'vikram', serviceName: 'DURATION', credit: 365, type: 'DEBIT', newCredit: 179, notes: 'For ankitbhai license renewal', date: '06-07-2026 10:53 (a day ago)' },
    { id: 2, username: 'galaxy', serviceName: 'DURATION', credit: 365, type: 'CREDIT', newCredit: 544, notes: 'Credit topup package', date: '06-07-2026 10:50 (a day ago)' },
    { id: 3, username: 'vikram', serviceName: 'DURATION', credit: 100, type: 'DEBIT', newCredit: 179, notes: 'For opera license topup', date: '03-07-2026 10:03 (4 days ago)' },
]

const DEFAULT_USERS = [
    { id: 1, username: 'opera' },
    { id: 2, username: 'empire' },
    { id: 3, username: 'aditya2026' },
    { id: 4, username: 'swift' },
    { id: 5, username: 'pankajpandya' },
    { id: 6, username: 'radheeducation' },
    { id: 7, username: 'pratikpatel' },
    { id: 8, username: 'parshwa' },
    { id: 9, username: 'nextgen' },
    { id: 10, username: 'vivekbhai' },
    { id: 11, username: 'vikram' },
    { id: 12, username: 'galaxy' },
]

export default function CreditHistory() {
    const { setTitle } = useTitle()

    // Load users list for dropdown filter
    const [users] = useState(() => {
        const saved = localStorage.getItem('wa_user_list')
        if (saved) {
            return JSON.parse(saved)
        }
        return DEFAULT_USERS
    })

    // Load history list
    const [logs] = useState(() => {
        const saved = localStorage.getItem('wa_credit_history_reseller')
        return saved ? JSON.parse(saved) : DEFAULT_HISTORY_LOGS
    })

    useEffect(() => {
        setTitle('Credit History(Reseller)')
    }, [setTitle])

    // Filters state
    const [selectedUser, setSelectedUser] = useState('')
    const [selectedType, setSelectedType] = useState('')
    const [selectedService, setSelectedService] = useState('')
    const [searchText, setSearchText] = useState('')

    // Table settings
    const [entriesCount, setEntriesCount] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)
    const [expandedRows, setExpandedRows] = useState({})

    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    // Filter logs list
    const filteredLogs = logs.filter(log => {
        if (selectedUser && log.username !== selectedUser) {
            return false
        }
        if (selectedType && log.type !== selectedType) {
            return false
        }
        if (selectedService && log.serviceName !== selectedService) {
            return false
        }
        if (searchText) {
            const query = searchText.toLowerCase()
            const matchUser = log.username.toLowerCase().includes(query)
            const matchNotes = log.notes.toLowerCase().includes(query)
            const matchService = log.serviceName.toLowerCase().includes(query)
            if (!matchUser && !matchNotes && !matchService) {
                return false
            }
        }
        return true
    })

    // Pagination math
    const totalEntries = filteredLogs.length
    const startIndex = (currentPage - 1) * entriesCount
    const endIndex = Math.min(startIndex + entriesCount, totalEntries)
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex)
    const totalPages = Math.ceil(totalEntries / entriesCount)

    return (
        <div className="credit-history-page">
            <div className="credit-history-card">
                {/* Header Row */}
                <div className="history-header-row">
                    <div className="history-header-left">
                        <div className="history-avatar-icon">
                            {/* Card history icon */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                        </div>
                        <h1 className="history-header-title">Credit History(Reseller)</h1>
                    </div>

                    {/* Dropdown Filters matching Screenshot 1 */}
                    <div className="history-header-filters">
                        <select 
                            className="history-filter-select"
                            value={selectedUser}
                            onChange={(e) => {
                                setSelectedUser(e.target.value)
                                setCurrentPage(1)
                            }}
                        >
                            <option value="">Select By UserName</option>
                            {users.map(u => (
                                <option key={u.id} value={u.username}>{u.username}</option>
                            ))}
                        </select>

                        <select 
                            className="history-filter-select"
                            value={selectedType}
                            onChange={(e) => {
                                setSelectedType(e.target.value)
                                setCurrentPage(1)
                            }}
                        >
                            <option value="">Credit/Debit</option>
                            <option value="CREDIT">CREDIT</option>
                            <option value="DEBIT">DEBIT</option>
                        </select>

                        <select 
                            className="history-filter-select"
                            value={selectedService}
                            onChange={(e) => {
                                setSelectedService(e.target.value)
                                setCurrentPage(1)
                            }}
                        >
                            <option value="">Search by Service</option>
                            <option value="DURATION">DURATION</option>
                            <option value="WAPP">WAPP</option>
                        </select>

                        <div className="history-date-badge">
                            06/30/2026 - 07/07/2026
                        </div>
                    </div>
                </div>

                {/* Sub Filter Controls Bar */}
                <div className="history-sub-filters">
                    <div className="history-entries-select">
                        Show 
                        <select 
                            value={entriesCount} 
                            onChange={(e) => {
                                setEntriesCount(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        entries
                    </div>

                    <div className="history-search-wrapper">
                        Search:
                        <input 
                            type="text" 
                            className="history-search-input" 
                            placeholder=""
                            value={searchText}
                            onChange={(e) => {
                                setSearchText(e.target.value)
                                setCurrentPage(1)
                            }}
                        />
                    </div>
                </div>

                {/* Table container */}
                <div className="history-table-container">
                    <table className="history-data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>+</th>
                                <th>UserName</th>
                                <th>ServiceName</th>
                                <th>Credit</th>
                                <th>Type</th>
                                <th>New Credit</th>
                                <th>Notes</th>
                                <th>Credit on</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="history-empty-row">No data available in table</td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log) => (
                                    <React.Fragment key={log.id}>
                                        <tr>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    type="button" 
                                                    className="history-expander-btn"
                                                    onClick={() => toggleRow(log.id)}
                                                >
                                                    {expandedRows[log.id] ? '−' : '+'}
                                                </button>
                                            </td>
                                            <td>{log.username}</td>
                                            <td>{log.serviceName}</td>
                                            <td>{log.credit}</td>
                                            <td>
                                                <span className={log.type === 'CREDIT' ? 'type-badge-credit' : 'type-badge-debit'}>
                                                    {log.type}
                                                </span>
                                            </td>
                                            <td>{log.newCredit}</td>
                                            <td>{log.notes}</td>
                                            <td>{log.date}</td>
                                        </tr>
                                        {expandedRows[log.id] && (
                                            <tr className="history-detail-row-expanded">
                                                <td colSpan="8">
                                                    <div className="history-detail-expanded-card">
                                                        <div className="history-detail-expanded-item">
                                                            <strong>Full Transaction Note: </strong> {log.notes || 'No description notes.'}
                                                        </div>
                                                        <div className="history-detail-expanded-item">
                                                            <strong>Timestamp: </strong> {log.date}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="history-table-footer">
                    <div className="history-showing-entries">
                        Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of {totalEntries} entries
                    </div>
                    <div className="history-pagination">
                        <button 
                            className="btn-history-pag" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                            <button
                                key={num}
                                className={`btn-history-pag ${currentPage === num ? 'active' : ''}`}
                                onClick={() => setCurrentPage(num)}
                            >
                                {num}
                            </button>
                        ))}
                        <button 
                            className="btn-history-pag" 
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
