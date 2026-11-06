import { pool } from '../config/db.js';
import logger from '../utils/logger.js';
import { calculateDaysMetrics } from '../utils/userAccessHelper.js';

export const FEATURE_KEYS = ['quick', 'csv', 'tags', 'group', 'birthday', 'general'];

/**
 * Helper to resolve the effective credit/billing user ID.
 * If the user is a team member, resolves to their parent account (created_by_user_id or organization owner)
 * so that team members seamlessly share and use their parent account's credits and unlimited status.
 */
export const resolveEffectiveCreditUserId = async (userId) => {
  if (!userId) return userId;
  try {
    const [rows] = await pool.query(
      'SELECT id, role, is_team_member, created_by_user_id, organization_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (rows.length > 0) {
      const u = rows[0];
      if (u.is_team_member) {
        if (u.created_by_user_id) {
          return u.created_by_user_id;
        }
        if (u.organization_id) {
          const [ownerRows] = await pool.query(
            'SELECT id FROM users WHERE organization_id = ? AND (is_team_member = 0 OR is_team_member IS NULL) ORDER BY id ASC LIMIT 1',
            [u.organization_id]
          );
          if (ownerRows.length > 0) {
            return ownerRows[0].id;
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[CreditService] Error resolving effective credit user ID:', err.message);
  }
  return userId;
};

/**
 * Helper to check if user has Admin or Super Admin role.
 */
export const isUserAdmin = async (userId) => {
  try {
    const effectiveUserId = await resolveEffectiveCreditUserId(userId);
    const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [effectiveUserId]);
    if (rows.length > 0) {
      const role = rows[0].role;
      return role === 'Super Admin' || role === 'Admin';
    }
    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Get feature-specific credit breakdown and total balance for a user.
 * Admin and Super Admin accounts receive Unlimited credits.
 * Days-based accounts receive days-based metrics and unlimited message access while active.
 */
export const getUserFeatureCredits = async (userId) => {
  try {
    const effectiveUserId = await resolveEffectiveCreditUserId(userId);
    const isAdmin = await isUserAdmin(effectiveUserId);
    if (isAdmin) {
      return {
        isUnlimited: true,
        accessType: 'credit_based',
        isDaysBased: false,
        total: 'Unlimited',
        features: {
          quick: 'Unlimited',
          csv: 'Unlimited',
          tags: 'Unlimited',
          group: 'Unlimited',
          birthday: 'Unlimited',
          general: 'Unlimited'
        }
      };
    }

    const [userRows] = await pool.query(
      'SELECT id, role, access_type, days_allocated, days_used, start_date, expiry_date, status, credits FROM users WHERE id = ?',
      [effectiveUserId]
    );

    if (userRows.length === 0) {
      return {
        isUnlimited: false,
        accessType: 'credit_based',
        isDaysBased: false,
        features: { quick: 0, csv: 0, tags: 0, group: 0, birthday: 0, general: 0 },
        total: 0
      };
    }

    const userRecord = userRows[0];
    const isDaysBased = userRecord.access_type === 'days_based';

    if (isDaysBased) {
      const daysMetrics = calculateDaysMetrics(userRecord);
      const isStillActive = !daysMetrics.is_expired && daysMetrics.days_status !== 'Disabled';

      return {
        isUnlimited: isStillActive,
        accessType: 'days_based',
        isDaysBased: true,
        daysAllocated: daysMetrics.days_allocated,
        daysUsed: daysMetrics.days_used,
        startDate: daysMetrics.start_date,
        expiryDate: daysMetrics.expiry_date,
        remainingDays: daysMetrics.remaining_days,
        daysStatus: daysMetrics.days_status,
        isExpired: daysMetrics.is_expired,
        total: daysMetrics.is_expired ? 'Expired' : `${daysMetrics.remaining_days} Days`,
        features: {
          quick: isStillActive ? 'Days Access' : 0,
          csv: isStillActive ? 'Days Access' : 0,
          tags: isStillActive ? 'Days Access' : 0,
          group: isStillActive ? 'Days Access' : 0,
          birthday: isStillActive ? 'Days Access' : 0,
          general: isStillActive ? 'Days Access' : 0
        }
      };
    }

    const generalCredits = Number(userRecord.credits || 0);

    const [featureRows] = await pool.query(
      'SELECT feature_key, credits FROM user_feature_credits WHERE user_id = ?',
      [userId]
    );

    const features = {
      quick: 0,
      csv: 0,
      tags: 0,
      group: 0,
      birthday: 0,
      general: generalCredits
    };

    featureRows.forEach((r) => {
      if (features.hasOwnProperty(r.feature_key)) {
        features[r.feature_key] = Number(r.credits || 0);
      }
    });

    const total = features.quick + features.csv + features.tags + features.group + features.birthday + features.general;

    return {
      isUnlimited: false,
      accessType: 'credit_based',
      isDaysBased: false,
      features,
      total
    };
  } catch (err) {
    logger.error('[CreditService] Error fetching user feature credits:', err.message);
    return {
      isUnlimited: false,
      accessType: 'credit_based',
      isDaysBased: false,
      features: { quick: 0, csv: 0, tags: 0, group: 0, birthday: 0, general: 0 },
      total: 0
    };
  }
};

/**
 * Get credit balance for a specific user and feature.
 */
export const getUserCreditsForFeature = async (userId, featureKey = 'general') => {
  const effectiveUserId = await resolveEffectiveCreditUserId(userId);
  const isAdmin = await isUserAdmin(effectiveUserId);
  if (isAdmin) return 'Unlimited';

  const creditData = await getUserFeatureCredits(effectiveUserId);
  if (creditData.isDaysBased) {
    return creditData.isUnlimited ? 'Unlimited' : 0;
  }

  if (featureKey && creditData.features.hasOwnProperty(featureKey)) {
    return creditData.features[featureKey];
  }
  return creditData.total;
};

/**
 * Pre-check if user has sufficient credits or active days-based subscription for requested message count.
 */
export const hasSufficientCredits = async (userId, requiredCount = 1, featureKey = 'general') => {
  const effectiveUserId = await resolveEffectiveCreditUserId(userId);
  const isAdmin = await isUserAdmin(effectiveUserId);
  if (isAdmin) {
    return {
      sufficient: true,
      available: 'Unlimited',
      isUnlimited: true,
      required: requiredCount,
      featureKey
    };
  }

  // Fetch user record to check access model
  const [userRows] = await pool.query(
    'SELECT id, role, access_type, days_allocated, days_used, start_date, expiry_date, status, credits FROM users WHERE id = ?',
    [effectiveUserId]
  );

  if (userRows.length === 0) {
    return {
      sufficient: false,
      available: 0,
      isUnlimited: false,
      required: requiredCount,
      featureKey,
      message: 'User account not found.'
    };
  }

  const user = userRows[0];

  // Days-Based access verification
  if (user.access_type === 'days_based') {
    const daysMetrics = calculateDaysMetrics(user);

    if (user.status === 'Disabled' || user.status === 'Inactive') {
      return {
        sufficient: false,
        isDaysBased: true,
        available: 0,
        isUnlimited: false,
        required: requiredCount,
        featureKey,
        reason: 'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Please contact your administrator.'
      };
    }

    if (daysMetrics.is_expired || daysMetrics.remaining_days <= 0) {
      return {
        sufficient: false,
        isDaysBased: true,
        isExpired: true,
        available: 0,
        isUnlimited: false,
        required: requiredCount,
        featureKey,
        expiryDate: daysMetrics.expiry_date,
        reason: 'DAYS_EXPIRED',
        message: `Your Days-Based access plan expired on ${daysMetrics.expiry_date || 'the validity date'}. Please contact your administrator to extend days.`
      };
    }

    // Active days based access grants unlimited messaging within validity
    return {
      sufficient: true,
      available: `${daysMetrics.remaining_days} Days`,
      isDaysBased: true,
      isUnlimited: true,
      remainingDays: daysMetrics.remaining_days,
      expiryDate: daysMetrics.expiry_date,
      required: requiredCount,
      featureKey
    };
  }

  // Credit-Based access check
  const available = await getUserCreditsForFeature(effectiveUserId, featureKey);
  const numAvail = typeof available === 'number' ? available : 999999;
  return {
    sufficient: numAvail >= requiredCount,
    available,
    isDaysBased: false,
    isUnlimited: false,
    required: requiredCount,
    featureKey,
    message: numAvail < requiredCount ? `Insufficient credits for ${featureKey}. Available: ${numAvail}, Required: ${requiredCount}.` : undefined
  };
};

/**
 * Assign or Deduct credits for a specific feature.
 * Action: 'ADD' (Assign) | 'DEDUCT' (Delete/Remove)
 */
export const assignOrDeductFeatureCredits = async (
  userId,
  adminId,
  featureKey = 'general',
  action = 'ADD',
  amount,
  description
) => {
  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Credit amount must be a positive integer.');
  }

  const validAction = String(action || 'ADD').toUpperCase();
  if (!['ADD', 'DEDUCT'].includes(validAction)) {
    throw new Error('Action must be either ADD or DEDUCT.');
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check user
    const [userRows] = await connection.query('SELECT id, credits FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      throw new Error('User not found.');
    }

    let newFeatureBalance = 0;
    const isGeneral = !featureKey || featureKey === 'general';

    if (isGeneral) {
      // General credit in users table
      const currentGen = Number(userRows[0].credits || 0);
      if (validAction === 'DEDUCT' && currentGen < numAmount) {
        throw new Error(`Cannot deduct ${numAmount} credits. User only has ${currentGen} general credits.`);
      }
      const change = validAction === 'ADD' ? numAmount : -numAmount;
      await connection.query('UPDATE users SET credits = GREATEST(0, credits + ?) WHERE id = ?', [change, userId]);

      const [updatedUser] = await connection.query('SELECT credits FROM users WHERE id = ?', [userId]);
      newFeatureBalance = Number(updatedUser[0].credits || 0);
    } else {
      // Specific feature credit in user_feature_credits table
      const [featRows] = await connection.query(
        'SELECT credits FROM user_feature_credits WHERE user_id = ? AND feature_key = ?',
        [userId, featureKey]
      );
      const currentFeat = featRows.length > 0 ? Number(featRows[0].credits || 0) : 0;

      if (validAction === 'DEDUCT' && currentFeat < numAmount) {
        throw new Error(`Cannot deduct ${numAmount} credits. User only has ${currentFeat} credits for feature "${featureKey}".`);
      }

      newFeatureBalance = validAction === 'ADD' ? (currentFeat + numAmount) : Math.max(0, currentFeat - numAmount);

      await connection.query(
        `INSERT INTO user_feature_credits (user_id, feature_key, credits) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE credits = VALUES(credits)`,
        [userId, featureKey, newFeatureBalance]
      );
    }

    const transactionType = validAction === 'ADD' ? 'ADMIN_ASSIGN' : 'ADMIN_DEDUCT';
    const signedAmount = validAction === 'ADD' ? numAmount : -numAmount;
    const defaultDesc = validAction === 'ADD'
      ? `Admin Assigned ${numAmount} credits to ${featureKey}`
      : `Admin Deducted ${numAmount} credits from ${featureKey}`;

    // Record audit transaction
    await connection.query(
      `INSERT INTO credit_transactions (user_id, admin_id, type, feature_key, amount, balance_after, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, adminId || null, transactionType, featureKey || 'general', signedAmount, newFeatureBalance, description || defaultDesc]
    );

    await connection.commit();
    logger.info(`[CreditService] Admin ${adminId} ${validAction} ${numAmount} credits for user ${userId} (${featureKey}). New balance: ${newFeatureBalance}`);

    return {
      success: true,
      userId,
      featureKey,
      action: validAction,
      amount: numAmount,
      balanceAfter: newFeatureBalance
    };
  } catch (err) {
    if (connection) await connection.rollback();
    logger.error('[CreditService] Error in assignOrDeductFeatureCredits:', err.message);
    throw err;
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Legacy compatibility wrapper for assignCredits.
 */
export const assignCredits = async (userId, adminId, amount, description = 'Admin Assigned Credits') => {
  return assignOrDeductFeatureCredits(userId, adminId, 'general', 'ADD', amount, description);
};

/**
 * Legacy compatibility wrapper for getUserCredits.
 */
export const getUserCredits = async (userId) => {
  const { total } = await getUserFeatureCredits(userId);
  return total;
};

/**
 * Deduct credits atomically for message dispatch from specific feature.
 * Bypasses deduction for Admin/Super Admin accounts and active Days-Based subscribers.
 */
export const deductMessageCredit = async (userId, arg2 = 1, arg3 = 'WhatsApp Message Dispatched', arg4 = 'general') => {
  let count = 1;
  let description = 'WhatsApp Message Dispatched';
  let featureKey = 'general';

  if (typeof arg2 === 'number') {
    count = arg2;
    description = typeof arg3 === 'string' ? arg3 : 'WhatsApp Message Dispatched';
    featureKey = typeof arg4 === 'string' ? arg4 : 'general';
  } else if (typeof arg2 === 'string') {
    if (!isNaN(Number(arg2))) {
      count = parseInt(arg2, 10);
      description = typeof arg3 === 'string' ? arg3 : 'WhatsApp Message Dispatched';
      featureKey = typeof arg4 === 'string' ? arg4 : 'general';
    } else {
      featureKey = arg2;
      count = typeof arg3 === 'number' ? arg3 : (parseInt(arg3, 10) || 1);
      description = typeof arg4 === 'string' ? arg4 : 'WhatsApp Message Dispatched';
    }
  }

  const deductCount = parseInt(count, 10);
  if (isNaN(deductCount) || deductCount <= 0) return false;

  const effectiveUserId = await resolveEffectiveCreditUserId(userId);
  const isAdmin = await isUserAdmin(effectiveUserId);
  if (isAdmin) {
    logger.info(`[CreditService] User ${userId} (effective owner: ${effectiveUserId}) is Admin/Super Admin (Unlimited Credits). Skipping credit deduction.`);
    return true;
  }

  // Check if user has Days-Based access
  try {
    const [userRows] = await pool.query(
      'SELECT id, role, access_type, days_allocated, days_used, start_date, expiry_date, status FROM users WHERE id = ?',
      [effectiveUserId]
    );

    if (userRows.length > 0 && userRows[0].access_type === 'days_based') {
      const user = userRows[0];
      const daysMetrics = calculateDaysMetrics(user);

      if (user.status === 'Disabled' || user.status === 'Inactive') {
        logger.warn(`[CreditService] Disallowed message dispatch for disabled days-based user ${userId} (effective owner: ${effectiveUserId}).`);
        return false;
      }

      if (daysMetrics.is_expired || daysMetrics.remaining_days <= 0) {
        logger.warn(`[CreditService] Disallowed message dispatch for expired days-based user ${userId} (Expired on ${daysMetrics.expiry_date}).`);
        return false;
      }

      // Valid Days-Based active access: message dispatch allowed without credit reduction
      logger.info(`[CreditService] User ${userId} (effective owner: ${effectiveUserId}) has active Days-Based subscription (${daysMetrics.remaining_days} days remaining). Message dispatch authorized.`);
      return true;
    }
  } catch (checkErr) {
    logger.warn('[CreditService] Error checking days-based user state in deductMessageCredit:', checkErr.message);
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let deducted = false;
    let balanceAfter = 0;

    // Check if feature specific balance has enough credits
    if (featureKey && featureKey !== 'general') {
      const [featRows] = await connection.query(
        'SELECT credits FROM user_feature_credits WHERE user_id = ? AND feature_key = ?',
        [effectiveUserId, featureKey]
      );
      const currentFeat = featRows.length > 0 ? Number(featRows[0].credits || 0) : 0;

      if (currentFeat >= deductCount) {
        balanceAfter = currentFeat - deductCount;
        await connection.query(
          'UPDATE user_feature_credits SET credits = credits - ? WHERE user_id = ? AND feature_key = ? AND credits >= ?',
          [deductCount, effectiveUserId, featureKey, deductCount]
        );
        deducted = true;
      }
    }

    // If feature specific deduction didn't run or failed, fallback to general credits in users table
    if (!deducted) {
      const [result] = await connection.query(
        'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
        [deductCount, effectiveUserId, deductCount]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        logger.warn(`[CreditService] Insufficient credits for user ${userId} (effective owner: ${effectiveUserId}) (${featureKey}) to deduct ${deductCount}.`);
        return false;
      }

      const [updatedRows] = await connection.query('SELECT credits FROM users WHERE id = ?', [effectiveUserId]);
      balanceAfter = Number(updatedRows[0].credits || 0);
      deducted = true;
    }

    // Record transaction
    const txDesc = String(userId) !== String(effectiveUserId) ? `${description} (sent by team member #${userId})` : description;
    await connection.query(
      `INSERT INTO credit_transactions (user_id, admin_id, type, feature_key, amount, balance_after, description) 
       VALUES (?, NULL, 'MESSAGE_SENT', ?, ?, ?, ?)`,
      [effectiveUserId, featureKey || 'general', -deductCount, balanceAfter, txDesc]
    );

    await connection.commit();
    return true;
  } catch (err) {
    if (connection) await connection.rollback();
    logger.error('[CreditService] Error deducting credits:', err.message);
    return false;
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Fetch credit audit history for a single user.
 */
export const getUserCreditHistory = async (userId, limit = 50, offset = 0) => {
  try {
    const [rows] = await pool.query(
      `SELECT ct.*, u.full_name as user_name, u.email as user_email, adm.full_name as admin_name 
       FROM credit_transactions ct
       LEFT JOIN users u ON u.id = ct.user_id
       LEFT JOIN users adm ON adm.id = ct.admin_id
       WHERE ct.user_id = ?
       ORDER BY ct.id DESC
       LIMIT ? OFFSET ?`,
      [userId, Number(limit), Number(offset)]
    );
    return rows;
  } catch (err) {
    logger.error('[CreditService] Error fetching user credit history:', err.message);
    return [];
  }
};

/**
 * Fetch credit audit history for all users (Admin audit trail).
 */
export const getAllCreditHistory = async (limit = 100, offset = 0) => {
  try {
    const [rows] = await pool.query(
      `SELECT ct.*, u.full_name as user_name, u.email as user_email, u.username as user_username, adm.full_name as admin_name 
       FROM credit_transactions ct
       LEFT JOIN users u ON u.id = ct.user_id
       LEFT JOIN users adm ON adm.id = ct.admin_id
       ORDER BY ct.id DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );
    return rows;
  } catch (err) {
    logger.error('[CreditService] Error fetching all credit history:', err.message);
    return [];
  }
};
