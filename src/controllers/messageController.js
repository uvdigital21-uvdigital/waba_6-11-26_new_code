// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/messageController.js
// Handles the POST /api/send-message and POST /api/send-template endpoints.
// Validates input, checks & deducts credits, delegates to whatsappService.
// ─────────────────────────────────────────────────────────────────────────────

import whatsappService from '../services/whatsappService.js';
import logger from '../utils/logger.js';
import { pool } from '../config/db.js';
import { recordChatMessage } from '../services/chatService.js';
import { hasSufficientCredits, deductMessageCredit } from '../services/creditService.js';
import { emitToOrganization } from '../utils/socket.js';

/**
 * POST /api/send-message
 * Send a text message via WhatsApp Cloud API.
 */
export const sendMessage = async (req, res, next) => {
  try {
    const { phone, message, accountId: bodyAccountId, featureKey: bodyFeatureKey } = req.body;
    const userId = req.user?.id || 1;
    const senderName = req.user?.full_name || req.user?.name || req.user?.username || `User #${userId}`;
    const senderType = req.user?.is_team_member ? 'Team Member' : (req.user?.agent_id ? 'Agent' : 'User');
    const organizationId = req.organizationId || req.user?.organization_id;
    const accountId = bodyAccountId || req.headers['x-account-id'] || req.query.account_id || null;
    const featureKey = bodyFeatureKey || 'quick';

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Both "phone" and "message" fields are required.',
      });
    }

    const sanitisedPhone = String(phone).replace(/^\+/, '').trim();
    if (!/^\d{7,15}$/.test(sanitisedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Provide digits only with country code (e.g. 919999999999).',
      });
    }

    const sanitisedMessage = String(message).trim();
    if (!sanitisedMessage) {
      return res.status(400).json({
        success: false,
        message: '"message" cannot be empty.',
      });
    }

    // 1. Credit Pre-check
    const creditCheck = await hasSufficientCredits(userId, 1, featureKey);
    if (!creditCheck.sufficient) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credits. You have ${creditCheck.available} credit(s) remaining for this feature, but 1 credit is required. Please contact your administrator for a topup.`
      });
    }

    logger.info(`[MessageController] Sending message to ${sanitisedPhone} using account ID ${accountId} for org ${organizationId}`);

    const result = await whatsappService.sendTextMessage(sanitisedPhone, sanitisedMessage, accountId, organizationId);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.message,
        details: result.details ?? null,
      });
    }

    // 2. Deduct 1 credit on success
    await deductMessageCredit(userId, 1, `Message sent to ${sanitisedPhone}`, featureKey);

    // Save sent message to chat database
    await recordChatMessage({
      userId,
      organizationId,
      phone: sanitisedPhone,
      messageText: sanitisedMessage,
      wamid: result.messageId,
      sender: 'user',
      status: 'sent',
    });

    // Record Campaign History
    try {
      const [cRes] = await pool.execute(
        `INSERT INTO campaigns (user_id, sender_name, sender_type, organization_id, whatsapp_account_id, campaign_name, template_name, total_numbers, sent_count, failed_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 'completed', NOW())`,
        [userId, senderName, senderType, organizationId || 1, accountId || null, `Quick Message - ${sanitisedPhone}`, 'Direct Text']
      );
      const campId = cRes.insertId;
      await pool.execute(
        'UPDATE messages SET campaign_id = ? WHERE wa_message_id = ? AND (organization_id IS NULL OR organization_id = ?)',
        [campId, result.messageId, organizationId || 1]
      );
      await pool.execute(
        `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, message_id, status, sent_at)
         VALUES (?, ?, ?, ?, ?, 'sent', NOW())`,
        [organizationId || 1, accountId || null, campId, sanitisedPhone, result.messageId]
      );
      emitToOrganization(organizationId || 1, 'sending_history_updated', {
        type: 'new_campaign',
        campaignId: campId,
        phone: sanitisedPhone,
      });
    } catch (cErr) {
      logger.warn('[MessageController] Failed to record quick message campaign:', cErr.message);
    }

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/send-template
 * Send an official pre-approved Meta WhatsApp template message.
 */
export const sendTemplate = async (req, res, next) => {
  try {
    const {
      phone,
      templateName,
      languageCode = 'en_US',
      components = [],
      variables = {},
      customMediaUrl = null,
      customCarouselMedia = null,
      accountId: bodyAccountId,
      featureKey: bodyFeatureKey
    } = req.body;
    const userId = req.user?.id || 1;
    const senderName = req.user?.full_name || req.user?.name || req.user?.username || `User #${userId}`;
    const senderType = req.user?.is_team_member ? 'Team Member' : (req.user?.agent_id ? 'Agent' : 'User');
    const organizationId = req.organizationId || req.user?.organization_id;
    const accountId = bodyAccountId || req.headers['x-account-id'] || req.query.account_id || null;
    const featureKey = bodyFeatureKey || 'quick';

    if (!phone || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Both "phone" and "templateName" fields are required.',
      });
    }

    // 1. Credit Pre-check
    const creditCheck = await hasSufficientCredits(userId, 1, featureKey);
    if (!creditCheck.sufficient) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credits. You have ${creditCheck.available} credit(s) remaining for this feature, but 1 credit is required. Please contact your administrator for a topup.`
      });
    }

    const sanitisedPhone = String(phone).replace(/^\+/, '').trim();

    logger.info(
      `[MessageController] Sending template "${templateName}" to ${sanitisedPhone} using account ID ${accountId} for org ${organizationId} (featureKey: ${featureKey})`
    );

    const result = await whatsappService.sendTemplateMessage({
      to: sanitisedPhone,
      templateName,
      languageCode,
      components,
      variables,
      customMediaUrl,
      customCarouselMedia,
      accountId,
      organizationId,
      userId,
      campaignType: 'quick',
      featureKey
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.message,
        details: result.details ?? null,
      });
    }

    // The central sender already deducts credit and stores the rendered template.
    // Record only the reporting campaign row here.
    try {
      const [cRes] = await pool.execute(
        `INSERT INTO campaigns (user_id, sender_name, sender_type, organization_id, whatsapp_account_id, campaign_name, template_name, total_numbers, sent_count, failed_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 'completed', NOW())`,
        [userId, senderName, senderType, organizationId || 1, accountId || null, `Quick Campaign - ${sanitisedPhone}`, templateName]
      );
      const campId = cRes.insertId;
      await pool.execute(
        `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, message_id, status, sent_at)
         VALUES (?, ?, ?, ?, ?, 'sent', NOW())`,
        [organizationId || 1, accountId || null, campId, sanitisedPhone, result.messageId]
      );
      emitToOrganization(organizationId || 1, 'sending_history_updated', {
        type: 'new_campaign',
        campaignId: campId,
        templateName,
        phone: sanitisedPhone,
      });
    } catch (cErr) {
      logger.warn('[MessageController] Failed to record quick template campaign:', cErr.message);
    }

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
};
