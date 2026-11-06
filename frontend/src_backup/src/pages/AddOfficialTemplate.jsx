import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

const BUTTON_TYPES = [
    { value: 'CALL_TO_ACTION', label: 'Call to action' },
    { value: 'URL_LINK', label: 'URL Link' },
    { value: 'QUICK_REPLY', label: 'Quick reply' },
    { value: 'COPY_CODE', label: 'Copy Code' },
    { value: 'FLOW', label: 'Flow' },
    { value: 'CATALOG', label: 'Catalog' },
]

const MAX_BUTTONS = 10
const MAX_BUTTON_TEXT = 25

export default function AddOfficialTemplate() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        message: '',
        category: 'UTILITY',
        templateType: 'text',
        language: 'en',
        footer: '',
        buttons: []
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [variableCount, setVariableCount] = useState(0)
    const messageRef = useRef(null)
    const [selectionStart, setSelectionStart] = useState(0)
    const [showButtonDropdown, setShowButtonDropdown] = useState(false)
    const buttonDropdownRef = useRef(null)

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('wa_dashboard_token')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }, [])

    const updateSelectionStart = () => {
        if (messageRef.current) {
            setSelectionStart(messageRef.current.selectionStart)
        }
    }

    const insertAtCursor = (text) => {
        const textarea = messageRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const currentMessage = newTemplate.message
        const newMessage = currentMessage.substring(0, start) + text + currentMessage.substring(end)
        if (newMessage.length <= 1024) {
            setNewTemplate({ ...newTemplate, message: newMessage })
            setTimeout(() => {
                textarea.focus()
                textarea.setSelectionRange(start + text.length, start + text.length)
            }, 0)
        }
    }

    const handleAddVariable = () => {
        const nextVar = variableCount + 1
        setVariableCount(nextVar)
        insertAtCursor(`{{${nextVar}}}`)
    }

    const handleBold = () => {
        insertAtCursor('*bold text*')
    }

    const handleItalic = () => {
        insertAtCursor('_italic text_')
    }

    const handleStrike = () => {
        insertAtCursor('~strikethrough~')
    }

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (buttonDropdownRef.current && !buttonDropdownRef.current.contains(e.target)) {
                setShowButtonDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close dropdown on ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') setShowButtonDropdown(false)
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [])

    const handleSelectButtonType = (type) => {
        const newBtn = {
            id: Date.now() + Math.random(),
            type: type,
            text: '',
            phoneNumber: '',
            url: '',
            urlType: 'STATIC',
            couponCode: '',
            flowId: '',
            catalogId: '',
        }
        setNewTemplate({
            ...newTemplate,
            buttons: [...newTemplate.buttons, newBtn]
        })
        setShowButtonDropdown(false)
    }

    const handleRemoveButton = (id) => {
        setNewTemplate({
            ...newTemplate,
            buttons: newTemplate.buttons.filter(b => b.id !== id)
        })
    }

    const handleButtonChange = (id, field, value) => {
        setNewTemplate({
            ...newTemplate,
            buttons: newTemplate.buttons.map(b =>
                b.id === id ? { ...b, [field]: value } : b
            )
        })
    }

    const handleCreateTemplate = async (e) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            const body = {
                name: newTemplate.name,
                message: newTemplate.message,
                category: newTemplate.category
            }
            const res = await fetch(`${API_BASE}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to create template')
            setSuccess('Template created successfully')
            setTimeout(() => {
                navigate('/template/manage')
            }, 1500)
        } catch (err) {
            setError(err.message)
            setSubmitting(false)
        }
    }

    const renderFormattedMessage = (msg) => {
        if (!msg) return ''
        let html = msg
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/\n/g, '<br/>')
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/~(.*?)~/g, '<del>$1</del>')
            .replace(/\{\{(\d+)\}\}/g, '<span class="preview-variable">{{$1}}</span>')
        return html
    }

    const getButtonPreviewLabel = (btn) => {
        switch (btn.type) {
            case 'CALL_TO_ACTION': return 'Call'
            case 'URL_LINK': return 'Website'
            case 'QUICK_REPLY': return 'Quick Reply'
            case 'COPY_CODE': return 'Copy Code'
            case 'FLOW': return 'Flow'
            case 'CATALOG': return 'View Catalog'
            default: return 'Button'
        }
    }

    const getButtonPreviewText = (btn) => {
        if (btn.text) return btn.text
        switch (btn.type) {
            case 'CALL_TO_ACTION': return 'Call Now'
            case 'URL_LINK': return 'Visit Now'
            case 'QUICK_REPLY': return 'Reply'
            case 'COPY_CODE': return 'Copy Code'
            case 'FLOW': return 'Flow'
            case 'CATALOG': return 'View Catalog'
            default: return 'Button'
        }
    }

    const messageLength = newTemplate.message.length

    return (
        <Layout title="Add Official Template">
            <div className="official-template-page">
                {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
                {success && <div className="success-banner" style={{ marginBottom: 16 }}>{success}</div>}

                {/* Header */}
                <div className="template-form-header">
                    <div className="header-left-section">
                        <div className="header-icon-wrapper">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <h1 className="template-form-title">Official Wapp Template</h1>
                    </div>
                    <div className="header-right-section">
                        <button className="btn-manage-templates" onClick={() => navigate('/template/manage')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                            </svg>
                            Manage Templates
                        </button>
                        <button className="btn-create-otp" onClick={() => navigate('/template/manage/add/otp')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            Create OTP Template
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="template-form-body">
                    {/* LEFT SIDE - Form */}
                    <div className="template-form-left">
                        <div className="template-form-card">
                            {/* Template Name */}
                            <div className="template-field-group">
                                <label className="template-field-label">Template Name</label>
                                <input
                                    type="text"
                                    className="template-field-input"
                                    placeholder="eg. abc_123, abc_123_abc, etc ..."
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Template Type, Language, Category Row */}
                            <div className="template-row-fields">
                                <div className="template-field-group">
                                    <label className="template-field-label">Template Type</label>
                                    <select
                                        className="template-field-select"
                                        value={newTemplate.templateType}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, templateType: e.target.value })}
                                    >
                                        <option value="text">Standard (text only)</option>
                                        <option value="image">Media Image</option>
                                        <option value="video">Media Video</option>
                                        <option value="document">Media Document</option>
                                    </select>
                                </div>
                                <div className="template-field-group">
                                    <label className="template-field-label">Language</label>
                                    <select
                                        className="template-field-select"
                                        value={newTemplate.language}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">Hindi</option>
                                        <option value="gu">Gujarati</option>
                                        <option value="mr">Marathi</option>
                                    </select>
                                </div>
                                <div className="template-field-group">
                                    <label className="template-field-label">Category</label>
                                    <select
                                        className="template-field-select"
                                        value={newTemplate.category}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                    >
                                        <option value="MARKETING">Marketing</option>
                                        <option value="UTILITY">Utility</option>
                                        <option value="AUTHENTICATION">Authentication</option>
                                    </select>
                                </div>
                            </div>

                            {/* Message Box */}
                            <div className="template-field-group">
                                <div className="message-label-row">
                                    <label className="template-field-label">Message</label>
                                    <span className="message-char-count">(Max {messageLength}/1024 Characters)</span>
                                </div>
                                <div className="message-toolbar">
                                    <button type="button" className="toolbar-btn" onClick={handleAddVariable} title="Add Variable">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>
                                        Add Variable
                                    </button>
                                    <div className="toolbar-divider" />
                                    <button type="button" className="toolbar-btn" onClick={handleBold} title="Bold">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" /></svg>
                                    </button>
                                    <button type="button" className="toolbar-btn" onClick={handleItalic} title="Italic">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" /></svg>
                                    </button>
                                    <button type="button" className="toolbar-btn" onClick={handleStrike} title="Strikethrough">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 12h12" /><path d="M9 5c0-.55.45-1 1-1h4c.55 0 1 .45 1 1v0c0 .55-.45 1-1 1h-4c-.55 0-1-.45-1-1z" /><path d="M7 19c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v0c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1z" /></svg>
                                    </button>
                                </div>
                                <textarea
                                    ref={messageRef}
                                    className="template-message-textarea"
                                    placeholder="Enter your message here..."
                                    value={newTemplate.message}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 1024) {
                                            setNewTemplate({ ...newTemplate, message: e.target.value })
                                        }
                                    }}
                                    onClick={updateSelectionStart}
                                    onKeyUp={updateSelectionStart}
                                    rows="6"
                                    required
                                />
                            </div>

                            {/* Buttons Section */}
                            <div className="template-field-group">
                                <div className="buttons-section-header">
                                    <label className="template-field-label">Buttons (Optional)</label>
                                    {newTemplate.buttons.length < MAX_BUTTONS && (
                                        <div className="btn-add-button-wrapper" ref={buttonDropdownRef}>
                                            <button
                                                type="button"
                                                className="btn-add-button"
                                                onClick={() => setShowButtonDropdown(!showButtonDropdown)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                Add Button
                                            </button>
                                            {showButtonDropdown && (
                                                <div className="btn-type-dropdown">
                                                    {BUTTON_TYPES.map((bt) => (
                                                        <div
                                                            key={bt.value}
                                                            className="btn-type-dropdown-item"
                                                            onClick={() => handleSelectButtonType(bt.value)}
                                                        >
                                                            {bt.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {newTemplate.buttons.length > 0 && (
                                    <div className="template-buttons-list">
                                        {newTemplate.buttons.map((btn) => (
                                            <div key={btn.id} className="template-button-row">
                                                {/* CALL TO ACTION */}
                                                {btn.type === 'CALL_TO_ACTION' && (
                                                    <>
                                                        <div className="button-row-label">Call to Action</div>
                                                        <div className="button-row-fields">
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="Call Now"
                                                                    value={btn.text}
                                                                    maxLength={MAX_BUTTON_TEXT}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Phone Number</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="+91XXXXXXXXXX"
                                                                    value={btn.phoneNumber}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value
                                                                        if (/^\+?\d*$/.test(val)) {
                                                                            handleButtonChange(btn.id, 'phoneNumber', val)
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-remove-button"
                                                                onClick={() => handleRemoveButton(btn.id)}
                                                                title="Remove button"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {/* URL LINK */}
                                                {btn.type === 'URL_LINK' && (
                                                    <>
                                                        <div className="button-row-label">URL Link</div>
                                                        <div className="button-row-fields">
                                                            <div className="button-field-group button-field-small">
                                                                <label className="button-field-label">URL Type</label>
                                                                <select
                                                                    className="template-field-select"
                                                                    value={btn.urlType}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'urlType', e.target.value)}
                                                                >
                                                                    <option value="STATIC">Static</option>
                                                                    <option value="DYNAMIC">Dynamic</option>
                                                                </select>
                                                            </div>
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="Visit Now"
                                                                    value={btn.text}
                                                                    maxLength={MAX_BUTTON_TEXT}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">URL</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="https://example.com"
                                                                    value={btn.url}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'url', e.target.value)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-remove-button"
                                                                onClick={() => handleRemoveButton(btn.id)}
                                                                title="Remove button"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {/* QUICK REPLY */}
                                                {btn.type === 'QUICK_REPLY' && (
                                                    <>
                                                        <div className="button-row-label">Quick Reply</div>
                                                        <div className="button-row-fields">
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="Reply Text"
                                                                    value={btn.text}
                                                                    maxLength={MAX_BUTTON_TEXT}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-remove-button"
                                                                onClick={() => handleRemoveButton(btn.id)}
                                                                title="Remove button"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {/* COPY CODE */}
                                                {btn.type === 'COPY_CODE' && (
                                                    <>
                                                        <div className="button-row-label">Copy Code</div>
                                                        <div className="button-row-fields">
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="Copy Code"
                                                                    value={btn.text}
                                                                    maxLength={MAX_BUTTON_TEXT}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Coupon Code</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="SAVE50"
                                                                    value={btn.couponCode}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'couponCode', e.target.value)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-remove-button"
                                                                onClick={() => handleRemoveButton(btn.id)}
                                                                title="Remove button"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {/* FLOW */}
                                                {btn.type === 'FLOW' && (
                                                    <>
                                                        <div className="button-row-label">Flow</div>
                                                        <div className="button-row-fields">
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Flow ID</label>
                                                                <select
                                                                    className="template-field-select"
                                                                    value={btn.flowId}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'flowId', e.target.value)}
                                                                >
                                                                    <option value="">Select Flow</option>
                                                                    <option value="flow_1">Flow 1</option>
                                                                    <option value="flow_2">Flow 2</option>
                                                                    <option value="flow_3">Flow 3</option>
                                                                </select>
                                                            </div>
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="Flow"
                                                                    value={btn.text}
                                                                    maxLength={MAX_BUTTON_TEXT}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-remove-button"
                                                                onClick={() => handleRemoveButton(btn.id)}
                                                                title="Remove button"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {/* CATALOG */}
                                                {btn.type === 'CATALOG' && (
                                                    <>
                                                        <div className="button-row-label">Catalog</div>
                                                        <div className="button-row-fields">
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Catalog ID</label>
                                                                <select
                                                                    className="template-field-select"
                                                                    value={btn.catalogId}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'catalogId', e.target.value)}
                                                                >
                                                                    <option value="">Select Catalog</option>
                                                                    <option value="catalog_1">Catalog 1</option>
                                                                    <option value="catalog_2">Catalog 2</option>
                                                                    <option value="catalog_3">Catalog 3</option>
                                                                </select>
                                                            </div>
                                                            <div className="button-field-group">
                                                                <label className="button-field-label">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="template-field-input"
                                                                    placeholder="View Catalog"
                                                                    value={btn.text}
                                                                    maxLength={MAX_BUTTON_TEXT}
                                                                    onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-remove-button"
                                                                onClick={() => handleRemoveButton(btn.id)}
                                                                title="Remove button"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer (Optional) */}
                            <div className="template-field-group">
                                <label className="template-field-label">Footer (Optional)</label>
                                <input
                                    type="text"
                                    className="template-field-input"
                                    placeholder="Footer text"
                                    value={newTemplate.footer}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, footer: e.target.value })}
                                />
                            </div>

                            {/* Save Button */}
                            <div className="template-form-actions">
                                <button
                                    className="btn-save-template"
                                    onClick={handleCreateTemplate}
                                    disabled={!newTemplate.name || !newTemplate.message || submitting}
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
                                            Save Template
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE - Phone Preview */}
                    <div className="template-form-right">
                        <div className="phone-mockup-wrapper">
                            <div className="phone-mockup">
                                <div className="phone-notch" />
                                <div className="phone-screen">
                                    {/* WhatsApp Header */}
                                    <div className="wa-chat-header">
                                        <div className="wa-header-left">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M19 12H5M12 19l-7-7 7-7" />
                                            </svg>
                                        </div>
                                        <div className="wa-header-center">
                                            <div className="wa-avatar">D</div>
                                            <span className="wa-contact-name">Demo</span>
                                        </div>
                                        <div className="wa-header-right">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Chat Area */}
                                    <div className="wa-chat-area">
                                        {/* Live message preview - single left-aligned incoming bubble */}
                                        {newTemplate.message && (
                                            <div className="wa-message-bubble wa-message-received">
                                                <div
                                                    className="wa-bubble-text"
                                                    dangerouslySetInnerHTML={{ __html: renderFormattedMessage(newTemplate.message) }}
                                                />
                                                {newTemplate.footer && (
                                                    <div className="wa-bubble-footer">{newTemplate.footer}</div>
                                                )}
                                                <div className="wa-bubble-time">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Buttons in preview */}
                                        {newTemplate.buttons.length > 0 && (
                                            <div className="wa-button-group wa-button-group-left">
                                                {newTemplate.buttons.map((btn, idx) => (
                                                    <div key={btn.id} className="wa-button-item">
                                                        <div className="wa-button-header">
                                                            <span className="wa-btn-badge">{getButtonPreviewLabel(btn)}</span>
                                                        </div>
                                                        <div className="wa-button-value">{getButtonPreviewText(btn)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Typing indicator */}
                                        <div className="wa-typing-indicator">
                                            <span className="wa-typing-dot" />
                                            <span className="wa-typing-dot" />
                                            <span className="wa-typing-dot" />
                                        </div>
                                    </div>

                                    {/* WhatsApp Input Bar */}
                                    <div className="wa-input-bar">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                                        </svg>
                                        <div className="wa-input-field">
                                            <span className="wa-input-placeholder">Type a message</span>
                                        </div>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                                        </svg>
                                    </div>
                                </div>
                                {/* Home button */}
                                <div className="phone-home-btn" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}