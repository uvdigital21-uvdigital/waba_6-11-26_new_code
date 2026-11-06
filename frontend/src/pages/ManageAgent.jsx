import React, { useState, useEffect, useCallback } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

import { API_BASE_URL, BASE_URL } from '../config.js'

const API_BASE = API_BASE_URL

export default function ManageAgent() {
  const { user } = useAuth()
  const { setTitle } = useTitle()
  const [agents, setAgents] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedRows, setExpandedRows] = useState({})
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    role: '',
    profileImage: null
  })

  // View modal state
  const [viewAgent, setViewAgent] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  useEffect(() => {
    setTitle('Manage Agent')
  }, [setTitle])

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('wa_dashboard_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: entriesPerPage,
        ...(searchQuery ? { search: searchQuery } : {})
      })

      const res = await fetch(`${API_BASE}/agents?${params}`, {
        headers: getAuthHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch agents')

      const data = await res.json()
      setAgents(data.agents || data.data || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || Math.ceil((data.total || 0) / entriesPerPage))
    } catch (err) {
      setError(err.message)
      setAgents([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, entriesPerPage, searchQuery, getAuthHeaders])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleView = (agent) => {
    setViewAgent(agent)
    setIsViewModalOpen(true)
  }

  const handleEdit = (agent) => {
    setIsEditMode(true)
    setEditingId(agent.id)
    setNewAgent({
      name: agent.name || '',
      email: agent.email || '',
      password: '',
      mobile: agent.mobile || '',
      role: agent.role || 'Sender',
      profileImage: null
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (user && String(user.id) === String(id)) {
      setError('Action prohibited: You cannot delete your own logged-in user account')
      setTimeout(() => setError(''), 4000)
      return
    }

    if (!window.confirm('Are you sure you want to delete this agent?')) return
    try {
      const res = await fetch(`${API_BASE}/agents/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to delete agent')

      setSuccess('Agent deleted successfully')
      fetchAgents()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleStatusToggle = async (agent) => {
    const newStatus = agent.status === 'Active' ? 'Inactive' : 'Active'
    try {
      const res = await fetch(`${API_BASE}/agents/${agent.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update status')

      setSuccess(`Agent status updated to ${newStatus}`)
      fetchAgents()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddAgent = () => {
    setIsEditMode(false)
    setEditingId(null)
    setNewAgent({
      name: '',
      email: '',
      password: '',
      mobile: '',
      role: 'Sender',
      profileImage: null
    })
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setIsEditMode(false)
    setEditingId(null)
    setNewAgent({
      name: '',
      email: '',
      password: '',
      mobile: '',
      role: '',
      profileImage: null
    })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewAgent(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewAgent(prev => ({ ...prev, profileImage: e.target.files[0] }))
    }
  }

  const handleSaveAgent = async () => {
    if (!newAgent.name || !newAgent.email || !newAgent.mobile) {
      setError('Name, Email, and Mobile are required fields')
      return
    }

    if (!isEditMode && !newAgent.password) {
      setError('Password is required for new agent')
      return
    }

    if (newAgent.password && newAgent.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setSaving(true)
    setError('')

    try {
      const formDataPayload = new FormData()
      formDataPayload.append('name', newAgent.name.trim())
      formDataPayload.append('email', newAgent.email.trim())
      formDataPayload.append('mobile', newAgent.mobile.trim())
      formDataPayload.append('role', newAgent.role || 'Sender')

      if (newAgent.password) {
        formDataPayload.append('password', newAgent.password)
      }

      if (newAgent.profileImage) {
        formDataPayload.append('profileImage', newAgent.profileImage)
      }

      const url = isEditMode ? `${API_BASE}/agents/${editingId}` : `${API_BASE}/agents`
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: formDataPayload
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save agent profile')
      }

      setSuccess(data.message || `Agent ${isEditMode ? 'updated' : 'created'} successfully`)
      handleModalClose()
      fetchAgents()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const startEntry = total === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1
  const endEntry = Math.min(currentPage * entriesPerPage, total)
  const displayData = agents

  const getPaginationButtons = () => {
    const buttons = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(i)
    }
    return buttons
  }

  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'active') return 'agent-badge-active'
    if (s === 'inactive') return 'agent-badge-inactive'
    return 'agent-badge-inactive'
  }

  const getOnlineStatusClass = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'online') return 'agent-online-dot online'
    if (s === 'offline') return 'agent-online-dot offline'
    return 'agent-online-dot offline'
  }

  return (
    <div className="dashboard-content">
      {/* Modal Popup */}
      {isModalOpen && (
        <div className="agent-modal-overlay">
          <div className="agent-modal">
            <div className="agent-modal-header">
              <h2>{isEditMode ? 'Edit Agent' : 'Add Agent'}</h2>
            </div>
            <div className="agent-modal-body">
              <div className="agent-modal-profile-pic">
                <div className="agent-modal-profile-pic-dropzone">
                  Drag & Drop your picture or <strong>Browse</strong>
                  <input type="file" onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" />
                </div>
                <p className="agent-modal-profile-pic-note">
                  {newAgent.profileImage ? `Selected: ${newAgent.profileImage.name}` : 'Note - For The Best view use 100x100 image'}
                </p>
              </div>
              <div className="agent-modal-form">
                <div className="agent-modal-form-group">
                  <label>Email</label>
                  <input type="email" name="email" placeholder="Enter email" value={newAgent.email} onChange={handleInputChange} />
                </div>
                <div className="agent-modal-form-group">
                  <label>Password</label>
                  <input type="password" name="password" placeholder={isEditMode ? 'Leave blank to keep current' : 'Password'} value={newAgent.password} onChange={handleInputChange} />
                </div>
                <div className="agent-modal-form-group">
                  <label>Name</label>
                  <input type="text" name="name" placeholder="Enter Username" value={newAgent.name} onChange={handleInputChange} />
                </div>
                <div className="agent-modal-form-group">
                  <label>Mobile</label>
                  <input type="text" name="mobile" placeholder="Mobile" value={newAgent.mobile} onChange={handleInputChange} />
                </div>
                <div className="agent-modal-form-group agent-modal-form-group-full">
                  <label>Role</label>
                  <select name="role" value={newAgent.role} onChange={handleInputChange}>
                    <option value="">Select Roles</option>
                    <option value="Chat Agent">Chat Agent</option>
                    <option value="Sender">Sender</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="agent-modal-footer">
              <button className="agent-btn-discard" onClick={handleModalClose} disabled={saving}>Discard</button>
              <button className="agent-btn-save" onClick={handleSaveAgent} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal Popup */}
      {isViewModalOpen && viewAgent && (
        <div className="agent-modal-overlay">
          <div className="agent-modal" style={{ maxWidth: '440px' }}>
            <div className="agent-modal-header">
              <h2>Agent Details</h2>
            </div>
            <div className="agent-modal-body" style={{ padding: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                {viewAgent.profile_image ? (
                  <img
                    src={viewAgent.profile_image.startsWith('http') ? viewAgent.profile_image : `${BASE_URL}${viewAgent.profile_image}`}
                    alt={viewAgent.name}
                    style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0284c7', color: '#fff', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    {viewAgent.name ? viewAgent.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
                <h3 style={{ margin: '8px 0 2px 0' }}>{viewAgent.name}</h3>
                <span style={{ color: '#64748b', fontSize: '13px' }}>{viewAgent.agent_id}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '8px', fontSize: '13px' }}>
                <strong>Role:</strong> <span>{viewAgent.role}</span>
                <strong>Email:</strong> <span>{viewAgent.email}</span>
                <strong>Mobile:</strong> <span>{viewAgent.mobile}</span>
                <strong>Status:</strong> <span>{viewAgent.status}</span>
                <strong>Online:</strong> <span>{viewAgent.online_status || (viewAgent.is_online ? 'Online' : 'Offline')}</span>
                <strong>Created On:</strong> <span>{formatDate(viewAgent.created_on || viewAgent.created_at)}</span>
              </div>
            </div>
            <div className="agent-modal-footer">
              <button className="agent-btn-discard" onClick={() => setIsViewModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="agent-card">
        {/* Page Header */}
        <div className="agent-header">
          <div className="agent-header-left">
            <div className="agent-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1 className="agent-title">Manage Agent</h1>
          </div>
          <div className="agent-header-right">
            <button className="agent-btn-add" onClick={handleAddAgent}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Agent
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && <div className="agent-error-banner">{error}</div>}
        {success && <div className="agent-success-banner">{success}</div>}

        {/* Controls Row */}
        <div className="agent-controls">
          <div className="agent-controls-left">
            <div className="agent-show-entries">
              <span>Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>entries</span>
            </div>
          </div>
          <div className="agent-controls-right">
            <div className="agent-search-box" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Search:</span>
              <input
                type="text"
                className="agent-input-search"
                placeholder="Search Agent ID, Name, Email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="agent-table-container">
          <table className="agent-table">
            <thead>
              <tr>
                <th className="agent-th-expand"></th>
                <th>Agent Id</th>
                <th>Name</th>
                <th>Online Status</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Created On</th>
                <th className="agent-th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="agent-no-data">Loading...</td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="agent-no-data">No data available in table</td>
                </tr>
              ) : (
                displayData.map((agent) => (
                  <React.Fragment key={agent.id}>
                    <tr className="agent-row">
                      <td className="agent-td-expand">
                        <button
                          className={`agent-btn-expand ${expandedRows[agent.id] ? 'expanded' : ''}`}
                          onClick={() => toggleExpand(agent.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </td>
                      <td className="agent-td-id">{agent.agent_id || agent.id || '-'}</td>
                      <td className="agent-td-name">{agent.name || '-'}</td>
                      <td className="agent-td-online">
                        <div className="agent-online-status">
                          <span className={getOnlineStatusClass(agent.online_status || (agent.is_online ? 'online' : 'offline'))}></span>
                          {agent.online_status || (agent.is_online ? 'Online' : 'Offline')}
                        </div>
                      </td>
                      <td className="agent-td-email">{agent.email || '-'}</td>
                      <td className="agent-td-mobile">{agent.mobile || '-'}</td>
                      <td className="agent-td-status">
                        <span
                          className={`agent-status-badge ${getStatusBadgeClass(agent.status)}`}
                          onClick={() => handleStatusToggle(agent)}
                          title="Click to toggle status"
                        >
                          {agent.status || 'Inactive'}
                        </span>
                      </td>
                      <td className="agent-td-date">{formatDate(agent.created_on || agent.created_at)}</td>
                      <td className="agent-td-action">
                        <div className="agent-action-btns">
                          <button className="agent-btn-act agent-btn-view" onClick={() => handleView(agent)} title="View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button className="agent-btn-act agent-btn-edit" onClick={() => handleEdit(agent)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button className="agent-btn-act agent-btn-delete" onClick={() => handleDelete(agent.id)} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                          <button
                            className={`agent-btn-act agent-btn-toggle ${agent.status === 'Active' ? 'active' : 'inactive'}`}
                            onClick={() => handleStatusToggle(agent)}
                            title={agent.status === 'Active' ? 'Deactivate' : 'Activate'}
                          >
                            {agent.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows[agent.id] && (
                      <tr className="agent-expand-row">
                        <td colSpan="9">
                          <div className="agent-expand-content">
                            <div className="agent-expand-details">
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Agent ID</span>
                                <span className="agent-detail-value">{agent.agent_id || agent.id || '-'}</span>
                              </div>
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Name</span>
                                <span className="agent-detail-value">{agent.name || '-'}</span>
                              </div>
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Email</span>
                                <span className="agent-detail-value">{agent.email || '-'}</span>
                              </div>
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Mobile</span>
                                <span className="agent-detail-value">{agent.mobile || '-'}</span>
                              </div>
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Online Status</span>
                                <span className="agent-detail-value">{agent.online_status || (agent.is_online ? 'Online' : 'Offline')}</span>
                              </div>
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Status</span>
                                <span className="agent-detail-value">{agent.status || '-'}</span>
                              </div>
                              <div className="agent-detail-item">
                                <span className="agent-detail-label">Created On</span>
                                <span className="agent-detail-value">{formatDate(agent.created_on || agent.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="agent-pagination">
            <div className="agent-pagination-info">
              Showing {startEntry} to {endEntry} of {total} entries
            </div>
            <div className="agent-pagination-buttons">
              <button
                className="agent-btn-page"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Previous
              </button>
              {getPaginationButtons().map((page) => (
                <button
                  key={page}
                  className={`agent-btn-page ${page === currentPage ? 'active' : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="agent-btn-page"
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}