import crypto from 'crypto';
import { pool } from '../config/db.js';

/**
 * Automatically provisions default system data for an organization upon setup or WhatsApp account connection.
 * Creates:
 * 1. Default Contact Group
 * 2. Default Campaign Folder
 * 3. Default Template Folder
 * 4. Default API Settings
 * 5. Default Chat Inbox
 * 6. Default Report
 * 7. Default Broadcast Folder
 * 8. Default Webhook Configuration
 * 9. Default Team
 * 
 * @param {number} organizationId 
 * @param {number} userId 
 */
export async function provisionDefaultTenantData(organizationId, userId) {
  if (!organizationId) return;

  console.log(`[TenantProvisioning] Provisioning default data for Organization ID: ${organizationId}...`);

  try {
    // 1. Default Contact Group
    try {
      const [existingGroups] = await pool.query(
        `SELECT id FROM contact_groups WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingGroups.length === 0) {
        try {
          await pool.query(
            `INSERT INTO contact_groups (organization_id, name, description) VALUES (?, ?, ?)`,
            [organizationId, `Default Contact Group (Org ${organizationId})`, 'System generated default contact group']
          );
        } catch (e) {
          await pool.query(
            `INSERT IGNORE INTO contact_groups (organization_id, name) VALUES (?, ?)`,
            [organizationId, `Default Contact Group (Org ${organizationId})`]
          );
        }
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Contact group step skipped:', err.message);
    }

    // 2. Default Campaign Folder
    try {
      const [existingCampFolders] = await pool.query(
        `SELECT id FROM campaign_folders WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingCampFolders.length === 0) {
        await pool.query(
          `INSERT INTO campaign_folders (organization_id, folder_name) VALUES (?, ?)`,
          [organizationId, 'General Campaigns']
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Campaign folder step skipped:', err.message);
    }

    // 3. Default Template Folder
    try {
      const [existingTplFolders] = await pool.query(
        `SELECT id FROM template_folders WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingTplFolders.length === 0) {
        await pool.query(
          `INSERT INTO template_folders (organization_id, folder_name) VALUES (?, ?)`,
          [organizationId, 'Standard Templates']
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Template folder step skipped:', err.message);
    }

    // 4. Default API Settings
    try {
      const [existingApi] = await pool.query(
        `SELECT id FROM api_settings WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingApi.length === 0) {
        const generatedApiKey = `wa_live_${crypto.randomBytes(16).toString('hex')}`;
        await pool.query(
          `INSERT INTO api_settings (organization_id, api_key, status) VALUES (?, ?, 'Active')`,
          [organizationId, generatedApiKey]
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] API settings step skipped:', err.message);
    }

    // 5. Default Chat Inbox
    try {
      const [existingInboxes] = await pool.query(
        `SELECT id FROM chat_inboxes WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingInboxes.length === 0) {
        await pool.query(
          `INSERT INTO chat_inboxes (organization_id, inbox_name) VALUES (?, ?)`,
          [organizationId, 'Main Live Support Inbox']
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Chat inbox step skipped:', err.message);
    }

    // 6. Default Report Summary
    try {
      const [existingReports] = await pool.query(
        `SELECT id FROM reports_summary WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingReports.length === 0) {
        const initialMetrics = JSON.stringify({
          total_messages_sent: 0,
          total_messages_delivered: 0,
          total_messages_read: 0,
          total_contacts: 0,
          active_campaigns: 0
        });
        await pool.query(
          `INSERT INTO reports_summary (organization_id, report_type, metrics_json) VALUES (?, ?, ?)`,
          [organizationId, 'OVERVIEW_DASHBOARD', initialMetrics]
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Report summary step skipped:', err.message);
    }

    // 7. Default Broadcast Folder
    try {
      const [existingBcast] = await pool.query(
        `SELECT id FROM broadcast_folders WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingBcast.length === 0) {
        await pool.query(
          `INSERT INTO broadcast_folders (organization_id, folder_name) VALUES (?, ?)`,
          [organizationId, 'Default Broadcasts']
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Broadcast folder step skipped:', err.message);
    }

    // 8. Default Webhook Configuration
    try {
      const [existingWebhooks] = await pool.query(
        `SELECT id FROM webhook_configurations WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingWebhooks.length === 0) {
        const verifyToken = `wh_vt_${crypto.randomBytes(12).toString('hex')}`;
        const secret = `wh_sec_${crypto.randomBytes(16).toString('hex')}`;
        await pool.query(
          `INSERT INTO webhook_configurations (organization_id, url, verify_token, secret, status) VALUES (?, ?, ?, ?, 'Active')`,
          [organizationId, '', verifyToken, secret]
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Webhook config step skipped:', err.message);
    }

    // 9. Default Team
    try {
      const [existingTeams] = await pool.query(
        `SELECT id FROM teams WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      );
      if (existingTeams.length === 0) {
        await pool.query(
          `INSERT INTO teams (organization_id, team_name) VALUES (?, ?)`,
          [organizationId, 'Core Support Team']
        );
      }
    } catch (err) {
      console.warn('[TenantProvisioning] Team step skipped:', err.message);
    }

    console.log(`[TenantProvisioning] ✅ Successfully provisioned default data for Organization ID: ${organizationId}`);
    return true;
  } catch (err) {
    console.error(`[TenantProvisioning] ❌ Error provisioning default tenant data:`, err);
    return false;
  }
}
