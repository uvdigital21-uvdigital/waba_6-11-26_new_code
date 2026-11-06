import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import whatsappConfig from '../config/whatsapp.js';
import logger from '../utils/logger.js';
import { pool } from '../config/db.js';
import { decryptToken } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory TTL Cache for approved Meta templates (5-minute TTL)
const metaTemplatesCache = new Map();
const templateCache = new Map();
const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const clearMetaTemplatesCache = () => {
    metaTemplatesCache.clear();
    templateCache.clear();
    logger.info('[TemplateService] Meta templates in-memory cache cleared.');
};

/**
 * Fetches all templates from Meta WhatsApp Cloud API for a specific WhatsApp account
 * Returns only APPROVED templates from WABA.
 */
export const fetchMetaTemplates = async (accountId = null, organizationId = null, isSuperAdmin = false, userId = null) => {
    const cacheKey = `${accountId || 'def'}_${organizationId || 'org'}_${isSuperAdmin ? 'sa' : 'user'}_${userId || '0'}`;
    const cached = metaTemplatesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < TEMPLATE_CACHE_TTL_MS)) {
        return cached.data;
    }
    let targetWabaId = null;
    let targetToken = null;
    let hasAccountRecord = false;
    const { baseUrl, apiVersion, businessAccountId, accessToken } = whatsappConfig;

    try {
        let rows = [];
        if (accountId) {
            let query = 'SELECT waba_id, access_token FROM whatsapp_accounts WHERE id = ?';
            const params = [accountId];
            if (organizationId && !isSuperAdmin) {
                query += ' AND organization_id = ?';
                params.push(organizationId);
            }
            const [accRows] = await pool.query(query, params);
            rows = accRows;
        } else if (organizationId && !isSuperAdmin) {
            const [accRows] = await pool.query(
                'SELECT waba_id, access_token FROM whatsapp_accounts WHERE organization_id = ? ORDER BY id DESC LIMIT 1',
                [organizationId]
            );
            rows = accRows;
        } else if (userId && !isSuperAdmin) {
            const [accRows] = await pool.query(
                'SELECT waba_id, access_token FROM whatsapp_accounts WHERE user_id = ? ORDER BY id DESC LIMIT 1',
                [userId]
            );
            rows = accRows;
        } else {
            let query = 'SELECT waba_id, access_token FROM whatsapp_accounts';
            const params = [];
            if (organizationId) {
                query += ' WHERE organization_id = ?';
                params.push(organizationId);
            }
            query += ' ORDER BY id DESC LIMIT 1';
            const [accRows] = await pool.query(query, params);
            rows = accRows;
        }

        if (rows.length > 0) {
            hasAccountRecord = true;
            const acc = rows[0];
            targetWabaId = acc.waba_id;
            if (acc.access_token) {
                try {
                    targetToken = decryptToken(acc.access_token);
                } catch (e) {
                    targetToken = null;
                }
            }
        }
    } catch (dbErr) {
        logger.warn(`[TemplateService] Error fetching account credentials:`, dbErr.message);
    }

    // ONLY fallback to server .env credentials IF the user is Super Admin.
    if (!targetWabaId && !hasAccountRecord && isSuperAdmin) {
        targetWabaId = businessAccountId;
        targetToken = accessToken;
    }

    let approvedTemplates = [];

    if (targetWabaId && targetToken) {
        try {
            const endpoint = `${baseUrl}/${apiVersion}/${targetWabaId}/message_templates?limit=250`;
            logger.info(`[TemplateService] Fetching templates from Meta for WABA: ${targetWabaId}`);

            const response = await axios.get(endpoint, {
                headers: {
                    Authorization: `Bearer ${targetToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const allTemplates = response.data?.data || [];
            
            // Look up header_media_url from local DB tables (both whatsapp_templates and templates)
            let mediaMap = new Map();
            const registerMediaInMap = (key, url, handle, id) => {
                if (!key || !url) return;
                const cleanKey = String(key).trim();
                const lowerKey = cleanKey.toLowerCase();
                const mediaObj = { url, handle: handle || null, id: id || null };
                mediaMap.set(cleanKey, mediaObj);
                mediaMap.set(lowerKey, mediaObj);
                if (id) mediaMap.set(String(id), mediaObj);
            };

            const normalizeMediaUrl = (url, handle) => {
                let resolved = url || (handle && typeof handle === 'string' && handle.startsWith('http') ? handle : null);
                if (resolved && typeof resolved === 'string') {
                    resolved = resolved.trim();
                    if (!resolved.startsWith('http') && !resolved.startsWith('blob:') && !resolved.startsWith('data:')) {
                        if (!resolved.startsWith('/')) {
                            resolved = resolved.startsWith('uploads/') ? `/${resolved}` : `/uploads/templates/${resolved}`;
                        }
                    }
                }
                return resolved || null;
            };

            try {
                const [localMediaRows] = await pool.query('SELECT id, meta_template_id, template_name as name, header_media_url, meta_header_handle, meta_response FROM whatsapp_templates');
                localMediaRows.forEach(r => {
                    let resolvedUrl = normalizeMediaUrl(r.header_media_url, r.meta_header_handle);
                    if (!resolvedUrl && r.meta_response) {
                        try {
                            const parsed = typeof r.meta_response === 'string' ? JSON.parse(r.meta_response) : r.meta_response;
                            const hComp = parsed?.components?.find(c => (c.type || '').toUpperCase() === 'HEADER');
                            const exHandle = hComp?.example?.header_handle?.[0] || hComp?.example?.header_url?.[0];
                            if (exHandle && typeof exHandle === 'string' && exHandle.startsWith('http')) {
                                resolvedUrl = exHandle;
                            }
                        } catch (_) {}
                    }
                    if (resolvedUrl) {
                        registerMediaInMap(r.name, resolvedUrl, r.meta_header_handle, r.id);
                        if (r.meta_template_id) registerMediaInMap(String(r.meta_template_id), resolvedUrl, r.meta_header_handle, r.id);
                    }
                });
            } catch (_) {}

            try {
                const [tplRows] = await pool.query('SELECT id, name, header_media_url, meta_header_handle FROM templates WHERE header_media_url IS NOT NULL OR meta_header_handle IS NOT NULL');
                tplRows.forEach(r => {
                    const resolvedUrl = normalizeMediaUrl(r.header_media_url, r.meta_header_handle);
                    if (resolvedUrl) {
                        registerMediaInMap(r.name, resolvedUrl, r.meta_header_handle, r.id);
                    }
                });
            } catch (_) {}

            // Also check template uploads directory for matching files
            try {
                const searchDirs = [
                    path.join(__dirname, '..', '..', 'uploads', 'templates'),
                    path.join(__dirname, '..', '..', '..', 'uploads', 'templates'),
                    path.join(process.cwd(), 'backend', 'uploads', 'templates'),
                    path.join(process.cwd(), 'uploads', 'templates'),
                    path.join(process.cwd(), 'frontend', 'public', 'uploads', 'templates'),
                    path.join(process.cwd(), 'frontend', 'dist', 'uploads', 'templates')
                ];
                for (const tDir of searchDirs) {
                    if (fs.existsSync(tDir)) {
                        const files = fs.readdirSync(tDir);
                        for (const t of allTemplates) {
                            const tLower = (t.name || '').toLowerCase().trim();
                            if (!mediaMap.has(t.name) && !mediaMap.has(tLower) && !mediaMap.has(String(t.id))) {
                                const matched = files.find(f => {
                                    const fLower = f.toLowerCase();
                                    return fLower.startsWith(`template_${tLower}_`) || 
                                           fLower.startsWith(`template_${tLower}.`) || 
                                           fLower.startsWith(`${tLower}.`) ||
                                           fLower.includes(tLower);
                                });
                                if (matched) {
                                    registerMediaInMap(t.name, `/uploads/templates/${matched}`, null, t.id);
                                }
                            }
                        }
                    }
                }
            } catch (_) {}

            approvedTemplates = allTemplates
                .filter(t => t.status === 'APPROVED')
                .map(t => {
                    const tLower = (t.name || '').toLowerCase().trim();
                    const localMedia = mediaMap.get(t.name) || mediaMap.get(tLower) || mediaMap.get(String(t.id));
                    let mediaUrl = localMedia?.url || null;
                    let mediaHandle = localMedia?.handle || null;

                    const components = (t.components || []).map(comp => {
                        const cType = (comp.type || '').toUpperCase();
                        const cFormat = (comp.format || '').toUpperCase();
                        if (cType === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(cFormat)) {
                            const exHandle = comp.example?.header_handle?.[0];
                            const exUrl = comp.example?.header_url?.[0];
                            const metaDirect = (exHandle && typeof exHandle === 'string' && exHandle.startsWith('http')) 
                                ? exHandle 
                                : ((exUrl && typeof exUrl === 'string' && exUrl.startsWith('http')) ? exUrl : null);
                            const finalUrl = mediaUrl || metaDirect || null;
                            if (!mediaUrl && metaDirect) {
                                mediaUrl = metaDirect;
                            }

                            return {
                                ...comp,
                                media_url: finalUrl,
                                header_url: finalUrl
                            };
                        }
                        return comp;
                    });

                    return {
                        id: t.id,
                        name: t.name,
                        language: t.language,
                        category: t.category,
                        header_media_url: mediaUrl,
                        meta_header_handle: mediaHandle,
                        components
                    };
                });

            logger.success(`[TemplateService] Found ${approvedTemplates.length} approved template(s) from Meta for WABA ${targetWabaId}`);
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            logger.error('[TemplateService] Failed to fetch templates from Meta API:', errorMsg);
        }
    }

    if (approvedTemplates.length > 0) {
        metaTemplatesCache.set(cacheKey, { data: approvedTemplates, timestamp: Date.now() });
        return approvedTemplates;
    }

    // Fallback to local database tables specifically for this tenant/user
    if (hasAccountRecord || isSuperAdmin || organizationId || userId) {
        try {
            const combinedTemplates = [];

            // Query whatsapp_templates
            try {
                let dbQuery = "SELECT id, template_name AS name, language, category, body, header, header_media_url, meta_header_handle, media_type, footer, buttons_json FROM whatsapp_templates WHERE status = 'APPROVED'";
                const queryParams = [];
                if (organizationId && !isSuperAdmin) {
                    dbQuery += " AND (user_id IN (SELECT id FROM users WHERE organization_id = ?))";
                    queryParams.push(organizationId);
                } else if (userId && !isSuperAdmin) {
                    dbQuery += " AND user_id = ?";
                    queryParams.push(userId);
                }
                const [dbTemplates] = await pool.query(dbQuery, queryParams);
                if (dbTemplates && dbTemplates.length > 0) {
                    dbTemplates.forEach(t => {
                        const resolvedMedia = t.header_media_url || (t.meta_header_handle && t.meta_header_handle.startsWith('http') ? t.meta_header_handle : null);
                        const hFormat = (t.media_type || (resolvedMedia ? 'IMAGE' : (t.header ? 'TEXT' : null)));
                        combinedTemplates.push({
                            id: String(t.id),
                            name: t.name,
                            language: t.language || 'en_US',
                            category: t.category || 'UTILITY',
                            header_media_url: resolvedMedia,
                            meta_header_handle: t.meta_header_handle || null,
                            components: [
                                ...(hFormat && hFormat !== 'TEXT'
                                    ? [{ type: 'HEADER', format: hFormat, media_url: resolvedMedia, header_url: resolvedMedia }]
                                    : (t.header ? [{ type: 'HEADER', format: 'TEXT', text: t.header }] : [])),
                                { type: 'BODY', text: t.body || '' },
                                ...(t.footer ? [{ type: 'FOOTER', text: t.footer }] : []),
                                ...(t.buttons_json ? [{ type: 'BUTTONS', buttons: typeof t.buttons_json === 'string' ? JSON.parse(t.buttons_json) : t.buttons_json }] : [])
                            ]
                        });
                    });
                }
            } catch (e1) {
                logger.warn('[TemplateService] whatsapp_templates fallback query error:', e1.message);
            }

            // Query templates table
            try {
                let dbQuery2 = "SELECT id, name, language, category, message AS body, header_media_url, meta_header_handle FROM templates WHERE status = 'APPROVED'";
                const queryParams2 = [];
                if (organizationId && !isSuperAdmin) {
                    dbQuery2 += " AND (organization_id = ? OR user_id IN (SELECT id FROM users WHERE organization_id = ?))";
                    queryParams2.push(organizationId, organizationId);
                } else if (userId && !isSuperAdmin) {
                    dbQuery2 += " AND user_id = ?";
                    queryParams2.push(userId);
                }
                const [dbTemplates2] = await pool.query(dbQuery2, queryParams2);
                if (dbTemplates2 && dbTemplates2.length > 0) {
                    dbTemplates2.forEach(t => {
                        if (!combinedTemplates.some(existing => existing.name === t.name)) {
                            const resolvedMedia2 = t.header_media_url || (t.meta_header_handle && t.meta_header_handle.startsWith('http') ? t.meta_header_handle : null);
                            combinedTemplates.push({
                                id: String(t.id),
                                name: t.name,
                                language: t.language || 'en_US',
                                category: t.category || 'UTILITY',
                                header_media_url: resolvedMedia2,
                                meta_header_handle: t.meta_header_handle || null,
                                components: [
                                    ...(resolvedMedia2 ? [{ type: 'HEADER', format: 'IMAGE', media_url: resolvedMedia2, header_url: resolvedMedia2 }] : []),
                                    { type: 'BODY', text: t.body || '' }
                                ]
                            });
                        }
                    });
                }
            } catch (e2) {
                logger.warn('[TemplateService] templates fallback query error:', e2.message);
            }

            if (combinedTemplates.length > 0) {
                metaTemplatesCache.set(cacheKey, { data: combinedTemplates, timestamp: Date.now() });
                return combinedTemplates;
            }
        } catch (dbFallbackErr) {
            logger.warn('[TemplateService] DB Fallback error:', dbFallbackErr.message);
        }
    }

    return [];
};

/**
 * Gets the raw template metadata for a specific template name and language.
 * Uses the org's own WABA credentials (not just admin .env).
 * Uses an in-memory cache to prevent multiple API calls.
 */
export const getTemplateDetails = async (templateName, languageCode = 'en_US', accountId = null, organizationId = null) => {
    // Account ID is part of the key: one organization may own multiple WABAs
    // with templates of the same name but different content/media.
    const cacheKey = `${templateName}_${languageCode}_org:${organizationId || 'none'}_account:${accountId || 'none'}`;
    if (templateCache.has(cacheKey)) {
        return templateCache.get(cacheKey);
    }

    // Try to get WABA credentials from DB for the specific org/account
    let wabaId = null;
    let accessToken = null;

    try {
        let rows = [];
        if (accountId) {
            const [accRows] = await pool.query(
                'SELECT waba_id, access_token FROM whatsapp_accounts WHERE id = ? LIMIT 1',
                [accountId]
            );
            rows = accRows;
        } else if (organizationId) {
            const [accRows] = await pool.query(
                'SELECT waba_id, access_token FROM whatsapp_accounts WHERE organization_id = ? ORDER BY id DESC LIMIT 1',
                [organizationId]
            );
            rows = accRows;
        }

        if (rows.length > 0 && rows[0].waba_id && rows[0].access_token) {
            wabaId = rows[0].waba_id;
            try {
                accessToken = decryptToken(rows[0].access_token);
            } catch (e) {
                accessToken = null;
            }
        }
    } catch (dbErr) {
        // Ignore DB errors and fall through to .env
    }

    // Fall back to .env admin credentials only if no org credentials found
    const { businessAccountId, accessToken: envToken, baseUrl, apiVersion } = whatsappConfig;
    if (!wabaId || !accessToken) {
        wabaId = businessAccountId;
        accessToken = envToken;
    }

    if (!wabaId || !accessToken) {
        throw new Error('Missing WABA credentials to fetch template details');
    }

    try {
        let endpoint = `${baseUrl}/${apiVersion}/${wabaId}/message_templates?name=${templateName}&language=${languageCode}`;

        let response = await axios.get(endpoint, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }).catch(() => null);

        let template = response?.data?.data?.[0];

        // 1. Try querying without language parameter
        if (!template) {
            const fallbackEndpoint = `${baseUrl}/${apiVersion}/${wabaId}/message_templates?name=${templateName}`;
            const fbRes = await axios.get(fallbackEndpoint, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }).catch(() => null);
            template = fbRes?.data?.data?.[0];
        }

        // 2. Try querying other connected WABA accounts in database
        if (!template) {
            try {
                const [allAccs] = await pool.query('SELECT waba_id, access_token FROM whatsapp_accounts WHERE waba_id != ?', [wabaId]);
                for (const acc of allAccs) {
                    if (!acc.access_token) continue;
                    try {
                        const accToken = decryptToken(acc.access_token);
                        const accRes = await axios.get(`${baseUrl}/${apiVersion}/${acc.waba_id}/message_templates?name=${templateName}`, {
                            headers: { Authorization: `Bearer ${accToken}` },
                            timeout: 8000
                        });
                        if (accRes.data?.data?.[0]) {
                            template = accRes.data.data[0];
                            break;
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }

        // 3. Fall back to local database whatsapp_templates record
        if (!template) {
            try {
                const [localRows] = await pool.query('SELECT * FROM whatsapp_templates WHERE template_name = ? ORDER BY id DESC LIMIT 1', [templateName]);
                if (localRows.length > 0) {
                    const row = localRows[0];
                    let parsedMeta = {};
                    try {
                        parsedMeta = typeof row.meta_response === 'string' ? JSON.parse(row.meta_response) : (row.meta_response || {});
                    } catch (_) {}

                    const components = [];
                    if (row.header || row.header_media_url || row.media_type) {
                        const hFormat = (row.media_type || (row.header_media_url ? 'IMAGE' : 'TEXT')).toUpperCase();
                        components.push({
                            type: 'HEADER',
                            format: hFormat,
                            text: row.header || undefined,
                            example: row.header_media_url ? { header_handle: [row.header_media_url] } : undefined
                        });
                    }
                    if (row.body) {
                        components.push({ type: 'BODY', text: row.body });
                    }
                    if (row.footer) {
                        components.push({ type: 'FOOTER', text: row.footer });
                    }
                    if (row.buttons_json) {
                        try {
                            const btns = typeof row.buttons_json === 'string' ? JSON.parse(row.buttons_json) : row.buttons_json;
                            if (Array.isArray(btns) && btns.length > 0) {
                                components.push({ type: 'BUTTONS', buttons: btns });
                            }
                        } catch (_) {}
                    }
                    if (row.template_type === 'carousel' || Array.isArray(parsedMeta.cards)) {
                        const cardsList = parsedMeta.cards || [];
                        components.push({
                            type: 'CAROUSEL',
                            cards: cardsList.map((c, cIdx) => ({
                                components: [
                                    {
                                        type: 'HEADER',
                                        format: (c.mediaType || 'image').toUpperCase(),
                                        example: { header_handle: [c.headerMedia || c.media_url || ''] }
                                    },
                                    {
                                        type: 'BODY',
                                        text: c.body || `Card ${cIdx + 1}`
                                    },
                                    ...(Array.isArray(c.buttons) && c.buttons.length > 0 ? [{ type: 'BUTTONS', buttons: c.buttons }] : [])
                                ]
                            }))
                        });
                    }

                    template = {
                        name: row.template_name,
                        language: row.language || languageCode,
                        category: row.category || 'MARKETING',
                        components: parsedMeta.components || components
                    };
                }
            } catch (_) {}
        }

        if (!template) {
            throw new Error(`Template ${templateName} not found on Meta or local database`);
        }

        templateCache.set(cacheKey, template);
        return template;

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        logger.error(`[TemplateService] Failed to fetch template details for ${templateName}:`, errorMsg);
        throw new Error(errorMsg);
    }
};

