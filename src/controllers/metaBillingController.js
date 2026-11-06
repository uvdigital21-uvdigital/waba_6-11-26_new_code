// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/metaBillingController.js
// Handles Meta WhatsApp Billing & Insights API endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { syncMetaBillingFromApi, getInsightsFromDatabase, getConnectedMetaAccount, getRangeTimestamps } from '../services/metaBillingService.js';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * GET /api/meta/billing-insights
 * Fetches billing and conversation insights from database.
 * If database is empty for the requested range, automatically triggers initial Meta sync.
 */
export async function getBillingInsights(req, res) {
  try {
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const accountId = req.query.accountId || req.query.account_id || null;
    const dateRange = req.query.dateRange || '30days';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    // Check if we have DB records for this period
    const timeInfo = getRangeTimestamps(dateRange, startDate, endDate);
    const [existingCount] = await pool.query(
      `SELECT COUNT(*) as cnt 
       FROM meta_insights 
       WHERE organization_id = ? AND date_from = ? AND date_to = ?`,
      [orgId, timeInfo.startDateStr, timeInfo.endDateStr]
    );

    // If zero records in DB, perform initial sync first
    if ((existingCount[0]?.cnt || 0) === 0) {
      logger.info(`[MetaBillingController] No DB data found for ${timeInfo.startDateStr} to ${timeInfo.endDateStr}. Performing initial Meta sync...`);
      try {
        await syncMetaBillingFromApi(orgId, accountId, dateRange, startDate, endDate);
      } catch (syncErr) {
        logger.warn('[MetaBillingController] Initial Meta sync warning:', syncErr.message);
      }
    }

    // Always read from DB
    const data = await getInsightsFromDatabase(orgId, accountId, dateRange, startDate, endDate);
    return res.json({
      success: true,
      ...data
    });
  } catch (err) {
    logger.error('[MetaBillingController] getBillingInsights error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve Meta WhatsApp billing insights'
    });
  }
}

/**
 * POST /api/meta/billing-insights/refresh
 * Forces an immediate live sync from Meta Cloud API -> Stores record-by-record in DB -> Returns DB data.
 */
export async function refreshBillingInsights(req, res) {
  try {
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const accountId = req.body.accountId || req.body.account_id || null;
    const dateRange = req.body.dateRange || '30days';
    const startDate = req.body.startDate || null;
    const endDate = req.body.endDate || null;

    logger.info(`[MetaBillingController] Manual Refresh requested for Org ${orgId}, Period: ${dateRange}`);

    // 1. Fetch live from Meta, validate, and upsert record-by-record into DB
    const syncResult = await syncMetaBillingFromApi(orgId, accountId, dateRange, startDate, endDate);

    // 2. Read strictly from DB after commit
    const data = await getInsightsFromDatabase(orgId, accountId, dateRange, startDate, endDate);

    return res.json({
      success: true,
      syncResult,
      ...data
    });
  } catch (err) {
    logger.error('[MetaBillingController] refreshBillingInsights error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Meta live sync failed. Existing data has not been modified.'
    });
  }
}

/**
 * GET /api/meta/billing-insights/debug
 * Debug validation endpoint comparing Meta vs DB vs Dashboard values.
 */
export async function getBillingDebug(req, res) {
  try {
    const orgId = req.organizationId || req.user?.organization_id || 1;
    const accountId = req.query.accountId || null;
    const dateRange = req.query.dateRange || 'today';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    const timeInfo = getRangeTimestamps(dateRange, startDate, endDate);

    // 1. Query raw records from DB
    const [dbSnapshot] = await pool.query(
      `SELECT * FROM meta_insights 
       WHERE organization_id = ? AND date_from = ? AND date_to = ?
       ORDER BY id DESC LIMIT 1`,
      [orgId, timeInfo.startDateStr, timeInfo.endDateStr]
    );

    // 2. Query sync runs
    const [syncLogs] = await pool.query(
      `SELECT * FROM meta_sync_logs 
       WHERE organization_id = ? 
       ORDER BY id DESC LIMIT 5`,
      [orgId]
    );

    // 3. Query computed DB insights
    const dbInsights = await getInsightsFromDatabase(orgId, accountId, dateRange, startDate, endDate);

    return res.json({
      success: true,
      timeInfo,
      dbSnapshot: dbSnapshot[0] || null,
      syncLogs,
      dashboardDto: dbInsights
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
