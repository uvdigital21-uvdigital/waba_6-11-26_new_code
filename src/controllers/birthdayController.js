import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Ensure database schema for birthday campaigns and logs exists.
 */
export const ensureBirthdayTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS birthday_campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT UNSIGNED NULL,
        name VARCHAR(255) NOT NULL,
        dob DATE NOT NULL,
        type VARCHAR(50) DEFAULT 'Birthday',
        mobile_number VARCHAR(50) NOT NULL,
        wish_time TIME NOT NULL DEFAULT '10:00:00',
        template_name VARCHAR(255) NOT NULL,
        language_code VARCHAR(20) DEFAULT 'en_US',
        country VARCHAR(50) DEFAULT 'India(+91)',
        notes TEXT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        next_trigger_on DATETIME DEFAULT NULL,
        last_triggered_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Add organization_id column if missing (for existing tables)
    try {
      const [bcCols] = await connection.query(`SHOW COLUMNS FROM birthday_campaigns LIKE 'organization_id'`);
      if (bcCols.length === 0) {
        await connection.query(`ALTER TABLE birthday_campaigns ADD COLUMN organization_id INT UNSIGNED NULL AFTER id`);
        logger.info('[BirthdayController] Added organization_id column to birthday_campaigns.');
      }
    } catch (e) { /* ignore */ }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS birthday_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        birthday_campaign_id INT DEFAULT NULL,
        organization_id INT UNSIGNED NULL,
        recipient_name VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(50) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        status ENUM('sent', 'failed') DEFAULT 'sent',
        error_message TEXT DEFAULT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      const [blCols] = await connection.query(`SHOW COLUMNS FROM birthday_logs LIKE 'organization_id'`);
      if (blCols.length === 0) {
        await connection.query(`ALTER TABLE birthday_logs ADD COLUMN organization_id INT UNSIGNED NULL AFTER birthday_campaign_id`);
        logger.info('[BirthdayController] Added organization_id column to birthday_logs.');
      }
    } catch (e) { /* ignore */ }

    logger.info('[BirthdayController] Database tables verified.');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      logger.warn('[BirthdayController] Database unreachable during table check.');
    } else {
      logger.error('[BirthdayController] Table setup error:', err.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

// Auto-run schema check
ensureBirthdayTable();

/**
 * Helper to calculate next upcoming trigger DATETIME string (YYYY-MM-DD HH:mm:ss)
 */
const calculateNextTrigger = (dobDateStr, wishTimeStr) => {
  try {
    if (!dobDateStr) return null;

    // Parse date string directly to avoid UTC→local timezone off-by-one issue
    // dobDateStr format: YYYY-MM-DD
    const parts = String(dobDateStr).split(/[-T]/);
    const dobMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
    const dobDay = parseInt(parts[2], 10);

    if (isNaN(dobMonth) || isNaN(dobDay)) return null;

    const timeParts = (wishTimeStr || '10:00').split(':');
    const hours = parseInt(timeParts[0] || '10', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);

    const now = new Date();
    let nextYear = now.getFullYear();

    let target = new Date(nextYear, dobMonth, dobDay, hours, minutes, 0);
    // If today is the birthday date, schedule for today so scheduler picks it up immediately
    const isTodayBirthday = (now.getMonth() === dobMonth && now.getDate() === dobDay);
    if (!isTodayBirthday && target.getTime() <= now.getTime()) {
      target = new Date(nextYear + 1, dobMonth, dobDay, hours, minutes, 0);
    }

    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const min = String(minutes).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`;
  } catch (err) {
    return null;
  }
};

/**
 * Format E.164 phone number
 */
const sanitizePhoneNumber = (numStr, countryStr = 'India(+91)') => {
  if (!numStr) return '';
  let cleaned = String(numStr).replace(/\D/g, '');
  if (!cleaned) return '';

  if (cleaned.length === 10) {
    if (countryStr.includes('+91')) cleaned = '91' + cleaned;
    else if (countryStr.includes('+1')) cleaned = '1' + cleaned;
    else if (countryStr.includes('+44')) cleaned = '44' + cleaned;
  }
  return cleaned;
};

/**
 * GET /api/birthday-campaigns
 * List all birthday campaigns
 */
export const getBirthdayCampaigns = async (req, res) => {
  const organizationId = req.organizationId || req.user?.organization_id || 1;
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') AS formatted_dob 
       FROM birthday_campaigns 
       WHERE (organization_id = ? OR organization_id IS NULL)
       ORDER BY id DESC`,
      [organizationId]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      name: r.name,
      dob: r.formatted_dob || (r.dob ? String(r.dob).split('T')[0] : ''),
      type: r.type || 'Birthday',
      mobile: r.mobile_number,
      wishTime: r.wish_time ? String(r.wish_time).slice(0, 5) : '10:00',
      nextTrigger: r.next_trigger_on ? new Date(r.next_trigger_on).toLocaleString() : 'N/A',
      template: r.template_name,
      country: r.country,
      notes: r.notes,
      addedOn: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
      isActive: r.is_active === 1 ? 'Active' : 'Inactive',
      rawActive: r.is_active === 1
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    logger.error('[BirthdayController] Error fetching campaigns:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch birthday campaigns.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/birthday-campaigns/history
 * List sent/failed birthday message logs for current tenant
 */
export const getBirthdayHistory = async (req, res) => {
  const organizationId = req.organizationId || req.user?.organization_id || 1;
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT * FROM birthday_logs 
       WHERE (organization_id = ? OR organization_id IS NULL)
       ORDER BY id DESC LIMIT 200`,
      [organizationId]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      recipientName: r.recipient_name,
      mobile: r.mobile_number,
      template: r.template_name,
      status: r.status,
      errorMsg: r.error_message,
      sentAt: r.sent_at ? new Date(r.sent_at).toLocaleString() : ''
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (err) {
    logger.error('[BirthdayController] Error fetching history:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch birthday history.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/birthday-campaigns
 * Create single or CSV bulk birthday campaign
 */
export const createBirthdayCampaign = async (req, res) => {
  const { type, data } = req.body;

  if (!data) {
    return res.status(400).json({ success: false, message: 'Invalid payload.' });
  }

  const organizationId = req.organizationId || req.user?.organization_id || null;

  let connection;
  try {
    connection = await pool.getConnection();

    if (type === 'single') {
      const { name, dob, wishTime, country, mobileNumbers, template, notes } = data;
      if (!name || !dob || !mobileNumbers || !template) {
        return res.status(400).json({ success: false, message: 'Name, DOB, Mobile Numbers, and Template are required.' });
      }

      // Split mobile numbers if comma separated
      const numberList = String(mobileNumbers)
        .split(',')
        .map(n => sanitizePhoneNumber(n.trim(), country))
        .filter(Boolean);

      if (numberList.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid mobile numbers provided.' });
      }

      let insertedCount = 0;
      for (const num of numberList) {
        const wishTimeFormatted = (wishTime || '10:00') + ':00';
        const nextTrigger = calculateNextTrigger(dob, wishTimeFormatted);

        await connection.execute(
          `INSERT INTO birthday_campaigns 
           (organization_id, name, dob, type, mobile_number, wish_time, template_name, country, notes, is_active, next_trigger_on)
           VALUES (?, ?, ?, 'Birthday', ?, ?, ?, ?, ?, 1, ?)`,
          [organizationId, name, dob, num, wishTimeFormatted, template, country || 'India(+91)', notes || null, nextTrigger]
        );
        insertedCount++;
      }

      return res.status(200).json({
        success: true,
        message: `Successfully created ${insertedCount} birthday campaign entry/entries!`
      });

    } else if (type === 'csv') {
      // Bulk payload from CSV tab
      const { items } = data;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'CSV data contains no valid entries.' });
      }

      let insertedCount = 0;
      for (const item of items) {
        const sanitizedNum = sanitizePhoneNumber(item.mobile, item.country);
        if (!item.name || !item.dob || !sanitizedNum || !item.template) continue;

        const wishTimeFormatted = (item.wishTime || '10:00') + ':00';
        const nextTrigger = calculateNextTrigger(item.dob, wishTimeFormatted);

        await connection.execute(
          `INSERT INTO birthday_campaigns 
           (organization_id, name, dob, type, mobile_number, wish_time, template_name, country, notes, is_active, next_trigger_on)
           VALUES (?, ?, ?, 'Birthday', ?, ?, ?, ?, ?, 1, ?)`,
          [organizationId, item.name, item.dob, sanitizedNum, wishTimeFormatted, item.template, item.country || 'India(+91)', item.notes || null, nextTrigger]
        );
        insertedCount++;
      }

      return res.status(200).json({
        success: true,
        message: `Successfully imported ${insertedCount} birthday campaign entries from file!`
      });
    }

    return res.status(400).json({ success: false, message: 'Unsupported submission type.' });
  } catch (err) {
    logger.error('[BirthdayController] Error creating campaign:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Failed to save birthday campaign.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * DELETE /api/birthday-campaigns/:id
 * Delete birthday campaign entry
 */
export const deleteBirthdayCampaign = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(`DELETE FROM birthday_campaigns WHERE id = ?`, [id]);
    return res.status(200).json({ success: true, message: 'Birthday campaign deleted.' });
  } catch (err) {
    logger.error('[BirthdayController] Error deleting campaign:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete birthday campaign.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * PUT /api/birthday-campaigns/:id/toggle
 * Toggle active/inactive status
 */
export const toggleBirthdayCampaign = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(`UPDATE birthday_campaigns SET is_active = NOT is_active WHERE id = ?`, [id]);
    return res.status(200).json({ success: true, message: 'Status updated successfully.' });
  } catch (err) {
    logger.error('[BirthdayController] Error toggling campaign:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to toggle status.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * PUT /api/birthday-campaigns/:id
 * Update an existing birthday campaign entry
 */
export const updateBirthdayCampaign = async (req, res) => {
  const { id } = req.params;
  const { name, dob, wishTime, country, mobileNumbers, mobile, template, notes } = req.body;

  if (!name || !dob || !template) {
    return res.status(400).json({ success: false, message: 'Name, DOB, and Template are required.' });
  }

  const numStr = mobileNumbers || mobile || '';
  const sanitizedNum = sanitizePhoneNumber(numStr, country || 'India(+91)');

  let connection;
  try {
    connection = await pool.getConnection();

    const wishTimeFormatted = (wishTime || '10:00') + ':00';
    const nextTrigger = calculateNextTrigger(dob, wishTimeFormatted);

    await connection.execute(
      `UPDATE birthday_campaigns 
       SET name = ?, dob = ?, mobile_number = ?, wish_time = ?, template_name = ?, country = ?, notes = ?, next_trigger_on = ?
       WHERE id = ?`,
      [name, dob, sanitizedNum, wishTimeFormatted, template, country || 'India(+91)', notes || null, nextTrigger, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Birthday campaign updated successfully!'
    });
  } catch (err) {
    logger.error('[BirthdayController] Error updating campaign:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update birthday campaign.' });
  } finally {
    if (connection) connection.release();
  }
};
