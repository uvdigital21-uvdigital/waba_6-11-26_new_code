import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'

export default function ChatbotFlow() {
    const [flows, setFlows] = useState([
        {
            id: 1,
            name: 'UV Vikram',
            addedOn: '21-03-2026 09:30 am',
            timeAgo: '(3 months ago)'
        }
    ])
    const [showEntries, setShowEntries] = useState(10)
    const [searchBy, setSearchBy] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateRange, setDateRange] = useState('July 6, 2025 - July 6, 2026')
    const [showWelcomeModal, setShowWelcomeModal] = useState(false)
    const [welcomeMessage, setWelcomeMessage] = useState('')
    const [showOptoutModal, setShowOptoutModal] = useState(false)
    const [optoutKeyword, setOptoutKeyword] = useState('')

    const handleAddFlow = () => {
        alert('Add Chatbot Flow clicked')
    }

    const handleWelcomeMessage = () => {
        setShowWelcomeModal(true)
    }

    const handleAddOptout = () => {
        setShowOptoutModal(true)
    }

    const handleSaveWelcomeMessage = () => {
        alert('Welcome message saved: ' + welcomeMessage)
        setShowWelcomeModal(false)
        setWelcomeMessage('')
    }

    const handleDiscardWelcomeMessage = () => {
        setShowWelcomeModal(false)
        setWelcomeMessage('')
    }

    const handleUpdateOptout = () => {
        alert('OPTOUT Keyword updated: ' + optoutKeyword)
        setShowOptoutModal(false)
        setOptoutKeyword('')
    }

    const handleDiscardOptout = () => {
        setShowOptoutModal(false)
        setOptoutKeyword('')
    }

    const handleEditFlow = (id) => {
        alert(`Edit Flow ${id}`)
    }

    const handleDeleteFlow = (id) => {
        if (window.confirm('Are you sure you want to delete this flow?')) {
            setFlows(flows.filter(flow => flow.id !== id))
        }
    }

    return (
        <Layout title="ChatBot Flow">
            <div className="chatbot-flow-page">
                {/* Header Section */}
                <div className="chatbot-flow-header">
                    <h1 className="chatbot-flow-title">ChatBot Flow</h1>
                    <div className="chatbot-flow-actions">
                        <button className="btn-flow btn-green" onClick={handleAddFlow}>
                            + Add Chatbot Flow
                        </button>
                        <button className="btn-flow btn-blue" onClick={handleWelcomeMessage}>
                            Welcome Message
                        </button>
                        <button className="btn-flow btn-purple" onClick={handleAddOptout}>
                            + Add OPTOUT Keyword
                        </button>
                    </div>
                </div>

                {/* Search and Filter Section */}
                <div className="chatbot-flow-search">
                    <div className="search-controls">
                        <div className="show-entries">
                            <label>Show</label>
                            <select
                                value={showEntries}
                                onChange={(e) => setShowEntries(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <label>entries</label>
                        </div>
                        <div className="search-by">
                            <label>Search by</label>
                            <select
                                value={searchBy}
                                onChange={(e) => setSearchBy(e.target.value)}
                            >
                                <option value="All">All</option>
                                <option value="FlowName">Flow Name</option>
                                <option value="AddedOn">Added On</option>
                            </select>
                        </div>
                        <div className="search-input-wrap">
                            <input
                                type="text"
                                placeholder="Search here..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                            <button className="btn-search">Search</button>
                        </div>
                    </div>
                    <div className="date-range">
                        <span className="date-badge-flow">{dateRange}</span>
                    </div>
                </div>

                {/* Table Section */}
                <div className="chatbot-flow-table-container">
                    <table className="chatbot-flow-table">
                        <thead>
                            <tr className="table-header">
                                <th className="col-plus">+</th>
                                <th className="col-flowname">Flow Name</th>
                                <th className="col-addedon">AddedOn</th>
                                <th className="col-action">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flows.map((flow) => (
                                <tr key={flow.id} className="table-row">
                                    <td className="col-plus">
                                        <button className="btn-expand">+</button>
                                    </td>
                                    <td className="col-flowname">{flow.name}</td>
                                    <td className="col-addedon">
                                        {flow.addedOn} {flow.timeAgo}
                                    </td>
                                    <td className="col-action">
                                        <div className="action-buttons">
                                            <button
                                                className="btn-action btn-edit"
                                                onClick={() => handleEditFlow(flow.id)}
                                            >
                                                EDIT FLOW
                                            </button>
                                            <button
                                                className="btn-action btn-delete"
                                                onClick={() => handleDeleteFlow(flow.id)}
                                            >
                                                DELETE
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Welcome Message Modal */}
                {showWelcomeModal && (
                    <div className="modal-overlay-welcome">
                        <div className="modal-content-welcome">
                            <div className="modal-header-welcome">
                                <h2>Welcome Message</h2>
                            </div>
                            <div className="modal-body-welcome">
                                <label className="modal-label">Message</label>
                                <textarea
                                    className="modal-textarea"
                                    placeholder=""
                                    value={welcomeMessage}
                                    onChange={(e) => setWelcomeMessage(e.target.value)}
                                    rows={6}
                                />
                            </div>
                            <div className="modal-footer-welcome">
                                <button className="btn-modal btn-save" onClick={handleSaveWelcomeMessage}>
                                    Save
                                </button>
                                <button className="btn-modal btn-discard" onClick={handleDiscardWelcomeMessage}>
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* OPTOUT Keyword Modal */}
                {showOptoutModal && (
                    <div className="modal-overlay-welcome">
                        <div className="modal-content-welcome">
                            <div className="modal-header-welcome">
                                <h2>OPTOUT Keyword</h2>
                                <button className="modal-close-btn" onClick={handleDiscardOptout}>
                                    ×
                                </button>
                            </div>
                            <div className="modal-body-welcome">
                                <label className="modal-label">Keyword</label>
                                <textarea
                                    className="modal-textarea"
                                    placeholder=""
                                    value={optoutKeyword}
                                    onChange={(e) => setOptoutKeyword(e.target.value)}
                                    rows={6}
                                />
                            </div>
                            <div className="modal-footer-welcome">
                                <button className="btn-modal btn-save" onClick={handleUpdateOptout}>
                                    Update
                                </button>
                                <button className="btn-modal btn-discard" onClick={handleDiscardOptout}>
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagination Section */}
                <div className="chatbot-flow-pagination">
                    <div className="showing-info">
                        Showing 1 to 1 of 1 entries
                    </div>
                    <div className="pagination-controls">
                        <button className="btn-page" disabled>Previous</button>
                        <button className="btn-page btn-page-active">1</button>
                        <button className="btn-page" disabled>Next</button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
