// ─────────────────────────────────────────────────────────────────────────────
// src/services/templateMessageSenderService.js  (FIXED VERSION)
// Single Authoritative Central Template Sender Service for all modules:
// - Quick Broadcast
// - Upload CSV Campaign
// - Segment by Tags
// - Segment by Group
// - Birthday Automation
// - Scheduled Campaigns
// - Developer API / Chatbot
//
// CHANGES vs original:
// 1. uploadMediaToMeta() no longer swallows the real Meta error — it now
//    returns { id, error } so callers can see EXACTLY why upload failed
//    (bad token, wrong phone_number_id, mime mismatch, file too large, etc).
// 2. findFileOnDisk() now logs every path it tried, so "file not found"
//    is visible instead of silently failing to a broken link fallback.
// 3. Before using a public link (safeSingleLink) as the header media source,
//    we now do a HEAD request to confirm the URL is actually publicly
//    reachable over HTTPS. If it isn't, we DO NOT send — we fail loudly
//    with a clear message instead of letting Meta return generic 131053.
// 4. mimeType is now guessed from the file's real magic bytes (not just
//    the extension) to avoid Content-Type mismatches that Meta rejects.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import whatsappConfig from '../config/whatsapp.js';
import logger from '../utils/logger.js';
import { decryptToken } from '../utils/encryption.js';
import { getTemplateDetails } from './templateService.js';
import { checkBlacklist } from './blacklistService.js';
import { hasSufficientCredits, deductMessageCredit } from './creditService.js';
import { recordChatMessage } from './chatService.js';
import { emitToOrganization } from '../utils/socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Detects real mime type from file magic bytes. Falls back to extension-based
 * guess if the signature isn't recognized. This avoids Meta rejecting media
 * because the declared Content-Type doesn't match the actual file bytes.
 */
function detectMimeFromBuffer(buffer, fallbackExt = '.png') {
  if (!buffer || buffer.length < 12) return extToMime(fallbackExt);
  const hex = buffer.subarray(0, 12).toString('hex');

  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (hex.startsWith('66747970') || buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (hex.startsWith('25504446')) return 'application/pdf';
  if (hex.startsWith('1a45dfa3')) return 'video/webm';

  return extToMime(fallbackExt);
}

function extToMime(ext) {
  const e = (ext || '').toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.mp4') return 'video/mp4';
  if (e === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

/**
 * Resolves multi-tenant Meta credentials for a specific organization/account.
 */
export async function resolveAccountCredentials(accountId = null, organizationId = null) {
  let targetPhoneId = null;
  let targetToken = null;
  let targetWabaId = null;
  let status = 'Active';
  let resolvedOrgId = organizationId;
  let resolvedAccountId = accountId;

  try {
    let rows = [];
    if (accountId) {
      let query = 'SELECT id, phone_number_id, access_token, waba_id, status, organization_id FROM whatsapp_accounts WHERE id = ?';
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
        'SELECT id, phone_number_id, access_token, waba_id, status, organization_id FROM whatsapp_accounts WHERE organization_id = ? ORDER BY (status = "Active") DESC, id DESC LIMIT 1',
        [organizationId]
      );
      rows = accRows;
    } else if (rows.length === 0) {
      const [accRows] = await pool.query(
        'SELECT id, phone_number_id, access_token, waba_id, status, organization_id FROM whatsapp_accounts ORDER BY id DESC LIMIT 1'
      );
      rows = accRows;
    }

    if (rows.length > 0) {
      const acc = rows[0];
      resolvedAccountId = acc.id;
      resolvedOrgId = acc.organization_id || resolvedOrgId;
      if (acc.phone_number_id) targetPhoneId = acc.phone_number_id;
      if (acc.waba_id) targetWabaId = acc.waba_id;
      if (acc.access_token) targetToken = decryptToken(acc.access_token);
      status = acc.status || 'Active';
    }
  } catch (err) {
    logger.warn(`[CentralTemplateSender] Error fetching credentials for acc=${accountId}, org=${organizationId}: ${err.message}`);
  }

  // Fallback to env config if no DB record found
  if (!targetPhoneId) targetPhoneId = whatsappConfig.phoneNumberId;
  if (!targetToken) targetToken = whatsappConfig.accessToken;
  if (!targetWabaId) targetWabaId = whatsappConfig.wabaId;

  return {
    phoneId: targetPhoneId,
    token: targetToken,
    wabaId: targetWabaId,
    status,
    organizationId: resolvedOrgId,
    accountId: resolvedAccountId
  };
}

/**
 * Uploads a local file buffer to Meta Cloud API (/v19.0/${phoneId}/media)
 * to receive a valid runtime WhatsApp Media ID.
 *
 * FIXED: now returns { id, error } instead of swallowing the real Meta
 * error and returning a bare null. Callers can inspect `error` to know
 * EXACTLY why upload failed (invalid token, wrong phone_number_id scope,
 * unsupported mime, file too large, network timeout, etc).
 */
export async function uploadMediaToMeta(fileBuffer, mimeType = 'image/png', fileName = 'sample.png', phoneNumberId = null, accessToken = null) {
  const pId = phoneNumberId || whatsappConfig.phoneNumberId;
  const token = accessToken || whatsappConfig.accessToken;
  const apiVersion = whatsappConfig.apiVersion || 'v19.0';

  if (!pId || !token) {
    const msg = 'Missing phoneNumberId or accessToken for Meta media upload.';
    logger.error(`[CentralTemplateSender] ${msg}`);
    return { id: null, error: msg };
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    const msg = 'Empty file buffer — nothing to upload to Meta.';
    logger.error(`[CentralTemplateSender] ${msg}`);
    return { id: null, error: msg };
  }

  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });

    logger.info(`[CentralTemplateSender] Uploading media to Meta -> phoneId=${pId}, mime=${mimeType}, size=${fileBuffer.length} bytes, file=${fileName}`);

    const res = await axios.post(`https://graph.facebook.com/${apiVersion}/${pId}/media`, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders()
      },
      timeout: 25000
    });

    if (!res.data?.id) {
      const msg = `Meta returned no media id: ${JSON.stringify(res.data)}`;
      logger.error(`[CentralTemplateSender] ${msg}`);
      return { id: null, error: msg };
    }

    logger.success?.(`[CentralTemplateSender] ✅ Meta media uploaded successfully. media_id=${res.data.id}`);
    return { id: res.data.id, error: null };
  } catch (err) {
    // THIS is the part that was previously hidden. Log the FULL Meta error body.
    const metaErr = err.response?.data?.error;
    const detailedMsg = metaErr
      ? `Meta media upload failed [code ${metaErr.code}/${metaErr.error_subcode || '-'}]: ${metaErr.message || metaErr.error_user_msg}`
      : `Meta media upload failed: ${err.message}`;
    logger.error(`[CentralTemplateSender] ${detailedMsg}`);
    logger.error(`[CentralTemplateSender] Full Meta error payload: ${JSON.stringify(err.response?.data || {})}`);
    return { id: null, error: detailedMsg };
  }
}

/**
 * Checks whether a URL is actually publicly reachable over HTTPS before we
 * hand it to Meta as a header `link`. If Meta can't fetch it (auth wall,
 * wrong domain, 404, blocked by firewall/CDN), it fails with a generic
 * "131053: Media upload error" — this check catches that BEFORE sending.
 */
async function isPubliclyReachable(url) {
  if (!url || !/^https:\/\//i.test(url)) return false;
  try {
    const res = await axios.head(url, { timeout: 8000, validateStatus: () => true });
    if (res.status >= 200 && res.status < 300) {
      const ct = res.headers['content-type'] || '';
      if (/^(image|video|application\/pdf)/i.test(ct)) return true;
      logger.warn(`[CentralTemplateSender] URL reachable but unexpected content-type "${ct}" for ${url}`);
      return false;
    }
    logger.warn(`[CentralTemplateSender] Public media URL not reachable (HTTP ${res.status}): ${url}`);
    return false;
  } catch (err) {
    logger.warn(`[CentralTemplateSender] Public media URL check failed for ${url}: ${err.message}`);
    return false;
  }
}

/**
 * Resolves the template record from DB scoped by organization and template name/ID.
 */
export async function resolveTemplateRecord(templateName, templateId = null, organizationId = null) {
  try {
    let query = 'SELECT id, organization_id, template_name, header_media_url, meta_header_handle, media_type, meta_template_id, language, category, buttons_json, meta_response FROM whatsapp_templates WHERE 1=1';
    const params = [];

    if (templateId) {
      query += ' AND id = ?';
      params.push(templateId);
    } else if (templateName) {
      query += ' AND template_name = ?';
      params.push(templateName);
    }

    if (organizationId) {
      query += ' AND (organization_id = ? OR organization_id IS NULL)';
      params.push(organizationId);
    }

    query += ' ORDER BY (organization_id IS NOT NULL) DESC, id DESC LIMIT 1';

    const [rows] = await pool.query(query, params);
    if (rows.length > 0) {
      return rows[0];
    }

    // Fallback query on templates table
    if (templateName) {
      const [tRows] = await pool.query('SELECT id, organization_id, name as template_name, header_media_url, meta_header_handle, language, category FROM templates WHERE name = ? ORDER BY id DESC LIMIT 1', [templateName]);
      if (tRows.length > 0) {
        return tRows[0];
      }
    }
  } catch (err) {
    logger.warn(`[CentralTemplateSender] Error querying template records: ${err.message}`);
  }
  return null;
}

/**
 * Builds the runtime template components including header media upload, variables, and buttons.
 */
export async function buildCentralTemplateComponents({
  templateName,
  templateId = null,
  languageCode = 'en_US',
  organizationId = null,
  phoneNumberId = null,
  accessToken = null,
  suppliedComponents = [],
  variables = {},
  customMediaUrl = null,
  customCarouselMedia = null
}) {
  const finalComponents = Array.isArray(suppliedComponents) ? [...suppliedComponents] : [];
  let mediaResolutionFailed = false;
  let mediaResolutionError = null;

  // 1. Resolve DB template record
  const dbTemplate = await resolveTemplateRecord(templateName, templateId, organizationId);

  // 2. Fetch Meta official template structure
  let metaTemplate = null;
  try {
    metaTemplate = await getTemplateDetails(templateName, languageCode, null, organizationId);
  } catch (err) {
    logger.warn(`[CentralTemplateSender] Could not fetch Meta template details for "${templateName}": ${err.message}`);
  }

  const metaComponents = metaTemplate?.components || [];

  // Helper to find file on disk — FIXED: now logs every path it tries.
  const findFileOnDisk = (rawPath) => {
    if (!rawPath || typeof rawPath !== 'string') return null;
    const filename = path.basename(rawPath);
    const cleanRel = rawPath.replace(/^\//, '');
    const possiblePaths = [
      path.resolve(process.cwd(), 'uploads/templates', filename),
      path.resolve(process.cwd(), 'backend/backend/uploads/templates', filename),
      path.resolve(process.cwd(), 'backend/uploads/templates', filename),
      path.resolve(__dirname, '../../uploads/templates', filename),
      path.resolve(__dirname, '../../../uploads/templates', filename),
      path.resolve(__dirname, '../../../backend/backend/uploads/templates', filename),
      path.resolve(__dirname, '../../', cleanRel),
      path.resolve(process.cwd(), cleanRel)
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        logger.info(`[CentralTemplateSender] Found media file on disk: ${p}`);
        return p;
      }
    }
    logger.error(`[CentralTemplateSender] Media file "${rawPath}" NOT FOUND on disk. Tried:\n  ${possiblePaths.join('\n  ')}`);
    return null;
  };

  // 3. Resolve HEADER component (Image/Video/Document/Text)
  const headerComp = metaComponents.find(c => (c.type || '').toUpperCase() === 'HEADER');
  const existingHeader = finalComponents.find(c => (c.type || '').toLowerCase() === 'header');

  if (headerComp && !existingHeader) {
    const format = (headerComp.format || '').toUpperCase();
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
      let mediaTarget = customMediaUrl || dbTemplate?.header_media_url || null;
      let runtimeMediaId = null;
      let safeSingleLink = null;
      let uploadErrorDetail = null;
      const serverBaseUrl = (process.env.SERVER_BASE_URL || process.env.BASE_URL || 'https://officialwaba.com').replace(/\/$/, '');

      if (mediaTarget && typeof mediaTarget === 'string') {
        if (mediaTarget.startsWith('http://') || mediaTarget.startsWith('https://')) {
          if (!mediaTarget.includes('lookaside.fbsbx.com') && !mediaTarget.includes('fbsbx.com') && !mediaTarget.includes('facebook.com')) {
            safeSingleLink = mediaTarget;
          }
        } else if (mediaTarget.includes('uploads/')) {
          const cleanRel = mediaTarget.replace(/^.*uploads\//, '');
          safeSingleLink = `${serverBaseUrl}/api/uploads/${cleanRel}`;
        }
      }

      // Handle Base64 Header Media
      if (mediaTarget && typeof mediaTarget === 'string' && mediaTarget.startsWith('data:')) {
        try {
          const rawB64 = mediaTarget.replace(/^data:[A-Za-z0-9-+\/]+;base64,/, '');
          const fileBuf = Buffer.from(rawB64, 'base64');
          const mimeMatch = mediaTarget.match(/^data:([A-Za-z0-9-+\/]+);base64,/);
          let mType = mimeMatch ? mimeMatch[1] : detectMimeFromBuffer(fileBuf, format === 'VIDEO' ? '.mp4' : format === 'DOCUMENT' ? '.pdf' : '.png');
          const ext = mType.includes('video') || mType.includes('mp4') ? '.mp4' : mType.includes('pdf') ? '.pdf' : '.png';
          logger.info(`[CentralTemplateSender] Uploading base64 header media to Meta (${fileBuf.length} bytes, type: ${mType})`);
          const uploadResult = await uploadMediaToMeta(fileBuf, mType, `header_${templateName}${ext}`, phoneNumberId, accessToken);
          runtimeMediaId = uploadResult.id;
          uploadErrorDetail = uploadResult.error;
        } catch (bErr) {
          logger.warn('[CentralTemplateSender] Base64 header media upload error:', bErr.message);
          uploadErrorDetail = bErr.message;
        }
      } else if (mediaTarget && typeof mediaTarget === 'string' && !mediaTarget.startsWith('http://') && !mediaTarget.startsWith('https://')) {
        // If local file exists, upload to Meta Media API
        try {
          const foundDiskPath = findFileOnDisk(mediaTarget);
          if (foundDiskPath) {
            const fileBuf = fs.readFileSync(foundDiskPath);
            const ext = path.extname(foundDiskPath).toLowerCase();
            const mType = detectMimeFromBuffer(fileBuf, ext);
            logger.info(`[CentralTemplateSender] Uploading template original media to Meta: ${foundDiskPath} (${fileBuf.length} bytes, detected mime: ${mType})`);
            const uploadResult = await uploadMediaToMeta(fileBuf, mType, path.basename(foundDiskPath), phoneNumberId, accessToken);
            runtimeMediaId = uploadResult.id;
            uploadErrorDetail = uploadResult.error;
            if (runtimeMediaId) {
              logger.success?.(`[CentralTemplateSender] Runtime Media ID obtained for "${templateName}": ${runtimeMediaId}`);
            }
          } else {
            uploadErrorDetail = `Local media file "${mediaTarget}" could not be located on disk.`;
          }
        } catch (fErr) {
          logger.warn('[CentralTemplateSender] Local media read/upload error:', fErr.message);
          uploadErrorDetail = fErr.message;
        }
      }

      // FIXED: only trust the link fallback if it is actually publicly
      // reachable. This is what prevents the generic 131053 error at send time.
      if (!runtimeMediaId && safeSingleLink) {
        const reachable = await isPubliclyReachable(safeSingleLink);
        if (!reachable) {
          logger.warn(`[CentralTemplateSender] Rejecting unreachable fallback link: ${safeSingleLink}`);
          safeSingleLink = null;
        }
      }

      if (!runtimeMediaId && !safeSingleLink) {
        if (dbTemplate?.meta_header_handle && dbTemplate.meta_header_handle.startsWith('http') && !dbTemplate.meta_header_handle.includes('lookaside.fbsbx.com') && !dbTemplate.meta_header_handle.includes('fbsbx.com')) {
          if (await isPubliclyReachable(dbTemplate.meta_header_handle)) {
            safeSingleLink = dbTemplate.meta_header_handle;
          }
        }
        if (!safeSingleLink && headerComp.example?.header_handle?.[0] && String(headerComp.example.header_handle[0]).startsWith('http')) {
          if (await isPubliclyReachable(headerComp.example.header_handle[0])) {
            safeSingleLink = headerComp.example.header_handle[0];
          }
        }
        if (!safeSingleLink && headerComp.example?.header_url?.[0] && String(headerComp.example.header_url[0]).startsWith('http')) {
          if (await isPubliclyReachable(headerComp.example.header_url[0])) {
            safeSingleLink = headerComp.example.header_url[0];
          }
        }
        if (!safeSingleLink) {
          const errMsg = `Template "${templateName}" has a ${format} header but no resolvable/reachable media. ` +
            `Reason: ${uploadErrorDetail || 'no valid media source found'}. ` +
            `Please re-upload a valid header image/video in Official Templates.`;
          logger.error(`[CentralTemplateSender] ${errMsg}`);
          mediaResolutionFailed = true;
          mediaResolutionError = errMsg;
        }
      }

      if (runtimeMediaId) {
        finalComponents.unshift({
          type: 'header',
          parameters: [{ type: format.toLowerCase(), [format.toLowerCase()]: { id: runtimeMediaId } }]
        });
      } else if (safeSingleLink) {
        finalComponents.unshift({
          type: 'header',
          parameters: [{ type: format.toLowerCase(), [format.toLowerCase()]: { link: safeSingleLink } }]
        });
      }
    } else if (format === 'TEXT') {
      const match = headerComp.text?.match(/{{(\d+)}}/g);
      if (match) {
        const headerParams = match.map((m, i) => {
          const varNum = String(i + 1);
          const val = variables[`header_${varNum}`] || variables[varNum] || 'Header_Var';
          return { type: 'text', text: String(val) };
        });
        finalComponents.unshift({ type: 'header', parameters: headerParams });
      }
    }
  }

  // 4. Resolve BODY component variables
  const bodyComp = metaComponents.find(c => (c.type || '').toUpperCase() === 'BODY');
  const existingBody = finalComponents.find(c => (c.type || '').toLowerCase() === 'body');

  if (bodyComp && !existingBody) {
    const match = bodyComp.text?.match(/{{(\d+)}}/g);
    if (match && match.length > 0) {
      const bodyParams = match.map((m, i) => {
        const varNum = String(i + 1);
        const val = variables[varNum] || variables[`body_${varNum}`] || `Variable_${varNum}`;
        return { type: 'text', text: String(val) };
      });
      finalComponents.push({ type: 'body', parameters: bodyParams });
    }
  }

  // 5. Resolve BUTTONS component
  const buttonComp = metaComponents.find(c => (c.type || '').toUpperCase() === 'BUTTONS');
  const existingButtons = finalComponents.filter(c => (c.type || '').toLowerCase() === 'button');

  if (buttonComp && existingButtons.length === 0) {
    const buttonParams = [];
    buttonComp.buttons?.forEach((btn, index) => {
      if (btn.type === 'QUICK_REPLY' && (btn.example || btn.text?.includes('{{'))) {
        buttonParams.push({
          type: 'button',
          sub_type: 'quick_reply',
          index: String(index),
          parameters: [{ type: 'payload', payload: `payload_${index}` }]
        });
      } else if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
        const urlVar = variables[`button_${index + 1}`] || variables.url || 'action';
        buttonParams.push({
          type: 'button',
          sub_type: 'url',
          index: String(index),
          parameters: [{ type: 'text', text: String(urlVar) }]
        });
      } else if (btn.type === 'COPY_CODE' && btn.example) {
        buttonParams.push({
          type: 'button',
          sub_type: 'copy_code',
          index: String(index),
          parameters: [{ type: 'coupon_code', coupon_code: btn.example[0] || 'CODE123' }]
        });
      }
    });
    if (buttonParams.length > 0) {
      finalComponents.push(...buttonParams);
    }
  }

  // 6. Resolve CAROUSEL component
  const carouselComp = metaComponents.find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
  const existingCarousel = finalComponents.find(c => (c.type || '').toLowerCase() === 'carousel');

  if (carouselComp && !existingCarousel) {
    const rawCards = carouselComp.cards || [];
    const formattedCards = [];

    // Check if we have stored card media in dbTemplate or database
    let dbCards = [];
    if (dbTemplate?.cards) {
      try {
        dbCards = typeof dbTemplate.cards === 'string' ? JSON.parse(dbTemplate.cards) : dbTemplate.cards;
      } catch (_) {
        dbCards = [];
      }
    }
    if ((!dbCards || dbCards.length === 0) && dbTemplate?.meta_response) {
      try {
        const parsedMeta = typeof dbTemplate.meta_response === 'string' ? JSON.parse(dbTemplate.meta_response) : dbTemplate.meta_response;
        if (Array.isArray(parsedMeta.cards)) {
          dbCards = parsedMeta.cards;
        }
      } catch (_) { }
    }
    if (!dbCards || dbCards.length === 0) {
      try {
        const [wtRows] = await pool.query('SELECT meta_response FROM whatsapp_templates WHERE template_name = ? ORDER BY id DESC LIMIT 1', [templateName]);
        if (wtRows.length > 0 && wtRows[0].meta_response) {
          const parsed = typeof wtRows[0].meta_response === 'string' ? JSON.parse(wtRows[0].meta_response) : wtRows[0].meta_response;
          if (Array.isArray(parsed.cards)) {
            dbCards = parsed.cards;
          }
        }
      } catch (_) { }
    }

    for (let i = 0; i < rawCards.length; i++) {
      const card = rawCards[i];
      const cardComponents = [];
      const dbCard = (Array.isArray(dbCards) && dbCards[i]) ? dbCards[i] : {};
      const customCard = Array.isArray(customCarouselMedia) ? customCarouselMedia[i] : (customCarouselMedia?.[i] || null);

      // Find card header
      const cardHeader = card.components?.find(c => (c.type || '').toUpperCase() === 'HEADER');
      if (cardHeader) {
        const rawMedia = (customCard?.base64 || customCard?.previewUrl || customCard?.headerMedia || customCard?.media_url)
          || (dbCard.mediaBase64 || dbCard.headerMedia || dbCard.media_url || dbCard.header_handle || null)
          || (cardHeader.example?.header_handle?.[0] || cardHeader.example?.header_url?.[0] || null);

        const isVid = (cardHeader.format || '').toUpperCase() === 'VIDEO'
          || (customCard?.mediaType || '').toLowerCase() === 'video'
          || (dbCard.mediaType || '').toLowerCase() === 'video'
          || (typeof rawMedia === 'string' && (rawMedia.includes('video') || rawMedia.includes('.mp4') || rawMedia.includes('.webm')));

        const format = isVid ? 'video' : 'image';
        let runtimeMediaId = null;
        let cBuffer = null;
        let cMime = isVid ? 'video/mp4' : 'image/png';
        const cFileName = isVid ? `card_${i + 1}.mp4` : `card_${i + 1}.png`;

        // 1. Check if rawMedia has base64 data
        if (rawMedia && typeof rawMedia === 'string' && rawMedia.startsWith('data:')) {
          try {
            const rawB64 = rawMedia.replace(/^data:[A-Za-z0-9-+\/]+;base64,/, '');
            cBuffer = Buffer.from(rawB64, 'base64');
            const mimeMatch = rawMedia.match(/^data:([A-Za-z0-9-+\/]+);base64,/);
            if (mimeMatch) cMime = mimeMatch[1];
          } catch (_) { }
        } else if (rawMedia && typeof rawMedia === 'string' && !rawMedia.startsWith('http')) {
          // Check local file on disk
          const foundDiskPath = findFileOnDisk(rawMedia);
          if (foundDiskPath) {
            cBuffer = fs.readFileSync(foundDiskPath);
            cMime = detectMimeFromBuffer(cBuffer, path.extname(foundDiskPath).toLowerCase());
            logger.info(`[CentralTemplateSender] ✅ Loaded real media file for Card #${i + 1} from disk: ${foundDiskPath} (${cBuffer.length} bytes)`);
          }
        } else if (rawMedia && typeof rawMedia === 'string' && (rawMedia.startsWith('http://') || rawMedia.startsWith('https://'))) {
          // Download remote media buffer
          try {
            const resp = await axios.get(rawMedia, { responseType: 'arraybuffer', timeout: 12000 });
            if (resp.data) {
              cBuffer = Buffer.from(resp.data);
              if (resp.headers['content-type']) cMime = resp.headers['content-type'];
              logger.info(`[CentralTemplateSender] Downloaded card #${i + 1} media buffer from remote (${cBuffer.length} bytes)`);
            }
          } catch (dErr) {
            logger.warn(`[CentralTemplateSender] Failed to download card media from ${rawMedia}: ${dErr.message}`);
          }
        }

        // Fallback buffer if media file is missing on disk
        if (!cBuffer || cBuffer.length === 0 || (isVid && !cMime.includes('video') && !cMime.includes('mp4'))) {
          try {
            const uploadDir = path.resolve(process.cwd(), 'uploads/templates');
            if (fs.existsSync(uploadDir)) {
              const files = fs.readdirSync(uploadDir);
              const matching = isVid ? files.find(f => f.endsWith('.mp4')) : files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
              if (matching) {
                cBuffer = fs.readFileSync(path.join(uploadDir, matching));
                cMime = isVid ? 'video/mp4' : 'image/png';
              }
            }
          } catch (_) { }

          if (!cBuffer || cBuffer.length === 0) {
            cBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
            cMime = isVid ? 'video/mp4' : 'image/png';
          }
        }

        if (isVid) {
          cMime = 'video/mp4';
        }

        // Upload media to Meta Media API to get a valid runtime Media ID
        if (cBuffer && cBuffer.length > 0) {
          const uploadResult = await uploadMediaToMeta(cBuffer, cMime, cFileName, phoneNumberId, accessToken);
          runtimeMediaId = uploadResult.id;
          if (uploadResult.error) {
            logger.warn(`[CentralTemplateSender] Carousel Card #${i + 1} media upload failed: ${uploadResult.error}`);
          } else {
            logger.info(`[CentralTemplateSender] Uploaded Carousel Card #${i + 1} media to Meta. ID: ${runtimeMediaId}`);
          }
        }

        // Resolve public server URL for fallback link
        const serverBaseUrl = (process.env.SERVER_BASE_URL || process.env.BASE_URL || 'https://officialwaba.com').replace(/\/$/, '');
        let safePublicLink = null;
        if (rawMedia && typeof rawMedia === 'string') {
          if (rawMedia.startsWith('http://') || rawMedia.startsWith('https://')) {
            if (!rawMedia.includes('lookaside.fbsbx.com') && !rawMedia.includes('fbsbx.com') && !rawMedia.includes('facebook.com')) {
              safePublicLink = rawMedia;
            }
          } else if (rawMedia.includes('uploads/')) {
            const cleanRel = rawMedia.replace(/^.*uploads\//, '');
            safePublicLink = `${serverBaseUrl}/api/uploads/${cleanRel}`;
          }
        }

        if (!runtimeMediaId && safePublicLink && !(await isPubliclyReachable(safePublicLink))) {
          logger.warn(`[CentralTemplateSender] Rejecting unreachable carousel fallback link: ${safePublicLink}`);
          safePublicLink = null;
        }

        if (runtimeMediaId) {
          cardComponents.push({
            type: 'header',
            parameters: [
              {
                type: format,
                [format]: { id: runtimeMediaId }
              }
            ]
          });
        } else if (safePublicLink) {
          logger.info(`[CentralTemplateSender] Using public server link for Card #${i + 1}: ${safePublicLink}`);
          cardComponents.push({
            type: 'header',
            parameters: [
              {
                type: format,
                [format]: { link: safePublicLink }
              }
            ]
          });
        }
      }

      // Find card body
      const cardBody = card.components?.find(c => (c.type || '').toUpperCase() === 'BODY');
      if (cardBody) {
        const match = cardBody.text?.match(/{{(\d+)}}/g);
        if (match && match.length > 0) {
          const bodyParams = match.map((m, varIdx) => {
            const vVal = variables[`card_${i + 1}_${varIdx + 1}`] || variables[`${varIdx + 1}`] || `Item_${varIdx + 1}`;
            return { type: 'text', text: String(vVal) };
          });
          cardComponents.push({ type: 'body', parameters: bodyParams });
        }
      }

      // Find card button variables
      const cardButtons = card.components?.find(c => (c.type || '').toUpperCase() === 'BUTTONS');
      if (cardButtons && Array.isArray(cardButtons.buttons)) {
        cardButtons.buttons.forEach((btn, bIndex) => {
          if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
            const urlVal = variables[`card_${i + 1}_btn_${bIndex + 1}`] || 'action';
            cardComponents.push({
              type: 'button',
              sub_type: 'url',
              index: String(bIndex),
              parameters: [{ type: 'text', text: String(urlVal) }]
            });
          } else if (btn.type === 'QUICK_REPLY' && (btn.example || btn.text?.includes('{{'))) {
            cardComponents.push({
              type: 'button',
              sub_type: 'quick_reply',
              index: String(bIndex),
              parameters: [{ type: 'payload', payload: `card_${i}_btn_${bIndex}` }]
            });
          }
        });
      }

      formattedCards.push({
        card_index: i,
        components: cardComponents
      });
    }

    if (formattedCards.length > 0) {
      finalComponents.push({
        type: 'carousel',
        cards: formattedCards
      });
    }
  }

  return {
    components: finalComponents,
    mediaResolutionFailed,
    mediaResolutionError,
    metaTemplate,
    dbTemplate
  };
}

const componentParameters = (components, type) =>
  (components || []).find(c => String(c?.type || '').toLowerCase() === type)?.parameters || [];

const fillTemplateText = (text, parameters = []) => String(text || '').replace(/{{\s*(\d+)\s*}}/g, (_, number) => {
  const parameter = parameters[Number(number) - 1];
  return String(parameter?.text ?? parameter?.payload ?? parameter?.currency?.fallback_value ?? parameter?.date_time?.fallback_value ?? `{{${number}}}`);
});

const publicMediaUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^(https?:|data:)/i.test(value)) return value;
  const uploadsIndex = value.replace(/\\/g, '/').indexOf('uploads/');
  if (uploadsIndex < 0) return value;
  const relative = value.replace(/\\/g, '/').slice(uploadsIndex + 'uploads/'.length);
  const base = (process.env.SERVER_BASE_URL || process.env.BASE_URL || 'https://officialwaba.com').replace(/\/$/, '');
  return `${base}/api/uploads/${relative}`;
};

/** Build the exact, durable representation used by the Chat Inbox. */
const buildChatSnapshot = ({ templateName, buildResult, customMediaUrl, campaignName = null, languageCode = 'en_US' }) => {
  const definitions = buildResult.metaTemplate?.components || [];
  const runtime = buildResult.components || [];
  const header = definitions.find(c => String(c?.type || '').toUpperCase() === 'HEADER');
  const body = definitions.find(c => String(c?.type || '').toUpperCase() === 'BODY');
  const footer = definitions.find(c => String(c?.type || '').toUpperCase() === 'FOOTER');
  const buttons = definitions.find(c => String(c?.type || '').toUpperCase() === 'BUTTONS');
  const headerParams = componentParameters(runtime, 'header');
  const bodyParams = componentParameters(runtime, 'body');
  const format = String(header?.format || buildResult.dbTemplate?.media_type || '').toLowerCase();
  const runtimeMedia = headerParams[0]?.[format]?.link;
  const exampleMedia = header?.example?.header_url?.[0] || header?.example?.header_handle?.[0];
  const mediaUrl = publicMediaUrl(customMediaUrl || buildResult.dbTemplate?.header_media_url || runtimeMedia || exampleMedia);
  const bodyText = fillTemplateText(body?.text, bodyParams);
  const headerText = String(header?.format || '').toUpperCase() === 'TEXT'
    ? fillTemplateText(header?.text, headerParams)
    : '';
  const text = [headerText, bodyText, footer?.text].filter(Boolean).join('\n\n') || `[Template: ${templateName}]`;

  const carousel = definitions.find(c => String(c?.type || '').toUpperCase() === 'CAROUSEL');
  const cards = (carousel?.cards || []).map((card, index) => {
    const cardHeader = (card.components || []).find(c => String(c?.type || '').toUpperCase() === 'HEADER');
    const cardBody = (card.components || []).find(c => String(c?.type || '').toUpperCase() === 'BODY');
    const cardButtons = (card.components || []).find(c => String(c?.type || '').toUpperCase() === 'BUTTONS');
    return {
      index,
      mediaType: String(cardHeader?.format || '').toLowerCase(),
      mediaUrl: publicMediaUrl(cardHeader?.example?.header_url?.[0] || cardHeader?.example?.header_handle?.[0]),
      body: cardBody?.text || '',
      buttons: cardButtons?.buttons || []
    };
  });

  return {
    templateName,
    templateLanguage: languageCode,
    campaignName,
    text,
    caption: bodyText,
    header: header ? { format, text: headerText, mediaUrl } : null,
    body: bodyText,
    footer: footer?.text || '',
    buttons: Array.isArray(buttons?.buttons) ? buttons.buttons : [],
    cards
  };
};

const parseStoredJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

/**
 * Reconstructs an old campaign/template row without sending or uploading media.
 * Used by Chat Inbox history and sidebar previews.
 */
export async function resolveTemplateChatSnapshot({
  templateName,
  languageCode = 'en_US',
  organizationId = null,
  accountId = null,
  campaignName = null,
  components = [],
  variables = {},
  customMediaUrl = null
}) {
  if (!templateName) return null;
  let metaTemplate = null;
  try {
    metaTemplate = await getTemplateDetails(templateName, languageCode, accountId, organizationId);
  } catch (err) {
    logger.warn(`[ChatSnapshot] Could not resolve template "${templateName}": ${err.message}`);
  }
  const dbTemplate = await resolveTemplateRecord(templateName, null, organizationId);
  const runtime = Array.isArray(parseStoredJson(components, [])) ? parseStoredJson(components, []) : [];
  const storedVariables = parseStoredJson(variables, {});
  const definitions = metaTemplate?.components || [];

  for (const type of ['header', 'body']) {
    if (runtime.some(c => String(c?.type || '').toLowerCase() === type)) continue;
    const definition = definitions.find(c => String(c?.type || '').toLowerCase() === type);
    const matches = definition?.text?.match(/{{\s*\d+\s*}}/g) || [];
    if (matches.length) {
      runtime.push({
        type,
        parameters: matches.map((_, index) => ({
          type: 'text',
          text: String(storedVariables[type === 'body' ? String(index + 1) : `${type}_${index + 1}`]
            ?? storedVariables[String(index + 1)] ?? `{{${index + 1}}}`)
        }))
      });
    }
  }

  return buildChatSnapshot({
    templateName,
    languageCode,
    campaignName,
    customMediaUrl,
    buildResult: { components: runtime, metaTemplate, dbTemplate }
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Authoritative Single Message Sender
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function sendCentralTemplateMessage({
  recipient,
  templateName,
  templateId = null,
  languageCode = 'en_US',
  components = [],
  variables = {},
  customMediaUrl = null,
  customCarouselMedia = null,
  campaignId = null,
  campaignName = null,
  campaignType = 'quick',
  featureKey = 'quick',
  userId = 1,
  organizationId = null,
  accountId = null
}) {
  if (!recipient || !templateName) {
    return {
      success: false,
      statusCode: 400,
      message: 'Both recipient phone and templateName are required.'
    };
  }

  // 1. Resolve Multi-Tenant Credentials
  const creds = await resolveAccountCredentials(accountId, organizationId);
  const activeOrgId = creds.organizationId || 1;
  const activeAccountId = creds.accountId || null;

  if (creds.status && creds.status.toLowerCase() !== 'active') {
    return {
      success: false,
      statusCode: 403,
      message: 'WhatsApp account is currently Deactive. Please activate the number in Settings.'
    };
  }

  if (!creds.phoneId || !creds.token) {
    return {
      success: false,
      statusCode: 400,
      message: 'No connected WhatsApp Business Account found for your organization. Please connect in Settings.'
    };
  }

  // 2. Clean Phone Number (E.164)
  let cleanPhone = String(recipient).replace(/^[+]/, '').replace(/[^0-9]/g, '').trim();
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
    cleanPhone = `91${cleanPhone.slice(1)}`;
  }

  if (cleanPhone.length < 7 || cleanPhone.length > 15) {
    return {
      success: false,
      statusCode: 400,
      message: `Invalid recipient phone number: "${recipient}". Must be 7-15 digits.`
    };
  }

  // 3. Blacklist / Opt-out check
  const isBlocked = await checkBlacklist(cleanPhone, activeOrgId);
  if (isBlocked) {
    return {
      success: false,
      statusCode: 400,
      message: 'Recipient is in Opt-out / Blacklist. Message blocked.'
    };
  }

  // 4. Credit Pre-check
  const creditCheck = await hasSufficientCredits(userId, 1, featureKey);
  if (!creditCheck.sufficient) {
    return {
      success: false,
      statusCode: 400,
      message: `Insufficient ${featureKey} credits. You have ${creditCheck.available} credit(s) remaining, but 1 credit is required.`
    };
  }

  // 5. Build Unified Runtime Components (Header Media, Variables, Buttons)
  const buildResult = await buildCentralTemplateComponents({
    templateName,
    templateId,
    languageCode,
    organizationId: activeOrgId,
    phoneNumberId: creds.phoneId,
    accessToken: creds.token,
    suppliedComponents: components,
    variables,
    customMediaUrl,
    customCarouselMedia
  });

  if (buildResult.mediaResolutionFailed) {
    logger.error(`[CentralTemplateSender] Aborting send to ${cleanPhone}: ${buildResult.mediaResolutionError}`);
    return {
      success: false,
      statusCode: 400,
      message: buildResult.mediaResolutionError
    };
  }
  const finalComponents = buildResult.components;
  const chatSnapshot = buildChatSnapshot({ templateName, buildResult, customMediaUrl, campaignName, languageCode });

  // 6. Build Meta Graph API Payload
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || 'en_US' },
      ...(finalComponents && finalComponents.length > 0 ? { components: finalComponents } : {})
    }
  };

  const endpoint = `https://graph.facebook.com/${whatsappConfig.apiVersion || 'v19.0'}/${creds.phoneId}/messages`;

  logger.info(`[TEMPLATE_SEND] [${campaignType.toUpperCase()}] Sending template "${templateName}" (${languageCode}) to ${cleanPhone} via PhoneId ${creds.phoneId} for Org ${activeOrgId}`);

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const messageId = response.data?.messages?.[0]?.id;

    if (!messageId) {
      throw new Error(response.data?.error?.message || 'No message ID returned from Meta');
    }

    // 7. Deduct 1 credit on success
    await deductMessageCredit(userId, 1, `${campaignType.toUpperCase()} message to ${cleanPhone} (Template: ${templateName})`, featureKey);

    // 8. Record in Chat Conversations
    const chatRecord = await recordChatMessage({
      userId,
      organizationId: activeOrgId,
      whatsappAccountId: activeAccountId,
      campaignId: campaignId || null,
      phone: cleanPhone,
      messageText: chatSnapshot.text,
      wamid: messageId,
      sender: 'user',
      direction: 'outgoing',
      messageType: chatSnapshot.header?.format || 'template',
      mediaUrl: chatSnapshot.header?.mediaUrl || null,
      rawPayload: { templateSnapshot: chatSnapshot },
      status: 'sent'
    });

    return {
      success: true,
      messageId,
      message: chatRecord?.message || null,
      data: response.data
    };
  } catch (err) {
    const errorDetails = err.response?.data?.error;
    const errorMsg = errorDetails?.message || err.message;
    logger.error(`[CentralTemplateSender] Meta send error for ${cleanPhone}: ${errorMsg}`);

    return {
      success: false,
      statusCode: err.response?.status || 500,
      message: errorMsg,
      details: errorDetails || err.response?.data || null
    };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Authoritative Batch/Campaign Sender
 * Used by CSV, Tags, Groups, Scheduled, and Birthday campaigns
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function sendCentralCampaignBatch(campaignData) {
  const {
    campaignName,
    templateName,
    templateId = null,
    languageCode = 'en_US',
    country = null,
    numbers = [],
    components = [],
    variables = {},
    customMediaUrl = null,
    customCarouselMedia = null,
    existingCampaignId = null,
    userId = 1,
    accountId = null,
    organizationId = null,
    featureKey = 'general'
  } = campaignData;

  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return {
      success: false,
      message: 'At least one recipient phone number is required.',
      totalSent: 0,
      totalFailed: 0
    };
  }

  // 1. Resolve Multi-Tenant Credentials
  const creds = await resolveAccountCredentials(accountId, organizationId);
  const activeOrgId = creds.organizationId || 1;
  const activeAccountId = creds.accountId || null;

  if (creds.status && creds.status.toLowerCase() !== 'active') {
    return {
      success: false,
      message: 'WhatsApp account is currently Deactive. Please activate the number in Settings.',
      totalSent: 0,
      totalFailed: numbers.length
    };
  }

  if (!creds.phoneId || !creds.token) {
    return {
      success: false,
      message: 'No connected WhatsApp Business Account found for your organization.',
      totalSent: 0,
      totalFailed: numbers.length
    };
  }

  // 2. Pre-build reusable template components (e.g. upload media once for the batch)
  const buildResult = await buildCentralTemplateComponents({
    templateName,
    templateId,
    languageCode,
    organizationId: activeOrgId,
    phoneNumberId: creds.phoneId,
    accessToken: creds.token,
    suppliedComponents: components,
    variables,
    customMediaUrl,
    customCarouselMedia
  });

  if (buildResult.mediaResolutionFailed) {
    logger.error(`[CentralTemplateSender] Aborting batch for "${campaignName}": ${buildResult.mediaResolutionError}`);
    const conn = await pool.getConnection();
    try {
      let failedCampId = existingCampaignId;
      if (!failedCampId) {
        const [r] = await conn.execute(
          `INSERT INTO campaigns (user_id, organization_id, whatsapp_account_id, campaign_name, template_name, language_code, country, total_numbers, sent_count, failed_count, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'failed', NOW())`,
          [userId || 1, activeOrgId, activeAccountId, campaignName || `Campaign - ${templateName}`, templateName, languageCode, country || null, numbers.length, numbers.length]
        );
        failedCampId = r.insertId;
      } else {
        await conn.execute(
          `UPDATE campaigns SET status = 'failed', failed_count = ?, sent_count = 0 WHERE id = ?`,
          [numbers.length, failedCampId]
        );
      }
      for (const rawPhone of numbers) {
        const cleanPh = String(rawPhone).replace(/^[+]/, '').replace(/[^0-9]/g, '').trim();
        if (!cleanPh) continue;
        await conn.execute(
          `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, status, error) VALUES (?, ?, ?, ?, 'failed', ?)`,
          [activeOrgId, activeAccountId, failedCampId, cleanPh, buildResult.mediaResolutionError]
        ).catch(() => {});
      }
      emitToOrganization(activeOrgId, 'sending_history_updated', { type: 'campaign_completed', campaignId: failedCampId, sentCount: 0, failedCount: numbers.length });
    } finally {
      conn.release();
    }
    return {
      success: false,
      message: buildResult.mediaResolutionError,
      totalSent: 0,
      totalFailed: numbers.length
    };
  }
  const finalComponents = buildResult.components;
  const chatSnapshot = buildChatSnapshot({ templateName, buildResult, customMediaUrl, campaignName, languageCode });

  const connection = await pool.getConnection();
  let campaignId = existingCampaignId;

  try {
    if (!campaignId) {
      let campRes;
      try {
        [campRes] = await connection.execute(
          `INSERT INTO campaigns (user_id, organization_id, whatsapp_account_id, campaign_name, template_name, language_code, country, total_numbers, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', NOW())`,
          [userId || 1, activeOrgId, activeAccountId, campaignName || `Campaign - ${templateName}`, templateName, languageCode, country || null, numbers.length]
        );
      } catch (_) {
        [campRes] = await connection.execute(
          `INSERT INTO campaigns (organization_id, whatsapp_account_id, campaign_name, template_name, language_code, country, total_numbers, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'running', NOW())`,
          [activeOrgId, activeAccountId, campaignName || `Campaign - ${templateName}`, templateName, languageCode, country || null, numbers.length]
        );
      }
      campaignId = campRes.insertId;
    } else {
      await connection.execute(
        `UPDATE campaigns SET status = 'running', organization_id = COALESCE(organization_id, ?), whatsapp_account_id = COALESCE(whatsapp_account_id, ?) WHERE id = ?`,
        [activeOrgId, activeAccountId, campaignId]
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];
    const countryDigits = country ? String(country).replace(/[^0-9]/g, '') : '91';

    for (const rawPhone of numbers) {
      let cleanPhone = String(rawPhone).replace(/^[+]/, '').replace(/[^0-9]/g, '').trim();
      if (!cleanPhone) continue;

      if (cleanPhone.length === 10 && countryDigits) {
        cleanPhone = `${countryDigits}${cleanPhone}`;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0') && countryDigits) {
        cleanPhone = `${countryDigits}${cleanPhone.slice(1)}`;
      }

      // Check blacklist
      const isBlocked = await checkBlacklist(cleanPhone, activeOrgId);
      if (isBlocked) {
        failedCount++;
        const errorMsg = 'Recipient is in Opt-out / Blacklist. Message blocked.';
        results.push({ phone: cleanPhone, success: false, error: errorMsg });
        await connection.execute(
          `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, status, error) VALUES (?, ?, ?, ?, 'failed', ?)`,
          [activeOrgId, activeAccountId, campaignId, cleanPhone, errorMsg]
        );
        continue;
      }

      // Credit check per message
      const creditCheck = await hasSufficientCredits(userId, 1, featureKey);
      if (!creditCheck.sufficient) {
        failedCount++;
        const errorMsg = `Insufficient ${featureKey} credits.`;
        results.push({ phone: cleanPhone, success: false, error: errorMsg });
        await connection.execute(
          `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, status, error) VALUES (?, ?, ?, ?, 'failed', ?)`,
          [activeOrgId, activeAccountId, campaignId, cleanPhone, errorMsg]
        );
        continue;
      }

      // Send to Meta Cloud API
      const endpoint = `https://graph.facebook.com/${whatsappConfig.apiVersion || 'v19.0'}/${creds.phoneId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode || 'en_US' },
          ...(finalComponents && finalComponents.length > 0 ? { components: finalComponents } : {})
        }
      };

      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const messageId = response.data?.messages?.[0]?.id;

        if (!messageId) {
          throw new Error(response.data?.error?.message || 'No message ID returned from Meta');
        }

        sentCount++;
        results.push({ phone: cleanPhone, success: true, messageId });

        // Deduct credit
        await deductMessageCredit(userId, 1, `Campaign "${campaignName}" to ${cleanPhone}`, featureKey);

        // Save recipient record
        await connection.execute(
          `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, message_id, status, sent_at) VALUES (?, ?, ?, ?, ?, 'sent', NOW())`,
          [activeOrgId, activeAccountId, campaignId, cleanPhone, messageId]
        );

        // Record in Chat conversations
        await recordChatMessage({
          userId,
          organizationId: activeOrgId,
          whatsappAccountId: activeAccountId,
          campaignId,
          phone: cleanPhone,
          messageText: chatSnapshot.text,
          wamid: messageId,
          sender: 'user',
          direction: 'outgoing',
          messageType: chatSnapshot.header?.format || 'template',
          mediaUrl: chatSnapshot.header?.mediaUrl || null,
          rawPayload: { templateSnapshot: { ...chatSnapshot, campaignName } },
          status: 'sent'
        });
      } catch (err) {
        failedCount++;
        const errorMsg = err.response?.data?.error?.message || err.message;
        results.push({ phone: cleanPhone, success: false, error: errorMsg });

        await connection.execute(
          `INSERT INTO campaign_recipients (organization_id, whatsapp_account_id, campaign_id, phone, status, error) VALUES (?, ?, ?, ?, 'failed', ?)`,
          [activeOrgId, activeAccountId, campaignId, cleanPhone, errorMsg]
        );
      }
    }

    // Update campaign status
    const finalStatus = sentCount > 0 ? 'completed' : 'failed';
    await connection.execute(
      `UPDATE campaigns SET sent_count = ?, failed_count = ?, status = ? WHERE id = ?`,
      [sentCount, failedCount, finalStatus, campaignId]
    );

    emitToOrganization(activeOrgId, 'sending_history_updated', {
      type: 'campaign_completed',
      campaignId,
      sentCount,
      failedCount
    });

    return {
      success: true,
      campaignId,
      total: numbers.length,
      sent: sentCount,
      failed: failedCount,
      results
    };
  } finally {
    connection.release();
  }
}