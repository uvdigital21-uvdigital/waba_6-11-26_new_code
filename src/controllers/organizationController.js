import { pool } from '../config/db.js';
import { provisionDefaultTenantData } from '../services/tenantProvisioningService.js';

/**
 * POST /api/organizations
 * Creates a new Organization.
 */
export async function createOrganization(req, res) {
  try {
    const { organization_name, owner_user_id } = req.body;
    const userId = owner_user_id || (req.user ? req.user.id : null);

    if (!organization_name) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO organizations (organization_name, owner_user_id, status) VALUES (?, ?, 'Active')`,
      [organization_name, userId || 1]
    );

    const orgId = result.insertId;

    if (userId) {
      await pool.query(`UPDATE users SET organization_id = ? WHERE id = ?`, [orgId, userId]);
    }

    await provisionDefaultTenantData(orgId, userId);

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      organization: {
        id: orgId,
        organization_name,
        owner_user_id: userId,
        status: 'Active'
      }
    });

  } catch (err) {
    console.error('[OrgController] Create organization error:', err);
    res.status(500).json({ message: 'Failed to create organization' });
  }
}

/**
 * GET /api/organizations
 * Returns list of organizations (Super Admin sees all, tenant sees own).
 */
export async function getOrganizations(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const orgId = req.organizationId;

    let query = `
      SELECT o.id, o.organization_name, o.owner_user_id, o.status, o.created_at,
             u.full_name as owner_name, u.email as owner_email
      FROM organizations o
      LEFT JOIN users u ON u.id = o.owner_user_id
    `;
    const params = [];

    if (!isSuperAdmin) {
      query += ` WHERE o.id = ?`;
      params.push(orgId || 0);
    }

    query += ` ORDER BY o.id DESC`;

    const [orgs] = await pool.query(query, params);

    res.json({
      success: true,
      organizations: orgs
    });

  } catch (err) {
    console.error('[OrgController] Get organizations error:', err);
    res.status(500).json({ message: 'Failed to fetch organizations' });
  }
}
