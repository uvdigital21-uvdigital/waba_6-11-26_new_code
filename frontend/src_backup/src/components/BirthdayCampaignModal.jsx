import React, { useState } from 'react'

export default function BirthdayCampaignModal({ isOpen, onClose, onSave }) {
    const [activeTab, setActiveTab] = useState('single')

    // Single Details Form State
    const [singleForm, setSingleForm] = useState({
        name: '',
        dob: '',
        wishTime: '10:00',
        country: 'India(+91)',
        mobileNumbers: '',
        template: '',
        notes: ''
    })

    // CSV Upload Form State
    const [csvForm, setCsvForm] = useState({
        csvFile: null,
        nameColumn: '',
        mobileColumn: '',
        dobColumn: '',
        dateFormat: 'yyyyMMdd',
        wishTime: '10:00',
        country: 'India(+91)',
        template: '',
        notes: ''
    })

    const handleSingleChange = (field, value) => {
        setSingleForm({
            ...singleForm,
            [field]: value
        })
    }

    const handleCsvChange = (field, value) => {
        setCsvForm({
            ...csvForm,
            [field]: value
        })
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setCsvForm({
                ...csvForm,
                csvFile: file
            })
        }
    }

    const handleSingleSave = (e) => {
        e.preventDefault()
        if (singleForm.name && singleForm.dob && singleForm.mobileNumbers) {
            onSave({
                type: 'single',
                data: singleForm
            })
            resetForms()
            onClose()
        }
    }

    const handleCsvSave = (e) => {
        e.preventDefault()
        if (csvForm.csvFile && csvForm.nameColumn && csvForm.mobileColumn && csvForm.dobColumn) {
            onSave({
                type: 'csv',
                data: csvForm
            })
            resetForms()
            onClose()
        }
    }

    const resetForms = () => {
        setSingleForm({
            name: '',
            dob: '',
            wishTime: '10:00',
            country: 'India(+91)',
            mobileNumbers: '',
            template: '',
            notes: ''
        })
        setCsvForm({
            csvFile: null,
            nameColumn: '',
            mobileColumn: '',
            dobColumn: '',
            dateFormat: 'yyyyMMdd',
            wishTime: '10:00',
            country: 'India(+91)',
            template: '',
            notes: ''
        })
    }

    const handleDiscard = () => {
        resetForms()
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="birthday-campaign-overlay" onClick={onClose}>
            <div className="birthday-campaign-modal" onClick={(e) => e.stopPropagation()}>
                <div className="birthday-campaign-modal-header">
                    <h2>Add Birthday Campaign</h2>
                    <button className="btn-close-modal" onClick={onClose}>
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div className="birthday-campaign-tabs">
                    <button
                        className={`tab-button ${activeTab === 'single' ? 'active' : ''}`}
                        onClick={() => setActiveTab('single')}
                    >
                        Single Details
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'csv' ? 'active' : ''}`}
                        onClick={() => setActiveTab('csv')}
                    >
                        Upload CSV File
                    </button>
                </div>

                {/* Single Details Tab */}
                {activeTab === 'single' && (
                    <form onSubmit={handleSingleSave}>
                        <div className="birthday-campaign-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input
                                        type="text"
                                        value={singleForm.name}
                                        onChange={(e) => handleSingleChange('name', e.target.value)}
                                        placeholder="Enter name"
                                        className="form-input"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Campaign Type</label>
                                    <select className="form-select" disabled>
                                        <option>Birthday</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">DOB:</label>
                                    <input
                                        type="text"
                                        value={singleForm.dob}
                                        onChange={(e) => handleSingleChange('dob', e.target.value)}
                                        placeholder="yyyymmdd"
                                        className="form-input"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Wishing Time:</label>
                                    <input
                                        type="time"
                                        value={singleForm.wishTime}
                                        onChange={(e) => handleSingleChange('wishTime', e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Country</label>
                                    <select
                                        value={singleForm.country}
                                        onChange={(e) => handleSingleChange('country', e.target.value)}
                                        className="form-select"
                                    >
                                        <option>India(+91)</option>
                                        <option>USA(+1)</option>
                                        <option>UK(+44)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mobile Numbers (add multiple by using ',')</label>
                                    <input
                                        type="text"
                                        value={singleForm.mobileNumbers}
                                        onChange={(e) => handleSingleChange('mobileNumbers', e.target.value)}
                                        placeholder="Enter mobile numbers"
                                        className="form-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Template:</label>
                                    <select
                                        value={singleForm.template}
                                        onChange={(e) => handleSingleChange('template', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="">Select Official Template</option>
                                        <option value="template1">Template 1</option>
                                        <option value="template2">Template 2</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes:</label>
                                <textarea
                                    value={singleForm.notes}
                                    onChange={(e) => handleSingleChange('notes', e.target.value)}
                                    placeholder="Enter Notes"
                                    className="form-textarea"
                                    rows="4"
                                />
                            </div>
                        </div>

                        <div className="birthday-campaign-footer">
                            <button
                                type="button"
                                className="btn-discard"
                                onClick={handleDiscard}
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                className="btn-save"
                            >
                                Save
                            </button>
                        </div>
                    </form>
                )}

                {/* Upload CSV File Tab */}
                {activeTab === 'csv' && (
                    <form onSubmit={handleCsvSave}>
                        <div className="birthday-campaign-form">
                            <div className="form-group">
                                <label className="form-label">
                                    Upload CSV & Excel File: <span className="text-danger">(Max size 20MB)</span>
                                </label>
                                <div className="file-upload-area">
                                    <input
                                        type="file"
                                        id="csvFile"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="file-input"
                                    />
                                    <label htmlFor="csvFile" className="file-upload-label">
                                        {csvForm.csvFile ? csvForm.csvFile.name : (
                                            <>
                                                Drag & Drop files
                                                <br />
                                                <span className="browse-link">Browse Files</span>
                                            </>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Select Name Column</label>
                                    <select
                                        value={csvForm.nameColumn}
                                        onChange={(e) => handleCsvChange('nameColumn', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">Select column</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Select Mobile Column</label>
                                    <select
                                        value={csvForm.mobileColumn}
                                        onChange={(e) => handleCsvChange('mobileColumn', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">Select column</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Select DOB Column</label>
                                    <select
                                        value={csvForm.dobColumn}
                                        onChange={(e) => handleCsvChange('dobColumn', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">Select column</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Select Date Format</label>
                                    <select
                                        value={csvForm.dateFormat}
                                        onChange={(e) => handleCsvChange('dateFormat', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="yyyyMMdd">yyyyMMdd</option>
                                        <option value="ddMMyyyy">ddMMyyyy</option>
                                        <option value="MMddyyyy">MMddyyyy</option>
                                        <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Wishing Time:</label>
                                    <input
                                        type="time"
                                        value={csvForm.wishTime}
                                        onChange={(e) => handleCsvChange('wishTime', e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Campaign Type</label>
                                    <select className="form-select" disabled>
                                        <option>Birthday</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Country</label>
                                    <select
                                        value={csvForm.country}
                                        onChange={(e) => handleCsvChange('country', e.target.value)}
                                        className="form-select"
                                    >
                                        <option>India(+91)</option>
                                        <option>USA(+1)</option>
                                        <option>UK(+44)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Template:</label>
                                    <select
                                        value={csvForm.template}
                                        onChange={(e) => handleCsvChange('template', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="">Select Official Template</option>
                                        <option value="template1">Template 1</option>
                                        <option value="template2">Template 2</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes:</label>
                                <textarea
                                    value={csvForm.notes}
                                    onChange={(e) => handleCsvChange('notes', e.target.value)}
                                    placeholder="Enter Notes"
                                    className="form-textarea"
                                    rows="4"
                                />
                            </div>
                        </div>

                        <div className="birthday-campaign-footer">
                            <button
                                type="button"
                                className="btn-discard"
                                onClick={handleDiscard}
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                className="btn-save"
                            >
                                Save CSV
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}