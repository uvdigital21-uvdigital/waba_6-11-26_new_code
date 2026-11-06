import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import './DurationLicence.css'

const VALIDITY_PRESETS = [
    { id: '3 days', days: 3, value: '3', label: 'days' },
    { id: '7 days', days: 7, value: '7', label: 'days' },
    { id: '1 month', days: 30, value: '1', label: 'month' },
    { id: '3 months', days: 90, value: '3', label: 'months' },
    { id: '6 months', days: 180, value: '6', label: 'months' },
    { id: '1 year', days: 365, value: '1', label: 'year' },
    { id: '2 years', days: 730, value: '2', label: 'years' },
]

const DEFAULT_DURATION_LICENSES = [
    { id: 1, username: 'ankitbhai', licenseId: 'DC0I9KZMZFWBN2', days: 365, expiryDate: '06-07-2027 10:53 (in a year)', status: 'Active' },
    { id: 2, username: 'opera', licenseId: '8AEZRDHBP91NZW', days: 180, expiryDate: '30-12-2026 10:03 (in 6 months)', status: 'Active' },
    { id: 3, username: 'empire', licenseId: 'XF7GS9GGTEJ4DV', days: 365, expiryDate: '19-06-2027 08:56 (in a year)', status: 'Active' },
    { id: 4, username: 'pankajpandya', licenseId: 'EXZMVDF9JNEZK7', days: 365, expiryDate: '21-05-2027 15:01 (in 10 months)', status: 'Active' },
    { id: 5, username: 'jayantilal', licenseId: 'TSMFM8AH1BFDQC', days: 90, expiryDate: '03-08-2026 11:20 (in a month)', status: 'Active' },
    { id: 6, username: 'parshwa', licenseId: 'DQW7D5RQ89CP0', days: 365, expiryDate: '30-04-2027 18:10 (in 10 months)', status: 'Active' },
    { id: 7, username: 'vivekbhai', licenseId: 'MYLOMSQ30K7MBN', days: 180, expiryDate: '20-07-2026 17:57 (in 13 days)', status: 'Active' },
    { id: 8, username: 'qpowinfotech', licenseId: 'LZJ6PWTVTAON2E', days: 365, expiryDate: '19-12-2026 18:33 (in 5 months)', status: 'Active' },
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
    { id: 11, username: 'ankitbhai' },
    { id: 12, username: 'jayantilal' },
    { id: 13, username: 'qpowinfotech' },
]

export default function DurationLicence() {
    const { setTitle } = useTitle()

    // Load users list for dropdown filter
    const [users] = useState(() => {
        const saved = localStorage.getItem('wa_user_list')
        if (saved) {
            return JSON.parse(saved)
        }
        return DEFAULT_USERS
    })

    // Load licenses
    const [licenses, setLicenses] = useState(() => {
        const saved = localStorage.getItem('wa_duration_licenses_list')
        return saved ? JSON.parse(saved) : DEFAULT_DURATION_LICENSES
    })

    useEffect(() => {
        setTitle('DURATION License List')
    }, [setTitle])

    // Save licenses
    useEffect(() => {
        localStorage.setItem('wa_duration_licenses_list', JSON.stringify(licenses))
    }, [licenses])

    // Filter states
    const [selectedUserFilter, setSelectedUserFilter] = useState('')
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('All') // 'All', 'Active', 'Expired'

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [modalSelectedUser, setModalSelectedUser] = useState('')
    const [modalSelectedValidity, setModalSelectedValidity] = useState('3 days')

    // Table settings
    const [entriesCount, setEntriesCount] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)

    const handleGenerateLicenseSubmit = (e) => {
        e.preventDefault()
        if (!modalSelectedUser) {
            alert('Please select a user to generate the license.')
            return
        }

        const preset = VALIDITY_PRESETS.find(p => p.id === modalSelectedValidity)
        const days = preset ? preset.days : 3

        // Calculate Expiry Date
        const now = new Date()
        now.setDate(now.getDate() + days)
        
        // Format Expiry: DD-MM-YYYY HH:mm
        const day = String(now.getDate()).padStart(2, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = now.getFullYear()
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        
        // Descriptive label e.g. "in 3 months" or "in 3 days"
        let relativeDesc = `in ${preset.value} ${preset.label}`
        if (days === 365) relativeDesc = 'in a year'
        if (days === 730) relativeDesc = 'in 2 years'
        if (days === 30) relativeDesc = 'in a month'
        
        const expiryStr = `${day}-${month}-${year} ${hours}:${minutes} (${relativeDesc})`

        // Random 14 char capitalized License ID matching: DC0I9KZMZFWBN2
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let randKey = ''
        for (let i = 0; i < 14; i++) {
            randKey += chars.charAt(Math.floor(Math.random() * chars.length))
        }

        const newLic = {
            id: Date.now(),
            username: modalSelectedUser,
            licenseId: randKey,
            days: days,
            expiryDate: expiryStr,
            status: 'Active'
        }

        setLicenses([newLic, ...licenses])
        setModalSelectedUser('')
        setModalSelectedValidity('3 days')
        setShowModal(false)
    }

    // Filter licenses list
    const filteredLicenses = licenses.filter(lic => {
        if (selectedUserFilter && lic.username !== selectedUserFilter) {
            return false
        }
        if (selectedStatusFilter !== 'All') {
            if (selectedStatusFilter === 'Active' && lic.status !== 'Active') {
                return false
            }
            if (selectedStatusFilter === 'Expired' && lic.status !== 'Expired') {
                return false
            }
        }
        return true
    })

    // Pagination math
    const totalEntries = filteredLicenses.length
    const startIndex = (currentPage - 1) * entriesCount
    const endIndex = Math.min(startIndex + entriesCount, totalEntries)
    const paginatedLicenses = filteredLicenses.slice(startIndex, endIndex)
    const totalPages = Math.ceil(totalEntries / entriesCount)

    return (
        <div className="dur-list-page">
            <div className="dur-list-card">
                {/* Header Row */}
                <div className="dur-header-row">
                    <div className="dur-header-left">
                        <div className="dur-avatar-icon">
                            {/* License document check icon */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                        </div>
                        <h1 className="dur-header-title">DURATION License List</h1>
                        <button className="btn-generate-dur" onClick={() => setShowModal(true)}>
                            Generate New DURATION License
                        </button>
                    </div>

                    <div className="dur-header-right">
                        <select 
                            className="dur-header-select"
                            value={selectedUserFilter}
                            onChange={(e) => {
                                setSelectedUserFilter(e.target.value)
                                setCurrentPage(1)
                            }}
                        >
                            <option value="">Select By UserName</option>
                            {users.map(u => (
                                <option key={u.id} value={u.username}>{u.username}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sub Filters Row */}
                <div className="dur-sub-filters">
                    <div className="dur-entries-select">
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

                    <div className="dur-filters-right">
                        {/* Outline tabs selection */}
                        <div className="dur-status-tabs">
                            <button 
                                className={`btn-dur-tab btn-dur-tab-all ${selectedStatusFilter === 'All' ? 'active' : ''}`}
                                onClick={() => setSelectedStatusFilter('All')}
                            >
                                All
                            </button>
                            <button 
                                className={`btn-dur-tab btn-dur-tab-active ${selectedStatusFilter === 'Active' ? 'active' : ''}`}
                                onClick={() => setSelectedStatusFilter('Active')}
                            >
                                Active
                            </button>
                            <button 
                                className={`btn-dur-tab btn-dur-tab-expired ${selectedStatusFilter === 'Expired' ? 'active' : ''}`}
                                onClick={() => setSelectedStatusFilter('Expired')}
                            >
                                Expired
                            </button>
                        </div>

                        <div className="dur-date-badge">
                            July 7, 2025 - July 7, 2026
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="dur-table-container">
                    <table className="dur-data-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>License ID</th>
                                <th>Days</th>
                                <th>License Expiry</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLicenses.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="dur-empty-row">No data available in table</td>
                                </tr>
                            ) : (
                                paginatedLicenses.map((lic) => (
                                    <tr key={lic.id}>
                                        <td>{lic.username}</td>
                                        <td><code>{lic.licenseId}</code></td>
                                        <td>{lic.days}</td>
                                        <td>
                                            <span style={{ marginRight: 8 }}>{lic.expiryDate}</span>
                                            <span className={lic.status === 'Active' ? 'dur-badge-active' : 'dur-badge-expired'}>
                                                {lic.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="dur-table-footer">
                    <div className="dur-showing-entries">
                        Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of {totalEntries} entries
                    </div>
                    <div className="dur-pagination">
                        <button 
                            className="btn-dur-pag" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                            <button
                                key={num}
                                className={`btn-dur-pag ${currentPage === num ? 'active' : ''}`}
                                onClick={() => setCurrentPage(num)}
                            >
                                {num}
                            </button>
                        ))}
                        <button 
                            className="btn-dur-pag" 
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal: Generate New License */}
            {showModal && (
                <div className="user-modal-overlay">
                    <div className="user-modal-card modal-width-notice">
                        <div className="generate-modal-header">
                            <h3 className="generate-modal-title">Generate License</h3>
                            <button 
                                type="button" 
                                className="user-modal-close-btn"
                                style={{ color: '#ffffff' }}
                                onClick={() => setShowModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleGenerateLicenseSubmit}>
                            <div className="generate-modal-body">
                                <label className="generate-modal-label">Select User:</label>
                                <select 
                                    className="generate-modal-select"
                                    value={modalSelectedUser}
                                    onChange={(e) => setModalSelectedUser(e.target.value)}
                                    required
                                >
                                    <option value="">Select By UserName</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.username}>{u.username}</option>
                                    ))}
                                </select>

                                <label className="generate-modal-label">License Validity:</label>
                                <div className="validity-pills-container">
                                    {VALIDITY_PRESETS.map(preset => (
                                        <div 
                                            key={preset.id}
                                            className={`validity-pill ${modalSelectedValidity === preset.id ? 'selected' : ''}`}
                                            onClick={() => setModalSelectedValidity(preset.id)}
                                        >
                                            <span className="validity-pill-num">{preset.value}</span>
                                            <span className="validity-pill-label">{preset.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="user-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn-user-discard btn-generate-cancel"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-user-save btn-generate-submit"
                                    disabled={!modalSelectedUser}
                                >
                                    Generate License
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
