import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { recordAuditLog, getAuditLogs } from '../services/auditLogService.js';

/**
 * Standard default permissions mapping for role presets.
 */
export const ROLE_DEFAULT_PERMISSIONS = {
  Admin: [
    'dashboard.view',
    'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.delete', 'campaigns.send',
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete', 'contacts.import', 'contacts.export',
    'templates.view', 'templates.create', 'templates.edit', 'templates.delete',
    'inbox.view', 'inbox.reply',
    'reports.view', 'reports.export',
    'whatsapp_numbers.view', 'whatsapp_numbers.manage',
    'meta_billing.view', 'meta_billing.refresh',
    'settings.view', 'settings.manage',
    'team_members.view', 'team_members.create', 'team_members.edit', 'team_members.disable', 'team_members.delete',
    'audit_logs.view'
  ],
  Marketing: [
    'dashboard.view',
    'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.send',
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.import', 'contacts.export',
    'templates.view', 'templates.create', 'templates.edit',
    'inbox.view', 'inbox.reply',
    'reports.view',
    'whatsapp_numbers.view',
    'meta_billing.view'
  ],
  Sales: [
    'dashboard.view',
    'campaigns.view',
    'contacts.view', 'contacts.create', 'contacts.edit',
    'inbox.view', 'inbox.reply',
    'templates.view',
    'reports.view'
  ],
  Support: [
    'dashboard.view',
    'contacts.view',
    'inbox.view', 'inbox.reply',
    'templates.view',
    'reports.view'
  ],
  Custom: [
    'dashboard.view'
  ]
};

/**
 * GET /api/team-members
 * Fetch ONLY team members created under this main account / organization.
 * NEVER returns the Owner or unrelated application users from the users table.
 */
export async function getTeamMembers(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authUserId = req.user?.id || 1;
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const { search, status, role, scope = 'all', creator_user_id, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT tm.id, tm.organization_id, tm.created_by_user_id, tm.full_name, tm.username, tm.email, tm.phone,
             tm.role, tm.status, tm.permissions, tm.permissions_version, tm.created_at, tm.last_login_at,
             tm.last_login_ip, tm.last_activity_at, tm.failed_login_attempts,
             o.organization_name,
             u.username AS creator_username,
             COALESCE(u.full_name, u.name, u.username, 'Admin') AS creator_name,
             u.role AS creator_role
      FROM team_members tm
      LEFT JOIN organizations o ON o.id = tm.organization_id
      LEFT JOIN users u ON u.id = tm.created_by_user_id
    `;

    const whereClauses = ['tm.deleted_at IS NULL'];
    const params = [];

    if (!isSuperAdmin) {
      whereClauses.push(`tm.organization_id = ?`);
      params.push(orgId);
    }

    // Filter by specific creator
    if (creator_user_id && creator_user_id !== 'all') {
      whereClauses.push(`tm.created_by_user_id = ?`);
      params.push(parseInt(creator_user_id, 10));
    } else if (scope === 'admin' || scope === 'my') {
      // Members created by Admin / Super Admin (or current admin)
      whereClauses.push(`(tm.created_by_user_id = ? OR u.role IN ('Super Admin', 'Admin') OR u.username = 'admin')`);
      params.push(authUserId);
    } else if (scope === 'users' || scope === 'client') {
      // Members created by regular users / client accounts
      whereClauses.push(`(tm.created_by_user_id != ? AND u.role NOT IN ('Super Admin', 'Admin') AND (u.username != 'admin' OR u.username IS NULL))`);
      params.push(authUserId);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(`(tm.full_name LIKE ? OR tm.username LIKE ? OR tm.email LIKE ? OR tm.phone LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)`);
      params.push(term, term, term, term, term, term);
    }

    if (status && status !== 'All') {
      whereClauses.push(`tm.status = ?`);
      params.push(status);
    }

    if (role && role !== 'All') {
      whereClauses.push(`tm.role = ?`);
      params.push(role);
    }

    const whereSql = ` WHERE ${whereClauses.join(' AND ')}`;

    // Summary counts & creators list across all accessible team members
    let statsQuery = `
      SELECT tm.id, tm.role, tm.status, tm.created_by_user_id,
             u.username AS creator_username,
             COALESCE(u.full_name, u.name, u.username, 'Admin') AS creator_name,
             u.role AS creator_role
      FROM team_members tm
      LEFT JOIN users u ON u.id = tm.created_by_user_id
      WHERE tm.deleted_at IS NULL
    `;
    const statsParams = [];
    if (!isSuperAdmin) {
      statsQuery += ` AND tm.organization_id = ?`;
      statsParams.push(orgId);
    }
    const [allMembers] = await pool.query(statsQuery, statsParams);

    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.status === 'Active').length;
    const inactiveMembers = allMembers.filter(m => m.status === 'Disabled').length;
    const adminMembers = allMembers.filter(m => m.role === 'Admin').length;
    const staffMembers = allMembers.filter(m => m.role !== 'Admin').length;

    // Breakdown by who created the member (Admin vs Users)
    const adminCreatedMembers = allMembers.filter(m =>
      m.created_by_user_id === authUserId ||
      m.creator_role === 'Super Admin' ||
      m.creator_role === 'Admin' ||
      m.creator_username === 'admin'
    ).length;

    const userCreatedMembers = totalMembers - adminCreatedMembers;

    // Unique list of creators for filter dropdown
    const creatorsMap = new Map();
    allMembers.forEach(m => {
      const cId = m.created_by_user_id || 0;
      if (!creatorsMap.has(cId)) {
        creatorsMap.set(cId, {
          id: cId,
          name: m.creator_name || 'Admin',
          username: m.creator_username || 'admin',
          role: m.creator_role || 'Admin',
          isAdmin: m.created_by_user_id === authUserId || m.creator_role === 'Super Admin' || m.creator_role === 'Admin' || m.creator_username === 'admin',
          count: 0
        });
      }
      creatorsMap.get(cId).count += 1;
    });
    const creatorsList = Array.from(creatorsMap.values());

    // Fetch paginated team members
    const [rows] = await pool.query(`${query} ${whereSql} ORDER BY tm.id DESC LIMIT ? OFFSET ?`, [...params, limitNum, offset]);

    const formatted = rows.map(tm => {
      let perms = [];
      if (tm.permissions) {
        try {
          perms = typeof tm.permissions === 'string' ? JSON.parse(tm.permissions) : tm.permissions;
        } catch (e) { }
      } else if (ROLE_DEFAULT_PERMISSIONS[tm.role]) {
        perms = ROLE_DEFAULT_PERMISSIONS[tm.role];
      }

      const isCreatedByAdmin = tm.created_by_user_id === authUserId ||
        tm.creator_role === 'Super Admin' ||
        tm.creator_role === 'Admin' ||
        tm.creator_username === 'admin';

      return {
        id: tm.id,
        full_name: tm.full_name,
        name: tm.full_name,
        username: tm.username,
        email: tm.email || '',
        phone: tm.phone || '',
        mobile: tm.phone || '',
        role: tm.role,
        status: tm.status,
        permissions: perms,
        permissions_version: tm.permissions_version || 1,
        organization_id: tm.organization_id,
        organization_name: tm.organization_name || 'My Organization',
        is_owner: false,
        created_by_user_id: tm.created_by_user_id,
        creator_name: tm.creator_name || 'Admin',
        creator_username: tm.creator_username || 'admin',
        creator_role: tm.creator_role || 'Admin',
        is_created_by_admin: isCreatedByAdmin,
        creator_type: isCreatedByAdmin ? 'admin' : 'user',
        created_at: tm.created_at,
        last_login_at: tm.last_login_at,
        last_login_ip: tm.last_login_ip,
        last_activity_at: tm.last_activity_at || tm.last_login_at,
        failed_login_attempts: tm.failed_login_attempts || 0
      };
    });

    return res.json({
      success: true,
      members: formatted,
      total: totalMembers,
      page: pageNum,
      limit: limitNum,
      creators: creatorsList,
      summary: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        adminMembers,
        staffMembers,
        adminCreatedMembers,
        userCreatedMembers
      }
    });

  } catch (err) {
    console.error('[TeamController] getTeamMembers error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch team members', error: err.message });
  }
}

/**
 * GET /api/team-members/:id
 * Fetch single team member profile, permissions, shared parent statistics, and activity.
 */
export async function getTeamMemberDetails(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = parseInt(req.params.id, 10);

    const [rows] = await pool.query(
      `SELECT tm.*, o.organization_name
       FROM team_members tm
       LEFT JOIN organizations o ON o.id = tm.organization_id
       WHERE tm.id = ? LIMIT 1`,
      [targetId]
    );

    if (rows.length === 0 || rows[0].deleted_at) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const tm = rows[0];

    // Multi-tenant check
    if (!isSuperAdmin && tm.organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot access member from another organization' });
    }

    let perms = [];
    if (tm.permissions) {
      try {
        perms = typeof tm.permissions === 'string' ? JSON.parse(tm.permissions) : tm.permissions;
      } catch (e) { }
    } else if (ROLE_DEFAULT_PERMISSIONS[tm.role]) {
      perms = ROLE_DEFAULT_PERMISSIONS[tm.role];
    }

    // Calculated stats from parent organization
    let campaignsSent = 0;
    try {
      const [cRows] = await pool.query(`SELECT COUNT(*) as cnt FROM campaigns WHERE organization_id = ?`, [tm.organization_id]);
      campaignsSent = cRows[0]?.cnt || 0;
    } catch (e) { }

    let contactsCount = 0;
    try {
      const [ctRows] = await pool.query(`SELECT COUNT(*) as cnt FROM contacts WHERE organization_id = ?`, [tm.organization_id]);
      contactsCount = ctRows[0]?.cnt || 0;
    } catch (e) { }

    let messagesCount = 0;
    try {
      const [mRows] = await pool.query(`SELECT COUNT(*) as cnt FROM messages WHERE organization_id = ?`, [tm.organization_id]);
      messagesCount = mRows[0]?.cnt || 0;
    } catch (e) { }

    let templatesCount = 0;
    try {
      const [tRows] = await pool.query(`SELECT COUNT(*) as cnt FROM templates WHERE organization_id = ?`, [tm.organization_id]);
      templatesCount = tRows[0]?.cnt || 0;
    } catch (e) { }

    // Recent activity
    const activityResult = await getAuditLogs({
      organizationId: tm.organization_id,
      userId: targetId,
      limit: 15,
      isSuperAdmin: true
    });

    return res.json({
      success: true,
      member: {
        id: tm.id,
        full_name: tm.full_name,
        name: tm.full_name,
        username: tm.username,
        email: tm.email || '',
        phone: tm.phone || '',
        role: tm.role,
        status: tm.status,
        permissions: perms,
        permissions_version: tm.permissions_version || 1,
        organization_id: tm.organization_id,
        organization_name: tm.organization_name || 'My Organization',
        created_at: tm.created_at,
        last_login_at: tm.last_login_at,
        last_login_ip: tm.last_login_ip,
        last_activity_at: tm.last_activity_at || tm.last_login_at,
        failed_login_attempts: tm.failed_login_attempts || 0,
        statistics: {
          campaignsSent,
          contactsAdded: contactsCount,
          messagesSent: messagesCount,
          templatesCreated: templatesCount
        }
      },
      activity: activityResult.logs
    });

  } catch (err) {
    console.error('[TeamController] getTeamMemberDetails error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch member details', error: err.message });
  }
}

/**
 * POST /api/team-members
 * Create a new team member under the authenticated main account / organization.
 * Does NOT require or ask for any Meta credentials.
 */
export async function createTeamMember(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const { full_name, name, username, password, confirm_password, email, phone, mobile, role = 'Staff', permissions } = req.body;

    const memberName = (full_name || name || '').trim();
    const memberUsername = (username || '').trim().toLowerCase();
    const memberEmail = (email || '').trim().toLowerCase() || null;
    const memberPhone = (phone || mobile || '').trim() || null;

    if (!memberUsername) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Password and confirmation do not match' });
    }

    const validRoles = ['Admin', 'Marketing', 'Sales', 'Support', 'Custom', 'Staff'];
    const assignedRole = validRoles.includes(role) ? role : 'Staff';

    // Unique username check across team_members and users
    const [tmConflict] = await pool.query(
      `SELECT id FROM team_members WHERE username = ? AND deleted_at IS NULL LIMIT 1`,
      [memberUsername]
    );
    if (tmConflict.length > 0) {
      return res.status(409).json({ success: false, message: `Username "${memberUsername}" is already taken` });
    }

    const [userConflict] = await pool.query(
      `SELECT id FROM users WHERE username = ? AND deleted_at IS NULL LIMIT 1`,
      [memberUsername]
    );
    if (userConflict.length > 0) {
      return res.status(409).json({ success: false, message: `Username "${memberUsername}" is already taken by a user account` });
    }

    // Unique email check if provided
    if (memberEmail) {
      const [emailConflict] = await pool.query(
        `SELECT id FROM team_members WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
        [memberEmail]
      );
      if (emailConflict.length > 0) {
        return res.status(409).json({ success: false, message: `Email "${memberEmail}" is already registered` });
      }
    }

    let assignedPermissions = Array.isArray(permissions) ? permissions : (ROLE_DEFAULT_PERMISSIONS[assignedRole] || ROLE_DEFAULT_PERMISSIONS['Staff'] || []);
    const permissionsJson = JSON.stringify(assignedPermissions);

    const targetOrgId = authOrgId || (isSuperAdmin ? (req.body.organization_id || 1) : 1);
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO team_members 
       (organization_id, created_by_user_id, full_name, username, email, phone, password_hash, role, status, permissions, permissions_version, token_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, 1, 1)`,
      [targetOrgId, req.user?.id || null, memberName || memberUsername, memberUsername, memberEmail, memberPhone, passwordHash, assignedRole, permissionsJson]
    );

    const newMemberId = result.insertId;

    // Record audit log
    await recordAuditLog(req, {
      userId: req.user?.id,
      organizationId: targetOrgId,
      action: 'TEAM_MEMBER_CREATED',
      module: 'TEAM',
      entityType: 'TeamMember',
      entityId: newMemberId,
      description: `Created new team member "${memberUsername}" with role "${assignedRole}"`,
      metadata: { newMemberId, username: memberUsername, role: assignedRole, permissionsCount: assignedPermissions.length }
    });

    return res.status(201).json({
      success: true,
      message: 'Team member created successfully',
      member: {
        id: newMemberId,
        full_name: memberName || memberUsername,
        username: memberUsername,
        email: memberEmail || '',
        phone: memberPhone || '',
        role: assignedRole,
        status: 'Active',
        permissions: assignedPermissions,
        organization_id: targetOrgId
      }
    });

  } catch (err) {
    console.error('[TeamController] createTeamMember error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create team member', error: err.message });
  }
}

/**
 * PUT /api/team-members/:id
 * Update team member profile, role, or granular permissions.
 */
export async function updateTeamMember(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = parseInt(req.params.id, 10);
    const { full_name, name, email, phone, mobile, role, permissions } = req.body;

    const [existing] = await pool.query(
      `SELECT * FROM team_members WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const currentMember = existing[0];

    // Multi-tenant check
    if (!isSuperAdmin && currentMember.organization_id !== authOrgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot update member from another organization' });
    }

    const updates = [];
    const params = [];

    const updatedName = (full_name || name || '').trim();
    if (updatedName) {
      updates.push('full_name = ?');
      params.push(updatedName);
    }

    if (email !== undefined) {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const [emailConflict] = await pool.query(
          `SELECT id FROM team_members WHERE email = ? AND id != ? AND deleted_at IS NULL LIMIT 1`,
          [cleanEmail, targetId]
        );
        if (emailConflict.length > 0) {
          return res.status(409).json({ success: false, message: `Email "${cleanEmail}" is already in use by another team member` });
        }
      }
      updates.push('email = ?');
      params.push(cleanEmail);
    }

    const updatedPhone = phone !== undefined ? phone : mobile;
    if (updatedPhone !== undefined) {
      updates.push('phone = ?');
      params.push(updatedPhone ? updatedPhone.trim() : null);
    }

    if (role) {
      updates.push('role = ?');
      params.push(role);
    }

    if (permissions !== undefined) {
      let permsArray = Array.isArray(permissions) ? permissions : (ROLE_DEFAULT_PERMISSIONS[role || currentMember.role] || []);
      updates.push('permissions = ?');
      params.push(JSON.stringify(permsArray));
    }

    // Increment permissions_version to enforce immediate real-time update
    updates.push('permissions_version = permissions_version + 1');

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    params.push(targetId);
    await pool.query(`UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`, params);

    // Record audit log
    await recordAuditLog(req, {
      userId: req.user?.id,
      organizationId: currentMember.organization_id,
      action: 'TEAM_MEMBER_UPDATED',
      module: 'TEAM',
      entityType: 'TeamMember',
      entityId: targetId,
      description: `Updated profile and permissions for team member "${currentMember.username}"`,
      metadata: { targetId, updates: req.body }
    });

    return res.json({ success: true, message: 'Team member updated successfully' });

  } catch (err) {
    console.error('[TeamController] updateTeamMember error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update team member', error: err.message });
  }
}

/**
 * PATCH /api/team-members/:id/status
 * Enable / Disable team member access with immediate token invalidation.
 */
export async function toggleTeamMemberStatus(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const [existing] = await pool.query(
      `SELECT * FROM team_members WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const currentMember = existing[0];

    // Multi-tenant check
    if (!isSuperAdmin && currentMember.organization_id !== authOrgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify member from another organization' });
    }

    let nextStatus = status;
    if (!nextStatus) {
      nextStatus = (currentMember.status === 'Active') ? 'Disabled' : 'Active';
    }

    if (nextStatus === 'Disabled') {
      // Invalidate active JWT tokens immediately
      await pool.query(
        `UPDATE team_members SET status = 'Disabled', token_version = token_version + 1, permissions_version = permissions_version + 1 WHERE id = ?`,
        [targetId]
      );

      await recordAuditLog(req, {
        userId: req.user?.id,
        organizationId: currentMember.organization_id,
        action: 'TEAM_MEMBER_DISABLED',
        module: 'TEAM',
        entityType: 'TeamMember',
        entityId: targetId,
        description: `Disabled access for team member "${currentMember.username}"`,
        metadata: { targetId, username: currentMember.username }
      });

      return res.json({ success: true, message: `Access disabled for ${currentMember.username}`, status: 'Disabled' });
    } else {
      await pool.query(
        `UPDATE team_members SET status = 'Active', permissions_version = permissions_version + 1 WHERE id = ?`,
        [targetId]
      );

      await recordAuditLog(req, {
        userId: req.user?.id,
        organizationId: currentMember.organization_id,
        action: 'TEAM_MEMBER_ENABLED',
        module: 'TEAM',
        entityType: 'TeamMember',
        entityId: targetId,
        description: `Enabled access for team member "${currentMember.username}"`,
        metadata: { targetId, username: currentMember.username }
      });

      return res.json({ success: true, message: `Access enabled for ${currentMember.username}`, status: 'Active' });
    }

  } catch (err) {
    console.error('[TeamController] toggleTeamMemberStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update member status', error: err.message });
  }
}

/**
 * POST /api/team-members/:id/reset-password
 * Reset team member password with bcrypt hash and session revocation.
 */
export async function resetTeamMemberPassword(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = parseInt(req.params.id, 10);
    const { new_password, confirm_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match' });
    }

    const [existing] = await pool.query(
      `SELECT * FROM team_members WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const currentMember = existing[0];

    if (!isSuperAdmin && currentMember.organization_id !== authOrgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot reset password for another organization' });
    }

    const newHash = await bcrypt.hash(new_password, 10);

    // Update password, increment token_version to invalidate old sessions
    await pool.query(
      `UPDATE team_members SET password_hash = ?, token_version = token_version + 1 WHERE id = ?`,
      [newHash, targetId]
    );

    await recordAuditLog(req, {
      userId: req.user?.id,
      organizationId: currentMember.organization_id,
      action: 'PASSWORD_RESET',
      module: 'TEAM',
      entityType: 'TeamMember',
      entityId: targetId,
      description: `Reset password for team member "${currentMember.username}"`,
      metadata: { targetId, username: currentMember.username }
    });

    return res.json({ success: true, message: `Password reset successfully for ${currentMember.username}` });

  } catch (err) {
    console.error('[TeamController] resetTeamMemberPassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password', error: err.message });
  }
}

/**
 * DELETE /api/team-members/:id
 * Soft-delete a team member, preserving all historical records and audit logs.
 */
export async function deleteTeamMember(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = parseInt(req.params.id, 10);

    const [existing] = await pool.query(
      `SELECT * FROM team_members WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const currentMember = existing[0];

    if (!isSuperAdmin && currentMember.organization_id !== authOrgId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete member in another organization' });
    }

    // Soft delete: set deleted_at, status = 'Disabled', invalidate tokens
    await pool.query(
      `UPDATE team_members SET deleted_at = NOW(), status = 'Disabled', token_version = token_version + 1 WHERE id = ?`,
      [targetId]
    );

    await recordAuditLog(req, {
      userId: req.user?.id,
      organizationId: currentMember.organization_id,
      action: 'TEAM_MEMBER_DELETED',
      module: 'TEAM',
      entityType: 'TeamMember',
      entityId: targetId,
      description: `Deleted team member "${currentMember.username}"`,
      metadata: { targetId, username: currentMember.username }
    });

    return res.json({ success: true, message: `Team member "${currentMember.username}" deleted successfully` });

  } catch (err) {
    console.error('[TeamController] deleteTeamMember error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete team member', error: err.message });
  }
}

/**
 * GET /api/team-members/:id/activity
 * Fetch paginated activity history for a specific team member.
 */
export async function getTeamMemberActivity(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = parseInt(req.params.id, 10);
    const { page = 1, limit = 20, action, module: mod, status, startDate, endDate } = req.query;

    const result = await getAuditLogs({
      organizationId: authOrgId,
      userId: targetId,
      action,
      module: mod,
      status,
      startDate,
      endDate,
      page,
      limit,
      isSuperAdmin
    });

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error('[TeamController] getTeamMemberActivity error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch member activity logs', error: err.message });
  }
}

/**
 * GET /api/team-members/activity/all
 * Fetch tenant-wide audit log history.
 */
export async function getAllTeamActivity(req, res) {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const authOrgId = req.organizationId || req.user?.organization_id || 1;
    const { page = 1, limit = 20, action, module: mod, status, startDate, endDate, search, userId } = req.query;

    const result = await getAuditLogs({
      organizationId: authOrgId,
      userId: userId ? parseInt(userId, 10) : null,
      action,
      module: mod,
      status,
      startDate,
      endDate,
      search,
      page,
      limit,
      isSuperAdmin
    });

    return res.json({ success: true, ...result });

  } catch (err) {
    console.error('[TeamController] getAllTeamActivity error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch tenant audit logs', error: err.message });
  }
}
