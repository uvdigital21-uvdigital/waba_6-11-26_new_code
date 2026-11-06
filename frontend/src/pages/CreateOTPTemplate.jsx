import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import './Template.css'

import { API_BASE_URL } from '../config.js'
import { ALL_LANGUAGES } from '../constants/metaConstants.js'

const API_BASE = API_BASE_URL

const LANGUAGES = ALL_LANGUAGES

export default function CreateOTPTemplate() {
    const navigate = useNavigate()
    const { setTitle } = useTitle()
    const { user } = useAuth()

    useEffect(() => {
        setTitle('Create OTP Template')
    }, [setTitle])

    const [templateName, setTemplateName] = useState('')
    const [language, setLanguage] = useState('en')
    const [securityEnabled, setSecurityEnabled] = useState(true)
    const [expirationMinutes, setExpirationMinutes] = useState(10)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const getAuthHeaders = () => {
        const token = localStorage.getItem('wa_dashboard_token')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    const generateOtpMessage = () => {
        return '{{1}} is your verification code.\n\nFor your security, do not share this code.'
    }

    const handleExpirationChange = (e) => {
        const val = e.target.value
        if (val === '') {
            setExpirationMinutes('')
            return
        }
        const num = parseInt(val, 10)
        if (!isNaN(num) && num >= 0 && num <= 90) {
            setExpirationMinutes(num)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            const body = {
                name: templateName,
                message: generateOtpMessage(),
                category: 'AUTHENTICATION'
            }
            const res = await fetch(`${API_BASE}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to create OTP template')
            setSuccess('OTP Template created successfully')
            setTimeout(() => {
                navigate('/template/manage')
            }, 1500)
        } catch (err) {
            setError(err.message)
            setSubmitting(false)
        }
    }

    const displayExpiration = expirationMinutes === '' || expirationMinutes === 0 ? '' : expirationMinutes

    return (
        <>
            <div className="otp-template-page">
                {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
                {success && <div className="success-banner" style={{ marginBottom: 16 }}>{success}</div>}

                {/* Header */}
                <div className="otp-header">
                    <div className="otp-header-left">
                        <div className="otp-header-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </div>
                        <h1 className="otp-header-title">Official Wapp OTP Template</h1>
                    </div>
                    <div className="otp-header-right">
                        <button className="btn-otp-manage" onClick={() => navigate('/template/manage')}>
                            Manage Templates
                        </button>
                        <button className="btn-otp-create-other" onClick={() => navigate('/template/manage/add')}>
                            Create Other Template
                        </button>
                    </div>
                </div>

                {/* Main Content - Two Column Layout */}
                <div className="otp-body">
                    {/* LEFT - Form */}
                    <div className="otp-form-col">
                        <div className="otp-form-card">
                            <form onSubmit={handleSave}>
                                {/* Template Name */}
                                <div className="otp-field-group">
                                    <label className="otp-field-label">Template Name:</label>
                                    <input
                                        type="text"
                                        className="otp-field-input"
                                        placeholder="e.g., otp_verification_1"
                                        value={templateName}
                                        onChange={(e) => {
                                            const val = e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                                            setTemplateName(val)
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault()
                                            const text = e.clipboardData.getData('text') || ''
                                            const formatted = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                                            const current = templateName || ''
                                            const start = e.target.selectionStart || 0
                                            const end = e.target.selectionEnd || 0
                                            const nextVal = current.substring(0, start) + formatted + current.substring(end)
                                            setTemplateName(nextVal)
                                        }}
                                        required
                                    />
                                    <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                                        lowercase letters, numbers and underscores only (spaces converted to _)
                                    </span>
                                </div>

                                {/* Language */}
                                <div className="otp-field-group">
                                    <label className="otp-field-label">Select Languages:</label>
                                    <select
                                        className="otp-field-select"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                    >
                                        {LANGUAGES.map((lang) => (
                                            <option key={lang.value} value={lang.value}>{lang.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Security Recommendation Toggle */}
                                <div className="otp-field-group">
                                    <div className="otp-checkbox-row">
                                        <span className="otp-checkbox-text">Add Security Recommendation</span>
                                        <input
                                            type="checkbox"
                                            className="otp-checkbox"
                                            checked={securityEnabled}
                                            onChange={(e) => setSecurityEnabled(e.target.checked)}
                                        />
                                    </div>
                                </div>

                                {/* Code Expiration minutes */}
                                <div className="otp-field-group">
                                    <label className="otp-field-label">Code Expiration Minutes</label>
                                    <div className="otp-expiry-input-group">
                                        <input
                                            type="number"
                                            className="otp-expiry-input-field"
                                            value={expirationMinutes}
                                            onChange={handleExpirationChange}
                                            min={0}
                                            max={90}
                                            step={1}
                                        />
                                        <span className="otp-expiry-addon">minutes</span>
                                    </div>
                                    <div className="otp-expiration-helper">
                                        Minimum 1, maximum 90 minutes & 0 for remove time limit
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="otp-save-wrapper">
                                    <button
                                        type="submit"
                                        className="btn-save-otp-blue"
                                        disabled={!templateName || submitting}
                                    >
                                        {submitting ? 'Saving...' : 'Save OTP Template'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT - Phone Preview */}
                    <div className="otp-preview-col">
                        <div className="otp-phone-wrapper">
                            <div className="otp-phone-mockup">
                                <div className="otp-phone-notch" />
                                <div className="otp-phone-screen">
                                    {/* Phone Status Bar */}
                                    <div className="otp-wa-status-bar">
                                        <div className="otp-wa-status-time">17:48</div>
                                        <div className="otp-wa-status-icons">
                                            {/* WhatsApp status icon */}
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 2 }}>
                                                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.817 9.817 0 0 0 12.04 2z" />
                                            </svg>
                                            {/* Settings gear */}
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}>
                                                <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                                            </svg>
                                            {/* Signal */}
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="2" y="16" width="3" height="4" rx="0.5" />
                                                <rect x="7" y="12" width="3" height="8" rx="0.5" />
                                                <rect x="12" y="8" width="3" height="12" rx="0.5" />
                                                <rect x="17" y="4" width="3" height="16" rx="0.5" />
                                            </svg>
                                            {/* Wifi */}
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 14 0M1.5 9.5a15 15 0 0 1 21 0" />
                                            </svg>
                                            {/* Battery 80% */}
                                            <span style={{ fontSize: 9.5, marginLeft: 2, marginRight: 2 }}>80%</span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="2" y="7" width="16" height="10" rx="2" />
                                                <line x1="22" y1="11" x2="22" y2="13" />
                                                <rect x="4" y="9" width="10" height="6" fill="currentColor" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* WhatsApp Header */}
                                    <div className="otp-wa-header">
                                        <div className="otp-wa-header-left">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M19 12H5M12 19l-7-7 7-7" />
                                            </svg>
                                        </div>
                                        <div className="otp-wa-header-center">
                                            <div className="otp-wa-avatar" style={{ backgroundColor: '#6200ea' }}>
                                                <span style={{ fontSize: 13, fontWeight: 700 }}>M</span>
                                            </div>
                                            <div className="otp-wa-contact-info">
                                                <span className="otp-wa-contact-name">
                                                    Markt
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#388e3c" style={{ marginLeft: 2 }}>
                                                        <circle cx="12" cy="12" r="10" fill="#25d366" />
                                                        <path d="m9 12 2 2 4-4" stroke="#ffffff" strokeWidth="2" fill="none" />
                                                    </svg>
                                                </span>
                                                <span className="otp-wa-contact-label">Business Account</span>
                                            </div>
                                        </div>
                                        <div className="otp-wa-header-right">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Chat Area */}
                                    <div className="otp-wa-chat-area">
                                        <div className="otp-date-pill">Today</div>

                                        {/* Meta Security Banner (when enabled) */}
                                        {securityEnabled && (
                                            <div className="otp-security-banner">
                                                {/* Shield Lock Icon */}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                </svg>
                                                <span>This business uses a secure service from Meta to manage this chat. Tap to learn more.</span>
                                            </div>
                                        )}

                                        {/* OTP Message Bubble */}
                                        <div className="otp-message-bubble">
                                            <div className="otp-bubble-content">
                                                <div className="otp-bubble-text">
                                                    <strong>797011</strong> is your verification code. For your security, do not share this code.
                                                </div>
                                                {displayExpiration && (
                                                    <div className="otp-bubble-expiration">
                                                        This code expires in {displayExpiration} minutes.
                                                    </div>
                                                )}
                                                <div className="otp-bubble-footer">
                                                    <span className="otp-bubble-time">11:59</span>
                                                </div>
                                            </div>
                                            <div className="otp-copy-code-divider" />
                                            <div className="otp-copy-code-action">
                                                {/* Copy Code Icon */}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                                Copy code
                                            </div>
                                        </div>

                                        {/* Typing Indicator space placeholder */}
                                        <div className="otp-typing-indicator" />
                                    </div>

                                    {/* Meta Bottom Notice Action Banner */}
                                    <div className="otp-bottom-notice">
                                        <span className="otp-notice-text">You're receiving messages from this business.</span>
                                        <div className="otp-notice-actions">
                                            <button className="otp-notice-btn otp-notice-block" type="button">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                </svg>
                                                BLOCK
                                            </button>
                                            <button className="otp-notice-btn otp-notice-continue" type="button">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                CONTINUE
                                            </button>
                                        </div>
                                    </div>

                                    {/* WhatsApp Input Bar */}
                                    <div className="otp-wa-input-bar">
                                        {/* Emoji Icon */}
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
                                        </svg>
                                        <div className="otp-wa-input-field">
                                            <span className="otp-wa-input-placeholder">Message</span>
                                        </div>
                                        {/* Paperclip */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 2 }}>
                                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>
                                        {/* Camera */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                            <circle cx="12" cy="13" r="4" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="otp-phone-home-btn" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}