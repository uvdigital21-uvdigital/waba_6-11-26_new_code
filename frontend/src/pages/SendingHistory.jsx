import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import api from '../services/api.js'
import { useTitle } from '../context/TitleContext.jsx'
import DateRangePicker from '../components/DateRangePicker.jsx'
import { API_BASE_URL } from '../config.js'

export default function SendingHistory() {
    const { setTitle } = useTitle()

    // State for templates dropdown
    const [templates, setTemplates] = useState([])
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

    // State for history data
    const [historyData, setHistoryData] = useState([])
    const [isLoadingData, setIsLoadingData] = useState(true)

    // Filter controls
    const [selectedTemplate, setSelectedTemplate] = useState('')
    const [searchBy, setSearchBy] = useState('Number')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedType, setSelectedType] = useState('All Type')
    const [dateRange, setDateRange] = useState('All Time')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [selectedRows, setSelectedRows] = useState([])
    const [currentPage, setCurrentPage] = useState(1)

    const typeFilters = ['All Type', 'WEB', 'API', 'BIRTHDAY', 'B/A']

    useEffect(() => {
        setTitle('Sending History')
        fetchMetaTemplates()
        fetchHistory()

        // Socket.IO real-time connection setup
        const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '')
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        })

        const activeOrgId = localStorage.getItem('org_id') || 1
        socket.on('connect', () => {
            console.log('⚡ Connected to SendingHistory Socket.IO server')
            socket.emit('join_organization', activeOrgId)
        })

        const handleRealtimeUpdate = () => {
            console.log('⚡ SendingHistory real-time update event received! Refreshing history...')
            fetchHistory()
        }

        socket.on('sending_history_updated', handleRealtimeUpdate)
        socket.on('message_status_updated', handleRealtimeUpdate)
        socket.on('new_message', handleRealtimeUpdate)
        socket.on('new_campaign', handleRealtimeUpdate)

        // REPORT_LIVE_COUNTS_V1
        // Periodically refresh confirmed DB counts without reloading page.
        const reportRefreshTimer = setInterval(() => {
            if (!document.hidden) fetchHistory(true)
        }, 15000)

        return () => {
            socket.off('sending_history_updated', handleRealtimeUpdate)
            socket.off('message_status_updated', handleRealtimeUpdate)
            socket.off('new_message', handleRealtimeUpdate)
            socket.off('new_campaign', handleRealtimeUpdate)
            clearInterval(reportRefreshTimer)
            socket.disconnect()
        }
    }, [setTitle])

    // Fetch official templates from Meta API
    const fetchMetaTemplates = async () => {
        setIsLoadingTemplates(true)
        try {
            const response = await api.get('/meta-templates')
            const list = Array.isArray(response.data) ? response.data : (response.data?.data || [])
            setTemplates(list)
        } catch (err) {
            console.error('Failed to fetch meta templates:', err)
        } finally {
            setIsLoadingTemplates(false)
        }
    }

    // Fetch sending history entries from backend
    const fetchHistory = async (silent = false) => {
        if (!silent) setIsLoadingData(true)
        try {
            const response = await api.get('/reports/sending-history', { params: { _refresh: Date.now() } })
            if (response.data && Array.isArray(response.data.data)) {
                setHistoryData(response.data.data)
            }
        } catch (err) {
            console.error('Failed to fetch sending history:', err)
        } finally {
            if (!silent) setIsLoadingData(false)
        }
    }

    // Filter history entries based on user selections
    const filteredData = historyData.filter(item => {
        // Filter by template
        if (selectedTemplate && item.templateName !== selectedTemplate) {
            return false
        }

        // Filter by type button
        if (selectedType !== 'All Type' && item.type !== selectedType) {
            return false
        }

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

                const rawDate = item.rawDate || item.timestamp || item.created_at || item.createdAt || item.submitDate || item.submit_date || item.dateTime || item.date
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

        // Filter by search text
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase().trim()
            if (searchBy === 'Number') {
                const phoneStr = (item.phone || item.other || '').toLowerCase()
                if (!phoneStr.includes(q)) return false
            } else if (searchBy === 'Name') {
                const nameStr = (item.campaignName || '').toLowerCase()
                if (!nameStr.includes(q)) return false
            } else if (searchBy === 'Message') {
                const msgStr = (item.message || item.templateName || '').toLowerCase()
                if (!msgStr.includes(q)) return false
            }
        }

        return true
    })

    // Pagination slice
    const indexOfLastEntry = currentPage * entriesPerPage
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage
    const currentEntries = filteredData.slice(indexOfFirstEntry, indexOfLastEntry)

    const handleSearch = () => {
        setCurrentPage(1)
        fetchHistory()
    }

    const escapeCsvCell = (value) => {
        if (value === null || value === undefined || value === '') return '"—"'
        return `"${String(value).replace(/"/g, '""')}"`
    }

    const formatExportDate = (value) => {
        if (!value) return '—'
        const date = new Date(value)
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
    }

    // REAL_REPORT_EXPORT_ONLY_V1
    // Never invent phone numbers, delivery states or timestamps.
    const getFallbackRecipients = () => []

    const fetchRecipientsForExport = async (row) => {
        const targetId = row.rawId || row.id
        if (targetId) {
            try {
                const response = await api.get(`/reports/campaign/${targetId}/recipients`, { silent: true })
                const recipients = response.data?.data?.recipients
                if (response.data?.success && Array.isArray(recipients) && recipients.length > 0) return recipients
            } catch (err) {
                console.error(`Failed to fetch recipients for campaign ${targetId}:`, err)
            }
        }
        return getFallbackRecipients(row)
    }

    const buildRecipientExportRows = async (campaignRows) => {
        const recipientGroups = await Promise.all(campaignRows.map(async row => ({
            row,
            recipients: await fetchRecipientsForExport(row)
        })))

        return recipientGroups.flatMap(({ row, recipients }) => recipients.map(recipient => [
            row.rawId || row.id,
            row.type,
            row.campaignName || row.message || '',
            row.templateName || '',
            row.submitDate || row.rawDate || '',
            row.sentByName || 'Unknown user',
            row.sentByType || 'User',
            row.total ?? recipients.length,
            row.dlvd ?? 0,
            row.read ?? 0,
            row.failed ?? 0,
            recipient.phone || '',
            recipient.status || 'sent',
            formatExportDate(recipient.sent_at),
            formatExportDate(recipient.delivered_at),
            formatExportDate(recipient.read_at),
            recipient.error || recipient.error_message || '',
            recipient.message_id || recipient.wa_message_id || ''
        ]))
    }

    const downloadRecipientCsv = (rows, filename) => {
        const headers = [
            'Campaign ID', 'Type', 'Campaign Name', 'Template', 'Submit Date', 'Sent By', 'Sender Type',
            'Campaign Total', 'Total Delivered', 'Total Read', 'Total Failed',
            'Phone Number', 'Status', 'Sent At', 'Delivered At', 'Read At',
            'Failed Reason', 'Message ID'
        ]
        const csvContent = '\uFEFF' + [
            headers.map(escapeCsvCell).join(','),
            ...rows.map(row => row.map(escapeCsvCell).join(','))
        ].join('\r\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleDownloadAll = async () => {
        if (filteredData.length === 0) {
            alert('No data available to download.')
            return
        }

        const exportRows = await buildRecipientExportRows(filteredData)
        if (exportRows.length === 0) {
            alert('No recipient data available to download.')
            return
        }
        downloadRecipientCsv(exportRows, `sending_history_${new Date().toISOString().split('T')[0]}.csv`)
    }

    const handleResend = (row) => {
        alert(`Resend initiated for campaign: "${row.campaignName}" (${row.templateName || 'Template'})`)
    }

    const handleDownloadSingle = async (row) => {
        const exportRows = await buildRecipientExportRows([row])
        if (exportRows.length === 0) {
            alert('No recipient data available to download for this campaign.')
            return
        }
        downloadRecipientCsv(exportRows, `campaign_report_${row.rawId || row.id}.csv`)
    }

    const [selectedFailedRow, setSelectedFailedRow] = useState(null)
    const [failedRowErrors, setFailedRowErrors] = useState([]) // recipient-level error strings loaded from API
    const [isLoadingFailedErrors, setIsLoadingFailedErrors] = useState(false)
    const [copied, setCopied] = useState(false)

    // State for View Campaign Recipients Modal
    const [selectedViewCampaign, setSelectedViewCampaign] = useState(null)
    const [campaignRecipientsList, setCampaignRecipientsList] = useState([])
    const [isLoadingCampaignRecipients, setIsLoadingCampaignRecipients] = useState(false)
    const [recipientSearchQuery, setRecipientSearchQuery] = useState('')
    const [modalCurrentPage, setModalCurrentPage] = useState(1)
    const [modalEntriesPerPage, setModalEntriesPerPage] = useState(10)
    const [recipientStatus, setRecipientStatus] = useState('all')
    const [recipientCounts, setRecipientCounts] = useState({ all: 0, sent: 0, delivered: 0, read: 0, failed: 0 })
    const [recipientPagination, setRecipientPagination] = useState({ page: 1, total: 0, totalPages: 1 })
    const [resendJob, setResendJob] = useState(null)
    const [isResending, setIsResending] = useState(false)
    const [resendToast, setResendToast] = useState(null)

    const fetchModalRecipients = async (row = selectedViewCampaign, options = {}) => {
        if (!row) return
        const targetId = row.rawId || row.id
        const response = await api.get(`/reports/campaign/${targetId}/recipients`, {
            params: {
                status: recipientStatus === 'all' ? undefined : recipientStatus,
                search: recipientSearchQuery || undefined, page: modalCurrentPage, limit: modalEntriesPerPage
            }, silent: options.silent
        })
        const data = response.data?.data || {}
        setCampaignRecipientsList(data.recipients || [])
        setRecipientCounts(data.counts || {})
        setRecipientPagination(data.pagination || { page: 1, total: 0, totalPages: 1 })
        setResendJob(data.job || null)
        return data
    }

    const handleOpenViewCampaign = async (row) => {
        setSelectedViewCampaign(row)
        setRecipientSearchQuery('')
        setCampaignRecipientsList([])
        setModalCurrentPage(1)
        setRecipientStatus('all')
        setIsLoadingCampaignRecipients(true)

        const targetId = row.rawId || row.id

        if (targetId) {
            try {
                const response = await api.get(`/reports/campaign/${targetId}/recipients`, { params: { page: 1, limit: modalEntriesPerPage } })
                if (response.data && response.data.success && Array.isArray(response.data.data?.recipients) && response.data.data.recipients.length > 0) {
                    setCampaignRecipientsList(response.data.data.recipients)
                    setRecipientCounts(response.data.data.counts || {})
                    setRecipientPagination(response.data.data.pagination || {})
                    setResendJob(response.data.data.job || null)
                    setIsLoadingCampaignRecipients(false)
                    return
                }
            } catch (err) {
                console.error('Failed to fetch campaign recipients:', err)
            } finally {
                setIsLoadingCampaignRecipients(false)
            }
        }

        // NO_FAKE_RECIPIENT_FALLBACK_V1
        // Never fabricate recipient statuses when the API has no records.
        setCampaignRecipientsList([])
        setRecipientCounts({
            all: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0,
            queued: 0,
            sending: 0
        })
        setRecipientPagination({
            page: 1,
            total: 0,
            totalPages: 1
        })
        setIsLoadingCampaignRecipients(false)
    }

    useEffect(() => {
        if (!selectedViewCampaign) return
        const timer = setTimeout(() => fetchModalRecipients().catch(err => setResendToast({ error: true, message: err.response?.data?.message || err.message })), 300)
        return () => clearTimeout(timer)
    }, [selectedViewCampaign, recipientStatus, recipientSearchQuery, modalCurrentPage, modalEntriesPerPage])

    useEffect(() => {
        if (!selectedViewCampaign || !['queued', 'running', 'awaiting_webhooks'].includes(resendJob?.status)) return
        const timer = setInterval(() => fetchModalRecipients(selectedViewCampaign, { silent: true }).catch(() => { }), 4000)
        return () => clearInterval(timer)
    }, [selectedViewCampaign, resendJob?.status, recipientStatus, recipientSearchQuery, modalCurrentPage, modalEntriesPerPage])

    const confirmResend = async () => {
        const count = Number(recipientCounts[recipientStatus] || 0)
        const label = recipientStatus[0].toUpperCase() + recipientStatus.slice(1)
        const duplicateWarning = ['delivered', 'read'].includes(recipientStatus) ? '\n\nWarning: these recipients already received the message and may receive a duplicate.' : ''
        if (!window.confirm(`Resend template ${selectedViewCampaign.templateName} to ${count} numbers with status ${label}?${duplicateWarning}`)) return
        setIsResending(true)
        try {
            const response = await api.post(`/campaigns/${selectedViewCampaign.rawId || selectedViewCampaign.id}/resend`, { status: recipientStatus }, { silent: true })
            setResendToast({ error: false, message: `${response.data.queued} message(s) queued for resend.` })
            await fetchModalRecipients(selectedViewCampaign, { silent: true })
        } catch (err) {
            setResendToast({ error: true, message: err.response?.data?.message || 'Resend could not be started.' })
        } finally { setIsResending(false); setTimeout(() => setResendToast(null), 5000) }
    }

    const handleCopyError = (text) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="dashboard-content">
            <div className="sending-history-card">
                {/* Header Banner */}
                <div className="quick-campaign-header">
                    <div className="whatsapp-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M19.007 4.93A9.873 9.873 0 0 0 12.008 2c-5.45 0-9.885 4.437-9.888 9.889A9.856 9.856 0 0 0 3.63 17.15l-1.587 5.8 5.937-1.557a9.88 9.88 0 0 0 4.73 1.206h.004c5.449 0 9.883-4.437 9.887-9.889a9.854 9.854 0 0 0-2.894-6.98ZM12.008 20.09h-.004a8.09 8.09 0 0 1-4.13-1.127l-.296-.176-3.064.803.818-2.99-.193-.307a8.082 8.082 0 0 1-1.24-4.51c0-4.469 3.637-8.106 8.108-8.106a8.094 8.094 0 0 1 5.733 2.378 8.092 8.092 0 0 1 2.373 5.737c-.003 4.47-3.64 8.108-8.105 8.108Z" />
                        </svg>
                    </div>
                    <h1>Official Message History</h1>
                </div>

                {/* Filters Section */}
                <div className="template-search-section" style={{ marginBottom: '24px' }}>
                    <div className="header-filters" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                        {/* Official Template Dropdown */}
                        <select
                            className="filter-select"
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            style={{ minWidth: '220px' }}
                        >
                            <option value="">{isLoadingTemplates ? 'Loading templates...' : 'Select Official Template'}</option>
                            {templates.map((t, idx) => {
                                const name = typeof t === 'string' ? t : (t.name || t.id)
                                const lang = typeof t === 'object' && t.language ? ` (${t.language})` : ''
                                return (
                                    <option key={idx} value={name}>
                                        {name}{lang}
                                    </option>
                                )
                            })}
                        </select>

                        <div className="search-by-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="search-by-label" style={{ fontWeight: '700', fontSize: '13px', color: '#075e54' }}>Search by:</span>
                            <select
                                className="filter-select"
                                value={searchBy}
                                onChange={(e) => setSearchBy(e.target.value)}
                            >
                                <option value="Number">Number</option>
                                <option value="Name">Name</option>
                                <option value="Message">Message</option>
                            </select>
                        </div>

                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search here..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            style={{ flex: '1', minWidth: '200px' }}
                        />

                        <button className="btn-send-now" style={{ padding: '10px 22px', fontSize: '13px' }} onClick={handleSearch}>
                            Search
                        </button>

                        <button className="btn-schedule" style={{ padding: '10px 22px', fontSize: '13px' }} onClick={handleDownloadAll}>
                            Download All
                        </button>
                    </div>
                </div>

                {/* Controls Section */}
                <div className="sending-history-controls">
                    <div className="show-entries">
                        <span>Show</span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => {
                                setEntriesPerPage(Number(e.target.value))
                                setCurrentPage(1)
                            }}
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
                                        checked={filteredData.length > 0 && selectedRows.length === filteredData.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedRows(filteredData.map(row => row.id))
                                            } else {
                                                setSelectedRows([])
                                            }
                                        }}
                                    />
                                </th>
                                <th className="th-sortable">Type</th>
                                <th className="th-sortable">Total</th>
                                <th className="th-sortable">Message</th>
                                <th className="th-sortable">Submit Date</th>
                                <th className="th-sortable">Sent By</th>
                                <th className="th-sortable">SENT</th>
                                <th className="th-sortable">DLVD</th>
                                <th className="th-sortable">READ</th>
                                <th className="th-sortable">FAILED</th>
                                <th className="th-sortable">Other</th>
                                <th className="th-sortable" style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingData ? (
                                <tr>
                                    <td colSpan="12" className="no-data">
                                        Loading sending history...
                                    </td>
                                </tr>
                            ) : currentEntries.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="no-data">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                currentEntries.map((row) => (
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
                                        <td>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                backgroundColor: row.type === 'BIRTHDAY' ? '#fef3c7' : '#e0e7ff',
                                                color: row.type === 'BIRTHDAY' ? '#92400e' : '#3730a3'
                                            }}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{row.total}</td>
                                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row.message}
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#4b5563' }}>
                                            {(() => {
                                                const dStr = row.rawDate || row.submitDate;
                                                if (!dStr) return '-';
                                                let d = new Date(dStr);
                                                if (isNaN(d.getTime()) || (!String(dStr).includes('Z') && !String(dStr).includes('+') && !String(dStr).includes('T'))) {
                                                    const cleanStr = String(dStr).trim().replace(' ', 'T');
                                                    const utcAttempt = new Date(cleanStr + 'Z');
                                                    if (!isNaN(utcAttempt.getTime())) d = utcAttempt;
                                                }
                                                return !isNaN(d.getTime())
                                                    ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
                                                    : String(dStr);
                                            })()}
                                        </td>
                                        <td style={{ minWidth: '130px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1f2937' }}>
                                                {row.sentByName || 'Unknown user'}
                                            </div>
                                            <span style={{
                                                display: 'inline-block',
                                                marginTop: '3px',
                                                padding: '2px 7px',
                                                borderRadius: '999px',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                backgroundColor: row.sentByType === 'Team Member' ? '#dcfce7' : '#e0e7ff',
                                                color: row.sentByType === 'Team Member' ? '#166534' : '#3730a3'
                                            }}>
                                                {row.sentByType || 'User'}
                                            </span>
                                        </td>
                                        <td style={{ color: '#475569', fontWeight: '700' }}>{row.sent ?? row.total ?? 0}</td>
                                        <td style={{ color: '#2563eb', fontWeight: '600' }}>{row.dlvd ?? 0}</td>
                                        <td style={{ color: '#059669', fontWeight: '600' }}>{row.read ?? 0}</td>
                                        <td>
                                            {row.failed > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setSelectedFailedRow(row)
                                                        setFailedRowErrors([])
                                                        setIsLoadingFailedErrors(true)
                                                        try {
                                                            const targetId = row.rawId || row.id
                                                            const resp = await api.get(`/reports/campaign/${targetId}/recipients`)
                                                            const recips = resp.data?.data?.recipients || []
                                                            const errors = recips
                                                                .filter(r => r.error)
                                                                .map(r => ({ phone: r.phone, error: r.error, status: r.status }))
                                                            setFailedRowErrors(errors)
                                                        } catch (_) { }
                                                        setIsLoadingFailedErrors(false)
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        backgroundColor: '#fee2e2',
                                                        color: '#b91c1c',
                                                        border: '1px solid #fca5a5',
                                                        borderRadius: '6px',
                                                        padding: '3px 8px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                    }}
                                                    title="Click to view Meta error failure reason"
                                                >
                                                    <span>{row.failed}</span>
                                                    <span style={{ fontSize: '10px', textDecoration: 'underline' }}>Reason</span>
                                                </button>
                                            ) : (
                                                <span style={{ color: '#6b7280' }}>0</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#6b7280', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row.other}
                                        </td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenViewCampaign(row)}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#10b981',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontWeight: '600',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    marginRight: '6px',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                                title="View all recipient numbers and details"
                                            >
                                                👁️ View
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleDownloadSingle(row)}
                                                title="Download CSV"
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px' }}
                                            >
                                                ⬇️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Campaign Recipients Details Modal */}
                {selectedViewCampaign && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.55)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 99998,
                            padding: '16px',
                            backdropFilter: 'blur(2px)'
                        }}
                        onClick={() => setSelectedViewCampaign(null)}
                    >
                        <div
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '12px',
                                maxWidth: '780px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid #e5e7eb',
                                backgroundColor: '#f8fafc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderTopLeftRadius: '12px',
                                borderTopRightRadius: '12px'
                            }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                                        📊 {selectedViewCampaign.campaignName || 'Campaign Details'}
                                    </h3>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                        Template: <strong>{selectedViewCampaign.templateName || 'Direct'}</strong> &bull; Submitted: {selectedViewCampaign.submitDate || '—'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedViewCampaign(null)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                        color: '#64748b'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Summary Badges Cards */}
                            {(() => {
                                const totalRecips = recipientCounts.all ?? selectedViewCampaign.total ?? 0;
                                const failedRecips = recipientCounts.failed ?? selectedViewCampaign.failed ?? 0;
                                const readRecips = recipientCounts.read ?? selectedViewCampaign.read ?? 0;
                                // REPORT_EXCLUSIVE_DELIVERED_V1: read and delivered are separate current statuses
                                const dlvdRecips = Number(recipientCounts.delivered || 0);

                                return (
                                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Numbers</div>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{totalRecips}</div>
                                        </div>
                                        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase' }}>Delivered</div>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#1d4ed8', marginTop: '2px' }}>{dlvdRecips}</div>
                                        </div>
                                        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>Read</div>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>{readRecips}</div>
                                        </div>
                                        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase' }}>Failed</div>
                                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#b91c1c', marginTop: '2px' }}>{failedRecips}</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Search Filter & Entries Controls */}
                            {(() => {
                                const totalFiltered = Number(recipientPagination.total || 0);
                                const totalPages = Number(recipientPagination.totalPages || 1);
                                const safePage = Math.min(modalCurrentPage, totalPages);
                                const startIdx = (safePage - 1) * modalEntriesPerPage;
                                const endIdx = Math.min(startIdx + modalEntriesPerPage, totalFiltered);
                                const paginatedRecipients = campaignRecipientsList;
                                const activeJob = ['queued', 'running', 'awaiting_webhooks'].includes(resendJob?.status);

                                return (
                                    <>
                                        {resendToast && <div style={{ margin: '10px 20px 0', padding: '9px 12px', borderRadius: 7, fontSize: 12.5, background: resendToast.error ? '#fef2f2' : '#ecfdf5', color: resendToast.error ? '#b91c1c' : '#166534', border: `1px solid ${resendToast.error ? '#fecaca' : '#86efac'}` }}>{resendToast.message}</div>}
                                        {resendJob && <div style={{ margin: '10px 20px 0', padding: '9px 12px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 12.5, fontWeight: 600 }}>Resending: {Number(resendJob.sent || 0) + Number(resendJob.failed || 0)} of {resendJob.total_count} sent • {resendJob.delivered || 0} delivered • {resendJob.failed || 0} failed {resendJob.status === 'completed' ? '• Complete' : ''}</div>}
                                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                placeholder="🔍 Search recipient phone or status..."
                                                value={recipientSearchQuery}
                                                onChange={(e) => {
                                                    setRecipientSearchQuery(e.target.value);
                                                    setModalCurrentPage(1);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    minWidth: '240px',
                                                    padding: '7px 12px',
                                                    fontSize: '13px',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '6px',
                                                    outline: 'none'
                                                }}
                                            />
                                            <select value={recipientStatus} onChange={e => { setRecipientStatus(e.target.value); setModalCurrentPage(1) }} style={{ padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}>
                                                <option value="all">All ({recipientCounts.all || 0})</option>
                                                <option value="sent">Sent ({recipientCounts.sent || 0})</option>
                                                <option value="delivered">Delivered ({recipientCounts.delivered || 0})</option>
                                                <option value="read">Read ({recipientCounts.read || 0})</option>
                                                <option value="failed">Failed ({recipientCounts.failed || 0})</option>
                                            </select>
                                            <button type="button" onClick={confirmResend} disabled={recipientStatus === 'all' || !recipientCounts[recipientStatus] || isResending || activeJob} style={{ padding: '7px 13px', border: 0, borderRadius: 6, fontWeight: 700, fontSize: 12.5, color: '#fff', background: recipientStatus === 'all' || !recipientCounts[recipientStatus] || activeJob ? '#94a3b8' : '#16a34a', cursor: recipientStatus === 'all' || !recipientCounts[recipientStatus] || activeJob ? 'not-allowed' : 'pointer' }}>
                                                {isResending ? '⟳ Queuing…' : activeJob ? 'Resending…' : '↻ Resend'}
                                            </button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569' }}>
                                                <span>Show</span>
                                                <select
                                                    value={modalEntriesPerPage}
                                                    onChange={(e) => {
                                                        setModalEntriesPerPage(Number(e.target.value));
                                                        setModalCurrentPage(1);
                                                    }}
                                                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                                >
                                                    <option value="10">10</option>
                                                    <option value="25">25</option>
                                                    <option value="50">50</option>
                                                    <option value="100">100</option>
                                                    <option value="500">500</option>
                                                </select>
                                                <span>entries</span>
                                            </div>
                                        </div>

                                        {/* Recipients Table */}
                                        <div style={{ padding: '16px 20px', maxHeight: '340px', overflowY: 'auto' }}>
                                            {isLoadingCampaignRecipients ? (
                                                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                                                    Loading recipients list...
                                                </div>
                                            ) : totalFiltered === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                                                    No recipient records found for this campaign.
                                                </div>
                                            ) : (
                                                <table style={{ width: '100%', fontSize: '12.5px', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                                            <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '600' }}>#</th>
                                                            <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '600' }}>Phone Number</th>
                                                            <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '600' }}>Status</th>
                                                            <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '600' }}>Sent Time</th>
                                                            <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '600' }}>Delivered / Read</th>
                                                            <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '600' }}>Details / Error</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedRecipients.map((recip, i) => {
                                                            const s = (recip.status || 'unknown').toLowerCase();
                                                            let badgeStyle = { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Sent ⚪' };
                                                            if (s === 'read') badgeStyle = { bg: '#dcfce7', color: '#15803d', border: '#86efac', label: 'Read 🟢' };
                                                            else if (s === 'delivered') badgeStyle = { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', label: 'Delivered 🔵' };
                                                            else if (s === 'failed') badgeStyle = { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'Failed 🔴' };
                                                            else if (s === 'queued' || s === 'sending') badgeStyle = { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: s === 'queued' ? 'Queued' : 'Sending' };

                                                            return (
                                                                <tr key={startIdx + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{startIdx + i + 1}</td>
                                                                    <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a' }}>
                                                                        {recip.phone || '—'}
                                                                        {Number(recip.resend_attempt || 0) > 0 && <span title={recip.original_error || 'Resent message'} style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontSize: 10 }}>Attempt {Number(recip.resend_attempt) + 1}</span>}
                                                                    </td>
                                                                    <td style={{ padding: '8px 10px' }}>
                                                                        <span style={{
                                                                            padding: '2px 8px',
                                                                            borderRadius: '12px',
                                                                            fontSize: '11px',
                                                                            fontWeight: '600',
                                                                            backgroundColor: badgeStyle.bg,
                                                                            color: badgeStyle.color,
                                                                            border: `1px solid ${badgeStyle.border}`
                                                                        }}>
                                                                            {badgeStyle.label}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '8px 10px', fontSize: '11.5px', color: '#64748b' }}>
                                                                        {recip.sent_at ? new Date(recip.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '—'}
                                                                    </td>
                                                                    <td style={{ padding: '8px 10px', fontSize: '11.5px', color: '#64748b' }}>
                                                                        {recip.read_at ? `Read at ${new Date(recip.read_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : (recip.delivered_at ? `Delivered at ${new Date(recip.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—')}
                                                                    </td>
                                                                    <td style={{ padding: '8px 10px', fontSize: '11.5px', color: s === 'failed' ? '#dc2626' : '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[recip.error, recip.original_error && `Original: ${recip.original_error}`].filter(Boolean).join('\n') || recip.message_id || ''}>
                                                                        {recip.error || (recip.message_id ? `ID: ${recip.message_id.slice(-8)}` : '—')}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Modal Footer with Pagination Controls */}
                                        <div style={{
                                            padding: '12px 20px',
                                            borderTop: '1px solid #e5e7eb',
                                            backgroundColor: '#f8fafc',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '10px',
                                            borderBottomLeftRadius: '12px',
                                            borderBottomRightRadius: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                Showing {totalFiltered === 0 ? 0 : startIdx + 1} to {endIdx} of {totalFiltered} recipient(s)
                                            </div>

                                            {/* Pagination Buttons */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    disabled={safePage <= 1}
                                                    onClick={() => setModalCurrentPage(p => Math.max(1, p - 1))}
                                                    style={{
                                                        padding: '4px 10px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        backgroundColor: safePage <= 1 ? '#f1f5f9' : '#ffffff',
                                                        color: safePage <= 1 ? '#94a3b8' : '#334155',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '4px',
                                                        cursor: safePage <= 1 ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    Previous
                                                </button>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', padding: '0 4px' }}>
                                                    Page {safePage} of {totalPages}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={safePage >= totalPages}
                                                    onClick={() => setModalCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    style={{
                                                        padding: '4px 10px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        backgroundColor: safePage >= totalPages ? '#f1f5f9' : '#ffffff',
                                                        color: safePage >= totalPages ? '#94a3b8' : '#334155',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '4px',
                                                        cursor: safePage >= totalPages ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    Next
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadSingle(selectedViewCampaign)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '6px',
                                                        color: '#334155',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    📥 CSV
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedViewCampaign(null)}
                                                    style={{
                                                        padding: '6px 14px',
                                                        fontSize: '12.5px',
                                                        fontWeight: '600',
                                                        backgroundColor: '#075e54',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        color: '#ffffff',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* Meta Failure Reason Modal */}
                {selectedFailedRow && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.55)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 99999,
                            padding: '16px',
                            backdropFilter: 'blur(2px)'
                        }}
                        onClick={() => setSelectedFailedRow(null)}
                    >
                        <div
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '12px',
                                maxWidth: '620px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid #fee2e2',
                                backgroundColor: '#fef2f2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderTopLeftRadius: '12px',
                                borderTopRightRadius: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        backgroundColor: '#fee2e2',
                                        color: '#dc2626',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        border: '1px solid #fca5a5'
                                    }}>
                                        ⚠️
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#991b1b' }}>
                                            WhatsApp Delivery Failure Reason
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#7f1d1d' }}>
                                            Actual Facebook Meta Cloud API Error Response
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedFailedRow(null)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                        color: '#991b1b',
                                        lineHeight: 1
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Campaign Info Banner */}
                                <div style={{
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '8px',
                                    padding: '12px 14px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '13px',
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr',
                                    gap: '6px 12px'
                                }}>
                                    <span style={{ color: '#6b7280', fontWeight: '600' }}>Campaign / Message:</span>
                                    <span style={{ color: '#111827', fontWeight: '500' }}>{selectedFailedRow.campaignName || selectedFailedRow.message}</span>

                                    <span style={{ color: '#6b7280', fontWeight: '600' }}>Submit Date:</span>
                                    <span style={{ color: '#374151' }}>
                                        {selectedFailedRow.submitDate
                                            ? new Date(selectedFailedRow.submitDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
                                            : '-'}
                                    </span>

                                    <span style={{ color: '#6b7280', fontWeight: '600' }}>Failed Count:</span>
                                    <span style={{ color: '#dc2626', fontWeight: '700' }}>
                                        {selectedFailedRow.failed} of {selectedFailedRow.total} recipient(s)
                                    </span>
                                </div>

                                {(() => {
                                    const primaryErr = selectedFailedRow.error || selectedFailedRow.failedRecipients?.[0] || {};
                                    const failedList = selectedFailedRow.failedRecipients || [];

                                    // Plain-text errors loaded from campaign_recipients.error column or row error
                                    const dbErrors = failedRowErrors.length > 0
                                        ? failedRowErrors
                                        : (selectedFailedRow.error && typeof selectedFailedRow.error === 'string'
                                            ? [{ phone: selectedFailedRow.phone || selectedFailedRow.other, error: selectedFailedRow.error }]
                                            : (selectedFailedRow.metaErrorMessage
                                                ? [{ phone: selectedFailedRow.phone || selectedFailedRow.other, error: selectedFailedRow.metaErrorMessage }]
                                                : []));

                                    return (
                                        <>
                                            {/* DB-level recipient errors (pre-send abort or campaign_recipients.error) */}
                                            {isLoadingFailedErrors && (
                                                <div style={{ textAlign: 'center', padding: '10px', color: '#6b7280', fontSize: '13px' }}>
                                                    Loading error details...
                                                </div>
                                            )}

                                            {!isLoadingFailedErrors && dbErrors.length > 0 && (
                                                <div style={{ border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fff5f5', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase' }}>❌ Failure Reason from Server</div>
                                                    {dbErrors.map((e, i) => (
                                                        <div key={i} style={{ fontSize: '13px', color: '#7f1d1d', backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                            {dbErrors.length > 1 && <span style={{ fontWeight: '700', minWidth: 90, color: '#374151' }}>{e.phone}:</span>}
                                                            <span>{e.error}</span>
                                                        </div>
                                                    ))}
                                                    {/* 131052-specific helpful tip */}
                                                    {dbErrors.some(e => String(e.error || '').includes('131052') || String(e.error || '').toLowerCase().includes('media')) && (
                                                        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px' }}>
                                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', marginBottom: '4px' }}>💡 How to fix this</div>
                                                            <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.45' }}>
                                                                The template's header image/video could not be uploaded to Meta (Error 131052 — Media upload error).
                                                                Please go to <strong>Official Templates</strong> and re-save the template with a valid header media file
                                                                (JPG/PNG under 5 MB, or MP4 under 16 MB).
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Structured Meta API error (from webhook delivery failure) */}
                                            {(primaryErr.code || primaryErr.message) && (
                                                <div style={{
                                                    border: '1px solid #fecaca',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#fff5f5',
                                                    padding: '16px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '12px'
                                                }}>
                                                    {/* Error Code & Title */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                        <span style={{
                                                            backgroundColor: '#ef4444',
                                                            color: '#ffffff',
                                                            padding: '3px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '12px',
                                                            fontWeight: '700',
                                                            letterSpacing: '0.5px'
                                                        }}>
                                                            Meta Error Code: {primaryErr.code || 'N/A'}
                                                        </span>
                                                        {primaryErr.subcode && (
                                                            <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: '600' }}>
                                                                Subcode: {primaryErr.subcode}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Meta Reason / Title */}
                                                    <div>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                            Meta Reason:
                                                        </div>
                                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#7f1d1d' }}>
                                                            {primaryErr.message || primaryErr.title || 'Message undeliverable'}
                                                        </div>
                                                    </div>

                                                    {/* Meta Details */}
                                                    {primaryErr.details && (
                                                        <div>
                                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                                Meta Details:
                                                            </div>
                                                            <div style={{ fontSize: '13px', color: '#374151', backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fed7d7' }}>
                                                                {primaryErr.details}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Customer Friendly Explanation */}
                                                    {(() => {
                                                        const getFriendlyExplanation = (err) => {
                                                            if (err.explanation) return err.explanation;
                                                            const code = String(err.code || '');
                                                            const msg = (String(err.message || '') + ' ' + String(err.details || '')).toLowerCase();
                                                            if (code === '131049' || msg.includes('ecosystem') || msg.includes('engagement')) {
                                                                return 'Meta Cloud API blocked delivery to maintain user experience (Marketing Frequency Capping). Meta limits how many marketing template messages a recipient can receive within a time period. To message this recipient, send a Utility template (e.g. order confirmation, alert) or wait before sending another marketing message.';
                                                            }
                                                            if (code === '131047' || code === '131026' || msg.includes('window') || msg.includes('24-hour')) {
                                                                return 'The customer 24-hour window has expired. You must send an approved Official WhatsApp Template message to re-initiate the chat.';
                                                            }
                                                            if (code === '131053' || msg.includes('media download')) {
                                                                return 'Meta could not download or process the media header. Please make sure the attached image or media is valid and within size limits.';
                                                            }
                                                            if (code === '131051' || msg.includes('parameter') || msg.includes('mismatch')) {
                                                                return 'Template variable parameter count mismatch. Ensure all variables (e.g. {{1}}, {{2}}) have valid values.';
                                                            }
                                                            if (code === '131042' || msg.includes('eligibility') || msg.includes('payment')) {
                                                                return 'Business eligibility or payment issue on your Meta WhatsApp Business Account.';
                                                            }
                                                            return err.details || 'Message could not be delivered by Meta Cloud API.';
                                                        };
                                                        const explanation = getFriendlyExplanation(primaryErr);
                                                        return explanation ? (
                                                            <div style={{
                                                                backgroundColor: '#f0fdf4',
                                                                border: '1px solid #bbf7d0',
                                                                borderRadius: '6px',
                                                                padding: '10px 12px'
                                                            }}>
                                                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                                    💡 What this means:
                                                                </div>
                                                                <div style={{ fontSize: '13px', color: '#14532d', lineHeight: '1.45' }}>
                                                                    {explanation}
                                                                </div>
                                                            </div>
                                                        ) : null;
                                                    })()}

                                                    {/* Trace ID */}
                                                    {primaryErr.fbtraceId && (
                                                        <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', gap: '6px' }}>
                                                            <span style={{ fontWeight: '600' }}>Meta Trace ID:</span>
                                                            <code style={{ backgroundColor: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>
                                                                {primaryErr.fbtraceId}
                                                            </code>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* List of failed recipients if multiple */}
                                            {failedList.length > 1 && (
                                                <div style={{ marginTop: '4px' }}>
                                                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
                                                        Failed Numbers Breakdown ({failedList.length}):
                                                    </h4>
                                                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                                                    <th style={{ padding: '6px 10px', color: '#4b5563' }}>Phone Number</th>
                                                                    <th style={{ padding: '6px 10px', color: '#4b5563' }}>Error Code</th>
                                                                    <th style={{ padding: '6px 10px', color: '#4b5563' }}>Failure Reason</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {failedList.map((recip, rIdx) => (
                                                                    <tr key={rIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '6px 10px', fontWeight: '600', color: '#111827' }}>
                                                                            {recip.phone || 'Unknown'}
                                                                        </td>
                                                                        <td style={{ padding: '6px 10px', color: '#dc2626' }}>
                                                                            {recip.code || 'N/A'}
                                                                        </td>
                                                                        <td style={{ padding: '6px 10px', color: '#4b5563' }}>
                                                                            {recip.message || recip.details || 'Failed'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* No errors loaded at all */}
                                            {!isLoadingFailedErrors && dbErrors.length === 0 && !primaryErr.code && !primaryErr.message && (
                                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
                                                    No detailed error information available. The message may have been blocked before reaching Meta, or the error was not recorded.
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: '12px 20px',
                                borderTop: '1px solid #e5e7eb',
                                backgroundColor: '#f9fafb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '10px',
                                borderBottomLeftRadius: '12px',
                                borderBottomRightRadius: '12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const errText = JSON.stringify(selectedFailedRow.error || selectedFailedRow.failedRecipients || {}, null, 2);
                                        handleCopyError(errText);
                                    }}
                                    style={{
                                        padding: '8px 14px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        color: '#374151',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {copied ? '✓ Copied' : 'Copy Error Details'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedFailedRow(null)}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        backgroundColor: '#075e54',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                <div className="pagination-container">
                    <div className="showing-info">
                        Showing {filteredData.length === 0 ? 0 : indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="pagination-buttons">
                        <button
                            className="btn-pagination"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            Previous
                        </button>
                        <button
                            className="btn-pagination"
                            disabled={indexOfLastEntry >= filteredData.length}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
