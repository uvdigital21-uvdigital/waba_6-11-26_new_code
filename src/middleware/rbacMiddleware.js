import { pool } from '../config/db.js';

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Enforces route and API permissions based on user role or required permission slug.
 */

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' });
    }

    const userRole = req.user.role || 'User';

    // Super Admin & Admin always have full system access
    if (userRole === 'Super Admin' || userRole === 'Admin') {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: Role "${userRole}" does not have permission to access this resource`,
      code: 'ROLE_FORBIDDEN',
      requiredRoles: allowedRoles
    });
  };
}

/**
 * Checks if the authenticated user has a specific granular permission slug.
 * Example slugs: 'campaigns.send', 'team_members.view', 'contacts.import', 'inbox.reply'
 * 
 * @param {string} permissionSlug 
 */
export function requirePermission(permissionSlug) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' });
    }

    const userRole = req.user.role || 'User';

    // Super Admin & Admin possess full permissions
    if (userRole === 'Super Admin' || userRole === 'Admin') {
      return next();
    }

    try {
      // 1. Check user granular permissions array attached to req.user
      const permissions = req.user.permissions;
      if (Array.isArray(permissions) && permissions.length > 0) {
        if (permissions.includes(permissionSlug) || permissions.includes('*')) {
          return next();
        }
      }

      // 2. Check direct user_permissions table override in DB
      const [userPerms] = await pool.query(
        `SELECT up.allowed 
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = ? AND p.slug = ? LIMIT 1`,
        [req.user.id, permissionSlug]
      );

      if (userPerms.length > 0) {
        if (userPerms[0].allowed === 1) {
          return next();
        } else {
          return res.status(403).json({
            success: false,
            message: `Forbidden: Permission "${permissionSlug}" is explicitly denied for your account`,
            code: 'PERMISSION_DENIED',
            requiredPermission: permissionSlug
          });
        }
      }

      // 3. Check role_permissions table mapping
      const [rolePerms] = await pool.query(
        `SELECT rp.role_id
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         JOIN roles r ON r.id = rp.role_id
         WHERE r.name = ? AND p.slug = ? LIMIT 1`,
        [userRole, permissionSlug]
      );

      if (rolePerms.length > 0) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not possess the required permission "${permissionSlug}" to perform this action`,
        code: 'PERMISSION_DENIED',
        requiredPermission: permissionSlug
      });

    } catch (err) {
      console.error(`[RBAC] Permission check error for slug ${permissionSlug}:`, err);
      return res.status(500).json({ success: false, message: 'Error validating permissions', error: err.message });
    }
  };
}
