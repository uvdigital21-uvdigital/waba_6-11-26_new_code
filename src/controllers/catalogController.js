import { pool } from '../config/db.js';
import path from 'path';
import fs from 'fs';

/**
 * Verify that the requesting user has access to a specific catalog.
 * Returns the catalog row if authorized, null otherwise.
 */
async function verifyCatalogAccess(catalogId, reqUser, organizationId) {
  const [rows] = await pool.query(
    `SELECT * FROM catalogs WHERE id = ? LIMIT 1`,
    [catalogId]
  );
  if (rows.length === 0) return null;

  const catalog = rows[0];

  // Super Admin has global access
  if (reqUser.role === 'Super Admin') return catalog;

  // Admin and Team Members belonging to the same organization have access
  if (
    organizationId &&
    catalog.organization_id &&
    Number(catalog.organization_id) === Number(organizationId)
  ) {
    return catalog;
  }

  // Sub-users / standalone users can access catalogs they personally created
  if (Number(catalog.user_id) === Number(reqUser.id)) {
    return catalog;
  }

  return null;
}

/**
 * Check if the requesting user has the catalog permission for a given action.
 * Admins and Super Admins always pass. Members must have 'catalog' in allowed_modules or permissions.
 */
function checkCatalogPermission(req, permAction) {
  const user = req.user;
  if (!user) return false;

  // Super Admin & Admin have full rights
  if (user.role === 'Super Admin' || user.role === 'Admin' || user.username === 'admin') {
    return true;
  }

  // Check permissions array assigned to this team member
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.length > 0) {
    if (
      perms.includes('catalog') ||
      perms.includes('catalog.view') ||
      perms.includes(`catalog.${permAction}`) ||
      perms.some(p => p === 'catalog' || p.startsWith('catalog.'))
    ) {
      return true;
    }
  }

  // Check allowed_modules assigned to this user
  if (user.allowed_modules && Array.isArray(user.allowed_modules)) {
    const hasModule = user.allowed_modules.some(m =>
      m === 'catalog' ||
      m === 'catalog:builder' ||
      m.startsWith('catalog:')
    );
    if (hasModule) {
      return true;
    }
  }

  return false;
}

// ── GET /api/catalogs/stats ───────────────────────────────────────────────────
// Returns counts for catalog dashboard header stats
export async function getCatalogStats(req, res) {
  try {
    if (!checkCatalogPermission(req, 'view')) {
      return res.status(403).json({ message: 'Forbidden', code: 'PERMISSION_DENIED' });
    }

    const userId = req.user.id;
    const orgId = req.organizationId || req.user.organization_id || null;
    const isSuperAdmin = req.user.role === 'Super Admin';

    const orgFilter = isSuperAdmin
      ? '1=1'
      : (orgId
        ? `(organization_id = ${pool.escape(orgId)} OR user_id = ${pool.escape(userId)})`
        : `user_id = ${pool.escape(userId)}`);

    const [[totalRow]] = await pool.query(
      `SELECT COUNT(*) as total FROM catalogs WHERE ${orgFilter}`
    );
    const [[myRow]] = await pool.query(
      `SELECT COUNT(*) as total FROM catalogs WHERE user_id = ?`,
      [userId]
    );
    const [[teamRow]] = await pool.query(
      `SELECT COUNT(*) as total FROM catalogs WHERE organization_id = ? AND user_id != ?`,
      [orgId || 0, userId]
    );
    const [[recentRow]] = await pool.query(
      `SELECT COUNT(*) as total FROM catalogs WHERE ${orgFilter} AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    res.json({
      success: true,
      total: totalRow.total || 0,
      my_catalogs: myRow.total || 0,
      team_catalogs: teamRow.total || 0,
      recently_updated: recentRow.total || 0
    });
  } catch (err) {
    console.error('[CatalogController] getCatalogStats error:', err);
    res.status(500).json({ message: 'Failed to fetch catalog stats', error: err.message });
  }
}

// ── GET /api/catalogs ────────────────────────────────────────────────────────
export async function getCatalogs(req, res) {
  try {
    if (!checkCatalogPermission(req, 'view')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to view catalogs', code: 'PERMISSION_DENIED' });
    }

    const orgId = req.organizationId || req.user.organization_id || null;
    const userId = req.user.id;
    const isSuperAdmin = req.user.role === 'Super Admin';
    const isAdmin = req.user.role === 'Admin' || req.user.username === 'admin' || req.user.role === 'Super Admin';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const scope = (req.query.scope || 'all').toLowerCase(); // 'all' | 'personal' | 'team'
    const filterUserId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    const filterStatus = req.query.status || '';
    const sortBy = req.query.sort_by || 'updated_at'; // 'updated_at' | 'created_at' | 'title'
    const sortDir = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';

    // Validate sort field to prevent SQL injection
    const allowedSortFields = { updated_at: 'c.updated_at', created_at: 'c.created_at', title: 'c.title' };
    const sortField = allowedSortFields[sortBy] || 'c.updated_at';

    let whereSql = 'WHERE 1=1';
    const params = [];

    if (isSuperAdmin) {
      if (filterUserId) {
        whereSql += ' AND c.user_id = ?';
        params.push(filterUserId);
      }
    } else if (isAdmin) {
      if (scope === 'personal') {
        whereSql += ' AND c.user_id = ?';
        params.push(userId);
      } else if (scope === 'team') {
        whereSql += ' AND c.organization_id = ? AND c.user_id != ?';
        params.push(orgId || 0, userId);
      } else if (filterUserId) {
        whereSql += ' AND c.user_id = ?';
        params.push(filterUserId);
      } else if (orgId) {
        whereSql += ' AND (c.organization_id = ? OR c.user_id = ?)';
        params.push(orgId, userId);
      } else {
        whereSql += ' AND c.user_id = ?';
        params.push(userId);
      }
    } else {
      // Team Members with catalog permission see the organization's catalogs!
      if (orgId) {
        whereSql += ' AND (c.organization_id = ? OR c.user_id = ?)';
        params.push(orgId, userId);
      } else {
        whereSql += ' AND c.user_id = ?';
        params.push(userId);
      }
    }

    if (search) {
      whereSql += ' AND (c.title LIKE ? OR c.business_name LIKE ? OR c.description LIKE ? OR creator.full_name LIKE ? OR creator.username LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (filterStatus) {
      whereSql += ' AND c.status = ?';
      params.push(filterStatus);
    }

    // Count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM catalogs c
       LEFT JOIN users creator ON creator.id = c.user_id
       ${whereSql}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // List with full creator + last editor details
    const [rows] = await pool.query(
      `SELECT
         c.id,
         c.user_id,
         c.last_edited_by,
         c.organization_id,
         c.title,
         c.business_name,
         c.description,
         c.status,
         c.thumbnail,
         c.created_at,
         c.updated_at,
         c.last_edited_at,
         COALESCE(creator.full_name, creator.name, creator.username, 'Admin') AS creator_name,
         creator.username AS creator_username,
         creator.email AS creator_email,
         creator.role AS creator_role,
         COALESCE(editor.full_name, editor.name, editor.username) AS last_editor_name,
         editor.username AS last_editor_username,
         editor.role AS last_editor_role,
         (SELECT COUNT(*) FROM catalog_pages cp WHERE cp.catalog_id = c.id) AS page_count
       FROM catalogs c
       LEFT JOIN users creator ON creator.id = c.user_id
       LEFT JOIN users editor ON editor.id = c.last_edited_by
       ${whereSql}
       ORDER BY ${sortField} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      catalogs: rows,
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('[CatalogController] getCatalogs error:', err);
    res.status(500).json({ message: 'Failed to fetch catalogs', error: err.message });
  }
}

// ── GET /api/catalogs/:id ────────────────────────────────────────────────────
export async function getCatalogById(req, res) {
  try {
    if (!checkCatalogPermission(req, 'view')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to view this catalog', code: 'PERMISSION_DENIED' });
    }

    const { id } = req.params;
    const orgId = req.organizationId || req.user.organization_id || null;
    const catalog = await verifyCatalogAccess(id, req.user, orgId);

    if (!catalog) {
      return res.status(404).json({ message: 'Catalog not found or access denied' });
    }

    // Parse settings JSON
    let parsedSettings = {};
    if (catalog.settings) {
      try {
        parsedSettings = typeof catalog.settings === 'string' ? JSON.parse(catalog.settings) : catalog.settings;
      } catch (e) {
        parsedSettings = {};
      }
    }

    // Fetch creator and last editor details
    const [userRows] = await pool.query(
      `SELECT
         creator.id AS creator_id,
         COALESCE(creator.full_name, creator.name, creator.username, 'Admin') AS creator_name,
         creator.username AS creator_username,
         creator.role AS creator_role,
         COALESCE(editor.full_name, editor.name, editor.username) AS last_editor_name,
         editor.username AS last_editor_username,
         editor.role AS last_editor_role
       FROM catalogs c
       LEFT JOIN users creator ON creator.id = c.user_id
       LEFT JOIN users editor ON editor.id = c.last_edited_by
       WHERE c.id = ?
       LIMIT 1`,
      [id]
    );
    const userInfo = userRows[0] || {};

    // Fetch pages
    const [pageRows] = await pool.query(
      `SELECT id, catalog_id, page_order, page_name, page_data, created_at, updated_at
       FROM catalog_pages
       WHERE catalog_id = ?
       ORDER BY page_order ASC, id ASC`,
      [id]
    );

    const pages = pageRows.map(p => {
      let data = {};
      if (p.page_data) {
        try {
          data = typeof p.page_data === 'string' ? JSON.parse(p.page_data) : p.page_data;
        } catch (e) {
          data = {};
        }
      }
      return {
        id: p.id,
        catalog_id: p.catalog_id,
        page_order: p.page_order,
        page_name: p.page_name,
        ...data
      };
    });

    res.json({
      success: true,
      catalog: {
        id: catalog.id,
        user_id: catalog.user_id,
        last_edited_by: catalog.last_edited_by,
        organization_id: catalog.organization_id,
        title: catalog.title,
        business_name: catalog.business_name,
        description: catalog.description,
        status: catalog.status,
        thumbnail: catalog.thumbnail,
        settings: parsedSettings,
        pages,
        created_at: catalog.created_at,
        updated_at: catalog.updated_at,
        last_edited_at: catalog.last_edited_at,
        // Enriched ownership info
        creator_name: userInfo.creator_name || null,
        creator_username: userInfo.creator_username || null,
        creator_role: userInfo.creator_role || null,
        last_editor_name: userInfo.last_editor_name || null,
        last_editor_username: userInfo.last_editor_username || null,
        last_editor_role: userInfo.last_editor_role || null
      }
    });
  } catch (err) {
    console.error('[CatalogController] getCatalogById error:', err);
    res.status(500).json({ message: 'Failed to fetch catalog', error: err.message });
  }
}

// ── POST /api/catalogs ───────────────────────────────────────────────────────
export async function createCatalog(req, res) {
  const conn = await pool.getConnection();
  try {
    if (!checkCatalogPermission(req, 'create')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to create catalogs', code: 'PERMISSION_DENIED' });
    }

    const userId = req.user.id;
    const orgId = req.organizationId || req.user.organization_id || null;
    const {
      title = 'New Product Catalog',
      business_name = '',
      description = '',
      status = 'Draft',
      settings = {},
      thumbnail = '',
      pages = []
    } = req.body;

    await conn.beginTransaction();

    const settingsJson = JSON.stringify(settings || {});

    const [catResult] = await conn.query(
      `INSERT INTO catalogs (user_id, last_edited_by, organization_id, title, business_name, description, status, settings, thumbnail, last_edited_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, userId, orgId, title, business_name, description, status, settingsJson, thumbnail]
    );

    const catalogId = catResult.insertId;

    if (Array.isArray(pages) && pages.length > 0) {
      for (let idx = 0; idx < pages.length; idx++) {
        const p = pages[idx];
        const pageName = p.name || p.page_name || `Page ${idx + 1}`;
        const pageDataJson = JSON.stringify(p);

        await conn.query(
          `INSERT INTO catalog_pages (catalog_id, page_order, page_name, page_data)
           VALUES (?, ?, ?, ?)`,
          [catalogId, idx, pageName, pageDataJson]
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Catalog created successfully',
      catalogId,
      catalog: {
        id: catalogId,
        user_id: userId,
        last_edited_by: userId,
        organization_id: orgId,
        title,
        business_name,
        description,
        status,
        settings,
        pages
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('[CatalogController] createCatalog error:', err);
    res.status(500).json({ message: 'Failed to create catalog', error: err.message });
  } finally {
    conn.release();
  }
}

// ── PUT /api/catalogs/:id ────────────────────────────────────────────────────
export async function updateCatalog(req, res) {
  const conn = await pool.getConnection();
  try {
    if (!checkCatalogPermission(req, 'edit')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to edit catalogs', code: 'PERMISSION_DENIED' });
    }

    const { id } = req.params;
    const orgId = req.organizationId || req.user.organization_id || null;
    const existing = await verifyCatalogAccess(id, req.user, orgId);

    if (!existing) {
      return res.status(404).json({ message: 'Catalog not found or access denied' });
    }

    const {
      title,
      business_name,
      description,
      status,
      settings,
      thumbnail,
      pages
    } = req.body;

    await conn.beginTransaction();

    const updateFields = [];
    const updateParams = [];

    if (title !== undefined) { updateFields.push('title = ?'); updateParams.push(title); }
    if (business_name !== undefined) { updateFields.push('business_name = ?'); updateParams.push(business_name); }
    if (description !== undefined) { updateFields.push('description = ?'); updateParams.push(description); }
    if (status !== undefined) { updateFields.push('status = ?'); updateParams.push(status); }
    if (settings !== undefined) { updateFields.push('settings = ?'); updateParams.push(JSON.stringify(settings)); }
    if (thumbnail !== undefined) { updateFields.push('thumbnail = ?'); updateParams.push(thumbnail); }

    // Always update last_edited_by and last_edited_at so we track who last saved it
    updateFields.push('last_edited_by = ?');
    updateParams.push(req.user.id);
    updateFields.push('last_edited_at = NOW()');
    updateFields.push('updated_at = NOW()');

    if (updateFields.length > 0) {
      await conn.query(
        `UPDATE catalogs SET ${updateFields.join(', ')} WHERE id = ?`,
        [...updateParams, id]
      );
    }

    // Replace pages if array is provided
    if (Array.isArray(pages)) {
      // Clear old pages and re-insert in order
      await conn.query(`DELETE FROM catalog_pages WHERE catalog_id = ?`, [id]);

      for (let idx = 0; idx < pages.length; idx++) {
        const p = pages[idx];
        const pageName = p.name || p.page_name || `Page ${idx + 1}`;
        const pageDataJson = JSON.stringify(p);

        await conn.query(
          `INSERT INTO catalog_pages (catalog_id, page_order, page_name, page_data)
           VALUES (?, ?, ?, ?)`,
          [id, idx, pageName, pageDataJson]
        );
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: 'Catalog saved successfully',
      catalogId: parseInt(id, 10),
      updatedAt: new Date().toISOString(),
      lastEditedBy: req.user.id
    });
  } catch (err) {
    await conn.rollback();
    console.error('[CatalogController] updateCatalog error:', err);
    res.status(500).json({ message: 'Failed to update catalog', error: err.message });
  } finally {
    conn.release();
  }
}

// ── POST /api/catalogs/:id/duplicate ─────────────────────────────────────────
export async function duplicateCatalog(req, res) {
  const conn = await pool.getConnection();
  try {
    if (!checkCatalogPermission(req, 'create')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to create/duplicate catalogs', code: 'PERMISSION_DENIED' });
    }

    const { id } = req.params;
    const orgId = req.organizationId || req.user.organization_id || null;
    const existing = await verifyCatalogAccess(id, req.user, orgId);

    if (!existing) {
      return res.status(404).json({ message: 'Catalog not found or access denied' });
    }

    await conn.beginTransaction();

    const newTitle = `${existing.title || 'Catalog'} (Copy)`;

    // The duplicated catalog belongs to the user who clicked Duplicate (req.user.id)
    const [catResult] = await conn.query(
      `INSERT INTO catalogs (user_id, last_edited_by, organization_id, title, business_name, description, status, settings, thumbnail, last_edited_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        req.user.id,
        orgId,
        newTitle,
        existing.business_name,
        existing.description,
        'Draft',
        existing.settings,
        existing.thumbnail
      ]
    );

    const newCatalogId = catResult.insertId;

    // Copy all pages
    const [pages] = await conn.query(
      `SELECT page_order, page_name, page_data FROM catalog_pages WHERE catalog_id = ? ORDER BY page_order ASC`,
      [id]
    );

    for (const p of pages) {
      await conn.query(
        `INSERT INTO catalog_pages (catalog_id, page_order, page_name, page_data)
         VALUES (?, ?, ?, ?)`,
        [newCatalogId, p.page_order, p.page_name, p.page_data]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Catalog duplicated successfully',
      catalogId: newCatalogId,
      title: newTitle
    });
  } catch (err) {
    await conn.rollback();
    console.error('[CatalogController] duplicateCatalog error:', err);
    res.status(500).json({ message: 'Failed to duplicate catalog', error: err.message });
  } finally {
    conn.release();
  }
}

// ── DELETE /api/catalogs/:id ─────────────────────────────────────────────────
export async function deleteCatalog(req, res) {
  try {
    if (!checkCatalogPermission(req, 'delete')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete catalogs', code: 'PERMISSION_DENIED' });
    }

    const { id } = req.params;
    const orgId = req.organizationId || req.user.organization_id || null;
    const existing = await verifyCatalogAccess(id, req.user, orgId);

    if (!existing) {
      return res.status(404).json({ message: 'Catalog not found or access denied' });
    }

    await pool.query(`DELETE FROM catalogs WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: 'Catalog deleted successfully'
    });
  } catch (err) {
    console.error('[CatalogController] deleteCatalog error:', err);
    res.status(500).json({ message: 'Failed to delete catalog', error: err.message });
  }
}

export async function uploadCatalogImage(req, res) {
  try {
    if (!checkCatalogPermission(req, 'create') && !checkCatalogPermission(req, 'edit')) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to upload catalog images', code: 'PERMISSION_DENIED' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    const fileUrl = `/uploads/catalogs/${req.file.filename}`;

    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    console.error('[CatalogController] uploadCatalogImage error:', err);
    res.status(500).json({ message: 'Failed to upload image', error: err.message });
  }
}
