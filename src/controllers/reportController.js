import { pool } from '../config/db.js';
import logger from '../utils/logger.js';
import { startResendJob } from '../services/campaignResendService.js';

const toIsoDate = (d) => {
  if (!d) return null;
  const parsed = d instanceof Date ? d : new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const readableApiMessage = (value, templateName = '') => {
  if (templateName) return `Template: ${templateName}`;
  let parsed = value;
  for (let i = 0; i < 2 && typeof parsed === 'string'; i++) {
    const text = parsed.trim();
    if (!text || (!text.startsWith('{') && !text.startsWith('"{'))) break;
    try { parsed = JSON.parse(text); } catch { break; }
  }
  if (!parsed || typeof parsed !== 'object') return String(value || 'API Message');
  const template = parsed.template_name || parsed.templateName || parsed.name || parsed.template?.name;
  if (template) return `Template: ${template}`;
  const message = parsed.message || parsed.text || parsed.body?.text || parsed.content;
  if (typeof message === 'string' && message.trim()) return message.trim();
  const event = parsed.eventId || parsed.event_id || parsed.event;
  if (event) return `API Event: ${event}`;
  return 'API Message';
};

/**
 * GET /api/reports/sending-history
 * Read-only history endpoint. It must never update campaign or resend-job state.
 */
export const getSendingHistory = async (req, res) => {
  const userId = req.user?.id || 1;
  const organizationId = req.organizationId || req.user?.organization_id || null;
  const selectedAccountId = req.query.account_id || req.headers['x-account-id'] || null;

  let connection;
  try {
    connection = await pool.getConnection();

    const historyItems = [];
    const seenSignatures = new Map();

    const normalizePhone = phone => (phone || '').replace(/[^0-9]/g, '').trim();
    const normalizeDate = rawDate => (rawDate ? rawDate.slice(0, 19) : '');
    const buildSignature = (phone, rawDate) =>
      `${normalizePhone(phone)}|${normalizeDate(rawDate)}`;

    const pushUnique = item => {
      if (!item.phone || !item.rawDate) {
        historyItems.push(item);
        return;
      }

      const sig = buildSignature(item.phone, item.rawDate);
      if (seenSignatures.has(sig)) {
        const existing = historyItems[seenSignatures.get(sig)];
        existing.read = Math.max(existing.read || 0, item.read || 0);
        existing.dlvd = Math.max(existing.dlvd || 0, item.dlvd || 0);
        existing.failed = Math.max(existing.failed || 0, item.failed || 0);

        const rank = { failed: 0, sent: 1, delivered: 2, read: 3 };
        const existingRank = rank[(existing.status || '').toLowerCase()] ?? 1;
        const newRank = rank[(item.status || '').toLowerCase()] ?? 1;
        if (newRank > existingRank) existing.status = item.status;
        return;
      }

      seenSignatures.set(sig, historyItems.length);
      historyItems.push(item);
    };

    // 1. Campaign history, scoped to the current organization.
    const existingCampaignIds = new Set();
    try {
      let campaignQuery = `
        SELECT c.id,c.user_id,c.sender_name,c.sender_type,c.organization_id,
               c.whatsapp_account_id,c.campaign_name,c.template_name,c.language_code,
               c.country,c.scheduled_at,c.total_numbers,c.sent_count,c.failed_count,
               c.status,c.created_at,c.updated_at,
               COALESCE(c.sender_name, sender.full_name, sender.name, sender.username) AS sent_by_name,
               sender.username AS sent_by_username,
               COALESCE(sender.is_team_member, 0) AS sent_by_team_member,
               (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id) AS recipients_count_calc,
               (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND (LOWER(cr.status)='read' OR cr.read_at IS NOT NULL)) AS read_count_calc,
               (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND (LOWER(cr.status) IN ('delivered', 'read') OR cr.delivered_at IS NOT NULL)) AS delivered_count_calc,
               (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND LOWER(cr.status) IN ('sent', 'delivered', 'read')) AS sent_count_calc,
               (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id=c.id AND LOWER(cr.status)='failed') AS failed_count_calc,
               (SELECT MIN(cr.phone) FROM campaign_recipients cr WHERE cr.campaign_id=c.id) AS recipient_phone_sample
        FROM campaigns c
        LEFT JOIN users sender ON sender.id=c.user_id`;
      const campaignParams = [];

      if (organizationId) {
        campaignQuery += ' WHERE (c.organization_id=? OR c.organization_id IS NULL OR c.user_id=?)';
        campaignParams.push(organizationId, userId);
      } else {
        campaignQuery += ' WHERE (c.organization_id IS NULL OR c.user_id=?)';
        campaignParams.push(userId);
      }

      if (selectedAccountId) {
        campaignQuery += ' AND (c.whatsapp_account_id=? OR c.whatsapp_account_id IS NULL)';
        campaignParams.push(selectedAccountId);
      }

      campaignQuery += ' ORDER BY c.id DESC LIMIT 200';

      const [campaignRows] = await connection.execute(campaignQuery, campaignParams);

      for (const c of campaignRows) {
        existingCampaignIds.add(Number(c.id));
        existingCampaignIds.add(String(c.id));

        const hasRecipientRecords = Number(c.recipients_count_calc || 0) > 0;
        const failedVal = hasRecipientRecords
          ? Number(c.failed_count_calc || 0)
          : Number(c.failed_count || 0);
        const readVal = hasRecipientRecords ? Number(c.read_count_calc || 0) : 0;
        const dlvdVal = Number(c.delivered_count_calc || 0);
        const sentVal = hasRecipientRecords
          ? Number(c.sent_count_calc || 0)
          : Number(c.sent_count || 0);
        const totalNum = Math.max(
          0,
          Number(c.total_numbers || 0),
          Number(c.recipients_count_calc || 0)
        );
        const processedVal = Number(c.recipients_count_calc || 0);
        const pendingVal = Math.max(0, totalNum - processedVal);
        const samplePhone = c.recipient_phone_sample || '';
        const phoneSummary = samplePhone
          ? `Phone: ${samplePhone}${processedVal > 1 ? ` (+${processedVal - 1} more recipients)` : ''}`
          : (c.country ? `Country: ${c.country}` : 'Standard');
        const isoDate = toIsoDate(c.created_at);

        historyItems.push({
          id: `campaign_${c.id}`,
          rawId: c.id,
          source: 'campaign',
          type: 'WEB',
          total: totalNum,
          processed: processedVal,
          pending: pendingVal,
          sent: sentVal,
          campaignName: c.campaign_name || 'Campaign Message',
          templateName: c.template_name || '',
          message: c.template_name ? `Template: ${c.template_name}` : (c.campaign_name || 'Campaign Message'),
          submitDate: isoDate,
          rawDate: isoDate,
          read: readVal,
          dlvd: dlvdVal,
          failed: failedVal,
          status: failedVal > 0 && dlvdVal === 0 && readVal === 0
            ? 'failed'
            : (c.status || 'completed'),
          other: phoneSummary,
          phone: samplePhone,
          sentById: c.user_id || null,
          sentByName: c.sent_by_name || c.sent_by_username || 'Unknown user',
          sentByType: c.sender_type || (Number(c.sent_by_team_member) === 1 ? 'Team Member' : 'User')
        });
      }
    } catch (cErr) {
      logger.warn('[ReportController] campaigns query error:', cErr.message);
    }

    // 2. Direct messages not already represented by a campaign row.
    try {
      let mQuery = `SELECT m.id,m.organization_id,m.conversation_id,m.user_id,
          m.whatsapp_account_id,m.contact_id,m.campaign_id,m.message_text,m.sender,
          m.timestamp,m.status,m.company_id,m.wa_message_id,m.sender_phone,
          m.recipient_phone,m.media_id,m.media_url,m.message_type,m.flow_id,m.node_id,
          m.instance_id,m.wamid,m.phone_number,m.direction,m.session_id,m.error,
          m.error_code,m.error_details,
          COALESCE(sender.full_name, sender.name, sender.username) AS sent_by_name,
          sender.username AS sent_by_username,
          COALESCE(sender.is_team_member, 0) AS sent_by_team_member
        FROM messages m
        LEFT JOIN users sender ON sender.id=m.user_id
        WHERE m.sender='user'
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(m.raw_payload,'$.campaignType')),'') <> 'followup'
          AND NOT EXISTS (
            SELECT 1 FROM followup_logs fl
            WHERE fl.message_id IS NOT NULL
              AND BINARY fl.message_id=BINARY COALESCE(m.wa_message_id,m.wamid)
          )`;
      const mParams = [];

      if (organizationId) {
        mQuery += ' AND (m.organization_id=? OR (m.organization_id IS NULL AND m.user_id=?))';
        mParams.push(organizationId, userId);
      } else {
        mQuery += ' AND (m.user_id=? OR m.organization_id IS NULL)';
        mParams.push(userId);
      }

      if (selectedAccountId) {
        mQuery += ' AND (m.whatsapp_account_id=? OR m.whatsapp_account_id IS NULL)';
        mParams.push(selectedAccountId);
      }

      mQuery += ' ORDER BY m.id DESC LIMIT 200';
      const [mRows] = await connection.execute(mQuery, mParams);
      const groupedBatches = new Map();
      const singleMessages = [];

      for (const m of mRows) {
        if (m.campaign_id &&
          (existingCampaignIds.has(Number(m.campaign_id)) ||
            existingCampaignIds.has(String(m.campaign_id)))) continue;

        const msgTxt = m.message_text || m.text || m.content || 'Direct Message';
        const isCampaignMsg = msgTxt.startsWith('[Campaign:') ||
          msgTxt.startsWith('[Template:') || (m.campaign_id && m.campaign_id > 0);
        const statusLower = (m.status || '').toLowerCase();
        const isRead = statusLower === 'read' || Number(m.read || m.is_read || 0) === 1;
        const isFailed = statusLower === 'failed';
        const phone = m.phone || m.recipient_phone || m.sender_phone || '';
        const isoDate = toIsoDate(m.timestamp || m.created_at || m.sent_at);

        if (isCampaignMsg) {
          let campName = 'Quick Broadcast';
          const matchCamp = msgTxt.match(/\[Campaign:\s*(.*?)\s*-\s*Template:\s*(.*?)\]/i);
          const matchTpl = msgTxt.match(/\[Template:\s*(.*?)\]/i);
          let tplName = '';

          if (matchCamp) {
            campName = matchCamp[1];
            tplName = matchCamp[2];
          } else if (matchTpl) {
            tplName = matchTpl[1];
            campName = `Quick Broadcast - ${tplName}`;
          }

          const timeBucket = isoDate ? isoDate.slice(0, 15) : `time_${m.id}`;
          const batchKey = m.campaign_id ? `camp_${m.campaign_id}` : `text_${msgTxt}_${timeBucket}`;

          if (!groupedBatches.has(batchKey)) {
            groupedBatches.set(batchKey, {
              id: `batch_msg_${m.id}`,
              rawId: m.campaign_id || m.id,
              source: 'campaign',
              type: 'WEB',
              total: 0,
              campaignName: campName,
              templateName: tplName,
              message: msgTxt,
              submitDate: isoDate,
              rawDate: isoDate,
              read: 0,
              dlvd: 0,
              failed: 0,
              status: 'completed',
              sentById: m.user_id || null,
              sentByName: m.sent_by_name || m.sent_by_username || 'Unknown user',
              sentByType: Number(m.sent_by_team_member) === 1 ? 'Team Member' : 'User',
              phones: []
            });
          }

          const batch = groupedBatches.get(batchKey);
          batch.total += 1;
          if (isRead) batch.read += 1;
          if (statusLower === 'delivered' || isRead) batch.dlvd += 1;
          if (isFailed) batch.failed += 1;
          if (phone && !batch.phones.includes(phone)) batch.phones.push(phone);
        } else {
          const failedErrorDesc = m.error ||
            (isFailed ? 'Delivery failed; check Meta error details.' : null);
          singleMessages.push({
            id: `msg_${m.id}`,
            rawId: m.id,
            source: 'direct_message',
            type: 'WEB',
            total: 1,
            campaignName: `Quick Broadcast - ${phone || 'Recipient'}`,
            templateName: '',
            message: msgTxt,
            submitDate: isoDate,
            rawDate: isoDate,
            read: isRead ? 1 : 0,
            dlvd: (statusLower === 'delivered' || isRead) ? 1 : 0,
            failed: isFailed ? 1 : 0,
            status: m.status || 'sent',
            other: `Phone: ${phone || 'Direct'}`,
            phone,
            error: failedErrorDesc,
            metaErrorMessage: failedErrorDesc,
            metaErrorCode: isFailed
              ? (m.error?.match(/\b(\d{5,6})\b/)?.[1] || '131047')
              : null,
            sentById: m.user_id || null,
            sentByName: m.sent_by_name || m.sent_by_username || 'Unknown user',
            sentByType: Number(m.sent_by_team_member) === 1 ? 'Team Member' : 'User'
          });
        }
      }

      for (const batch of groupedBatches.values()) {
        const phoneListStr = batch.phones.join(', ');
        historyItems.push({
          id: batch.id,
          rawId: batch.rawId,
          source: 'campaign',
          type: batch.type,
          total: batch.total,
          campaignName: batch.campaignName,
          templateName: batch.templateName,
          message: batch.message,
          submitDate: batch.submitDate,
          rawDate: batch.rawDate,
          read: batch.read,
          dlvd: batch.dlvd,
          failed: batch.failed,
          status: batch.failed > 0 && batch.dlvd === 0 ? 'failed' : 'completed',
          other: phoneListStr ? `Phone: ${phoneListStr}` : 'Standard',
          phone: phoneListStr,
          sentById: batch.sentById,
          sentByName: batch.sentByName,
          sentByType: batch.sentByType
        });
      }

      for (const single of singleMessages) pushUnique(single);
    } catch (mErr) {
      logger.warn('[ReportController] messages query error:', mErr.message);
    }

    // 3. Optional developer API request/test logs.
    if (req.query.include_api === 'true') {
      try {
        let apiQuery = 'SELECT * FROM message_logs';
        const apiParams = [];

        if (organizationId) {
          apiQuery += ' WHERE (user_id=? OR user_id IN (SELECT id FROM users WHERE organization_id=?))';
          apiParams.push(userId, organizationId);
        } else {
          apiQuery += ' WHERE user_id=?';
          apiParams.push(userId);
        }

        apiQuery += ' ORDER BY id DESC LIMIT 100';
        const [apiRows] = await connection.execute(apiQuery, apiParams);

        for (const apiMsg of apiRows) {
          const statusLower = (apiMsg.status || '').toLowerCase();
          const isRead = statusLower === 'read';
          const isFailed = statusLower === 'failed';
          const recipient = apiMsg.recipient || apiMsg.phone || '';
          const apiDate = toIsoDate(apiMsg.created_at);

          pushUnique({
            id: `api_${apiMsg.id}`,
            rawId: apiMsg.id,
            source: 'api',
            type: 'API',
            total: 1,
            campaignName: `Developer API - ${recipient || 'Recipient'}`,
            templateName: apiMsg.template_name || '',
            message: readableApiMessage(apiMsg.message, apiMsg.template_name),
            submitDate: apiDate,
            rawDate: apiDate,
            read: isRead ? 1 : 0,
            dlvd: (statusLower === 'delivered' || isRead) ? 1 : 0,
            failed: isFailed ? 1 : 0,
            status: apiMsg.status || 'sent',
            other: `Phone: ${recipient || 'API'}`,
            phone: recipient
          });
        }
      } catch (apiErr) {
        logger.warn('[ReportController] message_logs query error:', apiErr.message);
      }
    }

    // 4. Birthday logs.
    try {
      let bQuery = 'SELECT * FROM birthday_logs';
      const bParams = [];

      if (organizationId) {
        bQuery += ' WHERE (organization_id=? OR birthday_campaign_id IN (SELECT id FROM birthday_campaigns WHERE organization_id=?))';
        bParams.push(organizationId, organizationId);
      } else {
        bQuery += ' WHERE organization_id IS NULL';
      }

      bQuery += ' ORDER BY id DESC LIMIT 100';
      const [bRows] = await connection.execute(bQuery, bParams);

      for (const b of bRows) {
        const bStatus = (b.status || '').toLowerCase();
        const bDate = toIsoDate(b.sent_at || b.created_at);

        pushUnique({
          id: `birthday_${b.id}`,
          rawId: b.id,
          source: 'birthday',
          type: 'BIRTHDAY',
          total: 1,
          campaignName: `Birthday Wish - ${b.recipient_name || b.mobile_number}`,
          templateName: b.template_name || '',
          message: `Birthday Template: ${b.template_name || 'Greeting'}`,
          submitDate: bDate,
          rawDate: bDate,
          read: bStatus === 'read' ? 1 : 0,
          dlvd: ['sent', 'delivered', 'read'].includes(bStatus) ? 1 : 0,
          failed: bStatus === 'failed' ? 1 : 0,
          status: b.status || 'sent',
          other: `Recipient: ${b.recipient_name || ''} (${b.mobile_number || ''})`,
          phone: b.mobile_number || ''
        });
      }
    } catch (bErr) {
      logger.warn('[ReportController] birthday_logs query error:', bErr.message);
    }

    historyItems.sort(
      (a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime()
    );

    return res.status(200).json({ success: true, data: historyItems });
  } catch (err) {
    logger.error('[ReportController] Error fetching sending history:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sending history.'
    });
  } finally {
    if (connection) connection.release();
  }
};

const EXPORT_MAX_ROWS = 100000;

/**
 * GET /api/reports/campaign/:id/recipients
 * Read-only recipient and resend-history endpoint.
 */
export const getCampaignRecipients = async (req, res) => {
  const rawId = req.params.id;
  const cleanId = String(rawId)
    .replace(/^campaign_/, '')
    .replace(/^batch_msg_/, '')
    .replace(/^msg_/, '');
  const organizationId = req.organizationId || req.user?.organization_id || null;

  let connection;
  try {
    connection = await pool.getConnection();

    let campaign = null;
    let recipients = [];

    try {
      const scopeSql = organizationId
        ? ' AND (organization_id=? OR organization_id IS NULL)'
        : ' AND organization_id IS NULL';
      const scopeParams = organizationId ? [cleanId, organizationId] : [cleanId];
      const [campRows] = await connection.execute(
        `SELECT * FROM campaigns WHERE id=?${scopeSql}`,
        scopeParams
      );

      if (campRows.length > 0) {
        campaign = campRows[0];

        const allowed = [
          'sent', 'delivered', 'read', 'failed',
          'queued', 'sending', 'uncertain'
        ];
        const status = String(req.query.status || '').toLowerCase();
        const search = String(req.query.search || '').trim();
        const hasPaging = req.query.page !== undefined || req.query.limit !== undefined;
        const isExport =
          String(req.query.export || '').toLowerCase() === 'true' ||
          String(req.query.limit || '').toLowerCase() === 'all' ||
          !hasPaging;
        const page = isExport ? 1 : Math.max(1, Number(req.query.page) || 1);
        const limit = isExport
          ? EXPORT_MAX_ROWS
          : Math.min(500, Math.max(1, Number(req.query.limit) || 10));

        let where = 'campaign_id=?';
        const params = [cleanId];

        if (allowed.includes(status)) {
          where += ' AND LOWER(status)=?';
          params.push(status);
        }

        if (search) {
          where += ' AND (phone LIKE ? OR status LIKE ? OR error LIKE ?)';
          const q = `%${search}%`;
          params.push(q, q, q);
        }

        const [
          [countRows],
          [recipientRows],
          [countGroups],
          [jobRows],
          [resendHistoryRows]
        ] = await Promise.all([
          connection.execute(
            `SELECT COUNT(*) AS total FROM campaign_recipients WHERE ${where}`,
            params
          ),
          connection.execute(
            `SELECT id,phone,message_id,LOWER(status) AS status,error,
                    sent_at,delivered_at,read_at,resend_attempt,original_error,
                    status_history,resend_job_id
             FROM campaign_recipients
             WHERE ${where}
             ORDER BY id ASC
             LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
          ),
          connection.execute(
            `SELECT LOWER(status) AS status,COUNT(*) AS count
             FROM campaign_recipients
             WHERE campaign_id=?
             GROUP BY LOWER(status)`,
            [cleanId]
          ),
          connection.execute(
            `SELECT * FROM campaign_resend_jobs
             WHERE campaign_id=?
             ORDER BY id DESC
             LIMIT 1`,
            [cleanId]
          ),
          connection.execute(
            `SELECT id,campaign_id,organization_id,requested_status,status,
                    total_count,sent_count,failed_count,error_message,
                    started_at,finished_at
             FROM campaign_resend_jobs
             WHERE campaign_id=?
             ORDER BY id DESC`,
            [cleanId]
          )
        ]);

        recipients = recipientRows || [];
        const total = Number(countRows[0]?.total || 0);
        const counts = {
          all: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          queued: 0,
          sending: 0,
          uncertain: 0
        };

        countGroups.forEach(row => {
          const key = String(row.status || '').toLowerCase();
          counts[key] = Number(row.count || 0);
          counts.all += Number(row.count || 0);
        });

        const job = jobRows[0] || null;
        const resendHistory = resendHistoryRows || [];

        if (job) {
          const [progressRows] = await connection.execute(
            `SELECT
               SUM(LOWER(status) IN ('sent','delivered','read')) AS sent,
               SUM(LOWER(status) IN ('delivered','read')) AS delivered,
               SUM(LOWER(status)='read') AS read_count,
               SUM(LOWER(status)='failed') AS failed,
               SUM(LOWER(status)='queued') AS queued,
               SUM(LOWER(status)='sending') AS sending,
               SUM(LOWER(status)='uncertain') AS uncertain
             FROM campaign_recipients
             WHERE resend_job_id=?`,
            [job.id]
          );
          Object.assign(job, progressRows[0] || {});
          job.read = job.read_count || 0;
        }

        // IMPORTANT: This endpoint is read-only. In particular, do not turn
        // awaiting_webhooks into completed here. Webhook/service logic owns
        // resend-job lifecycle transitions, not a report GET request.

        return res.status(200).json({
          success: true,
          data: {
            campaign,
            recipients,
            counts,
            job,
            resendHistory,
            pagination: {
              page,
              limit,
              total,
              totalPages: isExport ? 1 : Math.max(1, Math.ceil(total / limit))
            }
          }
        });
      }
    } catch (err) {
      logger.warn(
        `[ReportController] campaign recipients lookup failed for ID ${rawId}: ${err.message}`
      );
    }

    // Legacy fallback for message-backed records without a campaigns row.
    if (recipients.length === 0) {
      const [msgRows] = await connection.execute(
        'SELECT * FROM messages WHERE id=?',
        [cleanId]
      );

      if (msgRows.length > 0) {
        const mainMsg = msgRows[0];
        campaign = {
          id: mainMsg.id,
          campaign_name: mainMsg.message_text,
          template_name: '',
          total_numbers: 1,
          status: mainMsg.status || 'completed',
          created_at: mainMsg.timestamp
        };

        const [siblingRows] = await connection.execute(
          `SELECT id,recipient_phone AS phone,wa_message_id AS message_id,
                  IF(status='read','read',status) AS status,
                  timestamp AS sent_at,
                  CASE WHEN status='read' THEN timestamp ELSE NULL END AS read_at,
                  CASE WHEN status IN ('delivered','read') THEN timestamp ELSE NULL END AS delivered_at,
                  CASE WHEN status='failed'
                    THEN COALESCE(NULLIF(error,''),'Delivery failed; check Meta error details.')
                    ELSE NULL
                  END AS error
           FROM messages
           WHERE (campaign_id=? AND ? IS NOT NULL AND ? != 0)
              OR (message_text=? AND timestamp BETWEEN ? - INTERVAL 15 MINUTE
                                                   AND ? + INTERVAL 15 MINUTE)
           ORDER BY id ASC`,
          [
            mainMsg.campaign_id,
            mainMsg.campaign_id,
            mainMsg.campaign_id,
            mainMsg.message_text,
            mainMsg.timestamp,
            mainMsg.timestamp
          ]
        );

        recipients = siblingRows.length > 0
          ? siblingRows
          : [{
            id: mainMsg.id,
            phone: mainMsg.recipient_phone,
            message_id: mainMsg.wa_message_id,
            status: mainMsg.status === 'read' ? 'read' : (mainMsg.status || 'sent'),
            sent_at: mainMsg.timestamp,
            delivered_at: ['delivered', 'read'].includes(mainMsg.status)
              ? mainMsg.timestamp
              : null,
            read_at: mainMsg.status === 'read' ? mainMsg.timestamp : null,
            error: mainMsg.status === 'failed'
              ? (mainMsg.error || 'Delivery failed; check Meta error details.')
              : null
          }];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        campaign: campaign || { id: cleanId, total_numbers: recipients.length },
        total: recipients.length,
        recipients
      }
    });
  } catch (err) {
    logger.error(
      `[ReportController] Error fetching campaign recipients for ID ${rawId}:`,
      err.message
    );
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign recipients.'
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/reports/campaign/:id/resend
 * Enqueues a new resend attempt while retaining the recipient's prior state
 * in status_history and the separate campaign_resend_jobs audit trail.
 */
export const resendCampaignRecipients = async (req, res) => {
  const campaignId = String(req.params.id).replace(/^campaign_/, '');
  const status = String(req.body?.status || '').toLowerCase();
  const allowed = ['sent', 'delivered', 'read', 'failed'];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Choose Sent, Delivered, Read, or Failed.'
    });
  }

  const organizationId = req.organizationId || req.user?.organization_id || null;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const scopeSql = organizationId
      ? ' AND (organization_id=? OR organization_id IS NULL)'
      : ' AND organization_id IS NULL';
    const campaignParams = organizationId
      ? [campaignId, organizationId]
      : [campaignId];

    const [campaigns] = await conn.execute(
      `SELECT * FROM campaigns WHERE id=?${scopeSql} FOR UPDATE`,
      campaignParams
    );
    const campaign = campaigns[0];

    if (!campaign) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Campaign not found.'
      });
    }

    if (!campaign.template_name) {
      await conn.rollback();
      return res.status(422).json({
        success: false,
        message: 'This campaign has no reusable template.'
      });
    }

    const [active] = await conn.execute(
      `SELECT id
       FROM campaign_resend_jobs
       WHERE campaign_id=?
         AND requested_status=?
         AND status IN ('queued','running','awaiting_webhooks')
       LIMIT 1`,
      [campaignId, status]
    );

    if (active.length) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'A resend for this campaign and status is already running.',
        jobId: active[0].id
      });
    }

    const [targets] = await conn.execute(
      `SELECT id
       FROM campaign_recipients
       WHERE campaign_id=?
         AND LOWER(status)=?
       FOR UPDATE`,
      [campaignId, status]
    );

    if (!targets.length) {
      await conn.rollback();
      return res.status(422).json({
        success: false,
        message: `No recipients currently have status ${status}.`
      });
    }

    const [jobResult] = await conn.execute(
      `INSERT INTO campaign_resend_jobs
         (campaign_id,organization_id,requested_status,total_count)
       VALUES (?,?,?,?)`,
      [campaignId, organizationId, status, targets.length]
    );

    const ids = targets.map(row => row.id);

    // Save the pre-resend status/error snapshot before changing the current
    // recipient status. The separate resend-job row is retained as an audit
    // record for each resend attempt.
    await conn.query(
      `UPDATE campaign_recipients
       SET original_error=COALESCE(original_error,error),
           status_history=JSON_ARRAY_APPEND(
             COALESCE(status_history,JSON_ARRAY()),
             '$',
             JSON_OBJECT(
               'attempt',resend_attempt,
               'status',status,
               'error',error,
               'at',NOW(),
               'resend_job_id',?
             )
           ),
           resend_attempt=resend_attempt+1,
           resend_job_id=?,
           status='queued'
       WHERE id IN (?)`,
      [jobResult.insertId, jobResult.insertId, ids]
    );

    await conn.commit();

    startResendJob(jobResult.insertId);

    return res.status(202).json({
      success: true,
      queued: targets.length,
      jobId: jobResult.insertId,
      templateName: campaign.template_name
    });
  } catch (err) {
    await conn.rollback().catch(() => { });
    logger.error('[CampaignResend] enqueue failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not queue resend.'
    });
  } finally {
    conn.release();
  }
};
