import { fetchMetaTemplates, getTemplateDetails } from '../services/templateService.js';
import whatsappConfig from '../config/whatsapp.js';
import { pool } from '../config/db.js';
import axios from 'axios';
import logger from '../utils/logger.js';

export const getMetaTemplates = async (req, res, next) => {
    try {
        const accountId = req.query?.account_id || req.headers?.['x-account-id'] || null;
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const isSuperAdmin = req.user?.role === 'Super Admin';
        const userId = req.user?.id || null;
        const templates = await fetchMetaTemplates(accountId, organizationId, isSuperAdmin, userId);
        return res.status(200).json(templates);
    } catch (error) {
        logger.error('[MetaTemplateController] Error:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

export const getMetaTemplateByName = async (req, res, next) => {
    const { name } = req.params;
    try {
        const organizationId = req.organizationId || req.user?.organization_id || null;
        const accountId = req.query?.account_id || req.headers?.['x-account-id'] || null;
        const isSuperAdmin = req.user?.role === 'Super Admin';
        const userId = req.user?.id || null;
        // First try to find it in the approved list (includes components and enriched media)
        const allTemplates = await fetchMetaTemplates(accountId, organizationId, isSuperAdmin, userId);
        let found = allTemplates.find(t => t.name === name || (t.name && t.name.toLowerCase() === (name || '').toLowerCase()));
        if (found) {
            const isCarousel = (found.components || []).some(c => (c.type || '').toUpperCase() === 'CAROUSEL') ||
                String(found.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(found.cards) && found.cards.length > 0);

            if (isCarousel) {
                found.header_media_url = null;
                found.meta_header_handle = null;
            }
            return res.status(200).json(found);
        }

        return res.status(404).json({ success: false, message: 'Template not found' });
    } catch (error) {
        logger.error('[MetaTemplateController] Error fetching template by name:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * GET /api/meta/business-number
 * Returns connected WhatsApp Business Phone Number details & metadata from Meta Cloud API
 */
export const getBusinessNumber = async (req, res, next) => {
    try {
        const organizationId = req.organizationId || req.user?.organization_id;
        const requestedAccountId = req.query?.account_id || req.headers?.['x-account-id'] || null;

        let query = 'SELECT verified_name, display_phone_number, phone_number, phone_number_id, waba_id, quality_rating, verification_status FROM whatsapp_accounts';
        const params = [];
        if (requestedAccountId) {
            query += ' WHERE id = ?';
            params.push(requestedAccountId);
            if (organizationId) {
                query += ' AND organization_id = ?';
                params.push(organizationId);
            }
        } else if (organizationId) {
            query += ' WHERE organization_id = ?';
            params.push(organizationId);
        }
        query += ' ORDER BY id DESC LIMIT 1';

        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                connected: false,
                businessName: 'N/A',
                displayPhoneNumber: 'N/A',
                phoneNumber: '',
                qualityRating: 'GREEN',
                status: 'DISCONNECTED',
                phoneNumberId: null,
                wabaId: null
            });
        }

        const acc = rows[0];
        const displayName = acc.verified_name || acc.business_name || 'Official WhatsApp Account';
        const displayPhone = acc.display_phone_number || acc.phone_number || '-';

        return res.status(200).json({
            success: true,
            connected: true,
            businessName: displayName,
            displayPhoneNumber: displayPhone,
            phoneNumber: displayPhone.replace(/[^0-9]/g, ''),
            qualityRating: acc.quality_rating || 'GREEN',
            status: acc.verification_status || 'CONNECTED',
            phoneNumberId: acc.phone_number_id,
            wabaId: acc.waba_id,
            verifyTokenStatus: 'CONFIGURED',
            apiVersion: 'v19.0'
        });
    } catch (error) {
        logger.error('[MetaController] Error fetching business number:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch business number'
        });
    }
};
