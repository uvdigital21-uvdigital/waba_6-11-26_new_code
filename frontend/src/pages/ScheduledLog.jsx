import React, { useState, useEffect } from 'react'
import api from '../services/api.js'
import { useTitle } from '../context/TitleContext.jsx'
import DateRangePicker from '../components/DateRangePicker.jsx'

export default function ScheduledLog() {
    const { setTitle } = useTitle()
    const [scheduledList, setScheduledList] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const [searchBy, setSearchBy] = useState('Name')
    const [searchQuery, setSearchQuery] = useState('')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [selectedRows, setSelectedRows] = useState([])
    const [dateRange, setDateRange] = useState('All Time')

    useEffect(() => {
        setTitle('Scheduled Log')
        fetchScheduledCampaigns()
    }, [setTitle])

    const fetchScheduledCampaigns = async () => {
        setIsLoading(true)
        try {
            const response = await api.get('/campaign/scheduled?all=true')
            if (response.data && Array.isArray(response.data.data)) {
                setScheduledList(response.data.data)
            }
        } catch (err) {
            console.error('Failed to load scheduled log:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this scheduled campaign?')) return
        try {
            await api.delete(`/campaign/scheduled/${id}`)
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to cancel campaign:', err)
            alert(err.response?.data?.message || 'Failed to cancel scheduled campaign.')
        }
    }

    const handleRunNow = async (id) => {
        if (!window.confirm('Do you want to send this campaign immediately?')) return
        try {
            const res = await api.post(`/campaign/scheduled/${id}/run-now`)
            if (res.data?.success) {
                alert(res.data.message || 'Campaign executed successfully!')
            } else {
                alert(res.data?.message || 'Campaign execution failed.')
            }
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to run campaign now:', err)
            const errMsg = err.response?.data?.message || err.message || 'Failed to trigger campaign execution.'
            alert(errMsg)
            fetchScheduledCampaigns()
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this log entry?')) return
        try {
            await api.delete(`/campaign/scheduled/${id}`)
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to delete log entry:', err)
            alert(err.response?.data?.message || 'Failed to delete log entry.')
        }
    }

    // Filter list by search query & date range
    const filteredList = scheduledList.filter(item => {
        // Filter by date range or single date
        if (dateRange && dateRange !== 'All Time') {
            let startDate, endDate
            if (dateRange.includes(' - ')) {
                const [startStr, endStr] = dateRange.split(' - ')
                startDate = new Date(startStr)
                endDate = new Date(endStr)
            } else {
                startDate = new Date(dateRange)
                endDate = new Date(dateRange)
            }

            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                startDate.setHours(0, 0, 0, 0)
                endDate.setHours(23, 59, 59, 999)

                const rawDate = item.scheduled_at || item.scheduledAt || item.created_at || item.createdAt || item.date
                if (!rawDate) return false

                let itemDate = new Date(rawDate)
                if (isNaN(itemDate.getTime())) {
                    const parts = String(rawDate).trim().split(/[\s,T]+/)
                    if (parts.length > 0) {
                        const dateParts = parts[0].split(/[\/\-.]/)
                        if (dateParts.length === 3) {
                            if (dateParts[0].length === 4) {
                                itemDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
                            } else if (dateParts[2].length === 4) {
                                itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0])
                            }
                        }
                    }
                }
                if (isNaN(itemDate.getTime())) return false
                if (itemDate < startDate || itemDate > endDate) {
                    return false
                }
            }
        }

        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase().trim()
        const cName = (item.campaign_name || '').toLowerCase()
        const tName = (item.template_name || '').toLowerCase()
        return cName.includes(q) || tName.includes(q)
    })

    return (
        <div className="dashboard-content">
            <div className="scheduled-log-card">
                {/* Header Banner */}
                <div className="quick-campaign-header">
                    <div className="whatsapp-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M19.007 4.93A9.873 9.873 0 0 0 12.008 2c-5.45 0-9.885 4.437-9.888 9.889A9.856 9.856 0 0 0 3.63 17.15l-1.587 5.8 5.937-1.557a9.88 9.88 0 0 0 4.73 1.206h.004c5.449 0 9.883-4.437 9.887-9.889a9.854 9.854 0 0 0-2.894-6.98ZM12.008 20.09h-.004a8.09 8.09 0 0 1-4.13-1.127l-.296-.176-3.064.803.818-2.99-.193-.307a8.082 8.082 0 0 1-1.24-4.51c0-4.469 3.637-8.106 8.108-8.106a8.094 8.094 0 0 1 5.733 2.378 8.092 8.092 0 0 1 2.373 5.737c-.003 4.47-3.64 8.108-8.105 8.108Z" />
                        </svg>
                    </div>
                    <h1>Schedule Message Log</h1>
                </div>

                {/* Filters Section */}
                <div className="template-search-section" style={{ marginBottom: '24px' }}>
                    <div className="header-filters" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search here..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: '1', minWidth: '220px' }}
                        />

                        <button className="btn-send-now" style={{ padding: '10px 24px', fontSize: '13px' }} onClick={fetchScheduledCampaigns}>
                            Refresh
                        </button>
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
                                        checked={filteredList.length > 0 && selectedRows.length === filteredList.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedRows(filteredList.map(row => row.id))
                                            } else {
                                                setSelectedRows([])
                                            }
                                        }}
                                    />
                                </th>
                                <th>Campaign Name</th>
                                <th>Template</th>
                                <th>Total Numbers</th>
                                <th>Scheduled Date & Time</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="no-data">
                                        Loading persistent scheduled log...
                                    </td>
                                </tr>
                            ) : filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="no-data">
                                        No scheduled campaigns found in database.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((row) => (
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
                                        <td style={{ fontWeight: '600', color: '#111827' }}>{row.campaign_name}</td>
                                        <td>
                                            <span style={{ backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                                                {row.template_name}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{row.total_numbers}</td>
                                        <td style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '500' }}>
                                            {row.scheduled_at ? new Date(row.scheduled_at).toLocaleString() : 'N/A'}
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                backgroundColor: row.status === 'completed' ? '#dcfce7' : row.status === 'scheduled' ? '#e0e7ff' : row.status === 'running' ? '#fef3c7' : '#fee2e2',
                                                color: row.status === 'completed' ? '#166534' : row.status === 'scheduled' ? '#3730a3' : row.status === 'running' ? '#92400e' : '#991b1b'
                                            }}>
                                                {row.status === 'scheduled' ? '⏱️ Scheduled' : row.status === 'running' ? '⏳ Processing' : row.status === 'completed' ? '✅ Completed' : `❌ ${row.status}`}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                {row.status === 'scheduled' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleRunNow(row.id)}
                                                            title="Run Now"
                                                            style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                                        >
                                                            🚀 Run Now
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancel(row.id)}
                                                            title="Cancel Schedule"
                                                            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                )}
                                                {row.status === 'failed' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleRunNow(row.id)}
                                                            title="Retry Campaign"
                                                            style={{ backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                                        >
                                                            ↻ Retry
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(row.id)}
                                                            title="Delete Log"
                                                            style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                                        >
                                                            🗑️ Delete
                                                        </button>
                                                    </>
                                                )}
                                                {(row.status === 'completed' || row.status === 'cancelled') && (
                                                    <button
                                                        onClick={() => handleDelete(row.id)}
                                                        title="Delete Log"
                                                        style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                )}
                                            </div>
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
                        Showing 1 to {filteredList.length} of {filteredList.length} entries
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
    )
}