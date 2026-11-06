import cron from 'node-cron';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';
import whatsappService from './whatsappService.js';
import { sendCentralTemplateMessage } from './templateMessageSenderService.js';
import { emitToOrganization } from '../utils/socket.js';

let task = null;
let running = false;
const temporaryCodes = new Set(['1', '2', '4', '17', '32', '429', '500', '502', '503', '504', '613', '80007', '130429', '131016', '131048', '131056']);

const parseVars = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};
const interpolate = (text, recipient) => {
  const values = { ...parseVars(recipient.variables), name: recipient.name || '', phone: recipient.phone };
  return String(text || '').replace(/{{\s*([^{}]+)\s*}}/g, (_match, key) => String(values[key.trim()] ?? ''));
};
const errorInfo = (result) => {
  const details = result?.details || {};
  const code = String(details.code || details.error?.code || result?.code || result?.statusCode || 'SEND_FAILED');
  return { code, message: String(result?.message || details.message || 'Message send failed').slice(0, 500) };
};

async function claimDueLogs(limit = 25) {
  const conn = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await conn.query("SELECT GET_LOCK('followup_scheduler_claim',0) acquired");
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) return [];
    await conn.beginTransaction();
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const [rows] = await conn.query(
      `SELECT l.id FROM followup_logs l
       JOIN followup_sequences s ON s.id=l.sequence_id
       JOIN followup_recipients r ON r.id=l.recipient_id
       WHERE l.status='pending' AND l.scheduled_at<=UTC_TIMESTAMP()
         AND l.attempts<3 AND s.status='active' AND s.deleted_at IS NULL AND r.status='active'
       ORDER BY l.scheduled_at,l.id LIMIT ${safeLimit} FOR UPDATE`
    );
    if (!rows.length) { await conn.commit(); return []; }
    const ids = rows.map(row => row.id);
    await conn.query(`UPDATE followup_logs SET status='processing',attempts=attempts+1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    await conn.commit();
    return ids;
  } catch (err) { await conn.rollback(); throw err; } finally {
    if (lockAcquired) await conn.query("SELECT RELEASE_LOCK('followup_scheduler_claim')").catch(() => {});
    conn.release();
  }
}

async function loadLog(id) {
  const [rows] = await pool.query(
    `SELECT l.*,s.whatsapp_account_id,s.user_id,s.name sequence_name,st.step_type,st.message_text,
      st.template_name,st.template_language,st.template_variables,st.header_media_url,
      r.name recipient_name,r.variables,r.status recipient_status
     FROM followup_logs l JOIN followup_sequences s ON s.id=l.sequence_id
     JOIN followup_steps st ON st.id=l.step_id JOIN followup_recipients r ON r.id=l.recipient_id
     WHERE l.id=? LIMIT 1`, [id]
  );
  return rows[0] || null;
}

async function sendLog(log) {
  const recipient = { phone: log.phone, name: log.recipient_name, variables: log.variables };
  if (log.step_type === 'template') {
    return sendCentralTemplateMessage({
      recipient: log.phone,
      templateName: log.template_name,
      languageCode: log.template_language || 'en_US',
      variables: { ...parseVars(log.template_variables), ...parseVars(log.variables), name: recipient.name || '', phone: recipient.phone },
      customMediaUrl: log.header_media_url || null,
      accountId: log.whatsapp_account_id,
      organizationId: log.organization_id,
      userId: log.user_id,
      campaignName: log.sequence_name,
      campaignType: 'followup',
      featureKey: 'followup'
    });
  }
  return whatsappService.sendTextMessage(interpolate(log.message_text, recipient), '', null, null);
}

async function sendWindowOpeningTemplate(log) {
  return {
    success: false,
    statusCode: 131047,
    message: 'The 24-hour customer service window is closed. WhatsApp requires a template that is approved on this selected WABA; change this follow-up step from Text to Template.'
  };
}

async function processLog(id) {
  const log = await loadLog(id);
  if (!log || log.recipient_status !== 'active') {
    await pool.query("UPDATE followup_logs SET status='skipped',error_message='Recipient is no longer active' WHERE id=? AND status='processing'", [id]);
    return;
  }
  let result;
  if (log.step_type === 'text') {
    const [windowRows] = await pool.query(
      `SELECT id FROM messages
       WHERE organization_id=? AND (direction='incoming' OR sender='contact')
         AND timestamp>=NOW()-INTERVAL 24 HOUR
         AND (sender_phone=? OR phone_number=? OR RIGHT(REGEXP_REPLACE(COALESCE(sender_phone,phone_number,''),'[^0-9]',''),10)=?)
       ORDER BY timestamp DESC LIMIT 1`,
      [log.organization_id, log.phone, log.phone, String(log.phone).slice(-10)]
    );
    if (!windowRows.length) {
      result = await sendWindowOpeningTemplate(log);
    } else {
      result = await whatsappService.sendTextMessage(log.phone, interpolate(log.message_text, { phone: log.phone, name: log.recipient_name, variables: log.variables }), log.whatsapp_account_id, log.organization_id);
    }
  } else result = await sendLog(log);
  if (result?.success) {
    await pool.query("UPDATE followup_logs SET status='sent',message_id=?,sent_at=COALESCE(sent_at,UTC_TIMESTAMP()),error_code=NULL,error_message=NULL WHERE id=?", [result.messageId || result.data?.messages?.[0]?.id || null, id]);
  } else {
    const info = errorInfo(result);
    const retry = info.code !== '131047' && temporaryCodes.has(info.code) && Number(log.attempts) < 3;
    if (retry) {
      await pool.query("UPDATE followup_logs SET status='pending',scheduled_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE),error_code=?,error_message=? WHERE id=?", [Math.max(1, 2 ** Number(log.attempts)), info.code, info.message, id]);
    } else {
      const message = info.code === '131047' ? `24-hour customer service window closed. Use an approved template. ${info.message}` : info.message;
      await pool.query("UPDATE followup_logs SET status='failed',error_code=?,error_message=? WHERE id=?", [info.code, message, id]);
    }
  }
  emitToOrganization(log.organization_id, 'followup_updated', { sequenceId: log.sequence_id, logId: id });
}

async function finishCompletedSequences() {
  const [rows] = await pool.query(
    `SELECT s.id,s.organization_id FROM followup_sequences s
     WHERE s.status='active' AND NOT EXISTS (SELECT 1 FROM followup_logs l WHERE l.sequence_id=s.id AND l.status IN ('pending','processing'))
       AND EXISTS (SELECT 1 FROM followup_logs l2 WHERE l2.sequence_id=s.id)`
  );
  for (const row of rows) {
    await pool.query("UPDATE followup_sequences SET status='completed' WHERE id=? AND status='active'", [row.id]);
    emitToOrganization(row.organization_id, 'followup_updated', { sequenceId: row.id, action: 'completed' });
  }
}

export const runFollowupSchedulerTick = async () => {
  if (running) return;
  running = true;
  try {
    const ids = await claimDueLogs();
    for (const id of ids) {
      try { await processLog(id); } catch (err) {
        logger.error(`[FollowupScheduler] Log ${id} failed: ${err.message}`);
        await pool.query("UPDATE followup_logs SET status=IF(attempts<3,'pending','failed'),scheduled_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 2 MINUTE),error_message=? WHERE id=?", [String(err.message).slice(0, 500), id]).catch(() => {});
      }
    }
    await finishCompletedSequences();
  } catch (err) { logger.error(`[FollowupScheduler] Tick failed: ${err.message}`); } finally { running = false; }
};

export const initFollowupScheduler = () => {
  if (task) return task;
  pool.query("UPDATE followup_logs SET status='pending' WHERE status='processing' AND updated_at<UTC_TIMESTAMP()-INTERVAL 10 MINUTE").catch(err => logger.warn(`[FollowupScheduler] Recovery failed: ${err.message}`));
  task = cron.schedule('* * * * *', runFollowupSchedulerTick);
  logger.info('[FollowupScheduler] Started (every minute).');
  return task;
};
