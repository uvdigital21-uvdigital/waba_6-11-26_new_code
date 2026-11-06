import React, { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'

const REPORTS_MENU_ITEMS = [
    { to: '/reports/sending-history', label: 'Sending History', description: 'View your message sending history and logs' },
    { to: '/reports/scheduled-log', label: 'Scheduled Log', description: 'Track scheduled messages and campaigns' },
    { to: '/reports/ads-referral', label: 'Ads Referral Report', description: 'Monitor ads performance and referrals' },
    { to: '/reports/tagging-numbers', label: 'Tagging Numbers', description: 'Manage and view tagged contact numbers' },
    { to: '/reports/whatsapp-forms', label: 'Whatsapp Forms', description: 'Review form responses and submissions' },
    { to: '/reports/flow-template-responses', label: 'Flow Template Responses', description: 'Analyze flow template interactions' },
]

export default function Reports() {
    const { setTitle } = useTitle()

    useEffect(() => {
        setTitle('Reports')
    }, [setTitle])

    return (
        <div className="dashboard-content">
            <div className="chart-card">
                <div className="chart-card-head">
                    <h3>Reports Overview</h3>
                </div>
                <div className="chart-card-body">
                    <div className="reports-grid">
                        {REPORTS_MENU_ITEMS.map(({ to, label, description }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) => `report-card${isActive ? ' active' : ''}`}
                            >
                                <div className="report-card-content">
                                    <h4>{label}</h4>
                                    <p>{description}</p>
                                </div>
                                <svg className="report-card-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}