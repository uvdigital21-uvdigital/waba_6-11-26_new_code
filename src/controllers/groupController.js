import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Ensure contact_groups table exists in MySQL database with all required columns
 */
export const ensureGroupTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contact_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT UNSIGNED DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        total_contacts INT DEFAULT 0,
        numbers_json LONGTEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure critical columns exist even if table was created by a different migration
    const [cols] = await connection.query(`SHOW COLUMNS FROM contact_groups`);
    const existingFields = cols.map(c => c.Field);

    if (!existingFields.includes('organization_id')) {
      await connection.query(`ALTER TABLE contact_groups ADD COLUMN organization_id INT UNSIGNED DEFAULT 1 AFTER id`);
    } else {
      try {
        await connection.query(`ALTER TABLE contact_groups MODIFY COLUMN organization_id INT UNSIGNED DEFAULT 1`);
      } catch (e) { /* ignore */ }
    }
    if (!existingFields.includes('total_contacts')) {
      await connection.query(`ALTER TABLE contact_groups ADD COLUMN total_contacts INT DEFAULT 0`);
    }
    if (!existingFields.includes('numbers_json')) {
      await connection.query(`ALTER TABLE contact_groups ADD COLUMN numbers_json LONGTEXT DEFAULT NULL`);
    }
    if (!existingFields.includes('description')) {
      await connection.query(`ALTER TABLE contact_groups ADD COLUMN description TEXT DEFAULT NULL`);
    }
    if (!existingFields.includes('updated_at')) {
      await connection.query(`ALTER TABLE contact_groups ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    }
    logger.info('[GroupController] contact_groups table verified.');
  } catch (err) {
    logger.error('[GroupController] Table creation error:', err.message);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/groups
 * Fetch all contact groups for current tenant/organization
 */
export const getGroups = async (req, res) => {
  await ensureGroupTable();
  const organizationId = req.organizationId || req.user?.organization_id || 1;

  try {
    let query = `SELECT id, organization_id, name, description, total_contacts, numbers_json, created_at, updated_at 
                 FROM contact_groups 
                 WHERE organization_id = ? 
                 ORDER BY created_at DESC`;
    const params = [organizationId];

    const [rows] = await pool.execute(query, params);

    const formattedGroups = rows.map(r => {
      let numbers = [];
      try {
        numbers = JSON.parse(r.numbers_json || '[]');
      } catch (e) {
        numbers = [];
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description || '',
        totalContacts: r.total_contacts || numbers.length,
        createdOn: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
        numbers
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedGroups
    });
  } catch (err) {
    logger.error('[GroupController] Error fetching groups:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch groups' });
  }
};

/**
 * POST /api/groups
 * Create a new contact group with numbers
 */
export const createGroup = async (req, res) => {
  await ensureGroupTable();
  const { name, numbers, country, description } = req.body;
  const organizationId = req.organizationId || req.user?.organization_id || 1;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Group name is required' });
  }

  const cleanName = name.trim();

  // Sanitize phone numbers array or string
  let rawList = [];
  if (Array.isArray(numbers)) {
    rawList = numbers;
  } else if (typeof numbers === 'string') {
    rawList = numbers.split(/[\n,;\s]+/);
  }

  const countryDigits = country ? String(country).replace(/[^0-9]/g, '') : '91';

  const validNumbers = [];
  const seen = new Set();

  rawList.forEach(item => {
    if (!item) return;
    const str = String(item).trim();
    if (!str || /[a-zA-Z]/.test(str)) return;

    let digits = str.replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length < 7 || digits.length > 15) return;

    let formatted = digits;
    if (countryDigits && !digits.startsWith(countryDigits) && digits.length <= 10) {
      formatted = `${countryDigits}${digits}`;
    }

    if (!seen.has(formatted)) {
      seen.add(formatted);
      validNumbers.push(formatted);
    }
  });

  const numbersJson = JSON.stringify(validNumbers);
  const totalContacts = validNumbers.length;

  let connection;
  try {
    connection = await pool.getConnection();

    // Check if group name exists for this organization
    const [existing] = await connection.execute(
      `SELECT id FROM contact_groups WHERE name = ? AND organization_id = ?`,
      [cleanName, organizationId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Group "${cleanName}" already exists.` });
    }

    const [result] = await connection.execute(
      `INSERT INTO contact_groups (organization_id, name, description, total_contacts, numbers_json) VALUES (?, ?, ?, ?, ?)`,
      [organizationId, cleanName, description || null, totalContacts, numbersJson]
    );

    const newGroupId = result.insertId;

    logger.info(`[GroupController] Created group ID ${newGroupId} "${cleanName}" with ${totalContacts} numbers for org ${organizationId}`);

    return res.status(201).json({
      success: true,
      message: `Group "${cleanName}" created successfully with ${totalContacts} contact(s).`,
      group: {
        id: newGroupId,
        organizationId,
        name: cleanName,
        totalContacts,
        createdOn: new Date().toISOString().split('T')[0],
        numbers: validNumbers
      }
    });
  } catch (err) {
    logger.error('[GroupController] Error creating group:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create group' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * DELETE /api/groups/:id
 * Delete a group by ID
 */
export const deleteGroup = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId || req.user?.organization_id || 1;

  try {
    const [result] = await pool.execute(
      `DELETE FROM contact_groups WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    return res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (err) {
    logger.error('[GroupController] Error deleting group:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete group' });
  }
};
