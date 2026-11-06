import React, { useState, useEffect } from 'react'
import api from '../services/api.js'
import { useTitle } from '../context/TitleContext.jsx'
import BirthdayCampaignModal from '../components/BirthdayCampaignModal.jsx'
import CreditsBadge from '../components/CreditsBadge.jsx'

export default function SendBirthday() {
    const { setTitle } = useTitle()

    const [campaigns, setCampaigns] = useState([])
    const [historyLogs, setHistoryLogs] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [selectedRows, setSelectedRows] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCampaign, setEditingCampaign] = useState(null)

    const [creditsData, setCreditsData] = useState(null)
    const [isLoadingCredits, setIsLoadingCredits] = useState(true)

    const fetchCredits = async () => {
        try {
            setIsLoadingCredits(true)
            const res = await api.get('/credits/balance')
            if (res.data?.success) {
                setCreditsData(res.data)
            }
        } catch (_) {
        } finally {
            setIsLoadingCredits(false)
        }
    }

    useEffect(() => {
        setTitle('Send Birthday Campaign')
        fetchBirthdayCampaigns(true)
        fetchHistory(true)
        fetchCredits()

        const interval = setInterval(() => {
            fetchBirthdayCampaigns(false)
            fetchHistory(false)
        }, 15000)

        return () => clearInterval(interval)
    }, [setTitle])

    const fetchBirthdayCampaigns = async (showLoading = true) => {
        if (showLoading) setIsLoading(true)
        try {
            const response = await api.get('/birthday-campaigns')
            if (response.data && Array.isArray(response.data.data)) {
                setCampaigns(response.data.data)
            }
        } catch (err) {
            console.error('Failed to fetch birthday campaigns:', err)
        } finally {
            if (showLoading) setIsLoading(false)
        }
    }

    const fetchHistory = async (showLoading = true) => {
        if (showLoading) setIsLoadingHistory(true)
        try {
            const response = await api.get('/birthday-campaigns/history')
            if (response.data && Array.isArray(response.data.data)) {
                setHistoryLogs(response.data.data)
            }
        } catch (err) {
            console.error('Failed to fetch birthday history:', err)
        } finally {
            if (showLoading) setIsLoadingHistory(false)
        }
    }

    const handleAddCampaign = () => {
        setEditingCampaign(null)
        setIsModalOpen(true)
    }

    const handleEdit = (campaign) => {
        setEditingCampaign(campaign)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setEditingCampaign(null)
    }

    const handleSaveCampaign = () => {
        fetchBirthdayCampaigns()
        fetchHistory()
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this birthday campaign?')) return
        try {
            await api.delete(`/birthday-campaigns/${id}`)
            fetchBirthdayCampaigns()
        } catch (err) {
            console.error('Failed deleting birthday campaign:', err)
            alert('Failed to delete birthday campaign.')
        }
    }

    const handleToggleActive = async (id) => {
        try {
            await api.put(`/birthday-campaigns/${id}/toggle`)
            fetchBirthdayCampaigns()
        } catch (err) {
            console.error('Failed toggling birthday campaign:', err)
        }
    }

    return (
        <div className="dashboard-content">
            {/* Active Birthday Campaigns Card */}
            <div className="birthday-campaign-card">
                {/* Header */}
                <div className="quick-campaign-header birthday-campaign-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="whatsapp-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                <path d="M19.007 4.93A9.873 9.873 0 0 0 12.008 2c-5.45 0-9.885 4.437-9.888 9.889A9.856 9.856 0 0 0 3.63 17.15l-1.587 5.8 5.937-1.557a9.88 9.88 0 0 0 4.73 1.206h.004c5.449 0 9.883-4.437 9.887-9.889a9.854 9.854 0 0 0-2.894-6.98ZM12.008 20.09h-.004a8.09 8.09 0 0 1-4.13-1.127l-.296-.176-3.064.803.818-2.99-.193-.307a8.082 8.082 0 0 1-1.24-4.51c0-4.469 3.637-8.106 8.108-8.106a8.094 8.094 0 0 1 5.733 2.378 8.092 8.092 0 0 1 2.373 5.737c-.003 4.47-3.64 8.108-8.105 8.108Z" />
                            </svg>
                        </div>
                        <h1>Birthday Campaign</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#f0fdf4' }}>
                                {creditsData?.isDaysBased ? 'Subscription Validity:' : 'Available Credits:'}
                            </span>
                            <CreditsBadge creditsData={creditsData} featureKey="birthday" loading={isLoadingCredits} />
                        </div>
                        <button
                            className="btn-add-campaign"
                            onClick={handleAddCampaign}
                            disabled={creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.birthday === 0)}
                        >
                            + Add Campaign
                        </button>
                    </div>
                </div>

                {/* Table Controls */}
                <div className="birthday-table-controls">
                    <div className="table-controls-left">
                        <label className="show-entries-label">
                            Show
                            <select className="show-entries-select" defaultValue="10">
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            entries
                        </label>
                    </div>
                    <div className="table-controls-right">
                        <div className="date-range-picker">
                            <input
                                type="text"
                                className="date-range-input"
                                defaultValue="Active Campaigns"
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                {/* Campaigns Table */}
                <div className="birthday-table-wrapper">
                    <table className="birthday-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="th-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.length === campaigns.length && campaigns.length > 0}
                                        onChange={(e) => setSelectedRows(e.target.checked ? campaigns.map(c => c.id) : [])}
                                    />
                                </th>
                                <th className="th-name">Name</th>
                                <th className="th-dob">Date of Birth</th>
                                <th className="th-type">Type</th>
                                <th className="th-mobile">Mobile Number</th>
                                <th className="th-wish-time">Wish Time</th>
                                <th className="th-trigger">Next TriggerOn</th>
                                <th className="th-template">Template</th>
                                <th className="th-added-on">AddedOn</th>
                                <th className="th-active">Is Active</th>
                                <th className="th-action">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="11" className="no-data-cell">
                                        Loading birthday campaigns...
                                    </td>
                                </tr>
                            ) : campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="no-data-cell">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                campaigns.map(campaign => (
                                    <tr key={campaign.id} className="table-data-row">
                                        <td className="td-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.includes(campaign.id)}
                                                onChange={() => {
                                                    if (selectedRows.includes(campaign.id)) {
                                                        setSelectedRows(selectedRows.filter(id => id !== campaign.id))
                                                    } else {
                                                        setSelectedRows([...selectedRows, campaign.id])
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="td-name">{campaign.name}</td>
                                        <td className="td-dob">{campaign.dob}</td>
                                        <td className="td-type">{campaign.type}</td>
                                        <td className="td-mobile">{campaign.mobile}</td>
                                        <td className="td-wish-time">{campaign.wishTime}</td>
                                        <td className="td-trigger" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '500' }}>
                                            {campaign.nextTrigger}
                                        </td>
                                        <td className="td-template">{campaign.template}</td>
                                        <td className="td-added-on">{campaign.addedOn}</td>
                                        <td className="td-active">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(campaign.id)}
                                                style={{
                                                    padding: '3px 10px',
                                                    borderRadius: '12px',
                                                    border: 'none',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    backgroundColor: campaign.rawActive ? '#dcfce7' : '#fee2e2',
                                                    color: campaign.rawActive ? '#166534' : '#991b1b'
                                                }}
                                            >
                                                {campaign.isActive}
                                            </button>
                                        </td>
                                        <td className="td-action">
                                            <div className="action-buttons-campaign" style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    className="btn-edit-campaign"
                                                    onClick={() => handleEdit(campaign)}
                                                    style={{ backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-delete-campaign"
                                                    onClick={() => handleDelete(campaign.id)}
                                                    style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                >
                                                    Delete
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
                <div className="birthday-pagination">
                    <div className="pagination-info">
                        Showing {campaigns.length === 0 ? 0 : 1} to {campaigns.length} of {campaigns.length} entries
                    </div>
                    <div className="pagination-buttons">
                        <button type="button" className="btn-pagination" disabled>
                            Previous
                        </button>
                        <button type="button" className="btn-pagination" disabled>
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Birthday Wish Dispatch History Card */}
            <div className="birthday-campaign-card" style={{ marginTop: '24px' }}>
                <div className="birthday-campaign-header">
                    <div className="birthday-campaign-title">
                        <div className="birthday-icon" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>Birthday Message Dispatch History</h1>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>Logs of all automated birthday wishes triggered by the background worker</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={fetchHistory}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}
                    >
                        🔄 Refresh History
                    </button>
                </div>

                <div className="birthday-table-wrapper" style={{ marginTop: '16px' }}>
                    <table className="birthday-table">
                        <thead>
                            <tr className="table-header-row">
                                <th style={{ width: '50px' }}>#</th>
                                <th className="th-name">Recipient Name</th>
                                <th className="th-mobile">Mobile Number</th>
                                <th className="th-template">Template Name</th>
                                <th className="th-trigger">Dispatched Date & Time</th>
                                <th className="th-active">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingHistory ? (
                                <tr>
                                    <td colSpan="6" className="no-data-cell">Loading execution history...</td>
                                </tr>
                            ) : historyLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="no-data-cell">
                                        No birthday messages dispatched yet. The background scheduler worker checks every 30 seconds.
                                    </td>
                                </tr>
                            ) : (
                                historyLogs.map((log, index) => (
                                    <tr key={log.id} className="table-data-row">
                                        <td style={{ fontWeight: '500', color: '#6b7280' }}>{index + 1}</td>
                                        <td className="td-name" style={{ fontWeight: '600', color: '#111827' }}>{log.recipientName}</td>
                                        <td className="td-mobile" style={{ fontFamily: 'monospace' }}>{log.mobile}</td>
                                        <td className="td-template">
                                            <span style={{ backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                                                {log.template}
                                            </span>
                                        </td>
                                        <td className="td-trigger" style={{ fontSize: '12px', color: '#4b5563' }}>{log.sentAt}</td>
                                        <td className="td-active">
                                            <span style={{
                                                padding: '3px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                backgroundColor: log.status === 'sent' ? '#dcfce7' : '#fee2e2',
                                                color: log.status === 'sent' ? '#166534' : '#991b1b'
                                            }}>
                                                {log.status === 'sent' ? '✅ Sent' : '❌ Failed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Birthday Campaign Modal */}
            <BirthdayCampaignModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveCampaign}
                editingCampaign={editingCampaign}
            />
        </div>
    )
}