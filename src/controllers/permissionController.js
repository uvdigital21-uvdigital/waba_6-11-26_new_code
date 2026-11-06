import { pool } from '../config/db.js';

/**
 * GET /api/permissions
 * Fetches all system permissions and current matrix mappings per role & user.
 */
export async function getPermissions(req, res) {
  try {
    // 1. Fetch all permissions
    const [permissions] = await pool.query(
      `SELECT id, name, slug, module, created_at FROM permissions ORDER BY module, id`
    );

    // 2. Fetch all roles
    const [roles] = await pool.query(
      `SELECT id, name, description FROM roles ORDER BY id`
    );

    // 3. Fetch role permissions mapping
    const [rolePerms] = await pool.query(
      `SELECT role_id, permission_id FROM role_permissions`
    );

    // Build role matrix map
    const roleMatrix = {};
    for (const r of roles) {
      roleMatrix[r.name] = rolePerms
        .filter(rp => rp.role_id === r.id)
        .map(rp => rp.permission_id);
    }

    res.json({
      success: true,
      permissions,
      roles,
      roleMatrix
    });
  } catch (err) {
    console.error('[PermissionController] Get permissions error:', err);
    res.status(500).json({ message: 'Failed to fetch permissions' });
  }
}

/**
 * PUT /api/permissions
 * Updates role permissions matrix. Only Super Admin can perform this action.
 */
export async function updateRolePermissions(req, res) {
  try {
    const { role_id, role_name, permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ message: 'permission_ids must be an array' });
    }

    let targetRoleId = role_id;

    if (!targetRoleId && role_name) {
      const [roleRow] = await pool.query(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [role_name]);
      if (roleRow.length > 0) {
        targetRoleId = roleRow[0].id;
      }
    }

    if (!targetRoleId) {
      return res.status(400).json({ message: 'Valid role_id or role_name is required' });
    }

    // Clear existing permissions for role
    await pool.query(`DELETE FROM role_permissions WHERE role_id = ?`, [targetRoleId]);

    // Insert new permissions
    for (const permId of permission_ids) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [targetRoleId, permId]
      );
    }

    console.log(`[PermissionController] Updated permissions for Role ID ${targetRoleId}`);

    res.json({
      success: true,
      message: 'Permissions updated successfully'
    });

  } catch (err) {
    console.error('[PermissionController] Update permissions error:', err);
    res.status(500).json({ message: 'Failed to update permissions' });
  }
}
