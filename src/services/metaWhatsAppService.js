// ─────────────────────────────────────────────────────────────────────────────
// src/services/metaWhatsAppService.js
// Handles Bulk Campaign Sending and fetching Templates with strict tenant isolation.
//
// NOTE (audit result — no changes made):
// This file was reviewed as part of a debugging chain for two bugs:
//   1) Dashboard requiring 2 refreshes after login to load
//   2) "Dispatched" count not correcting to "Failed" after an async
//      WhatsApp/Meta delivery failure on the Quick Broadcast page
//
// Neither bug originates here. This file is a thin pass-through wrapper:
// sendCampaignTemplate() simply forwards campaignData to
// sendCentralCampaignBatch() in templateMessageSenderService.js, which
// already correctly builds the Meta payload, sends it, and returns
// success/failure per recipient based on Meta's synchronous API response.
//
// The actual root causes were:
//   Bug 1 -> context/LoadingContext.jsx + services/api.js
//            (loading-counter could desync and never reach zero)
//   Bug 2 -> pages/SendQuick.jsx
//            (socket joined room "organization:1" via a hardcoded
//             fallback because localStorage 'org_id' was never set,
//             so the real-time webhook "failed" status update from
//             webhookController.js never reached the browser for any
//             organization other than ID 1)
//
// This file is left unmodified.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import whatsappConfig from '../config/whatsapp.js';
import { deductMessageCredit } from './creditService.js';
import logger from '../utils/logger.js';
import { pool } from '../config/db.js';
import { recordChatMessage } from './chatService.js';
import { decryptToken } from '../utils/encryption.js';
import { fetchMetaTemplates, getTemplateDetails } from './templateService.js';
import { checkBlacklist } from './blacklistService.js';
import { sendCentralCampaignBatch } from './templateMessageSenderService.js';

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

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
    logger.warn('[MetaService] Upload media to Meta warning:', err.response?.data || err.message);
    return null;
  }
}

const buildDynamicComponents = (metaTemplate, headerMediaParam = null) => {
  const payloadComponents = [];
  if (!metaTemplate || !metaTemplate.components) return [];

  metaTemplate.components.forEach(comp => {
    if (comp.type === 'HEADER') {
      if (comp.format === 'IMAGE') {
        const imageTarget = headerMediaParam || comp.example?.header_handle?.[0] || comp.example?.header_url?.[0];
        if (imageTarget && (String(imageTarget).startsWith('http://') || String(imageTarget).startsWith('https://'))) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: imageTarget } }]
          });
        } else if (imageTarget) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: 'image', image: { id: imageTarget } }]
          });
        }
      } else if (comp.format === 'DOCUMENT') {
        const docTarget = headerMediaParam || comp.example?.header_handle?.[0] || comp.example?.header_url?.[0];
        if (docTarget && (String(docTarget).startsWith('http://') || String(docTarget).startsWith('https://'))) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: 'document', document: { link: docTarget } }]
          });
        } else if (docTarget) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: 'document', document: { id: docTarget } }]
          });
        }
      } else if (comp.format === 'VIDEO') {
        const vidTarget = headerMediaParam || comp.example?.header_handle?.[0] || comp.example?.header_url?.[0];
        if (vidTarget && (String(vidTarget).startsWith('http://') || String(vidTarget).startsWith('https://'))) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: 'video', video: { link: vidTarget } }]
          });
        } else if (vidTarget) {
          payloadComponents.push({
            type: 'header',
            parameters: [{ type: 'video', video: { id: vidTarget } }]
          });
        }
      } else if (comp.format === 'TEXT') {
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
    }
  });

  return payloadComponents;
};

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
    timeout: 15_000,
  });
};

/**
 * Fetch approved templates from Meta WhatsApp Cloud API for specific tenant account
 */
export const fetchApprovedTemplates = async (accountId = null, organizationId = null) => {
  try {
    const templates = await fetchMetaTemplates(accountId, organizationId);
    return templates.map(t => ({
      name: t.name,
      language: t.language,
      status: 'APPROVED',
      category: t.category
    }));
  } catch (error) {
    logger.error('[MetaService] Error fetching templates:', error.message);
    return [];
  }
};

/**
 * Send template message to multiple numbers and track in DB using active account credentials.
 */
export const sendCampaignTemplate = async (campaignData) => {
  return await sendCentralCampaignBatch(campaignData);
};