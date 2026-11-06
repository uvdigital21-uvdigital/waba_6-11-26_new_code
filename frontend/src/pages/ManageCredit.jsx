import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import './ManageCredit.css'

const DEFAULT_CREDIT_LOGS = [
    { id: 1, username: 'Beacon', service: 'DURATION', credits: 7, date: new Date().toLocaleString() }
]

const DEFAULT_USERS = [
    { id: 1, username: 'opera', credit: '', email: 'opera', mobile: '', status: 'Active', role: 'USER' },
    { id: 2, username: 'empire', credit: '', email: 'empire', mobile: '', status: 'Active', role: 'USER' },
    { id: 3, username: 'aditya2026', credit: '', email: 'aditya2026', mobile: '', status: 'Active', role: 'USER' },
    { id: 4, username: 'swift', credit: '', email: 'swift', mobile: '', status: 'Active', role: 'USER' },
    { id: 5, username: 'pankajpandya', credit: '', email: 'pankajpandya', mobile: '', status: 'Active', role: 'USER' },
    { id: 6, username: 'radheeducation', credit: '', email: 'radheeducation', mobile: '', status: 'Active', role: 'USER' },
    { id: 7, username: 'pratikpatel', credit: '', email: 'pratikpatel', mobile: '', status: 'Active', role: 'USER' },
    { id: 8, username: 'parshwa', credit: '', email: 'parshwa', mobile: '', status: 'Active', role: 'USER' },
    { id: 9, username: 'nextgen', credit: '', email: 'nextgen', mobile: '7405295057', status: 'Active', role: 'RESELLER' },
    { id: 10, username: 'vivekbhai', credit: '', email: 'vivekbhai', mobile: '', status: 'Active', role: 'USER' },
]

export default function ManageCredit() {
    const { setTitle } = useTitle()

    // Load users to populate the username selection dropdown
    const [users, setUsers] = useState(() => {
        const saved = localStorage.getItem('wa_user_list')
        return saved ? JSON.parse(saved) : DEFAULT_USERS
    })

    // Load top-up history
    const [creditLogs, setCreditLogs] = useState(() => {
        const saved = localStorage.getItem('wa_credit_history')
        return saved ? JSON.parse(saved) : DEFAULT_CREDIT_LOGS
    })

    useEffect(() => {
        setTitle('Credit Balance')
    }, [setTitle])

    // Save credit logs
    useEffect(() => {
        localStorage.setItem('wa_credit_history', JSON.stringify(creditLogs))
    }, [creditLogs])

    // Form inputs states
    const [selectedUser, setSelectedUser] = useState('')
    const [serviceType, setServiceType] = useState('DURATION')
    const [amount, setAmount] = useState(0)
    const [notes, setNotes] = useState('')

    // Table view states
    const [entriesCount, setEntriesCount] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)
    const [successMessage, setSuccessMessage] = useState('')

    const handleTopUpSubmit = (e) => {
        e.preventDefault()
        if (!selectedUser || amount <= 0) {
            alert('Please select a username and enter a valid topup amount.')
            return
        }

        const newLog = {
            id: Date.now(),
            username: selectedUser,
            service: serviceType,
            credits: amount,
            date: new Date().toLocaleString()
        }

        // Add to history log list
        const updatedLogs = [newLog, ...creditLogs]
        setCreditLogs(updatedLogs)

        // Cross-page state updates: update user's credits column in the UserAccounts page
        const savedUsers = localStorage.getItem('wa_user_list')
        const currentUsersList = savedUsers ? JSON.parse(savedUsers) : [...users]

        const updatedUsersList = currentUsersList.map(u => {
            if (u.username === selectedUser) {
                // Parse existing credit and add topup amount
                const currentCreditVal = Number(u.credit) || 0
                return {
                    ...u,
                    credit: String(currentCreditVal + amount)
                }
            }
            return u
        })

        // Save updated users back to localStorage
        localStorage.setItem('wa_user_list', JSON.stringify(updatedUsersList))
        setUsers(updatedUsersList)

        // Reset form inputs
        setAmount(0)
        setNotes('')
        setSelectedUser('')
        
        // Show success banner
        setSuccessMessage(`Topped up ${amount} credits for ${selectedUser} successfully!`)
        setTimeout(() => setSuccessMessage(''), 3000)
    }

    // Pagination math
    const totalEntries = creditLogs.length
    const startIndex = (currentPage - 1) * entriesCount
    const endIndex = Math.min(startIndex + entriesCount, totalEntries)
    const paginatedLogs = creditLogs.slice(startIndex, endIndex)
    const totalPages = Math.ceil(totalEntries / entriesCount)

    return (
        <div className="credit-balance-page">
            {successMessage && (
                <div className="success-banner" style={{ marginBottom: 16 }}>
                    {successMessage}
                </div>
            )}

            <div className="credit-balance-card">
                {/* Header */}
                <div className="credit-header-row">
                    <div className="credit-card-icon-wrapper">
                        {/* Credit Card icon */}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                            <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                    </div>
                    <h1 className="credit-header-title">Credit Balance</h1>
                </div>

                {/* Balance Tags Row */}
                <div className="credit-tags-row">
                    <div className="credit-tag-blue">Your Credit</div>
                    <div className="credit-tag-teal">DURATION:179</div>
                    <div className="credit-tag-teal">WAPP:0</div>
                </div>

                {/* Main Two Column Layout */}
                <div className="credit-main-layout">
                    
                    {/* LEFT COLUMN: Top-Up Form */}
                    <div className="credit-form-box">
                        <form onSubmit={handleTopUpSubmit}>
                            <div className="credit-form-group">
                                <select 
                                    className="credit-form-select"
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    required
                                >
                                    <option value="">Select By UserName</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.username}>{u.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="credit-form-group">
                                <select 
                                    className="credit-form-select"
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                    required
                                >
                                    <option value="DURATION">DURATION</option>
                                    <option value="WAPP">WAPP</option>
                                </select>
                            </div>

                            <div className="credit-form-group">
                                <input 
                                    type="number" 
                                    className="credit-form-input" 
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="credit-form-group">
                                <input 
                                    type="text" 
                                    className="credit-form-input" 
                                    placeholder="Notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <button type="submit" className="btn-topup-save">
                                TopUp
                            </button>
                        </form>
                    </div>

                    {/* RIGHT COLUMN: Listing Table */}
                    <div className="credit-table-box">
                        <div className="credit-table-header-row">
                            <div className="credit-entries-select">
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
                        </div>

                        <div className="credit-table-container">
                            <table className="credit-data-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Service</th>
                                        <th>Credits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="credit-empty-row">No data available in table</td>
                                        </tr>
                                    ) : (
                                        paginatedLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td>{log.username}</td>
                                                <td>{log.service}</td>
                                                <td>{log.credits}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="credit-table-footer">
                            <div className="credit-showing-entries">
                                Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of {totalEntries} entries
                            </div>
                            <div className="credit-pagination">
                                <button 
                                    className="btn-credit-pag" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                    <button
                                        key={num}
                                        className={`btn-credit-pag ${currentPage === num ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(num)}
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button 
                                    className="btn-credit-pag" 
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
