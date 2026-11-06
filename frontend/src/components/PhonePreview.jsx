import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config.js'

function getBodyText(components) {
    const body = components?.find(c => c.type === 'BODY')
    return body?.text || ''
}

function getHeaderComponent(components) {
    return components?.find(c => c.type === 'HEADER')
}

function getButtons(components) {
    const btns = components?.find(c => c.type === 'BUTTONS')
    return btns?.buttons || []
}

function getFooterText(components) {
    const footer = components?.find(c => c.type === 'FOOTER')
    return footer?.text || ''
}

export default function PhonePreview({ template, accountName: propAccountName }) {
    const [accountName, setAccountName] = useState(() => {
        if (propAccountName) return propAccountName
        try {
            const stored = localStorage.getItem('active_wa_account_name')
            if (stored) return stored
            const userStr = localStorage.getItem('wa_dashboard_user')
            if (userStr) {
                const u = JSON.parse(userStr)
                return u.company_name || u.name || u.username || 'Official WhatsApp Account'
            }
        } catch (_) {}
        return 'Official WhatsApp Account'
    })

    useEffect(() => {
        if (propAccountName) {
            setAccountName(propAccountName)
            return
        }
        const token = localStorage.getItem('wa_dashboard_token')
        const selectedId = localStorage.getItem('active_wa_account_id')
        if (token) {
            fetch(`${API_BASE_URL}/numbers`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    const list = data.numbers || data.data || data.whatsapp_accounts || []
                    if (list.length > 0) {
                        const match = selectedId ? list.find(a => String(a.id) === String(selectedId)) || list[0] : list[0]
                        const name = match.verified_name || match.name || match.display_phone_number || match.wa_number
                        if (name) {
                            setAccountName(name)
                            localStorage.setItem('active_wa_account_name', name)
                        }
                    }
                })
                .catch(() => {})
        }
    }, [propAccountName])

    if (!template) return null

    const header = getHeaderComponent(template.components)
    const body = getBodyText(template.components)
    const buttons = getButtons(template.components)
    const footer = getFooterText(template.components)

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
        <div className="csv-phone-preview-panel">
            <div className="csv-phone-mockup">
                {/* Status bar */}
                <div className="csv-phone-statusbar">
                    <span>{timeStr}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 8.5C5.6 4.4 11.8 4.4 15.9 8.5l1.5-1.5C12.8 2.4 5.2 2.4.9 7L1.5 8.5zm6 6c1.1-1.1 2.9-1.1 4 0l1.5-1.5C11.2 11.2 7.8 11.2 6 13l1.5 1.5zM9 18l1.5 1.5L12 18l-1.5-1.5L9 18zm-4.5-4.5L6 15l6-6-1.5-1.5-6 6z"/></svg>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                    </div>
                </div>

                {/* WhatsApp chat header */}
                <div className="csv-phone-chat-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#075e54', color: '#ffffff' }}>
                    <div className="csv-phone-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0f766e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                        {(accountName || 'O').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="csv-phone-contact-name" style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {accountName}
                            </span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#00a884" style={{ flexShrink: 0 }}>
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </div>
                        <div className="csv-phone-contact-status" style={{ fontSize: '10px', color: '#a7f3d0', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Official Business Account • Online</div>
                    </div>
                </div>

                {/* Chat body */}
                <div className="csv-phone-chat-body">
                    <div className="csv-phone-bubble">
                        {/* Header */}
                        {header && (
                            <>
                                {header.format === 'IMAGE' && (
                                    <div className="csv-bubble-image-placeholder">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="#aaa"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                                        <span>Image</span>
                                    </div>
                                )}
                                {header.format === 'VIDEO' && (
                                    <div className="csv-bubble-image-placeholder">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="#aaa"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                                        <span>Video</span>
                                    </div>
                                )}
                                {header.format === 'DOCUMENT' && (
                                    <div className="csv-bubble-image-placeholder">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="#aaa"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/></svg>
                                        <span>Document</span>
                                    </div>
                                )}
                                {header.format === 'TEXT' && header.text && (
                                    <div className="csv-bubble-header-text">{header.text}</div>
                                )}
                            </>
                        )}

                        {/* Body */}
                        {body && (
                            <div className="csv-bubble-body">
                                {body.split('\n').map((line, i) => (
                                    <p key={i} style={{ margin: '0 0 4px 0' }}>{line || <br />}</p>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        {footer && (
                            <div className="csv-bubble-footer">{footer}</div>
                        )}

                        {/* Timestamp */}
                        <div className="csv-bubble-time">
                            {timeStr}
                            <svg width="14" height="10" viewBox="0 0 16 11" fill="#53bdeb" style={{ marginLeft: '3px' }}>
                                <path d="M11.071.653a.5.5 0 0 0-.707.034L4.916 7.072 2.121 4.207a.5.5 0 1 0-.728.686l3.147 3.342a.5.5 0 0 0 .728 0l5.803-6.875a.5.5 0 0 0 0-.707z"/>
                                <path d="M14.571.653a.5.5 0 0 0-.707.034L8.416 7.072l-.879-.935a.5.5 0 1 0-.728.686l1.24 1.318a.5.5 0 0 0 .728 0l6.303-6.875a.5.5 0 0 0 0-.613z"/>
                            </svg>
                        </div>
                    </div>

                    {/* Buttons */}
                    {buttons.length > 0 && (
                        <div className="csv-bubble-buttons">
                            {buttons.map((btn, i) => (
                                <div key={i} className="csv-bubble-btn">
                                    {btn.type === 'URL' && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#00a5f4"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                                    )}
                                    {btn.type === 'PHONE_NUMBER' && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#00a5f4"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                                    )}
                                    {btn.type === 'QUICK_REPLY' && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#00a5f4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                                    )}
                                    <span>{btn.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
