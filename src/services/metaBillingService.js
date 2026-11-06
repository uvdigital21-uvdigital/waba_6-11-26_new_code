// ─────────────────────────────────────────────────────────────────────────────
// src/services/metaBillingService.js
// Production-Grade Meta WhatsApp Billing & Insights Service
// Flow: META GRAPH API -> VALIDATE -> RECORD-BY-RECORD UPSERT DB -> DB TOTALS -> DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { pool } from '../config/db.js';
import whatsappConfig from '../config/whatsapp.js';
import logger from '../utils/logger.js';
import { decryptToken } from '../utils/encryption.js';
import { emitToOrganization, emitSocketEvent } from '../utils/socket.js';

let syncDebounceTimer = null;

/**
 * Debounced background sync triggered by webhooks or message delivery events.
 */
export function triggerAutoMetaSync(organizationId = 1, delayMs = 3000) {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  syncDebounceTimer = setTimeout(async () => {
    try {
      logger.info(`[AutoMetaSync] Triggering background Meta billing sync for Org ${organizationId}...`);
      await syncMetaBillingFromApi(organizationId, null, 'today');
    } catch (err) {
      logger.warn('[AutoMetaSync] Background sync warning:', err.message);
    }
  }, delayMs);
}

/**
 * Resolves the connected WhatsApp account for a specific organization/user.
 */
export async function getConnectedMetaAccount(organizationId = 1, accountId = null) {
  let query = `
    SELECT id, organization_id, user_id, phone_number, phone_number_id, waba_id,
           verified_name, display_phone_number, business_name, access_token, status
    FROM whatsapp_accounts WHERE 
  `;
  const params = [];

  if (accountId) {
    query += 'id = ? AND (organization_id = ? OR organization_id IS NULL)';
    params.push(accountId, organizationId);
  } else {
    query += '(organization_id = ? OR organization_id IS NULL) ORDER BY id DESC LIMIT 1';
    params.push(organizationId);
  }

  const [rows] = await pool.query(query, params);
  if (rows.length === 0) {
    return {
      id: null,
      organizationId: organizationId || 1,
      businessId: '1428299024793738',
      phoneNumberId: whatsappConfig.phoneNumberId || '1133105516561988',
      wabaId: whatsappConfig.businessAccountId || '1507295783967485',
      token: whatsappConfig.accessToken || null,
      phoneNumber: '917383737005',
      displayPhoneNumber: '+91 73837 37005',
      verifiedName: 'UV Digital Solution',
      businessName: 'UV Digital Solution',
      status: 'CONNECTED'
    };
  }

  const acc = rows[0];
  let decryptedToken = null;
  if (acc.access_token) {
    try {
      decryptedToken = decryptToken(acc.access_token);
    } catch (_) {
      decryptedToken = acc.access_token;
    }
  }

  const rawPhone = acc.phone_number || acc.display_phone_number || '917383737005';
  const cleanPhone = String(rawPhone).replace(/[^\d]/g, '');

  return {
    id: acc.id,
    organizationId: acc.organization_id || organizationId || 1,
    businessId: '1428299024793738',
    phoneNumberId: acc.phone_number_id || whatsappConfig.phoneNumberId || '1133105516561988',
    wabaId: acc.waba_id || whatsappConfig.businessAccountId || '1507295783967485',
    token: decryptedToken || whatsappConfig.accessToken,
    phoneNumber: cleanPhone,
    displayPhoneNumber: acc.display_phone_number || `+${cleanPhone}`,
    verifiedName: acc.verified_name || acc.business_name || 'Official WhatsApp WABA',
    businessName: acc.business_name || acc.verified_name || 'UV Digital Solution',
    status: acc.status || 'CONNECTED'
  };
}

/**
 * Safely parses any date input (ISO string, English date, DD-MM-YYYY, epoch) into { year, month, day }.
 */
export function parseDateToISTParts(input) {
  if (!input) return null;
  if (typeof input === 'number') {
    const ms = input > 1e11 ? input : input * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }

  const str = String(input).trim();
  if (!str) return null;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10) - 1,
      day: parseInt(isoMatch[3], 10)
    };
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return {
      day: parseInt(dmyMatch[1], 10),
      month: parseInt(dmyMatch[2], 10) - 1,
      year: parseInt(dmyMatch[3], 10)
    };
  }

  // Standard JS Date parse (e.g. "Aug 1, 2026", "August 1, 2026", "1 Aug 2026")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      day: parsed.getDate()
    };
  }

  return null;
}

/**
 * Calculates start and end timestamps and date bounds in Asia/Kolkata (+05:30).
 */
export function getRangeTimestamps(rangeType = '30days', customStart = null, customEnd = null) {
  const now = new Date();
  
  // Format current time in Asia/Kolkata
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = istFormatter.formatToParts(now);
  const getP = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  const istYear = getP('year');
  const istMonth = getP('month') - 1; // 0-indexed
  const istDay = getP('day');

  // Helper to convert an IST YYYY-MM-DD HH:mm:ss to epoch seconds
  const toISTEpoch = (y, m, d, h = 0, min = 0, s = 0) => {
    const utcDate = new Date(Date.UTC(y, m, d, h, min, s));
    return Math.floor(utcDate.getTime() / 1000) - (5.5 * 3600);
  };

  const toDateString = (y, m, d) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  let startUnix, endUnix, startDateStr, endDateStr, label;

  if (rangeType === 'today') {
    startUnix = toISTEpoch(istYear, istMonth, istDay, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(istYear, istMonth, istDay);
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'Today';
  } else if (rangeType === 'yesterday') {
    const yestDate = new Date(Date.UTC(istYear, istMonth, istDay - 1));
    const yY = yestDate.getUTCFullYear();
    const yM = yestDate.getUTCMonth();
    const yD = yestDate.getUTCDate();
    startUnix = toISTEpoch(yY, yM, yD, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay, 0, 0, 0);
    startDateStr = toDateString(yY, yM, yD);
    endDateStr = toDateString(yY, yM, yD);
    label = 'Yesterday';
  } else if (rangeType === '7days') {
    const sDate = new Date(Date.UTC(istYear, istMonth, istDay - 6));
    const sY = sDate.getUTCFullYear();
    const sM = sDate.getUTCMonth();
    const sD = sDate.getUTCDate();
    startUnix = toISTEpoch(sY, sM, sD, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(sY, sM, sD);
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'Last 7 Days';
  } else if (rangeType === '30days') {
    const sDate = new Date(Date.UTC(istYear, istMonth, istDay - 29));
    const sY = sDate.getUTCFullYear();
    const sM = sDate.getUTCMonth();
    const sD = sDate.getUTCDate();
    startUnix = toISTEpoch(sY, sM, sD, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(sY, sM, sD);
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'Last 30 Days';
  } else if (rangeType === '90days' || rangeType === 'last_90_days') {
    const sDate = new Date(Date.UTC(istYear, istMonth, istDay - 89));
    const sY = sDate.getUTCFullYear();
    const sM = sDate.getUTCMonth();
    const sD = sDate.getUTCDate();
    startUnix = toISTEpoch(sY, sM, sD, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(sY, sM, sD);
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'Last 90 Days';
  } else if (rangeType === 'this_month') {
    startUnix = toISTEpoch(istYear, istMonth, 1, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(istYear, istMonth, 1);
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'This Month';
  } else if (rangeType === 'last_month') {
    const prevMonthDate = new Date(Date.UTC(istYear, istMonth, 0));
    const lmY = prevMonthDate.getUTCFullYear();
    const lmM = prevMonthDate.getUTCMonth();
    const lastDay = prevMonthDate.getUTCDate();
    startUnix = toISTEpoch(lmY, lmM, 1, 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, 1, 0, 0, 0);
    startDateStr = toDateString(lmY, lmM, 1);
    endDateStr = toDateString(lmY, lmM, lastDay);
    label = 'Last Month';
  } else if (rangeType === 'custom') {
    let sParts = parseDateToISTParts(customStart);
    let eParts = parseDateToISTParts(customEnd);

    if (!sParts && !eParts) {
      const sDate = new Date(Date.UTC(istYear, istMonth, istDay - 6));
      sParts = { year: sDate.getUTCFullYear(), month: sDate.getUTCMonth(), day: sDate.getUTCDate() };
      eParts = { year: istYear, month: istMonth, day: istDay };
    } else if (!sParts) {
      sParts = eParts;
    } else if (!eParts) {
      eParts = sParts;
    }

    let sEpoch = toISTEpoch(sParts.year, sParts.month, sParts.day, 0, 0, 0);
    let eEpoch = toISTEpoch(eParts.year, eParts.month, eParts.day + 1, 0, 0, 0);

    if (sEpoch > eEpoch) {
      const tmpEpoch = sEpoch;
      sEpoch = toISTEpoch(eParts.year, eParts.month, eParts.day, 0, 0, 0);
      eEpoch = toISTEpoch(sParts.year, sParts.month, sParts.day + 1, 0, 0, 0);
      const tmpParts = sParts;
      sParts = eParts;
      eParts = tmpParts;
    }

    startUnix = sEpoch;
    endUnix = eEpoch;
    startDateStr = toDateString(sParts.year, sParts.month, sParts.day);
    endDateStr = toDateString(eParts.year, eParts.month, eParts.day);
    label = `Custom (${startDateStr} to ${endDateStr})`;
  } else {
    // Default 30 days
    const sDate = new Date(Date.UTC(istYear, istMonth, istDay - 29));
    startUnix = toISTEpoch(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate());
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'Last 30 Days';
  }

  // Safety fallbacks to guarantee valid integers
  if (isNaN(startUnix) || isNaN(endUnix) || startUnix <= 0 || endUnix <= 0) {
    const sDate = new Date(Date.UTC(istYear, istMonth, istDay - 29));
    startUnix = toISTEpoch(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0);
    endUnix = toISTEpoch(istYear, istMonth, istDay + 1, 0, 0, 0);
    startDateStr = toDateString(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate());
    endDateStr = toDateString(istYear, istMonth, istDay);
    label = 'Last 30 Days';
  }

  if (startUnix >= endUnix) {
    endUnix = startUnix + 86400;
  }

  return {
    startUnix,
    endUnix,
    startDateStr,
    endDateStr,
    label,
    timezone: 'Asia/Kolkata'
  };
}

/**
 * Synchronizes Meta WhatsApp Analytics & Billing data from Meta Graph API into MySQL tables.
 * Stores raw responses, granular records in meta_insights_records, and aggregate period snapshot in meta_insights.
 */
export async function syncMetaBillingFromApi(organizationId = 1, accountId = null, dateRange = '30days', customStart = null, customEnd = null) {
  const acc = await getConnectedMetaAccount(organizationId, accountId);
  if (!acc.token || !acc.wabaId) {
    throw new Error('No connected WhatsApp Business Account credentials found. Please connect your official WhatsApp account.');
  }

  const timeInfo = getRangeTimestamps(dateRange, customStart, customEnd);
  const { startUnix, endUnix, startDateStr, endDateStr, timezone, label } = timeInfo;

  logger.info(`==================== [META SYNC START] ====================`);
  logger.info(`Business ID: ${acc.businessId}`);
  logger.info(`WABA ID: ${acc.wabaId}`);
  logger.info(`Phone Number ID: ${acc.phoneNumberId} (Phone: ${acc.phoneNumber})`);
  logger.info(`Date Range: ${label} (${startDateStr} to ${endDateStr})`);
  logger.info(`Timezone: ${timezone} (Epoch: ${startUnix} to ${endUnix})`);

  const apiVersion = whatsappConfig.apiVersion || 'v23.0';
  const baseUrl = whatsappConfig.baseUrl || 'https://graph.facebook.com';

  // Start Sync Log
  const [syncLogRes] = await pool.query(
    `INSERT INTO meta_sync_logs (organization_id, whatsapp_account_id, business_id, waba_id, phone_number_id, date_from, date_to, started_at, status, api_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'running', ?)`,
    [acc.organizationId, acc.id, acc.businessId, acc.wabaId, acc.phoneNumberId, startDateStr, endDateStr, apiVersion]
  );
  const syncLogId = syncLogRes.insertId;

  const client = axios.create({
    baseURL: baseUrl,
    headers: { Authorization: `Bearer ${acc.token}` },
    timeout: 35000
  });

  let recordsFetched = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsSkipped = 0;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch WABA Messaging Analytics (sent, delivered)
    let wabaDataPoints = [];
    let currency = 'INR';

    logger.info(`[META API REQUEST] GET /${apiVersion}/${acc.wabaId}?fields=id,name,currency,analytics.start(${startUnix}).end(${endUnix}).granularity(DAY)`);
    try {
      const wabaRes = await client.get(`/${apiVersion}/${acc.wabaId}`, {
        params: {
          fields: `id,name,currency,analytics.start(${startUnix}).end(${endUnix}).granularity(DAY)`
        }
      });

      if (wabaRes.data?.currency) currency = wabaRes.data.currency;
      wabaDataPoints = wabaRes.data?.analytics?.data_points || [];
      logger.info(`[META API RESPONSE STATUS] 200 OK — ${wabaDataPoints.length} WABA analytics points received.`);
    } catch (wabaErr) {
      logger.warn('[META API WARNING] WABA analytics query warning:', wabaErr.response?.data?.error?.message || wabaErr.message);
    }

    // 2. Fetch All Approved Templates
    const allTemplates = [];
    let nextTplUrl = `https://graph.facebook.com/${apiVersion}/${acc.wabaId}/message_templates?fields=id,name,category,status,language&limit=100`;

    while (nextTplUrl) {
      try {
        const tRes = await axios.get(nextTplUrl, {
          headers: { Authorization: `Bearer ${acc.token}` },
          timeout: 20000
        });
        const tplData = tRes.data?.data || [];
        tplData.forEach(t => allTemplates.push(t));
        nextTplUrl = tRes.data?.paging?.next || null;
      } catch (tErr) {
        logger.warn('[META API WARNING] Template list page error:', tErr.response?.data?.error?.message || tErr.message);
        break;
      }
    }

    const templateMap = {};
    allTemplates.forEach(t => {
      templateMap[t.id] = t;
    });
    const templateIds = allTemplates.map(t => t.id).join(',');
    logger.info(`[META API TEMPLATES] Found ${allTemplates.length} approved templates in WABA.`);

    // 3. Fetch Template Analytics with Complete Pagination
    const allTemplateDataPoints = [];

    if (allTemplates.length > 0 && templateIds) {
      let nextTaUrl = `https://graph.facebook.com/${apiVersion}/${acc.wabaId}/template_analytics?start=${startUnix}&end=${endUnix}&granularity=DAILY&template_ids=${templateIds}&limit=100`;

      while (nextTaUrl) {
        try {
          const taRes = await axios.get(nextTaUrl, {
            headers: { Authorization: `Bearer ${acc.token}` },
            timeout: 25000
          });

          const points = taRes.data?.data?.[0]?.data_points || [];
          points.forEach(p => allTemplateDataPoints.push(p));
          nextTaUrl = taRes.data?.paging?.next || null;
        } catch (taErr) {
          logger.warn('[META API WARNING] Template analytics page error:', taErr.response?.data?.error?.message || taErr.message);
          break;
        }
      }
    }

    logger.info(`[META RECORDS RECEIVED] ${allTemplateDataPoints.length} template data points + ${wabaDataPoints.length} messaging points.`);
    recordsFetched = wabaDataPoints.length + allTemplateDataPoints.length;

    // Helper: Map Unix epoch to IST YYYY-MM-DD
    const epochToISTDate = (unixSec) => {
      const d = new Date(unixSec * 1000);
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
      return f.format(d);
    };

    // 4. Fetch incoming messages count per day for this account from local webhook incoming logs
    let incomingPerDayMap = {};
    try {
      const [incRows] = await conn.query(
        `SELECT DATE(CONVERT_TZ(\`timestamp\`, '+00:00', '+05:30')) as msg_date, COUNT(*) as inc_count
         FROM messages 
         WHERE (direction = 'incoming' OR sender = 'contact')
           AND \`timestamp\` >= FROM_UNIXTIME(?) AND \`timestamp\` < FROM_UNIXTIME(?)
           AND (organization_id = ? OR whatsapp_account_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE organization_id = ?))
         GROUP BY msg_date`,
        [startUnix, endUnix, acc.organizationId, acc.id, acc.organizationId]
      );
      incRows.forEach(r => {
        const dStr = r.msg_date instanceof Date ? r.msg_date.toISOString().split('T')[0] : String(r.msg_date);
        incomingPerDayMap[dStr] = parseInt(r.inc_count || 0, 10);
      });
    } catch (dbErr) {
      logger.warn('[META API WARNING] Incoming messages query error:', dbErr.message);
    }

    // 5. Upsert Template Analytics Data Points Record-by-Record
    for (const p of allTemplateDataPoints) {
      const tpl = templateMap[p.template_id] || { name: 'Unknown Template', category: 'MARKETING' };
      const pointDateStr = epochToISTDate(p.start);
      const category = (tpl.category || 'MARKETING').toUpperCase();
      
      const sent = Number(p.sent || 0);
      const delivered = Number(p.delivered || 0);
      const read = Number(p.read || 0);
      const replied = Number(p.replied || 0);

      const costEntry = (p.cost || []).find(c => c.type === 'amount_spent');
      const rateEntry = (p.cost || []).find(c => c.type === 'cost_per_delivered');
      const charge = Number(costEntry?.value || 0);
      const rate = Number(rateEntry?.value || (delivered > 0 ? charge / delivered : 0));

      const isService = category === 'SERVICE';
      const freeMessages = isService ? delivered : (charge === 0 && delivered > 0 ? delivered : 0);
      const paidMessages = isService ? 0 : (delivered - freeMessages);

      const metaRecordId = `META_TPL_${acc.wabaId}_${acc.phoneNumberId}_${p.template_id}_${pointDateStr}`;
      const rawPayload = JSON.stringify({
        source: 'META_TEMPLATE_ANALYTICS',
        template_id: p.template_id,
        template_name: tpl.name,
        category: category,
        start: p.start,
        end: p.end,
        sent,
        delivered,
        read,
        replied,
        cost: p.cost,
        synced_at: new Date().toISOString()
      });

      const [res] = await conn.query(
        `INSERT INTO meta_insights_records 
         (meta_record_id, organization_id, whatsapp_account_id, waba_id, phone_number_id, phone_number,
          date, timestamp_start, timestamp_end, category, metric_type, template_id, template_name,
          sent, delivered, received, free_messages, paid_messages, rate, charge, currency, raw_payload, source, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TEMPLATE', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'META', NOW())
         ON DUPLICATE KEY UPDATE
          sent = VALUES(sent),
          delivered = VALUES(delivered),
          free_messages = VALUES(free_messages),
          paid_messages = VALUES(paid_messages),
          rate = VALUES(rate),
          charge = VALUES(charge),
          currency = VALUES(currency),
          raw_payload = VALUES(raw_payload),
          synced_at = NOW()`,
        [
          metaRecordId, acc.organizationId, acc.id, acc.wabaId, acc.phoneNumberId, acc.phoneNumber,
          pointDateStr, p.start, p.end, category, p.template_id, tpl.name,
          sent, delivered, freeMessages, paidMessages, rate, charge, currency, rawPayload
        ]
      );

      if (res.affectedRows === 1) recordsInserted++;
      else if (res.affectedRows === 2) recordsUpdated++;
      else recordsSkipped++;
    }

    // 6. Upsert WABA Messaging Analytics (Daily Totals)
    for (const wp of wabaDataPoints) {
      const wpDateStr = epochToISTDate(wp.start);
      const sent = Number(wp.sent || 0);
      const delivered = Number(wp.delivered || 0);
      const received = incomingPerDayMap[wpDateStr] || 0;

      const metaRecordId = `META_WABA_${acc.wabaId}_${acc.phoneNumberId}_${wpDateStr}`;
      const rawPayload = JSON.stringify({
        source: 'META_WABA_ANALYTICS',
        waba_id: acc.wabaId,
        phone_number: acc.phoneNumber,
        start: wp.start,
        end: wp.end,
        sent,
        delivered,
        received,
        synced_at: new Date().toISOString()
      });

      const [res] = await conn.query(
        `INSERT INTO meta_insights_records 
         (meta_record_id, organization_id, whatsapp_account_id, waba_id, phone_number_id, phone_number,
          date, timestamp_start, timestamp_end, category, metric_type,
          sent, delivered, received, free_messages, paid_messages, rate, charge, currency, raw_payload, source, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TOTAL', 'MESSAGING', ?, ?, ?, 0, 0, 0.0000, 0.0000, ?, ?, 'META', NOW())
         ON DUPLICATE KEY UPDATE
          sent = VALUES(sent),
          delivered = VALUES(delivered),
          received = VALUES(received),
          raw_payload = VALUES(raw_payload),
          synced_at = NOW()`,
        [
          metaRecordId, acc.organizationId, acc.id, acc.wabaId, acc.phoneNumberId, acc.phoneNumber,
          wpDateStr, wp.start, wp.end,
          sent, delivered, received, currency, rawPayload
        ]
      );

      if (res.affectedRows === 1) recordsInserted++;
      else if (res.affectedRows === 2) recordsUpdated++;
      else recordsSkipped++;
    }

    // 7. Calculate Service Category Conversations per day
    for (const wp of wabaDataPoints) {
      const wpDateStr = epochToISTDate(wp.start);
      const totalDelivered = Number(wp.delivered || 0);

      const [tplSumRows] = await conn.query(
        `SELECT SUM(delivered) as tpl_del, SUM(paid_messages) as tpl_paid
         FROM meta_insights_records
         WHERE organization_id = ? AND phone_number_id = ? AND date = ? AND metric_type = 'TEMPLATE'`,
        [acc.organizationId, acc.phoneNumberId, wpDateStr]
      );

      const templatePaid = Number(tplSumRows[0]?.tpl_paid || 0);
      const serviceDelivered = Math.max(0, totalDelivered - templatePaid);

      if (serviceDelivered > 0) {
        const metaRecordId = `META_SERVICE_${acc.wabaId}_${acc.phoneNumberId}_${wpDateStr}`;
        const rawPayload = JSON.stringify({
          source: 'META_SERVICE_CONVERSATION',
          date: wpDateStr,
          service_delivered: serviceDelivered,
          total_delivered: totalDelivered,
          synced_at: new Date().toISOString()
        });

        await conn.query(
          `INSERT INTO meta_insights_records 
           (meta_record_id, organization_id, whatsapp_account_id, waba_id, phone_number_id, phone_number,
            date, timestamp_start, timestamp_end, category, metric_type,
            sent, delivered, received, free_messages, paid_messages, rate, charge, currency, raw_payload, source, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SERVICE', 'SERVICE', ?, ?, 0, ?, 0, 0.0000, 0.0000, ?, ?, 'META', NOW())
           ON DUPLICATE KEY UPDATE
            sent = VALUES(sent),
            delivered = VALUES(delivered),
            free_messages = VALUES(free_messages),
            raw_payload = VALUES(raw_payload),
            synced_at = NOW()`,
          [
            metaRecordId, acc.organizationId, acc.id, acc.wabaId, acc.phoneNumberId, acc.phoneNumber,
            wpDateStr, wp.start, wp.end,
            serviceDelivered, serviceDelivered, serviceDelivered, currency, rawPayload
          ]
        );
      }
    }

    // 8. Compute and Upsert Period Aggregate into `meta_insights`
    const [overviewRows] = await conn.query(
      `SELECT 
         SUM(CASE WHEN metric_type = 'MESSAGING' THEN sent ELSE 0 END) as tot_sent,
         SUM(CASE WHEN metric_type = 'MESSAGING' THEN delivered ELSE 0 END) as tot_del,
         SUM(CASE WHEN metric_type = 'MESSAGING' THEN received ELSE 0 END) as tot_rec,
         SUM(CASE WHEN category = 'MARKETING' THEN sent ELSE 0 END) as mkt_sent,
         SUM(CASE WHEN category = 'MARKETING' THEN delivered ELSE 0 END) as mkt_del,
         SUM(CASE WHEN category = 'MARKETING' THEN paid_messages ELSE 0 END) as mkt_paid,
         SUM(CASE WHEN category = 'MARKETING' THEN charge ELSE 0 END) as mkt_charge,
         SUM(CASE WHEN category = 'UTILITY' THEN sent ELSE 0 END) as util_sent,
         SUM(CASE WHEN category = 'UTILITY' THEN delivered ELSE 0 END) as util_del,
         SUM(CASE WHEN category = 'UTILITY' THEN free_messages ELSE 0 END) as util_free,
         SUM(CASE WHEN category = 'UTILITY' THEN paid_messages ELSE 0 END) as util_paid,
         SUM(CASE WHEN category = 'UTILITY' THEN charge ELSE 0 END) as util_charge,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN sent ELSE 0 END) as auth_sent,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN delivered ELSE 0 END) as auth_del,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN paid_messages ELSE 0 END) as auth_paid,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN charge ELSE 0 END) as auth_charge,
         SUM(CASE WHEN category = 'SERVICE' THEN sent ELSE 0 END) as srv_sent,
         SUM(CASE WHEN category = 'SERVICE' THEN delivered ELSE 0 END) as srv_del,
         SUM(CASE WHEN category = 'SERVICE' THEN free_messages ELSE 0 END) as srv_free,
         SUM(free_messages) as tot_free,
         SUM(paid_messages) as tot_paid,
         SUM(charge) as tot_charge
       FROM meta_insights_records
       WHERE organization_id = ? AND (waba_id = ? OR phone_number_id = ? OR whatsapp_account_id = ?) AND date >= ? AND date <= ?`,
      [acc.organizationId, acc.wabaId, acc.phoneNumberId, acc.id, startDateStr, endDateStr]
    );

    const ov = overviewRows[0] || {};
    const totSent = Number(ov.tot_sent || 0);
    const totDel = Number(ov.tot_del || 0);
    const totRec = Number(ov.tot_rec || 0);
    const allMsgs = totSent + totDel + totRec;

    const mktDel = Number(ov.mkt_del || 0);
    const mktSent = Number(ov.mkt_sent || 0);
    const mktPaid = Number(ov.mkt_paid || 0);
    const mktCharge = Number(ov.mkt_charge || 0);
    const mktRate = mktDel > 0 && mktCharge > 0 ? mktCharge / mktDel : 0.8631;

    const utilDel = Number(ov.util_del || 0);
    const utilSent = Number(ov.util_sent || 0);
    const utilFree = Number(ov.util_free || 0);
    const utilPaid = Number(ov.util_paid || 0);
    const utilCharge = Number(ov.util_charge || 0);
    const utilRate = utilDel > 0 && utilCharge > 0 ? utilCharge / utilDel : 0.1150;

    const authDel = Number(ov.auth_del || 0);
    const authSent = Number(ov.auth_sent || 0);
    const authPaid = Number(ov.auth_paid || 0);
    const authCharge = Number(ov.auth_charge || 0);
    const authRate = 0.1150;

    const srvDel = Number(ov.srv_del || 0);
    const srvSent = Number(ov.srv_sent || 0);
    const srvFree = Number(ov.srv_free || 0);

    const totFree = srvFree + utilFree;
    const totPaid = mktPaid + utilPaid + authPaid;
    const totCharge = mktCharge + utilCharge + authCharge;

    const rawAggregatedPayload = JSON.stringify({
      business_id: acc.businessId,
      waba_id: acc.wabaId,
      phone_number_id: acc.phoneNumberId,
      date_from: startDateStr,
      date_to: endDateStr,
      period_type: dateRange,
      timezone,
      all_messages: allMsgs,
      messages_sent: totSent,
      messages_delivered: totDel,
      messages_received: totRec,
      free_messages: totFree,
      paid_messages: totPaid,
      total_charges: Number(totCharge.toFixed(4)),
      currency,
      waba_points_count: wabaDataPoints.length,
      template_points_count: allTemplateDataPoints.length,
      synced_at: new Date().toISOString()
    });

    await conn.query(
      `INSERT INTO meta_insights 
       (organization_id, whatsapp_account_id, business_id, waba_id, phone_number_id, phone_number,
        date_from, date_to, period_type, timezone,
        messages_sent, messages_delivered, messages_received, all_messages,
        marketing_delivered, utility_delivered, authentication_delivered, authentication_international_delivered, ai_provider_delivered, service_delivered,
        marketing_sent, utility_sent, authentication_sent, authentication_international_sent, ai_provider_sent, service_sent,
        free_customer_service, free_entry_point, free_utility, total_free_messages,
        paid_marketing, paid_utility, paid_authentication, paid_authentication_international, paid_ai_provider, total_paid_messages,
        marketing_rate, utility_rate, authentication_rate, authentication_international_rate, ai_provider_rate, service_rate,
        marketing_charges, utility_charges, authentication_charges, authentication_international_charges, ai_provider_charges,
        total_charges, currency, raw_response, meta_api_version, meta_fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?,
               ?, ?, ?, 0, 0, ?,
               ?, ?, ?, 0, 0, ?,
               ?, 0, ?, ?,
               ?, ?, ?, 0, 0, ?,
               ?, ?, ?, 2.3000, 0.0000, 0.0000,
               ?, ?, ?, 0.0000, 0.0000,
               ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        messages_sent = VALUES(messages_sent),
        messages_delivered = VALUES(messages_delivered),
        messages_received = VALUES(messages_received),
        all_messages = VALUES(all_messages),
        marketing_delivered = VALUES(marketing_delivered),
        utility_delivered = VALUES(utility_delivered),
        authentication_delivered = VALUES(authentication_delivered),
        service_delivered = VALUES(service_delivered),
        marketing_sent = VALUES(marketing_sent),
        utility_sent = VALUES(utility_sent),
        authentication_sent = VALUES(authentication_sent),
        service_sent = VALUES(service_sent),
        free_customer_service = VALUES(free_customer_service),
        free_utility = VALUES(free_utility),
        total_free_messages = VALUES(total_free_messages),
        paid_marketing = VALUES(paid_marketing),
        paid_utility = VALUES(paid_utility),
        paid_authentication = VALUES(paid_authentication),
        total_paid_messages = VALUES(total_paid_messages),
        marketing_rate = VALUES(marketing_rate),
        utility_rate = VALUES(utility_rate),
        authentication_rate = VALUES(authentication_rate),
        marketing_charges = VALUES(marketing_charges),
        utility_charges = VALUES(utility_charges),
        authentication_charges = VALUES(authentication_charges),
        total_charges = VALUES(total_charges),
        currency = VALUES(currency),
        raw_response = VALUES(raw_response),
        meta_fetched_at = NOW()`,
      [
        acc.organizationId, acc.id, acc.businessId, acc.wabaId, acc.phoneNumberId, acc.phoneNumber,
        startDateStr, endDateStr, dateRange, timezone,
        totSent, totDel, totRec, allMsgs,
        mktDel, utilDel, authDel, srvDel,
        mktSent, utilSent, authSent, srvSent,
        srvFree, utilFree, totFree,
        mktPaid, utilPaid, authPaid, totPaid,
        mktRate, utilRate, authRate,
        mktCharge, utilCharge, authCharge,
        totCharge, currency, rawAggregatedPayload, apiVersion
      ]
    );

    await conn.commit();

    // Update Sync Log
    await pool.query(
      `UPDATE meta_sync_logs 
       SET status = 'success', records_fetched = ?, raw_response = ?, completed_at = NOW() 
       WHERE id = ?`,
      [recordsFetched, rawAggregatedPayload, syncLogId]
    );

    logger.info(`[DB UPSERT COMPLETE] Upserted meta_insights & meta_insights_records successfully.`);
    logger.info(`[META SYNC SUCCESS] Completed in ${timezone}. (Fetched: ${recordsFetched}, Inserted: ${recordsInserted}, Updated: ${recordsUpdated})`);

    // Emit Real-Time Socket Event to notify connected frontend clients
    const notifyData = {
      wabaId: acc.wabaId,
      phoneNumberId: acc.phoneNumberId,
      dateRange,
      syncedAt: new Date().toISOString()
    };
    emitToOrganization(acc.organizationId, 'meta_billing_updated', notifyData);
    emitSocketEvent('meta_billing_updated', notifyData);

    return {
      success: true,
      recordsFetched,
      recordsInserted,
      recordsUpdated,
      syncLogId
    };

  } catch (err) {
    await conn.rollback();
    logger.error('[META SYNC FAILED] Reason:', err.message);

    await pool.query(
      `UPDATE meta_sync_logs SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
      [err.message, syncLogId]
    );

    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Reads and computes dashboard totals ONLY from persisted DB records in meta_insights and meta_insights_records.
 */
export async function getInsightsFromDatabase(organizationId = 1, accountId = null, dateRange = '30days', customStart = null, customEnd = null) {
  const acc = await getConnectedMetaAccount(organizationId, accountId);
  const timeInfo = getRangeTimestamps(dateRange, customStart, customEnd);
  const { startDateStr, endDateStr, label, timezone } = timeInfo;

  logger.info(`[MetaDB] Reading stored insights from DB for Org ${acc.organizationId}, Phone ${acc.phoneNumberId} (Range: ${label}, ${startDateStr} to ${endDateStr})`);

  // 1. Fetch from `meta_insights`
  const [snapshotRows] = await pool.query(
    `SELECT * FROM meta_insights
     WHERE organization_id = ? AND phone_number_id = ? AND date_from = ? AND date_to = ?
     ORDER BY id DESC LIMIT 1`,
    [acc.organizationId, acc.phoneNumberId, startDateStr, endDateStr]
  );

  let snap = snapshotRows[0];

  // If no direct period snapshot in meta_insights, sum from meta_insights_records
  if (!snap) {
    const [aggRows] = await pool.query(
      `SELECT 
         SUM(CASE WHEN metric_type = 'MESSAGING' THEN sent ELSE 0 END) as messages_sent,
         SUM(CASE WHEN metric_type = 'MESSAGING' THEN delivered ELSE 0 END) as messages_delivered,
         SUM(CASE WHEN metric_type = 'MESSAGING' THEN received ELSE 0 END) as messages_received,
         SUM(CASE WHEN category = 'MARKETING' THEN sent ELSE 0 END) as marketing_sent,
         SUM(CASE WHEN category = 'MARKETING' THEN delivered ELSE 0 END) as marketing_delivered,
         SUM(CASE WHEN category = 'MARKETING' THEN paid_messages ELSE 0 END) as paid_marketing,
         SUM(CASE WHEN category = 'MARKETING' THEN charge ELSE 0 END) as marketing_charges,
         SUM(CASE WHEN category = 'UTILITY' THEN sent ELSE 0 END) as utility_sent,
         SUM(CASE WHEN category = 'UTILITY' THEN delivered ELSE 0 END) as utility_delivered,
         SUM(CASE WHEN category = 'UTILITY' THEN free_messages ELSE 0 END) as free_utility,
         SUM(CASE WHEN category = 'UTILITY' THEN paid_messages ELSE 0 END) as paid_utility,
         SUM(CASE WHEN category = 'UTILITY' THEN charge ELSE 0 END) as utility_charges,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN sent ELSE 0 END) as authentication_sent,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN delivered ELSE 0 END) as authentication_delivered,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN paid_messages ELSE 0 END) as paid_authentication,
         SUM(CASE WHEN category = 'AUTHENTICATION' THEN charge ELSE 0 END) as authentication_charges,
         SUM(CASE WHEN category = 'SERVICE' THEN sent ELSE 0 END) as service_sent,
         SUM(CASE WHEN category = 'SERVICE' THEN delivered ELSE 0 END) as service_delivered,
         SUM(CASE WHEN category = 'SERVICE' THEN free_messages ELSE 0 END) as free_customer_service,
         SUM(free_messages) as total_free_messages,
         SUM(paid_messages) as total_paid_messages,
         SUM(charge) as total_charges,
         MAX(currency) as currency
       FROM meta_insights_records
       WHERE organization_id = ? AND phone_number_id = ? AND date >= ? AND date <= ?`,
      [acc.organizationId, acc.phoneNumberId, startDateStr, endDateStr]
    );

    snap = aggRows[0] || {};
  }

  const messagesSent = Number(snap?.messages_sent || 0);
  const messagesDelivered = Number(snap?.messages_delivered || 0);
  const messagesReceived = Number(snap?.messages_received || 0);
  const allMessages = messagesSent + messagesDelivered + messagesReceived;

  const marketingDelivered = Number(snap?.marketing_delivered || 0);
  const marketingSent = Number(snap?.marketing_sent || 0);
  const paidMarketing = Number(snap?.paid_marketing || 0);
  const marketingCharges = Number(snap?.marketing_charges || 0);
  const marketingRate = marketingDelivered > 0 && marketingCharges > 0 ? marketingCharges / marketingDelivered : 0.8631;

  const utilityDelivered = Number(snap?.utility_delivered || 0);
  const utilitySent = Number(snap?.utility_sent || 0);
  const freeUtility = Number(snap?.free_utility || 0);
  const paidUtility = Number(snap?.paid_utility || 0);
  const utilityCharges = Number(snap?.utility_charges || 0);
  const utilityRate = utilityDelivered > 0 && utilityCharges > 0 ? utilityCharges / utilityDelivered : 0.1150;

  const authDelivered = Number(snap?.authentication_delivered || 0);
  const authSent = Number(snap?.authentication_sent || 0);
  const paidAuth = Number(snap?.paid_authentication || 0);
  const authCharges = Number(snap?.authentication_charges || 0);
  const authRate = 0.1150;

  const srvDelivered = Number(snap?.service_delivered || 0);
  const srvSent = Number(snap?.service_sent || 0);
  const srvFree = Number(snap?.free_customer_service || 0);

  const freeMessages = srvFree + freeUtility;
  const paidMessages = paidMarketing + paidUtility + paidAuth;
  const totalCharges = Number(snap?.total_charges || (marketingCharges + utilityCharges + authCharges));
  const currency = snap?.currency || 'INR';

  const categories = [
    {
      category: 'MARKETING',
      sent: marketingSent,
      delivered: marketingDelivered,
      free: 0,
      paid: paidMarketing,
      rate: Number(marketingRate.toFixed(4)),
      cost: Number(marketingCharges.toFixed(2))
    },
    {
      category: 'UTILITY',
      sent: utilitySent,
      delivered: utilityDelivered,
      free: freeUtility,
      paid: paidUtility,
      rate: Number(utilityRate.toFixed(4)),
      cost: Number(utilityCharges.toFixed(2))
    },
    {
      category: 'AUTHENTICATION',
      sent: authSent,
      delivered: authDelivered,
      free: 0,
      paid: paidAuth,
      rate: authRate,
      cost: Number(authCharges.toFixed(2))
    },
    {
      category: 'AUTHENTICATION_INTERNATIONAL',
      sent: 0,
      delivered: 0,
      free: 0,
      paid: 0,
      rate: 2.3000,
      cost: 0.00
    },
    {
      category: 'AI_PROVIDER',
      sent: 0,
      delivered: 0,
      free: 0,
      paid: 0,
      rate: 0.0000,
      cost: 0.00
    },
    {
      category: 'SERVICE',
      sent: srvSent,
      delivered: srvDelivered,
      free: srvFree,
      paid: 0,
      rate: 0.0000,
      cost: 0.00
    }
  ];

  // 2. Fetch Chronological Daily Breakdown for Table
  const [dailyRows] = await pool.query(
    `SELECT 
       date,
       SUM(CASE WHEN metric_type = 'MESSAGING' THEN sent ELSE 0 END) as day_sent,
       SUM(CASE WHEN metric_type = 'MESSAGING' THEN delivered ELSE 0 END) as day_delivered,
       SUM(CASE WHEN metric_type = 'MESSAGING' THEN received ELSE 0 END) as day_received,
       SUM(CASE WHEN category = 'MARKETING' THEN delivered ELSE 0 END) as marketing,
       SUM(CASE WHEN category = 'UTILITY' THEN delivered ELSE 0 END) as utility,
       SUM(CASE WHEN category = 'SERVICE' THEN delivered ELSE 0 END) as service,
       SUM(CASE WHEN category = 'AUTHENTICATION' THEN delivered ELSE 0 END) as authentication,
       SUM(paid_messages) as paid,
       SUM(charge) as cost
     FROM meta_insights_records
     WHERE organization_id = ? AND phone_number_id = ? AND date >= ? AND date <= ?
     GROUP BY date
     ORDER BY date DESC`,
    [acc.organizationId, acc.phoneNumberId, startDateStr, endDateStr]
  );

  const daily = dailyRows.map(d => ({
    date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
    sent: Number(d.day_sent || 0),
    delivered: Number(d.day_delivered || 0),
    received: Number(d.day_received || 0),
    marketing: Number(d.marketing || 0),
    utility: Number(d.utility || 0),
    service: Number(d.service || 0),
    authentication: Number(d.authentication || 0),
    paid: Number(d.paid || 0),
    cost: Number(d.cost || 0)
  }));

  // 3. Fetch Latest Successful Sync Log
  const [syncRows] = await pool.query(
    `SELECT status, completed_at, started_at, error_message
     FROM meta_sync_logs
     WHERE organization_id = ? AND (phone_number_id = ? OR phone_number_id IS NULL)
     ORDER BY id DESC LIMIT 1`,
    [acc.organizationId, acc.phoneNumberId]
  );

  const lastSync = {
    syncedAt: syncRows[0]?.completed_at || syncRows[0]?.started_at || null,
    status: syncRows[0]?.status || 'synced',
    error: syncRows[0]?.error_message || null
  };

  return {
    account: {
      businessId: acc.businessId,
      phoneNumber: acc.displayPhoneNumber || acc.phoneNumber,
      verifiedName: acc.verifiedName,
      businessName: acc.businessName,
      wabaId: acc.wabaId,
      phoneNumberId: acc.phoneNumberId,
      status: acc.status
    },
    period: {
      type: dateRange,
      startDate: startDateStr,
      endDate: endDateStr,
      label,
      timezone
    },
    lastSync,
    summary: {
      allMessages,
      messagesSent,
      messagesDelivered,
      messagesReceived,
      freeMessages,
      paidMessages,
      totalCharges: Number(totalCharges.toFixed(2)),
      currency
    },
    categories,
    daily
  };
}
