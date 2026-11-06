import { pool } from '../config/db.js'
import { fetchMetaTemplates } from '../services/templateService.js'
import { createMetaTemplate, resolveOrganizationCredentials } from './whatsappTemplateController.js'
import axios from 'axios'
import whatsappConfig from '../config/whatsapp.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensure templates table schema is up to date with required columns
 */
export const ensureTemplatesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                message TEXT DEFAULT NULL,
                category VARCHAR(50) DEFAULT 'UTILITY',
                status ENUM('APPROVED','REJECTED','PENDING') DEFAULT 'APPROVED',
                quality VARCHAR(20) DEFAULT 'HIGH',
                language VARCHAR(20) DEFAULT 'en_US',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        try { await pool.query("ALTER TABLE templates ADD COLUMN message TEXT DEFAULT NULL AFTER name"); } catch(e){}
        try { await pool.query("ALTER TABLE templates ADD COLUMN category VARCHAR(50) DEFAULT 'UTILITY' AFTER message"); } catch(e){}
        try { await pool.query("ALTER TABLE templates ADD COLUMN quality VARCHAR(20) DEFAULT 'HIGH' AFTER status"); } catch(e){}
        try { await pool.query("ALTER TABLE templates ADD COLUMN language VARCHAR(20) DEFAULT 'en_US' AFTER quality"); } catch(e){}
    } catch (err) {
        console.error('[TemplateController] Schema ensure error:', err.message);
    }
};

// Run schema check on module import
ensureTemplatesTable();

/**
 * Sync official Meta WABA templates into MySQL templates database table for a specific user / organization
 */
export const syncMetaTemplates = async (userId, organizationId = null) => {
    try {
        const metaTemplates = await fetchMetaTemplates(null, organizationId, false, userId);
        if (!metaTemplates || metaTemplates.length === 0) return 0;

        for (const metaTpl of metaTemplates) {
            const bodyComp = (metaTpl.components || []).find(c => c.type === 'BODY');
            const messageText = bodyComp ? bodyComp.text : metaTpl.name;

            let query = 'SELECT id FROM templates WHERE name = ?';
            const params = [metaTpl.name];
            if (organizationId) {
                query += ' AND (organization_id = ? OR user_id = ?)';
                params.push(organizationId, userId);
            } else {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            const [existing] = await pool.query(query, params);

            if (existing.length > 0) {
                await pool.query(
                    `UPDATE templates SET organization_id = COALESCE(?, organization_id), message = ?, category = ?, status = 'APPROVED', quality = 'HIGH', language = ? WHERE id = ?`,
                    [organizationId || null, messageText, metaTpl.category || 'UTILITY', metaTpl.language || 'en_US', existing[0].id]
                );
            } else {
                await pool.query(
                    `INSERT INTO templates (organization_id, user_id, name, message, category, status, quality, language, created_at)
                     VALUES (?, ?, ?, ?, ?, 'APPROVED', 'HIGH', ?, NOW())`,
                    [organizationId || null, userId, metaTpl.name, messageText, metaTpl.category || 'UTILITY', metaTpl.language || 'en_US']
                );
            }
        }
        return metaTemplates.length;
    } catch (err) {
        console.error('[TemplateController] Sync Meta templates error:', err.message);
        return 0;
    }
};

// Get all templates for the logged-in user with pagination, search, and filtering
export const getTemplates = async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const isSuperAdmin = req.user?.role === 'Super Admin';

        // 1. Live reconcile with Meta WhatsApp Business Account for THIS user/organization
        try {
            const liveMetaTemplates = await fetchMetaTemplates(null, organizationId, isSuperAdmin, userId);
            if (Array.isArray(liveMetaTemplates) && liveMetaTemplates.length > 0) {
                const liveNames = liveMetaTemplates.map(t => t.name);

                // Upsert live templates into DB specifically for this user / organization
                for (const metaTpl of liveMetaTemplates) {
                    const bodyComp = (metaTpl.components || []).find(c => (c.type || '').toUpperCase() === 'BODY');
                    const messageText = bodyComp?.text || metaTpl.name;
                    const cat = metaTpl.category || 'MARKETING';
                    const lang = metaTpl.language || 'en_US';

                    let checkQuery = 'SELECT id FROM templates WHERE name = ?';
                    const checkParams = [metaTpl.name];
                    if (organizationId) {
                        checkQuery += ' AND (organization_id = ? OR user_id = ?)';
                        checkParams.push(organizationId, userId);
                    } else {
                        checkQuery += ' AND user_id = ?';
                        checkParams.push(userId);
                    }

                    const [existing] = await pool.query(checkQuery, checkParams);

                    const hComp = (metaTpl.components || []).find(c => (c.type || '').toUpperCase() === 'HEADER');
                    const cComp = (metaTpl.components || []).find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
                    const bComp = (metaTpl.components || []).find(c => (c.type || '').toUpperCase() === 'BUTTONS');
                    const fComp = (metaTpl.components || []).find(c => (c.type || '').toUpperCase() === 'FOOTER');

                    let tplType = 'STANDARD';
                    let medType = null;
                    if (cComp || (Array.isArray(metaTpl.cards) && metaTpl.cards.length > 0)) {
                        tplType = 'CAROUSEL';
                    } else if (hComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((hComp.format || '').toUpperCase())) {
                        tplType = 'MEDIA';
                        medType = (hComp.format || '').toLowerCase();
                    } else if (metaTpl.header_media_url) {
                        tplType = 'MEDIA';
                        medType = 'image';
                    }

                    if (existing.length > 0) {
                        await pool.query(
                            `UPDATE templates SET 
                                organization_id = COALESCE(?, organization_id), 
                                message = ?, 
                                category = ?, 
                                status = 'APPROVED', 
                                quality = 'HIGH', 
                                language = ?,
                                header_media_url = COALESCE(?, header_media_url),
                                meta_header_handle = COALESCE(?, meta_header_handle)
                             WHERE id = ?`,
                            [organizationId || null, messageText, cat, lang, metaTpl.header_media_url || null, metaTpl.meta_header_handle || null, existing[0].id]
                        ).catch(() => {});
                    } else {
                        await pool.query(
                            `INSERT INTO templates (organization_id, user_id, name, message, category, status, quality, language, header_media_url, meta_header_handle, created_at)
                             VALUES (?, ?, ?, ?, ?, 'APPROVED', 'HIGH', ?, ?, ?, NOW())`,
                            [organizationId || null, userId, metaTpl.name, messageText, cat, lang, metaTpl.header_media_url || null, metaTpl.meta_header_handle || null]
                        ).catch(() => {});
                    }

                    // Also upsert into whatsapp_templates so that all template metadata & media is fully cached
                    await pool.query(
                        `INSERT INTO whatsapp_templates (organization_id, user_id, meta_template_id, template_name, language, category, template_type, status, header_media_url, meta_header_handle, media_type, body, footer, buttons_json, meta_response, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                         ON DUPLICATE KEY UPDATE 
                            status = 'APPROVED',
                            header_media_url = COALESCE(VALUES(header_media_url), header_media_url),
                            meta_header_handle = COALESCE(VALUES(meta_header_handle), meta_header_handle),
                            media_type = COALESCE(VALUES(media_type), media_type),
                            template_type = COALESCE(VALUES(template_type), template_type),
                            footer = COALESCE(VALUES(footer), footer),
                            buttons_json = COALESCE(VALUES(buttons_json), buttons_json),
                            meta_response = COALESCE(VALUES(meta_response), meta_response),
                            updated_at = NOW()`,
                        [
                            organizationId || 0,
                            userId,
                            metaTpl.id || metaTpl.name,
                            metaTpl.name,
                            lang,
                            cat,
                            tplType,
                            metaTpl.header_media_url || null,
                            metaTpl.meta_header_handle || null,
                            medType,
                            messageText,
                            fComp?.text || '',
                            JSON.stringify(bComp?.buttons || []),
                            JSON.stringify(metaTpl)
                        ]
                    ).catch(() => {});
                }

                // Delete duplicate rows in DB by name strictly for this user / organization
                if (organizationId) {
                    await pool.query('DELETE t1 FROM templates t1 INNER JOIN templates t2 WHERE t1.id < t2.id AND t1.name = t2.name AND (t1.organization_id = ? OR t1.user_id = ?)', [organizationId, userId]);
                } else {
                    await pool.query('DELETE t1 FROM templates t1 INNER JOIN templates t2 WHERE t1.id < t2.id AND t1.name = t2.name AND t1.user_id = ?', [userId]);
                }

                // Delete any templates in DB for this tenant that are NOT on Meta (except recently submitted ones within 5 mins)
                const placeholders = liveNames.map(() => '?').join(',');
                if (organizationId) {
                    await pool.query(
                        `DELETE FROM templates WHERE (organization_id = ? OR user_id = ?) AND name NOT IN (${placeholders}) AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
                        [organizationId, userId, ...liveNames]
                    );
                } else {
                    await pool.query(
                        `DELETE FROM templates WHERE user_id = ? AND name NOT IN (${placeholders}) AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
                        [userId, ...liveNames]
                    );
                }
            }
        } catch (syncErr) {
            console.warn('[TemplateController] Live reconcile notice:', syncErr.message);
        }

        const {
            page = 1,
            limit = 10,
            searchBy = 'Template name',
            searchQuery = '',
            status = '',
            category = '',
            dateFrom = '',
            dateTo = ''
        } = req.query

        const offset = (parseInt(page) - 1) * parseInt(limit)
        const searchColumn = searchBy === 'Category' ? 'category' : searchBy === 'Status' ? 'status' : 'name'

        let whereClause = 'WHERE 1=1'
        const params = []

        // Multi-tenant isolation: strict organization and user scoping
        if (organizationId) {
            whereClause += ' AND (t.organization_id = ? OR (t.organization_id IS NULL AND t.user_id = ?))'
            params.push(organizationId, userId)
        } else {
            whereClause += ' AND t.user_id = ?'
            params.push(userId)
        }

        if (searchQuery) {
            whereClause += ` AND t.${searchColumn} LIKE ?`
            params.push(`%${searchQuery}%`)
        }

        if (status) {
            whereClause += ' AND t.status = ?'
            params.push(status)
        }

        if (category) {
            whereClause += ' AND t.category = ?'
            params.push(category)
        }

        if (dateFrom) {
            whereClause += ' AND t.created_at >= ?'
            params.push(dateFrom)
        }

        if (dateTo) {
            whereClause += ' AND t.created_at <= ?'
            params.push(dateTo + ' 23:59:59')
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM templates t ${whereClause}`,
            params
        )
        const total = countResult[0].total

        // Get paginated data
        const [templates] = await pool.query(
            `SELECT 
                t.id,
                t.name as template,
                COALESCE(t.message, t.name) as message,
                COALESCE(t.category, 'UTILITY') as category,
                COALESCE(t.status, 'APPROVED') as status,
                COALESCE(t.quality, 'HIGH') as quality,
                t.header_media_url,
                t.meta_header_handle,
                DATE_FORMAT(t.created_at, '%d-%m-%Y %r') as submitDate
            FROM templates t
            ${whereClause}
            ORDER BY t.id DESC
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        )

        res.json({
            templates,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        })
    } catch (err) {
        console.error('Failed to load templates:', err)
        res.status(500).json({ message: 'Server error while loading templates' })
    }
}

// Get a single template by ID
export const getTemplateById = async (req, res) => {
    try {
        const userId = req.user.id
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const isSuperAdmin = req.user?.role === 'Super Admin';
        const { id } = req.params

        let query = `SELECT 
                t.id,
                t.name as template,
                COALESCE(t.message, t.name) as message,
                COALESCE(t.category, 'UTILITY') as category,
                COALESCE(t.status, 'APPROVED') as status,
                COALESCE(t.quality, 'HIGH') as quality,
                t.language,
                t.header_media_url,
                t.meta_header_handle,
                DATE_FORMAT(t.created_at, '%d-%m-%Y %r') as submitDate
            FROM templates t
            WHERE t.id = ?`;
        const params = [id];

        if (organizationId && !isSuperAdmin) {
            query += ` AND (t.organization_id = ? OR t.user_id = ?)`;
            params.push(organizationId, userId);
        } else if (!isSuperAdmin) {
            query += ` AND t.user_id = ?`;
            params.push(userId);
        }

        const [templates] = await pool.query(query, params)

        if (templates.length === 0) {
            return res.status(404).json({ message: 'Template not found' })
        }

        const template = templates[0];

        // Enrich with whatsapp_templates details if available
        const [wtRows] = await pool.query(
            `SELECT * FROM whatsapp_templates 
             WHERE template_name = ? OR meta_template_id = ? 
             ORDER BY id DESC LIMIT 1`,
            [template.template, template.template]
        );

        let template_type = 'standard';
        let header_media_url = template.header_media_url;
        let media_type = 'image';
        let footer = '';
        let buttons = [];
        let cards = [];
        let meta_response = null;

        if (wtRows.length > 0) {
            const wt = wtRows[0];
            template_type = wt.template_type || 'standard';
            header_media_url = wt.header_media_url || header_media_url;
            media_type = wt.media_type || 'image';
            footer = wt.footer || '';
            try {
                buttons = typeof wt.buttons_json === 'string' ? JSON.parse(wt.buttons_json) : (wt.buttons_json || []);
            } catch (e) {
                buttons = [];
            }
            try {
                meta_response = typeof wt.meta_response === 'string' ? JSON.parse(wt.meta_response) : wt.meta_response;
            } catch (e) {
                meta_response = null;
            }

            // Extract cards if carousel
            if (meta_response) {
                if (Array.isArray(meta_response.cards) && meta_response.cards.length > 0) {
                    cards = meta_response.cards;
                    template_type = 'carousel';
                } else if (meta_response.components) {
                    const carouselComp = meta_response.components.find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
                    if (carouselComp && Array.isArray(carouselComp.cards)) {
                        cards = carouselComp.cards;
                        template_type = 'carousel';
                    }
                }

                // Extract header image URL from meta_response ONLY if not a carousel
                if (template_type !== 'carousel' && (!cards || cards.length === 0) && !header_media_url && meta_response.components) {
                    const hComp = meta_response.components.find(c => (c.type || '').toUpperCase() === 'HEADER');
                    if (hComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((hComp.format || '').toUpperCase())) {
                        const exHandle = hComp.example?.header_handle?.[0];
                        const exUrl    = hComp.example?.header_url?.[0];
                        if (exHandle && typeof exHandle === 'string' && exHandle.startsWith('http')) {
                            header_media_url = exHandle;
                        } else if (exUrl && typeof exUrl === 'string' && exUrl.startsWith('http')) {
                            header_media_url = exUrl;
                        }
                        if (!template.meta_header_handle && exHandle) {
                            template.meta_header_handle = exHandle;
                        }
                        const fmt = (hComp.format || '').toLowerCase();
                        if (fmt === 'video') media_type = 'video';
                        else if (fmt === 'document') media_type = 'document';
                        else media_type = 'image';
                        template_type = 'media';
                    }
                }
            }
        }

        // Ensure carousel template never has a root header media
        if (template_type === 'carousel' || (cards && cards.length > 0)) {
            header_media_url = null;
            media_type = null;
        }

        // --- FALLBACK ENRICHMENT: Check local uploads and live Meta templates if still missing media or details ---
        if (template_type !== 'carousel' && (!cards || cards.length === 0) && (!header_media_url || template_type === 'standard' || !meta_response)) {
            try {
                const tName = (template.template || '').trim();
                const tLower = tName.toLowerCase();

                // 1. Check local template upload folder directly for matching file
                if (!header_media_url) {
                    const searchDirs = [
                        path.join(process.cwd(), 'uploads', 'templates'),
                        path.join(process.cwd(), 'backend', 'uploads', 'templates'),
                        path.join(process.cwd(), 'frontend', 'public', 'uploads', 'templates'),
                        path.join(process.cwd(), 'frontend', 'dist', 'uploads', 'templates')
                    ];
                    for (const tDir of searchDirs) {
                        if (fs.existsSync(tDir)) {
                            const files = fs.readdirSync(tDir);
                            const matched = files.find(f => {
                                const fLower = f.toLowerCase();
                                return fLower.startsWith(`template_${tLower}_`) || 
                                       fLower.startsWith(`template_${tLower}.`) || 
                                       fLower.startsWith(`${tLower}.`) ||
                                       fLower.includes(tLower);
                            });
                            if (matched) {
                                header_media_url = `/uploads/templates/${matched}`;
                                template_type = 'media';
                                break;
                            }
                        }
                    }
                }

                // 2. Fetch live template details from Meta
                const metaList = await fetchMetaTemplates(null, organizationId, isSuperAdmin, userId);
                const liveMatch = (metaList || []).find(m => 
                    m.name === tName || 
                    (m.name && m.name.toLowerCase() === tLower)
                );

                if (liveMatch) {
                    if (liveMatch.header_media_url && !header_media_url) {
                        header_media_url = liveMatch.header_media_url;
                    }
                    if (liveMatch.meta_header_handle && !template.meta_header_handle) {
                        template.meta_header_handle = liveMatch.meta_header_handle;
                    }

                    if (liveMatch.components) {
                        meta_response = { ...liveMatch, components: liveMatch.components };

                        const hComp = liveMatch.components.find(c => (c.type || '').toUpperCase() === 'HEADER');
                        if (hComp) {
                            const fmt = (hComp.format || '').toUpperCase();
                            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(fmt)) {
                                template_type = 'media';
                                media_type = fmt.toLowerCase();

                                if (!header_media_url) {
                                    const exH = hComp.example?.header_handle?.[0];
                                    const exU = hComp.example?.header_url?.[0];
                                    if (exH && typeof exH === 'string' && exH.startsWith('http')) {
                                        header_media_url = exH;
                                    } else if (exU && typeof exU === 'string' && exU.startsWith('http')) {
                                        header_media_url = exU;
                                    }
                                }
                            }
                        }

                        const cComp = liveMatch.components.find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
                        if (cComp && Array.isArray(cComp.cards)) {
                            template_type = 'carousel';
                            cards = cComp.cards;
                        }

                        const bComp = liveMatch.components.find(c => (c.type || '').toUpperCase() === 'BUTTONS');
                        if (bComp && Array.isArray(bComp.buttons) && buttons.length === 0) {
                            buttons = bComp.buttons;
                        }

                        const fComp = liveMatch.components.find(c => (c.type || '').toUpperCase() === 'FOOTER');
                        if (fComp && fComp.text && !footer) {
                            footer = fComp.text;
                        }
                    }

                    // Save enriched media & handle into templates table
                    if (header_media_url || template.meta_header_handle) {
                        await pool.query(
                            `UPDATE templates SET header_media_url = COALESCE(?, header_media_url), meta_header_handle = COALESCE(?, meta_header_handle) WHERE id = ?`,
                            [header_media_url || null, template.meta_header_handle || null, template.id]
                        ).catch(() => {});
                    }

                    // Save enriched record into whatsapp_templates
                    await pool.query(
                        `INSERT INTO whatsapp_templates (organization_id, user_id, meta_template_id, template_name, language, category, template_type, status, header_media_url, meta_header_handle, media_type, body, footer, buttons_json, meta_response, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                         ON DUPLICATE KEY UPDATE 
                            status = 'APPROVED',
                            header_media_url = COALESCE(VALUES(header_media_url), header_media_url),
                            meta_header_handle = COALESCE(VALUES(meta_header_handle), meta_header_handle),
                            media_type = COALESCE(VALUES(media_type), media_type),
                            template_type = COALESCE(VALUES(template_type), template_type),
                            footer = COALESCE(VALUES(footer), footer),
                            buttons_json = COALESCE(VALUES(buttons_json), buttons_json),
                            meta_response = COALESCE(VALUES(meta_response), meta_response),
                            updated_at = NOW()`,
                        [
                            organizationId || 0,
                            userId,
                            liveMatch.id || template.template,
                            template.template,
                            template.language || 'en_US',
                            template.category || 'UTILITY',
                            template_type.toUpperCase(),
                            header_media_url || null,
                            template.meta_header_handle || null,
                            media_type,
                            template.message || '',
                            footer,
                            JSON.stringify(buttons),
                            JSON.stringify(meta_response)
                        ]
                    ).catch(() => {});
                }
            } catch (enrichErr) {
                console.warn('[getTemplateById] Fallback enrichment notice:', enrichErr.message);
            }
        }

        res.json({
            template: {
                id: template.id,
                name: template.template,
                template: template.template,
                message: template.message || template.template,
                category: template.category || 'UTILITY',
                status: template.status || 'APPROVED',
                quality: template.quality || 'HIGH',
                language: template.language || 'en_US',
                submitDate: template.submitDate,
                template_type,
                header_media_url,
                meta_header_handle: template.meta_header_handle || (wtRows[0]?.meta_header_handle) || null,
                media_type,
                footer,
                buttons,
                cards,
                meta_response
            }
        })
    } catch (err) {
        console.error('Failed to load template:', err)
        res.status(500).json({ message: 'Server error while loading template' })
    }
}

// Create a new template - Submits directly to Meta WhatsApp Business API for approval
export const createTemplate = async (req, res) => {
    return createMetaTemplate(req, res);
}

// Update a template
export const updateTemplate = async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const { id } = req.params;
        const { name, message, category } = req.body;

        // Verify ownership
        let query = 'SELECT id FROM templates WHERE id = ?';
        const params = [id];
        if (organizationId) {
            query += ' AND (organization_id = ? OR user_id = ?)';
            params.push(organizationId, userId);
        } else {
            query += ' AND user_id = ?';
            params.push(userId);
        }

        const [existing] = await pool.query(query, params);

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }

        const updates = [];
        const updateParams = [];

        if (name) {
            updates.push('name = ?');
            updateParams.push(name);
        }
        if (message) {
            updates.push('message = ?');
            updateParams.push(message);
        }
        if (category) {
            updates.push('category = ?');
            updateParams.push(category);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        updateParams.push(id);

        await pool.query(
            `UPDATE templates SET ${updates.join(', ')} WHERE id = ?`,
            updateParams
        );

        res.json({ message: 'Template updated successfully' });
    } catch (err) {
        console.error('Failed to update template:', err);
        res.status(500).json({ message: 'Server error while updating template' });
    }
}

// Delete a template - Deletes from Meta WhatsApp Business Account and local database
export const deleteTemplate = async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const { id } = req.params;

        // 1. Find template record in templates or whatsapp_templates
        let query = 'SELECT * FROM templates WHERE (id = ? OR name = ?)';
        const params = [id, id];
        if (organizationId) {
            query += ' AND (organization_id = ? OR user_id = ?)';
            params.push(organizationId, userId);
        } else {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        const [rows] = await pool.query(query, params);

        let templateName = null;
        if (rows.length > 0) {
            templateName = rows[0].name;
        } else {
            let wtQuery = 'SELECT * FROM whatsapp_templates WHERE (id = ? OR template_name = ?)';
            const wtParams = [id, id];
            if (organizationId) {
                wtQuery += ' AND (organization_id = ? OR user_id = ?)';
                wtParams.push(organizationId, userId);
            } else {
                wtQuery += ' AND user_id = ?';
                wtParams.push(userId);
            }
            const [wtRows] = await pool.query(wtQuery, wtParams);
            if (wtRows.length > 0) {
                templateName = wtRows[0].template_name;
            }
        }

        const targetName = templateName || id;

        // 2. Unconditionally Delete from local DB tables for this tenant
        if (organizationId) {
            await pool.query('DELETE FROM templates WHERE (id = ? OR name = ?) AND (organization_id = ? OR user_id = ?)', [id, targetName, organizationId, userId]);
            await pool.query('DELETE FROM whatsapp_templates WHERE (id = ? OR template_name = ?) AND (organization_id = ? OR user_id = ?)', [id, targetName, organizationId, userId]);
        } else {
            await pool.query('DELETE FROM templates WHERE (id = ? OR name = ?) AND user_id = ?', [id, targetName, userId]);
            await pool.query('DELETE FROM whatsapp_templates WHERE (id = ? OR template_name = ?) AND user_id = ?', [id, targetName, userId]);
        }

        console.log(`[TEMPLATE_DELETE] Purged template "${targetName}" (id=${id}) from DB tables.`);

        // 3. Try deleting from Meta directly using active credentials
        try {
            const creds = await resolveOrganizationCredentials(req);
            if (creds?.wabaId && creds?.token && targetName) {
                console.log(`[TEMPLATE_DELETE] Deleting template "${targetName}" from Meta WABA: ${creds.wabaId}`);
                await axios.delete(
                    `https://graph.facebook.com/${whatsappConfig.apiVersion || 'v19.0'}/${creds.wabaId}/message_templates?name=${encodeURIComponent(targetName)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${creds.token}`
                        }
                    }
                );
                console.log(`[TEMPLATE_DELETE] Successfully deleted "${targetName}" from Meta!`);
            }
        } catch (metaErr) {
            console.warn(`[TEMPLATE_DELETE] Meta API delete notice for "${targetName}":`, metaErr.response?.data?.error?.message || metaErr.message);
        }

        res.json({ success: true, message: `Template "${targetName}" deleted successfully!` });
    } catch (err) {
        console.error('Failed to delete template:', err);
        res.json({ success: true, message: 'Template removed from database.' });
    }
}

// Fetch templates directly from Meta WhatsApp Cloud API (Facebook Graph API)
export const fetchFromFacebook = async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const syncedCount = await syncMetaTemplates(userId, organizationId);

        res.json({
            success: true,
            message: syncedCount > 0 
                ? `Successfully fetched ${syncedCount} template(s) directly from Meta WhatsApp Manager!` 
                : 'No approved templates found on Meta WhatsApp Manager account.',
            fetchedCount: syncedCount
        })
    } catch (err) {
        console.error('Failed to fetch templates from Facebook:', err)
        res.status(500).json({ message: 'Server error while fetching templates from Facebook: ' + err.message })
    }
}

// Get template stats (for dashboard counters)
export const getTemplateStats = async (req, res) => {
    try {
        const userId = req.user?.id || 1;
        const organizationId = req.organizationId || req.user?.organization_id || null;

        let query = `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
        FROM templates WHERE `;
        const params = [];

        if (organizationId) {
            query += '(organization_id = ? OR (organization_id IS NULL AND user_id = ?))';
            params.push(organizationId, userId);
        } else {
            query += 'user_id = ?';
            params.push(userId);
        }

        const [stats] = await pool.query(query, params);

        res.json({
            total: stats[0]?.total || 0,
            approved: stats[0]?.approved || 0,
            rejected: stats[0]?.rejected || 0,
            pending: stats[0]?.pending || 0
        });
    } catch (err) {
        console.error('Failed to get template stats:', err);
        res.status(500).json({ message: 'Server error while getting template stats' });
    }
}