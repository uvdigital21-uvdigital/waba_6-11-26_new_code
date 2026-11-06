import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { logUserActivity, getUserActivityLogs } from '../services/userActivityService.js';

/**
 * GET /api/team-members
 * Fetch all team members & staff accounts with summary statistics and creator scoping.
 */
export async function getTeamMembers(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const { search, role, status, scope, creator_user_id } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.name, u.username, u.email, u.mobile, u.role, u.status, 
             u.organization_id, u.is_team_member, u.created_by_user_id, u.permissions,
             u.created_at, u.last_login_at, u.last_activity_at,
             o.organization_name, o.owner_user_id,
             c.full_name AS creator_name, c.username AS creator_username, c.role AS creator_role
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      LEFT JOIN users c ON c.id = u.created_by_user_id
      WHERE u.deleted_at IS NULL AND u.is_team_member = 1
    `;

    const whereClauses = [];
    const params = [];

    if (!isSuperAdmin) {
      whereClauses.push(`(u.organization_id = ? OR u.created_by_user_id = ?)`);
      params.push(orgId, req.user?.id || 0);
    } else {
      if (scope === 'admin') {
        whereClauses.push(`(c.role = 'Super Admin' OR c.username = 'admin' OR u.created_by_user_id IS NULL OR u.created_by_user_id = 1)`);
      } else if (scope === 'users') {
        whereClauses.push(`(c.role != 'Super Admin' AND c.username != 'admin' AND u.created_by_user_id IS NOT NULL AND u.created_by_user_id != 1)`);
      }

      if (creator_user_id && creator_user_id !== 'all') {
        whereClauses.push(`u.created_by_user_id = ?`);
        params.push(Number(creator_user_id));
      }
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(`(u.full_name LIKE ? OR u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR c.full_name LIKE ? OR c.username LIKE ?)`);
      params.push(term, term, term, term, term, term, term);
    }

    if (role && role !== 'All') {
      whereClauses.push(`u.role = ?`);
      params.push(role);
    }

    if (status && status !== 'All') {
      if (status === 'Active') {
        whereClauses.push(`u.status = 'Active'`);
      } else if (status === 'Disabled') {
        whereClauses.push(`(u.status = 'Disabled' OR u.status = 'Inactive')`);
      }
    }

    if (whereClauses.length > 0) {
      query += ` AND ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY u.id DESC`;

    const [rows] = await pool.query(query, params);

    let allQuery = `
      SELECT u.id, u.full_name, u.name, u.username, u.role, u.status, u.is_team_member, u.created_by_user_id,
             c.full_name AS creator_name, c.username AS creator_username, c.role AS creator_role
      FROM users u
      LEFT JOIN users c ON c.id = u.created_by_user_id
      WHERE u.deleted_at IS NULL AND u.is_team_member = 1
    `;
    const allParams = [];
    if (!isSuperAdmin) {
      allQuery += ` AND (u.organization_id = ? OR u.created_by_user_id = ?)`;
      allParams.push(orgId, req.user?.id || 0);
    }
    const [allOrgMembers] = await pool.query(allQuery, allParams);

    const totalMembers = allOrgMembers.length;
    const activeMembers = allOrgMembers.filter(m => m.status === 'Active').length;
    const inactiveMembers = allOrgMembers.filter(m => m.status === 'Disabled' || m.status === 'Inactive').length;
    const adminMembers = allOrgMembers.filter(m => m.role === 'Admin' || m.role === 'Super Admin').length;
    const staffMembers = allOrgMembers.filter(m => m.role !== 'Admin' && m.role !== 'Super Admin').length;

    let adminCreatedMembers = 0;
    let userCreatedMembers = 0;
    const creatorsMap = new Map();

    allOrgMembers.forEach(m => {
      const isAdminCreator = (m.creator_role === 'Super Admin' || m.creator_username === 'admin' || !m.created_by_user_id || m.created_by_user_id === 1);
      if (isAdminCreator) {
        adminCreatedMembers++;
      } else {
        userCreatedMembers++;
      }

      const cId = m.created_by_user_id || 1;
      const cName = m.creator_name || 'Super Admin';
      const cUsername = m.creator_username || 'admin';
      const isAdm = (m.creator_role === 'Super Admin' || m.creator_username === 'admin');

      if (!creatorsMap.has(cId)) {
        creatorsMap.set(cId, { id: cId, name: cName, username: cUsername, isAdmin: isAdm, count: 0 });
      }
      creatorsMap.get(cId).count++;
    });

    const creators = Array.from(creatorsMap.values());

    const formattedMembers = rows.map(u => {
      let perms = [];
      if (u.permissions) {
        try {
          perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions;
        } catch (e) {
          perms = [];
        }
      }

      const isOwner = !u.is_team_member && (u.role === 'Super Admin' || u.role === 'Admin' || u.id === u.owner_user_id);
      const isCreatedByAdmin = (u.creator_role === 'Super Admin' || u.creator_username === 'admin' || !u.created_by_user_id || u.created_by_user_id === 1);

      return {
        id: u.id,
        full_name: u.full_name || u.name || u.username,
        name: u.full_name || u.name || u.username,
        username: u.username,
        email: u.email || '',
        phone: u.mobile || '',
        mobile: u.mobile || '',
        role: u.role || 'Staff',
        status: (u.status === 'Disabled' || u.status === 'Inactive') ? 'Disabled' : 'Active',
        organization_id: u.organization_id,
        organization_name: u.organization_name || 'Official WABA',
        is_owner: Boolean(isOwner),
        is_team_member: Boolean(u.is_team_member),
        is_created_by_admin: Boolean(isCreatedByAdmin),
        created_by_user_id: u.created_by_user_id,
        creator_name: u.creator_name || (isCreatedByAdmin ? 'Super Admin' : 'Admin'),
        creator_username: u.creator_username || 'admin',
        creator_role: u.creator_role || 'Admin',
        permissions: Array.isArray(perms) ? perms : [],
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        last_activity_at: u.last_activity_at
      };
    });

    return res.json({
      success: true,
      members: formattedMembers,
      summary: {
        totalMembers,
        activeMembers,
        inactiveMembers,
        adminMembers,
        staffMembers,
        adminCreatedMembers,
        userCreatedMembers
      },
      creators
    });

  } catch (err) {
    console.error('[TeamMemberController] getTeamMembers error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load team members', error: err.message });
  }
}

/**
 * POST /api/team-members
 * Create a new team member / staff user account.
 */
export async function createTeamMember(req, res) {
  try {
    const { full_name, username, password, email, phone, role, permissions } = req.body;

    const trimmedUsername = (username || '').trim();
    const trimmedFullName = (full_name || trimmedUsername).trim();
    const trimmedEmail = email && email.trim() ? email.trim() : null;
    const validDbRole = (role === 'Admin' || role === 'Super Admin') ? 'Admin' : 'Staff';
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const creatorUserId = req.user?.id || 1;

    if (!trimmedUsername || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // ── Backend privilege-escalation guard ───────────────────────────────────
    const isSuperAdmin = !req.user?.is_team_member &&
      (req.user?.role === 'Super Admin' || req.user?.username === 'admin');

    if (!isSuperAdmin) {
      const [creatorRows] = await pool.query(
        `SELECT allowed_modules, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [creatorUserId]
      );

      if (creatorRows.length > 0) {
        const creatorData = creatorRows[0];
        const isOwnerAdmin = !req.user?.is_team_member &&
          (creatorData.role === 'Admin' || creatorData.role === 'Super Admin');

        if (!isOwnerAdmin || creatorData.allowed_modules) {
          let creatorAllowed = null;
          if (creatorData.allowed_modules) {
            try {
              creatorAllowed = typeof creatorData.allowed_modules === 'string'
                ? JSON.parse(creatorData.allowed_modules)
                : creatorData.allowed_modules;
            } catch (e) { creatorAllowed = null; }
          }

          if (Array.isArray(creatorAllowed) && Array.isArray(permissions)) {
            const unauthorizedPerms = permissions.filter(p => !creatorAllowed.includes(p));
            if (unauthorizedPerms.length > 0) {
              return res.status(403).json({
                success: false,
                message: `Privilege escalation denied: You cannot assign permissions you do not have: ${unauthorizedPerms.join(', ')}`
              });
            }
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    if (trimmedEmail) {
      const [existing] = await pool.query(
        `SELECT id FROM users WHERE username = ? OR (email = ? AND email != '') LIMIT 1`,
        [trimmedUsername, trimmedEmail]
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'A team member or user with this username or email already exists' });
      }
    } else {
      const [existing] = await pool.query(
        `SELECT id FROM users WHERE username = ? LIMIT 1`,
        [trimmedUsername]
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'A team member or user with this username already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    const permissionsJson = JSON.stringify(permissionsArray);

    const [insertResult] = await pool.query(
      `INSERT INTO users (
        full_name, name, username, email, password, plain_password, mobile,
        role, status, is_team_member, created_by_user_id, organization_id,
        permissions, allowed_modules, token_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1, ?, ?, ?, ?, 1, NOW())`,
      [
        trimmedFullName,
        trimmedFullName,
        trimmedUsername,
        trimmedEmail,
        hashedPassword,
        password,
        phone || null,
        validDbRole,
        creatorUserId,
        orgId,
        permissionsJson,
        permissionsJson
      ]
    );

    const newMemberId = insertResult.insertId;

    await logUserActivity(req, {
      userId: creatorUserId,
      organizationId: orgId,
      action: 'TEAM_MEMBER_CREATED',
      module: 'TEAM',
      description: `Created new team member "${trimmedUsername}" (${validDbRole})`,
      metadata: { targetUserId: newMemberId, username: trimmedUsername, role: validDbRole }
    });

    return res.status(201).json({
      success: true,
      message: `Team member "${trimmedUsername}" created successfully!`,
      member: {
        id: newMemberId,
        full_name: trimmedFullName,
        username: trimmedUsername,
        email: trimmedEmail,
        phone: phone || '',
        role: validDbRole,
        status: 'Active',
        permissions: permissionsArray,
        organization_id: orgId
      }
    });

  } catch (err) {
    console.error('[TeamMemberController] createTeamMember error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create team member', error: err.message });
  }
}

/**
 * GET /api/team-members/:id
 * Fetch detailed profile, plain password, real usage statistics, RBAC permissions,
 * and recent activity/audit history for a single team member.
 */
export async function getTeamMemberDetails(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = req.params.id;

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.name, u.username, u.email, u.mobile, u.role, u.status, 
              u.organization_id, u.is_team_member, u.created_by_user_id, u.permissions,
              u.created_at, u.last_login_at, u.last_login_ip, u.last_activity_at, u.plain_password,
              o.organization_name,
              c.full_name AS creator_name, c.username AS creator_username
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN users c ON c.id = u.created_by_user_id
       WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const member = rows[0];

    if (!isSuperAdmin && member.organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Access denied: member is outside your organization' });
    }

    let perms = [];
    if (member.permissions) {
      try {
        perms = typeof member.permissions === 'string' ? JSON.parse(member.permissions) : member.permissions;
      } catch (e) {
        perms = [];
      }
    }

    // ── Real Statistics — scoped to what THIS team member has personally created ──
    // NOTE: assumes campaigns/contacts/messages/templates tables have a
    // `created_by_user_id` column pointing at users.id. If your schema uses a
    // different column name (e.g. `user_id`, `sent_by`), update the queries below.
    let campaignsSent = 0, contactsAdded = 0, messagesSent = 0, templatesCreated = 0;

    try {
      const [cRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM campaigns WHERE organization_id = ? AND created_by_user_id = ?`,
        [member.organization_id, targetId]
      );
      campaignsSent = cRows[0]?.cnt || 0;
    } catch (e) {
      console.error('[TeamMemberController] campaigns stat error:', e.message);
    }

    try {
      const [ctRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM contacts WHERE organization_id = ? AND created_by_user_id = ?`,
        [member.organization_id, targetId]
      );
      contactsAdded = ctRows[0]?.cnt || 0;
    } catch (e) {
      console.error('[TeamMemberController] contacts stat error:', e.message);
    }

    try {
      const [mRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM messages WHERE organization_id = ? AND created_by_user_id = ?`,
        [member.organization_id, targetId]
      );
      messagesSent = mRows[0]?.cnt || 0;
    } catch (e) {
      console.error('[TeamMemberController] messages stat error:', e.message);
    }

    try {
      const [tRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM templates WHERE organization_id = ? AND created_by_user_id = ?`,
        [member.organization_id, targetId]
      );
      templatesCreated = tRows[0]?.cnt || 0;
    } catch (e) {
      console.error('[TeamMemberController] templates stat error:', e.message);
    }

    // ── Recent Activity Logs for this team member ──
    let activityLogs = [];
    try {
      const result = await getUserActivityLogs({
        userId: targetId,
        organizationId: member.organization_id,
        limit: 15,
        isSuperAdmin: true
      });
      // Support either a raw array or a { logs: [...] } shape from the service
      activityLogs = Array.isArray(result) ? result : (result?.logs || []);
    } catch (e) {
      console.error('[TeamMemberController] getUserActivityLogs error:', e.message);
    }

    return res.json({
      success: true,
      member: {
        id: member.id,
        full_name: member.full_name || member.name || member.username,
        username: member.username,
        email: member.email || '',
        phone: member.mobile || '',
        role: member.role,
        status: (member.status === 'Disabled' || member.status === 'Inactive') ? 'Disabled' : 'Active',
        organization_name: member.organization_name || 'Official WABA',
        creator_name: member.creator_name || 'Admin',
        created_at: member.created_at,
        last_login_at: member.last_login_at,
        last_login_ip: member.last_login_ip,
        last_activity_at: member.last_activity_at,
        plain_password: member.plain_password || null,
        statistics: {
          campaignsSent,
          contactsAdded,
          messagesSent,
          templatesCreated
        }
      },
      stats: {
        loginCount: member.last_login_at ? 1 : 0,
        lastActive: member.last_activity_at || member.last_login_at || 'Never',
        permissionsCount: Array.isArray(perms) ? perms.length : 0
      },
      permissions: Array.isArray(perms) ? perms : [],
      activity: activityLogs
    });

  } catch (err) {
    console.error('[TeamMemberController] getTeamMemberDetails error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch member details', error: err.message });
  }
}

/**
 * PUT /api/team-members/:id
 * Update full name, email, phone, role, and permissions of a team member.
 */
export async function updateTeamMember(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = req.params.id;
    const { full_name, email, phone, role, permissions } = req.body;

    const [existing] = await pool.query(
      `SELECT id, username, organization_id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Access denied: member is outside your organization' });
    }

    // ── Backend privilege-escalation guard for permission updates ─────────────
    if (!isSuperAdmin && permissions !== undefined && Array.isArray(permissions)) {
      const creatorUserId = req.user?.id;
      const [creatorRows] = await pool.query(
        `SELECT allowed_modules, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [creatorUserId]
      );

      if (creatorRows.length > 0) {
        const creatorData = creatorRows[0];
        const isOwnerAdmin = !req.user?.is_team_member &&
          (creatorData.role === 'Admin' || creatorData.role === 'Super Admin');

        if (!isOwnerAdmin || creatorData.allowed_modules) {
          let creatorAllowed = null;
          if (creatorData.allowed_modules) {
            try {
              creatorAllowed = typeof creatorData.allowed_modules === 'string'
                ? JSON.parse(creatorData.allowed_modules)
                : creatorData.allowed_modules;
            } catch (e) { creatorAllowed = null; }
          }

          if (Array.isArray(creatorAllowed)) {
            const unauthorizedPerms = permissions.filter(p => !creatorAllowed.includes(p));
            if (unauthorizedPerms.length > 0) {
              return res.status(403).json({
                success: false,
                message: `Privilege escalation denied: You cannot assign permissions you do not have: ${unauthorizedPerms.join(', ')}`
              });
            }
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const updates = [];
    const params = [];

    if (full_name) {
      updates.push('full_name = ?', 'name = ?');
      params.push(full_name.trim(), full_name.trim());
    }
    if (email) {
      updates.push('email = ?');
      params.push(email.trim());
    }
    if (phone !== undefined) {
      updates.push('mobile = ?');
      params.push(phone ? String(phone).trim() : null);
    }
    if (role) {
      const validDbRole = (role === 'Admin' || role === 'Super Admin') ? 'Admin' : 'Staff';
      updates.push('role = ?');
      params.push(validDbRole);
    }
    if (permissions !== undefined) {
      const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);
      updates.push('permissions = ?', 'allowed_modules = ?');
      params.push(permsJson, permsJson);
    }

    updates.push('token_version = token_version + 1');

    if (updates.length > 0) {
      params.push(targetId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'TEAM_MEMBER_UPDATED',
      module: 'TEAM',
      description: `Updated profile & permissions for team member "${existing[0].username}"`,
      metadata: { targetUserId: targetId, updates: req.body }
    });

    return res.json({ success: true, message: 'Team member updated successfully!' });

  } catch (err) {
    console.error('[TeamMemberController] updateTeamMember error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update team member', error: err.message });
  }
}

/**
 * PATCH /api/team-members/:id/status
 * Toggle team member status (Active / Disabled).
 */
export async function toggleTeamMemberStatus(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = req.params.id;
    const { status } = req.body;

    const [existing] = await pool.query(
      `SELECT id, username, status, organization_id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Access denied: member is outside your organization' });
    }

    const nextStatus = status || (existing[0].status === 'Active' ? 'Disabled' : 'Active');

    await pool.query(
      `UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?`,
      [nextStatus, targetId]
    );

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: nextStatus === 'Disabled' ? 'TEAM_MEMBER_DISABLED' : 'TEAM_MEMBER_ENABLED',
      module: 'TEAM',
      description: `${nextStatus === 'Disabled' ? 'Disabled' : 'Enabled'} access for team member "${existing[0].username}"`,
      metadata: { targetUserId: targetId, status: nextStatus }
    });

    return res.json({ success: true, message: `Status updated to ${nextStatus}`, status: nextStatus });

  } catch (err) {
    console.error('[TeamMemberController] toggleTeamMemberStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle status', error: err.message });
  }
}

/**
 * POST /api/team-members/:id/reset-password
 * Reset team member password (used by both the quick-access modal and the
 * inline "Set New Password" box inside the Details drawer).
 */
export async function resetTeamMemberPassword(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = req.params.id;
    const { new_password, password } = req.body;

    const targetPassword = new_password || password;
    if (!targetPassword || targetPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query(
      `SELECT id, username, organization_id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Access denied: member is outside your organization' });
    }

    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    await pool.query(
      `UPDATE users SET password = ?, plain_password = ?, token_version = token_version + 1, password_changed_at = NOW() WHERE id = ?`,
      [hashedPassword, targetPassword, targetId]
    );

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'TEAM_MEMBER_PASSWORD_RESET',
      module: 'TEAM',
      description: `Reset password for team member "${existing[0].username}"`,
      metadata: { targetUserId: targetId }
    });

    return res.json({ success: true, message: 'Password reset successfully!' });

  } catch (err) {
    console.error('[TeamMemberController] resetTeamMemberPassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password', error: err.message });
  }
}

/**
 * DELETE /api/team-members/:id
 * Soft delete team member.
 */
export async function deleteTeamMember(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const targetId = req.params.id;

    const [existing] = await pool.query(
      `SELECT id, username, organization_id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [targetId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    if (!isSuperAdmin && existing[0].organization_id !== orgId) {
      return res.status(403).json({ success: false, message: 'Access denied: member is outside your organization' });
    }

    await pool.query(
      `UPDATE users SET deleted_at = NOW(), status = 'Disabled', token_version = token_version + 1 WHERE id = ?`,
      [targetId]
    );

    await logUserActivity(req, {
      userId: req.user?.id,
      organizationId: existing[0].organization_id,
      action: 'TEAM_MEMBER_DELETED',
      module: 'TEAM',
      description: `Deleted team member "${existing[0].username}"`,
      metadata: { targetUserId: targetId }
    });

    return res.json({ success: true, message: `Team member "${existing[0].username}" deleted successfully!` });

  } catch (err) {
    console.error('[TeamMemberController] deleteTeamMember error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete team member', error: err.message });
  }
}

/**
 * GET /api/team-members/activity/all
 * Retrieve tenant audit logs for team members.
 */
export async function getTeamMemberAuditLogs(req, res) {
  try {
    const isSuperAdmin = !req.user?.is_team_member && (req.user?.role === 'Super Admin' || req.user?.username === 'admin');
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const { page = 1, limit = 20, module: mod, action, search } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT ual.*, u.full_name AS user_name, u.username AS user_username, u.role AS user_role, o.organization_name
      FROM user_activity_logs ual
      LEFT JOIN users u ON u.id = ual.user_id
      LEFT JOIN organizations o ON o.id = ual.organization_id
    `;
    const whereClauses = [];
    const params = [];

    if (!isSuperAdmin) {
      whereClauses.push(`ual.organization_id = ?`);
      params.push(orgId);
    }

    if (mod && mod !== 'All') {
      whereClauses.push(`ual.module = ?`);
      params.push(mod);
    }

    if (action && action !== 'All') {
      whereClauses.push(`ual.action = ?`);
      params.push(action);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(`(ual.description LIKE ? OR ual.action LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)`);
      params.push(term, term, term, term);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    const countQuery = `SELECT COUNT(*) AS total FROM (${query}) AS total_sub`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    query += ` ORDER BY ual.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [logs] = await pool.query(query, params);

    return res.json({
      success: true,
      logs: logs || [],
      total,
      page: Number(page),
      limit: Number(limit)
    });

  } catch (err) {
    console.error('[TeamMemberController] getTeamMemberAuditLogs error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs', error: err.message });
  }
}