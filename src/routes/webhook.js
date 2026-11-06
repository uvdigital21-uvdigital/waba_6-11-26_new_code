// ─────────────────────────────────────────────────────────────────────────────
// src/routes/webhook.js
// Mounts GET and POST /webhook handlers.
//
// IMPORTANT: The raw body parser is applied to POST /webhook so that Meta's
// signature verification (if you add it later) can access the raw bytes.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/webhookController.js';

const router = express.Router();

/**
 * GET /webhook
 * Meta calls this when you first configure the webhook in Developer Dashboard.
 * Responds with hub.challenge to verify ownership.
 */
router.get('/', verifyWebhook);
router.get('/meta', verifyWebhook);

/**
 * POST /webhook
 * Meta sends all events here (incoming messages, status updates, etc.).
 * Must always return HTTP 200 quickly.
 */
router.post('/', receiveWebhook);
router.post('/meta', receiveWebhook);

export default router;
