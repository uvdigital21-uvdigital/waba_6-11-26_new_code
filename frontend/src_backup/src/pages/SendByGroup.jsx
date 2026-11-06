import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import GroupMasterModal from '../components/GroupMasterModal.jsx'

export default function SendByGroup() {
    const [formData, setFormData] = useState({
        template: '',
        group: '',
        country: 'India(+91)'
    })

    const [showPreview, setShowPreview] = useState(false)
    const [showGroupMaster, setShowGroupMaster] = useState(false)
    const [availableGroups, setAvailableGroups] = useState([
        { id: 1, name: 'Marketing' },
        { id: 2, name: 'Sales' },
        { id: 3, name: 'Support' },
        { id: 4, name: 'Development' }
    ])

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        console.log('Form submitted:', formData)
        // Add your API call here
    }

    const togglePreview = () => {
        setShowPreview(!showPreview)
    }

    const handleAddNewGroup = () => {
        setShowGroupMaster(true)
    }

    const handleCloseGroupMaster = () => {
        setShowGroupMaster(false)
    }

    const handleGroupCreated = (newGroup) => {
        setAvailableGroups([...availableGroups, newGroup])
        setFormData({ ...formData, group: newGroup.name })
        setShowGroupMaster(false)
    }

    return (
        <Layout title="Send By Group">
            <div className="dashboard-content">
                <div className="quick-campaign-card">
                    {/* Header with WhatsApp Icon */}
                    <div className="quick-campaign-header">
                        <div className="whatsapp-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </div>
                        <h1>send by group</h1>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Form Fields Row */}
                        <div className="form-row">
                            {/* Template Dropdown */}
                            <div className="form-field">
                                <label className="field-label">Template</label>
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

                            {/* Group Selector */}
                            <div className="form-field">
                                <label className="field-label">Group</label>
                                <div className="select-wrapper">
                                    <select
                                        name="group"
                                        value={formData.group}
                                        onChange={handleChange}
                                        className="form-select"
                                    >
                                        <option value="">Select Group</option>
                                        {availableGroups.map(group => (
                                            <option key={group.id} value={group.name}>
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Add New Group Button */}
                            <div className="form-field-button">
                                <button
                                    type="button"
                                    className="btn-add-group"
                                    onClick={handleAddNewGroup}
                                >
                                    Add New Group
                                </button>
                            </div>

                            {/* Country Selector */}
                            <div className="form-field">
                                <label className="field-label">Country</label>
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
                            </div>

                            {/* Exclude Past Campaigns Button */}
                            <div className="form-field-button">
                                <button type="button" className="exclude-btn">
                                    Exclude Past Campaigns
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="action-buttons">
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
                        </div>
                    </form>

                    {/* Group Master Modal */}
                    <GroupMasterModal
                        isOpen={showGroupMaster}
                        onClose={handleCloseGroupMaster}
                        onGroupCreated={handleGroupCreated}
                    />

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
                </div>
            </div>
        </Layout>
    )
}