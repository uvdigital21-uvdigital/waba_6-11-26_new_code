import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * fcmService.js
 * Handles storage of staff mobile device tokens and (optionally) sending
 * Firebase Cloud Messaging push notifications for new incoming chats.
 *
 * REQUIRED DATABASE TABLE:
 * Run this SQL once on your database before using this service:
 *
 * CREATE TABLE IF NOT EXISTS device_tokens (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   user_id INT NOT NULL,
 *   organization_id INT NULL,
 *   fcm_token VARCHAR(500) NOT NULL,
 *   platform VARCHAR(20) DEFAULT 'android',
 *   app_version VARCHAR(20) NULL,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   UNIQUE KEY unique_user_token (user_id, fcm_token(255))
 * );
 */

/**
 * Registers (or refreshes) a staff device's FCM token so push notifications
 * can be sent to it. Called from the mobile app on login.
 */
export async function registerDeviceToken(userId, organizationId, fcmToken, platform = 'android', appVersion = null) {
  try {
    if (!userId || !fcmToken) {
      logger.warn('[FCM Service] registerDeviceToken called without userId or fcmToken');
      return null;
    }

    await pool.query(
      `INSERT INTO device_tokens (user_id, organization_id, fcm_token, platform, app_version)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         organization_id = VALUES(organization_id),
         platform = VALUES(platform),
         app_version = VALUES(app_version),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, organizationId || null, fcmToken, platform, appVersion]
    );

    logger.info(`[FCM Service] Device token registered for user ${userId} (${platform})`);
    return true;
  } catch (err) {
    // Non-blocking: login/app should still succeed even if token save fails
    logger.error(`[FCM Service] registerDeviceToken error: ${err.message}`);
    return null;
  }
}

/**
 * Removes a device token, e.g. on logout, so the device stops receiving
 * push notifications for that account.
 */
export async function unregisterDeviceToken(userId, fcmToken) {
  try {
    if (!userId) return null;

    if (fcmToken) {
      await pool.query(
        `DELETE FROM device_tokens WHERE user_id = ? AND fcm_token = ?`,
        [userId, fcmToken]
      );
    } else {
      // No specific token provided — remove all tokens for this user
      await pool.query(`DELETE FROM device_tokens WHERE user_id = ?`, [userId]);
    }

    logger.info(`[FCM Service] Device token(s) removed for user ${userId}`);
    return true;
  } catch (err) {
    logger.error(`[FCM Service] unregisterDeviceToken error: ${err.message}`);
    return null;
  }
}

/**
 * Fetches all active device tokens for an organization (used to push
 * notifications to all staff when a new customer message arrives).
 */
export async function getOrganizationDeviceTokens(organizationId) {
  try {
    if (!organizationId) return [];
    const [rows] = await pool.query(
      `SELECT fcm_token, user_id, platform FROM device_tokens WHERE organization_id = ?`,
      [organizationId]
    );
    return rows.map(r => r.fcm_token);
  } catch (err) {
    logger.error(`[FCM Service] getOrganizationDeviceTokens error: ${err.message}`);
    return [];
  }
}

/**
 * Sends a push notification to one or more device tokens using Firebase
 * Admin SDK. Requires FIREBASE_SERVICE_ACCOUNT_JSON (or equivalent) to be
 * configured in your .env — if not configured yet, this safely logs a
 * warning instead of crashing the server, so the rest of the app keeps working.
 */
export async function sendPushNotification(tokens, title, body, data = {}) {
  try {
    if (!tokens || tokens.length === 0) {
      return { success: false, message: 'No device tokens to notify' };
    }

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      logger.warn('[FCM Service] Firebase credentials not configured in .env — skipping push notification send. Add FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL to enable push notifications.');
      return { success: false, message: 'Firebase not configured' };
    }

    // Lazy-load firebase-admin only when actually needed and configured
    const admin = await import('firebase-admin');

    if (!admin.default.apps.length) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      });
    }

    const message = {
      notification: { title, body },
      data,
      tokens: Array.isArray(tokens) ? tokens : [tokens]
    };

    const response = await admin.default.messaging().sendEachForMulticast(message);
    logger.info(`[FCM Service] Push sent: ${response.successCount} success, ${response.failureCount} failed`);
    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (err) {
    logger.error(`[FCM Service] sendPushNotification error: ${err.message}`);
    return { success: false, message: err.message };
  }
}

export default {
  registerDeviceToken,
  unregisterDeviceToken,
  getOrganizationDeviceTokens,
  sendPushNotification
};