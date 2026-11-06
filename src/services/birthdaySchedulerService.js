import { pool } from '../config/db.js';
import { sendCampaignTemplate } from './metaWhatsAppService.js';
import logger from '../utils/logger.js';

/**
 * Birthday Campaign Background Scheduler Worker
 * Runs every 30 seconds to evaluate and send birthday messages.
 */
export const checkAndRunBirthdayCampaigns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Select active birthday campaigns
    const [campaigns] = await connection.execute(
      `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') as dob_formatted FROM birthday_campaigns WHERE is_active = 1`
    );

    if (!campaigns || campaigns.length === 0) return;

    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const todayYMD = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    for (const item of campaigns) {
      if (!item.dob || !item.mobile_number || !item.template_name) continue;

      // Check if already triggered today
      if (item.last_triggered_at) {
        const lt = new Date(item.last_triggered_at);
        const lastTriggeredYMD = `${lt.getFullYear()}-${pad(lt.getMonth() + 1)}-${pad(lt.getDate())}`;
        if (lastTriggeredYMD === todayYMD) {
          continue; // Already wished today!
        }
      }

      // Parse DOB string formatted directly from MySQL
      const dobStr = item.dob_formatted || (item.dob instanceof Date ? `${item.dob.getFullYear()}-${pad(item.dob.getMonth() + 1)}-${pad(item.dob.getDate())}` : String(item.dob).split('T')[0]);
      const dobParts = dobStr.split('-');
      const dobMonth = parseInt(dobParts[1], 10) - 1; // 0-indexed
      const dobDay = parseInt(dobParts[2], 10);
      if (isNaN(dobMonth) || isNaN(dobDay)) continue;

      // Compare Month & Day
      if (currentMonth === dobMonth && currentDate === dobDay) {
        // Parse wish_time
        const wishTimeParts = (item.wish_time || '10:00:00').split(':');
        const wishHour = parseInt(wishTimeParts[0] || '10', 10);
        const wishMinute = parseInt(wishTimeParts[1] || '0', 10);

        // Is it time to wish? (current time >= wish time)
        if (currentHour > wishHour || (currentHour === wishHour && currentMinute >= wishMinute)) {
          logger.info(`[BirthdayScheduler] 🎂 Triggering Birthday Wish for "${item.name}" (${item.mobile_number}) using template "${item.template_name}"...`);

          try {
            // Send Meta WhatsApp Template message via Meta Cloud API service
            await sendCampaignTemplate({
              campaignName: `Birthday Wish - ${item.name}`,
              templateName: item.template_name,
              languageCode: item.language_code || 'en_US',
              country: item.country || 'India(+91)',
              numbers: [item.mobile_number],
              organizationId: item.organization_id || null,
              featureKey: 'birthday',
            });

            logger.success(`[BirthdayScheduler] ✅ Birthday wish successfully sent to ${item.name} (${item.mobile_number})!`);

            // Log execution history
            try {
              await connection.execute(
                `INSERT INTO birthday_logs (birthday_campaign_id, organization_id, recipient_name, mobile_number, template_name, status, sent_at)
                 VALUES (?, ?, ?, ?, ?, 'sent', NOW())`,
                [item.id, item.organization_id || null, item.name, item.mobile_number, item.template_name]
              );
            } catch (logErr) {
              logger.error('[BirthdayScheduler] Failed saving history log:', logErr.message);
            }

            // Calculate next year's trigger DATETIME
            const nextYearDate = new Date(now.getFullYear() + 1, dobMonth, dobDay, wishHour, wishMinute, 0);
            const nextTriggerStr = `${nextYearDate.getFullYear()}-${pad(nextYearDate.getMonth() + 1)}-${pad(nextYearDate.getDate())} ${pad(wishHour)}:${pad(wishMinute)}:00`;

            // Update database record
            await connection.execute(
              `UPDATE birthday_campaigns 
               SET last_triggered_at = NOW(), next_trigger_on = ? 
               WHERE id = ?`,
              [nextTriggerStr, item.id]
            );
          } catch (err) {
            logger.error(`[BirthdayScheduler] ❌ Failed to send birthday wish to ${item.name} (${item.mobile_number}):`, err.message);

            try {
              await connection.execute(
                `INSERT INTO birthday_logs (birthday_campaign_id, organization_id, recipient_name, mobile_number, template_name, status, error_message, sent_at)
                 VALUES (?, ?, ?, ?, ?, 'failed', ?, NOW())`,
                [item.id, item.organization_id || null, item.name, item.mobile_number, item.template_name, err.message]
              );
            } catch (logErr) {
              logger.error('[BirthdayScheduler] Failed saving failed history log:', logErr.message);
            }
          }
        }
      }
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      logger.warn('[BirthdayScheduler] Database is offline or unreachable. Will retry on next interval.');
    } else {
      logger.error('[BirthdayScheduler] Background check error:', err.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Start recurring timer for Birthday Campaign Scheduler
 */
export const startBirthdayScheduler = () => {
  logger.info('[BirthdayScheduler] Starting birthday campaign background worker (30s interval)...');
  checkAndRunBirthdayCampaigns();
  setInterval(checkAndRunBirthdayCampaigns, 30000);
};
