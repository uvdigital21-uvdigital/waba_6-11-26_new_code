import { pool } from '../config/db.js';
import { emitToOrganization } from '../utils/socket.js';

const VALID_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'cancelled']);
const MUTABLE_STATUSES = new Set(['draft', 'paused']);
const delayMs = { minutes: 60000, hours: 3600000, days: 86400000 };

const orgIdOf = (req) => Number(req.organizationId || req.user?.organization_id || 0);
const userIdOf = (req) => Number(req.user?.id || 0);
const isSuper = (req) => req.user?.role === 'Super Admin';
const canViewAll = (req) => isSuper(req) || Boolean(req.followupPermissions?.can_view_all_users);
const normalizePhone = (value, defaultCountryCode = '91') => {
  const raw = String(value || '').trim();
  if (!raw || /[A-DF-Za-df-z]/.test(raw)) return '';
  let phone = raw.replace(/[\s()+\-.]/g, '').replace(/^0+/, '');
  const countryCode = String(defaultCountryCode || '91').replace(/\D/g, '').replace(/^0+/, '') || '91';
  if (!/^\d+$/.test(phone)) return '';
  if (phone.length === 10) phone = `${countryCode}${phone}`;
  else if (!(phone.startsWith(countryCode) && phone.length === countryCode.length + 10)) return '';
  return phone;
};
const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const dbDate = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

async function activity(conn, req, sequenceId, action, details = {}) {
  await conn.query(
    'INSERT INTO followup_activity_logs (organization_id, sequence_id, user_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [orgIdOf(req) || null, sequenceId || null, userIdOf(req), action, JSON.stringify(details), String(req.ip || '').slice(0, 45)]
  );
}

function validatePayload(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!String(body.name || '').trim()) errors.push('Name is required.');
    if (String(body.name || '').trim().length > 150) errors.push('Name must be 150 characters or fewer.');
  }
  if (!partial || body.steps !== undefined) {
    if (!Array.isArray(body.steps) || body.steps.length === 0) errors.push('At least one follow-up step is required.');
    (body.steps || []).forEach((step, index) => {
      const type = String(step.step_type || step.type || '').toLowerCase();
      if (!['text', 'template'].includes(type)) errors.push(`Step ${index + 1}: invalid type.`);
      if (type === 'text' && !String(step.message_text || step.message || '').trim()) errors.push(`Step ${index + 1}: text is required.`);
      if (type === 'template' && !String(step.template_name || '').trim()) errors.push(`Step ${index + 1}: template is required.`);
      const scheduleType = step.schedule_type || (step.after_previous ? 'relative' : 'absolute');
      if (scheduleType === 'relative') {
        if (!Number.isInteger(Number(step.delay_value)) || Number(step.delay_value) < 1) errors.push(`Step ${index + 1}: delay must be at least 1.`);
        if (!delayMs[step.delay_unit]) errors.push(`Step ${index + 1}: invalid delay unit.`);
      } else if (!dbDate(step.scheduled_at)) errors.push(`Step ${index + 1}: valid date and time are required.`);
    });
  }
  if (!partial || body.recipients !== undefined) {
    if (!Array.isArray(body.recipients) || body.recipients.length === 0) errors.push('At least one valid recipient is required.');
  }
  return errors;
}

function normalizedRecipients(items = [], defaultCountryCode = '91') {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const item of items) {
    const source = typeof item === 'object' ? item : { phone: item };
    const phone = normalizePhone(source.phone || source.number || source.mobile, defaultCountryCode);
    if (!phone) { invalid.push(source.phone || source.number || source.mobile || ''); continue; }
    if (seen.has(phone)) continue;
    seen.add(phone);
    valid.push({ phone, name: String(source.name || '').trim().slice(0, 150) || null, contact_id: source.contact_id || null, variables: parseJson(source.variables, {}) });
  }
  return { valid, invalid };
}

async function getScopedSequence(conn, req, id, lock = false) {
  let sql = 'SELECT * FROM followup_sequences WHERE id = ? AND organization_id = ? AND deleted_at IS NULL';
  const params = [id, orgIdOf(req)];
  if (!canViewAll(req)) { sql += ' AND created_by = ?'; params.push(userIdOf(req)); }
  if (lock) sql += ' FOR UPDATE';
  const [rows] = await conn.query(sql, params);
  return rows[0] || null;
}

async function insertSteps(conn, sequenceId, steps) {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const type = String(step.step_type || step.type).toLowerCase();
    const scheduleType = step.schedule_type || (step.after_previous ? 'relative' : 'absolute');
    await conn.query(
      `INSERT INTO followup_steps
       (sequence_id, step_number, step_type, message_text, template_name, template_language, template_variables, header_media_url, schedule_type, scheduled_at, delay_value, delay_unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [sequenceId, index + 1, type, type === 'text' ? String(step.message_text || step.message || '').trim() : null,
        type === 'template' ? String(step.template_name || '').trim() : null, step.template_language || 'en_US',
        JSON.stringify(parseJson(step.template_variables, {})), step.header_media_url || null, scheduleType,
        scheduleType === 'absolute' ? dbDate(step.scheduled_at) : null,
        scheduleType === 'relative' ? Number(step.delay_value) : null, scheduleType === 'relative' ? step.delay_unit : null]
    );
  }
}

async function insertRecipients(conn, sequenceId, recipients) {
  for (const recipient of recipients) {
    await conn.query(
      `INSERT INTO followup_recipients (sequence_id, contact_id, phone, name, variables, status)
       VALUES (?, ?, ?, ?, ?, 'active') ON DUPLICATE KEY UPDATE name = VALUES(name), variables = VALUES(variables), status = IF(status='removed','active',status)`,
      [sequenceId, recipient.contact_id, recipient.phone, recipient.name, JSON.stringify(recipient.variables)]
    );
  }
}

async function generateLogs(conn, sequence) {
  const [steps] = await conn.query(
    "SELECT id,sequence_id,step_number,step_type,message_text,template_name,template_language,template_variables,header_media_url,schedule_type,DATE_FORMAT(scheduled_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at,delay_value,delay_unit,status FROM followup_steps WHERE sequence_id=? ORDER BY step_number",
    [sequence.id]
  );
  const [recipients] = await conn.query("SELECT * FROM followup_recipients WHERE sequence_id = ? AND status = 'active'", [sequence.id]);
  if (!steps.length || !recipients.length) throw new Error('Activation requires at least one step and one active recipient.');
  let previousTime = new Date();
  const stepTimes = new Map();
  for (const step of steps) {
    let scheduled;
    if (step.schedule_type === 'relative') {
      scheduled = new Date(previousTime.getTime() + Number(step.delay_value) * delayMs[step.delay_unit]);
    } else scheduled = new Date(step.scheduled_at);
    if (Number.isNaN(scheduled.getTime())) throw new Error(`Step ${step.step_number} has an invalid schedule.`);
    previousTime = scheduled;
    stepTimes.set(step.id, scheduled);
  }
  for (const step of steps) {
    for (const recipient of recipients) {
      await conn.query(
        `INSERT INTO followup_logs (sequence_id, step_id, recipient_id, organization_id, phone, status, attempts, scheduled_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)
         ON DUPLICATE KEY UPDATE scheduled_at = IF(status IN ('pending','failed','skipped'), VALUES(scheduled_at), scheduled_at), status = IF(status IN ('failed','skipped'), 'pending', status), error_code = NULL, error_message = NULL`,
        [sequence.id, step.id, recipient.id, sequence.organization_id, recipient.phone, dbDate(stepTimes.get(step.id))]
      );
    }
  }
}

export const listFollowups = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const params = [orgIdOf(req)];
    let where = 's.organization_id = ? AND s.deleted_at IS NULL';
    if (!canViewAll(req)) { where += ' AND s.created_by = ?'; params.push(userIdOf(req)); }
    if (req.query.status && VALID_STATUSES.has(req.query.status)) { where += ' AND s.status = ?'; params.push(req.query.status); }
    if (String(req.query.search || '').trim()) { where += ' AND (s.name LIKE ? OR s.description LIKE ?)'; const q = `%${String(req.query.search).trim()}%`; params.push(q, q); }
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM followup_sequences s WHERE ${where}`, params);
    const [rows] = await pool.query(
      `SELECT s.*, COALESCE(u.full_name,u.name,u.username,CONCAT('User #',s.created_by)) created_by_name,
       COUNT(DISTINCT st.id) steps_count, COUNT(DISTINCT r.id) recipients_count,
       COUNT(DISTINCT CASE WHEN l.status='pending' THEN l.id END) pending_count,
       COUNT(DISTINCT CASE WHEN l.status='sent' THEN l.id END) sent_count,
       COUNT(DISTINCT CASE WHEN l.status='delivered' THEN l.id END) delivered_count,
       COUNT(DISTINCT CASE WHEN l.status='read' THEN l.id END) read_count,
       COUNT(DISTINCT CASE WHEN l.status='failed' THEN l.id END) failed_count,
       (SELECT fl.error_code FROM followup_logs fl WHERE fl.sequence_id=s.id AND fl.status='failed' ORDER BY fl.id DESC LIMIT 1) latest_error_code,
       (SELECT fl.error_message FROM followup_logs fl WHERE fl.sequence_id=s.id AND fl.status='failed' ORDER BY fl.id DESC LIMIT 1) latest_error_message,
       (SELECT fl.phone FROM followup_logs fl WHERE fl.sequence_id=s.id AND fl.status='failed' ORDER BY fl.id DESC LIMIT 1) latest_error_phone,
       DATE_FORMAT(MIN(CASE WHEN l.status='pending' THEN l.scheduled_at END),'%Y-%m-%dT%H:%i:%sZ') next_scheduled_at
       FROM followup_sequences s LEFT JOIN users u ON u.id=s.created_by
       LEFT JOIN followup_steps st ON st.sequence_id=s.id
       LEFT JOIN followup_recipients r ON r.sequence_id=s.id AND r.status<>'removed'
       LEFT JOIN followup_logs l ON l.sequence_id=s.id
       WHERE ${where} GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    res.json({ success: true, data: rows, pagination: { page, limit, total: Number(countRows[0].total), totalPages: Math.ceil(Number(countRows[0].total) / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const createFollowup = async (req, res) => {
  const errors = validatePayload(req.body);
  const recipients = normalizedRecipients(req.body.recipients, req.body.default_country_code);
  if (!recipients.valid.length) errors.push('No valid recipient phone numbers were supplied.');
  if (errors.length) return res.status(422).json({ success: false, message: errors[0], errors, invalid_numbers: recipients.invalid });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const requestedStatus = req.body.status === 'active' ? 'active' : 'draft';
    const [result] = await conn.query(
      `INSERT INTO followup_sequences (organization_id,user_id,whatsapp_account_id,name,description,status,timezone,stop_on_reply,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [orgIdOf(req), userIdOf(req), req.body.whatsapp_account_id || null, String(req.body.name).trim(), String(req.body.description || '').trim() || null,
        requestedStatus, req.body.timezone || 'Asia/Kolkata', req.body.stop_on_reply === false || req.body.stop_on_reply === 0 ? 0 : 1, userIdOf(req), userIdOf(req)]
    );
    await insertSteps(conn, result.insertId, req.body.steps);
    await insertRecipients(conn, result.insertId, recipients.valid);
    const sequence = { id: result.insertId, organization_id: orgIdOf(req) };
    if (requestedStatus === 'active') await generateLogs(conn, sequence);
    await activity(conn, req, result.insertId, 'created', { status: requestedStatus, steps: req.body.steps.length, recipients: recipients.valid.length });
    await conn.commit();
    emitToOrganization(orgIdOf(req), 'followup_updated', { sequenceId: result.insertId, action: 'created' });
    res.status(201).json({ success: true, data: { id: result.insertId }, invalid_numbers: recipients.invalid });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
};

export const getById = async (req, res) => {
  try {
    const sequence = await getScopedSequence(pool, req, req.params.id);
    if (!sequence) return res.status(404).json({ success: false, message: 'Follow-up not found.' });
    const [steps] = await pool.query("SELECT id,sequence_id,step_number,step_type,message_text,template_name,template_language,template_variables,header_media_url,schedule_type,DATE_FORMAT(scheduled_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at,delay_value,delay_unit,status,created_at,updated_at FROM followup_steps WHERE sequence_id=? ORDER BY step_number", [sequence.id]);
    const [recipients] = await pool.query(`SELECT r.*,
      COUNT(l.id) total_logs, SUM(l.status='pending') pending_count, SUM(l.status='sent') sent_count,
      SUM(l.status='delivered') delivered_count, SUM(l.status='read') read_count, SUM(l.status='failed') failed_count
      FROM followup_recipients r LEFT JOIN followup_logs l ON l.recipient_id=r.id WHERE r.sequence_id=? GROUP BY r.id ORDER BY r.id DESC`, [sequence.id]);
    const [summaryRows] = await pool.query(`SELECT COUNT(*) total, SUM(status='pending') pending_count, SUM(status='sent') sent_count, SUM(status='delivered') delivered_count, SUM(status='read') read_count, SUM(status='failed') failed_count FROM followup_logs WHERE sequence_id=?`, [sequence.id]);
    const [repliedRows] = await pool.query("SELECT COUNT(*) replied FROM followup_recipients WHERE sequence_id=? AND status='replied'", [sequence.id]);
    const counts = summaryRows[0] || {};
    res.json({ success: true, data: { ...sequence, steps: steps.map(s => ({ ...s, template_variables: parseJson(s.template_variables) })), recipients: recipients.map(r => ({ ...r, variables: parseJson(r.variables) })), summary: { total: counts.total || 0, pending: counts.pending_count || 0, sent: counts.sent_count || 0, delivered: counts.delivered_count || 0, read: counts.read_count || 0, failed: counts.failed_count || 0, replied: repliedRows[0].replied } } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const update = async (req, res) => {
  const errors = validatePayload(req.body, true);
  if (errors.length) return res.status(422).json({ success: false, message: errors[0], errors });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const sequence = await getScopedSequence(conn, req, req.params.id, true);
    if (!sequence) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Follow-up not found.' }); }
    if (!MUTABLE_STATUSES.has(sequence.status)) { await conn.rollback(); return res.status(409).json({ success: false, message: 'Only draft or paused follow-ups can be edited.' }); }
    await conn.query(`UPDATE followup_sequences SET name=?,description=?,whatsapp_account_id=?,timezone=?,stop_on_reply=?,updated_by=? WHERE id=?`,
      [String(req.body.name ?? sequence.name).trim(), req.body.description ?? sequence.description, req.body.whatsapp_account_id ?? sequence.whatsapp_account_id,
        req.body.timezone || sequence.timezone, req.body.stop_on_reply === undefined ? sequence.stop_on_reply : (req.body.stop_on_reply ? 1 : 0), userIdOf(req), sequence.id]);
    if (Array.isArray(req.body.steps)) { await conn.query('DELETE FROM followup_logs WHERE sequence_id=?', [sequence.id]); await conn.query('DELETE FROM followup_steps WHERE sequence_id=?', [sequence.id]); await insertSteps(conn, sequence.id, req.body.steps); }
    if (Array.isArray(req.body.recipients)) { const normalized = normalizedRecipients(req.body.recipients, req.body.default_country_code); await conn.query('DELETE FROM followup_logs WHERE sequence_id=?', [sequence.id]); await conn.query('DELETE FROM followup_recipients WHERE sequence_id=?', [sequence.id]); await insertRecipients(conn, sequence.id, normalized.valid); }
    await activity(conn, req, sequence.id, 'updated');
    await conn.commit();
    emitToOrganization(orgIdOf(req), 'followup_updated', { sequenceId: sequence.id, action: 'updated' });
    res.json({ success: true });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); } finally { conn.release(); }
};

export const changeStatus = async (req, res) => {
  const status = String(req.body.status || '').toLowerCase();
  if (!['active', 'paused', 'cancelled'].includes(status)) return res.status(422).json({ success: false, message: 'Status must be active, paused, or cancelled.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const sequence = await getScopedSequence(conn, req, req.params.id, true);
    if (!sequence) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Follow-up not found.' }); }
    if (status === 'active') {
      if (!['draft', 'paused'].includes(sequence.status)) throw new Error('Only draft or paused follow-ups can be activated.');
      await generateLogs(conn, sequence);
    } else if (status === 'paused' && sequence.status !== 'active') throw new Error('Only an active follow-up can be paused.');
    else if (status === 'cancelled') await conn.query("UPDATE followup_logs SET status='skipped',error_message='Sequence cancelled' WHERE sequence_id=? AND status IN ('pending','processing')", [sequence.id]);
    await conn.query('UPDATE followup_sequences SET status=?,updated_by=? WHERE id=?', [status, userIdOf(req), sequence.id]);
    await activity(conn, req, sequence.id, status === 'active' && sequence.status === 'paused' ? 'resumed' : status);
    await conn.commit();
    emitToOrganization(orgIdOf(req), 'followup_updated', { sequenceId: sequence.id, action: status });
    res.json({ success: true, status });
  } catch (err) { await conn.rollback(); res.status(409).json({ success: false, message: err.message }); } finally { conn.release(); }
};

export const softDelete = async (req, res) => {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const sequence = await getScopedSequence(conn, req, req.params.id, true); if (!sequence) { await conn.rollback(); return res.status(404).json({ success:false,message:'Follow-up not found.' }); }
    await conn.query("UPDATE followup_sequences SET deleted_at=NOW(),status='cancelled',updated_by=? WHERE id=?", [userIdOf(req), sequence.id]);
    await conn.query("UPDATE followup_logs SET status='skipped',error_message='Sequence deleted' WHERE sequence_id=? AND status IN ('pending','processing')", [sequence.id]);
    await activity(conn, req, sequence.id, 'deleted'); await conn.commit(); emitToOrganization(orgIdOf(req),'followup_updated',{sequenceId:sequence.id,action:'deleted'}); res.json({success:true});
  } catch(err){await conn.rollback();res.status(500).json({success:false,message:err.message});} finally{conn.release();}
};

export const addRecipients = async (req, res) => {
  const normalized = normalizedRecipients(req.body.recipients || [], req.body.default_country_code);
  if (!normalized.valid.length) return res.status(422).json({ success:false,message:'No valid recipients supplied.',invalid_numbers:normalized.invalid });
  const conn=await pool.getConnection();
  try{await conn.beginTransaction();const sequence=await getScopedSequence(conn,req,req.params.id,true);if(!sequence){await conn.rollback();return res.status(404).json({success:false,message:'Follow-up not found.'});}
    await insertRecipients(conn,sequence.id,normalized.valid);if(sequence.status==='active')await generateLogs(conn,sequence);await activity(conn,req,sequence.id,'recipients_added',{count:normalized.valid.length});await conn.commit();emitToOrganization(orgIdOf(req),'followup_updated',{sequenceId:sequence.id,action:'recipients_added'});res.json({success:true,added:normalized.valid.length,invalid_numbers:normalized.invalid});
  }catch(err){await conn.rollback();res.status(500).json({success:false,message:err.message});}finally{conn.release();}
};

export const removeRecipient = async (req, res) => {
  const conn=await pool.getConnection();
  try{await conn.beginTransaction();const sequence=await getScopedSequence(conn,req,req.params.id,true);if(!sequence){await conn.rollback();return res.status(404).json({success:false,message:'Follow-up not found.'});}
    const [result]=await conn.query("UPDATE followup_recipients SET status='removed',stop_reason='Removed by user' WHERE id=? AND sequence_id=?",[req.params.recipientId,sequence.id]);if(!result.affectedRows){await conn.rollback();return res.status(404).json({success:false,message:'Recipient not found.'});}
    await conn.query("UPDATE followup_logs SET status='skipped',error_message='Recipient removed' WHERE recipient_id=? AND status IN ('pending','processing')",[req.params.recipientId]);await activity(conn,req,sequence.id,'recipient_removed',{recipient_id:req.params.recipientId});await conn.commit();emitToOrganization(orgIdOf(req),'followup_updated',{sequenceId:sequence.id,action:'recipient_removed'});res.json({success:true});
  }catch(err){await conn.rollback();res.status(500).json({success:false,message:err.message});}finally{conn.release();}
};

export const getLogs = async (req, res) => {
    try{const sequence=await getScopedSequence(pool,req,req.params.id);if(!sequence)return res.status(404).json({success:false,message:'Follow-up not found.'});const page=Math.max(1,Number(req.query.page)||1);const limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));const params=[sequence.id];let where='l.sequence_id=?';if(String(req.query.search||'').trim()){where+=' AND (l.phone LIKE ? OR r.name LIKE ?)';const q=`%${String(req.query.search).trim()}%`;params.push(q,q);}const logFields="l.id,l.sequence_id,l.step_id,l.recipient_id,l.organization_id,l.phone,l.message_id,l.status,l.error_code,l.error_message,l.attempts,DATE_FORMAT(l.scheduled_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at,DATE_FORMAT(l.sent_at,'%Y-%m-%dT%H:%i:%sZ') sent_at,DATE_FORMAT(l.delivered_at,'%Y-%m-%dT%H:%i:%sZ') delivered_at,DATE_FORMAT(l.read_at,'%Y-%m-%dT%H:%i:%sZ') read_at";const [[count],[rows]]=await Promise.all([pool.query(`SELECT COUNT(*) total FROM followup_logs l LEFT JOIN followup_recipients r ON r.id=l.recipient_id WHERE ${where}`,params),pool.query(`SELECT ${logFields},r.name recipient_name,r.status recipient_status,st.step_number,st.step_type FROM followup_logs l JOIN followup_recipients r ON r.id=l.recipient_id JOIN followup_steps st ON st.id=l.step_id WHERE ${where} ORDER BY l.scheduled_at,l.id LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit])]);res.json({success:true,data:rows,pagination:{page,limit,total:Number(count[0].total),totalPages:Math.ceil(Number(count[0].total)/limit)}});
  }catch(err){res.status(500).json({success:false,message:err.message});}
};

export const getAllLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const params = [orgIdOf(req)];
    let where = 's.organization_id=? AND s.deleted_at IS NULL';
    if (!canViewAll(req)) { where += ' AND s.created_by=?'; params.push(userIdOf(req)); }
    if (String(req.query.sequence_id || '').trim()) { where += ' AND s.id=?'; params.push(Number(req.query.sequence_id)); }
    if (String(req.query.search || '').trim()) {
      const q = `%${String(req.query.search).trim()}%`;
      where += ' AND (s.name LIKE ? OR l.phone LIKE ? OR r.name LIKE ? OR st.template_name LIKE ?)';
      params.push(q, q, q, q);
    }
    const from = `FROM followup_logs l JOIN followup_sequences s ON s.id=l.sequence_id JOIN followup_recipients r ON r.id=l.recipient_id JOIN followup_steps st ON st.id=l.step_id WHERE ${where}`;
    const fields = `l.id,l.sequence_id,s.name sequence_name,s.timezone,l.phone,l.message_id,l.status,l.error_code,l.error_message,l.attempts,st.step_number,st.step_type,st.template_name,r.name recipient_name,DATE_FORMAT(l.scheduled_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at,DATE_FORMAT(l.sent_at,'%Y-%m-%dT%H:%i:%sZ') sent_at,DATE_FORMAT(l.delivered_at,'%Y-%m-%dT%H:%i:%sZ') delivered_at,DATE_FORMAT(l.read_at,'%Y-%m-%dT%H:%i:%sZ') read_at`;
    const [[countRows], [rows]] = await Promise.all([
      pool.query(`SELECT COUNT(*) total ${from}`, params),
      pool.query(`SELECT ${fields} ${from} ORDER BY COALESCE(l.sent_at,l.scheduled_at) DESC,l.id DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit])
    ]);
    const total = Number(countRows[0]?.total || 0);
    res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const csvCell=(v)=>`"${String(v??'').replace(/"/g,'""')}"`;
export const exportCsv = async (req, res) => {
  try{const sequence=await getScopedSequence(pool,req,req.params.id);if(!sequence)return res.status(404).json({success:false,message:'Follow-up not found.'});const [rows]=await pool.query(`SELECT l.phone,r.name,st.step_number,st.step_type,l.status,l.scheduled_at,l.sent_at,l.delivered_at,l.read_at,l.error_code,l.error_message,l.message_id FROM followup_logs l JOIN followup_recipients r ON r.id=l.recipient_id JOIN followup_steps st ON st.id=l.step_id WHERE l.sequence_id=? ORDER BY l.phone,st.step_number`,[sequence.id]);const headers=['phone','name','step_number','step_type','status','scheduled_at','sent_at','delivered_at','read_at','error_code','error_message','message_id'];const csv=[headers.join(','),...rows.map(row=>headers.map(h=>csvCell(row[h])).join(','))].join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="followup-${sequence.id}.csv"`);res.send(`\uFEFF${csv}`);
  }catch(err){res.status(500).json({success:false,message:err.message});}
};
