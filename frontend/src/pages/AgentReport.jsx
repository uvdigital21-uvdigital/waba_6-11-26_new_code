import React, { useState, useEffect, useCallback } from 'react';
import { useTitle } from '../context/TitleContext.jsx';
import { API_BASE_URL } from '../config.js';
import DateRangePicker from '../components/DateRangePicker.jsx';

const AgentReport = () => {
  const { setTitle } = useTitle();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  
  // Filters & Pagination State
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [searchBy, setSearchBy] = useState('number');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('All Type');
  const [dateRange, setDateRange] = useState('All Time');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Status Summary
  const [summary, setSummary] = useState({
    total_count: 0,
    read_count: 0,
    dlvd_count: 0,
    failed_count: 0,
    other_count: 0
  });

  // Action status messages & row expansion
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [resendingId, setResendingId] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    setTitle('Official Message History');
  }, [setTitle]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('wa_dashboard_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Fetch Templates for filter dropdown
  useEffect(() => {
    async function fetchTemplatesList() {
      try {
        const res = await fetch(`${API_BASE_URL}/templates`, { headers: getAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          setTemplates(json.templates || json.data || []);
        }
      } catch (e) {
        console.warn('Could not fetch templates list for filter:', e);
      }
    }
    fetchTemplatesList();
  }, [getAuthHeaders]);

  // Fetch Agent Activity Reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: entriesPerPage,
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(searchBy ? { searchBy } : {}),
        ...(selectedTemplate ? { template: selectedTemplate } : {}),
        ...(selectedSource && selectedSource !== 'All Type' ? { source: selectedSource } : {})
      });

      const res = await fetch(`${API_BASE_URL}/agent-reports?${params}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch activity reports');

      const json = await res.json();
      setData(json.data || json.reports || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || Math.ceil((json.total || 0) / entriesPerPage));

      if (json.summary) {
        setSummary({
          total_count: json.summary.total_count || json.total || 0,
          read_count: json.summary.read_count || 0,
          dlvd_count: json.summary.dlvd_count || 0,
          failed_count: json.summary.failed_count || 0,
          other_count: json.summary.other_count || 0
        });
      }
    } catch (err) {
      setActionError(err.message);
      setData([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, entriesPerPage, searchQuery, searchBy, selectedTemplate, selectedSource, getAuthHeaders]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchReports();
  };

  // Handle Source type filter click
  const handleSourceFilter = (srcType) => {
    setSelectedSource(srcType);
    setCurrentPage(1);
  };

  // Toggle Row Expansion
  const toggleExpandRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Download All CSV Export
  const handleDownloadAll = async () => {
    try {
      const token = localStorage.getItem('wa_dashboard_token');
      const res = await fetch(`${API_BASE_URL}/agent-reports/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `official_message_history_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setActionError('Export CSV failed: ' + err.message);
    }
  };

  // Download single record CSV
  const handleDownloadSingle = (row) => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Agent ID,Agent Name,Role,Activity,Customer Number,Customer Name,Template,Message,Status,Date\n" +
      `"${row.agent_id || ''}","${row.agent_name || ''}","${row.agent_role || ''}","${row.activity_type || ''}","${row.customer_number || ''}","${row.customer_name || ''}","${row.template_name || ''}","${(row.message || '').replace(/"/g, '""')}","${row.status || ''}","${row.created_at || ''}"`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `report_${row.id}_${row.customer_number || 'log'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Resend selected message
  const handleResendMessage = async (row) => {
    setResendingId(row.id);
    setActionSuccess('');
    setActionError('');
    try {
      const res = await fetch(`${API_BASE_URL}/agent-reports/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          reportId: row.id,
          customer_number: row.customer_number,
          message: row.message,
          template_name: row.template_name
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Resend failed');

      setActionSuccess(`Message resent successfully to ${row.customer_number || 'customer'}!`);
      fetchReports();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setResendingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const displayData = data.filter(item => {
    if (dateRange && dateRange !== 'All Time') {
      let startDate, endDate
      if (dateRange.includes(' - ')) {
        const [startStr, endStr] = dateRange.split(' - ')
        startDate = new Date(startStr)
        endDate = new Date(endStr)
      } else {
        startDate = new Date(dateRange)
        endDate = new Date(dateRange)
      }

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

        const rawDate = item.created_at || item.createdAt || item.submit_date || item.submitDate || item.date || item.timestamp
        if (rawDate) {
          let itemDate = new Date(rawDate)
          if (isNaN(itemDate.getTime())) {
            const parts = String(rawDate).trim().split(/[\s,T]+/)
            if (parts.length > 0) {
              const dateParts = parts[0].split(/[\/\-.]/)
              if (dateParts.length === 3) {
                if (dateParts[0].length === 4) {
                  itemDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
                } else if (dateParts[2].length === 4) {
                  itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0])
                }
              }
            }
          }
          if (!isNaN(itemDate.getTime())) {
            if (itemDate < startDate || itemDate > endDate) {
              return false
            }
          }
        }
      }
    }
    return true
  });

  const startEntry = total === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1;
  const endEntry = Math.min(currentPage * entriesPerPage, total);

  return (
    <div className="dashboard-content">
      <div className="template-management-card">
        {/* Banner Messages */}
        {actionError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', border: '1px solid #fecaca' }}>⚠️ {actionError}</div>}
        {actionSuccess && <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', border: '1px solid #bbf7d0' }}>✅ {actionSuccess}</div>}

        <div className="template-management-header">
          <div className="header-left">
            <div className="official-template-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h1 className="page-title" style={{ fontSize: '20px', fontWeight: 'bold' }}>
              Offical Message <br />
              <span style={{ fontSize: '14px', fontWeight: 'normal' }}>History</span>
            </h1>
          </div>
        </div>

        {/* Search & Filters Section */}
        <form onSubmit={handleSearchSubmit} className="template-search-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={selectedTemplate}
              onChange={(e) => {
                setSelectedTemplate(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Select Offical Template</option>
              {templates.map(t => (
                <option key={t.id || t.name} value={t.name || t.id}>{t.name}</option>
              ))}
            </select>

            <input
              type="text"
              className="search-input"
              placeholder="Search here..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-search">Search</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button
              type="button"
              className="btn-action"
              style={{ background: '#9b59b6', color: 'white', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold' }}
              onClick={handleDownloadAll}
            >
              Download &gt;All
            </button>
          </div>
        </form>

        {/* Controls & Type Filter Buttons */}
        <div className="template-controls">
          <div className="show-entries">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
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

        {/* Activity Logs Table */}
        <div className="table-container">
          <table className="data-table">
            <thead className="table-header">
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>+</th>
                <th>Type</th>
                <th>Total / Customer</th>
                <th>Message</th>
                <th>Submit Date</th>
                <th>READ</th>
                <th>DLVD</th>
                <th>FAILED</th>
                <th>Other</th>
                <th>Download</th>
                <th>Resend</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="no-data">Loading history records...</td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan="11" className="no-data">No data available in table for selected filters &amp; date range</td>
                </tr>
              ) : (
                displayData.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpandRow(row.id)}
                          style={{
                            background: '#0284c7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '22px',
                            height: '22px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            lineHeight: '1'
                          }}
                        >
                          {expandedRows[row.id] ? '-' : '+'}
                        </button>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: row.source === 'API' ? '#e8f5e9' : row.source === 'CTBOT' ? '#ffebee' : '#e0f2fe',
                          color: row.source === 'API' ? '#2e7d32' : row.source === 'CTBOT' ? '#c62828' : '#0369a1'
                        }}>
                          {row.source || row.activity_type || 'WEB'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                          {row.customer_name || 'Customer'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {row.customer_number || '-'}
                        </div>
                      </td>
                      <td style={{ maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.template_name && <strong style={{ color: '#0284c7' }}>[{row.template_name}] </strong>}
                        {row.message || '-'}
                      </td>
                      <td style={{ color: '#475569', fontSize: '13px' }}>
                        {formatDate(row.created_at)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {row.status === 'Read' ? (
                          <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓✓ 1</span>
                        ) : '0'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {['Delivered', 'Read'].includes(row.status) ? (
                          <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓✓ 1</span>
                        ) : '0'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {row.status === 'Failed' ? (
                          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>✖ 1</span>
                        ) : '0'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: row.status === 'Read' ? '#dcfce7' : row.status === 'Delivered' ? '#dbeafe' : row.status === 'Failed' ? '#fee2e2' : '#f1f5f9',
                          color: row.status === 'Read' ? '#15803d' : row.status === 'Delivered' ? '#1d4ed8' : row.status === 'Failed' ? '#b91c1c' : '#475569'
                        }}>
                          {row.status || 'Sent'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(row)}
                          style={{ background: '#0284c7', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          ⬇ CSV
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleResendMessage(row)}
                          disabled={resendingId === row.id}
                          style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          {resendingId === row.id ? 'Sending...' : '🔄 Resend'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {expandedRows[row.id] && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan="11" style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                            <div><strong>Agent ID:</strong> {row.agent_id || '-'}</div>
                            <div><strong>Agent Name:</strong> {row.agent_name || '-'}</div>
                            <div><strong>Agent Email:</strong> {row.agent_email || '-'}</div>
                            <div><strong>Agent Role:</strong> {row.agent_role || '-'}</div>
                            <div><strong>Activity Type:</strong> {row.activity_type || '-'}</div>
                            <div><strong>Module:</strong> {row.module || '-'}</div>
                            <div><strong>Customer Name:</strong> {row.customer_name || '-'}</div>
                            <div><strong>Customer Number:</strong> {row.customer_number || '-'}</div>
                            <div><strong>Template Name:</strong> {row.template_name || '-'}</div>
                            <div><strong>Campaign:</strong> {row.campaign_name || '-'}</div>
                            <div><strong>Status:</strong> {row.status || '-'}</div>
                            <div><strong>Created At:</strong> {formatDate(row.created_at)}</div>
                          </div>
                          {row.message && (
                            <div style={{ marginTop: '10px', background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                              <strong>Full Message Content:</strong>
                              <p style={{ margin: '4px 0 0 0', color: '#334155', whiteSpace: 'pre-wrap' }}>{row.message}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="pagination-container">
          <div className="showing-info">
            Showing {startEntry} to {endEntry} of {total} entries
          </div>
          <div className="pagination-buttons">
            <button
              type="button"
              className="btn-pagination"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ padding: '0 8px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              type="button"
              className="btn-pagination"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentReport;