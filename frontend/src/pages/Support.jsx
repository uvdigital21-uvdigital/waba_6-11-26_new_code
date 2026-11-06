import React, { useState, useEffect, useRef } from 'react'
import { useTitle } from '../context/TitleContext.jsx'

const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Urgent']
const STATUS_COLORS = {
  Open: '#22c55e',
  Closed: '#ef4444',
  Pending: '#f59e0b',
}

function loadTickets() {
  const saved = localStorage.getItem('wa_support_tickets')
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

function saveTickets(list) {
  localStorage.setItem('wa_support_tickets', JSON.stringify(list))
}

export default function Support() {
  const { setTitle } = useTitle()

  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState([])
  const [tickets, setTickets] = useState(loadTickets)
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesCount] = useState(10)
  const [showPast, setShowPast] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { setTitle('Support') }, [setTitle])
  useEffect(() => { saveTickets(tickets) }, [tickets])

  const totalPages = Math.max(1, Math.ceil(tickets.length / entriesCount))
  const startIndex = (currentPage - 1) * entriesCount
  const paginated = tickets.slice(startIndex, startIndex + entriesCount)

  const handleFileChange = (files) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    const valid = Array.from(files).filter(f => allowed.includes(f.type))
    if (valid.length !== files.length) {
      alert('Only JPG, PNG, PDF files are allowed.')
    }
    setAttachments(prev => [...prev, ...valid])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFileChange(e.dataTransfer.files)
  }

  const handleSubmit = () => {
    if (!subject.trim()) { alert('Please enter a subject.'); return }
    if (!message.trim()) { alert('Please enter a message.'); return }

    const newTicket = {
      id: Date.now(),
      title: subject.trim(),
      priority,
      message: message.trim(),
      createdOn: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      lastUpdatedOn: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      lastReplyBy: '-',
      status: 'Open',
      timeline: '0 days',
    }
    setTickets(prev => [newTicket, ...prev])
    setSubject('')
    setPriority('Normal')
    setMessage('')
    setAttachments([])
  }

  return (
    <div className="support-page">
      <div className="support-card">

        {/* Page Header */}
        <div className="support-page-header">
          <div className="support-avatar-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 className="support-page-title">Create Ticket or FeedBack</h1>
        </div>

        {/* Form Row: Subject + Priority */}
        <div className="support-form-top-row">
          <input
            id="support-subject"
            type="text"
            className="support-subject-input"
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <div className="support-priority-wrap">
            <label className="support-priority-label" htmlFor="support-priority">Priority</label>
            <select
              id="support-priority"
              className="support-priority-select"
              value={priority}
              onChange={e => setPriority(e.target.value)}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Message */}
        <textarea
          id="support-message"
          className="support-message-textarea"
          placeholder="message"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />

        {/* Action Row: Buttons + Drop Zone */}
        <div className="support-action-row">
          <div className="support-btn-group">
            <button id="support-submit-btn" className="btn-support-submit" onClick={handleSubmit}>
              Submit New Ticket
            </button>
            <button
              id="support-view-past-btn"
              className="btn-support-view-past"
              onClick={() => setShowPast(p => !p)}
            >
              View Past Ticket
            </button>
          </div>

          <div
            className={`support-dropzone${dragOver ? ' dragover' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Drag &amp; Drop files(maximum 20mb)</span>
            <span className="support-dropzone-or">or</span>
            <span className="support-dropzone-browse">Browse Attachments</span>
            {attachments.length > 0 && (
              <span className="support-attachment-count">{attachments.length} file(s) selected</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFileChange(e.target.files)}
            />
          </div>
        </div>

        {/* Attachment hint */}
        <p className="support-attachment-hint">
          Add Attachment <span style={{ color: '#ef4444' }}>(only JPG,PNG,PDF Allowed)</span>
        </p>

        {/* Past Tickets Table */}
        {showPast && (
          <div className="support-table-wrap">
            <table className="support-data-table">
              <thead>
                <tr>
                  <th>+</th>
                  <th>↕ ID</th>
                  <th>↕ Title</th>
                  <th>↕ CreatedOn Date</th>
                  <th>↕ Last UpdatedOn</th>
                  <th>↕ Last ReplyBy</th>
                  <th>↕ Status</th>
                  <th>↕ Timeline</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="support-empty-row">No data available in table</td>
                  </tr>
                ) : (
                  paginated.map(t => (
                    <tr key={t.id}>
                      <td>
                        <button className="btn-ticket-expand">+</button>
                      </td>
                      <td>{t.id}</td>
                      <td>{t.title}</td>
                      <td>{t.createdOn}</td>
                      <td>{t.lastUpdatedOn}</td>
                      <td>{t.lastReplyBy}</td>
                      <td>
                        <span style={{ color: STATUS_COLORS[t.status] || '#64748b', fontWeight: 600 }}>
                          {t.status}
                        </span>
                      </td>
                      <td>{t.timeline}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="support-table-footer">
              <span className="support-showing-entries">
                Showing {tickets.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + entriesCount, tickets.length)} of {tickets.length} entries
              </span>
              <div className="support-pagination">
                <button
                  className="btn-support-pag"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                >
                  Previous
                </button>
                <button
                  className="btn-support-pag"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
