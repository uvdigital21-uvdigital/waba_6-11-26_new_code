import { pool } from '../config/db.js';

export const requireFollowupPermission = (action) => async (req, res, next) => {
  if (req.user?.role === 'Super Admin') {
    req.followupPermissions = { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_pause_resume: 1, can_view_all_users: 1, can_export: 1 };
    return next();
  }
  try {
    const [perms] = await pool.query(
      'SELECT * FROM followup_role_permissions WHERE role = ? AND (organization_id = ? OR organization_id IS NULL) ORDER BY organization_id IS NOT NULL DESC, id DESC LIMIT 1',
      [req.user?.role, req.organizationId || req.user?.organization_id]
    );
    if (!perms.length || !perms[0][action]) return res.status(403).json({ success: false, error: 'Access denied' });
    req.followupPermissions = perms[0];
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: 'Permission check failed' });
  }
};
