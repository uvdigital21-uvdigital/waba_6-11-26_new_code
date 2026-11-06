import { pool } from '../config/db.js';

/**
 * Log user and admin activities for security and compliance audit trailing.
 * 
 * @param {object} req - Express request object (optional)
 * @param {object} options - Activity log payload
 * @param {number} [options.userId] - Target or performing user ID
 * @param {number} [options.organizationId] - Tenant ID
 * @param {string} options.action - Action identifier (e.g., 'LOGIN', 'PASSWORD_CHANGED', 'USER_DISABLED')
 * @param {string} options.module - System module (e.g., 'AUTH', 'USERS', 'CAMPAIGNS', 'SETTINGS')
 * @param {string} [options.description] - Human-readable description
 * @param {object} [options.metadata] - Extra metadata/context payload
 * @param {string} [options.status] - 'SUCCESS' | 'FAILED'
 * @param {string} [options.ipAddress] - IP override if req not provided
 * @param {string} [options.userAgent] - User Agent override if req not provided
 */
export async function logUserActivity(req, options = {}) {
  try {
    const userId = options.userId || req?.user?.id || null;
    const organizationId = options.organizationId || req?.organizationId || req?.user?.organization_id || null;
    const action = options.action || 'ACTIVITY';
    const moduleName = options.module || 'SYSTEM';
    const description = options.description || null;
    const metadataJson = options.metadata ? JSON.stringify(options.metadata) : null;
    const status = options.status || 'SUCCESS';

    const ipAddress = options.ipAddress || req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null;
    const userAgent = options.userAgent || req?.headers?.['user-agent'] || null;

    await pool.query(
      `INSERT INTO user_activity_logs 
       (organization_id, user_id, action, module, description, metadata, ip_address, user_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, userId, action, moduleName, description, metadataJson, ipAddress, userAgent, status]
    );
  } catch (err) {
    console.error('[UserActivityService] Failed to record user activity:', err.message);
  }
}

/**
 * Retrieve user activity logs with pagination, filtering, and tenant scoping.
 */
export async function getUserActivityLogs({ organizationId, userId, action, module: mod, limit = 50, offset = 0, isSuperAdmin = false }) {
  try {
    let query = `
      SELECT ual.*, u.full_name as user_name, u.email as user_email, u.role as user_role, o.organization_name
      FROM user_activity_logs ual
      LEFT JOIN users u ON u.id = ual.user_id
      LEFT JOIN organizations o ON o.id = ual.organization_id
    `;
    const whereClauses = [];
    const params = [];

    if (!isSuperAdmin) {
      whereClauses.push(`(ual.organization_id = ? OR (ual.organization_id IS NULL AND ual.user_id = ?))`);
      params.push(organizationId || 0, userId || 0);
    }

    if (userId) {
      whereClauses.push(`ual.user_id = ?`);
      params.push(userId);
    }

    if (action) {
      whereClauses.push(`ual.action = ?`);
      params.push(action);
    }

    if (mod) {
      whereClauses.push(`ual.module = ?`);
      params.push(mod);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY ual.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('[UserActivityService] Error fetching activity logs:', err);
    return [];
  }
}
