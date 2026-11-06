import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { provisionDefaultTenantData } from '../services/tenantProvisioningService.js';
import { logUserActivity, getUserActivityLogs } from '../services/userActivityService.js';
import { formatDateToYMD, calculateExpiryDate, calculateDaysMetrics } from '../utils/userAccessHelper.js';

/**
 * POST /api/users
 * Admin/Super Admin endpoint to create a new user / customer organization.
 * Supports both Credit-Based and Days-Based user access types.
 */
export async function createUser(req, res) {
  try {
    const { 
      company_name, 
      owner_name, 
      full_name, 
      username, 
      password, 
      email, 
      phone, 
      role, 
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
    const userEmail = email ? email.trim() : `${userUsername}@officialwa.com`;
    const assignedRole = role || 'User';

    if (!userUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and Password are required'
      });
    }

    // Check duplicate email or username
    const [existing] = await pool.query(
      `SELECT id FROM users WHERE username = ? OR (email = ? AND email != '') LIMIT 1`,
      [userUsername, userEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A user with this username or email already exists' });
    }

    // Process Access Type (Credit Based vs Days Based)
    const userAccessType = access_type === 'days_based' ? 'days_based' : 'credit_based';
    let daysAllocatedVal = 0;
    let startDateVal = null;
    let expiryDateVal = null;
    let creditsVal = 0;

    if (userAccessType === 'days_based') {
      const numDays = parseInt(days_allocated, 10);
      if (isNaN(numDays) || numDays <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Number of days must be greater than 0 for Days-Based users.'
        });
      }
      daysAllocatedVal = numDays;
      startDateVal = start_date ? formatDateToYMD(start_date) : formatDateToYMD(new Date());
      expiryDateVal = expiry_date ? formatDateToYMD(expiry_date) : calculateExpiryDate(startDateVal, numDays);
      creditsVal = 0;
    } else {
      daysAllocatedVal = 0;
      startDateVal = null;
      expiryDateVal = null;
      creditsVal = Math.max(0, parseInt(credits || initial_credits || 0, 10) || 0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const modulesJson = Array.isArray(allowed_modules) ? JSON.stringify(allowed_modules) : null;

    let targetOrgId = null;
    let targetOrgName = '';

    const isStaffMember = (assignedRole === 'Staff');
    if (company_name || !req.organizationId || !isStaffMember) {
      const orgName = company_name || `${displayName}'s Enterprise`;
      const [orgRes] = await pool.query(
        `INSERT INTO organizations (organization_name, owner_user_id, status) VALUES (?, 0, 'Active')`,
        [orgName]
      );
      targetOrgId = orgRes.insertId;
      targetOrgName = orgName;
    } else {
      targetOrgId = req.organizationId;
      const [orgRows] = await pool.query(`SELECT organization_name FROM organizations WHERE id = ? LIMIT 1`, [targetOrgId]);
      if (orgRows.length > 0) {
        targetOrgName = orgRows[0].organization_name;
      }
    }

    // 1. Create User in users table
    // If creator is a Reseller, set created_by_user_id to their id for sub-user scoping
    const creatorId = req.user?.role === 'Reseller' ? (req.user?.id || null) : null;
    const [userRes] = await pool.query(
      `INSERT INTO users (
        full_name, name, email, username, password, plain_password, mobile, role, 
        access_type, days_allocated, days_used, start_date, expiry_date, credits,
        status, allowed_modules, organization_id, created_by_user_id, token_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'Active', ?, ?, ?, 1)`,
      [
        displayName, displayName, userEmail, userUsername, hashedPassword, password, phone || null, assignedRole,
        userAccessType, daysAllocatedVal, startDateVal, expiryDateVal, creditsVal,
        modulesJson, targetOrgId, creatorId
      ]
    );

    const newUserId = userRes.insertId;

    if (company_name) {
      await pool.query(`UPDATE organizations SET owner_user_id = ? WHERE id = ?`, [newUserId, targetOrgId]);
    }

    // 2. Assign Default Role Permissions
    try {
      const [roleRows] = await pool.query(
        `SELECT rp.permission_id 
         FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         WHERE r.name = ?`,
        [assignedRole]
      );

      for (const rp of roleRows) {
        await pool.query(
          `INSERT IGNORE INTO user_permissions (user_id, permission_id, allowed) VALUES (?, ?, 1)`,
          [newUserId, rp.permission_id]
        );
      }
    } catch (permErr) {
      console.warn('[UserController] Role permissions mapping warn:', permErr.message);
    }

    // 3. Provision default tenant data if new tenant org was created
    if (company_name) {
      try {
        await provisionDefaultTenantData(targetOrgId, newUserId);
      } catch (provErr) {
        console.warn('[UserController] Default tenant provisioning warn:', provErr.message);
      }
    }

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: targetOrgId,
      action: 'USER_CREATED',
      module: 'USERS',
      description: `Created new user "${userUsername}" (${assignedRole}, Access: ${userAccessType === 'days_based' ? `Days Based (${daysAllocatedVal}d)` : 'Credit Based'})`,
      metadata: { 
        newUserId, 
        username: userUsername, 
        role: assignedRole,
        access_type: userAccessType,
        days_allocated: daysAllocatedVal,
        start_date: startDateVal,
        expiry_date: expiryDateVal,
        credits: creditsVal
      }
    });

    const parsedModules = Array.isArray(allowed_modules) ? allowed_modules : null;
    const daysMetrics = calculateDaysMetrics({
      access_type: userAccessType,
      days_allocated: daysAllocatedVal,
      days_used: 0,
      start_date: startDateVal,
      expiry_date: expiryDateVal,
      status: 'Active'
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUserId,
        full_name: displayName,
        name: displayName,
        email: userEmail,
        username: userUsername,
        role: assignedRole,
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
        company_name: targetOrgName,
        phone: phone || '',
        allowed_modules: parsedModules
      }
    });

  } catch (err) {
    console.error('[UserController] Create user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create user', error: err.message });
  }
}

/**
 * GET /api/users
 * Returns list of users with summary stats.
 * Supports filtering by access_type ('credit_based', 'days_based', 'All').
 */
export async function getUsers(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const isReseller = req.user && req.user.role === 'Reseller';
    const orgId = req.organizationId || req.user?.organization_id;
    const { search, status, role, access_type } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id, 
             u.access_type, u.days_allocated, u.days_used, u.start_date, u.expiry_date, u.credits,
             u.allowed_modules, u.created_at, u.last_login_at, u.last_login_ip, u.password_changed_at, u.failed_login_attempts,
             u.created_by_user_id,
             o.organization_name
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
    `;
    const whereClauses = ['(u.is_team_member = 0 OR u.is_team_member IS NULL)', 'u.deleted_at IS NULL'];
    const params = [];

    const resellerFilter = req.query.reseller_id || req.query.created_by_user_id || req.headers['x-reseller-filter'];
    if (resellerFilter) {
      whereClauses.push(`u.created_by_user_id = ?`);
      params.push(resellerFilter);
    } else if (isReseller) {
      // Resellers only see their own created sub-users
      whereClauses.push(`u.created_by_user_id = ?`);
      params.push(req.user.id);
    } else if (!isSuperAdmin) {
      whereClauses.push(`u.organization_id = ?`);
      params.push(orgId || 0);
    }



    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(`(u.full_name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR u.mobile LIKE ?)`);
      params.push(term, term, term, term, term);
    }

    if (status && status !== 'All') {
      if (status === 'Expiring Soon' || status === 'Expired') {
        // Will be post-filtered or handled via days calculation
      } else {
        whereClauses.push(`u.status = ?`);
        params.push(status);
      }
    }

    if (role && role !== 'All') {
      whereClauses.push(`u.role = ?`);
      params.push(role);
    }

    if (access_type && access_type !== 'All') {
      if (access_type === 'days_based') {
        whereClauses.push(`u.access_type = 'days_based'`);
      } else if (access_type === 'credit_based') {
        whereClauses.push(`(u.access_type = 'credit_based' OR u.access_type IS NULL OR u.access_type = '')`);
      }
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY u.id DESC`;

    const [users] = await pool.query(query, params);

    // Compute summary metrics — Resellers see stats for their own sub-users only
    let statsQuery = `SELECT status, role, access_type, days_allocated, days_used, start_date, expiry_date, last_login_at FROM users WHERE (is_team_member = 0 OR is_team_member IS NULL) AND deleted_at IS NULL`;
    const statsParams = [];
    if (isReseller) {
      // Reseller: count only users they created
      statsQuery += ` AND created_by_user_id = ?`;
      statsParams.push(req.user.id);
    } else if (!isSuperAdmin) {
      statsQuery += ` AND organization_id = ?`;
      statsParams.push(orgId || 0);
    }
    const [allOrgUsers] = await pool.query(statsQuery, statsParams);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalUsers = allOrgUsers.length;
    const activeUsers = allOrgUsers.filter(u => u.status === 'Active').length;
    const disabledUsers = allOrgUsers.filter(u => u.status === 'Disabled' || u.status === 'Inactive').length;
    const adminUsers = allOrgUsers.filter(u => u.role === 'Admin' || u.role === 'Super Admin').length;
    const recentlyActiveUsers = allOrgUsers.filter(u => u.last_login_at && new Date(u.last_login_at) >= sevenDaysAgo).length;

    // Days-based specific summary counts
    let totalDaysUsers = 0;
    let activeDaysUsers = 0;
    let expiringSoonDaysUsers = 0;
    let expiredDaysUsers = 0;

    allOrgUsers.forEach(u => {
      if (u.access_type === 'days_based') {
        totalDaysUsers++;
        const metrics = calculateDaysMetrics(u);
        if (metrics.days_status === 'Active') activeDaysUsers++;
        else if (metrics.days_status === 'Expiring Soon') expiringSoonDaysUsers++;
        else if (metrics.days_status === 'Expired') expiredDaysUsers++;
      }
    });

    let formatted = users.map(u => {
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
        organization_name: u.organization_name || 'My Organization',
        allowed_modules: mods,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        last_login_ip: u.last_login_ip,
        password_changed_at: u.password_changed_at,
        failed_login_attempts: u.failed_login_attempts || 0,
        created_by_user_id: u.created_by_user_id
      };
    });

    // If query asked specifically for "Expiring Soon" or "Expired"
    if (status === 'Expiring Soon') {
      formatted = formatted.filter(u => u.days_status === 'Expiring Soon');
    } else if (status === 'Expired') {
      formatted = formatted.filter(u => u.days_status === 'Expired');
    }

    res.json({
      success: true,
      count: formatted.length,
      users: formatted,
      summary: {
        totalUsers,
        activeUsers,
        disabledUsers,
        adminUsers,
        recentlyActiveUsers,
        totalDaysUsers,
        activeDaysUsers,
        expiringSoonDaysUsers,
        expiredDaysUsers
      }
    });
  } catch (err) {
    console.error('[UserController] Get users error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
}

/**
 * GET /api/users/:id
 * Fetch single user details including security info & days/credit access metrics.
 */
export async function getUserDetails(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const isReseller = req.user && req.user.role === 'Reseller';
    const orgId = req.organizationId || req.user?.organization_id;
    const targetId = req.params.id;

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id, 
              u.access_type, u.days_allocated, u.days_used, u.start_date, u.expiry_date, u.credits,
              u.allowed_modules, u.created_at, u.last_login_at, u.last_login_ip, u.password_changed_at, u.failed_login_attempts,
              u.token_version, u.plain_password, u.created_by_user_id, o.organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ? LIMIT 1`,
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const u = rows[0];

    // Multi-tenant / ownership check
    if (isReseller) {
      if (u.created_by_user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access user not created by you.' });
      }
    } else if (!isSuperAdmin && u.organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot access user outside your organization.' });
    }

    let mods = null;
    if (u.allowed_modules) {
      try {
        mods = typeof u.allowed_modules === 'string' ? JSON.parse(u.allowed_modules) : u.allowed_modules;
      } catch (e) {}
    }

    const daysMetrics = calculateDaysMetrics(u);

    // Fetch recent activity
    const [recentActivity] = await pool.query(
      `SELECT * FROM user_activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`,
      [targetId]
    );

    return res.json({
      success: true,
      user: {
        id: u.id,
        full_name: u.full_name || u.name || u.username,
        email: u.email || '',
        phone: u.mobile || '',
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
        organization_name: u.organization_name || 'My Organization',
        allowed_modules: mods,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        last_login_ip: u.last_login_ip,
        password_changed_at: u.password_changed_at,
        plain_password: u.plain_password || null,
        failed_login_attempts: u.failed_login_attempts || 0,
        active_sessions: u.token_version ? 1 : 0
      },
      activity: recentActivity
    });
  } catch (err) {
    console.error('[UserController] Get user details error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
}

/**
 * PUT /api/users/:id
 * Updates user details, status, role, or switches Access Type (Credit Based <-> Days Based).
 */
export async function updateUser(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;
    const { 
      full_name, 
      name, 
      email, 
      phone, 
      mobile, 
      role, 
      status, 
      allowed_modules,
      access_type,
      days_allocated,
      start_date,
      expiry_date,
      credits
    } = req.body;

    const isReseller = req.user && req.user.role === 'Reseller';
    const [existing] = await pool.query(
      `SELECT id, username, role, access_type, days_allocated, start_date, expiry_date, credits, organization_id, created_by_user_id, token_version FROM users WHERE id = ? LIMIT 1`, 
      [userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const prevUser = existing[0];

    if (isReseller) {
      if (prevUser.created_by_user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot update user not created by you.' });
      }
    } else if (!isSuperAdmin && prevUser.organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot update user in another organization.' });
    }

    const updates = [];
    const params = [];

    const updatedName = full_name || name;
    if (updatedName) {
      updates.push('full_name = ?', 'name = ?');
      params.push(updatedName, updatedName);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email.trim());
    }
    const updatedPhone = phone || mobile;
    if (updatedPhone !== undefined) {
      updates.push('mobile = ?');
      params.push(updatedPhone);
    }
    if (role) {
      updates.push('role = ?');
      params.push(role);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'Disabled' || status === 'Inactive') {
        // Invalidate sessions on disable
        updates.push('token_version = token_version + 1');
      }
    }
    if (allowed_modules !== undefined) {
      const modulesJson = Array.isArray(allowed_modules) ? JSON.stringify(allowed_modules) : null;
      updates.push('allowed_modules = ?');
      params.push(modulesJson);
    }

    // Access Type & Days/Credit changes
    if (access_type) {
      const newAccessType = access_type === 'days_based' ? 'days_based' : 'credit_based';
      updates.push('access_type = ?');
      params.push(newAccessType);

      if (newAccessType === 'days_based') {
        const numDays = parseInt(days_allocated || prevUser.days_allocated || 30, 10);
        const startDateVal = start_date ? formatDateToYMD(start_date) : (prevUser.start_date ? formatDateToYMD(prevUser.start_date) : formatDateToYMD(new Date()));
        const expiryDateVal = expiry_date ? formatDateToYMD(expiry_date) : calculateExpiryDate(startDateVal, numDays);

        updates.push('days_allocated = ?');
        params.push(numDays > 0 ? numDays : 30);

        updates.push('start_date = ?');
        params.push(startDateVal);

        updates.push('expiry_date = ?');
        params.push(expiryDateVal);

        updates.push('credits = 0');
      } else {
        // Switching to credit based
        const numCredits = Math.max(0, parseInt(credits !== undefined ? credits : (prevUser.credits || 0), 10) || 0);
        updates.push('credits = ?');
        params.push(numCredits);

        updates.push('days_allocated = 0');
        updates.push('start_date = NULL');
        updates.push('expiry_date = NULL');
      }
    } else {
      // Access type not explicitly changed, but specific days or credit fields updated
      if (days_allocated !== undefined) {
        const numDays = parseInt(days_allocated, 10);
        if (!isNaN(numDays) && numDays > 0) {
          updates.push('days_allocated = ?');
          params.push(numDays);
        }
      }
      if (start_date !== undefined) {
        updates.push('start_date = ?');
        params.push(formatDateToYMD(start_date));
      }
      if (expiry_date !== undefined) {
        updates.push('expiry_date = ?');
        params.push(formatDateToYMD(expiry_date));
      }
      if (credits !== undefined) {
        updates.push('credits = ?');
        params.push(Math.max(0, parseInt(credits, 10) || 0));
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: prevUser.organization_id,
      action: 'USER_UPDATED',
      module: 'USERS',
      description: `Updated details / access model for user "${prevUser.username}"`,
      metadata: { targetUserId: userId, updates: req.body }
    });

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('[UserController] Update user error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
}

/**
 * POST /api/users/:id/extend-days
 * Admin endpoint to extend validity for a Days-Based user.
 */
export async function extendUserDays(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;
    const { daysToAdd, days, startDate } = req.body;

    const numDaysToAdd = parseInt(daysToAdd || days, 10);
    if (isNaN(numDaysToAdd) || numDaysToAdd <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Days to extend must be a positive integer greater than 0.'
      });
    }

    const [existing] = await pool.query(
      `SELECT id, username, role, status, access_type, days_allocated, start_date, expiry_date, organization_id FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = existing[0];

    if (!isSuperAdmin && user.organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify user in another organization.' });
    }

    const currentMetrics = calculateDaysMetrics(user);
    const now = new Date();
    const todayStr = formatDateToYMD(now);

    let newStartDate = user.start_date ? formatDateToYMD(user.start_date) : todayStr;
    let newExpiryDate = null;
    let newTotalDays = Number(user.days_allocated || 0) + numDaysToAdd;

    // Intelligent Extension Logic:
    // If user is currently active with future expiry date, extend FROM current expiry date.
    // If user is expired, start from today (or provided custom startDate).
    if (!currentMetrics.is_expired && user.expiry_date) {
      const expDate = new Date(user.expiry_date);
      expDate.setDate(expDate.getDate() + numDaysToAdd);
      newExpiryDate = formatDateToYMD(expDate);
    } else {
      newStartDate = startDate ? formatDateToYMD(startDate) : todayStr;
      newExpiryDate = calculateExpiryDate(newStartDate, numDaysToAdd);
      newTotalDays = numDaysToAdd;
    }

    await pool.query(
      `UPDATE users SET 
        access_type = 'days_based', 
        days_allocated = ?, 
        start_date = ?, 
        expiry_date = ? 
       WHERE id = ?`,
      [newTotalDays, newStartDate, newExpiryDate, userId]
    );

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: user.organization_id,
      action: 'DAYS_EXTENDED',
      module: 'USERS',
      description: `Extended +${numDaysToAdd} days for user "${user.username}". New expiry: ${newExpiryDate}`,
      metadata: { targetUserId: userId, addedDays: numDaysToAdd, newExpiryDate, newTotalDays }
    });

    const updatedMetrics = calculateDaysMetrics({
      access_type: 'days_based',
      days_allocated: newTotalDays,
      days_used: user.days_used || 0,
      start_date: newStartDate,
      expiry_date: newExpiryDate,
      status: user.status
    });

    return res.json({
      success: true,
      message: `Successfully added ${numDaysToAdd} days. New expiry date is ${newExpiryDate}.`,
      user: {
        id: user.id,
        username: user.username,
        access_type: 'days_based',
        days_allocated: newTotalDays,
        start_date: newStartDate,
        expiry_date: newExpiryDate,
        remaining_days: updatedMetrics.remaining_days,
        days_status: updatedMetrics.days_status
      }
    });

  } catch (err) {
    console.error('[UserController] Extend days error:', err);
    return res.status(500).json({ success: false, message: 'Failed to extend days', error: err.message });
  }
}

/**
 * PATCH /api/users/:id/status
 * Enable / Disable a user account.
 */
export async function toggleUserStatus(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const isReseller = req.user && req.user.role === 'Reseller';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;
    const { status } = req.body;

    const [existing] = await pool.query(`SELECT id, username, status, organization_id, created_by_user_id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (isReseller) {
      if (existing[0].created_by_user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify user not created by you.' });
      }
    } else if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify user in another organization.' });
    }

    // Determine target status
    let nextStatus = status;
    if (!nextStatus) {
      nextStatus = (existing[0].status === 'Active') ? 'Disabled' : 'Active';
    }

    // If disabling, increment token_version to immediately revoke all active JWT tokens
    if (nextStatus === 'Disabled' || nextStatus === 'Inactive') {
      await pool.query(`UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?`, [nextStatus, userId]);
      await logUserActivity(req, {
        userId: req.user?.id,
        organizationId: existing[0].organization_id,
        action: 'ACCOUNT_DISABLED',
        module: 'USERS',
        description: `Disabled account for user "${existing[0].username}"`,
        metadata: { targetUserId: userId }
      });
    } else {
      await pool.query(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, userId]);
      await logUserActivity(req, {
        userId: req.user?.id,
        organizationId: existing[0].organization_id,
        action: 'ACCOUNT_ENABLED',
        module: 'USERS',
        description: `Enabled account for user "${existing[0].username}"`,
        metadata: { targetUserId: userId }
      });
    }

    return res.json({
      success: true,
      message: `User status set to ${nextStatus}`,
      status: nextStatus
    });
  } catch (err) {
    console.error('[UserController] Toggle status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
}

/**
 * POST /api/users/:id/reset-password
 * Admin resets a user's password securely.
 */
export async function resetUserPassword(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const isReseller = req.user && req.user.role === 'Reseller';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;
    let { password } = req.body;

    const [existing] = await pool.query(`SELECT id, username, organization_id, created_by_user_id, token_version FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (isReseller) {
      if (existing[0].created_by_user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot reset password for user not created by you.' });
      }
    } else if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot reset password for user in another organization.' });
    }

    // If no password provided, auto-generate a secure random temporary password
    if (!password || password.trim().length === 0) {
      password = 'WA_' + crypto.randomBytes(4).toString('hex') + '!';
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextTokenVersion = (existing[0].token_version || 1) + 1;

    await pool.query(
      `UPDATE users SET password = ?, plain_password = ?, password_changed_at = NOW(), token_version = ? WHERE id = ?`,
      [hashedPassword, password, nextTokenVersion, userId]
    );

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'PASSWORD_RESET',
      module: 'USERS',
      description: `Admin reset password for user "${existing[0].username}"`,
      metadata: { targetUserId: userId }
    });

    return res.json({
      success: true,
      message: 'Password reset successfully.',
      temporaryPassword: password
    });
  } catch (err) {
    console.error('[UserController] Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
}

/**
 * POST /api/users/:id/logout-all
 * Invalidate all active sessions for a user by incrementing token_version.
 */
export async function logoutAllSessions(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;

    const [existing] = await pool.query(`SELECT id, username, organization_id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot revoke sessions for user in another organization.' });
    }

    await pool.query(`UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?`, [userId]);

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'SESSION_REVOKED',
      module: 'USERS',
      description: `Admin revoked all active sessions for user "${existing[0].username}"`,
      metadata: { targetUserId: userId }
    });

    return res.json({
      success: true,
      message: 'All active sessions for this user have been terminated.'
    });
  } catch (err) {
    console.error('[UserController] Logout all sessions error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke sessions' });
  }
}

/**
 * GET /api/users/:id/activity
 * Get activity audit logs for a specific user.
 */
export async function getUserActivity(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;

    const logs = await getUserActivityLogs({
      organizationId: orgId,
      userId,
      limit: req.query.limit || 50,
      offset: req.query.offset || 0,
      isSuperAdmin
    });

    return res.json({
      success: true,
      count: logs.length,
      activity: logs
    });
  } catch (err) {
    console.error('[UserController] Get user activity error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user activity' });
  }
}

/**
 * GET /api/users/activity/all
 * Get all organization audit activity logs.
 */
export async function getAllActivity(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id;

    const logs = await getUserActivityLogs({
      organizationId: orgId,
      action: req.query.action,
      module: req.query.module,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0,
      isSuperAdmin
    });

    return res.json({
      success: true,
      count: logs.length,
      activity: logs
    });
  } catch (err) {
    console.error('[UserController] Get all activity error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
}

/**
 * DELETE /api/users/:id
 */
export async function deleteUser(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const isReseller = req.user && req.user.role === 'Reseller';
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.params.id;

    if (req.user && req.user.id == userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const [existing] = await pool.query(`SELECT id, username, organization_id, created_by_user_id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (isReseller) {
      if (existing[0].created_by_user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete user not created by you.' });
      }
    } else if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete user in another organization.' });
    }

    // Clean up dependent records safely
    await pool.query(`UPDATE users SET created_by_user_id = NULL WHERE created_by_user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM user_activity_logs WHERE user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM audit_logs WHERE user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM user_feature_credits WHERE user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM credit_transactions WHERE user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM mobile_device_tokens WHERE user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM catalogs WHERE user_id = ?`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM team_members WHERE user_id = ? OR created_by_user_id = ?`, [userId, userId]).catch(() => {});
    await pool.query(`DELETE FROM whatsapp_templates WHERE user_id = ?`, [userId]).catch(() => {});

    await pool.query(`DELETE FROM users WHERE id = ?`, [userId]);

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'USER_DELETED',
      module: 'USERS',
      description: `Deleted user "${existing[0].username}"`,
      metadata: { deletedUserId: userId }
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[UserController] Delete user error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
}
