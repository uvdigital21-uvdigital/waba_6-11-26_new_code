import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'

export default function SendCsv() {
    const [fileName, setFileName] = useState('')
    const [formData, setFormData] = useState({
        template: '',
        country: 'India(+91)',
        mobileColumn: 'A',
        mediaColumn: 'NA'
    })
    const [showPreview, setShowPreview] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFileName(e.target.files[0].name)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
                setFileName(file.name)
            } else {
                alert('Please upload a CSV or Excel file')
            }
        }
    }

    const togglePreview = () => {
        setShowPreview(!showPreview)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        console.log('Form submitted:', formData, fileName)
        // Add your API call here
    }

    return (
        <Layout title="Send CSV Campaign">
            <div className="dashboard-content">
                <div className="csv-campaign-card">
                    {/* Header */}
                    <div className="csv-campaign-header">
                        <div className="csv-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                            </svg>
                        </div>
                        <h1>Wapp Message Dynamic (Offical) By CSV/XLS</h1>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Template Selection Row */}
                        <div className="form-row">
                            {/* Template Dropdown */}
                            <div className="form-field">
                                <label className="field-label">Template:</label>
                                <div className="select-wrapper">
                                    <select
                                        name="template"
                                        value={formData.template}
                                        onChange={handleChange}
                                        className="form-select"
                                    >
                                        <option value="">Select Offical Template</option>
                                        <option value="template1">Template 1</option>
                                        <option value="template2">Template 2</option>
                                        <option value="template3">Template 3</option>
                                    </select>
                                    <button
                                        type="button"
                                        className="eye-icon-btn"
                                        onClick={togglePreview}
                                        title="Preview Template"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Media Link Column */}
                            <div className="form-field">
                                <label className="field-label">
                                    Select Media Link Column(optional)
                                    <span className="help-link">Help</span>
                                </label>
                                <div className="select-wrapper">
                                    <select
                                        name="mediaColumn"
                                        value={formData.mediaColumn}
                                        onChange={handleChange}
                                        className="form-select"
                                    >
                                        <option value="NA">NA</option>
                                        <option value="column1">Column 1</option>
                                        <option value="column2">Column 2</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Column Selection */}
                        <div className="mobile-column-section">
                            <label className="section-label">Select Mobile Column</label>
                            <div className="mobile-column-row">
                                <div className="select-wrapper">
                                    <select
                                        name="country"
                                        value={formData.country}
                                        onChange={handleChange}
                                        className="form-select"
                                    >
                                        <option value="India(+91)">India(+91)</option>
                                        <option value="USA(+1)">USA(+1)</option>
                                        <option value="UK(+44)">UK(+44)</option>
                                    </select>
                                </div>
                                <div className="select-wrapper">
                                    <select
                                        name="mobileColumn"
                                        value={formData.mobileColumn}
                                        onChange={handleChange}
                                        className="form-select"
                                    >
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* File Upload Section */}
                        <div className="upload-section">
                            <label className="section-label">
                                Upload Number CSV/Excel File: (Max size 20MB)
                            </label>
                            <div
                                className={`file-upload-area ${isDragging ? 'dragging' : ''} ${fileName ? 'has-file' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="upload-content">
                                    <div className="upload-icon">📊</div>
                                    <p className="upload-text">Drag & Drop files(mobile numbers)</p>
                                    <label htmlFor="csv-upload" className="browse-link">
                                        Browse Files
                                    </label>
                                    <input
                                        type="file"
                                        accept=".csv,.xls,.xlsx"
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                        id="csv-upload"
                                    />
                                </div>
                            </div>
                            <a href="#" className="sample-link">(View Sample CSV Image)</a>
                        </div>

                        {/* Action Buttons */}
                        <div className="csv-action-buttons">
                            <button type="submit" className="btn-send-now">
                                Send Now
                            </button>
                            <button type="button" className="btn-schedule">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Schedule Date
                            </button>
                            <button type="button" className="btn-exclude">
                                Exclude Past Campaigns
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Template Preview Modal */}
            {showPreview && (
                <div className="preview-modal-overlay" onClick={togglePreview}>
                    <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="preview-modal-header">
                            <h2>Template Preview:</h2>
                            <button
                                type="button"
                                className="preview-close-btn"
                                onClick={togglePreview}
                            >
                                ×
                            </button>
                        </div>
                        <div className="preview-modal-body">
                            <div className="phone-mockup">
                                <div className="phone-header">
                                    <div className="phone-time">11:48 AM</div>
                                    <div className="phone-icons">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                        </svg>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="phone-content">
                                    <div className="phone-chat-bg"></div>
                                    <div className="phone-message-bubble">
                                        <p>Welcome and congratulations!!</p>
                                        <p>This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.</p>
                                        <div className="message-footer">
                                            <span>WhatsApp Business Platform sample message</span>
                                            <span className="message-time">11:48 AM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}