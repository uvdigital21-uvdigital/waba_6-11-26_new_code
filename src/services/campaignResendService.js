import { pool } from '../config/db.js';
import { sendCentralTemplateMessage } from './templateMessageSenderService.js';
import { emitToOrganization } from '../utils/socket.js';
import logger from '../utils/logger.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const json = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getErrorMessage = error => {
  if (!error) return 'Message send outcome is unknown';
  return String(error.message || error).slice(0, 2000);
};

export async function processResendJob(jobId) {
  // Atomic job claim: only one worker can start a queued resend job.
  const [claim] = await pool.query(
    `UPDATE campaign_resend_jobs
     SET status='running',
         started_at=COALESCE(started_at, NOW())
     WHERE id=? AND status='queued'`,
    [jobId]
  );

  if (claim.affectedRows !== 1) {
    logger.warn(
      `[CampaignResend] Job ${jobId} already claimed or not queued; execution skipped.`
    );
    return;
  }

  const [[job]] = await pool.query(
    'SELECT * FROM campaign_resend_jobs WHERE id=?',
    [jobId]
  );

  if (!job) return;

  const [[campaign]] = await pool.query(
    'SELECT * FROM campaigns WHERE id=?',
    [job.campaign_id]
  );

  if (!campaign) {
    await pool.query(
      `UPDATE campaign_resend_jobs
       SET status='failed',
           error_message='Campaign not found',
           finished_at=NOW()
       WHERE id=? AND status='running'`,
      [jobId]
    );
    return;
  }

  const [recipients] = await pool.query(
    `SELECT *
     FROM campaign_recipients
     WHERE resend_job_id=?
     ORDER BY id`,
    [jobId]
  );

  const args = {
    templateName: campaign.template_name,
    languageCode: campaign.language_code || 'en_US',
    components: json(campaign.components_json, []),
    variables: json(campaign.variables_json, {}),
    customMediaUrl: campaign.custom_media_url,
    customCarouselMedia: json(campaign.carousel_media_json, null),
    campaignId: campaign.id,
    campaignName: campaign.campaign_name,
    campaignType: 'resend',
    featureKey: campaign.feature_key || 'general',
    userId: campaign.user_id || 1,
    organizationId: campaign.organization_id,
    accountId: campaign.whatsapp_account_id
  };

  for (const recipient of recipients) {
    // Claim only queued recipients. Sent, delivered, read, failed, and
    // uncertain recipients are not automatically replayed.
    const [recipientClaim] = await pool.query(
      `UPDATE campaign_recipients
       SET status='sending'
       WHERE id=?
         AND resend_job_id=?
         AND status='queued'`,
      [recipient.id, jobId]
    );

    if (recipientClaim.affectedRows !== 1) continue;

    let result;

    try {
      result = await sendCentralTemplateMessage({
        ...args,
        recipient: recipient.phone
      });
    } catch (error) {
      // A thrown network/transport error does not prove Meta rejected the
      // message. Mark it uncertain so it cannot be blindly sent again.
      const message = `Unknown send outcome: ${getErrorMessage(error)}`;

      await pool.query(
        `UPDATE campaign_recipients
         SET status='uncertain',
             error=?
         WHERE id=?
           AND resend_job_id=?
           AND status='sending'`,
        [message, recipient.id, jobId]
      );

      logger.warn(
        `[CampaignResend] Send threw; outcome marked uncertain: job=${jobId}, recipient=${recipient.id}`
      );

      emitToOrganization(
        campaign.organization_id || 1,
        'campaign_resend_updated',
        { campaignId: campaign.id, jobId }
      );

      await wait(Number(process.env.CAMPAIGN_RESEND_DELAY_MS || 300));
      continue;
    }

    if (result?.success) {
      await pool.query(
        `UPDATE campaign_recipients
         SET message_id=?,
             status=CASE
               WHEN LOWER(status) IN ('delivered','read') THEN status
               ELSE 'sent'
             END,
             error=NULL,
             sent_at=NOW()
         WHERE id=?
           AND resend_job_id=?`,
        [result.messageId || null, recipient.id, jobId]
      );

      await pool.query(
        `UPDATE campaign_resend_jobs
         SET sent_count=sent_count+1
         WHERE id=?`,
        [jobId]
      );
    } else {
      const code =
        result?.details?.code ||
        result?.details?.error?.code ||
        null;

      const message = `${code ? `Meta Error ${code}: ` : ''}${result?.message || 'Message send failed'}`;
      const status = result?.uncertain ? 'uncertain' : 'failed';

      await pool.query(
        `UPDATE campaign_recipients
         SET status=?,
             error=?
         WHERE id=?
           AND resend_job_id=?
           AND status='sending'`,
        [status, message, recipient.id, jobId]
      );

      if (!result?.uncertain) {
        await pool.query(
          `UPDATE campaign_resend_jobs
           SET failed_count=failed_count+1
           WHERE id=?`,
          [jobId]
        );
      } else {
        logger.warn(
          `[CampaignResend] Unknown Meta outcome: job=${jobId}, recipient=${recipient.id}. Automatic retry disabled.`
        );
      }
    }

    emitToOrganization(
      campaign.organization_id || 1,
      'campaign_resend_updated',
      { campaignId: campaign.id, jobId }
    );

    await wait(Number(process.env.CAMPAIGN_RESEND_DELAY_MS || 300));
  }

  // A job is complete only when no recipient is queued, sending, or uncertain.
  // Uncertain recipients require reconciliation before any manual retry.
  const [[progress]] = await pool.query(
    `SELECT
       SUM(status='queued') AS queued,
       SUM(status='sending') AS sending,
       SUM(status='uncertain') AS uncertain
     FROM campaign_recipients
     WHERE resend_job_id=?`,
    [jobId]
  );

  const unresolved =
    Number(progress?.queued || 0) +
    Number(progress?.sending || 0) +
    Number(progress?.uncertain || 0);

  const finalStatus = unresolved > 0 ? 'interrupted' : 'awaiting_webhooks';

  await pool.query(
    `UPDATE campaign_resend_jobs
     SET status=?,
         error_message=CASE
           WHEN ? > 0
             THEN 'Unresolved recipients require reconciliation before retry'
           ELSE error_message
         END,
         finished_at=NOW()
     WHERE id=?
       AND status='running'`,
    [finalStatus, unresolved, jobId]
  );

  logger.info(
    `[CampaignResend] Job ${jobId}: ${finalStatus}, unresolved=${unresolved}`
  );

  emitToOrganization(
    campaign.organization_id || 1,
    'campaign_resend_updated',
    {
      campaignId: campaign.id,
      jobId,
      awaitingWebhooks: finalStatus === 'awaiting_webhooks'
    }
  );
}

// Call during startup recovery only. First preserve the unknown outcomes of
// recipients left in "sending", then interrupt their previously running jobs.
// These recipients must be reconciled; they must not be automatically resent.
export async function markStaleResendJobs() {
  const [recipientRecovery] = await pool.query(
    `UPDATE campaign_recipients AS recipient
     INNER JOIN campaign_resend_jobs AS job
       ON job.id=recipient.resend_job_id
     SET recipient.status='uncertain',
         recipient.error=COALESCE(
           recipient.error,
           'Worker stopped while sending; Meta delivery outcome is unknown. Reconcile before retry.'
         )
     WHERE job.status='running'
       AND recipient.status='sending'`
  );

  const [jobRecovery] = await pool.query(
    `UPDATE campaign_resend_jobs
     SET status='interrupted',
         error_message='Worker stopped before completion; reconcile uncertain recipients before retry',
         finished_at=NOW()
     WHERE status='running'`
  );

  if (jobRecovery.affectedRows || recipientRecovery.affectedRows) {
    logger.warn(
      `[CampaignResend] Startup recovery: interrupted ${jobRecovery.affectedRows || 0} running job(s); marked ${recipientRecovery.affectedRows || 0} sending recipient(s) uncertain`
    );
  }
}

export function startResendJob(jobId) {
  setImmediate(() => {
    processResendJob(jobId).catch(async error => {
      logger.error(
        `[CampaignResend] Job ${jobId} failed: ${getErrorMessage(error)}`
      );

      // Do not change recipient states here. If a recipient is still
      // "sending", startup recovery will conservatively mark it uncertain.
      await pool.query(
        `UPDATE campaign_resend_jobs
         SET status='interrupted',
             error_message=?,
             finished_at=NOW()
         WHERE id=?
           AND status='running'`,
        [getErrorMessage(error), jobId]
      ).catch(() => { });
    });
  });
}
