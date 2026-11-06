import { pool } from '../config/db.js';

/**
 * Service to log all Agent activities into agent_activity_logs table
 */
export async function logActivity(data = {}) {
  try {
    const {
      agent_id = 'AGT001',
      agent_name = 'System Admin',
      agent_email = 'admin@officialwa.com',
      agent_role = 'Admin',
      activity_type = 'SEND_WA',
      module = 'SendWA',
      message_type = 'text',
      template_name = null,
      customer_name = null,
      customer_number = null,
      message = null,
      status = 'Sent',
      source = 'WEB',
      campaign_name = null,
      chat_id = null,
      conversation_id = null,
      api_name = null,
      ip_address = null,
      device = null
    } = data;

    const [result] = await pool.query(
      `INSERT INTO agent_activity_logs 
       (agent_id, agent_name, agent_email, agent_role, activity_type, module, message_type, template_name, customer_name, customer_number, message, status, source, campaign_name, chat_id, conversation_id, api_name, ip_address, device) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent_id,
        agent_name,
        agent_email,
        agent_role,
        activity_type,
        module,
        message_type,
        template_name,
        customer_name,
        customer_number,
        message,
        status,
        source,
        campaign_name,
        chat_id,
        conversation_id,
        api_name,
        ip_address,
        device
      ]
    );

    return result.insertId;
  } catch (err) {
    console.error('[ActivityLogger] Error inserting log:', err.message || err);
    return null;
  }
}

/**
 * Update message status based on webhook updates (Delivered, Read, Failed)
 */
export async function updateActivityStatus(customer_number, newStatus) {
  try {
    if (!customer_number || !newStatus) return;
    const cleanNumber = String(customer_number).replace(/\D/g, '');
    await pool.query(
      `UPDATE agent_activity_logs 
       SET status = ? 
       WHERE (customer_number = ? OR customer_number LIKE ?) 
       ORDER BY id DESC LIMIT 1`,
      [newStatus, customer_number, `%${cleanNumber}%`]
    );
  } catch (err) {
    console.error('[ActivityLogger] Error updating status:', err.message || err);
  }
}
