import { pool } from '../config/db.js';
import { normalizeMobile, checkBlacklist } from '../services/blacklistService.js';

// GET /api/blacklist - List all blacklisted numbers with pagination & search & date filter
export const getBlacklist = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const organizationId = req.organizationId || req.user?.organization_id || 1;
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const dateFrom = req.query.from || req.query.dateFrom || '';
    const dateTo = req.query.to || req.query.dateTo || '';

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (!isSuperAdmin && organizationId) {
      whereClause += ' AND (organization_id = ? OR (organization_id IS NULL AND user_id = ?))';
      params.push(organizationId, userId);
    }

    if (search) {
      whereClause += ' AND (mobile LIKE ? OR normalized_mobile LIKE ? OR phone_number LIKE ? OR reason LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (dateFrom) {
      whereClause += ' AND created_at >= ?';
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      whereClause += ' AND created_at <= ?';
      params.push(`${dateTo} 23:59:59`);
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM blacklist ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    const [rows] = await pool.query(
      `SELECT id, organization_id, user_id, country_code, mobile, normalized_mobile, phone_number, reason, created_at, updated_at 
       FROM blacklist ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Format output for frontend compatibility
    const formattedRows = rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      country_code: r.country_code || '+91',
      mobile: r.mobile || r.phone_number,
      normalized_mobile: r.normalized_mobile || r.phone_number,
      phone_number: r.phone_number || r.normalized_mobile || r.mobile,
      reason: r.reason || '',
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    res.json({
      numbers: formattedRows,
      total,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching blacklist:', err);
    res.status(500).json({ message: 'Failed to fetch blacklist', error: err.message });
  }
};

// POST /api/blacklist - Add single or multiple numbers (comma-separated) to blacklist
export const addToBlacklist = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 1;
    const organizationId = req.organizationId || req.user?.organization_id || 1;
    const { mobile, phone_number, country_code, countryCode, reason } = req.body;

    const rawInput = String(mobile || phone_number || '').trim();
    if (!rawInput) {
      return res.status(400).json({ message: 'Mobile phone number is required' });
    }

    const cc = country_code || countryCode || '+91';
    const numberList = rawInput.split(/[\n,;]+/).map(n => n.trim()).filter(n => n.length > 0);

    if (numberList.length === 0) {
      return res.status(400).json({ message: 'No valid mobile numbers provided' });
    }

    const insertedItems = [];
    let addedCount = 0;

    for (const num of numberList) {
      const normalized = normalizeMobile(num, cc);
      if (!normalized) continue;

      const displayMobile = num.startsWith('+') ? num : `${cc}${num.replace(/\D/g, '')}`;

      const [result] = await pool.query(
        `INSERT INTO blacklist (organization_id, user_id, country_code, mobile, normalized_mobile, phone_number, reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [organizationId, userId, cc, displayMobile, normalized, normalized, reason || null]
      );

      insertedItems.push({
        id: result.insertId || Date.now(),
        country_code: cc,
        mobile: displayMobile,
        normalized_mobile: normalized
      });
      addedCount++;
    }

    res.status(201).json({
      success: true,
      message: `${addedCount} number(s) added to blacklist successfully`,
      addedCount,
      data: insertedItems
    });
  } catch (err) {
    console.error('Error adding to blacklist:', err);
    res.status(500).json({ message: 'Failed to add number to blacklist', error: err.message });
  }
};

// DELETE /api/blacklist/:id - Remove a number from blacklist
export const removeFromBlacklist = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId || req.user?.organization_id || 1;

    const [result] = await pool.query(
      'DELETE FROM blacklist WHERE (id = ? OR normalized_mobile = ? OR mobile = ?) AND (organization_id = ? OR organization_id IS NULL)',
      [id, id, id, organizationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Blacklist entry not found' });
    }

    res.json({ success: true, message: 'Number removed from blacklist successfully' });
  } catch (err) {
    console.error('Error removing from blacklist:', err);
    res.status(500).json({ message: 'Failed to remove number from blacklist', error: err.message });
  }
};

// GET /api/blacklist/check?mobile=xxxxxxxxxx - Check if a number is blacklisted
export const checkBlacklistEndpoint = async (req, res) => {
  try {
    const targetMobile = req.query.mobile || req.query.phone || req.query.number || '';
    if (!targetMobile) {
      return res.status(400).json({ blocked: false, message: 'Mobile parameter is required' });
    }

    const isBlocked = await checkBlacklist(targetMobile);
    return res.json({
      blocked: isBlocked,
      mobile: targetMobile,
      normalized: normalizeMobile(targetMobile)
    });
  } catch (err) {
    console.error('Error checking blacklist endpoint:', err);
    res.status(500).json({ blocked: false, error: err.message });
  }
};