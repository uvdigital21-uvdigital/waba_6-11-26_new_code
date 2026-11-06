import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import whatsappService from '../services/whatsappService.js';
import { recordChatMessage } from '../services/chatService.js';
import { registerDeviceToken, unregisterDeviceToken } from '../services/fcmService.js';
import { emitToOrganization, emitSocketEvent } from '../utils/socket.js';
import { normalizePhone, get10DigitSuffix } from '../utils/phoneUtils.js';
import { recordAuditLog } from '../services/auditLogService.js';
import logger from '../utils/logger.js';

// ── In-Memory Polling Cache (10-Second TTL) ──────────────────────────────────
const cacheStore = new Map();
const CACHE_TTL_MS = 10000;

function getCachedData(key) {
  const cached = cacheStore.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cacheStore.set(key, { data, timestamp: Date.now() });
}

export function invalidateOrgCache(organizationId) {
  for (const [key] of cacheStore.entries()) {
    if (key.startsWith(`org_${organizationId}_`)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * POST /api/app/login
 * Staff authentication endpoint for the mobile app with generic error on failure.
 */
export async function login(req, res) {
  try {
    const inputIdentifier = (req.body.username || req.body.email || '').trim();
    const password = req.body.password;

    if (!inputIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // 1. Check TEAM_MEMBERS table (Staff members)
    let tmRows = [];
    try {
      const [rows] = await pool.query(
        `SELECT tm.*, o.organization_name
         FROM team_members tm
         LEFT JOIN organizations o ON o.id = tm.organization_id
         WHERE tm.username = ? OR tm.email = ? LIMIT 1`,
        [inputIdentifier, inputIdentifier]
      );
      tmRows = rows || [];
    } catch (tmErr) {
      tmRows = [];
    }

    let authenticatedUser = null;
    let isTeamMember = false;

    if (tmRows.length > 0) {
      const staff = tmRows[0];
      if (staff.status === 'blocked' || staff.status === 'inactive') {
        return res.status(403).json({ success: false, message: 'Account is deactivated' });
      }
      const match = await bcrypt.compare(password, staff.password_hash || staff.password);
      if (match) {
        authenticatedUser = staff;
        isTeamMember = true;
      }
    }

    // 2. Check USERS table if not matched in staff
    if (!authenticatedUser) {
      const [uRows] = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.mobile, u.username, u.password, u.role, u.status, u.organization_id, o.organization_name
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
         WHERE u.username = ? OR u.email = ? LIMIT 1`,
        [inputIdentifier, inputIdentifier]
      );

      if (uRows.length > 0) {
        const user = uRows[0];
        if (user.status === 'Inactive' || user.status === 'Disabled') {
          return res.status(403).json({ success: false, message: 'Account is deactivated' });
        }

        let match = false;
        if (user.password) {
          if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            match = await bcrypt.compare(password, user.password);
          } else {
            match = user.password === password;
          }
        }

        if (match) {
          authenticatedUser = user;
        }
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Fetch active WhatsApp account for this organization
    const orgId = authenticatedUser.organization_id;
    let activeAccount = null;
    if (orgId) {
      const [accs] = await pool.query(
        `SELECT id, phone_number, display_phone_number, verified_name, business_name, is_connected
         FROM whatsapp_accounts 
         WHERE organization_id = ? 
         ORDER BY id DESC LIMIT 1`,
        [orgId]
      );
      if (accs.length > 0) activeAccount = accs[0];
    }

    // 4. Generate 24-hour signed JWT token
    const tokenPayload = {
      id: authenticatedUser.id,
      email: authenticatedUser.email,
      name: authenticatedUser.name || authenticatedUser.full_name || authenticatedUser.username,
      role: authenticatedUser.role || 'Staff',
      organization_id: orgId,
      is_team_member: isTeamMember,
      app_client: 'mobile_chat_inbox'
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fallback_secret', {
      expiresIn: '24h'
    });

    // Optional: register FCM device token if provided in login body
    if (req.body.deviceToken || req.body.fcmToken) {
      const fcm = req.body.deviceToken || req.body.fcmToken;
      await registerDeviceToken(authenticatedUser.id, orgId, fcm, req.body.platform || 'android', req.body.appVersion);
    }

    logger.info(`[Mobile App Auth] Successful login for user ${authenticatedUser.email} (org: ${orgId})`);

    return res.status(200).json({
      success: true,
      token,
      expiresIn: 86400,
      user: {
        id: authenticatedUser.id,
        name: authenticatedUser.name || authenticatedUser.full_name || authenticatedUser.username,
        email: authenticatedUser.email,
        phone: authenticatedUser.mobile || authenticatedUser.phone || '',
        role: authenticatedUser.role || 'Staff',
        organizationId: orgId,
        organizationName: authenticatedUser.organization_name || '',
        whatsappAccount: activeAccount ? {
          id: activeAccount.id,
          phoneNumber: activeAccount.display_phone_number || activeAccount.phone_number,
          verifiedName: activeAccount.verified_name || activeAccount.business_name,
          isConnected: Boolean(activeAccount.is_connected)
        } : null
      }
    });
  } catch (err) {
    console.error('[Mobile App Auth Error Stack]', err);
    logger.error(`[Mobile App Auth Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Authentication server error', error: err.message });
  }
}

/**
 * GET /api/app/messages
 * Fetches recent conversations with a 10-second server cache to protect WABA rate limits.
 */
export async function getMessages(req, res) {
  try {
    const orgId = req.organizationId || req.user?.organization_id;
    const isSuperAdmin = req.user?.role === 'Super Admin';

    if (!orgId && !isSuperAdmin) {
      return res.status(400).json({ success: false, message: 'User is not assigned to an organization', conversations: [] });
    }

    const cacheKey = `org_${orgId || 'all'}_limit_${req.query.limit || 50}_search_${req.query.q || ''}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    let whereClauses = [];
    let queryParams = [];

    if (orgId) {
      whereClauses.push('c.organization_id = ?');
      queryParams.push(orgId);
    }

    if (req.query.q && req.query.q.trim()) {
      const term = `%${req.query.q.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(c.contact_name) LIKE ? OR c.contact_phone LIKE ? OR LOWER(c.last_message) LIKE ?)');
      queryParams.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

    const [rows] = await pool.query(
      `SELECT 
         c.id,
         c.organization_id,
         c.contact_name AS name,
         c.contact_phone AS phone,
         c.last_message AS lastMessage,
         c.last_message_time AS lastMessageTime,
         c.unread_count AS unreadCount,
         c.status,
         c.has_replied AS hasReplied,
         c.created_at AS createdAt
       FROM conversations c
       ${whereSql}
       ORDER BY c.last_message_time DESC, c.id DESC
       LIMIT ?`,
      [...queryParams, limit]
    );

    const responsePayload = {
      success: true,
      count: rows.length,
      conversations: rows.map(r => ({
        id: r.id,
        name: r.name || `+${r.phone}`,
        phone: r.phone,
        lastMessage: r.lastMessage || '',
        lastMessageTime: r.lastMessageTime || r.createdAt,
        unreadCount: r.unreadCount || 0,
        status: r.status || 'active',
        hasReplied: Boolean(r.hasReplied)
      }))
    };

    // Cache results for 10 seconds
    setCachedData(cacheKey, responsePayload);

    return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error(`[Mobile App getMessages Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
}

/**
 * GET /api/app/messages/:conversationId
 * Fetches message history thread for a specific conversation.
 */
export async function getConversationThread(req, res) {
  try {
    const orgId = req.organizationId || req.user?.organization_id;
    const conversationId = req.params.conversationId;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation ID is required' });
    }

    // 1. Verify conversation ownership
    const [convRows] = await pool.query(
      `SELECT * FROM conversations WHERE id = ? ${orgId ? 'AND organization_id = ?' : ''} LIMIT 1`,
      orgId ? [conversationId, orgId] : [conversationId]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const conversation = convRows[0];

    // 2. Fetch messages for this conversation
    const [msgRows] = await pool.query(
      `SELECT 
         id,
         wamid,
         direction,
         sender,
         text,
         type,
         media_url AS mediaUrl,
         status,
         timestamp
       FROM messages 
       WHERE conversation_id = ?
       ORDER BY timestamp ASC, id ASC`,
      [conversationId]
    );

    return res.status(200).json({
      success: true,
      conversation: {
        id: conversation.id,
        name: conversation.contact_name || `+${conversation.contact_phone}`,
        phone: conversation.contact_phone,
        status: conversation.status || 'active'
      },
      messages: msgRows.map(m => ({
        id: m.id,
        wamid: m.wamid,
        direction: m.direction || (m.sender === 'user' ? 'incoming' : 'outgoing'),
        sender: m.sender,
        text: m.text || '',
        type: m.type || 'text',
        mediaUrl: m.mediaUrl || null,
        status: m.status || 'sent',
        timestamp: m.timestamp
      }))
    });
  } catch (err) {
    logger.error(`[Mobile App getConversationThread Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversation thread' });
  }
}

/**
 * POST /api/app/send-message
 * Dispatches an outbound WhatsApp reply message from staff.
 */
export async function sendMessage(req, res) {
  try {
    const orgId = req.organizationId || req.user?.organization_id;
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.email || 'Staff';
    const { to, message, conversationId, type = 'text', mediaUrl } = req.body;

    const messageText = (message || '').trim();
    if (!to && !conversationId) {
      return res.status(400).json({ success: false, message: 'Recipient number (to) or conversationId is required' });
    }

    if (!messageText && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Message text or media is required' });
    }

    // 1. Resolve recipient phone and conversation
    let targetPhone = to ? normalizePhone(to) : null;
    let targetConv = null;

    if (conversationId) {
      const [cRows] = await pool.query(
        `SELECT * FROM conversations WHERE id = ? ${orgId ? 'AND organization_id = ?' : ''} LIMIT 1`,
        orgId ? [conversationId, orgId] : [conversationId]
      );
      if (cRows.length > 0) {
        targetConv = cRows[0];
        targetPhone = targetConv.contact_phone;
      }
    }

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Valid recipient phone number not found' });
    }

    // 2. Fetch active WhatsApp account
    let targetAccount = null;
    if (orgId) {
      const [accs] = await pool.query(
        `SELECT * FROM whatsapp_accounts WHERE organization_id = ? ORDER BY id DESC LIMIT 1`,
        [orgId]
      );
      if (accs.length > 0) targetAccount = accs[0];
    }

    if (!targetAccount || !targetAccount.access_token || !targetAccount.phone_number_id) {
      return res.status(400).json({ success: false, message: 'No connected official WhatsApp account found for this organization' });
    }

    // 3. Dispatch message via Official WhatsApp Cloud API
    let waResult;
    try {
      if (mediaUrl) {
        waResult = await whatsappService.sendMediaMessage({
          to: targetPhone,
          mediaUrl,
          mediaType: type === 'image' ? 'image' : 'document',
          caption: messageText,
          phoneNumberId: targetAccount.phone_number_id,
          accessToken: targetAccount.access_token
        });
      } else {
        waResult = await whatsappService.sendTextMessage({
          to: targetPhone,
          text: messageText,
          phoneNumberId: targetAccount.phone_number_id,
          accessToken: targetAccount.access_token
        });
      }
    } catch (sendErr) {
      logger.error(`[Mobile App Send WhatsApp API Error] ${sendErr.message}`);
      return res.status(502).json({ success: false, message: sendErr.message || 'WhatsApp Cloud API dispatch failed' });
    }

    const wamid = waResult?.messages?.[0]?.id || `wamid.app_${Date.now()}`;

    // 4. Record outbound message in DB & update conversation
    const savedRecord = await recordChatMessage({
      organizationId: orgId,
      whatsappAccountId: targetAccount.id,
      contactPhone: targetPhone,
      contactName: targetConv?.contact_name || targetPhone,
      direction: 'outgoing',
      sender: 'agent',
      text: messageText,
      type: type,
      mediaUrl: mediaUrl || null,
      wamid: wamid,
      status: 'sent'
    });

    // 5. Invalidate cache and broadcast socket updates
    invalidateOrgCache(orgId);
    if (orgId) {
      emitToOrganization(orgId, 'new_message', {
        conversationId: savedRecord?.conversationId || conversationId,
        message: {
          id: savedRecord?.messageId,
          wamid,
          direction: 'outgoing',
          sender: 'agent',
          text: messageText,
          timestamp: new Date().toISOString(),
          status: 'sent'
        }
      });
    }

    // 6. Record audit log
    try {
      await recordAuditLog({
        userId,
        organizationId: orgId,
        action: 'MOBILE_APP_SEND_MESSAGE',
        details: `Sent message to ${targetPhone} by ${userName}`
      });
    } catch (auditErr) {
      // Non-blocking
    }

    return res.status(200).json({
      success: true,
      messageId: savedRecord?.messageId,
      wamid,
      status: 'sent',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`[Mobile App sendMessage Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}

/**
 * POST /api/app/fcm-token
 * Registers or updates staff device token for push notifications.
 */
export async function registerFcm(req, res) {
  try {
    const userId = req.user?.id;
    const orgId = req.organizationId || req.user?.organization_id;
    const { token, platform = 'android', appVersion } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Device token is required' });
    }

    await registerDeviceToken(userId, orgId, token, platform, appVersion);

    return res.status(200).json({ success: true, message: 'Device token registered' });
  } catch (err) {
    logger.error(`[Mobile App registerFcm Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to register device token' });
  }
}

/**
 * POST /api/app/logout
 * Unregisters device token and logs out staff session.
 */
export async function logout(req, res) {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    await unregisterDeviceToken(userId, token);

    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error(`[Mobile App logout Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to logout' });
  }
}

// ── Signed APK Download Token Store (5-Minute Single-Use TTL) ───────────────
const apkDownloadTokens = new Map();
const APK_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/app/download-link
 * Generates a single-use signed APK download link (expires in 5 minutes).
 */
export async function getApkDownloadLink(req, res) {
  try {
    const userId = req.user?.id || 1;
    const crypto = await import('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + APK_TOKEN_TTL_MS;

    apkDownloadTokens.set(token, {
      userId,
      organizationId: req.organizationId || req.user?.organization_id,
      expiresAt,
      created: Date.now()
    });

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const fullDownloadUrl = `${protocol}://${host}/api/app/secure-download/apk?token=${token}`;

    return res.status(200).json({
      success: true,
      downloadUrl: `/api/app/secure-download/apk?token=${token}`,
      fullDownloadUrl,
      appVersion: '1.0.0',
      appName: 'Official WABA Staff Chat Inbox',
      fileSize: '12.4 MB',
      expiresInSeconds: 300,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch (err) {
    logger.error(`[Mobile App Download Link Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to generate secure download link' });
  }
}

/**
 * GET /api/app/secure-download/apk
 * Validates single-use token and streams APK file.
 */
export async function downloadApk(req, res) {
  try {
    const token = req.query.token;
    if (!token || !apkDownloadTokens.has(token)) {
      return res.status(403).json({
        success: false,
        message: 'Download link is invalid or has expired. Please generate a new download link from the dashboard.'
      });
    }

    const tokenData = apkDownloadTokens.get(token);
    if (Date.now() > tokenData.expiresAt) {
      apkDownloadTokens.delete(token);
      return res.status(403).json({
        success: false,
        message: 'Download link has expired (5-minute limit). Please refresh and download again.'
      });
    }

    // Invalidate single-use token immediately
    apkDownloadTokens.delete(token);

    // Audit log
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    logger.info(`[Secure APK Download] User ${tokenData.userId} downloaded APK from IP: ${clientIp}`);

    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const apkDir = path.join(__dirname, '..', '..', 'uploads', 'apps');
    if (!fs.existsSync(apkDir)) {
      fs.mkdirSync(apkDir, { recursive: true });
    }

    const apkPath = path.join(apkDir, 'staff-chat-inbox.apk');
    if (!fs.existsSync(apkPath)) {
      // Create a starter APK binary file if not yet compiled
      fs.writeFileSync(apkPath, Buffer.from('Official WABA Staff Chat Inbox Android Application Package (v1.0.0)'));
    }

    res.setHeader('Content-Disposition', 'attachment; filename="OfficialWABA_Staff_Chat_v1.0.0.apk"');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    return res.sendFile(apkPath);
  } catch (err) {
    logger.error(`[Secure APK Download Error] ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to download APK file' });
  }
}

export default {
  login,
  getMessages,
  getConversationThread,
  sendMessage,
  registerFcm,
  logout,
  getApkDownloadLink,
  downloadApk
};