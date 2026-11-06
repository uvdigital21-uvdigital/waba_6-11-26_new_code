import { pool } from '../config/db.js';
import { sendCampaignTemplate } from './metaWhatsAppService.js';
import logger from '../utils/logger.js';

/**
 * Add a column only when it is absent. Re-check the schema each time instead
 * of relying on a column list captured before earlier ALTER statements.
 */
const ensureColumn = async (connection, table, column, definition) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);

  if (!rows.some((row) => row.Field === column)) {
    await connection.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
    );
    logger.info(`[Scheduler] Added ${table}.${column}.`);
  }
};

/**
 * Ensure the columns used by the persistent campaign scheduler and sender
 * exist. DDL failures are surfaced to the caller instead of being silently
 * ignored; otherwise the scheduler could start with a partially upgraded DB.
 */
export const ensureScheduleColumns = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    await ensureColumn(connection, 'campaigns', 'scheduled_at', 'DATETIME DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'numbers_json', 'LONGTEXT DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'organization_id', 'INT UNSIGNED NULL');
    await ensureColumn(connection, 'campaigns', 'whatsapp_account_id', 'INT UNSIGNED NULL');
    await ensureColumn(connection, 'campaigns', 'custom_media_url', 'LONGTEXT DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'components_json', 'LONGTEXT DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'variables_json', 'LONGTEXT DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'carousel_media_json', 'LONGTEXT DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'feature_key', "VARCHAR(50) NOT NULL DEFAULT 'quick'");
    await ensureColumn(connection, 'campaigns', 'auto_recover', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'campaigns', 'worker_token', 'VARCHAR(191) DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'worker_heartbeat', 'DATETIME DEFAULT NULL');
    await ensureColumn(connection, 'campaigns', 'worker_lease_until', 'DATETIME DEFAULT NULL');

    // Convert a legacy ENUM to VARCHAR so the scheduler's lifecycle states fit.
    const [statusRows] = await connection.query(
      `SHOW COLUMNS FROM campaigns LIKE 'status'`
    );
    const statusColumn = statusRows[0];

    if (statusColumn?.Type && String(statusColumn.Type).toLowerCase().includes('enum')) {
      await connection.query(
        `ALTER TABLE campaigns MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'`
      );
      logger.info('[Scheduler] Converted campaigns.status from ENUM to VARCHAR.');
    }

    logger.info('[Scheduler] Database schema verified for persistent campaigns.');
  } catch (error) {
    logger.error('[Scheduler] Database schema setup failed:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Mark only running campaigns whose worker lease has actually expired.
 *
 * Do NOT mark every running campaign interrupted at process startup: another
 * Node process/instance may still own a healthy worker lease.
 */
export const markInterruptedCampaigns = async () => {
  try {
    const [result] = await pool.execute(
      `UPDATE campaigns
       SET status = 'interrupted'
       WHERE status = 'running'
         AND worker_token IS NOT NULL
         AND worker_lease_until IS NOT NULL
         AND worker_lease_until < NOW()`
    );

    if (result.affectedRows) {
      logger.warn(
        `[Scheduler] Marked ${result.affectedRows} campaign(s) interrupted because their worker leases expired.`
      );
    }
  } catch (error) {
    logger.error('[Scheduler] markInterruptedCampaigns failed:', error.message);
    throw error;
  }
};

/**
 * Move due scheduled campaigns into the durable queue.
 *
 * Compare DATETIME values inside MySQL rather than converting a MySQL DATETIME
 * to a JavaScript Date and appending "Z". DATETIME has no timezone metadata;
 * appending Z can shift a locally stored schedule by the server's UTC offset.
 */
export const checkAndRunScheduledCampaigns = async () => {
  try {
    const [result] = await pool.execute(
      `UPDATE campaigns
       SET status = 'queued'
       WHERE status = 'scheduled'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= NOW()`
    );

    if (result.affectedRows > 0) {
      logger.info(
        `[Scheduler] ${result.affectedRows} due scheduled campaign(s) moved to the durable queue.`
      );
    }

    // The durable queue dispatcher is the single execution path for both
    // scheduled and background campaigns. The sender service owns the DB lock.
    await processDurableQueuedCampaigns();
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.warn('[Scheduler] Database is offline or unreachable. Will retry on next interval.');
    } else {
      logger.error('[Scheduler] Error checking scheduled campaigns:', error.message);
    }
  }
};

/**
 * Persistent queued dispatcher.
 *
 * This in-memory set reduces duplicate work inside this Node process only.
 * Cross-process safety must come from the worker-token lease in the sender
 * service; never rely on these Sets as a distributed lock.
 */
const queuedActive = new Set();
const queuedAccounts = new Set();
let queuedScanning = false;

export async function processDurableQueuedCampaigns() {
  if (queuedScanning) return;
  queuedScanning = true;

  try {
    // Expired leases are eligible for recovery. The sender service must claim
    // the campaign atomically before sending any recipient messages.
    const [jobs] = await pool.execute(
      `SELECT *
       FROM campaigns
       WHERE status = 'queued'
         AND (
           worker_token IS NULL
           OR (worker_lease_until IS NOT NULL AND worker_lease_until < NOW())
         )
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY id ASC
       LIMIT 20`
    );

    for (const campaign of jobs) {
      if (queuedActive.size >= 10) break;

      const accountKey = campaign.whatsapp_account_id
        ? `account:${campaign.whatsapp_account_id}`
        : `org:${campaign.organization_id || 'default'}`;

      if (queuedActive.has(campaign.id) || queuedAccounts.has(accountKey)) {
        continue;
      }

      let numbers;
      try {
        numbers = typeof campaign.numbers_json === 'string'
          ? JSON.parse(campaign.numbers_json || '[]')
          : campaign.numbers_json;

        if (!Array.isArray(numbers) || numbers.length === 0) {
          throw new Error('Recipient list is empty or invalid');
        }
      } catch (error) {
        logger.error(`[Queue] Invalid campaign ${campaign.id}: ${error.message}`);
        await pool.execute(
          `UPDATE campaigns
           SET status = 'failed'
           WHERE id = ? AND status = 'queued' AND worker_token IS NULL`,
          [campaign.id]
        );
        continue;
      }

      const parseJson = (value, fallback, fieldName) => {
        if (value === null || value === undefined || value === '') return fallback;
        if (typeof value !== 'string') return value;

        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Campaign ${campaign.id} has invalid ${fieldName}: ${error.message}`);
        }
      };

      let data;
      try {
        data = {
          existingCampaignId: campaign.id,
          userId: campaign.user_id || 1,
          senderName: campaign.sender_name || null,
          senderType: campaign.sender_type || 'User',
          organizationId: campaign.organization_id || null,
          accountId: campaign.whatsapp_account_id || null,
          campaignName: campaign.campaign_name,
          templateName: campaign.template_name,
          languageCode: campaign.language_code || 'en_US',
          country: campaign.country || null,
          numbers,
          components: parseJson(campaign.components_json, [], 'components_json'),
          variables: parseJson(campaign.variables_json, {}, 'variables_json'),
          customMediaUrl: campaign.custom_media_url || null,
          customCarouselMedia: parseJson(campaign.carousel_media_json, null, 'carousel_media_json'),
          featureKey: campaign.feature_key || 'quick'
        };
      } catch (error) {
        logger.error(`[Queue] Cannot load payload for campaign ${campaign.id}: ${error.message}`);
        await pool.execute(
          `UPDATE campaigns
           SET status = 'failed'
           WHERE id = ? AND status = 'queued' AND worker_token IS NULL`,
          [campaign.id]
        );
        continue;
      }

      queuedActive.add(campaign.id);
      queuedAccounts.add(accountKey);

      // Do not await the entire send here: the scheduler must continue scanning.
      // Always release the process-local throttles, even when sending rejects.
      Promise.resolve()
        .then(() => sendCampaignTemplate(data))
        .then((result) => {
          logger.info(
            `[Queue] Campaign ${campaign.id} finished sender invocation: ${JSON.stringify({
              success: result?.success,
              sent: result?.sent,
              failed: result?.failed,
              message: result?.message
            })}`
          );

          if (result?.success === false) {
            logger.warn(`[Queue] Campaign ${campaign.id} did not complete successfully.`);
          }
        })
        .catch((error) => {
          logger.error(`[Queue] Campaign ${campaign.id} sender error: ${error.stack || error.message}`);
        })
        .finally(() => {
          queuedActive.delete(campaign.id);
          queuedAccounts.delete(accountKey);
        });
    }
  } catch (error) {
    logger.error(`[Queue] Dispatcher error: ${error.message}`);
  } finally {
    queuedScanning = false;
  }
}

/**
 * Recover only campaigns explicitly opted into automatic recovery.
 *
 * Before requeueing, stale "sending" recipient rows are changed to "uncertain".
 * An uncertain recipient must be reconciled through webhook/status history and
 * must not be blindly sent again, because Meta may already have accepted it.
 */
async function runSafeRecoveryCycle() {
  try {
    // Release only expired worker leases. A NULL lease with a non-NULL token is
    // not considered safe to steal automatically.
    const [released] = await pool.execute(
      `UPDATE campaigns
       SET worker_token = NULL,
           worker_heartbeat = NULL,
           worker_lease_until = NULL
       WHERE status IN ('interrupted', 'queued', 'running')
         AND auto_recover = 1
         AND worker_token IS NOT NULL
         AND worker_lease_until IS NOT NULL
         AND worker_lease_until < NOW()`
    );

    if (released.affectedRows > 0) {
      logger.warn(`[Recovery] Released ${released.affectedRows} expired campaign worker lease(s).`);
    }

    // Only update recipient rows for interrupted campaigns that opted in.
    const [recoverable] = await pool.execute(
      `SELECT id
       FROM campaigns
       WHERE status = 'interrupted'
         AND auto_recover = 1
         AND worker_token IS NULL
         AND numbers_json IS NOT NULL
       ORDER BY id ASC
       LIMIT 20`
    );

    for (const campaign of recoverable) {
      await pool.execute(
        `UPDATE campaign_recipients
         SET status = 'uncertain',
             error = 'Worker interrupted; Meta outcome requires reconciliation'
         WHERE campaign_id = ?
           AND status = 'sending'`,
        [campaign.id]
      );

      const [requeued] = await pool.execute(
        `UPDATE campaigns
         SET status = 'queued'
         WHERE id = ?
           AND status = 'interrupted'
           AND auto_recover = 1
           AND worker_token IS NULL`,
        [campaign.id]
      );

      if (requeued.affectedRows > 0) {
        logger.info(`[Recovery] Requeued opted-in campaign ${campaign.id}; uncertain recipients were not resent.`);
      }
    }
  } catch (error) {
    logger.error(`[Recovery] Safe recovery cycle failed: ${error.message}`);
  }
}

let schedulerInterval = null;
let schedulerCycleRunning = false;

/**
 * Initialize the background scheduler.
 * Safe to call more than once in the same Node process.
 */
export const initScheduler = async () => {
  if (schedulerInterval) {
    logger.info('[Scheduler] Scheduler is already initialized in this process.');
    return;
  }

  await ensureScheduleColumns();

  // This only marks campaigns with expired worker leases as interrupted.
  await markInterruptedCampaigns();

  // Recover opted-in interrupted campaigns, then process due work.
  await runSafeRecoveryCycle();
  await checkAndRunScheduledCampaigns();

  schedulerInterval = setInterval(async () => {
    if (schedulerCycleRunning) return;
    schedulerCycleRunning = true;

    try {
      await markInterruptedCampaigns();
      await runSafeRecoveryCycle();
      await checkAndRunScheduledCampaigns();
    } catch (error) {
      logger.error(`[Scheduler] Periodic cycle failed: ${error.message}`);
    } finally {
      schedulerCycleRunning = false;
    }
  }, 5_000);

  logger.info('[Scheduler] Persistent campaign scheduler active (5-second interval).');
};
