// import jwt from 'jsonwebtoken';
// import dotenv from 'dotenv';
// import { pool } from '../config/db.js';

// dotenv.config();

// export async function requireAuth(req, res, next) {
//   const header = req.headers.authorization || '';
//   const token = header.startsWith('Bearer ') ? header.slice(7) : null;

//   if (!token) {
//     return res.status(401).json({ message: 'No authentication token provided', code: 'NO_TOKEN' });
//   }

//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET || 'wa_secret_key_2026');
//     req.user = payload;
//     req.organizationId = payload.organization_id || payload.org_id || null;

//     // Verify user status and token validity against database
//     if (payload.id) {
//       try {
//         const [rows] = await pool.query(
//           `SELECT id, role, status, organization_id, token_version FROM users WHERE id = ? LIMIT 1`,
//           [payload.id]
//         );
//         if (rows.length > 0) {
//           const dbUser = rows[0];
          
//           // Check if disabled/inactive
//           if (dbUser.status === 'Inactive' || dbUser.status === 'Disabled') {
//             return res.status(403).json({
//               message: 'Your account has been disabled. Please contact your administrator.',
//               code: 'USER_DISABLED'
//             });
//           }

//           // Check token version if present in token payload
//           if (payload.token_version !== undefined && dbUser.token_version > payload.token_version) {
//             return res.status(401).json({
//               message: 'Session expired or revoked. Please log in again.',
//               code: 'SESSION_REVOKED'
//             });
//           }

//           if (dbUser.organization_id) {
//             req.organizationId = dbUser.organization_id;
//             req.user.organization_id = dbUser.organization_id;
//           }
//           if (dbUser.role) req.user.role = dbUser.role;
//           if (dbUser.status) req.user.status = dbUser.status;
//         } else {
//           // Check agents table fallback
//           const [agentRows] = await pool.query(
//             `SELECT id, role, status, organization_id FROM agents WHERE id = ? LIMIT 1`,
//             [payload.id]
//           );
//           if (agentRows.length > 0) {
//             const agent = agentRows[0];
//             if (agent.status === 'Inactive' || agent.status === 'Disabled') {
//               return res.status(403).json({
//                 message: 'Your account has been disabled. Please contact your administrator.',
//                 code: 'USER_DISABLED'
//               });
//             }
//             if (agent.organization_id) req.organizationId = agent.organization_id;
//           }
//         }
//       } catch (dbErr) {
//         console.warn(`[AuthMiddleware] Error fetching user DB state:`, dbErr.message);
//       }
//     }

//     next();
//   } catch (err) {
//     if (err.name === 'TokenExpiredError') {
//       console.warn(`[AuthMiddleware] Token expired for request: ${req.method} ${req.originalUrl}`);
//       return res.status(401).json({ message: 'Token expired. Please log in again.', code: 'TOKEN_EXPIRED' });
//     }
//     console.error(`[AuthMiddleware] JWT verify failed for ${req.method} ${req.originalUrl}:`, err.message);
//     return res.status(401).json({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
//   }
// }

// /**
//  * Middleware enforcing Super Admin access only.
//  */
// export function requireSuperAdmin(req, res, next) {
//   if (!req.user) {
//     return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
//   }

//   const role = req.user.role || '';
//   if (role === 'Super Admin') {
//     return next();
//   }

//   return res.status(403).json({
//     message: 'Forbidden: Super Admin access required',
//     code: 'SUPER_ADMIN_REQUIRED'
//   });
// }

// /**
//  * Middleware enforcing Admin or Super Admin access.
//  */
// export function requireAdmin(req, res, next) {
//   if (!req.user) {
//     return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
//   }

//   const role = req.user.role || '';
//   if (role === 'Super Admin' || role === 'Admin') {
//     return next();
//   }

//   return res.status(403).json({
//     message: 'Forbidden: Admin access required',
//     code: 'ADMIN_REQUIRED'
//   });
// }

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { calculateDaysMetrics } from '../utils/userAccessHelper.js';

dotenv.config();

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No authentication token provided', code: 'NO_TOKEN' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'wa_secret_key_2026');
    req.user = payload;
    req.organizationId = payload.organization_id || payload.org_id || null;

    // Verify user status and token validity against database
    // Agent IDs and user IDs live in different tables and may overlap. Never
    // hydrate an authenticated agent from users by the same numeric id.
    if (payload.id && payload.principal_type !== 'agent' && !payload.agent_id) {
      try {
        const [rows] = await pool.query(
          `SELECT id, role, status, organization_id, token_version, dashboard_access, access_type, days_allocated, days_used, start_date, expiry_date, credits, allowed_modules, is_team_member, created_by_user_id, permissions FROM users WHERE id = ? LIMIT 1`,
          [payload.id]
        );
        if (rows.length > 0) {
          const dbUser = rows[0];

          // Check if disabled/inactive
          if (dbUser.status === 'Inactive' || dbUser.status === 'Disabled') {
            return res.status(403).json({
              message: 'Your account has been disabled. Please contact your administrator.',
              code: 'USER_DISABLED'
            });
          }

          // Check token version if present in token payload
          if (payload.token_version !== undefined && dbUser.token_version > payload.token_version) {
            return res.status(401).json({
              message: 'Session expired or revoked. Please log in again.',
              code: 'SESSION_REVOKED'
            });
          }

          if (payload.session_id) {
            const [sessions] = await pool.query(
              `SELECT id FROM user_sessions WHERE id = ? AND user_id = ? AND principal_type = 'user'
               AND revoked_at IS NULL AND blocked_at IS NULL AND expires_at > NOW() LIMIT 1`,
              [payload.session_id, payload.id]
            );
            if (!sessions.length) {
              return res.status(401).json({ message: 'Session expired or revoked. Please log in again.', code: 'SESSION_REVOKED' });
            }
            await pool.query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ?`, [payload.session_id]);
          }

          if (dbUser.organization_id) {
            req.organizationId = dbUser.organization_id;
            req.user.organization_id = dbUser.organization_id;
          }
          if (dbUser.role) req.user.role = dbUser.role;
          if (dbUser.status) req.user.status = dbUser.status;
          if (dbUser.is_team_member !== undefined) {
            req.user.is_team_member = Boolean(dbUser.is_team_member);
          }
          if (dbUser.created_by_user_id !== undefined) {
            req.user.created_by_user_id = dbUser.created_by_user_id;
          }

          // Parse allowed_modules
          let parsedModules = null;
          if (dbUser.allowed_modules) {
            try {
              parsedModules = typeof dbUser.allowed_modules === 'string' ? JSON.parse(dbUser.allowed_modules) : dbUser.allowed_modules;
            } catch (e) {}
          }
          req.user.allowed_modules = parsedModules;

          // Access model & days metrics
          const daysMetrics = calculateDaysMetrics(dbUser);
          req.user.access_type = daysMetrics.access_type;
          req.user.is_days_based = daysMetrics.is_days_based;
          req.user.days_allocated = daysMetrics.days_allocated;
          req.user.days_used = daysMetrics.days_used;
          req.user.start_date = daysMetrics.start_date;
          req.user.expiry_date = daysMetrics.expiry_date;
          req.user.remaining_days = daysMetrics.remaining_days;
          req.user.days_status = daysMetrics.days_status;
          req.user.is_expired = daysMetrics.is_expired;
          req.user.credits = dbUser.credits || 0;

          if (dbUser.dashboard_access !== undefined) {
            req.user.dashboard_access = dbUser.dashboard_access;
          }
        } else {
          // Check agents table fallback
          const [agentRows] = await pool.query(
            `SELECT id, role, status, organization_id FROM agents WHERE id = ? LIMIT 1`,
            [payload.id]
          );
          if (agentRows.length > 0) {
            const agent = agentRows[0];
            if (agent.status === 'Inactive' || agent.status === 'Disabled') {
              return res.status(403).json({
                message: 'Your account has been disabled. Please contact your administrator.',
                code: 'USER_DISABLED'
              });
            }
            if (agent.organization_id) req.organizationId = agent.organization_id;
          }
        }
      } catch (dbErr) {
        console.warn(`[AuthMiddleware] Error fetching user DB state:`, dbErr.message);
      }
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn(`[AuthMiddleware] Token expired for request: ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ message: 'Token expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    console.error(`[AuthMiddleware] JWT verify failed for ${req.method} ${req.originalUrl}:`, err.message);
    return res.status(401).json({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
}

/**
 * Middleware enforcing Super Admin access only.
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  const role = req.user.role || '';
  if (role === 'Super Admin') {
    return next();
  }

  return res.status(403).json({
    message: 'Forbidden: Super Admin access required',
    code: 'SUPER_ADMIN_REQUIRED'
  });
}

/**
 * Middleware enforcing Admin or Super Admin access.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  const role = req.user.role || '';
  if (role === 'Super Admin' || role === 'Admin') {
    return next();
  }

  return res.status(403).json({
    message: 'Forbidden: Admin access required',
    code: 'ADMIN_REQUIRED'
  });
}

/**
 * Middleware allowing Admin, Super Admin, OR Reseller roles.
 * Used for user CRUD endpoints so Resellers can manage their own sub-users.
 * Reseller-specific scoping (created_by_user_id) is handled in the controller.
 */
export function requireAdminOrReseller(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  const role = req.user.role || '';
  if (role === 'Super Admin' || role === 'Admin' || role === 'Reseller') {
    return next();
  }

  return res.status(403).json({
    message: 'Forbidden: Admin or Reseller access required',
    code: 'ADMIN_OR_RESELLER_REQUIRED'
  });
}
