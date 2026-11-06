import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config.js'

export default function AddNumbersModal({ isOpen, onClose, onAdd }) {
    const [formData, setFormData] = useState({
        waNumber: '',
        waNumberId: '',
        wabizId: '',
        permanentToken: ''
    })
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [submitWarning, setSubmitWarning] = useState('')
    const [metaErrorDetail, setMetaErrorDetail] = useState(null)

    useEffect(() => {
        if (!isOpen) {
            setFormData({
                waNumber: '',
                waNumberId: '',
                wabizId: '',
                permanentToken: ''
            })
            setErrors({})
            setSubmitError('')
            setSubmitWarning('')
            setMetaErrorDetail(null)
            setSubmitting(false)
        }
    }, [isOpen])

    const validate = () => {
        const newErrors = {}
        if (!formData.waNumber.trim()) {
            newErrors.waNumber = 'Phone Number is required'
        }
        if (!formData.waNumberId.trim()) {
            newErrors.waNumberId = 'Phone Number ID is required'
        }
        if (!formData.wabizId.trim()) {
            newErrors.wabizId = 'WABA ID is required'
        }
        if (!formData.permanentToken.trim()) {
            newErrors.permanentToken = 'Permanent Access Token is required'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitError('')
        setMetaErrorDetail(null)

        if (!validate()) {
            return
        }

        setSubmitting(true)
        try {
            const token = localStorage.getItem('wa_dashboard_token')
            const res = await fetch(`${API_BASE_URL}/whatsapp/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    phone_number: formData.waNumber.trim(),
                    phone_number_id: formData.waNumberId.trim(),
                    waba_id: formData.wabizId.trim(),
                    access_token: formData.permanentToken.trim()
                })
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                setMetaErrorDetail(data.metaError || null)
                throw new Error(data.message || 'Meta Verification Failed. Credentials could not be saved.')
            }

            // Account saved successfully — check if token was expired
            if (data.tokenExpired) {
                // Show warning but account IS saved — allow closing
                setSubmitWarning(data.message || 'Account saved with expired token. Please refresh your token from Meta Business Manager.')
                if (onAdd) await onAdd(data.data || data)
                // Don't close immediately — show the warning
                return
            }

            if (onAdd) {
                await onAdd(data.data || data)
            }
            onClose()
        } catch (err) {
            setSubmitError(err.message || 'Something went wrong. Please check Meta credentials and try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDiscard = () => {
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="add-number-overlay" onClick={handleDiscard}>
            <div className="add-number-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="add-number-header">
                    <h2>+ Add WhatsApp Number</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Connect official WhatsApp Business API credentials. Live Graph API verification will occur before saving.
                    </p>
                </div>

                {/* Body */}
                <form id="addNumberForm" onSubmit={handleSubmit} className="add-number-body">
                    {/* Token Expired Warning (account saved but token needs refresh) */}
                    {submitWarning && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '14px 16px', borderRadius: 10, fontSize: 13, marginBottom: 18 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚠️ Account Saved — Token Expired</div>
                            <p style={{ margin: '0 0 10px' }}>Your WhatsApp account was registered successfully, but your <strong>access token has expired</strong>. Messaging and template sync will not work until you refresh it.</p>
                            <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.7 }}>
                                <strong>How to get a new Permanent Token:</strong><br />
                                1. Go to <strong>business.facebook.com → Settings → System Users</strong><br />
                                2. Select your System User → click <strong>Generate New Token</strong><br />
                                3. Select your App, set expiry to <strong>Never</strong>, grant <code>whatsapp_business_messaging</code> + <code>whatsapp_business_management</code><br />
                                4. Copy the new token and click <strong>Update Token</strong> on the number in Manage Numbers page
                            </div>
                            <button onClick={onClose} style={{ marginTop: 12, background: '#d97706', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                                OK, Got it — Close
                            </button>
                        </div>
                    )}

                    {/* Hard Error Banner */}
                    {submitError && (
                        <div className="add-number-error-banner">
                            <strong>Verification Failed:</strong> {submitError}
                            {metaErrorDetail && (
                                <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.9 }}>
                                    Code: {metaErrorDetail.code} | Message: {metaErrorDetail.message}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Field 1: Phone Number */}
                    <div className="add-number-group">
                        <label className="add-number-label">
                            Phone Number (with Country Code)
                        </label>
                        <input
                            type="text"
                            className={`add-number-input ${errors.waNumber ? 'error-border' : ''}`}
                            name="waNumber"
                            placeholder="e.g. +919876543210"
                            value={formData.waNumber}
                            onChange={handleChange}
                        />
                        {errors.waNumber && <span className="add-number-field-error">{errors.waNumber}</span>}
                    </div>

                    {/* Field 2: Phone Number ID */}
                    <div className="add-number-group">
                        <label className="add-number-label">
                            Phone Number ID (from Meta Developer Portal)
                        </label>
                        <input
                            type="text"
                            className={`add-number-input ${errors.waNumberId ? 'error-border' : ''}`}
                            name="waNumberId"
                            placeholder="e.g. 102938475610293"
                            value={formData.waNumberId}
                            onChange={handleChange}
                        />
                        {errors.waNumberId && <span className="add-number-field-error">{errors.waNumberId}</span>}
                    </div>

                    {/* Field 3: WhatsApp Business Account ID */}
                    <div className="add-number-group">
                        <label className="add-number-label">
                            WhatsApp Business Account ID (WABA ID)
                        </label>
                        <input
                            type="text"
                            className={`add-number-input ${errors.wabizId ? 'error-border' : ''}`}
                            name="wabizId"
                            placeholder="e.g. 987654321012345"
                            value={formData.wabizId}
                            onChange={handleChange}
                        />
                        {errors.wabizId && <span className="add-number-field-error">{errors.wabizId}</span>}
                    </div>

                    {/* Field 4: Permanent Access Token */}
                    <div className="add-number-group">
                        <label className="add-number-label">
                            Permanent Access Token
                        </label>
                        <textarea
                            className={`add-number-textarea ${errors.permanentToken ? 'error-border' : ''}`}
                            name="permanentToken"
                            placeholder="Enter Meta System User Permanent Token (EAAG...)"
                            rows={3}
                            value={formData.permanentToken}
                            onChange={handleChange}
                        />
                        {errors.permanentToken && <span className="add-number-field-error">{errors.permanentToken}</span>}
                    </div>

                    {/* Footer Buttons */}
                    <div className="add-number-footer">
                        <button
                            type="button"
                            className="btn-add-num-discard"
                            onClick={handleDiscard}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-add-num-save"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                        <path d="M12 2 a10 10 0 0 1 10 10" />
                                    </svg>
                                    Verifying Meta API...
                                </span>
                            ) : 'Verify & Save WhatsApp Number'}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                .add-number-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.45);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1050;
                    padding: 16px;
                }
                .add-number-card {
                    background: #ffffff;
                    border-radius: 14px;
                    width: 100%;
                    max-width: 580px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    overflow: hidden;
                    animation: modalFadeIn 0.2s ease-out;
                }
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .add-number-header {
                    padding: 20px 28px 12px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .add-number-header h2 {
                    font-size: 20px;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0;
                }
                .add-number-body {
                    padding: 24px 28px;
                }
                .add-number-group {
                    margin-bottom: 18px;
                }
                .add-number-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 500;
                    color: #334155;
                    margin-bottom: 6px;
                }
                .add-number-input, .add-number-textarea {
                    width: 100%;
                    padding: 11px 14px;
                    font-size: 14px;
                    color: #0f172a;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    outline: none;
                    box-sizing: border-box;
                    transition: border-color 0.15s ease;
                }
                .add-number-input:focus, .add-number-textarea:focus {
                    border-color: #0284c7;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
                }
                .error-border {
                    border-color: #ef4444 !important;
                }
                .add-number-field-error {
                    font-size: 12px;
                    color: #ef4444;
                    margin-top: 4px;
                    display: block;
                }
                .add-number-error-banner {
                    background: #fef2f2;
                    border: 1px solid #fca5a5;
                    color: #991b1b;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 18px;
                }
                .add-number-footer {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid #f1f5f9;
                }
                .btn-add-num-discard {
                    background: #f8fafc;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    padding: 10px 22px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                }
                .btn-add-num-discard:hover {
                    background: #f1f5f9;
                }
                .btn-add-num-save {
                    background: #0284c7;
                    color: #ffffff;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);
                }
                .btn-add-num-save:hover {
                    background: #0369a1;
                }
                .btn-add-num-save:disabled, .btn-add-num-discard:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}