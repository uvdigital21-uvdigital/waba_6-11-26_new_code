import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import './VoucherManage.css'

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
]

export default function VoucherManage() {
    const { setTitle } = useTitle()

    // Load vouchers list
    const [vouchers, setVouchers] = useState(() => {
        const saved = localStorage.getItem('wa_vouchers_list')
        return saved ? JSON.parse(saved) : []
    })

    // Load users list to apply credits upon redemption
    const [users, setUsers] = useState(() => {
        const saved = localStorage.getItem('wa_user_list')
        return saved ? JSON.parse(saved) : DEFAULT_USERS
    })

    useEffect(() => {
        setTitle('Voucher Master')
    }, [setTitle])

    // Save vouchers to local storage
    useEffect(() => {
        localStorage.setItem('wa_vouchers_list', JSON.stringify(vouchers))
    }, [vouchers])

    // Filter states
    const [statusFilter, setStatusFilter] = useState('PENDING') // 'ALL', 'PENDING', 'REDEEMED'

    // Modals states
    const [showGenerateModal, setShowGenerateModal] = useState(false)
    const [showRedeemModal, setShowRedeemModal] = useState(false)

    // Form states
    const [amount, setAmount] = useState(0)
    const [service, setService] = useState('DURATION')
    const [redeemCode, setRedeemCode] = useState('')
    const [successBanner, setSuccessBanner] = useState('')

    // Table settings
    const [entriesCount, setEntriesCount] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)

    // Generate Voucher Handler
    const handleGenerateVoucherSubmit = (e) => {
        e.preventDefault()
        if (amount <= 0) {
            alert('Please enter a valid voucher amount.')
            return
        }

        // Random code format VCH-XXXXXX
        const randCode = 'VCH-' + Math.random().toString(36).substr(2, 6).toUpperCase()

        const newVoucher = {
            id: Date.now(),
            code: randCode,
            createdBy: 'admin',
            amount: amount,
            service: service,
            redeemBy: '-',
            status: 'PENDING',
            generatedOn: new Date().toLocaleString(),
            redeemedOn: '-'
        }

        setVouchers([newVoucher, ...vouchers])
        setAmount(0)
        setService('DURATION')
        setShowGenerateModal(false)

        setSuccessBanner(`Voucher ${randCode} generated successfully!`)
        setTimeout(() => setSuccessBanner(''), 4000)
    }

    // Redeem Voucher Handler
    const handleRedeemVoucherSubmit = (e) => {
        e.preventDefault()
        if (!redeemCode) return

        const foundIndex = vouchers.findIndex(v => v.code === redeemCode)

        if (foundIndex === -1) {
            alert('Error: Voucher code not found.')
            return
        }

        const voucher = vouchers[foundIndex]

        if (voucher.status === 'REDEEMED') {
            alert('Error: This voucher code has already been redeemed.')
            return
        }

        // Apply voucher credits to a user (e.g. opera)
        const targetUsername = users.length > 0 ? users[0].username : 'opera'
        
        // Update user list
        const savedUsers = localStorage.getItem('wa_user_list')
        const currentUsersList = savedUsers ? JSON.parse(savedUsers) : [...users]

        const updatedUsersList = currentUsersList.map(u => {
            if (u.username === targetUsername) {
                const currentCreditVal = Number(u.credit) || 0
                return {
                    ...u,
                    credit: String(currentCreditVal + voucher.amount)
                }
            }
            return u
        })

        localStorage.setItem('wa_user_list', JSON.stringify(updatedUsersList))
        setUsers(updatedUsersList)

        // Update voucher status
        const updatedVouchers = vouchers.map((v, idx) => {
            if (idx === foundIndex) {
                return {
                    ...v,
                    status: 'REDEEMED',
                    redeemBy: targetUsername,
                    redeemedOn: new Date().toLocaleString()
                }
            }
            return v
        })

        setVouchers(updatedVouchers)
        setRedeemCode('')
        setShowRedeemModal(false)

        setSuccessBanner(`Successfully redeemed ${voucher.amount} credits for ${targetUsername}!`)
        setTimeout(() => setSuccessBanner(''), 4000)
    }

    // Filter logic
    const filteredVouchers = vouchers.filter(v => {
        if (statusFilter === 'ALL') return true
        return v.status === statusFilter
    })

    // Pagination math
    const totalEntries = filteredVouchers.length
    const startIndex = (currentPage - 1) * entriesCount
    const endIndex = Math.min(startIndex + entriesCount, totalEntries)
    const paginatedVouchers = filteredVouchers.slice(startIndex, endIndex)
    const totalPages = Math.ceil(totalEntries / entriesCount)

    return (
        <div className="voucher-page">
            {successBanner && (
                <div className="success-banner" style={{ marginBottom: 16 }}>
                    {successBanner}
                </div>
            )}

            <div className="voucher-card">
                {/* Header Row */}
                <div className="vch-header-row">
                    <div className="vch-header-left">
                        <div className="vch-avatar-icon">
                            {/* Voucher master icon */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="16" rx="2" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                                <circle cx="8" cy="15" r="1.5" />
                                <circle cx="16" cy="15" r="1.5" />
                            </svg>
                        </div>
                        <h1 className="vch-header-title">Voucher Master</h1>
                        <button className="btn-generate-vch" onClick={() => setShowGenerateModal(true)}>
                            Generate Voucher
                        </button>
                    </div>

                    <div className="vch-header-center">
                        <button className="btn-redeem-vch-trigger" onClick={() => setShowRedeemModal(true)}>
                            Redeem Voucher
                        </button>
                    </div>

                    <div className="vch-header-right">
                        <select 
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setCurrentPage(1)
                            }}
                        >
                            <option value="ALL">ALL</option>
                            <option value="PENDING">PENDING</option>
                            <option value="REDEEMED">REDEEMED</option>
                        </select>
                    </div>
                </div>

                {/* Sub Filters Row */}
                <div className="vch-sub-filters">
                    <div className="vch-entries-select">
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

                    <div className="vch-date-badge">
                        July 7, 2025 - July 7, 2026
                    </div>
                </div>

                {/* Table Container */}
                <div className="vch-table-container">
                    <table className="vch-data-table">
                        <thead>
                            <tr>
                                <th>Voucher Code</th>
                                <th>Voucher CreatedBy</th>
                                <th>Amount</th>
                                <th>Service Type</th>
                                <th>RedeemBy</th>
                                <th>Status</th>
                                <th>Generated On</th>
                                <th>Redeem On</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="vch-empty-row">No data available in table</td>
                                </tr>
                            ) : (
                                paginatedVouchers.map((v) => (
                                    <tr key={v.id}>
                                        <td><code>{v.code}</code></td>
                                        <td>{v.createdBy}</td>
                                        <td>{v.amount}</td>
                                        <td>{v.service}</td>
                                        <td>{v.redeemBy}</td>
                                        <td>
                                            <span className={v.status === 'PENDING' ? 'vch-badge-pending' : 'vch-badge-redeemed'}>
                                                {v.status}
                                            </span>
                                        </td>
                                        <td>{v.generatedOn}</td>
                                        <td>{v.redeemedOn}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="vch-table-footer">
                    <div className="vch-showing-entries">
                        Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of {totalEntries} entries
                    </div>
                    <div className="vch-pagination">
                        <button 
                            className="btn-vch-pag" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                            <button
                                key={num}
                                className={`btn-vch-pag ${currentPage === num ? 'active' : ''}`}
                                onClick={() => setCurrentPage(num)}
                            >
                                {num}
                            </button>
                        ))}
                        <button 
                            className="btn-vch-pag" 
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal 1: Generate Voucher Code */}
            {showGenerateModal && (
                <div className="user-modal-overlay">
                    <div className="user-modal-card modal-width-notice">
                        <div className="vch-modal-card-header">
                            <h3 className="vch-modal-card-title">Generate Voucher Code</h3>
                            <button 
                                type="button" 
                                className="user-modal-close-btn"
                                onClick={() => setShowGenerateModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleGenerateVoucherSubmit}>
                            <div className="vch-modal-body">
                                <label className="vch-modal-label">Enter Amount:</label>
                                <input 
                                    type="number" 
                                    className="vch-modal-input" 
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    min="1"
                                    required
                                />

                                <label className="vch-modal-label">Select Service:</label>
                                <select 
                                    className="vch-modal-select"
                                    value={service}
                                    onChange={(e) => setService(e.target.value)}
                                    required
                                >
                                    <option value="DURATION">DURATION</option>
                                    <option value="WAPP">WAPP</option>
                                </select>
                            </div>
                            <div className="user-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn-user-discard btn-vch-cancel"
                                    onClick={() => setShowGenerateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-user-save btn-vch-submit"
                                >
                                    Generate Voucher
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Redeem Voucher */}
            {showRedeemModal && (
                <div className="user-modal-overlay">
                    <div className="user-modal-card modal-width-notice">
                        <div className="vch-modal-card-header">
                            <h3 className="vch-modal-card-title">Redeem Voucher</h3>
                            <button 
                                type="button" 
                                className="user-modal-close-btn"
                                onClick={() => setShowRedeemModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleRedeemVoucherSubmit}>
                            <div className="vch-modal-body">
                                <label className="vch-modal-label">Enter Voucher Code:</label>
                                <input 
                                    type="text" 
                                    className="vch-modal-input" 
                                    placeholder="enter voucher code"
                                    value={redeemCode}
                                    onChange={(e) => setRedeemCode(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="user-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn-user-discard btn-vch-cancel"
                                    onClick={() => {
                                        setRedeemCode('')
                                        setShowRedeemModal(false)
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-user-save btn-vch-submit"
                                    disabled={!redeemCode}
                                >
                                    Redeem Voucher
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
