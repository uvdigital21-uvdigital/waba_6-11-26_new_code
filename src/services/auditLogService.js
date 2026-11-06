import { pool } from '../config/db.js';

/**
 * Standardized Audit Log Service for recording critical security, auth, and business events.
 * 
 * @param {object} req - Express request object (optional)
 * @param {object} options - Audit payload
 * @param {number} [options.userId] - Target or performing user ID
 * @param {number} [options.organizationId] - Tenant ID
 * @param {string} options.action - Action identifier (e.g., 'TEAM_MEMBER_CREATED', 'CAMPAIGN_SENT')
 * @param {string} options.module - Module name (e.g., 'TEAM', 'CAMPAIGNS', 'AUTH')
 * @param {string} [options.entityType] - Entity class name (e.g., 'User', 'Campaign')
 * @param {string|number} [options.entityId] - Target record ID
 * @param {string} [options.description] - Human-readable explanation
 * @param {object} [options.metadata] - Extra structured metadata
 * @param {string} [options.status] - 'SUCCESS' | 'FAILED'
 * @param {string} [options.ipAddress] - IP override
 * @param {string} [options.userAgent] - User agent override
 */
export async function recordAuditLog(req, options = {}) {
  try {
    const userId = options.userId || req?.user?.id || null;
    const organizationId = options.organizationId || req?.organizationId || req?.user?.organization_id || null;
    const action = (options.action || 'ACTIVITY').toUpperCase();
    const moduleName = (options.module || 'SYSTEM').toUpperCase();
    const entityType = options.entityType || null;
    const entityId = options.entityId ? String(options.entityId) : null;
    const description = options.description || null;
    const metadataJson = options.metadata ? JSON.stringify(options.metadata) : null;
    const status = (options.status || 'SUCCESS').toUpperCase();

    const ipAddress = options.ipAddress || req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null;
    const userAgent = options.userAgent || req?.headers?.['user-agent'] || null;

    // 1. Insert into audit_logs table
    await pool.query(
      `INSERT INTO audit_logs 
       (organization_id, user_id, action, module, entity_type, entity_id, description, metadata, ip_address, user_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, userId, action, moduleName, entityType, entityId, description, metadataJson, ipAddress, userAgent, status]
    );

    // 2. Also keep legacy user_activity_logs updated for backward compatibility
    try {
      await pool.query(
        `INSERT INTO user_activity_logs 
         (organization_id, user_id, action, module, description, metadata, ip_address, user_agent, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [organizationId, userId, action, moduleName, description, metadataJson, ipAddress, userAgent, status]
      );
    } catch (e) {
      // Non-critical fallback
    }

  } catch (err) {
    console.error('[AuditLogService] Failed to record audit log:', err.message);
  }
}

/**
 * Retrieve audit logs with server-side pagination, rich filtering, and strict tenant scoping.
 */
export async function getAuditLogs({
  organizationId,
  userId,
  action,
  module: mod,
  status,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 20,
  isSuperAdmin = false
}) {
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT al.*, 
             u.full_name as user_name, u.username as user_username, u.email as user_email, u.role as user_role,
             o.organization_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN organizations o ON o.id = al.organization_id
    `;

    const whereClauses = [];
    const params = [];

    // Tenant scoping
    if (!isSuperAdmin) {
      whereClauses.push(`(al.organization_id = ? OR (al.organization_id IS NULL AND al.user_id = ?))`);
      params.push(organizationId || 0, userId || 0);
    }

    if (userId) {
      whereClauses.push(`al.user_id = ?`);
      params.push(userId);
    }

    if (action && action !== 'All') {
      whereClauses.push(`al.action = ?`);
      params.push(action);
    }

    if (mod && mod !== 'All') {
      whereClauses.push(`al.module = ?`);
      params.push(mod);
    }

    if (status && status !== 'All') {
      whereClauses.push(`al.status = ?`);
      params.push(status);
    }

    if (startDate) {
      whereClauses.push(`al.created_at >= ?`);
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      whereClauses.push(`al.created_at <= ?`);
      params.push(`${endDate} 23:59:59`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(`(al.description LIKE ? OR al.action LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)`);
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${whereSql}`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    // Fetch paginated rows
    const dataQuery = `${query} ${whereSql} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(dataQuery, [...params, limitNum, offset]);

    const formatted = rows.map(r => {
      let meta = null;
      if (r.metadata) {
        try {
          meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
        } catch (e) {}
      }
      return {
        id: r.id,
        organization_id: r.organization_id,
        user_id: r.user_id,
        user_name: r.user_name || r.user_username || 'System',
        user_username: r.user_username || '',
        user_email: r.user_email || '',
        user_role: r.user_role || 'User',
        action: r.action,
        module: r.module,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        description: r.description,
        metadata: meta,
        ip_address: r.ip_address,
        user_agent: r.user_agent,
        status: r.status,
        created_at: r.created_at
      };
    });

    return {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      logs: formatted
    };

  } catch (err) {
    console.error('[AuditLogService] Error fetching audit logs:', err);
    return { total: 0, page: 1, limit: 20, totalPages: 0, logs: [] };
  }
}
