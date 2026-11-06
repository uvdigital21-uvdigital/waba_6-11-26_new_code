// ─────────────────────────────────────────────────────────────────────────────
// src/routes/metaBillingRoutes.js
// Routes for Meta WhatsApp Message Pricing & Billing Insights
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import { getBillingInsights, refreshBillingInsights } from '../controllers/metaBillingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply auth to all routes
router.use(requireAuth);

router.get('/billing-insights', getBillingInsights);
router.post('/billing-insights/refresh', refreshBillingInsights);

export default router;

