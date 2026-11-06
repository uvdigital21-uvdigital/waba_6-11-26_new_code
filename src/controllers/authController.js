import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { logActivity } from '../services/agentActivityLogger.js';
import { logUserActivity } from '../services/userActivityService.js';
import { provisionDefaultTenantData } from '../services/tenantProvisioningService.js';

dotenv.config();

const getDeviceId = req => String(req.headers['x-device-id'] || req.body?.deviceId || '').trim().slice(0, 128);
const getClientIp = req => String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64);
const getDeviceName = req => String(req.body?.deviceName || req.headers['user-agent'] || 'Unknown device').slice(0, 255);

async function createLoginSession(req, userId, principalType = 'user') {
  const deviceId = getDeviceId(req) || crypto.randomUUID();
  const [blocked] = await pool.query(
    `SELECT id FROM blocked_login_devices WHERE user_id = ? AND principal_type = ? AND device_id = ? LIMIT 1`,
    [userId, principalType, deviceId]
  );
  if (blocked.length) return { blocked: true };

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [knownDevices] = await pool.query(
    `SELECT device_name FROM user_sessions WHERE user_id = ? AND principal_type = ? AND device_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId, principalType, deviceId]
  );
  const deviceName = knownDevices[0]?.device_name || getDeviceName(req);
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, principal_type, device_id, device_name, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, principalType, deviceId, deviceName, req.headers['user-agent'] || null, getClientIp(req), expiresAt]
  );
  return { sessionId, deviceId };
}

/**
 * Helper to fetch permissions for a user based on role and user_permissions overrides.
 * @param {number} userId 
 * @param {string} userRole 
 */
 
 /**
 * Helper to calculate days-based access metrics for a user.
 * @param {object} user - user row containing days_allocated, days_used, start_date, expiry_date
 */
function calculateDaysMetrics(user) {
  const daysAllocated = user.days_allocated || 0;
  const daysUsed = user.days_used || 0;
  const startDate = user.start_date || null;
  const expiryDate = user.expiry_date || null;

  let remainingDays = null;
  let isExpired = false;
  let daysStatus = 'active';

  if (expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      isExpired = true;
      daysStatus = 'expired';
      remainingDays = 0;
    } else if (remainingDays <= 7) {
      daysStatus = 'expiring_soon';
    }
  } else if (daysAllocated > 0) {
    remainingDays = Math.max(daysAllocated - daysUsed, 0);
    if (remainingDays <= 0) {
      isExpired = true;
      daysStatus = 'expired';
    } else if (remainingDays <= 7) {
      daysStatus = 'expiring_soon';
    }
  }

  return {
    days_allocated: daysAllocated,
    days_used: daysUsed,
    start_date: startDate,
    expiry_date: expiryDate,
    remaining_days: remainingDays,
    days_status: daysStatus,
    is_expired: isExpired
  };
}
 
 
 
async function getUserPermissionsList(userId, userRole) {
  try {
    if (userRole === 'Super Admin') {
      const [allPerms] = await pool.query(`SELECT slug FROM permissions`);
      return allPerms.map(p => p.slug);
    }

    // Role permissions
    const [rolePerms] = await pool.query(
      `SELECT p.slug 
       FROM role_permissions rp 
       JOIN permissions p ON p.id = rp.permission_id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = ?`,
      [userRole]
    );
    let permSet = new Set(rolePerms.map(p => p.slug));

    // Custom user permissions overrides
    const [userPerms] = await pool.query(
      `SELECT p.slug, up.allowed 
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [userId]
    );

    for (const up of userPerms) {
      if (up.allowed === 1) {
        permSet.add(up.slug);
      } else {
        permSet.delete(up.slug);
      }
    }

    return Array.from(permSet);
  } catch (err) {
    console.error('[Auth] Error fetching user permissions:', err);
    return [];
  }
}

/**
 * POST /api/auth/login
 * Authenticates users using username or email and password from MySQL database.
 */
export async function login(req, res) {
  try {
    const inputIdentifier = (req.body.username || req.body.email || '').trim();
    const password = req.body.password;

    if (!inputIdentifier || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required' });
    }

    // 1. Check USERS table first
    const [userRows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.username, u.password, u.role, u.status, 
              u.organization_id, u.is_team_member, u.created_by_user_id, u.permissions,
              u.app_name, u.app_logo, u.allowed_modules, u.token_version, o.organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.username = ? OR u.email = ? LIMIT 1`,
      [inputIdentifier, inputIdentifier]
    );

    if (userRows.length > 0) {
      const user = userRows[0];

      if (user.status === 'Inactive' || user.status === 'Disabled') {
        await logUserActivity(req, {
          userId: user.id,
          organizationId: user.organization_id,
          action: 'FAILED_LOGIN',
          module: 'AUTH',
          description: `Login attempt on disabled account "${user.username}"`,
          status: 'FAILED'
        });
        return res.status(403).json({ message: 'Your account has been disabled. Please contact your administrator.' });
      }

      let isMatch = false;
      if (user.password) {
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(password, user.password);
        } else {
          isMatch = user.password === password; // Plaintext fallback
          if (isMatch) {
            // Hash and update
            const newHash = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
          }
        }
      }

      if (!isMatch) {
        // Increment failed attempts
        await pool.query(`UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = ?`, [user.id]);
        await logUserActivity(req, {
          userId: user.id,
          organizationId: user.organization_id,
          action: 'FAILED_LOGIN',
          module: 'AUTH',
          description: `Invalid password attempt for user "${user.username}"`,
          status: 'FAILED'
        });
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Successful login updates
      const currentTokenVersion = user.token_version || 1;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
      await pool.query(
        `UPDATE users SET failed_login_attempts = 0, last_login_at = NOW(), last_login_ip = ? WHERE id = ?`,
        [clientIp, user.id]
      );

      await logUserActivity(req, {
        userId: user.id,
        organizationId: user.organization_id,
        action: 'LOGIN',
        module: 'AUTH',
        description: `User "${user.username}" logged in successfully`,
        status: 'SUCCESS'
      });

      // Fetch user permissions
      let permissions = [];
      if (user.is_team_member && user.permissions) {
        try {
          permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
        } catch (e) {
          permissions = [];
        }
      }
      if (!permissions || permissions.length === 0) {
        permissions = await getUserPermissionsList(user.id, user.role);
      }

      let parsedModules = null;
      if (user.allowed_modules) {
        try {
          parsedModules = typeof user.allowed_modules === 'string' ? JSON.parse(user.allowed_modules) : user.allowed_modules;
        } catch (e) {}
      }
      if (user.is_team_member && (!parsedModules || parsedModules.length === 0)) {
        parsedModules = permissions;
      }

      const tokenPayload = {
        id: user.id,
        full_name: user.full_name,
        name: user.full_name,
        email: user.email,
        mobile: user.mobile || '',
        username: user.username,
        role: user.role,
        status: user.status,
        is_team_member: Boolean(user.is_team_member),
        created_by_user_id: user.created_by_user_id || null,
        organization_id: user.organization_id,
        organization_name: user.organization_name || 'My Organization',
        app_name: user.app_name || 'OfficialWA',
        app_logo: user.app_logo || null,
        token_version: currentTokenVersion,
        permissions,
        allowed_modules: parsedModules
      };

      const loginSession = await createLoginSession(req, user.id, 'user');
      if (loginSession.blocked) {
        return res.status(403).json({ message: 'This device has been permanently blocked by the administrator.', code: 'DEVICE_BLOCKED' });
      }
      tokenPayload.session_id = loginSession.sessionId;
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'wa_secret_key_2026',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      return res.json({
        success: true,
        token,
        user: tokenPayload
      });
    }

    // 2. Fallback check AGENTS table
    const [agentRows] = await pool.query(
      `SELECT id, agent_id, name, email, password_hash, password, mobile, profile_image, role, status, organization_id 
       FROM agents WHERE email = ? OR agent_id = ? OR mobile = ? LIMIT 1`,
      [inputIdentifier, inputIdentifier, inputIdentifier]
    );

    if (agentRows.length > 0) {
      const agent = agentRows[0];

      if (agent.status === 'Inactive') {
        return res.status(403).json({ message: 'Account is inactive.' });
      }

      let isMatch = false;
      if (agent.password_hash) {
        isMatch = await bcrypt.compare(password, agent.password_hash);
      }
      if (!isMatch && agent.password && agent.password === password) {
        isMatch = true;
      }

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const mappedRole = agent.role === 'Admin' ? 'Admin' : 'Staff';
      const permissions = await getUserPermissionsList(agent.id, mappedRole);

      const tokenPayload = {
        id: agent.id,
        principal_type: 'agent',
        agent_id: agent.agent_id,
        full_name: agent.name,
        name: agent.name,
        email: agent.email,
        username: agent.email,
        role: mappedRole,
        status: agent.status,
        organization_id: agent.organization_id || 1,
        permissions
      };

      const loginSession = await createLoginSession(req, agent.id, 'agent');
      if (loginSession.blocked) {
        return res.status(403).json({ message: 'This device has been permanently blocked by the administrator.', code: 'DEVICE_BLOCKED' });
      }
      tokenPayload.session_id = loginSession.sessionId;
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'wa_secret_key_2026',
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token,
        user: tokenPayload
      });
    }

    return res.status(401).json({ message: 'Invalid username or password' });

  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ message: 'Server error during login', error: err.message });
  }
}

/**
 * GET /api/auth/me
 * Returns authenticated user info & organization details.
 */
export async function getMe(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const [userRows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id, u.app_name, u.app_logo, u.allowed_modules, u.permissions, u.token_version, u.access_type, u.days_allocated, u.days_used, u.start_date, u.expiry_date, u.credits, u.is_team_member, u.created_by_user_id, o.organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      [req.user.id]
    );

    if (userRows.length > 0) {
      const user = userRows[0];
      if (user.status === 'Disabled' || user.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          code: 'ACCESS_REVOKED',
          message: 'Your account has been disabled. Please contact your administrator.'
        });
      }

      let permissions = [];
      if (user.permissions) {
        try {
          permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
        } catch (e) {}
      }
      if (!permissions || permissions.length === 0) {
        permissions = await getUserPermissionsList(user.id, user.role);
      }

      let parsedModules = null;
      if (user.allowed_modules) {
        try {
          parsedModules = typeof user.allowed_modules === 'string' ? JSON.parse(user.allowed_modules) : user.allowed_modules;
        } catch (e) {}
      }

      let daysMetrics = null;
      if (user.access_type === 'days_based') {
        daysMetrics = calculateDaysMetrics(user);
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.full_name,
          full_name: user.full_name,
          email: user.email,
          mobile: user.mobile || '',
          username: user.username,
          role: user.role,
          type: user.is_team_member ? 'team_member' : 'owner',
          is_team_member: Boolean(user.is_team_member),
          created_by_user_id: user.created_by_user_id || null,
          status: user.status,
          organization_id: user.organization_id,
          organization_name: user.organization_name || 'My Organization',
          app_name: user.app_name || 'OfficialWA',
          app_logo: user.app_logo || null,
          permissions,
          token_version: user.token_version || 1,
          allowed_modules: parsedModules,
          access_type: user.access_type || 'credit_based',
          is_days_based: user.access_type === 'days_based',
          days_allocated: daysMetrics?.days_allocated || user.days_allocated,
          days_used: daysMetrics?.days_used || user.days_used,
          start_date: daysMetrics?.start_date || user.start_date,
          expiry_date: daysMetrics?.expiry_date || user.expiry_date,
          remaining_days: daysMetrics?.remaining_days ?? null,
          days_status: daysMetrics?.days_status || null,
          is_expired: daysMetrics?.is_expired || false,
          credits: user.credits || 0
        }
      });
    }

    return res.json({ success: true, user: req.user });
  } catch (err) {
    console.error('[GetMe] Error:', err);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
}

/**
 * PUT /api/auth/profile
 * Updates authenticated user profile details (Name, Email, Mobile, App Name, App Logo) in DB.
 */
export async function updateProfile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { name, full_name, email, mobile, app_name, app_logo } = req.body;
    const updatedName = (full_name || name || '').trim();
    const updatedEmail = (email || '').trim();
    const updatedMobile = (mobile || '').trim();
    const updatedAppName = (app_name || '').trim();

    let uploadedLogo = null;
    if (req.file) {
      uploadedLogo = `/uploads/branding/${req.file.filename}`;
    } else if (app_logo) {
      uploadedLogo = app_logo;
    }

    const updates = [];
    const params = [];

    if (updatedName) {
      updates.push('full_name = ?');
      params.push(updatedName);
    }
    if (updatedEmail) {
      updates.push('email = ?');
      params.push(updatedEmail);
    }
    if (updatedMobile !== undefined) {
      updates.push('mobile = ?');
      params.push(updatedMobile);
    }
    if (updatedAppName) {
      updates.push('app_name = ?');
      params.push(updatedAppName);
    }
    if (uploadedLogo !== null) {
      updates.push('app_logo = ?');
      params.push(uploadedLogo);
    }

    if (updates.length > 0) {
      params.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Also update organization app_name/logo if user is owner/admin
    const orgId = req.user.organization_id || 1;
    if (updatedAppName || uploadedLogo) {
      const orgUpdates = [];
      const orgParams = [];
      if (updatedAppName) {
        orgUpdates.push('organization_name = ?', 'app_name = ?');
        orgParams.push(updatedAppName, updatedAppName);
      }
      if (uploadedLogo) {
        orgUpdates.push('logo_url = ?');
        orgParams.push(uploadedLogo);
      }
      if (orgUpdates.length > 0) {
        orgParams.push(orgId);
        await pool.query(`UPDATE organizations SET ${orgUpdates.join(', ')} WHERE id = ?`, orgParams).catch(() => {});
      }
    }

    // Fetch updated user
    const [uRows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.username, u.role, u.status, u.organization_id, u.app_name, u.app_logo, u.allowed_modules, o.organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    const freshUser = uRows[0] || {};
    const permissions = await getUserPermissionsList(userId, freshUser.role || 'Admin');

    const updatedUserObj = {
      id: freshUser.id || userId,
      full_name: freshUser.full_name || updatedName || req.user.full_name,
      name: freshUser.full_name || updatedName || req.user.name,
      email: freshUser.email || updatedEmail || req.user.email,
      mobile: freshUser.mobile || updatedMobile || req.user.mobile || '',
      username: freshUser.username || req.user.username,
      role: freshUser.role || req.user.role,
      status: freshUser.status || req.user.status,
      organization_id: freshUser.organization_id || orgId,
      organization_name: freshUser.organization_name || updatedAppName || 'My Organization',
      app_name: freshUser.app_name || updatedAppName || 'OfficialWA',
      app_logo: freshUser.app_logo || uploadedLogo || null,
      permissions
    };

    return res.json({
      success: true,
      message: 'Profile and branding details updated successfully!',
      user: updatedUserObj
    });
  } catch (err) {
    console.error('[UpdateProfile] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile details', error: err.message });
  }
}

/**
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { full_name, name, email, username, password, company_name } = req.body;

    const displayName = full_name || name;
    const userEmail = email ? email.trim() : '';
    const userUsername = (username || userEmail.split('@')[0] || `user_${Date.now()}`).trim();

    if (!displayName || !userEmail || !password) {
      return res.status(400).json({ message: 'Full name, email and password are required' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR username = ?', [userEmail, userUsername]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User first
    const [userRes] = await pool.query(
      `INSERT INTO users (full_name, email, username, password, role, status) VALUES (?, ?, ?, ?, 'Admin', 'Active')`,
      [displayName, userEmail, userUsername, hashedPassword]
    );

    const newUserId = userRes.insertId;

    // Create Organization
    const orgName = company_name || `${displayName}'s Organization`;
    const [orgRes] = await pool.query(
      `INSERT INTO organizations (organization_name, owner_user_id, status) VALUES (?, ?, 'Active')`,
      [orgName, newUserId]
    );

    const newOrgId = orgRes.insertId;

    // Link user to organization
    await pool.query(`UPDATE users SET organization_id = ? WHERE id = ?`, [newOrgId, newUserId]);

    // Provision default tenant data
    await provisionDefaultTenantData(newOrgId, newUserId);

    const permissions = await getUserPermissionsList(newUserId, 'Admin');

    const tokenPayload = {
      id: newUserId,
      full_name: displayName,
      name: displayName,
      email: userEmail,
      username: userUsername,
      role: 'Admin',
      status: 'Active',
      organization_id: newOrgId,
      organization_name: orgName,
      permissions
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'wa_secret_key_2026',
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account and organization created successfully',
      token,
      user: tokenPayload
    });

  } catch (err) {
    console.error('[Register] Error:', err);
    res.status(500).json({ message: 'Server error during registration', error: err.message });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  if (req.user?.session_id) {
    await pool.query(`UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = ?`, [req.user.session_id]);
  }
  if (req.user?.id) {
    await logUserActivity(req, {
      userId: req.user.id,
      organizationId: req.organizationId || req.user.organization_id,
      action: 'LOGOUT',
      module: 'AUTH',
      description: `User logged out`,
      status: 'SUCCESS'
    });
  }
  res.json({ success: true, message: 'Logged out successfully' });
}

/**
 * POST /api/auth/change-password
 * Authenticated endpoint to change current user's password securely.
 */
export async function changePassword(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in again.' });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from current password.' });
    }

    // 1. Fetch current password from users table
    const [userRows] = await pool.query(
      `SELECT id, password, username, email, full_name, role, status, organization_id, token_version FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (userRows.length > 0) {
      const user = userRows[0];

      let isMatch = false;
      if (user.password) {
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(currentPassword, user.password);
        } else {
          isMatch = user.password === currentPassword;
        }
      }

      if (!isMatch) {
        await logUserActivity(req, {
          userId: user.id,
          organizationId: user.organization_id,
          action: 'PASSWORD_CHANGE_FAILED',
          module: 'AUTH',
          description: `Failed password change attempt: Incorrect current password for user "${user.username}"`,
          status: 'FAILED'
        });
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      // Hash new password
      const newHashedPassword = await bcrypt.hash(newPassword, 10);

      // Store only the password hash and revoke every existing login.
      await pool.query(
        `UPDATE users SET password = ?, password_changed_at = NOW(), token_version = COALESCE(token_version, 1) + 1 WHERE id = ?`,
        [newHashedPassword, user.id]
      );
      await pool.query(`UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = ? AND principal_type = 'user'`, [user.id]);

      await logUserActivity(req, {
        userId: user.id,
        organizationId: user.organization_id,
        action: 'PASSWORD_CHANGED',
        module: 'AUTH',
        description: `User "${user.username}" changed their password`,
        status: 'SUCCESS'
      });

      // Add notification record for admin
      try {
        await pool.query(
          `INSERT INTO whatsapp_notifications (title, message, type, is_read, created_at)
           VALUES (?, ?, 'info', 0, NOW())`,
          [
            `User Password Changed`,
            `User "${user.username}" (${user.email || user.full_name}) changed their password.`
          ]
        );
      } catch (notifErr) {
        /* ignore if notifications schema differs */
      }

      return res.json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
      });
    }

    // 2. Fallback check AGENTS table
    const [agentRows] = await pool.query(
      `SELECT id, agent_id, name, email, password_hash, password, organization_id FROM agents WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (agentRows.length > 0) {
      const agent = agentRows[0];
      let isMatch = false;
      if (agent.password_hash) {
        isMatch = await bcrypt.compare(currentPassword, agent.password_hash);
      } else if (agent.password) {
        isMatch = agent.password === currentPassword;
      }

      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const newHashed = await bcrypt.hash(newPassword, 10);
      await pool.query(
        `UPDATE agents SET password_hash = ?, password = ? WHERE id = ?`,
        [newHashed, newPassword, agent.id]
      );

      return res.json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
      });
    }

    return res.status(404).json({ success: false, message: 'User not found.' });

  } catch (err) {
    console.error('[ChangePassword] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password. Please try again.' });
  }
}

export async function listSessions(req, res) {
  const [rows] = await pool.query(
    `SELECT id, device_id, device_name, user_agent, ip_address, created_at, last_seen_at, expires_at,
            revoked_at, blocked_at
     FROM user_sessions
     WHERE user_id = ? AND principal_type = 'user' AND (expires_at > NOW() OR blocked_at IS NOT NULL)
     ORDER BY last_seen_at DESC`,
    [req.user.id]
  );
  const sessions = rows.map(row => ({
    ...row,
    is_current: row.id === req.user.session_id,
    status: row.blocked_at ? 'Blocked' : row.revoked_at ? 'Logged out' : 'Active'
  }));
  res.json({ success: true, active_count: sessions.filter(s => s.status === 'Active').length, sessions });
}

export async function revokeSession(req, res) {
  const [result] = await pool.query(
    `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = ? AND user_id = ? AND principal_type = 'user'`,
    [req.params.sessionId, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Session not found.' });
  res.json({ success: true, message: 'System logged out successfully.' });
}

export async function blockSessionDevice(req, res) {
  const [rows] = await pool.query(
    `SELECT device_id, device_name FROM user_sessions WHERE id = ? AND user_id = ? AND principal_type = 'user' LIMIT 1`,
    [req.params.sessionId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Session not found.' });
  const session = rows[0];
  await pool.query(
    `INSERT INTO blocked_login_devices (user_id, principal_type, device_id, device_name, blocked_by)
     VALUES (?, 'user', ?, ?, ?) ON DUPLICATE KEY UPDATE blocked_at = NOW(), blocked_by = VALUES(blocked_by)`,
    [req.user.id, session.device_id, session.device_name, req.user.id]
  );
  await pool.query(
    `UPDATE user_sessions SET blocked_at = COALESCE(blocked_at, NOW()), revoked_at = COALESCE(revoked_at, NOW())
     WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
    [req.user.id, session.device_id]
  );
  res.json({ success: true, message: 'Device permanently blocked and logged out.' });
}

export async function unblockSessionDevice(req, res) {
  const [rows] = await pool.query(
    `SELECT device_id FROM user_sessions WHERE id = ? AND user_id = ? AND principal_type = 'user' LIMIT 1`,
    [req.params.sessionId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Device not found.' });

  await pool.query(
    `DELETE FROM blocked_login_devices WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
    [req.user.id, rows[0].device_id]
  );
  await pool.query(
    `UPDATE user_sessions SET blocked_at = NULL WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
    [req.user.id, rows[0].device_id]
  );
  res.json({ success: true, message: 'Device unblocked. It can log in again.' });
}

export async function renameSessionDevice(req, res) {
  const deviceName = String(req.body?.deviceName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (deviceName.length < 2) {
    return res.status(400).json({ success: false, message: 'Device name must contain at least 2 characters.' });
  }
  const [rows] = await pool.query(
    `SELECT device_id FROM user_sessions WHERE id = ? AND user_id = ? AND principal_type = 'user' LIMIT 1`,
    [req.params.sessionId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Device not found.' });

  await pool.query(
    `UPDATE user_sessions SET device_name = ? WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
    [deviceName, req.user.id, rows[0].device_id]
  );
  await pool.query(
    `UPDATE blocked_login_devices SET device_name = ? WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
    [deviceName, req.user.id, rows[0].device_id]
  );
  res.json({ success: true, message: 'Device renamed successfully.', device_name: deviceName });
}

export async function deleteSession(req, res) {
  const [rows] = await pool.query(
    `SELECT id, device_id, blocked_at FROM user_sessions
     WHERE id = ? AND user_id = ? AND principal_type = 'user' LIMIT 1`,
    [req.params.sessionId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Session not found.' });

  const session = rows[0];
  if (session.blocked_at) {
    await pool.query(
      `DELETE FROM blocked_login_devices WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
      [req.user.id, session.device_id]
    );
    await pool.query(
      `UPDATE user_sessions SET blocked_at = NULL WHERE user_id = ? AND principal_type = 'user' AND device_id = ?`,
      [req.user.id, session.device_id]
    );
  }
  await pool.query(`DELETE FROM user_sessions WHERE id = ? AND user_id = ? AND principal_type = 'user'`, [session.id, req.user.id]);
  res.json({ success: true, message: session.blocked_at ? 'Session deleted and device block removed.' : 'Session deleted successfully.' });
}
