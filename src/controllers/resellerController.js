import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { provisionDefaultTenantData } from '../services/tenantProvisioningService.js';
import { logUserActivity } from '../services/userActivityService.js';
import { formatDateToYMD, calculateExpiryDate, calculateDaysMetrics } from '../utils/userAccessHelper.js';

/**
 * GET /api/resellers
 * List all reseller accounts (Admin / Super Admin only).
 */
export async function getResellers(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id;
    const { search, status, access_type } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id, 
             u.access_type, u.days_allocated, u.days_used, u.start_date, u.expiry_date, u.credits,
             u.allowed_modules, u.created_at, u.last_login_at, u.created_by_user_id,
             o.organization_name,
             (SELECT COUNT(*) FROM users su WHERE su.created_by_user_id = u.id) AS sub_user_count
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.role = 'Reseller'
    `;
    const params = [];

    if (!isSuperAdmin) {
      query += ` AND (u.organization_id = ? OR u.created_by_user_id IN (SELECT id FROM users WHERE organization_id = ?))`;
      params.push(orgId, orgId);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ` AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'All') {
      query += ` AND u.status = ?`;
      params.push(status);
    }

    if (access_type && access_type !== 'All') {
      if (access_type === 'days_based') {
        query += ` AND u.access_type = 'days_based'`;
      } else if (access_type === 'credit_based') {
        query += ` AND (u.access_type = 'credit_based' OR u.access_type IS NULL OR u.access_type = '')`;
      }
    }

    query += ` ORDER BY u.id DESC`;

    const [resellers] = await pool.query(query, params);

    // Summary stats
    const totalResellers = resellers.length;
    const activeResellers = resellers.filter(r => r.status === 'Active').length;
    const disabledResellers = resellers.filter(r => r.status === 'Disabled' || r.status === 'Inactive').length;
    const totalSubUsers = resellers.reduce((sum, r) => sum + Number(r.sub_user_count || 0), 0);

    const formatted = resellers.map(r => {
      let mods = null;
      if (r.allowed_modules) {
        try {
          mods = typeof r.allowed_modules === 'string' ? JSON.parse(r.allowed_modules) : r.allowed_modules;
        } catch (e) {}
      }
      const daysMetrics = calculateDaysMetrics(r);
      return {
        id: r.id,
        full_name: r.full_name || r.name || r.username,
        name: r.full_name || r.name || r.username,
        email: r.email || '',
        phone: r.mobile || '',
        mobile: r.mobile || '',
        username: r.username,
        role: r.role,
        status: (r.status === 'Disabled' || r.status === 'Inactive') ? 'Disabled' : 'Active',
        access_type: daysMetrics.access_type,
        is_days_based: daysMetrics.is_days_based,
        days_allocated: daysMetrics.days_allocated,
        days_used: daysMetrics.days_used,
        start_date: daysMetrics.start_date,
        expiry_date: daysMetrics.expiry_date,
        remaining_days: daysMetrics.remaining_days,
        days_status: daysMetrics.days_status,
        is_expired: daysMetrics.is_expired,
        credits: Number(r.credits || 0),
        organization_id: r.organization_id,
        organization_name: r.organization_name || 'My Organization',
        allowed_modules: mods,
        created_at: r.created_at,
        last_login_at: r.last_login_at,
        sub_user_count: Number(r.sub_user_count || 0)
      };
    });

    return res.json({
      success: true,
      count: formatted.length,
      resellers: formatted,
      summary: { totalResellers, activeResellers, disabledResellers, totalSubUsers }
    });
  } catch (err) {
    console.error('[ResellerController] Get resellers error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch resellers' });
  }
}

/**
 * POST /api/resellers
 * Create a new reseller account (Admin / Super Admin only).
 */
export async function createReseller(req, res) {
  try {
    const {
      company_name,
      owner_name,
      full_name,
      username,
      password,
      email,
      phone,
      allowed_modules,
      access_type,
      days_allocated,
      start_date,
      expiry_date,
      credits,
      initial_credits
    } = req.body;

    const displayName = owner_name || full_name || username;
    const userUsername = username ? username.trim() : '';
    const userEmail = email ? email.trim() : `${userUsername}@reseller.com`;

    if (!userUsername || !password) {
      return res.status(400).json({ success: false, message: 'Username and Password are required' });
    }
    if (!displayName) {
      return res.status(400).json({ success: false, message: 'Owner Name is required' });
    }

    // Check duplicate
    const [existing] = await pool.query(
      `SELECT id FROM users WHERE username = ? OR (email = ? AND email != '') LIMIT 1`,
      [userUsername, userEmail]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A user with this username or email already exists' });
    }

    // Process Access Type
    const userAccessType = access_type === 'days_based' ? 'days_based' : 'credit_based';
    let daysAllocatedVal = 0;
    let startDateVal = null;
    let expiryDateVal = null;
    let creditsVal = 0;

    if (userAccessType === 'days_based') {
      const numDays = parseInt(days_allocated, 10);
      if (isNaN(numDays) || numDays <= 0) {
        return res.status(400).json({ success: false, message: 'Number of days must be greater than 0 for Days-Based access.' });
      }
      daysAllocatedVal = numDays;
      startDateVal = start_date ? formatDateToYMD(start_date) : formatDateToYMD(new Date());
      expiryDateVal = expiry_date ? formatDateToYMD(expiry_date) : calculateExpiryDate(startDateVal, numDays);
      creditsVal = 0;
    } else {
      creditsVal = Math.max(0, parseInt(credits || initial_credits || 0, 10) || 0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const modulesJson = Array.isArray(allowed_modules) ? JSON.stringify(allowed_modules) : null;

    // Create new organization for this reseller
    const orgName = company_name || `${displayName}'s Reseller Organization`;
    const [orgRes] = await pool.query(
      `INSERT INTO organizations (organization_name, owner_user_id, status) VALUES (?, 0, 'Active')`,
      [orgName]
    );
    const targetOrgId = orgRes.insertId;

    // Create reseller in users table with role = 'Reseller'
    const [userRes] = await pool.query(
      `INSERT INTO users (
        full_name, name, email, username, password, plain_password, mobile, role,
        access_type, days_allocated, days_used, start_date, expiry_date, credits,
        status, allowed_modules, organization_id, created_by_user_id, token_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Reseller', ?, ?, 0, ?, ?, ?, 'Active', ?, ?, ?, 1)`,
      [
        displayName, displayName, userEmail, userUsername, hashedPassword, password,
        phone || null, userAccessType, daysAllocatedVal, startDateVal, expiryDateVal, creditsVal,
        modulesJson, targetOrgId, req.user?.id || null
      ]
    );

    const newResellerId = userRes.insertId;

    // Update organization owner
    await pool.query(`UPDATE organizations SET owner_user_id = ? WHERE id = ?`, [newResellerId, targetOrgId]);

    // Provision default tenant data
    try {
      await provisionDefaultTenantData(targetOrgId, newResellerId);
    } catch (provErr) {
      console.warn('[ResellerController] Default tenant provisioning warn:', provErr.message);
    }

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: targetOrgId,
      action: 'RESELLER_CREATED',
      module: 'RESELLERS',
      description: `Created new reseller "${userUsername}" (${userAccessType === 'days_based' ? `Days Based (${daysAllocatedVal}d)` : 'Credit Based'})`,
      metadata: { newResellerId, username: userUsername, access_type: userAccessType }
    });

    const daysMetrics = calculateDaysMetrics({
      access_type: userAccessType, days_allocated: daysAllocatedVal, days_used: 0,
      start_date: startDateVal, expiry_date: expiryDateVal, status: 'Active'
    });

    return res.status(201).json({
      success: true,
      message: 'Reseller created successfully',
      reseller: {
        id: newResellerId,
        full_name: displayName,
        email: userEmail,
        username: userUsername,
        role: 'Reseller',
        status: 'Active',
        access_type: userAccessType,
        is_days_based: userAccessType === 'days_based',
        days_allocated: daysAllocatedVal,
        days_used: 0,
        start_date: startDateVal,
        expiry_date: expiryDateVal,
        remaining_days: daysMetrics.remaining_days,
        days_status: daysMetrics.days_status,
        credits: creditsVal,
        organization_id: targetOrgId,
        company_name: orgName,
        phone: phone || '',
        allowed_modules: Array.isArray(allowed_modules) ? allowed_modules : null
      }
    });
  } catch (err) {
    console.error('[ResellerController] Create reseller error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create reseller', error: err.message });
  }
}

/**
 * GET /api/resellers/:id
 * Get single reseller details.
 */
export async function getResellerDetails(req, res) {
  try {
    const resellerId = req.params.id;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id,
              u.access_type, u.days_allocated, u.days_used, u.start_date, u.expiry_date, u.credits,
              u.allowed_modules, u.created_at, u.last_login_at, u.plain_password, u.created_by_user_id,
              o.organization_name,
              (SELECT COUNT(*) FROM users su WHERE su.created_by_user_id = u.id) AS sub_user_count
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ? AND u.role = 'Reseller' LIMIT 1`,
      [resellerId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }
    const r = rows[0];
    let mods = null;
    if (r.allowed_modules) {
      try { mods = typeof r.allowed_modules === 'string' ? JSON.parse(r.allowed_modules) : r.allowed_modules; } catch (e) {}
    }
    const daysMetrics = calculateDaysMetrics(r);
    return res.json({
      success: true,
      reseller: {
        id: r.id,
        full_name: r.full_name || r.name || r.username,
        email: r.email || '',
        phone: r.mobile || '',
        username: r.username,
        role: r.role,
        status: (r.status === 'Disabled' || r.status === 'Inactive') ? 'Disabled' : 'Active',
        access_type: daysMetrics.access_type,
        is_days_based: daysMetrics.is_days_based,
        days_allocated: daysMetrics.days_allocated,
        days_used: daysMetrics.days_used,
        start_date: daysMetrics.start_date,
        expiry_date: daysMetrics.expiry_date,
        remaining_days: daysMetrics.remaining_days,
        days_status: daysMetrics.days_status,
        is_expired: daysMetrics.is_expired,
        credits: Number(r.credits || 0),
        organization_id: r.organization_id,
        organization_name: r.organization_name || 'My Organization',
        allowed_modules: mods,
        created_at: r.created_at,
        last_login_at: r.last_login_at,
        plain_password: r.plain_password || null,
        sub_user_count: Number(r.sub_user_count || 0)
      }
    });
  } catch (err) {
    console.error('[ResellerController] Get reseller details error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reseller details' });
  }
}

/**
 * PUT /api/resellers/:id
 * Update reseller details and/or module permissions.
 */
export async function updateReseller(req, res) {
  try {
    const resellerId = req.params.id;
    const {
      full_name, name, email, phone, mobile, status, allowed_modules,
      access_type, days_allocated, start_date, expiry_date, credits
    } = req.body;

    const [existing] = await pool.query(
      `SELECT id, username, organization_id, access_type, days_allocated, start_date, expiry_date, credits FROM users WHERE id = ? AND role = 'Reseller' LIMIT 1`,
      [resellerId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }
    const prevUser = existing[0];

    const updates = [];
    const params = [];

    const updatedName = full_name || name;
    if (updatedName) { updates.push('full_name = ?', 'name = ?'); params.push(updatedName, updatedName); }
    if (email) { updates.push('email = ?'); params.push(email.trim()); }
    const updatedPhone = phone || mobile;
    if (updatedPhone !== undefined) { updates.push('mobile = ?'); params.push(updatedPhone); }
    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'Disabled' || status === 'Inactive') {
        updates.push('token_version = token_version + 1');
      }
    }
    if (allowed_modules !== undefined) {
      updates.push('allowed_modules = ?');
      params.push(Array.isArray(allowed_modules) ? JSON.stringify(allowed_modules) : null);
    }

    if (access_type) {
      const newAccessType = access_type === 'days_based' ? 'days_based' : 'credit_based';
      updates.push('access_type = ?');
      params.push(newAccessType);
      if (newAccessType === 'days_based') {
        const numDays = parseInt(days_allocated || prevUser.days_allocated || 30, 10);
        const startDateVal = start_date ? formatDateToYMD(start_date) : (prevUser.start_date ? formatDateToYMD(prevUser.start_date) : formatDateToYMD(new Date()));
        const expiryDateVal = expiry_date ? formatDateToYMD(expiry_date) : calculateExpiryDate(startDateVal, numDays);
        updates.push('days_allocated = ?', 'start_date = ?', 'expiry_date = ?', 'credits = 0');
        params.push(numDays > 0 ? numDays : 30, startDateVal, expiryDateVal);
      } else {
        const numCredits = Math.max(0, parseInt(credits !== undefined ? credits : (prevUser.credits || 0), 10) || 0);
        updates.push('credits = ?', 'days_allocated = 0', 'start_date = NULL', 'expiry_date = NULL');
        params.push(numCredits);
      }
    } else {
      if (days_allocated !== undefined) {
        const numDays = parseInt(days_allocated, 10);
        if (!isNaN(numDays) && numDays > 0) { updates.push('days_allocated = ?'); params.push(numDays); }
      }
      if (start_date !== undefined) { updates.push('start_date = ?'); params.push(formatDateToYMD(start_date)); }
      if (expiry_date !== undefined) { updates.push('expiry_date = ?'); params.push(formatDateToYMD(expiry_date)); }
      if (credits !== undefined) { updates.push('credits = ?'); params.push(Math.max(0, parseInt(credits, 10) || 0)); }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(resellerId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: prevUser.organization_id,
      action: 'RESELLER_UPDATED',
      module: 'RESELLERS',
      description: `Updated reseller "${prevUser.username}"`,
      metadata: { targetResellerId: resellerId, updates: req.body }
    });

    return res.json({ success: true, message: 'Reseller updated successfully' });
  } catch (err) {
    console.error('[ResellerController] Update reseller error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update reseller' });
  }
}

/**
 * PATCH /api/resellers/:id/status
 * Toggle reseller active/disabled status.
 */
export async function toggleResellerStatus(req, res) {
  try {
    const resellerId = req.params.id;
    const { status } = req.body;

    const [existing] = await pool.query(
      `SELECT id, username, status, organization_id FROM users WHERE id = ? AND role = 'Reseller' LIMIT 1`,
      [resellerId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }

    let nextStatus = status;
    if (!nextStatus) {
      nextStatus = existing[0].status === 'Active' ? 'Disabled' : 'Active';
    }

    if (nextStatus === 'Disabled' || nextStatus === 'Inactive') {
      await pool.query(`UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?`, [nextStatus, resellerId]);
    } else {
      await pool.query(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, resellerId]);
    }

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: nextStatus === 'Active' ? 'RESELLER_ENABLED' : 'RESELLER_DISABLED',
      module: 'RESELLERS',
      description: `${nextStatus === 'Active' ? 'Enabled' : 'Disabled'} reseller "${existing[0].username}"`,
      metadata: { targetResellerId: resellerId }
    });

    return res.json({ success: true, message: `Reseller status set to ${nextStatus}`, status: nextStatus });
  } catch (err) {
    console.error('[ResellerController] Toggle reseller status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update reseller status' });
  }
}

/**
 * POST /api/resellers/:id/reset-password
 * Admin resets reseller password.
 */
export async function resetResellerPassword(req, res) {
  try {
    const resellerId = req.params.id;
    let { password } = req.body;

    const [existing] = await pool.query(
      `SELECT id, username, organization_id, token_version FROM users WHERE id = ? AND role = 'Reseller' LIMIT 1`,
      [resellerId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }

    if (!password || password.trim().length === 0) {
      password = 'RS_' + crypto.randomBytes(4).toString('hex') + '!';
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextTokenVersion = (existing[0].token_version || 1) + 1;

    await pool.query(
      `UPDATE users SET password = ?, plain_password = ?, password_changed_at = NOW(), token_version = ? WHERE id = ?`,
      [hashedPassword, password, nextTokenVersion, resellerId]
    );

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'RESELLER_PASSWORD_RESET',
      module: 'RESELLERS',
      description: `Admin reset password for reseller "${existing[0].username}"`,
      metadata: { targetResellerId: resellerId }
    });

    return res.json({ success: true, message: 'Password reset successfully.', temporaryPassword: password });
  } catch (err) {
    console.error('[ResellerController] Reset reseller password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
}

/**
 * DELETE /api/resellers/:id
 * Delete a reseller account.
 */
export async function deleteReseller(req, res) {
  try {
    const resellerId = req.params.id;

    if (req.user && req.user.id == resellerId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const [existing] = await pool.query(
      `SELECT id, username, organization_id FROM users WHERE id = ? AND role = 'Reseller' LIMIT 1`,
      [resellerId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }

    // Check for sub-users
    const [subUsers] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE created_by_user_id = ?`,
      [resellerId]
    );
    if (subUsers[0].cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete reseller: they have ${subUsers[0].cnt} sub-user(s). Please delete or reassign them first.`
      });
    }

    // Clean up
    await pool.query(`DELETE FROM user_activity_logs WHERE user_id = ?`, [resellerId]).catch(() => {});
    await pool.query(`DELETE FROM user_feature_credits WHERE user_id = ?`, [resellerId]).catch(() => {});
    await pool.query(`DELETE FROM credit_transactions WHERE user_id = ?`, [resellerId]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = ?`, [resellerId]);

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'RESELLER_DELETED',
      module: 'RESELLERS',
      description: `Deleted reseller "${existing[0].username}"`,
      metadata: { deletedResellerId: resellerId }
    });

    return res.json({ success: true, message: 'Reseller deleted successfully' });
  } catch (err) {
    console.error('[ResellerController] Delete reseller error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete reseller' });
  }
}

/**
 * GET /api/resellers/:id/users
 * Returns list of sub-users created by a specific reseller.
 */
export async function getResellerUsers(req, res) {
  try {
    const resellerId = req.params.id;
    const isReseller = req.user?.role === 'Reseller';

    // If reseller is requesting, ensure they only request their own sub-users
    if (isReseller && String(req.user.id) !== String(resellerId)) {
      return res.status(403).json({ success: false, message: 'Access denied to other reseller users' });
    }

    // Check reseller exists
    const [resellerRows] = await pool.query(
      `SELECT id, username, full_name, name, organization_id FROM users WHERE id = ? AND role = 'Reseller' LIMIT 1`,
      [resellerId]
    );
    if (resellerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }

    const query = `
      SELECT u.id, u.full_name, u.name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id, 
             u.access_type, u.days_allocated, u.days_used, u.start_date, u.expiry_date, u.credits,
             u.allowed_modules, u.created_at, u.last_login_at, u.created_by_user_id,
             o.organization_name
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.created_by_user_id = ? AND (u.is_team_member = 0 OR u.is_team_member IS NULL) AND u.deleted_at IS NULL
      ORDER BY u.id DESC
    `;

    const [users] = await pool.query(query, [resellerId]);

    const formatted = users.map(u => {
      let mods = null;
      if (u.allowed_modules) {
        try {
          mods = typeof u.allowed_modules === 'string' ? JSON.parse(u.allowed_modules) : u.allowed_modules;
        } catch (e) {}
      }
      const daysMetrics = calculateDaysMetrics(u);
      return {
        id: u.id,
        full_name: u.full_name || u.name || u.username,
        name: u.full_name || u.name || u.username,
        email: u.email || '',
        phone: u.mobile || '',
        mobile: u.mobile || '',
        username: u.username,
        role: u.role,
        status: (u.status === 'Disabled' || u.status === 'Inactive') ? 'Disabled' : 'Active',
        access_type: daysMetrics.access_type,
        is_days_based: daysMetrics.is_days_based,
        days_allocated: daysMetrics.days_allocated,
        days_used: daysMetrics.days_used,
        start_date: daysMetrics.start_date,
        expiry_date: daysMetrics.expiry_date,
        remaining_days: daysMetrics.remaining_days,
        days_status: daysMetrics.days_status,
        is_expired: daysMetrics.is_expired,
        credits: Number(u.credits || 0),
        organization_id: u.organization_id,
        organization_name: u.organization_name || '',
        allowed_modules: mods,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        created_by_user_id: u.created_by_user_id
      };
    });

    return res.json({
      success: true,
      count: formatted.length,
      reseller: {
        id: resellerRows[0].id,
        username: resellerRows[0].username,
        name: resellerRows[0].full_name || resellerRows[0].name
      },
      users: formatted
    });
  } catch (err) {
    console.error('[ResellerController] Get reseller users error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sub-users for reseller' });
  }
}

