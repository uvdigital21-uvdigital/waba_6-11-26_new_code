import { pool } from '../config/db.js';
import { maskToken } from '../utils/encryption.js';

/**
 * GET /api/dashboard
 * Returns multi-tenant live statistics & connected WhatsApp accounts summary.
 */
export async function getDashboardStats(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const reqOrgId = req.organizationId || req.user?.organization_id;

    // Non-Super Admin users are strictly restricted to their own organizationId
    const targetOrgId = isSuperAdmin
      ? (req.query.organization_id ? parseInt(req.query.organization_id, 10) : (reqOrgId || 1))
      : reqOrgId;
    const targetUserId = req.user?.id || null;
    const selectedAccountId = req.query.account_id || req.query.number_id || req.headers['x-account-id'] || null;

    if (!targetOrgId && !targetUserId) {
      return res.json({
        success: true,
        data: {
          whatsapp_account: null,
          connected_accounts: [],
          stats: {
            connected: false,
            verified_name: 'N/A',
            business_name: 'N/A',
            phone_number: 'N/A',
            quality_rating: 'GREEN',
            status: 'DISCONNECTED',
            messages_sent: 0,
            messages_delivered: 0,
            messages_read: 0,
            messages_failed: 0,
            templates_count: 0,
            contacts_count: 0,
            campaigns_count: 0
          }
        }
      });
    }

    const isAdmin = isSuperAdmin || req.user?.role === 'Admin' || req.user?.username === 'admin';

    // 1. Fetch Connected WhatsApp Accounts
    // Admin/SuperAdmin sees organization accounts. Team members only see accounts explicitly assigned or none if none assigned.
    const [waAccounts] = await pool.query(
      `SELECT id, organization_id, user_id, phone_number, phone_number_id, waba_id,
              verified_name, display_phone_number, business_name, quality_rating,
              verification_status, connected_at
       FROM whatsapp_accounts WHERE organization_id = ? ORDER BY id DESC`,
      [targetOrgId]
    );

    // 2. Fetch Messages Statistics
    let msgStats = [{ total_sent: 0, total_delivered: 0, total_read: 0, total_failed: 0 }];
    if (isAdmin) {
      const [stats] = await pool.query(
        `SELECT 
           COUNT(DISTINCT CASE WHEN LOWER(status) IN ('sent', 'delivered', 'read') THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_sent,
           COUNT(DISTINCT CASE WHEN LOWER(status) IN ('delivered', 'read') THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_delivered,
           COUNT(DISTINCT CASE WHEN LOWER(status) = 'read' THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_read,
           COUNT(DISTINCT CASE WHEN LOWER(status) = 'failed' THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_failed
         FROM messages
         WHERE (direction = 'outgoing' OR sender = 'user')
           AND (organization_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE organization_id = ?))`,
        [targetOrgId, targetOrgId]
      );
      msgStats = stats;
    } else {
      // Member-specific messages only
      const [stats] = await pool.query(
        `SELECT 
           COUNT(DISTINCT CASE WHEN LOWER(status) IN ('sent', 'delivered', 'read') THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_sent,
           COUNT(DISTINCT CASE WHEN LOWER(status) IN ('delivered', 'read') THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_delivered,
           COUNT(DISTINCT CASE WHEN LOWER(status) = 'read' THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_read,
           COUNT(DISTINCT CASE WHEN LOWER(status) = 'failed' THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as total_failed
         FROM messages
         WHERE (direction = 'outgoing' OR sender = 'user')
           AND (user_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE user_id = ?))`,
        [targetUserId, targetUserId]
      );
      msgStats = stats;
    }

    // 3. Fetch Contacts Count
    let contactsCount = 0;
    try {
      if (isAdmin) {
        const [cRows] = await pool.query(
          `SELECT COUNT(*) as count FROM conversations WHERE organization_id = ?`,
          [targetOrgId]
        );
        contactsCount = cRows[0]?.count || 0;
      } else {
        const [cRows] = await pool.query(
          `SELECT COUNT(*) as count FROM conversations WHERE user_id = ?`,
          [targetUserId]
        );
        contactsCount = cRows[0]?.count || 0;
      }
    } catch (cErr) {
      contactsCount = 0;
    }

    // 4. Fetch Approved Templates Count (matching Official Templates table)
    let templatesCount = 0;
    try {
      // 4b. Count unique approved templates from the primary templates table
      let orgCond = targetOrgId ? `(organization_id = ? OR (organization_id IS NULL AND user_id = ?))` : `user_id = ?`;
      let orgParams = targetOrgId ? [targetOrgId, targetUserId] : [targetUserId];

      const [tRows] = await pool.query(
        `SELECT COUNT(DISTINCT name) as count FROM templates WHERE ${orgCond} AND status = 'APPROVED'`,
        orgParams
      );
      templatesCount = tRows[0]?.count || 0;

      // 4c. Fallback to whatsapp_templates if templates table has 0
      if (templatesCount === 0) {
        const [wtRows] = await pool.query(
          `SELECT COUNT(DISTINCT template_name) as count FROM whatsapp_templates WHERE (organization_id = ? OR user_id = ?) AND status = 'APPROVED'`,
          [targetOrgId || 0, targetUserId]
        );
        templatesCount = wtRows[0]?.count || 0;
      }
    } catch (tErr) {
      console.warn('[DashboardController] Templates count query warning:', tErr.message);
      templatesCount = 0;
    }

    // 5. Fetch Campaigns Count
    let campaignsCount = 0;
    try {
      if (isAdmin) {
        const [campRows] = await pool.query(
          `SELECT COUNT(*) as count FROM campaigns WHERE organization_id = ?`,
          [targetOrgId]
        );
        campaignsCount = campRows[0]?.count || 0;
      } else {
        // Sub-user campaigns only
        const [campRows] = await pool.query(
          `SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?`,
          [targetUserId]
        );
        campaignsCount = campRows[0]?.count || 0;
      }
    } catch (campErr) {
      campaignsCount = 0;
    }

    // Select Active Primary WhatsApp Account
    let primaryAccount = null;
    if (selectedAccountId && waAccounts.length > 0) {
      primaryAccount = waAccounts.find(acc => acc.id == selectedAccountId) || waAccounts[0];
    } else {
      primaryAccount = waAccounts.length > 0 ? waAccounts[0] : null;
    }

    return res.json({
      success: true,
      data: {
        whatsapp_account: primaryAccount,
        connected_accounts: waAccounts,
        stats: {
          connected: waAccounts.length > 0,
          verified_name: primaryAccount ? (primaryAccount.verified_name || primaryAccount.business_name || 'Official WhatsApp Account') : 'N/A',
          business_name: primaryAccount ? (primaryAccount.business_name || primaryAccount.verified_name || 'N/A') : 'N/A',
          phone_number: primaryAccount ? (primaryAccount.display_phone_number || primaryAccount.phone_number) : 'N/A',
          quality_rating: primaryAccount ? (primaryAccount.quality_rating || 'GREEN') : 'GREEN',
          status: primaryAccount ? (primaryAccount.verification_status || 'ACTIVE') : 'DISCONNECTED',
          messages_sent: parseInt(msgStats[0]?.total_sent || 0, 10),
          messages_delivered: parseInt(msgStats[0]?.total_delivered || 0, 10),
          messages_read: parseInt(msgStats[0]?.total_read || 0, 10),
          messages_failed: parseInt(msgStats[0]?.total_failed || 0, 10),
          templates_count: templatesCount,
          contacts_count: contactsCount,
          campaigns_count: campaignsCount
        }
      }
    });

  } catch (err) {
    console.error('[DashboardController] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
  }
}

export const getDashboard = getDashboardStats;

/**
 * GET /api/dashboard/message-stats?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&account_id=optional
 *
 * Returns message counts (sent / delivered / read / error) grouped by day,
 * for the given date range — used by the "Outgoing Message Analytics" chart
 * on the Dashboard. Scoping mirrors getDashboardStats exactly:
 *   - Admin/Super Admin  → all messages in the organization
 *   - Team member        → only messages tied to that user_id
 */
export async function getMessageStats(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const reqOrgId = req.organizationId || req.user?.organization_id;
    const targetOrgId = isSuperAdmin
      ? (req.query.organization_id ? parseInt(req.query.organization_id, 10) : (reqOrgId || 1))
      : reqOrgId;
    const targetUserId = req.user?.id || null;
    const isAdmin = isSuperAdmin || req.user?.role === 'Admin' || req.user?.username === 'admin';
    const selectedAccountId = req.query.account_id || req.query.number_id || req.headers['x-account-id'] || null;

    // ---- Validate / default date range (defaults to last 7 days incl. today) ----
    let { start_date, end_date } = req.query;
    const fmt = (d) => d.toISOString().split('T')[0];
    if (!start_date || !end_date) {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      start_date = start_date || fmt(weekAgo);
      end_date = end_date || fmt(today);
    }

    const ymdPattern = /^\d{4}-\d{2}-\d{2}$/;
    const isRealDate = value => {
      if (!ymdPattern.test(String(value || ''))) return false;
      const [year, month, day] = String(value).split('-').map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
    };
    if (!isRealDate(start_date) || !isRealDate(end_date)) {
      return res.status(400).json({ success: false, message: 'Dates must use a valid YYYY-MM-DD format.' });
    }
    if (start_date > end_date) {
      return res.status(400).json({ success: false, message: 'From date cannot be after To date.' });
    }

    // ---- Build scoping WHERE clause + params (same pattern as getDashboardStats) ----
    let scopeClause;
    let scopeParams;
    if (isAdmin) {
      scopeClause = `(organization_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE organization_id = ?))`;
      scopeParams = [targetOrgId, targetOrgId];
    } else {
      scopeClause = `(user_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE user_id = ?))`;
      scopeParams = [targetUserId, targetUserId];
    }

    let accountClause = '';
    const accountParams = [];
    if (selectedAccountId) {
      accountClause = ' AND whatsapp_account_id = ?';
      accountParams.push(selectedAccountId);
    }

    // NOTE: comparing DATE(timestamp) directly (not the raw timestamp) avoids
    // timezone-shift bugs where the pool's `timezone: '+05:30'` setting could
    // pull in an extra hour or two from the previous day at the start boundary.
    const params = [...scopeParams, start_date, end_date, ...accountParams];

    const [rows] = await pool.query(
      `SELECT
         DATE_FORMAT(DATE(timestamp), '%Y-%m-%d') as date,
         COUNT(DISTINCT CASE WHEN LOWER(status) IN ('sent', 'delivered', 'read') THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as sent,
         COUNT(DISTINCT CASE WHEN LOWER(status) IN ('delivered', 'read') THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as delivered,
         COUNT(DISTINCT CASE WHEN LOWER(status) = 'read' THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as \`read\`,
         COUNT(DISTINCT CASE WHEN LOWER(status) = 'failed' THEN COALESCE(NULLIF(wa_message_id, ''), CONCAT('row:', id)) END) as error
       FROM messages
       WHERE ${scopeClause}
         AND (direction = 'outgoing' OR sender = 'user')
         AND DATE(timestamp) BETWEEN ? AND ?
         ${accountClause}
       GROUP BY DATE(timestamp)
       ORDER BY DATE(timestamp) ASC`,
      params
    );

    // Index the returned rows by date string for quick lookup
    const rowsByDate = {};
    rows.forEach(r => {
      // DATE_FORMAT makes this a calendar-date string and prevents the MySQL
      // driver from applying a timezone conversion to a DATE value.
      const key = String(r.date).slice(0, 10);
      rowsByDate[key] = {
        sent: parseInt(r.sent || 0, 10),
        delivered: parseInt(r.delivered || 0, 10),
        read: parseInt(r.read || 0, 10),
        error: parseInt(r.error || 0, 10)
      };
    });

    // Fill EVERY date between start_date and end_date (inclusive), even days
    // with zero messages, so the chart is continuous and never skips a day.
    const daily = [];
    const cursor = new Date(`${start_date}T00:00:00Z`);
    const endCursor = new Date(`${end_date}T00:00:00Z`);
    while (cursor <= endCursor) {
      const key = cursor.toISOString().split('T')[0];
      daily.push({ date: key, ...(rowsByDate[key] || { sent: 0, delivered: 0, read: 0, error: 0 }) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const totals = daily.reduce(
      (acc, d) => ({
        sent: acc.sent + d.sent,
        delivered: acc.delivered + d.delivered,
        read: acc.read + d.read,
        error: acc.error + d.error
      }),
      { sent: 0, delivered: 0, read: 0, error: 0 }
    );
    totals.total = totals.sent + totals.error;

    // Analytics must always reflect the current DB/webhook state, especially
    // immediately after delivery/read updates or a custom-range Apply action.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.json({
      success: true,
      data: {
        totals,
        daily,
        range: { start_date, end_date },
        account_id: selectedAccountId ? String(selectedAccountId) : null,
        source: 'database.messages'
      }
    });

  } catch (err) {
    console.error('[DashboardController] getMessageStats Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch message statistics' });
  }
}
