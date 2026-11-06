// ─────────────────────────────────────────────────────────────────────────────
// src/services/whatsappService.js
// All direct calls to the Meta WhatsApp Cloud API live here.
// Controllers should never import axios directly – they always go through
// this service so error handling and configuration stay in one place.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import whatsappConfig from '../config/whatsapp.js';
import logger from '../utils/logger.js';
import { pool } from '../config/db.js';
import { decryptToken } from '../utils/encryption.js';
import { getTemplateDetails } from './templateService.js';
import { sendCentralTemplateMessage } from './templateMessageSenderService.js';

// ── Build the per-request Axios instance ─────────────────────────────────────
const getApiClient = (accessToken = null) => {
  const baseUrl = whatsappConfig.baseUrl;
  const apiVersion = whatsappConfig.apiVersion;
  const token = accessToken || whatsappConfig.accessToken;

  return axios.create({
    baseURL: `${baseUrl}/${apiVersion}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 10_000, // 10 second timeout
  });
};

const getCredentialsForAccount = async (accountId = null, organizationId = null) => {
  let targetPhoneId = null;
  let targetToken = null;
  let status = null;

  try {
    let rows = [];
    if (accountId) {
      let query = 'SELECT phone_number_id, access_token, status FROM whatsapp_accounts WHERE id = ?';
      const params = [accountId];
      if (organizationId) {
        query += ' AND organization_id = ?';
        params.push(organizationId);
      }
      const [accRows] = await pool.query(query, params);
      rows = accRows;
    }
    
    if (rows.length === 0 && organizationId) {
      const [accRows] = await pool.query(
        'SELECT phone_number_id, access_token, status FROM whatsapp_accounts WHERE organization_id = ? ORDER BY (status = "Active") DESC, id DESC LIMIT 1',
        [organizationId]
      );
      rows = accRows;
    } else if (rows.length === 0) {
      const [accRows] = await pool.query(
        'SELECT phone_number_id, access_token, status FROM whatsapp_accounts ORDER BY id DESC LIMIT 1'
      );
      rows = accRows;
    }

    if (rows.length > 0) {
      if (rows[0].phone_number_id) targetPhoneId = rows[0].phone_number_id;
      if (rows[0].access_token) targetToken = decryptToken(rows[0].access_token);
      status = rows[0].status || 'Active';
    }
  } catch (err) {
    logger.warn(`[WhatsAppService] Error fetching account credentials for account ${accountId} / org ${organizationId}:`, err.message);
  }

  return { phoneId: targetPhoneId, token: targetToken, status };
};

// ── Error normaliser ─────────────────────────────────────────────────────────
/**
 * Converts an Axios error into a plain object that controllers can handle.
 *
 * @param {import('axios').AxiosError} err
 * @returns {{ success: false, message: string, details: any }}
 */
const normaliseApiError = (err, requestPayload = null) => {
  if (err.response) {
    // The request was made and Meta responded with a non-2xx status
    const { status, data } = err.response;
    const metaError = data?.error;

    logger.error(
      `[WhatsAppService] Meta API error ${status}:`,
      metaError?.message || JSON.stringify(data)
    );

    if (requestPayload) {
      logger.error(`[WhatsAppService] Request Payload:`, JSON.stringify(requestPayload));
    }
    logger.error(`[WhatsAppService] Meta Response:`, JSON.stringify(data));

    return {
      success: false,
      statusCode: status,
      message: metaError?.message || 'WhatsApp API error',
      details: metaError || data,
    };
  }

  if (err.request) {
    // Request was made but no response received (network / timeout)
    logger.error('[WhatsAppService] No response from Meta API:', err.message);
    return {
      success: false,
      statusCode: 503,
      message: 'No response from WhatsApp API. Check your network.',
      details: null,
    };
  }

  // Something else went wrong (config error, etc.)
  logger.error('[WhatsAppService] Unexpected error:', err.message);
  if (requestPayload) {
    logger.error(`[WhatsAppService] Request Payload:`, JSON.stringify(requestPayload));
  }
  return {
    success: false,
    statusCode: 500,
    message: err.message || 'Unexpected error calling WhatsApp API',
    details: null,
  };
};

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Uploads a local file buffer to Meta Cloud API (/v19.0/${phoneId}/media)
 * to receive a valid runtime WhatsApp Media ID.
 */
export async function uploadMediaToMeta(fileBuffer, mimeType = 'image/png', fileName = 'sample.png', phoneNumberId = null, accessToken = null) {
  try {
    const pId = phoneNumberId || whatsappConfig.phoneNumberId;
    const token = accessToken || whatsappConfig.accessToken;
    const apiVersion = whatsappConfig.apiVersion || 'v19.0';

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });

    const res = await axios.post(`https://graph.facebook.com/${apiVersion}/${pId}/media`, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders()
      }
    });

    return res.data?.id || null;
  } catch (err) {
    logger.warn('[WhatsAppService] Upload media to Meta warning:', err.response?.data || err.message);
    return null;
  }
}

// ── Dynamic Payload Builder ──────────────────────────────────────────────────
/**
 * Automatically builds the required components array for a Meta template with actual runtime media.
 */
export const buildDynamicComponents = async (metaTemplate, { templateName = '', organizationId = null, phoneNumberId = null, accessToken = null, customMediaUrl = null } = {}) => {
  const payloadComponents = [];
  if (!metaTemplate || !metaTemplate.components) return [];

  // Look up stored template record in DB for this organization
  let dbTemplate = null;
  const tName = templateName || metaTemplate.name;
  if (tName) {
    try {
      let query = 'SELECT id, organization_id, template_name, header_media_url, meta_header_handle, media_type FROM whatsapp_templates WHERE template_name = ?';
      const params = [tName];
      if (organizationId) {
        query += ' AND (organization_id = ? OR organization_id IS NULL)';
        params.push(organizationId);
      }
      query += ' ORDER BY (organization_id IS NOT NULL) DESC, id DESC LIMIT 1';
      const [rows] = await pool.query(query, params);
      if (rows.length > 0) {
        dbTemplate = rows[0];
      } else {
        // Fallback to templates table
        const [tRows] = await pool.query('SELECT id, organization_id, name as template_name, header_media_url, meta_header_handle FROM templates WHERE name = ? ORDER BY id DESC LIMIT 1', [tName]);
        if (tRows.length > 0) {
          dbTemplate = tRows[0];
        }
      }
    } catch (e) {
      logger.warn('[WhatsAppService] Error fetching template DB record:', e.message);
    }
  }

  for (const comp of metaTemplate.components) {
    if (comp.type === 'HEADER') {
      const format = (comp.format || '').toUpperCase();
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
        let mediaTarget = customMediaUrl || dbTemplate?.header_media_url || null;
        let runtimeMediaId = null;

        // If local file exists, upload to Meta Media API to get runtime media ID
        if (mediaTarget && !mediaTarget.startsWith('http://') && !mediaTarget.startsWith('https://')) {
          try {
            const possiblePaths = [
              path.resolve(__dirname, '../../uploads/templates', path.basename(mediaTarget)),
              path.resolve(__dirname, '../../', mediaTarget.replace(/^\//, '')),
              path.resolve(process.cwd(), 'uploads/templates', path.basename(mediaTarget)),
              path.resolve(process.cwd(), 'backend/uploads/templates', path.basename(mediaTarget))
            ];
            let foundDiskPath = null;
            for (const p of possiblePaths) {
              if (fs.existsSync(p)) {
                foundDiskPath = p;
                break;
              }
            }

            if (foundDiskPath) {
              const fileBuf = fs.readFileSync(foundDiskPath);
              const ext = path.extname(foundDiskPath).toLowerCase();
              const mType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : ext === '.pdf' ? 'application/pdf' : 'image/png';
              logger.info(`[WhatsAppService] Uploading template original image to Meta Media API: ${foundDiskPath} (${fileBuf.length} bytes)`);
              runtimeMediaId = await uploadMediaToMeta(fileBuf, mType, path.basename(foundDiskPath), phoneNumberId, accessToken);
              if (runtimeMediaId) {
                logger.success(`[WhatsAppService] Runtime Media ID obtained for template "${tName}": ${runtimeMediaId}`);
              }
            }
          } catch (fErr) {
            logger.warn('[WhatsAppService] Local media read/upload error:', fErr.message);
          }
        }

        if (runtimeMediaId) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: format.toLowerCase(), [format.toLowerCase()]: { id: runtimeMediaId } }]
          });
        } else if (mediaTarget && (mediaTarget.startsWith('http://') || mediaTarget.startsWith('https://'))) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: format.toLowerCase(), [format.toLowerCase()]: { link: mediaTarget } }]
          });
        } else if (dbTemplate?.meta_header_handle && dbTemplate.meta_header_handle.startsWith('http')) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: format.toLowerCase(), [format.toLowerCase()]: { link: dbTemplate.meta_header_handle } }]
          });
        } else if (comp.example?.header_handle?.[0] && comp.example.header_handle[0].startsWith('http')) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: format.toLowerCase(), [format.toLowerCase()]: { link: comp.example.header_handle[0] } }]
          });
        }
      } else if (format === 'TEXT') {
        const match = comp.text?.match(/{{(\d+)}}/g);
        if (match) {
          const params = match.map(() => ({ type: 'text', text: 'Header_Var' }));
          payloadComponents.push({ type: 'header', parameters: params });
        }
      }
    } else if (comp.type === 'BODY') {
      const match = comp.text?.match(/{{(\d+)}}/g);
      if (match) {
        const params = match.map((m, i) => ({ type: 'text', text: `Variable_${i + 1}` }));
        payloadComponents.push({ type: 'body', parameters: params });
      }
    } else if (comp.type === 'BUTTONS') {
      const buttonParams = [];
      comp.buttons?.forEach((btn, index) => {
        if (btn.type === 'QUICK_REPLY' && (btn.example || btn.text?.includes('{{'))) {
          buttonParams.push({
            type: 'button',
            sub_type: 'quick_reply',
            index: String(index),
            parameters: [{ type: 'payload', payload: `payload_${index}` }]
          });
        } else if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
          buttonParams.push({
            type: 'button',
            sub_type: 'url',
            index: String(index),
            parameters: [{ type: 'text', text: 'action' }]
          });
        } else if (btn.type === 'COPY_CODE' && btn.example) {
          buttonParams.push({
            type: 'button',
            sub_type: 'copy_code',
            index: String(index),
            parameters: [{ type: 'coupon_code', coupon_code: 'CODE123' }]
          });
        }
      });
      if (buttonParams.length > 0) {
        payloadComponents.push(...buttonParams);
      }
    }
  }

  return payloadComponents;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a plain text message to a WhatsApp number.
 *
 * @param {string} to      - Recipient phone number with country code, no '+'
 *                           e.g.  "919876543210"
 * @param {string} message - The text body to send
 * @param {number|string|null} accountId - WhatsApp account ID
 * @returns {Promise<{ success: boolean, data?: any, message?: string }>}
 */
const sendTextMessage = async (to, message, accountId = null, organizationId = null) => {
  const { phoneId, token, status } = await getCredentialsForAccount(accountId, organizationId);
  let cleanTo = String(to).replace(/\D/g, '');
  if (cleanTo.length === 10) {
    cleanTo = `91${cleanTo}`;
  } else if (cleanTo.length === 11 && cleanTo.startsWith('0')) {
    cleanTo = `91${cleanTo.slice(1)}`;
  }

  if (status && status.toLowerCase() !== 'active') {
    logger.warn(`[WhatsAppService] Blocked text send: WhatsApp Account status is ${status}`);
    return {
      success: false,
      statusCode: 403,
      message: 'WhatsApp account is currently Deactive. Please activate the number in Settings -> Manage Official Numbers to send messages.',
    };
  }

  if (!phoneId || !token) {
    logger.warn('[WhatsAppService] Missing ACCESS_TOKEN or PHONE_NUMBER_ID for organization');
    return {
      success: false,
      statusCode: 400,
      message: 'No connected WhatsApp Business Account found for your organization. Please connect a WhatsApp number under Settings.',
    };
  }

  const endpoint = `/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to: cleanTo,
    type: 'text',
    text: {
      preview_url: false,
      body: message,
    },
  };

  try {
    const client   = getApiClient(token);
    const response = await client.post(endpoint, payload);

    logger.success(`[WhatsAppService] Sent text message via Phone ID ${phoneId} to ${cleanTo}`);

    return {
      success: true,
      data: response.data,
      messageId: response.data?.messages?.[0]?.id,
    };
  } catch (err) {
    logger.error(`[WhatsAppService] Meta Graph API error in sendTextMessage:`, err.message);
    return normaliseApiError(err);
  }
};

/**
 * Sends a WhatsApp Template message.
 *
 * @param {string} to           - Recipient phone (country code + number)
 * @param {string} templateName - Approved template name in Meta dashboard
 * @param {string} languageCode - e.g. 'en_US'
 * @param {Array}  components   - Optional template components (header/body/button params)
 * @param {number|string|null} accountId - WhatsApp account ID
 * @param {number|string|null} organizationId - Organization ID
 * @returns {Promise<{ success: boolean, data?: any, message?: string }>}
 */
const sendTemplateMessage = async (toOrOptions, templateName, languageCode = 'en_US', components = [], accountId = null, organizationId = null) => {
  if (typeof toOrOptions === 'object' && toOrOptions !== null) {
    return await sendCentralTemplateMessage({
      recipient: toOrOptions.to || toOrOptions.recipient || toOrOptions.phone,
      templateName: toOrOptions.templateName,
      languageCode: toOrOptions.languageCode || 'en_US',
      components: toOrOptions.components || [],
      variables: toOrOptions.variables || {},
      customMediaUrl: toOrOptions.customMediaUrl || null,
      customCarouselMedia: toOrOptions.customCarouselMedia || null,
      accountId: toOrOptions.accountId || null,
      organizationId: toOrOptions.organizationId || null,
      userId: toOrOptions.userId || 1,
      campaignId: toOrOptions.campaignId || null,
      campaignName: toOrOptions.campaignName || null,
      campaignType: toOrOptions.campaignType || 'quick',
      featureKey: toOrOptions.featureKey || 'quick'
    });
  }
  return await sendCentralTemplateMessage({
    recipient: toOrOptions,
    templateName,
    languageCode,
    components,
    accountId,
    organizationId,
    campaignType: 'quick',
    featureKey: 'quick'
  });
};

/**
 * Marks an incoming message as read by sending a read receipt.
 *
 * @param {string} messageId - The wamid (WhatsApp Message ID) to mark read
 * @returns {Promise<{ success: boolean }>}
 */
const markMessageAsRead = async (messageId) => {
  const { phoneNumberId } = whatsappConfig;
  const endpoint = `/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    status:     'read',
    message_id: messageId,
  };

  try {
    const client = getApiClient();
    await client.post(endpoint, payload);
    logger.info(`[WhatsAppService] Marked message ${messageId} as read.`);
    return { success: true };
  } catch (err) {
    return normaliseApiError(err);
  }
};

const getOfficialPhoneNumber = async () => {
  const { phoneNumberId, accessToken } = whatsappConfig;

  if (phoneNumberId && accessToken) {
    try {
      const client = getApiClient();
      const response = await client.get(`/${phoneNumberId}?fields=display_phone_number,verified_name`);
      if (response.data && response.data.display_phone_number) {
        const cleanDigits = response.data.display_phone_number.replace(/\D/g, '');
        return {
          displayNumber: response.data.display_phone_number,
          cleanNumber: cleanDigits,
          verifiedName: response.data.verified_name
        };
      }
    } catch (err) {
      logger.warn('[WhatsAppService] Failed to fetch official phone number from Meta API:', err.message);
    }
  }
  return null;
};

/**
 * Sends a media message (image, document, video, audio) to a WhatsApp number.
 * Supports both direct mediaUrl (http/https) and base64 encoded data.
 */
export const sendMediaMessage = async ({
  to,
  mediaUrl = null,
  mediaBase64 = null,
  mimeType = null,
  fileName = null,
  mediaType = null,
  caption = '',
  accountId = null,
  organizationId = null,
  phoneNumberId = null,
  accessToken = null,
}) => {
  const creds = await getCredentialsForAccount(accountId, organizationId);
  const phoneId = creds.phoneId || phoneNumberId || whatsappConfig.phoneNumberId;
  const token = creds.token || accessToken || whatsappConfig.accessToken;

  let cleanTo = String(to).replace(/\D/g, '');
  if (cleanTo.length === 10) {
    cleanTo = `91${cleanTo}`;
  } else if (cleanTo.length === 11 && cleanTo.startsWith('0')) {
    cleanTo = `91${cleanTo.slice(1)}`;
  }

  if (!phoneId || !token) {
    return {
      success: false,
      statusCode: 400,
      message: 'No connected WhatsApp Business Account found for your organization.',
    };
  }

  let resolvedType = (mediaType || '').toLowerCase();
  if (!resolvedType) {
    if (mimeType?.startsWith('image/')) resolvedType = 'image';
    else if (mimeType?.startsWith('video/')) resolvedType = 'video';
    else if (mimeType?.startsWith('audio/')) resolvedType = 'audio';
    else resolvedType = 'document';
  }

  let mediaPayloadObj = {};
  let uploadedBuffer = null;
  let uploadedMimeType = mimeType || 'application/octet-stream';
  let uploadedFileName = fileName || null;

  // 1. If base64 provided, upload directly to Meta Media API to get runtime Media ID
  if (mediaBase64) {
    try {
      let rawB64 = mediaBase64;
      let detectedMime = mimeType || 'application/octet-stream';
      if (typeof mediaBase64 === 'string' && mediaBase64.startsWith('data:')) {
        const matches = mediaBase64.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
        if (matches) {
          detectedMime = matches[1];
          rawB64 = matches[2];
        } else {
          rawB64 = mediaBase64.replace(/^data:[^;]+;base64,/, '');
        }
      }
      const buffer = Buffer.from(rawB64, 'base64');
      const originalName = path.basename(fileName || `attachment.${detectedMime.split('/')[1] || 'bin'}`);
      const safeFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const mediaId = await uploadMediaToMeta(buffer, detectedMime, safeFileName, phoneId, token);
      if (mediaId) {
        mediaPayloadObj = { id: mediaId };
        uploadedBuffer = buffer;
        uploadedMimeType = detectedMime;
        uploadedFileName = safeFileName;
      }
    } catch (b64Err) {
      logger.error('[WhatsAppService] Error processing mediaBase64 buffer:', b64Err.message);
    }
  }

  // 2. Fallback to mediaUrl if ID wasn't obtained from base64
  if (!mediaPayloadObj.id) {
    if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
      mediaPayloadObj = { link: mediaUrl };
    } else {
      return {
        success: false,
        statusCode: 400,
        message: 'Could not resolve a valid media attachment or link for Meta WhatsApp dispatch.',
      };
    }
  }

  if (caption && resolvedType !== 'audio') {
    mediaPayloadObj.caption = String(caption).trim();
  }
  if (resolvedType === 'document' && fileName) {
    mediaPayloadObj.filename = fileName;
  }

  const endpoint = `/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: resolvedType,
    [resolvedType]: mediaPayloadObj,
  };

  try {
    const client = getApiClient(token);
    const response = await client.post(endpoint, payload);
    let storedMediaUrl = mediaUrl || null;
    if (uploadedBuffer) {
      try {
        // Always archive beside the backend's real uploads directory. PM2 may
        // start the app with a different cwd, so process.cwd() is not reliable.
        const uploadDir = path.resolve(__dirname, '../../uploads/chat-media');
        fs.mkdirSync(uploadDir, { recursive: true });
        const storedName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${uploadedFileName}`;
        const storedPath = path.join(uploadDir, storedName);
        fs.writeFileSync(storedPath, uploadedBuffer);
        if (!fs.existsSync(storedPath) || fs.statSync(storedPath).size !== uploadedBuffer.length) {
          throw new Error('Archived attachment verification failed');
        }
        storedMediaUrl = `/api/uploads/chat-media/${encodeURIComponent(storedName)}`;
      } catch (storeErr) {
        logger.warn(`[WhatsAppService] Media sent but local archive failed: ${storeErr.message}`);
      }
    }
    logger.success(`[WhatsAppService] Sent ${resolvedType} media message via Phone ID ${phoneId} to ${cleanTo}`);
    return {
      success: true,
      data: response.data,
      messageId: response.data?.messages?.[0]?.id,
      mediaId: mediaPayloadObj.id || null,
      mediaUrl: storedMediaUrl,
      mediaType: resolvedType,
      mimeType: uploadedMimeType,
      fileName: uploadedFileName,
    };
  } catch (err) {
    logger.error(`[WhatsAppService] Meta Graph API error in sendMediaMessage:`, err.message);
    return normaliseApiError(err);
  }
};

export default {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  markMessageAsRead,
  getOfficialPhoneNumber,
};
