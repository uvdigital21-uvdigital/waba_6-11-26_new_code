import { pool } from '../config/db.js';
import { recordChatMessage } from '../services/chatService.js';
import { logActivity } from '../services/agentActivityLogger.js';

/**
 * GET /api/agent-reports - Fetch paginated and filtered activity logs
 */
export async function getAgentReports(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const {
      search,
      searchBy,
      template,
      source,
      status,
      startDate,
      endDate
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Role-based scoping: Chat Agent and Sender can only view their own reports
    const userRole = req.user ? (req.user.role || 'Admin') : 'Admin';
    const userAgentId = req.user ? (req.user.agent_id || req.user.id) : null;
    const userEmail = req.user ? req.user.email : null;

    if (['Chat Agent', 'Sender'].includes(userRole)) {
      whereClause += ' AND (agent_id = ? OR agent_email = ?)';
      params.push(userAgentId, userEmail);
    }

    // Source type filter (WEB, API, CTBOT, B/A)
    if (source && source.toUpperCase() !== 'ALL' && source.toUpperCase() !== 'ALL TYPE') {
      whereClause += ' AND source = ?';
      params.push(source.toUpperCase());
    }

    // Template filter
    if (template) {
      whereClause += ' AND (template_name = ? OR template_name LIKE ?)';
      params.push(template, `%${template}%`);
    }

    // Status filter
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Date range filter
    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    // Generic or specific search
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      if (searchBy === 'number') {
        whereClause += ' AND customer_number LIKE ?';
        params.push(term);
      } else if (searchBy === 'name') {
        whereClause += ' AND (customer_name LIKE ? OR agent_name LIKE ?)';
        params.push(term, term);
      } else if (searchBy === 'agent_id') {
        whereClause += ' AND agent_id LIKE ?';
        params.push(term);
      } else if (searchBy === 'template') {
        whereClause += ' AND template_name LIKE ?';
        params.push(term);
      } else if (searchBy === 'message') {
        whereClause += ' AND message LIKE ?';
        params.push(term);
      } else {
        whereClause += ' AND (customer_number LIKE ? OR customer_name LIKE ? OR agent_name LIKE ? OR agent_id LIKE ? OR template_name LIKE ? OR message LIKE ? OR campaign_name LIKE ?)';
        params.push(term, term, term, term, term, term, term);
      }
    }

    // Total count query
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM agent_activity_logs ${whereClause}`, params);
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Fetch records
    const [rows] = await pool.query(
      `SELECT * FROM agent_activity_logs ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Calculate Summary stats
    const [summaryRows] = await pool.query(
      `SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'Read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as dlvd_count,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status NOT IN ('Read', 'Delivered', 'Failed') THEN 1 ELSE 0 END) as other_count
       FROM agent_activity_logs ${whereClause}`,
      params
    );

    const summary = summaryRows[0] || { total_count: 0, read_count: 0, dlvd_count: 0, failed_count: 0, other_count: 0 };

    res.json({
      success: true,
      data: rows,
      reports: rows,
      total,
      totalPages,
      currentPage: page,
      summary
    });
  } catch (err) {
    console.error('Error fetching agent reports:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agent reports', error: err.message });
  }
}

/**
 * GET /api/agent-reports/summary - Aggregate metrics summary
 */
export async function getAgentReportsSummary(req, res) {
  try {
    const userRole = req.user ? (req.user.role || 'Admin') : 'Admin';
    const userAgentId = req.user ? (req.user.agent_id || req.user.id) : null;
    const userEmail = req.user ? req.user.email : null;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (['Chat Agent', 'Sender'].includes(userRole)) {
      whereClause += ' AND (agent_id = ? OR agent_email = ?)';
      params.push(userAgentId, userEmail);
    }

    const [rows] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as dlvd_count,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status NOT IN ('Read', 'Delivered', 'Failed') THEN 1 ELSE 0 END) as other_count
       FROM agent_activity_logs ${whereClause}`,
      params
    );

    res.json({ success: true, summary: rows[0] });
  } catch (err) {
    console.error('Error fetching report summary:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
}

/**
 * GET /api/agent-reports/:id - Fetch single report entry
 */
export async function getAgentReportById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM agent_activity_logs WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report record not found' });
    }
    res.json({ success: true, report: rows[0] });
  } catch (err) {
    console.error('Error fetching report item:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch report item' });
  }
}

/**
 * GET /api/agent-reports/export - Export CSV data
 */
export async function exportAgentReports(req, res) {
  try {
    const userRole = req.user ? (req.user.role || 'Admin') : 'Admin';
    const userAgentId = req.user ? (req.user.agent_id || req.user.id) : null;
    const userEmail = req.user ? req.user.email : null;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (['Chat Agent', 'Sender'].includes(userRole)) {
      whereClause += ' AND (agent_id = ? OR agent_email = ?)';
      params.push(userAgentId, userEmail);
    }

    const [rows] = await pool.query(
      `SELECT agent_id, agent_name, agent_role, source, activity_type, customer_name, customer_number, template_name, message, status, created_at 
       FROM agent_activity_logs ${whereClause} ORDER BY id DESC LIMIT 5000`,
      params
    );

    // Generate CSV
    const headers = ['Agent ID', 'Agent Name', 'Role', 'Source', 'Activity', 'Customer Name', 'Customer Number', 'Template', 'Message', 'Status', 'Date'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        `"${r.agent_id || ''}"`,
        `"${(r.agent_name || '').replace(/"/g, '""')}"`,
        `"${r.agent_role || ''}"`,
        `"${r.source || ''}"`,
        `"${r.activity_type || ''}"`,
        `"${(r.customer_name || '').replace(/"/g, '""')}"`,
        `"${r.customer_number || ''}"`,
        `"${(r.template_name || '').replace(/"/g, '""')}"`,
        `"${(r.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${r.status || ''}"`,
        `"${r.created_at ? new Date(r.created_at).toISOString() : ''}"`
      ];
      csvLines.push(line.join(','));
    }

    const csvContent = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="agent_official_history_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting report:', err);
    res.status(500).json({ success: false, message: 'Failed to export report CSV' });
  }
}

/**
 * POST /api/agent-reports/resend - Resend selected message
 */
export async function resendAgentReportMessage(req, res) {
  try {
    const { reportId, customer_number, message, template_name } = req.body;

    let targetNumber = customer_number;
    let targetMessage = message;

    if (reportId) {
      const [rows] = await pool.query('SELECT * FROM agent_activity_logs WHERE id = ? LIMIT 1', [reportId]);
      if (rows.length > 0) {
        targetNumber = rows[0].customer_number;
        targetMessage = rows[0].message;
      }
    }

    if (!targetNumber) {
      return res.status(400).json({ success: false, message: 'Customer number is required for resending' });
    }

    const currentAgent = req.user || {};

    // Attempt sending message and recording in conversation thread
    await recordChatMessage({
      userId: currentAgent.id || 1,
      phone: targetNumber,
      messageText: targetMessage || 'Resent message',
      sender: 'user',
      direction: 'outgoing',
      messageType: 'text',
      status: 'sent'
    }).catch(err => console.warn('Record chat message warning:', err.message));

    // Log activity
    await logActivity({
      agent_id: currentAgent.agent_id || currentAgent.id || 'AGT001',
      agent_name: currentAgent.name || 'System User',
      agent_email: currentAgent.email || 'admin@officialwa.com',
      agent_role: currentAgent.role || 'Admin',
      activity_type: 'RESEND_WA',
      module: 'AgentReport',
      message_type: 'text',
      template_name: template_name || null,
      customer_number: targetNumber,
      message: targetMessage,
      status: 'Sent',
      source: 'WEB'
    });

    res.json({ success: true, message: `Message resent successfully to ${targetNumber}` });
  } catch (err) {
    console.error('Error resending message:', err);
    res.status(500).json({ success: false, message: 'Failed to resend message', error: err.message });
  }
}
