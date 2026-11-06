// ─────────────────────────────────────────────────────────────────────────────
// src/routes/message.js
// Mounts all outbound message endpoints under /api/messages
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { sendMessage, sendTemplate } from '../controllers/messageController.js';
import { 
  sendCampaign, 
  sendByTagCampaign,
  getTemplates, 
  scheduleCampaign, 
  getScheduledCampaigns, 
  cancelScheduledCampaign,
  runScheduledCampaignNow
} from '../controllers/campaignController.js';
import { getGroups, createGroup, deleteGroup } from '../controllers/groupController.js';
import {
  getBirthdayCampaigns,
  getBirthdayHistory,
  createBirthdayCampaign,
  updateBirthdayCampaign,
  deleteBirthdayCampaign,
  toggleBirthdayCampaign
} from '../controllers/birthdayController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Require JWT authentication for all messaging and campaign endpoints
router.use(requireAuth);

/**
 * POST /api/send-message
 * Send a plain text WhatsApp message.
 *
 * Body: { "phone": "919999999999", "message": "Hello" }
 */
router.post('/send-message', asyncHandler(sendMessage));

/**
 * POST /api/send-template
 * Send a pre-approved WhatsApp template message.
 *
 * Body: { "phone": "919999999999", "templateName": "hello_world", "languageCode": "en_US" }
 */
router.post('/send-template', asyncHandler(sendTemplate));

/**
 * GET /api/templates
 * Fetch approved official Meta templates
 */
router.get('/templates', asyncHandler(getTemplates));

/**
 * POST /api/campaign/send
 * Bulk send a campaign template
 */
router.post('/campaign/send', asyncHandler(sendCampaign));

/**
 * POST /api/campaign/send-by-tag
 * Bulk send a campaign template to contacts matching a tag
 */
router.post('/campaign/send-by-tag', asyncHandler(sendByTagCampaign));

/**
 * POST /api/campaign/schedule
 * Schedule a campaign for future date/time
 */
router.post('/campaign/schedule', asyncHandler(scheduleCampaign));

/**
 * GET /api/campaign/scheduled
 * Fetch upcoming scheduled campaigns
 */
router.get('/campaign/scheduled', asyncHandler(getScheduledCampaigns));

/**
 * POST /api/campaign/scheduled/:id/run-now
 * Run scheduled campaign immediately
 */
router.post('/campaign/scheduled/:id/run-now', asyncHandler(runScheduledCampaignNow));

/**
 * DELETE /api/campaign/scheduled/:id
 * Cancel or delete a scheduled campaign log
 */
router.delete('/campaign/scheduled/:id', asyncHandler(cancelScheduledCampaign));

/**
 * GET /api/groups
 * Fetch contact groups
 */
router.get('/groups', asyncHandler(getGroups));

/**
 * POST /api/groups
 * Create contact group
 */
router.post('/groups', asyncHandler(createGroup));

/**
 * DELETE /api/groups/:id
 * Delete contact group
 */
router.delete('/groups/:id', asyncHandler(deleteGroup));

import { getSendingHistory, getCampaignRecipients, resendCampaignRecipients } from '../controllers/reportController.js';

/**
 * Birthday Campaigns Routes
 */
router.get('/birthday-campaigns', asyncHandler(getBirthdayCampaigns));
router.get('/birthday-campaigns/history', asyncHandler(getBirthdayHistory));
router.post('/birthday-campaigns', asyncHandler(createBirthdayCampaign));
router.put('/birthday-campaigns/:id', asyncHandler(updateBirthdayCampaign));
router.delete('/birthday-campaigns/:id', asyncHandler(deleteBirthdayCampaign));
router.put('/birthday-campaigns/:id/toggle', asyncHandler(toggleBirthdayCampaign));

/**
 * Reports Routes
 */
router.get('/reports/sending-history', asyncHandler(getSendingHistory));
router.get('/reports/campaign/:id/recipients', asyncHandler(getCampaignRecipients));
router.post('/campaigns/:id/resend', asyncHandler(resendCampaignRecipients));

export default router;
