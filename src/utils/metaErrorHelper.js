// ─────────────────────────────────────────────────────────────────────────────
// src/utils/metaErrorHelper.js
// Centralized parser and mapper for Meta WhatsApp Cloud API / Webhook errors.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known Meta WhatsApp Cloud API error code explanations.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
const META_ERROR_CODE_MAP = {
  131026: {
    title: 'Message undeliverable',
    explanation: 'The recipient is not registered on WhatsApp, their account is inactive, or they cannot receive messages right now.'
  },
  131047: {
    title: 'Re-engagement message needed',
    explanation: 'More than 24 hours have elapsed since the user last contacted the business. You must use an approved template message to re-open the window.'
  },
  131051: {
    title: 'Unsupported message type',
    explanation: 'The recipient’s WhatsApp client version cannot render this type of message.'
  },
  131052: {
    title: 'Media download failure',
    explanation: 'WhatsApp servers were unable to download media from the provided media URL.'
  },
  131053: {
    title: 'Media upload failure',
    explanation: 'Failed to process or upload media attachment to WhatsApp servers.'
  },
  131045: {
    title: 'Encryption / certificate issue',
    explanation: 'There was a security or certificate handshake error with the recipient’s device.'
  },
  131056: {
    title: 'Pair-rate limit exceeded',
    explanation: 'Too many messages sent to this individual phone number in a short window.'
  },
  130429: {
    title: 'Rate limit hit',
    explanation: 'WhatsApp Cloud API throughput limit exceeded for this business phone number.'
  },
  130472: {
    title: 'User opt-out / blocked',
    explanation: 'The recipient has blocked or opted out of messages from this WhatsApp Business Account.'
  },
  132000: {
    title: 'Template parameter count mismatch',
    explanation: 'The number of variable values provided does not match the placeholders in the approved Meta template.'
  },
  132001: {
    title: 'Template not found or not approved',
    explanation: 'The requested template does not exist or has not been approved in the specified language.'
  },
  132005: {
    title: 'Template parameter character limit exceeded',
    explanation: 'One or more template variable values exceed the maximum allowed character limit.'
  },
  132007: {
    title: 'Template parameter missing or invalid',
    explanation: 'A required template parameter value was left blank or formatted improperly.'
  },
  132012: {
    title: 'Template header media format mismatch',
    explanation: 'The uploaded header media format (image/video/document) does not match the template header definition.'
  },
  133004: {
    title: 'Meta server temporarily unavailable',
    explanation: 'Meta WhatsApp servers are experiencing high load or temporary downtime. Please retry in a few moments.'
  },
  133010: {
    title: 'Phone number not registered',
    explanation: 'The sender phone number is not registered or verified on Meta WhatsApp Cloud API.'
  },
  100: {
    title: 'Invalid parameter',
    explanation: 'One or more fields in the WhatsApp API request payload are invalid or missing.'
  },
  190: {
    title: 'Access token expired / invalid',
    explanation: 'The Meta API System User Access Token has expired or was revoked. Please update your token in Settings.'
  },
  200: {
    title: 'Permission denied',
    explanation: 'The access token does not have sufficient permissions to send messages for this WABA.'
  },
  368: {
    title: 'Temporarily blocked for policy violation',
    explanation: 'The WhatsApp Business Account has been temporarily restricted by Meta due to policy or spam signals.'
  },
  80007: {
    title: 'Rate limit exceeded',
    explanation: 'WhatsApp Business Management API rate limit exceeded. Reduce request frequency.'
  }
};

/**
 * Safely parses any Meta API response error, webhook failure status object,
 * stored JSON string, or generic error into a standardized Meta error object.
 *
 * @param {any} errOrObject
 * @returns {{
 *   code: number|string|null,
 *   subcode: number|string|null,
 *   title: string,
 *   message: string,
 *   details: string|null,
 *   fbtraceId: string|null,
 *   href: string|null,
 *   explanation: string|null
 * }}
 */
export function parseMetaError(errOrObject) {
  if (!errOrObject) return null;

  // If it's a JSON string, attempt parsing
  if (typeof errOrObject === 'string') {
    const trimmed = errOrObject.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseMetaError(parsed);
      } catch (_) {}
    }
  }

  let code = null;
  let subcode = null;
  let title = null;
  let message = null;
  let details = null;
  let fbtraceId = null;
  let href = null;

  // Case 1: Axios Error / HTTP response with response.data.error
  if (errOrObject?.response?.data?.error) {
    const e = errOrObject.response.data.error;
    code = e.code || null;
    subcode = e.error_subcode || null;
    message = e.message || null;
    title = e.error_user_title || (code ? `Meta Error ${code}` : 'API Error');
    details = e.error_data?.details || e.error_user_msg || null;
    fbtraceId = e.fbtrace_id || null;
    href = e.error_data?.href || null;
  }
  // Case 2: Meta error root object { error: { ... } }
  else if (errOrObject?.error && typeof errOrObject.error === 'object') {
    const e = errOrObject.error;
    code = e.code || null;
    subcode = e.error_subcode || null;
    message = e.message || null;
    title = e.error_user_title || (code ? `Meta Error ${code}` : 'API Error');
    details = e.error_data?.details || e.error_user_msg || null;
    fbtraceId = e.fbtrace_id || null;
    href = e.error_data?.href || null;
  }
  // Case 3: Webhook status error array (statusObj.errors)
  else if (errOrObject?.errors && Array.isArray(errOrObject.errors) && errOrObject.errors.length > 0) {
    const e = errOrObject.errors[0];
    code = e.code || null;
    title = e.title || (code ? `Meta Error ${code}` : 'Delivery Failed');
    message = e.message || null;
    details = e.error_data?.details || null;
    href = e.href || null;
  }
  // Case 4: Pre-parsed structured object
  else if (typeof errOrObject === 'object') {
    code = errOrObject.code || errOrObject.error_code || null;
    subcode = errOrObject.subcode || errOrObject.error_subcode || null;
    title = errOrObject.title || errOrObject.error_title || null;
    message = errOrObject.message || errOrObject.error_message || errOrObject.error || null;
    details = errOrObject.details || errOrObject.error_details || null;
    fbtraceId = errOrObject.fbtraceId || errOrObject.error_fbtrace_id || errOrObject.fbtrace_id || null;
    href = errOrObject.href || null;
  }
  // Case 5: Plain string
  else if (typeof errOrObject === 'string') {
    message = errOrObject;
  }

  // If code is present, check knowledge mapping for default title/explanation
  const numCode = Number(code);
  const known = !isNaN(numCode) && META_ERROR_CODE_MAP[numCode] ? META_ERROR_CODE_MAP[numCode] : null;

  if (!title && known) {
    title = known.title;
  }
  const explanation = known?.explanation || (details || message || 'Message could not be delivered by WhatsApp Cloud API.');

  return {
    code: code ? String(code) : null,
    subcode: subcode ? String(subcode) : null,
    title: title || (code ? `Meta Error ${code}` : 'Delivery Failed'),
    message: message || 'Message could not be delivered.',
    details: details || null,
    fbtraceId: fbtraceId || null,
    href: href || null,
    explanation
  };
}

/**
 * Returns a human-friendly string for database logging or quick tooltips.
 */
export function formatMetaErrorSummary(errOrObject) {
  const parsed = parseMetaError(errOrObject);
  if (!parsed) return 'Unknown error';
  const parts = [];
  if (parsed.code) parts.push(`[Meta ${parsed.code}]`);
  if (parsed.title && parsed.title !== `Meta Error ${parsed.code}`) parts.push(parsed.title);
  if (parsed.message) parts.push(parsed.message);
  if (parsed.details && parsed.details !== parsed.message) parts.push(`(${parsed.details})`);
  return parts.join(' - ');
}
