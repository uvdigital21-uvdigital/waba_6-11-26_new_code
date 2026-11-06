// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/campaignController.js
// Handles Campaign API endpoints.
//
// Updates:
// - Persist message components, variables, media, feature key and recovery flag
//   in the same INSERT that creates background/scheduled campaigns.
// - Do not silently swallow campaign-payload persistence errors.
// - Resume with the campaign's saved organization and feature key.
// - Preserve the sender's actual success/failure result for tag campaigns.
// - Do not report a running campaign as cancelled while its worker may still
//   be sending messages.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchApprovedTemplates, sendCampaignTemplate } from '../services/metaWhatsAppService.js';
import { hasSufficientCredits } from '../services/creditService.js';
import { processDurableQueuedCampaigns } from '../services/schedulerService.js';
import logger from '../utils/logger.js';
import { pool } from '../config/db.js';

/**
 * GET /api/templates
 * Fetches approved templates from Meta
 */
export const getTemplates = async (req, res, next) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || null;
    const organizationId = req.organizationId || req.user?.organization_id || null;
    const templates = await fetchApprovedTemplates(accountId, organizationId);
    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaign/send
 * Receives campaign data and initiates bulk sending.
 * Protected against duplicate/double submission via an Idempotency-Key header.
 */
export const sendCampaign = async (req, res, next) => {
  try {
    const {
      campaignName,
      template,
      country,
      numbers,
      languageCode: reqLangCode,
      accountId: bodyAccountId,
      components,
      variables,
      customMediaUrl,
      customCarouselMedia,
      background = false
    } = req.body;

    const accountId = bodyAccountId || req.headers['x-account-id'] || req.query.account_id || null;
    const organizationId = req.organizationId || req.user?.organization_id || null;
    const userId = req.user?.id || 1;
    const senderName = req.user?.full_name || req.user?.name || req.user?.username || `User #${userId}`;
    const senderType = req.user?.is_team_member ? 'Team Member' : (req.user?.agent_id ? 'Agent' : 'User');

    if (!campaignName) {
      return res.status(400).json({ success: false, message: 'Campaign Name is required' });
    }
    if (!template) {
      return res.status(400).json({ success: false, message: 'Template is required' });
    }
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one phone number is required' });
    }

    // Atomically claim the idempotency key before creating/sending a campaign.
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;
    if (idempotencyKey) {
      try {
        await pool.execute(
          `INSERT INTO campaign_idempotency (idempotency_key, user_id, created_at) VALUES (?, ?, NOW())`,
          [idempotencyKey, userId]
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          logger.warn(`[CampaignController] Blocked duplicate campaign submission for user ${userId}.`);
          return res.status(409).json({
            success: false,
            message: 'This campaign was already submitted. Duplicate request blocked.'
          });
        }

        // Fail closed when idempotency was requested but its database check failed.
        logger.error('[CampaignController] Idempotency check failed:', err);
        return res.status(503).json({
          success: false,
          message: 'Campaign submission could not be safely verified. Please try again.'
        });
      }
    } else {
      logger.warn('[CampaignController] Campaign send request received without an Idempotency-Key header — duplicate protection skipped.');
    }

    const featureKey = req.body.featureKey || 'quick';
    const creditCheck = await hasSufficientCredits(userId, numbers.length, featureKey);
    if (!creditCheck.sufficient) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Quick credits. You have ${creditCheck.available} Quick credit(s) remaining, but this campaign requires ${numbers.length} credit(s). Please contact your administrator.`
      });
    }

    logger.info(`[CampaignController] Starting campaign "${campaignName}" with template "${template}" for ${numbers.length} numbers using account ID ${accountId} for org ${organizationId}.`);

    const languageCode = reqLangCode || 'en_US';

    if (background === true) {
      // Save the full send payload in the INSERT itself. This avoids a queued
      // campaign being visible to the scheduler before its payload is saved.
      const [queued] = await pool.execute(
        `INSERT INTO campaigns
          (user_id, sender_name, sender_type, organization_id, whatsapp_account_id,
           campaign_name, template_name, language_code, country, total_numbers,
           sent_count, failed_count, status, scheduled_at, numbers_json,
           components_json, variables_json, custom_media_url, carousel_media_json,
           feature_key, auto_recover, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'queued',
                 DATE_ADD(NOW(), INTERVAL 2 SECOND), ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [
          userId,
          senderName,
          senderType,
          organizationId,
          accountId,
          campaignName,
          template,
          languageCode,
          country || null,
          numbers.length,
          JSON.stringify(numbers),
          JSON.stringify(components || []),
          JSON.stringify(variables || {}),
          customMediaUrl || null,
          JSON.stringify(customCarouselMedia || null),
          featureKey
        ]
      );

      const campaignId = queued.insertId;
      // Trigger background processing immediately without waiting for cron
      setImmediate(() => {
        processDurableQueuedCampaigns().catch(e => logger.error(`[CampaignController] Instant dispatch error: ${e.message}`));
      });

      return res.status(202).json({
        success: true,
        queued: true,
        campaignId,
        campaignName,
        total: numbers.length,
        message: `Campaign "${campaignName}" queued. Sending will start in 2 seconds.`
      });
    }

    const result = await sendCampaignTemplate({
      userId,
      senderName,
      senderType,
      organizationId,
      accountId,
      campaignName,
      templateName: template,
      languageCode,
      country,
      numbers,
      components,
      variables,
      customMediaUrl,
      customCarouselMedia,
      featureKey
    });

    return res.status(result?.success === false ? 400 : 200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaign/schedule
 * Saves a campaign to run at a future date and time.
 */
export const scheduleCampaign = async (req, res, next) => {
  try {
    const {
      campaignName,
      template,
      country,
      numbers,
      scheduledAt,
      languageCode: reqLangCode,
      accountId: bodyAccountId,
      components,
      variables,
      customMediaUrl,
      customCarouselMedia,
      featureKey: requestedFeatureKey
    } = req.body;

    if (!campaignName) {
      return res.status(400).json({ success: false, message: 'Campaign Name is required' });
    }
    if (!template) {
      return res.status(400).json({ success: false, message: 'Template is required' });
    }
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one phone number is required' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time is required' });
    }

    const userId = req.user?.id || 1;
    const senderName = req.user?.full_name || req.user?.name || req.user?.username || `User #${userId}`;
    const senderType = req.user?.is_team_member ? 'Team Member' : (req.user?.agent_id ? 'Agent' : 'User');
    const featureKey = requestedFeatureKey || 'quick';

    const creditCheck = await hasSufficientCredits(userId, numbers.length, featureKey);
    if (!creditCheck.sufficient) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credits. You have ${creditCheck.available} credit(s) remaining, but this schedule requires ${numbers.length} credit(s). Please contact your administrator.`
      });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid scheduled date/time format' });
    }

    const now = new Date();
    const diffMs = scheduledDate.getTime() - now.getTime();
    if (diffMs <= 0) {
      return res.status(400).json({ success: false, message: 'Schedule date must be in the future' });
    }

    // Format for MySQL DATETIME preserving the server's local time.
    const pad = (n) => String(n).padStart(2, '0');
    const formattedMysqlDate = `${scheduledDate.getFullYear()}-${pad(scheduledDate.getMonth() + 1)}-${pad(scheduledDate.getDate())} ${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}:${pad(scheduledDate.getSeconds())}`;
    const languageCode = reqLangCode || 'en_US';
    const organizationId = req.organizationId || req.user?.organization_id || null;
    const accountId = bodyAccountId || req.headers['x-account-id'] || req.query.account_id || null;

    // Persist the same payload fields used by background campaigns so a
    // scheduled campaign resumes with its original variables and media.
    const [result] = await pool.execute(
      `INSERT INTO campaigns
        (user_id, sender_name, sender_type, organization_id, whatsapp_account_id,
         campaign_name, template_name, language_code, country, total_numbers,
         status, scheduled_at, numbers_json, components_json, variables_json,
         custom_media_url, carousel_media_json, feature_key, auto_recover)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        userId,
        senderName,
        senderType,
        organizationId,
        accountId,
        campaignName,
        template,
        languageCode,
        country || null,
        numbers.length,
        formattedMysqlDate,
        JSON.stringify(numbers),
        JSON.stringify(components || []),
        JSON.stringify(variables || {}),
        customMediaUrl || null,
        JSON.stringify(customCarouselMedia || null),
        featureKey
      ]
    );

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeRemainingStr = hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;

    logger.info(`[CampaignController] Scheduled campaign ID ${result.insertId} "${campaignName}" for ${formattedMysqlDate} (${timeRemainingStr} from now).`);

    return res.status(200).json({
      success: true,
      message: `Campaign scheduled successfully! Messages will be sent in ${timeRemainingStr}.`,
      campaignId: result.insertId,
      scheduledAt: formattedMysqlDate,
      timeRemaining: timeRemainingStr,
      totalNumbers: numbers.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaign/scheduled
 * Fetches all persistent scheduled campaigns from MySQL database.
 */
export const getScheduledCampaigns = async (req, res, next) => {
  try {
    const organizationId = req.organizationId || req.user?.organization_id || 1;
    const showAll = req.query.all === 'true';
    const query = showAll
      ? `SELECT id, campaign_name, template_name, language_code, country, total_numbers, sent_count, failed_count, status, scheduled_at, created_at
         FROM campaigns
         WHERE scheduled_at IS NOT NULL
           AND (organization_id = ? OR organization_id IS NULL)
         ORDER BY scheduled_at DESC`
      : `SELECT id, campaign_name, template_name, language_code, country, total_numbers, sent_count, failed_count, status, scheduled_at, created_at
         FROM campaigns
         WHERE status IN ('scheduled', 'running')
           AND scheduled_at IS NOT NULL
           AND (organization_id = ? OR organization_id IS NULL)
         ORDER BY scheduled_at ASC`;

    const [rows] = await pool.execute(query, [organizationId]);
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/campaign/scheduled/:id
 * Cancels queued/scheduled campaigns. A running campaign cannot safely be
 * labelled cancelled here because its worker may still be sending messages.
 */
export const cancelScheduledCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId || req.user?.organization_id || 1;

    const [rows] = await pool.execute(
      `SELECT id, status FROM campaigns WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)`,
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Scheduled campaign log not found' });
    }

    const item = rows[0];

    if (item.status === 'running') {
      return res.status(409).json({
        success: false,
        message: 'This campaign is currently running and cannot be safely cancelled from this action.'
      });
    }

    if (item.status === 'scheduled' || item.status === 'queued') {
      const [update] = await pool.execute(
        `UPDATE campaigns SET status = 'cancelled' WHERE id = ? AND status IN ('scheduled', 'queued')`,
        [id]
      );

      if (!update.affectedRows) {
        return res.status(409).json({
          success: false,
          message: 'Campaign status changed before it could be cancelled. Refresh and try again.'
        });
      }

      logger.info(`[CampaignController] Cancelled queued/scheduled campaign ID ${id}.`);
      return res.status(200).json({
        success: true,
        message: 'Campaign cancelled successfully'
      });
    }

    await pool.execute(`DELETE FROM campaigns WHERE id = ?`, [id]);
    logger.info(`[CampaignController] Deleted campaign log ID ${id}.`);
    return res.status(200).json({
      success: true,
      message: 'Scheduled log entry removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaign/scheduled/:id/run-now
 * Manually trigger execution of a scheduled campaign immediately.
 * The sender service is responsible for campaign worker locking and recipient
 * state handling; this controller reloads the persisted original payload.
 */
export const runScheduledCampaignNow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId || req.user?.organization_id || 1;

    const [rows] = await pool.execute(
      `SELECT * FROM campaigns WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)`,
      [id, organizationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign log not found' });
    }

    const campaign = rows[0];

    if (['running', 'cancelled', 'completed', 'sent'].includes(String(campaign.status || '').toLowerCase())) {
      return res.status(409).json({
        success: false,
        message: `Campaign cannot be started from its current status: ${campaign.status}.`
      });
    }

    let numbers = [];
    if (campaign.numbers_json) {
      try {
        numbers = typeof campaign.numbers_json === 'string'
          ? JSON.parse(campaign.numbers_json)
          : campaign.numbers_json;
      } catch (error) {
        logger.error(`[CampaignController] Invalid numbers_json for campaign ${id}:`, error);
      }
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
      const [crRows] = await pool.execute(
        `SELECT DISTINCT phone FROM campaign_recipients WHERE campaign_id = ?`,
        [campaign.id]
      );
      numbers = crRows.map((row) => row.phone).filter(Boolean);
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No recipient numbers found for this campaign.' });
    }

    let savedComponents = [];
    try {
      if (campaign.components_json) {
        savedComponents = typeof campaign.components_json === 'string'
          ? JSON.parse(campaign.components_json)
          : campaign.components_json;
      }
    } catch (error) {
      logger.error(`[CampaignController] Invalid components_json for campaign ${id}:`, error);
      return res.status(400).json({ success: false, message: 'Saved campaign components are invalid. Please recreate the campaign.' });
    }

    let savedVariables = {};
    try {
      if (campaign.variables_json) {
        savedVariables = typeof campaign.variables_json === 'string'
          ? JSON.parse(campaign.variables_json)
          : campaign.variables_json;
      }
    } catch (error) {
      logger.error(`[CampaignController] Invalid variables_json for campaign ${id}:`, error);
      return res.status(400).json({ success: false, message: 'Saved campaign variables are invalid. Please recreate the campaign.' });
    }

    let savedCarouselMedia = null;
    try {
      if (campaign.carousel_media_json) {
        savedCarouselMedia = typeof campaign.carousel_media_json === 'string'
          ? JSON.parse(campaign.carousel_media_json)
          : campaign.carousel_media_json;
      }
    } catch (error) {
      logger.error(`[CampaignController] Invalid carousel_media_json for campaign ${id}:`, error);
      return res.status(400).json({ success: false, message: 'Saved campaign carousel media is invalid. Please recreate the campaign.' });
    }

    logger.info(`[CampaignController] Triggering manual run/resume for campaign ID ${id} (${numbers.length} numbers)...`);

    const result = await sendCampaignTemplate({
      userId: req.user?.id || campaign.user_id || 1,
      senderName: campaign.sender_name || null,
      senderType: campaign.sender_type || 'User',
      organizationId: campaign.organization_id || organizationId,
      accountId: campaign.whatsapp_account_id,
      campaignName: campaign.campaign_name,
      templateName: campaign.template_name,
      languageCode: campaign.language_code || 'en_US',
      country: campaign.country,
      numbers,
      components: savedComponents,
      variables: savedVariables,
      customMediaUrl: campaign.custom_media_url || null,
      customCarouselMedia: savedCarouselMedia,
      existingCampaignId: campaign.id,
      featureKey: campaign.feature_key || 'quick'
    });

    if (!result || result.success !== true) {
      const errorDetail = result?.results?.find((row) => !row.success)?.error
        || result?.message
        || 'Execution failed';

      return res.status(400).json({
        success: false,
        message: `Campaign execution failed: ${errorDetail}`,
        result: result || null
      });
    }

    return res.status(200).json({
      success: true,
      message: `Campaign executed! Sent: ${result.sent || 0}, Failed: ${result.failed || 0}`,
      result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaign/send-by-tag
 * Fetch all contacts for a specific tag and send a template to them.
 */
export const sendByTagCampaign = async (req, res, next) => {
  try {
    const {
      campaignName,
      template,
      country,
      tagId,
      languageCode: reqLangCode,
      components,
      variables,
      customMediaUrl,
      customCarouselMedia,
      background = false
    } = req.body;

    if (!campaignName) return res.status(400).json({ success: false, message: 'Campaign Name is required' });
    if (!template) return res.status(400).json({ success: false, message: 'Template is required' });
    if (!tagId) return res.status(400).json({ success: false, message: 'Tag ID is required' });

    const [chatRows] = await pool.execute(
      `SELECT COALESCE(c.contact_phone, ct.chat_id) AS phoneNumber
       FROM chat_tags ct
       LEFT JOIN conversations c ON (c.id = ct.chat_id OR c.contact_phone = ct.chat_id)
       WHERE ct.tag_id = ?
         AND TRIM(COALESCE(c.contact_phone, ct.chat_id, '')) <> ''`,
      [tagId]
    );

    const [contactRows] = await pool.execute(
      `SELECT ct.phone AS phoneNumber
       FROM contact_tags ct
       WHERE ct.tag_id = ?
         AND TRIM(COALESCE(ct.phone, '')) <> ''`,
      [tagId]
    );

    const numbers = [...new Set([
      ...chatRows.map((row) => String(row.phoneNumber || '').trim()),
      ...contactRows.map((row) => String(row.phoneNumber || '').trim())
    ].filter(Boolean))]
      .map((phone) => phone.replace(/^[+]/, '').replace(/[^0-9]/g, ''))
      .filter((phone) => phone.length >= 7 && phone.length <= 15);

    if (numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No contacts are assigned to this tag.' });
    }

    const userId = req.user?.id || 1;
    const senderName = req.user?.full_name || req.user?.name || req.user?.username || `User #${userId}`;
    const senderType = req.user?.is_team_member ? 'Team Member' : (req.user?.agent_id ? 'Agent' : 'User');
    const creditCheck = await hasSufficientCredits(userId, numbers.length, 'tags');

    if (!creditCheck.sufficient) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Tag credits. You have ${creditCheck.available} Tag credit(s) remaining, but this campaign requires ${numbers.length} credit(s). Please contact your administrator.`
      });
    }

    logger.info(`[CampaignController] Starting campaign by tag "${campaignName}" with template "${template}" for ${numbers.length} numbers.`);

    const languageCode = reqLangCode || 'en_US';
    const accountId = req.body.accountId || req.headers['x-account-id'] || req.query.account_id || null;
    const organizationId = req.organizationId || req.user?.organization_id || null;

    if (background === true) {
      const [queued] = await pool.execute(
        `INSERT INTO campaigns
          (user_id, sender_name, sender_type, organization_id, whatsapp_account_id,
           campaign_name, template_name, language_code, country, total_numbers,
           sent_count, failed_count, status, scheduled_at, numbers_json,
           components_json, variables_json, custom_media_url, carousel_media_json,
           feature_key, auto_recover, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'queued',
                 DATE_ADD(NOW(), INTERVAL 2 SECOND), ?, ?, ?, ?, ?, 'tags', 1, NOW())`,
        [
          userId,
          senderName,
          senderType,
          organizationId,
          accountId,
          campaignName,
          template,
          languageCode,
          country || null,
          numbers.length,
          JSON.stringify(numbers),
          JSON.stringify(components || []),
          JSON.stringify(variables || {}),
          customMediaUrl || null,
          JSON.stringify(customCarouselMedia || null)
        ]
      );

      const campaignId = queued.insertId;
      setImmediate(() => {
        processDurableQueuedCampaigns().catch(e => logger.error(`[CampaignController] Instant dispatch error: ${e.message}`));
      });

      return res.status(202).json({
        success: true,
        queued: true,
        campaignId,
        campaignName,
        total: numbers.length,
        message: `Campaign "${campaignName}" queued. Sending starts in 2 seconds.`
      });
    }

    const result = await sendCampaignTemplate({
      userId,
      senderName,
      senderType,
      organizationId,
      accountId,
      campaignName,
      templateName: template,
      languageCode,
      country: country || null,
      numbers,
      components,
      variables,
      customMediaUrl,
      customCarouselMedia,
      featureKey: 'tags'
    });

    return res.status(result?.success === false ? 400 : 200).json({
      ...result,
      success: result?.success !== false,
      total: result?.total || numbers.length,
      sent: result?.sent || 0,
      failed: result?.failed || 0
    });
  } catch (error) {
    next(error);
  }
};
