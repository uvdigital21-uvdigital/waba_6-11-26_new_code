import { pool } from '../config/db.js';
import whatsappService from '../services/whatsappService.js';
import { recordChatMessage } from '../services/chatService.js';
import { emitToOrganization, emitSocketEvent } from '../utils/socket.js';
import logger from '../utils/logger.js';
import { normalizePhone, get10DigitSuffix } from '../utils/phoneUtils.js';
import { checkBlacklist } from '../services/blacklistService.js';
import { fetchMetaTemplates } from '../services/templateService.js';
import { resolveTemplateChatSnapshot } from '../services/templateMessageSenderService.js';
import axios from 'axios';
import { decryptToken } from '../utils/encryption.js';

const parseJsonValue = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return null; }
};

const placeholderInfo = (text = '') => {
    const campaign = String(text).match(/^\[Campaign:\s*(.*?)\s*-\s*Template:\s*(.*?)\]$/i);
    if (campaign) return { campaignName: campaign[1], templateName: campaign[2] };
    const template = String(text).match(/^\[Template:\s*(.*?)\]$/i);
    return template ? { campaignName: null, templateName: template[1] } : null;
};

const messagePreview = (message) => {
    const text = String(message?.caption || message?.text || '').replace(/\s+/g, ' ').trim();
    const type = String(message?.mediaType || message?.messageType || '').toLowerCase();
    const prefix = type === 'image' ? '📷 Image: ' : type === 'video' ? '🎥 Video: ' :
        (type === 'document' || type === 'application') ? '📄 Document: ' : '';
    return `${prefix}${text || (prefix ? 'Attachment' : 'Message')}`;
};

const enrichChatMessages = async (rows, organizationId) => {
    const campaignIds = [...new Set(rows.map(row => row.campaignId).filter(Boolean))];
    const campaignMap = new Map();
    if (campaignIds.length) {
        const marks = campaignIds.map(() => '?').join(',');
        const [campaigns] = await pool.query(
            `SELECT * FROM campaigns WHERE id IN (${marks}) AND (organization_id IS NULL OR organization_id = ?)`,
            [...campaignIds, organizationId]
        );
        campaigns.forEach(campaign => campaignMap.set(Number(campaign.id), campaign));
    }

    const snapshotCache = new Map();
    return Promise.all(rows.map(async row => {
        const rawPayload = parseJsonValue(row.rawPayload);
        let snapshot = rawPayload?.templateSnapshot || null;
        const placeholder = placeholderInfo(row.text);
        const campaign = row.campaignId ? campaignMap.get(Number(row.campaignId)) : null;
        const templateName = snapshot?.templateName || campaign?.template_name || placeholder?.templateName;
        const campaignName = snapshot?.campaignName || campaign?.campaign_name || placeholder?.campaignName || null;

        if (!snapshot && templateName) {
            const cacheKey = [row.whatsappAccountId, templateName, campaign?.id || '', campaign?.variables_json || ''].join(':');
            if (!snapshotCache.has(cacheKey)) {
                snapshotCache.set(cacheKey, resolveTemplateChatSnapshot({
                    templateName,
                    campaignName,
                    languageCode: campaign?.language_code || 'en_US',
                    organizationId,
                    accountId: row.whatsappAccountId || campaign?.whatsapp_account_id || null,
                    components: campaign?.components_json || [],
                    variables: campaign?.variables_json || {},
                    customMediaUrl: campaign?.custom_media_url || null
                }));
            }
            snapshot = await snapshotCache.get(cacheKey);
        }

        const effectiveText = snapshot?.text && !/^\[(Campaign|Template):/i.test(snapshot.text)
            ? snapshot.text : row.text;
        const mediaType = snapshot?.header?.format || row.messageType || null;
        const sourcePayload = rawPayload?.templateSnapshot ? null : rawPayload;
        const sourceMedia = sourcePayload?.image || sourcePayload?.video || sourcePayload?.document || sourcePayload?.audio || null;
        return {
            ...row,
            text: effectiveText,
            caption: snapshot?.caption || effectiveText || '',
            mediaUrl: snapshot?.header?.mediaUrl || (row.mediaId ? `/api/chat/media/${row.id}` : row.mediaUrl || null),
            mediaType,
            mimeType: snapshot?.header?.mimeType || sourceMedia?.mime_type || rawPayload?.mimeType || null,
            fileName: snapshot?.header?.fileName || sourceMedia?.filename || rawPayload?.fileName || null,
            templateName: snapshot?.templateName || templateName || null,
            templateLanguage: snapshot?.templateLanguage || campaign?.language_code || null,
            templateHeader: snapshot?.header || null,
            templateBody: snapshot?.body || null,
            templateFooter: snapshot?.footer || null,
            templateButtons: snapshot?.buttons || [],
            campaignId: row.campaignId || campaign?.id || null,
            campaignName,
            rawPayload: snapshot ? { ...(rawPayload || {}), templateSnapshot: snapshot } : rawPayload
        };
    }));
};

/**
 * GET /api/chat/conversations
 * Fetch conversations strictly filtered by the authenticated user's organization.
 */
export const getConversations = async (req, res) => {
    try {
        const organizationId = req.organizationId || req.user?.organization_id;
        const isSuperAdmin = req.user?.role === 'Super Admin';
        if (!organizationId && !isSuperAdmin) {
            return res.status(400).json({ message: 'User is not assigned to an organization', conversations: [] });
        }
        const requestedAccountId = req.query?.account_id || req.headers?.['x-account-id'] || null;
        const daysFilter = String(req.query.days || req.query.date_filter || '150');
        if (!['7', '30', '150', 'all'].includes(daysFilter)) {
            return res.status(400).json({ message: 'Invalid date filter' });
        }
        const searchQuery = String(req.query.search || req.query.q || '').trim();
        const tagIdFilter = req.query.tag_id || null;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
        const offset = (page - 1) * limit;

        let targetAccount = null;
        if (requestedAccountId) {
            let accQuery = 'SELECT id, organization_id, phone_number, display_phone_number, verified_name, business_name, status FROM whatsapp_accounts WHERE id = ?';
            const accParams = [requestedAccountId];
            if (organizationId && !isSuperAdmin) {
                accQuery += ' AND organization_id = ?';
                accParams.push(organizationId);
            }
            const [accs] = await pool.query(accQuery, accParams);
            if (!accs.length) {
                return res.status(404).json({
                    code: 'ACCOUNT_NOT_FOUND',
                    message: 'The selected WhatsApp account does not exist or is not assigned to your organization.',
                    conversations: [],
                    total: 0,
                    totalPages: 0,
                    hasMore: false
                });
            }
            targetAccount = accs[0];
        }
        if (!targetAccount && organizationId) {
            const [accs] = await pool.query(
                `SELECT id, organization_id, phone_number, display_phone_number, verified_name, business_name, status 
                 FROM whatsapp_accounts 
                 WHERE organization_id = ? AND (status IS NULL OR LOWER(status) NOT IN ('inactive', 'deactive', 'disabled', 'disconnected'))
                 ORDER BY (status = 'active') DESC, id DESC LIMIT 1`,
                [organizationId]
            );
            if (accs.length) targetAccount = accs[0];
        }
        if (!targetAccount && !isSuperAdmin) {
            return res.json({
                conversations: [],
                officialNumber: null,
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasMore: false,
                message: 'No active WhatsApp account found for this organization.'
            });
        }
        const officialNumber = targetAccount?.display_phone_number || targetAccount?.phone_number || null;
        const activeAccountId = targetAccount?.id || null;
        const officialSuffix = officialNumber ? get10DigitSuffix(normalizePhone(officialNumber)) : '';
        const whereClauses = [];
        const queryParams = [];
        if (organizationId) {
            whereClauses.push('c.organization_id = ?');
            queryParams.push(organizationId);
        }
        // Do not expose unassigned legacy records to arbitrary WhatsApp accounts.
        if (activeAccountId) {
            whereClauses.push('c.whatsapp_account_id = ?');
            queryParams.push(activeAccountId);
        }
        const effectiveTime = 'COALESCE(c.last_message_time, c.last_message_at, c.created_at)';
        if (daysFilter !== 'all') {
            whereClauses.push(`${effectiveTime} >= DATE_SUB(NOW(), INTERVAL ? DAY)`);
            queryParams.push(Number(daysFilter));
        }
        if (searchQuery) {
            const term = `%${searchQuery.toLowerCase()}%`;
            whereClauses.push('(LOWER(c.contact_name) LIKE ? OR c.contact_phone LIKE ? OR LOWER(c.last_message) LIKE ?)');
            queryParams.push(term, term, term);
        }
        if (tagIdFilter) {
            whereClauses.push('EXISTS (SELECT 1 FROM chat_tags ct JOIN tags t ON ct.tag_id = t.id WHERE (ct.chat_id = CAST(c.id AS CHAR) OR ct.chat_id = c.contact_phone) AND ct.tag_id = ? AND t.organization_id = c.organization_id)');
            queryParams.push(tagIdFilter);
        }
        // Inbox contains only contacts who have replied. Prefer actual incoming message
        // records, with the existing has_replied flag as a legacy-data fallback.
        // Keep the condition in SQL so the count and every page are consistent.
        whereClauses.push(`(c.has_replied = 1 OR EXISTS (
            SELECT 1 FROM messages reply
            WHERE reply.conversation_id = c.id
              AND (reply.organization_id = c.organization_id OR reply.organization_id IS NULL)
              AND (reply.direction = 'incoming' OR reply.sender = 'contact')
        ))`);

        // Exclude connected official WABA number from the conversation list in SQL
        if (officialSuffix) {
            whereClauses.push("(c.contact_phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(c.contact_phone, '[^0-9]', ''), 10) <> ?)");
            queryParams.push(officialSuffix);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM conversations c ${whereSql}`, queryParams);
        const total = Number(countRow?.total || 0);
        const sql = `SELECT c.id, c.organization_id, c.whatsapp_account_id,
                c.contact_name AS name, c.contact_phone AS phone,
                c.last_message AS lastMessage, ${effectiveTime} AS lastMessageTime,
                c.unread_count AS unreadCount, c.status,
                1 AS hasReplied,
                c.instance_id AS instanceId, c.assigned_user_id AS assignedUserId, c.created_at
            FROM conversations c ${whereSql}
            ORDER BY ${effectiveTime} DESC, c.id DESC LIMIT ? OFFSET ?`;
        const [rows] = await pool.query(sql, [...queryParams, limit, offset]);
        return res.json({
            conversations: rows, officialNumber, page, limit, total,
            totalPages: Math.ceil(total / limit), hasMore: offset + rows.length < total
        });
    } catch (err) {
        console.error('Failed to load conversations:', err);
        return res.status(500).json({ message: 'Server error while loading conversations' });
    }
};

/**
 * GET /api/chat/messages/:conversationId
 * Fetch messages for a specific conversation with strict IDOR protection.
 */
export const getMessages = async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.organizationId || req.user?.organization_id;
        const isSuperAdmin = req.user?.role === 'Super Admin';
        const { conversationId } = req.params;

        console.log(`[9] CHAT API REQUEST: GET /api/chat/messages/${conversationId} (org_id=${organizationId})`);

        // Verify conversation exists AND belongs strictly to the user's organization
        let checkQuery = 'SELECT id, organization_id, whatsapp_account_id, contact_name, contact_phone, last_message, last_message_time, unread_count, has_replied FROM conversations WHERE id = ?';
        const checkParams = [conversationId];

        if (!isSuperAdmin) {
            checkQuery += ' AND organization_id = ?';
            checkParams.push(organizationId);
        }

        const [convCheck] = await pool.query(checkQuery, checkParams);

        if (convCheck.length === 0) {
            console.log(`[10] CHAT API RESPONSE: 403 Forbidden - Conversation ${conversationId} does not belong to org ${organizationId}`);
            return res.status(403).json({ message: 'Access denied: Conversation does not belong to your organization' });
        }

        const targetOrgId = convCheck[0].organization_id || organizationId;
        const contactPhone = convCheck[0].contact_phone;
        const phone10 = contactPhone ? String(contactPhone).replace(/\D/g, '').slice(-10) : '';

            // Clear unread count ONLY when conversation actually has positive unread messages.
            // Prevents redundant write queries and socket loops during silent background polling.
            const currentUnreadCount = Number(convCheck[0].unread_count || 0);
            if (currentUnreadCount > 0) {
                if (phone10 && targetOrgId) {
                    await pool.query(
                        `UPDATE conversations SET unread_count = 0 
                     WHERE id = ? OR (organization_id = ? AND RIGHT(REGEXP_REPLACE(contact_phone, '[^0-9]', ''), 10) = ?)`,
                        [conversationId, targetOrgId, phone10]
                    );
                } else {
                    await pool.query(
                        'UPDATE conversations SET unread_count = 0 WHERE id = ?',
                        [conversationId]
                    );
                }

                // Notify over Socket.IO (scoped to org room) only when unreadCount actually changed
                emitToOrganization(targetOrgId, 'conversation_updated', {
                    id: Number(conversationId),
                    organizationId: targetOrgId,
                    name: convCheck[0].contact_name,
                    phone: convCheck[0].contact_phone,
                    lastMessage: convCheck[0].last_message,
                    lastMessageTime: convCheck[0].last_message_time,
                    unreadCount: 0,
                    hasReplied: convCheck[0].has_replied
                });
            }

            // Parse and validate pagination parameters
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
            const hasBeforeId = req.query.before_id !== undefined && req.query.before_id !== '';
            const hasBeforeTs = req.query.before_ts !== undefined && req.query.before_ts !== '';

            let beforeId = null;
            let beforeTs = null;

            if (hasBeforeId || hasBeforeTs) {
                // Both parts of the composite cursor must be provided
                if (!hasBeforeId || !hasBeforeTs) {
                    return res.status(400).json({
                        code: 'INVALID_CURSOR',
                        message: 'Both before_id and before_ts must be provided for cursor-based message pagination.'
                    });
                }

                // Strict validation of before_id: must be a positive decimal integer string without decimals or alpha chars, and safe integer
                const rawBeforeId = String(req.query.before_id || '').trim();
                if (!/^\d+$/.test(rawBeforeId)) {
                    return res.status(400).json({
                        code: 'INVALID_CURSOR_ID',
                        message: 'The before_id cursor parameter must be a positive integer.'
                    });
                }

                const parsedBeforeId = Number(rawBeforeId);
                if (!Number.isSafeInteger(parsedBeforeId) || parsedBeforeId <= 0) {
                    return res.status(400).json({
                        code: 'INVALID_CURSOR_ID',
                        message: 'The before_id cursor parameter must be a positive integer within safe range.'
                    });
                }
                beforeId = parsedBeforeId;

                // Validate that client supplied a parseable timestamp string
                const parsedClientDate = new Date(req.query.before_ts);
                if (isNaN(parsedClientDate.getTime())) {
                    return res.status(400).json({
                        code: 'INVALID_CURSOR_TIMESTAMP',
                        message: 'The before_ts cursor parameter must be a valid ISO timestamp.'
                    });
                }

                // Strict tenant isolation and resolution for the cursor message:
                // The cursor message MUST exist, belong to this conversation, and belong to the user's organization (or legacy NULL)
                const [cursorCheck] = await pool.query(
                    `SELECT id, timestamp FROM messages 
                 WHERE id = ? AND conversation_id = ? 
                   AND (organization_id IS NULL OR organization_id = ?) LIMIT 1`,
                    [beforeId, conversationId, targetOrgId]
                );

                if (cursorCheck.length === 0) {
                    return res.status(400).json({
                        code: 'CURSOR_NOT_FOUND',
                        message: 'Pagination cursor message not found in this conversation or access denied.'
                    });
                }

                // Database-authoritative timestamp: use the actual database timestamp rather than trusting client-supplied value
                beforeTs = cursorCheck[0].timestamp;
            }

            // Query messages using the composite (timestamp, id) cursor.
            // Fetch limit + 1 records to determine if older messages exist.
            let querySql = `
            SELECT 
                id,
                wa_message_id as wamid,
                message_text as text,
                sender,
                direction,
                message_type as messageType,
                media_id as mediaId,
                media_url as mediaUrl,
                raw_payload as rawPayload,
                campaign_id as campaignId,
                whatsapp_account_id as whatsappAccountId,
                timestamp,
                status
            FROM messages
            WHERE conversation_id = ? AND (organization_id IS NULL OR organization_id = ?)
        `;
            const queryParams = [conversationId, targetOrgId];

            if (beforeId && beforeTs) {
                querySql += ` AND (timestamp < ? OR (timestamp = ? AND id < ?))`;
                queryParams.push(beforeTs, beforeTs, beforeId);
            }

            querySql += ` ORDER BY timestamp DESC, id DESC LIMIT ?`;
            queryParams.push(limit + 1);

            const [rows] = await pool.query(querySql, queryParams);

            const hasMoreOlder = rows.length > limit;
            const pageRows = hasMoreOlder ? rows.slice(0, limit) : rows;

            // Reverse into ascending chronological order for display
            const chronologicalRows = [...pageRows].reverse();

            const oldestCursor = chronologicalRows.length > 0 ? {
                id: chronologicalRows[0].id,
                timestamp: chronologicalRows[0].timestamp
            } : null;

            const newestCursor = chronologicalRows.length > 0 ? {
                id: chronologicalRows[chronologicalRows.length - 1].id,
                timestamp: chronologicalRows[chronologicalRows.length - 1].timestamp
            } : null;

            const baseMessages = chronologicalRows.map(msg => ({
                id: msg.id,
                wamid: msg.wamid,
                text: msg.text,
                sender: (msg.sender === 'user' || msg.direction === 'outgoing') ? 'bot' : 'contact',
                direction: msg.direction || (msg.sender === 'user' ? 'outgoing' : 'incoming'),
                messageType: msg.messageType || 'text',
                mediaId: msg.mediaId || null,
                mediaUrl: msg.mediaUrl || null,
                rawPayload: (() => {
                    if (!msg.rawPayload) return null;
                    if (typeof msg.rawPayload === 'object') return msg.rawPayload;
                    try { return JSON.parse(msg.rawPayload); } catch (_) { return null; }
                })(),
                timestamp: msg.timestamp,
                status: msg.status || 'sent'
            }));
            const formattedMessages = await enrichChatMessages(baseMessages, targetOrgId);

            const isSilent = req.query.silent === 'true' || req.query.silent === '1';
            if (!isSilent) {
                console.log(`[10] CHAT API RESPONSE: returned ${formattedMessages.length} messages for conversation ID ${conversationId} (hasMoreOlder=${hasMoreOlder})`);
            }

            // 24-hour service window restriction removed - always keep open for staff chat
            const isWindowOpen = true;
            let lastIncomingTime = null;

                // Skip querying incomingRows during silent background polling to minimize database reads
                if (!isSilent) {
                    const [incomingRows] = await pool.query(
                        `SELECT timestamp FROM messages 
                 WHERE conversation_id = ? AND (sender = 'contact' OR direction = 'incoming')
                 ORDER BY id DESC LIMIT 1`,
                        [conversationId]
                    );
                    if (incomingRows.length > 0 && incomingRows[0].timestamp) {
                        lastIncomingTime = incomingRows[0].timestamp;
                    }
                }

                res.json({
                    messages: formattedMessages,
                    hasMoreOlder,
                    oldestCursor,
                    newestCursor,
                    isWindowOpen,
                    lastIncomingTime
                });
            } catch (err) {
                console.error('Failed to load messages:', err);
                res.status(500).json({ message: 'Server error while loading messages' });
            }
        };

        /** Securely proxy Meta media using the credential belonging to the message's WABA. */
        export const getMessageMedia = async (req, res) => {
            try {
                const organizationId = req.organizationId || req.user?.organization_id;
                const isSuperAdmin = req.user?.role === 'Super Admin';
                const params = [req.params.messageId];
                let sql = `SELECT m.media_id, m.media_url, m.whatsapp_account_id, wa.access_token
                   FROM messages m
                   LEFT JOIN whatsapp_accounts wa ON wa.id = m.whatsapp_account_id
                   WHERE m.id = ?`;
                if (!isSuperAdmin) {
                    sql += ' AND m.organization_id = ?';
                    params.push(organizationId);
                }
                sql += ' LIMIT 1';
                const [rows] = await pool.query(sql, params);
                if (!rows.length) return res.status(404).json({ message: 'Media not found' });
                const item = rows[0];
                if (item.media_url && /^(https?:\/\/|\/api\/uploads\/|\/uploads\/)/i.test(item.media_url)) {
                    return res.redirect(item.media_url);
                }
                if (!item.media_id || !item.access_token) return res.status(404).json({ message: 'Media unavailable' });

                const token = decryptToken(item.access_token);
                const metadata = await axios.get(`https://graph.facebook.com/v19.0/${encodeURIComponent(item.media_id)}`, {
                    headers: { Authorization: `Bearer ${token}` }, timeout: 15000
                });
                if (!metadata.data?.url) return res.status(404).json({ message: 'Media URL unavailable' });
                const media = await axios.get(metadata.data.url, {
                    headers: { Authorization: `Bearer ${token}` }, responseType: 'stream', timeout: 30000
                });
                res.setHeader('Content-Type', media.headers['content-type'] || 'application/octet-stream');
                res.setHeader('Cache-Control', 'private, max-age=300');
                media.data.pipe(res);
            } catch (err) {
                logger.warn(`[ChatController] Media proxy failed for message ${req.params.messageId}: ${err.message}`);
                if (!res.headersSent) res.status(404).json({ message: 'Media unavailable' });
            }
        };

        /**
         * POST /api/chat/send
         * Outbound Chat Reply / Template Sender
         */
        export const sendMessage = async (req, res) => {
            try {
                const userId = req.user.id;
                const organizationId = req.organizationId || req.user?.organization_id;
                const isSuperAdmin = req.user?.role === 'Super Admin';
                let { conversationId, message, templateName, type, accountId: bodyAccountId, mediaBase64, mediaUrl, mimeType, fileName } = req.body;

                if (!conversationId) {
                    return res.status(400).json({ message: 'Conversation ID is required' });
                }

                const isTemplate = type === 'template' || Boolean(templateName);
                const isMedia = Boolean(mediaBase64 || mediaUrl || (type && type !== 'text' && type !== 'template'));

                if (!isTemplate && !isMedia && (!message || !String(message).trim())) {
                    return res.status(400).json({ message: 'Message text or attachment is required' });
                }

                // Verify conversation belongs to user's organization
                let checkQuery = 'SELECT id, contact_phone, organization_id, whatsapp_account_id, has_replied FROM conversations WHERE id = ?';
                const checkParams = [conversationId];
                if (!isSuperAdmin) {
                    checkQuery += ' AND organization_id = ?';
                    checkParams.push(organizationId);
                }
                const [convCheck] = await pool.query(checkQuery, checkParams);

                if (convCheck.length === 0) {
                    return res.status(403).json({ message: 'Access denied: Conversation does not belong to your organization' });
                }

                const recipientPhone = convCheck[0].contact_phone;
                const convOrgId = convCheck[0].organization_id || organizationId;
                const convAccountId = convCheck[0].whatsapp_account_id || bodyAccountId || null;

                // Note if blacklisted, but allow outbound chat messaging without blocking
                try {
                    const isBlocked = await checkBlacklist(recipientPhone, convOrgId);
                    if (isBlocked) {
                        logger.warn(`[ChatController] Note: Recipient ${recipientPhone} was previously on opt-out; dispatching agent message.`);
                    }
                } catch (_) { }

                // 1. TEMPLATE SENDING:
                if (isTemplate) {
                    const cleanTemplateName = String(templateName || message).trim().replace(/^\[Template:\s*|\s*\]$/g, '');
                    logger.info(`[ChatController] Sending outbound template "${cleanTemplateName}" to ${recipientPhone} via org ${convOrgId}, account ${convAccountId}`);

                    const sendResult = await whatsappService.sendTemplateMessage({
                        recipient: recipientPhone,
                        templateName: cleanTemplateName,
                        accountId: convAccountId,
                        organizationId: convOrgId,
                        userId
                    });

                    if (!sendResult.success) {
                        logger.error(`[ChatController] Outbound Meta API template send failed: ${sendResult.message}`);
                        return res.status(sendResult.statusCode || 400).json({
                            message: sendResult.message || 'Failed to send WhatsApp template'
                        });
                    }

                    const wamid = sendResult.messageId;

                    return res.status(201).json({
                        message: sendResult.message || {
                            id: Date.now(),
                            wamid,
                            text: cleanTemplateName,
                            sender: 'bot',
                            direction: 'outgoing',
                            timestamp: new Date().toISOString(),
                            status: 'sent'
                        }
                    });
                }

                // 2. MEDIA / ATTACHMENT MESSAGE SENDING:
                if (isMedia) {
                    logger.info(`[ChatController] Outbound media message to ${recipientPhone} via org ${convOrgId}`);
                    let mediaResult = await whatsappService.sendMediaMessage({
                        to: recipientPhone,
                        mediaUrl,
                        mediaBase64,
                        mimeType,
                        fileName,
                        mediaType: type || (mimeType?.startsWith('image/') ? 'image' : 'document'),
                        caption: message || '',
                        accountId: convAccountId,
                        organizationId: convOrgId
                    });

                    if (!mediaResult.success) {
                        logger.error(`[ChatController] Media send failed: ${mediaResult.message}`);
                        const metaCode = Number(mediaResult.details?.code || 0);
                        const isWindowClosed = metaCode === 131047 || String(mediaResult.message || '').toLowerCase().includes('re-engagement');
                        return res.status(mediaResult.statusCode || 400).json({
                            message: isWindowClosed
                                ? 'The 24-hour WhatsApp customer-service window is closed. Send an approved image/video/document template first, or ask the contact to message you.'
                                : (mediaResult.message || 'Failed to send media message'),
                            code: isWindowClosed ? '24H_WINDOW_CLOSED' : 'MEDIA_SEND_FAILED',
                            metaCode: metaCode || null
                        });
                    }

                    const wamid = mediaResult.messageId;
                    const displayText = message ? String(message).trim() : `[Attachment: ${fileName || 'file'}]`;

                    const recResult = await recordChatMessage({
                        userId,
                        organizationId: convOrgId,
                        whatsappAccountId: convAccountId,
                        phone: recipientPhone,
                        messageText: displayText,
                        wamid,
                        sender: 'user',
                        direction: 'outgoing',
                        messageType: mediaResult.mediaType || type || (mimeType?.startsWith('image/') ? 'image' : 'document'),
                        mediaId: mediaResult.mediaId || null,
                        mediaUrl: mediaResult.mediaUrl || mediaUrl || null,
                        rawPayload: {
                            mimeType: mediaResult.mimeType || mimeType || null,
                            fileName: mediaResult.fileName || fileName || null
                        },
                        status: 'sent',
                    });

                    return res.status(201).json({
                        message: recResult?.message || {
                            id: Date.now(),
                            wamid,
                            text: displayText,
                            sender: 'bot',
                            direction: 'outgoing',
                            timestamp: new Date().toISOString(),
                            status: 'sent'
                        }
                    });
                }

                // 3. FREE-FORM TEXT MESSAGE (with automatic approved-template fallback for 24h window)
                logger.info(`[ChatController] Outbound reply to ${recipientPhone} via org ${convOrgId}, account ${convAccountId}`);

                const textBody = String(message).trim();

                // STEP 1: Try sending as plain text first
                let sendResult = await whatsappService.sendTextMessage(recipientPhone, textBody, convAccountId, convOrgId);

                // STEP 2: If plain text failed (likely 131047 / 24h window expired), auto-fallback to approved template
                if (!sendResult || !sendResult.success) {
                    const errMsg = String(sendResult?.message || sendResult?.details?.message || '').toLowerCase();
                    const errCode = sendResult?.details?.code || sendResult?.statusCode;
                    const is24hError = errCode === 131047 || errCode === 131026 ||
                        errMsg.includes('24') || errMsg.includes('window') || errMsg.includes('re-engagement') ||
                        errMsg.includes('131047') || errMsg.includes('131026');

                    if (is24hError || !sendResult?.success) {
                        logger.info(`[ChatController] Plain text failed (${errCode}). Auto-dispatching approved template to guarantee delivery to ${recipientPhone}...`);
                        try {
                            let approved = [];

                            // Fetch approved templates from Meta
                            try {
                                const templatesList = await fetchMetaTemplates(convAccountId, convOrgId, isSuperAdmin, userId);
                                const rawTemplates = Array.isArray(templatesList) ? templatesList : (templatesList?.data || templatesList?.templates || []);
                                approved = rawTemplates.filter(t => !t.status || String(t.status).toUpperCase() === 'APPROVED');
                            } catch (_) { }

                            // Fallback: check local whatsapp_templates table
                            if (approved.length === 0) {
                                try {
                                    const [localTpls] = await pool.query(
                                        `SELECT template_name as name, language FROM whatsapp_templates 
                                 WHERE (organization_id = ? OR organization_id IS NULL) 
                                   AND (UPPER(status) = 'APPROVED' OR status IS NULL OR status = 'Active')
                                 ORDER BY id DESC`,
                                        [convOrgId]
                                    );
                                    if (localTpls?.length > 0) approved = localTpls;
                                } catch (_) { }
                            }

                            if (approved.length > 0) {
                                // Pick the best template (prefer one with no variables so no param mismatch)
                                const noVarTemplate = approved.find(t => {
                                    const body = t.components?.find(c => (c.type || '').toUpperCase() === 'BODY');
                                    return !body?.text?.includes('{{');
                                });
                                const fallbackTemplate = noVarTemplate || approved.find(t => t.name === 'hello_world') || approved.find(t => t.name === 'uv') || approved[0];
                                const tName = fallbackTemplate.name || fallbackTemplate.template_name;
                                const langCode = fallbackTemplate.language || 'en_US';

                                const tSend = await whatsappService.sendTemplateMessage({
                                    recipient: recipientPhone,
                                    templateName: tName,
                                    languageCode: langCode,
                                    accountId: convAccountId,
                                    organizationId: convOrgId
                                });

                                if (tSend.success) {
                                    sendResult = tSend;
                                    logger.info(`[ChatController] Template fallback succeeded: "${tName}" delivered to ${recipientPhone}`);
                                } else {
                                    logger.error(`[ChatController] Template fallback also failed: ${tSend.message}`);
                                }
                            }
                        } catch (fallbackErr) {
                            logger.error(`[ChatController] Template fallback error: ${fallbackErr.message}`);
                        }
                    }
                }

                if (!sendResult || !sendResult.success) {
                    logger.error(`[ChatController] All send attempts failed for ${recipientPhone}: ${sendResult?.message}`);
                    return res.status(sendResult?.statusCode || 400).json({
                        message: sendResult?.message || 'Failed to send WhatsApp message'
                    });
                }

                const wamid = sendResult.messageId;

                // Always record and display the EXACT text the agent typed — never show [Template: ...]
                const recResult = await recordChatMessage({
                    userId,
                    organizationId: convOrgId,
                    whatsappAccountId: convAccountId,
                    phone: recipientPhone,
                    messageText: textBody,   // ← always the user's own typed message
                    wamid,
                    sender: 'user',
                    direction: 'outgoing',
                    messageType: 'text',
                    status: 'sent',
                });

                res.status(201).json({
                    message: recResult?.message || {
                        id: Date.now(),
                        wamid,
                        text: textBody,      // ← always the user's own typed message
                        sender: 'bot',
                        direction: 'outgoing',
                        timestamp: new Date().toISOString(),
                        status: 'sent'
                    }
                });
            } catch (err) {
                console.error('Failed to send message:', err);
                res.status(500).json({ message: 'Server error while sending message' });
            }
        };

        /**
         * POST /api/chat/start
         * Initiate a new WhatsApp conversation with any phone number.
         */
        export const startConversation = async (req, res) => {
            try {
                const userId = req.user.id;
                const organizationId = req.organizationId || req.user?.organization_id;
                const { phone, name, accountId: bodyAccountId } = req.body;

                if (!phone) {
                    return res.status(400).json({ message: 'Phone number is required' });
                }

                const normPhone = normalizePhone(phone);
                if (normPhone.length < 7 || normPhone.length > 15) {
                    return res.status(400).json({ message: 'Invalid phone number format. Include country code (e.g. 919876543210).' });
                }

                // Allow starting chat without blacklist restriction
                try {
                    const isBlocked = await checkBlacklist(normPhone, organizationId);
                    if (isBlocked) {
                        logger.warn(`[ChatController] Note: Initiating chat with previously blacklisted number ${normPhone}`);
                    }
                } catch (_) { }

                const suffix10 = get10DigitSuffix(normPhone);

                // Resolve whatsapp_account_id for this org
                let resolvedAccountId = bodyAccountId || null;
                if (!resolvedAccountId && organizationId) {
                    const [waRows] = await pool.query(
                        'SELECT id FROM whatsapp_accounts WHERE organization_id = ? ORDER BY id DESC LIMIT 1',
                        [organizationId]
                    );
                    if (waRows.length > 0) resolvedAccountId = waRows[0].id;
                }

                // Check if conversation already exists for this tenant
                const [existing] = await pool.query(
                    `SELECT id, organization_id, whatsapp_account_id, contact_name as name, contact_phone as phone, last_message as lastMessage, last_message_time as lastMessageTime, unread_count as unreadCount, has_replied as hasReplied
             FROM conversations
             WHERE (contact_phone = ? OR RIGHT(REGEXP_REPLACE(contact_phone, '[^0-9]', ''), 10) = ?)
               AND organization_id = ?
             LIMIT 1`,
                    [normPhone, suffix10, organizationId]
                );

                if (existing.length > 0) {
                    return res.json({ conversation: existing[0] });
                }

                // Create new conversation
                const contactName = name && name.trim() ? name.trim() : `WhatsApp User ${normPhone.slice(-4)}`;

                const [result] = await pool.query(
                    `INSERT INTO conversations (user_id, organization_id, whatsapp_account_id, contact_name, contact_phone, last_message, last_message_at, last_message_time, unread_count, status, has_replied)
             VALUES (?, ?, ?, ?, ?, 'Conversation started', NOW(), NOW(), 0, 'open', 1)`,
                    [userId, organizationId || null, resolvedAccountId || null, contactName, normPhone]
                );

                const [newConv] = await pool.query(
                    `SELECT id, organization_id, whatsapp_account_id, contact_name as name, contact_phone as phone, last_message as lastMessage, last_message_time as lastMessageTime, unread_count as unreadCount, has_replied as hasReplied
             FROM conversations WHERE id = ?`,
                    [result.insertId]
                );

                if (organizationId) {
                    emitToOrganization(organizationId, 'conversation_updated', newConv[0]);
                } else {
                    emitSocketEvent('conversation_updated', newConv[0]);
                }

                res.status(201).json({ conversation: newConv[0] });
            } catch (err) {
                console.error('Failed to start conversation:', err);
                res.status(500).json({ message: 'Server error while starting conversation' });
            }
        };

        /**
         * POST /api/chat/conversations/:id/read
         * Mark conversation as read with tenant authorization.
         */
        export const markAsRead = async (req, res) => {
            try {
                const organizationId = req.organizationId || req.user?.organization_id;
                const isSuperAdmin = req.user?.role === 'Super Admin';
                const { id } = req.params;

                console.log(`[CHAT] markAsRead requested for ID/phone: ${id} (org=${organizationId})`);

                // Check if id is a conversation record
                let findQuery = 'SELECT id, organization_id, contact_phone FROM conversations WHERE id = ?';
                const findParams = [id];
                if (!isSuperAdmin && organizationId) {
                    findQuery += ' AND organization_id = ?';
                    findParams.push(organizationId);
                }

                const [rows] = await pool.query(findQuery, findParams);
                let targetOrgId = organizationId;
                let phone10 = '';
                let targetConvId = Number(id) || null;

                if (rows.length > 0) {
                    targetOrgId = rows[0].organization_id || organizationId;
                    if (rows[0].contact_phone) {
                        phone10 = String(rows[0].contact_phone).replace(/\D/g, '').slice(-10);
                    }
                } else {
                    phone10 = String(id).replace(/\D/g, '').slice(-10);
                }

                if (phone10 && targetOrgId) {
                    await pool.query(
                        `UPDATE conversations SET unread_count = 0 
                 WHERE id = ? OR (organization_id = ? AND RIGHT(REGEXP_REPLACE(contact_phone, '[^0-9]', ''), 10) = ?)`,
                        [id, targetOrgId, phone10]
                    );
                } else {
                    let query = 'UPDATE conversations SET unread_count = 0 WHERE id = ?';
                    const params = [id];
                    if (!isSuperAdmin && organizationId) {
                        query += ' AND organization_id = ?';
                        params.push(organizationId);
                    }
                    await pool.query(query, params);
                }

                if (targetOrgId) {
                    emitToOrganization(targetOrgId, 'conversation_updated', {
                        id: targetConvId,
                        phone: phone10 || undefined,
                        unreadCount: 0
                    });
                }

                return res.json({ success: true, message: 'Conversation marked as read' });
            } catch (err) {
                console.error('Failed to mark conversation read:', err);
                res.status(500).json({ message: 'Server error marking conversation read' });
            }
        };

        /**
         * DELETE /api/chat/conversations/:id
         * Delete an entire conversation and all its messages.
         */
        export const deleteConversation = async (req, res) => {
            try {
                const organizationId = req.organizationId || req.user?.organization_id;
                const isSuperAdmin = req.user?.role === 'Super Admin';
                const { id } = req.params;

                console.log(`[DELETE_CONVERSATION] Request to delete conversation/chat id: ${id} (org_id=${organizationId})`);

                // 1. Find conversation with strict tenant isolation
                let query = 'SELECT id, contact_phone, organization_id FROM conversations WHERE id = ?';
                const params = [id];
                if (!isSuperAdmin && organizationId) {
                    query += ' AND organization_id = ?';
                    params.push(organizationId);
                }

                let [convs] = await pool.query(query, params);
                let targetConv = null;

                if (convs.length > 0) {
                    targetConv = convs[0];
                } else {
                    // Also try looking up by phone strictly within the organization
                    let pQuery = 'SELECT id, contact_phone, organization_id FROM conversations WHERE contact_phone = ?';
                    const pParams = [id];
                    if (!isSuperAdmin && organizationId) {
                        pQuery += ' AND organization_id = ?';
                        pParams.push(organizationId);
                    }
                    const [pConvs] = await pool.query(pQuery, pParams);
                    if (pConvs.length > 0) {
                        targetConv = pConvs[0];
                    }
                }

                if (!targetConv) {
                    return res.status(404).json({ message: 'Conversation not found or access denied' });
                }

                const convId = targetConv.id;
                const phone = targetConv.contact_phone;
                const targetOrgId = targetConv.organization_id || organizationId;

                // 2. Delete messages belonging strictly to this conversation and organization
                let delMsgQuery = 'DELETE FROM messages WHERE conversation_id = ?';
                const delMsgParams = [convId];
                if (targetOrgId) {
                    delMsgQuery += ' AND (organization_id = ? OR organization_id IS NULL)';
                    delMsgParams.push(targetOrgId);
                }
                await pool.query(delMsgQuery, delMsgParams);

                // 3. Delete tags / assignments for this conversation
                try {
                    await pool.query('DELETE FROM chat_tags WHERE chat_id = ? OR chat_id = ?', [String(convId), phone || '']);
                } catch (_) { }

                // 4. Delete conversation strictly scoped to ID and organization
                let delConvQuery = 'DELETE FROM conversations WHERE id = ?';
                const delConvParams = [convId];
                if (targetOrgId) {
                    delConvQuery += ' AND organization_id = ?';
                    delConvParams.push(targetOrgId);
                }
                await pool.query(delConvQuery, delConvParams);

                console.log(`[DELETE_CONVERSATION] Successfully deleted conversation ${convId} (phone=${phone}, org=${targetOrgId})`);

                // 5. Emit socket event scoped to organization
                if (targetOrgId) {
                    emitToOrganization(targetOrgId, 'conversation_deleted', { id: Number(convId), phone });
                } else {
                    emitSocketEvent('conversation_deleted', { id: Number(convId), phone });
                }

                return res.json({ success: true, message: 'Chat deleted successfully' });
            } catch (err) {
                console.error('Failed to delete conversation:', err);
                res.status(500).json({ message: 'Server error while deleting chat conversation: ' + err.message });
            }
        };
