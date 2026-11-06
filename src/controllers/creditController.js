import { pool } from '../config/db.js';
import {
  getUserFeatureCredits,
  assignOrDeductFeatureCredits,
  getUserCreditHistory,
  getAllCreditHistory
} from '../services/creditService.js';
import logger from '../utils/logger.js';

/**
 * GET /api/credits/balance
 * Returns credit balance and feature breakdown for the authenticated user.
 */
export const getUserCreditsController = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const result = await getUserFeatureCredits(userId);
    return res.status(200).json({
      success: true,
      credits: result.total,
      isUnlimited: result.isUnlimited || false,
      isDaysBased: Boolean(result.isDaysBased),
      accessType: result.accessType || 'credit_based',
      daysAllocated: result.daysAllocated,
      daysUsed: result.daysUsed,
      startDate: result.startDate,
      expiryDate: result.expiryDate,
      remainingDays: result.remainingDays,
      daysStatus: result.daysStatus,
      isExpired: Boolean(result.isExpired),
      features: result.features
    });
  } catch (err) {
    logger.error('[CreditController] Error fetching user credits:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch credits' });
  }
};

/**
 * GET /api/credits/history
 * Returns credit transaction history for the authenticated user.
 */
export const getUserHistoryController = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    const history = await getUserCreditHistory(userId, limit, offset);
    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    logger.error('[CreditController] Error fetching credit history:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch credit history' });
  }
};

/**
 * GET /api/credits/admin/users
 * Returns user list with feature-specific credit breakdown (Admin/Super Admin only).
 */
export const getAdminUsersCreditsController = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'Super Admin' || req.user?.role === 'Admin';
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin permissions required' });
    }

    const search = (req.query.search || '').trim();
    let query = `SELECT id, full_name, username, email, role, status, access_type, credits, created_at 
                 FROM users 
                 WHERE (access_type = 'credit_based' OR access_type IS NULL OR access_type = '')`;
    const params = [];

    if (search) {
      query += ` AND (full_name LIKE ? OR username LIKE ? OR email LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    query += ` ORDER BY id ASC`;

    const [rows] = await pool.query(query, params);

    // Fetch feature credits for all users
    const [allFeatureRows] = await pool.query('SELECT user_id, feature_key, credits FROM user_feature_credits');
    const featureMap = {};
    allFeatureRows.forEach((r) => {
      if (!featureMap[r.user_id]) featureMap[r.user_id] = {};
      featureMap[r.user_id][r.feature_key] = Number(r.credits || 0);
    });

    const users = rows.map(u => {
      const isUserAdminRole = u.role === 'Super Admin' || u.role === 'Admin';
      const uFeats = featureMap[u.id] || {};

      const features = isUserAdminRole ? {
        quick: 'Unlimited',
        csv: 'Unlimited',
        tags: 'Unlimited',
        group: 'Unlimited',
        birthday: 'Unlimited',
        general: 'Unlimited'
      } : {
        quick: Number(uFeats.quick || 0),
        csv: Number(uFeats.csv || 0),
        tags: Number(uFeats.tags || 0),
        group: Number(uFeats.group || 0),
        birthday: Number(uFeats.birthday || 0),
        general: Number(u.credits || 0)
      };

      const total = isUserAdminRole ? 'Unlimited' : (features.quick + features.csv + features.tags + features.group + features.birthday + features.general);

      return {
        id: u.id,
        name: u.full_name || u.username || 'User',
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status,
        isUnlimited: isUserAdminRole,
        credits: total,
        features,
        createdAt: u.created_at
      };
    });

    return res.status(200).json({
      success: true,
      users
    });
  } catch (err) {
    logger.error('[CreditController] Error fetching admin users list:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch users list' });
  }
};

/**
 * POST /api/credits/assign
 * Assign or Deduct credits for a user (Admin/Super Admin only).
 */
export const assignCreditsController = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'Super Admin' || req.user?.role === 'Admin';
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin permissions required' });
    }

    const { userId, featureKey = 'general', action = 'ADD', amount, description } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'userId and amount are required' });
    }

    const result = await assignOrDeductFeatureCredits(
      userId,
      req.user.id,
      featureKey,
      action,
      amount,
      description
    );

    return res.status(200).json({
      success: true,
      message: `Successfully ${action === 'DEDUCT' ? 'deducted' : 'assigned'} ${amount} credits for ${featureKey}`,
      data: result
    });
  } catch (err) {
    logger.error('[CreditController] Error assigning credits:', err.message);
    return res.status(400).json({ success: false, message: err.message || 'Failed to assign credits' });
  }
};

/**
 * GET /api/credits/admin/history
 * Returns global credit audit logs for all users (Admin/Super Admin only).
 */
export const getAdminHistoryController = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'Super Admin' || req.user?.role === 'Admin';
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin permissions required' });
    }

    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    const history = await getAllCreditHistory(limit, offset);
    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    logger.error('[CreditController] Error fetching admin credit history:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch global credit history' });
  }
};
