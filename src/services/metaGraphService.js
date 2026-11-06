import axios from 'axios';

/**
 * Verifies Meta WhatsApp Business Account Phone Number details with Meta Graph API.
 * Calls GET https://graph.facebook.com/v23.0/{phone_number_id}
 * 
 * @param {Object} params
 * @param {string} params.phoneNumberId
 * @param {string} params.wabaId
 * @param {string} params.accessToken
 * @returns {Promise<Object>}
 */
export async function verifyMetaCredentials({ phoneNumberId, wabaId, accessToken }) {
  if (!phoneNumberId || !accessToken) {
    throw new Error('Phone Number ID and Access Token are required');
  }

  const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';
  const phoneEndpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,account_mode,name_status`;

  try {
    console.log(`[MetaVerification] Verifying phone number ID: ${phoneNumberId} via Graph API ${GRAPH_API_VERSION}...`);
    
    // 1. Fetch Phone Number details from Meta
    const phoneRes = await axios.get(phoneEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`
      },
      timeout: 10000
    });

    const phoneData = phoneRes.data || {};
    
    // 2. Fetch Business Name from WABA ID if provided
    let businessName = phoneData.verified_name || 'WhatsApp Business Account';
    if (wabaId) {
      try {
        const wabaEndpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}?fields=id,name,currency,timezone_id`;
        const wabaRes = await axios.get(wabaEndpoint, {
          headers: {
            Authorization: `Bearer ${accessToken.trim()}`
          },
          timeout: 8000
        });
        if (wabaRes.data && wabaRes.data.name) {
          businessName = wabaRes.data.name;
        }
      } catch (wabaErr) {
        console.warn(`[MetaVerification] Could not fetch WABA name for ID ${wabaId}:`, wabaErr.message);
      }
    }

    return {
      success: true,
      phoneNumberId: phoneData.id || phoneNumberId,
      displayPhoneNumber: phoneData.display_phone_number || '',
      verifiedName: phoneData.verified_name || businessName || 'WhatsApp Account',
      qualityRating: phoneData.quality_rating || 'GREEN',
      verificationStatus: phoneData.code_verification_status || 'VERIFIED',
      businessName: businessName,
      accountMode: phoneData.account_mode || 'LIVE',
      raw: phoneData
    };

  } catch (err) {
    console.error('[MetaVerification] Graph API Verification Failed:', err.response?.data || err.message);

    let metaErrorMessage = 'Failed to verify Meta WhatsApp details. Please check your credentials.';
    let metaErrorCode = 400;

    if (err.response && err.response.data && err.response.data.error) {
      const errorObj = err.response.data.error;
      metaErrorMessage = `Meta Error (${errorObj.code || 'API_ERROR'}): ${errorObj.message || errorObj.error_user_title || 'Invalid Phone Number ID or Access Token'}`;
      if (errorObj.error_user_msg) {
        metaErrorMessage += ` - ${errorObj.error_user_msg}`;
      }
      metaErrorCode = err.response.status || 400;
    } else if (err.message) {
      metaErrorMessage = `Connection Error: ${err.message}`;
    }

    const error = new Error(metaErrorMessage);
    error.statusCode = metaErrorCode;
    error.metaError = err.response?.data?.error || null;
    throw error;
  }
}
