import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useTitle } from '../context/TitleContext.jsx';
import api from '../services/api.js';
import { API_BASE_URL } from '../config.js';
import DateRangePicker from '../components/DateRangePicker.jsx';

export default function MetaBillingInsights() {
    const { setTitle } = useTitle();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshStep, setRefreshStep] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [dateRange, setDateRange] = useState('30days');
    const [customRange, setCustomRange] = useState('');

    const [insightsData, setInsightsData] = useState({
        account: {
            businessId: '1428299024793738',
            phoneNumber: 'Loading...',
            verifiedName: 'WhatsApp Account',
            businessName: 'WhatsApp Business',
            wabaId: '1507295783967485',
            phoneNumberId: '1133105516561988',
            status: 'CONNECTED'
        },
        period: {
            type: '30days',
            startDate: '',
            endDate: '',
            label: 'Last 30 Days',
            timezone: 'Asia/Kolkata'
        },
        lastSync: {
            syncedAt: null,
            status: 'synced',
            error: null
        },
        summary: {
            allMessages: 0,
            messagesSent: 0,
            messagesDelivered: 0,
            messagesReceived: 0,
            freeMessages: 0,
            paidMessages: 0,
            totalCharges: 0,
            currency: 'INR'
        },
        categories: [],
        daily: []
    });

    const formatCurrencySymbol = (curr) => {
        if (!curr || curr === 'INR') return '₹';
        if (curr === 'USD') return '$';
        if (curr === 'EUR') return '€';
        if (curr === 'GBP') return '£';
        return String(curr) + ' ';
    };

    const fetchInsights = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) {
            setRefreshing(true);
            setRefreshStep('Syncing with Meta...');
            setErrorMsg('');
            setSuccessMsg('');
        } else {
            setLoading(true);
        }

        try {
            let url = `/meta/billing-insights?dateRange=${dateRange}`;
            let customStartDate = undefined;
            let customEndDate = undefined;

            if (dateRange === 'custom') {
                if (customRange && customRange.includes(' - ')) {
                    const [start, end] = customRange.split(' - ');
                    customStartDate = start.trim();
                    customEndDate = end.trim();
                } else if (customRange) {
                    customStartDate = customRange.trim();
                    customEndDate = customRange.trim();
                }

                if (customStartDate && customEndDate) {
                    url += `&startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(customEndDate)}`;
                }
            }

            let res;
            if (isManualRefresh) {
                setTimeout(() => setRefreshStep('Fetching Meta data...'), 400);
                setTimeout(() => setRefreshStep('Saving data...'), 1200);

                res = await api.post('/meta/billing-insights/refresh', {
                    dateRange,
                    startDate: customStartDate,
                    endDate: customEndDate
                });

                setRefreshStep('Updating dashboard...');
                setTimeout(() => {
                    setSuccessMsg('Synced successfully from Meta');
                    setTimeout(() => setSuccessMsg(''), 5000);
                }, 300);
            } else {
                res = await api.get(url);
            }

            if (res && res.data) {
                setInsightsData({
                    account: res.data.account || {
                        businessId: '1428299024793738',
                        phoneNumber: 'Connected Account',
                        verifiedName: 'Official WABA',
                        businessName: 'Official WABA',
                        wabaId: '1507295783967485',
                        phoneNumberId: '1133105516561988',
                        status: 'CONNECTED'
                    },
                    period: res.data.period || {
                        type: dateRange,
                        startDate: '',
                        endDate: '',
                        label: '',
                        timezone: 'Asia/Kolkata'
                    },
                    lastSync: res.data.lastSync || { syncedAt: null, status: 'synced', error: null },
                    summary: {
                        allMessages: Number(res.data.summary?.allMessages || 0),
                        messagesSent: Number(res.data.summary?.messagesSent || 0),
                        messagesDelivered: Number(res.data.summary?.messagesDelivered || 0),
                        messagesReceived: Number(res.data.summary?.messagesReceived || 0),
                        freeMessages: Number(res.data.summary?.freeMessages || 0),
                        paidMessages: Number(res.data.summary?.paidMessages || 0),
                        totalCharges: Number(res.data.summary?.totalCharges || 0),
                        currency: res.data.summary?.currency || 'INR'
                    },
                    categories: Array.isArray(res.data.categories) ? res.data.categories : [],
                    daily: Array.isArray(res.data.daily) ? res.data.daily : []
                });
            }
        } catch (err) {
            const errData = err?.response?.data;
            const message = errData?.error?.message || errData?.message || err.message || 'Meta sync failed. Existing data has not been changed.';
            setErrorMsg(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setRefreshStep('');
        }
    }, [dateRange, customRange]);

    useEffect(() => {
        if (typeof setTitle === 'function') {
            setTitle('Meta Billing & Insights');
        }
        fetchInsights(false);

        // Real-Time Socket.IO connection for automatic updates
        const socketUrl = (API_BASE_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        const activeOrgId = localStorage.getItem('org_id') || 1;
        socket.on('connect', () => {
            socket.emit('join_organization', activeOrgId);
        });

        // Whenever backend completes a Meta sync, refresh dashboard state
        socket.on('meta_billing_updated', (data) => {
            console.log('⚡ [Meta Insights] Real-time Meta billing update received:', data);
            fetchInsights(false);
        });

        // Periodic 60-second background poll
        const pollInterval = setInterval(() => {
            fetchInsights(false);
        }, 60000);

        return () => {
            clearInterval(pollInterval);
            socket.disconnect();
        };
    }, [setTitle, fetchInsights]);

    const formatCategoryName = (cat) => {
        const c = String(cat || '').toUpperCase();
        if (c === 'MARKETING') return 'Marketing';
        if (c === 'UTILITY') return 'Utility';
        if (c === 'AUTHENTICATION') return 'Authentication';
        if (c === 'AUTHENTICATION_INTERNATIONAL') return 'Authentication - International';
        if (c === 'AI_PROVIDER') return 'AI Provider';
        if (c === 'SERVICE') return 'Service';
        return cat || 'General';
    };

    const getCategoryBadgeStyle = (catName) => {
        const c = String(catName || '').toUpperCase();
        if (c.includes('MARKET')) return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
        if (c === 'UTILITY') return { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' };
        if (c.startsWith('AUTH')) return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
        if (c.includes('AI')) return { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' };
        if (c.includes('SERV')) return { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' };
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    };

    const summary = insightsData?.summary || {
        allMessages: 0,
        messagesSent: 0,
        messagesDelivered: 0,
        messagesReceived: 0,
        freeMessages: 0,
        paidMessages: 0,
        totalCharges: 0,
        currency: 'INR'
    };

    const account = insightsData?.account || {
        businessId: '1428299024793738',
        phoneNumber: 'Connected Number',
        verifiedName: 'Official WhatsApp WABA',
        wabaId: '1507295783967485',
        phoneNumberId: '1133105516561988'
    };

    const lastSync = insightsData?.lastSync || {};
    const categoriesList = Array.isArray(insightsData?.categories) ? insightsData.categories : [];
    const dailyList = Array.isArray(insightsData?.daily) ? insightsData.daily : [];
    const currencySymbol = formatCurrencySymbol(summary.currency);

    return (
        <div className="dashboard-content" style={{ padding: '24px' }}>
            {/* Top Bar Banner */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '20px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                    }}>
                        💳
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                                Meta WhatsApp Billing & Insights
                            </h1>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                border: '1px solid #86efac'
                            }}>
                                Meta Cloud API (1:1 Source Sync)
                            </span>
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <span><strong>Business ID:</strong> {account.businessId || '1428299024793738'}</span>
                            <span><strong>WABA / Asset ID:</strong> {account.wabaId || '1507295783967485'}</span>
                            <span><strong>Phone Number:</strong> {account.phoneNumber || '+91 73837 37005'}</span>
                            <span>
                                <strong>Last Synced:</strong> {lastSync.syncedAt
                                    ? new Date(lastSync.syncedAt).toLocaleString()
                                    : 'Recently Synced'}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        type="button"
                        onClick={() => fetchInsights(true)}
                        disabled={refreshing}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: refreshing ? '#94a3b8' : '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 18px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                            🔄
                        </span>
                        <span>{refreshing ? (refreshStep || 'Syncing with Meta...') : 'Refresh from Meta'}</span>
                    </button>
                </div>
            </div>

            {/* Notification Alerts */}
            {successMsg && (
                <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
                    ✅ {successMsg}
                </div>
            )}
            {errorMsg && (
                <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
                    ⚠️ {errorMsg}
                </div>
            )}

            {/* Date Range Filter Bar */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                padding: '12px 20px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginRight: '4px' }}>
                        Period:
                    </span>
                    {[
                        { key: 'today', label: 'Today' },
                        { key: 'yesterday', label: 'Yesterday' },
                        { key: '7days', label: 'Last 7 Days' },
                        { key: '30days', label: 'Last 30 Days' },
                        { key: '90days', label: 'Last 90 Days' },
                        { key: 'this_month', label: 'This Month' },
                        { key: 'last_month', label: 'Last Month' },
                        { key: 'custom', label: 'Custom Range' },
                    ].map(p => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setDateRange(p.key)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                border: dateRange === p.key ? '1px solid #059669' : '1px solid #e2e8f0',
                                backgroundColor: dateRange === p.key ? '#ecfdf5' : '#ffffff',
                                color: dateRange === p.key ? '#059669' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {dateRange === 'custom' && (
                    <div style={{ minWidth: '240px' }}>
                        <DateRangePicker value={customRange} onChange={setCustomRange} />
                    </div>
                )}
            </div>

            {/* Summary KPI Cards matching Meta WhatsApp Manager Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                {/*  Card 1: All Messages */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>All Messages</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{Number(summary.allMessages || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', lineHeight: '1.6' }}>
                        <div>Sent: <strong>{Number(summary.messagesSent || 0).toLocaleString()}</strong></div>
                        <div>Delivered: <strong>{Number(summary.messagesDelivered || 0).toLocaleString()}</strong></div>
                        <div>Received: <strong>{Number(summary.messagesReceived || 0).toLocaleString()}</strong></div>
                    </div>
                </div>

                {/* Card 2: Messages Delivered by Category */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Messages Delivered</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>
                        {Number(summary.messagesDelivered || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', lineHeight: '1.6' }}>
                        <div>Marketing: <strong>{Number(categoriesList.find(c => c.category === 'MARKETING')?.delivered || 0).toLocaleString()}</strong></div>
                        <div>Utility: <strong>{Number(categoriesList.find(c => c.category === 'UTILITY')?.delivered || 0).toLocaleString()}</strong></div>
                        <div>Service: <strong>{Number(categoriesList.find(c => c.category === 'SERVICE')?.delivered || 0).toLocaleString()}</strong></div>
                    </div>
                </div>

                {/* Card 3: Free Messages Delivered */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Free Messages Delivered</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#7c3aed' }}>
                        {Number(summary.freeMessages || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', lineHeight: '1.6' }}>
                        <div>Free Customer Service: <strong>{Number(categoriesList.find(c => c.category === 'SERVICE')?.free || 0).toLocaleString()}</strong></div>
                        <div>Free Entry Point: <strong>0</strong></div>
                        <div>Free Utility: <strong>{Number(categoriesList.find(c => c.category === 'UTILITY')?.free || 0).toLocaleString()}</strong></div>
                    </div>
                </div>

                {/* Card 4: Paid Messages Delivered */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Paid Messages Delivered</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706' }}>
                        {Number(summary.paidMessages || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', lineHeight: '1.6' }}>
                        <div>Marketing: <strong>{Number(categoriesList.find(c => c.category === 'MARKETING')?.paid || 0).toLocaleString()}</strong></div>
                        <div>Utility: <strong>{Number(categoriesList.find(c => c.category === 'UTILITY')?.paid || 0).toLocaleString()}</strong></div>
                        <div>Authentication: <strong>{Number(categoriesList.find(c => c.category === 'AUTHENTICATION')?.paid || 0).toLocaleString()}</strong></div>
                    </div>
                </div>

                {/* Card 5: Approximate Total Charges */}
                <div style={{ backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '18px', border: '1px solid #86efac', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', marginBottom: '6px' }}>Approx. Total Charges</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d' }}>
                        {currencySymbol}{Number(summary.totalCharges || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#166534', marginTop: '6px', lineHeight: '1.6' }}>
                        <div>Marketing: <strong>{currencySymbol}{Number(categoriesList.find(c => c.category === 'MARKETING')?.cost || 0).toFixed(2)}</strong></div>
                        <div>Utility: <strong>{currencySymbol}{Number(categoriesList.find(c => c.category === 'UTILITY')?.cost || 0).toFixed(2)}</strong></div>
                        <div>Meta Currency: <strong>{summary.currency || 'INR'}</strong></div>
                    </div>
                </div>
            </div>

            {/* Message Category Breakdown Table */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '24px'
            }}>
                <div style={{ marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                        Messages Delivered by Category
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Meta WhatsApp 24-hour conversation category rates and charges
                    </p>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Category</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Messages Sent</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Delivered</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Free Messages</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Paid Messages</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Est. Rate</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '700' }}>Total Charges</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                        Loading Meta category breakdown...
                                    </td>
                                </tr>
                            ) : categoriesList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                        No category data available for this date period.
                                    </td>
                                </tr>
                            ) : (
                                categoriesList.map((c, i) => {
                                    const badge = getCategoryBadgeStyle(c?.category);
                                    const sent = Number(c?.sent || 0);
                                    const delivered = Number(c?.delivered || 0);
                                    const free = Number(c?.free || 0);
                                    const paid = Number(c?.paid || 0);
                                    const rate = Number(c?.rate || 0);
                                    const cost = Number(c?.cost || 0);

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 14px', fontWeight: '600' }}>
                                                <span style={{
                                                    padding: '3px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    backgroundColor: badge.bg,
                                                    color: badge.text,
                                                    border: `1px solid ${badge.border}`
                                                }}>
                                                    {formatCategoryName(c?.category)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', color: '#334155' }}>{sent.toLocaleString()}</td>
                                            <td style={{ padding: '12px 14px', color: '#059669', fontWeight: '600' }}>{delivered.toLocaleString()}</td>
                                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{free.toLocaleString()}</td>
                                            <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: '600' }}>{paid.toLocaleString()}</td>
                                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{currencySymbol}{rate.toFixed(4)}</td>
                                            <td style={{ padding: '12px 14px', color: '#15803d', fontWeight: '700' }}>{currencySymbol}{cost.toFixed(2)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
