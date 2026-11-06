import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import BirthdayCampaignModal from '../components/BirthdayCampaignModal.jsx'

export default function SendBirthday() {
    const [campaigns, setCampaigns] = useState([])
    const [selectedRows, setSelectedRows] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleAddCampaign = () => {
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
    }

    const handleSaveCampaign = (campaignData) => {
        console.log('Campaign saved:', campaignData)
        // Here you would typically send the data to your backend
        // For now, we'll just close the modal
        // You can add API call here
    }

    return (
        <Layout title="Send Birthday Campaign">
            <div className="dashboard-content">
                <div className="birthday-campaign-card">
                    {/* Header */}
                    <div className="birthday-campaign-header">
                        <div className="birthday-campaign-title">
                            <div className="birthday-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                            <h1>Birthday Campaign</h1>
                        </div>
                        <button className="btn-add-campaign" onClick={handleAddCampaign}>
                            Add
                        </button>
                    </div>

                    {/* Table Controls */}
                    <div className="birthday-table-controls">
                        <div className="table-controls-left">
                            <label className="show-entries-label">
                                Show
                                <select className="show-entries-select" defaultValue="10">
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                                entries
                            </label>
                        </div>
                        <div className="table-controls-right">
                            <div className="date-range-picker">
                                <input
                                    type="text"
                                    className="date-range-input"
                                    defaultValue="27 June 2026 - 4 Jul 2026"
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    {/* Campaigns Table */}
                    <div className="birthday-table-wrapper">
                        <table className="birthday-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="th-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.length === campaigns.length && campaigns.length > 0}
                                            onChange={(e) => setSelectedRows(e.target.checked ? campaigns.map(c => c.id) : [])}
                                        />
                                    </th>
                                    <th className="th-name">Name</th>
                                    <th className="th-dob">Date of Birth</th>
                                    <th className="th-type">Type</th>
                                    <th className="th-mobile">Mobile Number</th>
                                    <th className="th-wish-time">Wish Time</th>
                                    <th className="th-trigger">Next TriggerOn</th>
                                    <th className="th-template">Template</th>
                                    <th className="th-added-on">AddedOn</th>
                                    <th className="th-active">Is Active</th>
                                    <th className="th-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan="11" className="no-data-cell">
                                            No data available in table
                                        </td>
                                    </tr>
                                ) : (
                                    campaigns.map(campaign => (
                                        <tr key={campaign.id} className="table-data-row">
                                            <td className="td-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.includes(campaign.id)}
                                                    onChange={() => {
                                                        if (selectedRows.includes(campaign.id)) {
                                                            setSelectedRows(selectedRows.filter(id => id !== campaign.id))
                                                        } else {
                                                            setSelectedRows([...selectedRows, campaign.id])
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="td-name">{campaign.name}</td>
                                            <td className="td-dob">{campaign.dob}</td>
                                            <td className="td-type">{campaign.type}</td>
                                            <td className="td-mobile">{campaign.mobile}</td>
                                            <td className="td-wish-time">{campaign.wishTime}</td>
                                            <td className="td-trigger">{campaign.nextTrigger}</td>
                                            <td className="td-template">{campaign.template}</td>
                                            <td className="td-added-on">{campaign.addedOn}</td>
                                            <td className="td-active">{campaign.isActive}</td>
                                            <td className="td-action">
                                                <div className="action-buttons-campaign">
                                                    <button type="button" className="btn-edit-campaign">Edit</button>
                                                    <button type="button" className="btn-delete-campaign">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="birthday-pagination">
                        <div className="pagination-info">
                            Showing {campaigns.length === 0 ? 0 : 1} to {campaigns.length} of {campaigns.length} entries
                        </div>
                        <div className="pagination-buttons">
                            <button type="button" className="btn-pagination" disabled>
                                Previous
                            </button>
                            <button type="button" className="btn-pagination" disabled>
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Birthday Campaign Modal */}
            <BirthdayCampaignModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveCampaign}
            />
        </Layout>
    )
}
