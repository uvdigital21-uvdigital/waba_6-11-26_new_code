import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'

export default function Chatbot() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false)
    const [isWelcomeMessageOpen, setIsWelcomeMessageOpen] = useState(false)
    const [isOptoutKeywordOpen, setIsOptoutKeywordOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('TEXT')
    const [keyword, setKeyword] = useState('')
    const [actionText, setActionText] = useState('')
    const [welcomeMessage, setWelcomeMessage] = useState('')
    const [optoutKeyword, setOptoutKeyword] = useState('')

    const tabs = ['TEXT', 'TEMPLATE', 'ADD TO GROUP', 'ADD TO TAG', 'PUSH TO WEBHOOK', 'WAPP Form', 'Connect to Agents']

    const handleSave = () => {
        // Add save logic here
        console.log('Saving bot:', { keyword, actionText, activeTab })
        setIsAddBotModalOpen(false)
        setKeyword('')
        setActionText('')
    }

    const handleDiscard = () => {
        setIsAddBotModalOpen(false)
        setKeyword('')
        setActionText('')
    }

    const handleWelcomeMessageSave = () => {
        console.log('Saving welcome message:', welcomeMessage)
        setIsWelcomeMessageOpen(false)
        setWelcomeMessage('')
    }

    const handleWelcomeMessageDiscard = () => {
        setIsWelcomeMessageOpen(false)
        setWelcomeMessage('')
    }

    const handleOptoutKeywordSave = () => {
        console.log('Saving optout keyword:', optoutKeyword)
        setIsOptoutKeywordOpen(false)
        setOptoutKeyword('')
    }

    const handleOptoutKeywordDiscard = () => {
        setIsOptoutKeywordOpen(false)
        setOptoutKeyword('')
    }

    return (
        <Layout title="ChatBot">
            <div className="chatbot-manager-page">
                {/* Header with title and action buttons */}
                <div className="chatbot-manager-header">
                    <div className="chatbot-manager-title-section">
                        <h1 className="chatbot-manager-title">ChatBot Manager</h1>
                        <div className="chatbot-manager-actions">
                            <button
                                className="btn-action-green"
                                onClick={() => setIsAddBotModalOpen(true)}
                            >
                                Add ChatBot
                            </button>
                            <button
                                className="btn-action-blue"
                                onClick={() => setIsWelcomeMessageOpen(true)}
                            >
                                Welcome Message
                            </button>
                            <button
                                className="btn-action-purple"
                                onClick={() => setIsOptoutKeywordOpen(true)}
                            >
                                Add OPTOUT Keyword
                            </button>
                            <button
                                className="btn-action-teal"
                                onClick={() => navigate('/reports/whatsapp-forms/create')}
                            >
                                Create WappForm
                            </button>
                        </div>
                    </div>
                    <div className="chatbot-manager-search">
                        <input
                            type="text"
                            placeholder="Serch by Keywords, Actiontext, Keyaction, etc ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="chatbot-search-input"
                        />
                    </div>
                </div>

                {/* Table Section */}
                <div className="chatbot-manager-table-container">
                    <table className="chatbot-manager-table">
                        <thead>
                            <tr>
                                <th>Keyword</th>
                                <th>Keyaction</th>
                                <th>Actiontext</th>
                                <th>AddedOn</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan="5" className="no-records">
                                    No matching records found
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Bot Modal */}
            {isAddBotModalOpen && (
                <div className="modal-overlay-add-bot">
                    <div className="modal-content-add-bot">
                        {/* Modal Header */}
                        <div className="modal-header-add-bot">
                            <h2>Add Bot</h2>
                            <button
                                className="modal-close-btn"
                                onClick={handleDiscard}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body-add-bot">
                            {/* Keyword Field */}
                            <div className="form-field-add-bot">
                                <label className="form-label-add-bot">Keyword:</label>
                                <input
                                    type="text"
                                    placeholder="Enter Keyword"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="form-input-add-bot"
                                />
                                <span className="form-hint-add-bot">Enter * for default Message</span>
                            </div>

                            {/* Tabs */}
                            <div className="tabs-container-add-bot">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab}
                                        className={`tab-button-add-bot ${activeTab === tab ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab)}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="tab-content-add-bot">
                                {activeTab === 'TEXT' && (
                                    <div className="form-field-add-bot">
                                        <label className="form-label-add-bot">Enter Reply Text:</label>
                                        <textarea
                                            placeholder="Enter Actiontext here"
                                            value={actionText}
                                            onChange={(e) => setActionText(e.target.value)}
                                            className="form-textarea-add-bot"
                                            rows={6}
                                        />
                                    </div>
                                )}

                                {activeTab === 'TEMPLATE' && (
                                    <div className="template-content">
                                        <div className="template-buttons">
                                            <button className="btn-template">Add Normal Template</button>
                                            <button className="btn-template-official">Add Offical Template</button>
                                        </div>
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Select Template:</label>
                                            <select className="form-select-add-bot">
                                                <option>hello_world (utility)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'ADD TO GROUP' && (
                                    <div className="group-content">
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Select Group:</label>
                                            <button className="btn-add-new-green">Click here to Add new</button>
                                            <select className="form-select-add-bot">
                                                <option>Select Group</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'ADD TO TAG' && (
                                    <div className="tag-content">
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Select Tag:</label>
                                            <button className="btn-add-new-green">Click here to Add new</button>
                                            <select className="form-select-add-bot">
                                                <option>Select Tag</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'PUSH TO WEBHOOK' && (
                                    <div className="webhook-content">
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Select HTTP Type:</label>
                                            <select className="form-select-add-bot">
                                                <option>GET</option>
                                                <option>POST</option>
                                            </select>
                                        </div>
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Enter Actiontext here</label>
                                            <textarea
                                                placeholder="Enter Actiontext here"
                                                value={actionText}
                                                onChange={(e) => setActionText(e.target.value)}
                                                className="form-textarea-add-bot"
                                                rows={4}
                                            />
                                        </div>
                                        <div className="webhook-notice">
                                            <p className="webhook-notice-text">* Kindly make JSON Webhook. our JSON body will be like below.</p>
                                            <p className="webhook-notice-sub">We will PUSH JSON Body to your Webhook</p>
                                        </div>
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">GET Body:</label>
                                            <div className="webhook-url-display">
                                                http://example.com/inwebhook?fromnumber={'<<fromnumber>>'} &tonumber={'<<tonumber>>'} &msg={'<<msg>>'} &msgid={'<<msgid>>'} &fromname={'<<fromname>>'} &datetime={'<<datetime>>'} &timestamp={'<<timestamp>>'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'WAPP Form' && (
                                    <div className="wappform-content">
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Select Formname:</label>
                                            <select className="form-select-add-bot">
                                                <option>Select Formname</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'Connect to Agents' && (
                                    <div className="agents-content">
                                        <div className="form-field-add-bot">
                                            <label className="form-label-add-bot">Select Agents:</label>
                                            <select className="form-select-add-bot">
                                                <option>Select Agents</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="modal-footer-add-bot">
                            <button
                                className="btn-discard-add-bot"
                                onClick={handleDiscard}
                            >
                                Discard
                            </button>
                            <button
                                className="btn-save-add-bot"
                                onClick={handleSave}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome Message Modal */}
            {isWelcomeMessageOpen && (
                <div className="modal-overlay-simple">
                    <div className="modal-content-simple">
                        <div className="modal-header-simple">
                            <h2>Welcome Message</h2>
                            <button
                                className="modal-close-btn"
                                onClick={handleWelcomeMessageDiscard}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body-simple">
                            <div className="form-field-simple">
                                <label className="form-label-simple">Message</label>
                                <textarea
                                    placeholder="Enter welcome message"
                                    value={welcomeMessage}
                                    onChange={(e) => setWelcomeMessage(e.target.value)}
                                    className="form-textarea-simple"
                                    rows={6}
                                />
                            </div>
                        </div>
                        <div className="modal-footer-simple">
                            <button
                                className="btn-update-simple"
                                onClick={handleWelcomeMessageSave}
                            >
                                Update
                            </button>
                            <button
                                className="btn-discard-simple"
                                onClick={handleWelcomeMessageDiscard}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OPTOUT Keyword Modal */}
            {isOptoutKeywordOpen && (
                <div className="modal-overlay-simple">
                    <div className="modal-content-simple">
                        <div className="modal-header-simple">
                            <h2>OPTOUT Keyword</h2>
                            <button
                                className="modal-close-btn"
                                onClick={handleOptoutKeywordDiscard}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body-simple">
                            <div className="form-field-simple">
                                <label className="form-label-simple">Keyword</label>
                                <textarea
                                    placeholder="Enter keyword"
                                    value={optoutKeyword}
                                    onChange={(e) => setOptoutKeyword(e.target.value)}
                                    className="form-textarea-simple"
                                    rows={6}
                                />
                            </div>
                        </div>
                        <div className="modal-footer-simple">
                            <button
                                className="btn-update-simple"
                                onClick={handleOptoutKeywordSave}
                            >
                                Update
                            </button>
                            <button
                                className="btn-discard-simple"
                                onClick={handleOptoutKeywordDiscard}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
