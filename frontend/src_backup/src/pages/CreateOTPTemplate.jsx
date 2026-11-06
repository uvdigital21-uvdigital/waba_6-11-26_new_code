import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'gu', label: 'Gujarati' },
    { value: 'mr', label: 'Marathi' },
]

export default function CreateOTPTemplate() {
    const navigate = useNavigate()
    const { user } = useAuth()

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
        <Layout title="Create OTP Template">
            <div className="otp-template-page">
                {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
                {success && <div className="success-banner" style={{ marginBottom: 16 }}>{success}</div>}

                {/* Header */}
                <div className="otp-header">
                    <div className="otp-header-left">
                        <div className="otp-header-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <h1 className="otp-header-title">Official Wapp OTP Template</h1>
                    </div>
                    <div className="otp-header-right">
                        <button className="btn-otp-manage" onClick={() => navigate('/template/manage')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                            </svg>
                            Manage Templates
                        </button>
                        <button className="btn-otp-create-other" onClick={() => navigate('/template/manage/add')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
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
                                    <label className="otp-field-label">Template Name</label>
                                    <input
                                        type="text"
                                        className="otp-field-input"
                                        placeholder="eg. abc_123, abc_123_abc"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Language */}
                                <div className="otp-field-group">
                                    <label className="otp-field-label">Language</label>
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

                                {/* Security Recommendation */}
                                <div className="otp-field-group">
                                    <label className="otp-checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="otp-checkbox"
                                            checked={securityEnabled}
                                            onChange={(e) => setSecurityEnabled(e.target.checked)}
                                        />
                                        <span className="otp-checkbox-text">Add Security Recommendation</span>
                                    </label>
                                </div>

                                {/* Code Expiration */}
                                <div className="otp-field-group">
                                    <label className="otp-field-label">Code Expiration Minutes</label>
                                    <div className="otp-expiration-row">
                                        <input
                                            type="number"
                                            className="otp-field-input otp-expiration-input"
                                            value={expirationMinutes}
                                            onChange={handleExpirationChange}
                                            min={0}
                                            max={90}
                                            step={1}
                                        />
                                        <span className="otp-expiration-unit">minutes</span>
                                    </div>
                                    <div className="otp-expiration-helper">
                                        Minimum 1, maximum 90 minutes & 0 for remove time limit
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="otp-save-wrapper">
                                    <button
                                        type="submit"
                                        className="btn-save-otp"
                                        disabled={!templateName || submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                    <polyline points="17 21 17 13 7 13 7 21" />
                                                    <polyline points="7 3 7 8 15 8" />
                                                </svg>
                                                Save OTP Template
                                            </>
                                        )}
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
                                    {/* WhatsApp Green Header */}
                                    <div className="otp-wa-header">
                                        <div className="otp-wa-header-left">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M19 12H5M12 19l-7-7 7-7" />
                                            </svg>
                                        </div>
                                        <div className="otp-wa-header-center">
                                            <div className="otp-wa-avatar">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            </div>
                                            <div className="otp-wa-contact-info">
                                                <span className="otp-wa-contact-name">Demo Business</span>
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
                                        {/* Meta Security Banner (when enabled) */}
                                        {securityEnabled && (
                                            <div className="otp-security-banner">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                                <span>Meta security recommendation</span>
                                            </div>
                                        )}

                                        {/* OTP Message Bubble */}
                                        <div className="otp-message-bubble otp-message-received">
                                            <div className="otp-bubble-text">
                                                797011 is your verification code.
                                                <br /><br />
                                                For your security, do not share this code.
                                            </div>
                                            <div className="otp-bubble-time">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        {/* Code Expiration Text */}
                                        <div className="otp-expiration-text">
                                            This code expires in {displayExpiration || 'no'} {displayExpiration === 1 ? 'minute' : displayExpiration ? 'minutes' : 'time limit'}
                                        </div>

                                        {/* Copy Code Button */}
                                        <div className="otp-copy-code-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            Copy code
                                        </div>

                                        {/* Typing Indicator */}
                                        <div className="otp-typing-indicator">
                                            <span className="otp-typing-dot" />
                                            <span className="otp-typing-dot" />
                                            <span className="otp-typing-dot" />
                                        </div>
                                    </div>

                                    {/* WhatsApp Input Bar */}
                                    <div className="otp-wa-input-bar">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                                        </svg>
                                        <div className="otp-wa-input-field">
                                            <span className="otp-wa-input-placeholder">Type a message</span>
                                        </div>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="otp-phone-home-btn" />

                                {/* Bottom Notice */}
                                <div className="otp-bottom-notice">
                                    <span className="otp-notice-text">You're receiving messages from this business.</span>
                                    <div className="otp-notice-actions">
                                        <button className="otp-notice-btn otp-notice-block">BLOCK</button>
                                        <button className="otp-notice-btn otp-notice-continue">CONTINUE</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}