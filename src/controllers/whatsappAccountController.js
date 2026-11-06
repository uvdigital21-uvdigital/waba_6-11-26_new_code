import { pool } from '../config/db.js';
import { verifyMetaCredentials } from '../services/metaGraphService.js';
import { encryptToken, maskToken } from '../utils/encryption.js';
import { provisionDefaultTenantData } from '../services/tenantProvisioningService.js';

const GRAPH_VERSION = 'v23.0';

/**
 * POST /api/whatsapp/connect (or /api/whatsapp-accounts/connect)
 * Connects and verifies a WhatsApp Official API Number with Meta Graph API.
 *
 * Supports TWO input modes, fully backward-compatible:
 *   1. MANUAL: { phone_number_id, access_token, waba_id? }
 *      -> Used by the "+ Add WhatsApp Number" modal. Works exactly as before.
 *   2. EMBEDDED SIGNUP: { code, phone_number_id?, waba_id? }
 *      -> Used by the "Login with Facebook" button. The server exchanges the
 *         `code` for an access_token, upgrades it to long-lived, and
 *         auto-resolves waba_id/phone_number_id from Graph API if the
 *         frontend didn't already capture them from the postMessage events.
 */
export async function connectWhatsAppAccount(req, res) {
  try {
    let { phone_number, phone_number_id, waba_id, access_token, code } = req.body;
    const userId = req.user ? req.user.id : 1;
    const organizationId = req.organizationId || req.user?.organization_id || 1;

    // ---------------------------------------------------------------------
    // STEP 1: Embedded Signup flow — exchange `code` for an access_token.
    // Only runs when a code is present and no access_token was already sent
    // (manual token flow always sends access_token directly, so this is
    // skipped entirely for that path).
    // ---------------------------------------------------------------------
    if (code && !access_token) {
      const appId = process.env.APP_ID;
      const appSecret = process.env.APP_SECRET;

      if (!appId || !appSecret) {
        console.error('[WAConnect] Missing APP_ID / APP_SECRET in server environment.');
        return res.status(500).json({
          success: false,
          message: 'Server is not configured with Meta APP_ID/APP_SECRET. Contact support.'
        });
      }

      try {
        const exchangeUrl =
          `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
          `?client_id=${encodeURIComponent(appId)}` +
          `&client_secret=${encodeURIComponent(appSecret)}` +
          `&code=${encodeURIComponent(code)}`;

        const exchangeResp = await fetch(exchangeUrl);
        const exchangeData = await exchangeResp.json();

        if (!exchangeResp.ok || !exchangeData.access_token) {
          console.error('[WAConnect] Code exchange failed:', exchangeData);
          return res.status(400).json({
            success: false,
            message: exchangeData?.error?.message || 'Failed to exchange authorization code for an access token.',
            metaError: exchangeData?.error || null
          });
        }

        access_token = exchangeData.access_token;
        console.log('[WAConnect] ✅ Authorization code exchanged for a short-lived access token.');

        // Try upgrading to a long-lived (60-day) token — non-fatal if it fails.
        try {
          const longLivedUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
            `?grant_type=fb_exchange_token` +
            `&client_id=${encodeURIComponent(appId)}` +
            `&client_secret=${encodeURIComponent(appSecret)}` +
            `&fb_exchange_token=${encodeURIComponent(access_token)}`;

          const longResp = await fetch(longLivedUrl);
          const longData = await longResp.json();

          if (longResp.ok && longData.access_token) {
            access_token = longData.access_token;
            console.log('[WAConnect] ✅ Upgraded to a long-lived access token.');
          } else {
            console.warn('[WAConnect] Long-lived token upgrade skipped:', longData?.error?.message || 'unknown reason');
          }
        } catch (longErr) {
          console.warn('[WAConnect] Long-lived token upgrade failed (continuing with short-lived token):', longErr.message);
        }
      } catch (exchErr) {
        console.error('[WAConnect] Code exchange request error:', exchErr);
        return res.status(400).json({
          success: false,
          message: 'Failed to reach Meta to exchange the authorization code. Please try again.'
        });
      }
    }

    // ---------------------------------------------------------------------
    // STEP 2: Auto-resolve waba_id / phone_number_id from Meta Graph API if
    // still missing (common when Embedded Signup postMessage session events
    // were not captured by the frontend). Skipped entirely for manual flow
    // since both values are already provided there.
    // ---------------------------------------------------------------------
    if (access_token && (!waba_id || !phone_number_id)) {
      try {
        if (!waba_id) {
          const businessesUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/me/businesses` +
            `?fields=id,name&access_token=${encodeURIComponent(access_token)}`;
          const bizResp = await fetch(businessesUrl);
          const bizData = await bizResp.json();

          if (bizResp.ok && Array.isArray(bizData.data)) {
            for (const biz of bizData.data) {
              const wabaListUrl =
                `https://graph.facebook.com/${GRAPH_VERSION}/${biz.id}/owned_whatsapp_business_accounts` +
                `?access_token=${encodeURIComponent(access_token)}`;
              const wabaResp = await fetch(wabaListUrl);
              const wabaData = await wabaResp.json();

              if (wabaResp.ok && Array.isArray(wabaData.data) && wabaData.data.length > 0) {
                waba_id = wabaData.data[0].id;
                break;
              }
            }
          } else {
            console.warn('[WAConnect] Could not list businesses for token:', bizData?.error?.message);
          }
        }

        if (waba_id && !phone_number_id) {
          const phoneListUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/${waba_id}/phone_numbers` +
            `?access_token=${encodeURIComponent(access_token)}`;
          const phoneResp = await fetch(phoneListUrl);
          const phoneData = await phoneResp.json();

          if (phoneResp.ok && Array.isArray(phoneData.data) && phoneData.data.length > 0) {
            phone_number_id = phoneData.data[0].id;
            phone_number = phone_number || phoneData.data[0].display_phone_number;
          } else {
            console.warn('[WAConnect] Could not list phone numbers for WABA:', phoneData?.error?.message);
          }
        }
      } catch (autoErr) {
        console.warn('[WAConnect] Auto-resolve of WABA/Phone Number ID failed:', autoErr.message);
        // Not fatal — validation below will catch it if still missing.
      }
    }

    // ---------------------------------------------------------------------
    // STEP 3: Final validation — identical behavior to the original manual
    // flow. If we still don't have both values (manual flow: user simply
    // didn't fill the form; embedded flow: auto-resolve couldn't find them),
    // reject with the same message as before.
    // ---------------------------------------------------------------------
    if (!phone_number_id || !access_token) {
      return res.status(400).json({
        success: false,
        message: 'Phone Number ID and Permanent Access Token are required.'
      });
    }

    console.log(`[WAConnect] Initiating Meta verification for Phone Number ID: ${phone_number_id}...`);

    // 1. Try to Verify Meta Credentials, but allow saving even if token is expired
    let metaResult = null;
    let tokenExpired = false;
    let verificationWarning = null;

    try {
      metaResult = await verifyMetaCredentials({
        phoneNumberId: phone_number_id.trim(),
        wabaId: waba_id ? waba_id.trim() : '',
        accessToken: access_token.trim()
      });
    } catch (metaErr) {
      // Check if this is a token expiry error (code 190) or session error (code 102/104)
      const metaCode = metaErr.metaError?.code;
      const isTokenExpired = metaCode === 190 || metaCode === 102 || metaCode === 104 ||
        (metaErr.message && (metaErr.message.includes('Session has expired') || metaErr.message.includes('access token') || metaErr.message.includes('(190)')));

      if (isTokenExpired) {
        // Soft failure - save the account but mark token as expired
        tokenExpired = true;
        verificationWarning = `Token expired: ${metaErr.message}. Account saved — please update your access token from Meta Business Manager.`;
        console.warn('[WAConnect] Token expired but saving account anyway:', metaErr.message);
        // Use placeholder values since we can't verify
        metaResult = {
          displayPhoneNumber: phone_number || phone_number_id,
          verifiedName: 'WhatsApp Account',
          businessName: 'WhatsApp Business',
          qualityRating: 'GREEN',
          verificationStatus: 'TOKEN_EXPIRED'
        };
      } else {
        // Hard failure - wrong credentials, wrong phone_number_id, etc.
        console.error('[WAConnect] Verification failed with non-expiry error:', metaErr.message);
        return res.status(metaErr.statusCode || 400).json({
          success: false,
          message: metaErr.message,
          metaError: metaErr.metaError || null
        });
      }
    }

    // 2. Encryption of Access Token before storing into MySQL
    const encryptedToken = encryptToken(access_token.trim());

    // Extract details returned by Meta
    const cleanPhoneNumber = (phone_number || metaResult.displayPhoneNumber || '').trim();
    const displayPhoneNumber = metaResult.displayPhoneNumber || cleanPhoneNumber;
    const verifiedName = metaResult.verifiedName || 'WhatsApp Account';
    const businessName = metaResult.businessName || verifiedName;
    const qualityRating = metaResult.qualityRating || 'GREEN';
    const verificationStatus = metaResult.verificationStatus || 'CONNECTED';

    // 3. Save into whatsapp_accounts table
    const [existing] = await pool.query(
      `SELECT id FROM whatsapp_accounts WHERE organization_id = ? AND phone_number_id = ? LIMIT 1`,
      [organizationId, phone_number_id.trim()]
    );

    let accountId;

    if (existing.length > 0) {
      accountId = existing[0].id;
      await pool.query(
        `UPDATE whatsapp_accounts 
         SET user_id = ?, phone_number = ?, waba_id = ?, verified_name = ?, 
             display_phone_number = ?, business_name = ?, access_token = ?, 
             quality_rating = ?, verification_status = ?, connected_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [
          userId, cleanPhoneNumber, waba_id ? waba_id.trim() : '', verifiedName,
          displayPhoneNumber, businessName, encryptedToken,
          qualityRating, verificationStatus, accountId
        ]
      );
    } else {
      const [insertRes] = await pool.query(
        `INSERT INTO whatsapp_accounts 
         (organization_id, user_id, phone_number, phone_number_id, waba_id, verified_name, display_phone_number, business_name, access_token, quality_rating, verification_status, connected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          organizationId, userId, cleanPhoneNumber, phone_number_id.trim(),
          waba_id ? waba_id.trim() : '', verifiedName, displayPhoneNumber,
          businessName, encryptedToken, qualityRating, verificationStatus
        ]
      );
      accountId = insertRes.insertId;
    }

    // 4. Automatically Create Default Data for Tenant
    await provisionDefaultTenantData(organizationId, userId);

    console.log(`[WAConnect] ✅ Successfully saved WhatsApp number ID ${phone_number_id} for Org ${organizationId}${tokenExpired ? ' [TOKEN_EXPIRED]' : ''}`);

    return res.status(200).json({
      success: true,
      tokenExpired: tokenExpired,
      warning: verificationWarning || null,
      message: tokenExpired
        ? 'WhatsApp account saved! ⚠️ Your access token has expired — please update it from Meta Business Manager to enable messaging.'
        : 'WhatsApp Number verified and connected successfully!',
      data: {
        id: accountId,
        organization_id: organizationId,
        user_id: userId,
        phone_number: cleanPhoneNumber,
        phone_number_id: phone_number_id.trim(),
        waba_id: waba_id ? waba_id.trim() : '',
        verified_name: verifiedName,
        display_phone_number: displayPhoneNumber,
        business_name: businessName,
        quality_rating: qualityRating,
        verification_status: verificationStatus,
        masked_access_token: maskToken(access_token.trim())
      }
    });

  } catch (err) {
    console.error('[WAConnect] General Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while connecting WhatsApp number',
      error: err.message
    });
  }
}

/**
 * GET /api/whatsapp/list (or /api/whatsapp-accounts)
 * Fetches all connected WhatsApp numbers for the organization.
 */
export async function listWhatsAppAccounts(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'Super Admin';
    const reqOrgId = req.organizationId || req.user?.organization_id;
    const organizationId = req.query.organization_id ? parseInt(req.query.organization_id, 10) : reqOrgId;

    let query = `
      SELECT id, organization_id, user_id, phone_number, phone_number_id, waba_id,
             verified_name, display_phone_number, business_name, access_token,
             quality_rating, verification_status, status, allowed_modules, connected_at, created_at, updated_at
      FROM whatsapp_accounts
    `;
    const params = [];

    if (organizationId) {
      query += ` WHERE organization_id = ?`;
      params.push(organizationId);
    } else if (!isSuperAdmin) {
      query += ` WHERE organization_id = 0`;
    }

    query += ` ORDER BY id DESC`;

    const [rows] = await pool.query(query, params);

    // Format list for ManageOfficialNumbers table
    const formattedNumbers = rows.map(acc => {
      const displayName = acc.verified_name || acc.business_name || 'Official WhatsApp Account';
      const displayPhone = acc.display_phone_number || acc.phone_number || '-';
      const rawStatus = (acc.status || 'Active').trim();
      const status = (rawStatus.toLowerCase() === 'inactive' || rawStatus.toLowerCase() === 'deactive') ? 'Deactive' : 'Active';
      const verificationStatus = acc.verification_status || 'CONNECTED';
      const rating = acc.quality_rating || 'GREEN';

      let parsedModules = ["sendWa", "reports", "chat", "chatbot", "api", "template", "setting"];
      if (acc.allowed_modules) {
        try {
          parsedModules = typeof acc.allowed_modules === 'string' ? JSON.parse(acc.allowed_modules) : acc.allowed_modules;
        } catch (e) { }
      }

      return {
        id: acc.id,
        organization_id: acc.organization_id,
        user_id: acc.user_id,
        name: displayName,
        wa_number: displayPhone,
        phone_number: acc.phone_number,
        phone_number_id: acc.phone_number_id,
        waba_id: acc.waba_id,
        verified_name: acc.verified_name || displayName,
        display_phone_number: displayPhone,
        business_name: acc.business_name || displayName,
        status: status,
        verification_status: verificationStatus,
        license_status: status,
        rating: rating,
        allowed_modules: parsedModules,
        connected_at: acc.connected_at,
        access_token: maskToken(acc.access_token),
        details: {
          business_name: acc.business_name || displayName,
          phone: displayPhone,
          phone_number_id: acc.phone_number_id,
          waba_id: acc.waba_id,
          quality_rating: rating,
          verification_status: verificationStatus,
          status: status
        }
      };
    });

    res.json({
      success: true,
      total: formattedNumbers.length,
      totalPages: Math.ceil(formattedNumbers.length / 10) || 1,
      page: 1,
      count: formattedNumbers.length,
      numbers: formattedNumbers,
      data: formattedNumbers,
      whatsapp_accounts: formattedNumbers
    });

  } catch (err) {
    console.error('[WAList] Error fetching accounts:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch WhatsApp accounts' });
  }
}

/**
 * Helper to verify account ownership or Super Admin role
 */
async function checkAccountOwnership(accountId, req) {
  const isSuperAdmin = req.user && req.user.role === 'Super Admin';
  if (isSuperAdmin) return true;

  const organizationId = req.organizationId || req.user?.organization_id;
  if (!organizationId) return false;

  const [rows] = await pool.query(
    'SELECT id FROM whatsapp_accounts WHERE id = ? AND organization_id = ?',
    [accountId, organizationId]
  );
  return rows.length > 0;
}

/**
 * PUT /api/whatsapp/:id/assigned-modules
 * Updates assigned sidebar modules for a specific WhatsApp account.
 */
export async function updateAssignedModules(req, res) {
  try {
    const accountId = req.params.id;
    const { allowed_modules } = req.body;

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this WhatsApp account.' });
    }

    if (!Array.isArray(allowed_modules)) {
      return res.status(400).json({ message: 'allowed_modules must be an array of module keys' });
    }

    const modulesJson = JSON.stringify(allowed_modules);
    await pool.query(`UPDATE whatsapp_accounts SET allowed_modules = ? WHERE id = ?`, [modulesJson, accountId]);

    console.log(`[WAController] Updated assigned modules for WhatsApp Account ID ${accountId}:`, allowed_modules);

    res.json({
      success: true,
      message: 'Assigned sidebar modules updated successfully',
      allowed_modules
    });
  } catch (err) {
    console.error('[WAController] Error updating assigned modules:', err);
    res.status(500).json({ message: 'Failed to update assigned modules' });
  }
}

/**
 * GET /api/whatsapp/:id/notifications
 * Returns notifications specifically for a WhatsApp account.
 */
export async function getAccountNotifications(req, res) {
  try {
    const accountId = req.params.id;

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this WhatsApp account.' });
    }

    const [rows] = await pool.query(
      `SELECT id, whatsapp_account_id, title, message, type, is_read, created_at 
       FROM whatsapp_notifications 
       WHERE whatsapp_account_id = ? 
       ORDER BY id DESC LIMIT 50`,
      [accountId]
    );

    const unreadCount = rows.filter(n => n.is_read === 0).length;

    res.json({
      success: true,
      account_id: accountId,
      unreadCount,
      notifications: rows
    });

  } catch (err) {
    console.error('[WANotifications] Error:', err);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
}

/**
 * POST /api/whatsapp/:id/notifications/read-all
 * Marks notifications as read for a WhatsApp account.
 */
export async function markNotificationsRead(req, res) {
  try {
    const accountId = req.params.id;

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this WhatsApp account.' });
    }

    await pool.query(`UPDATE whatsapp_notifications SET is_read = 1 WHERE whatsapp_account_id = ?`, [accountId]);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[WANotifications] Mark read error:', err);
    res.status(500).json({ message: 'Failed to update notifications status' });
  }
}

/**
 * DELETE /api/whatsapp/:id
 * Disconnects / deletes a WhatsApp account.
 */
export async function deleteWhatsAppAccount(req, res) {
  try {
    const accountId = req.params.id;

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this WhatsApp account.' });
    }

    await pool.query(`DELETE FROM whatsapp_accounts WHERE id = ?`, [accountId]);

    res.json({
      success: true,
      message: 'WhatsApp account disconnected successfully'
    });
  } catch (err) {
    console.error('[WAController] Delete error:', err);
    res.status(500).json({ message: 'Failed to disconnect WhatsApp account' });
  }
}

/**
 * PUT /api/whatsapp/:id/token
 * Updates (refreshes) the access token for an existing WhatsApp account.
 * Re-verifies with Meta Graph API and updates verification_status.
 */
export async function updateAccountToken(req, res) {
  try {
    const accountId = req.params.id;
    const { access_token } = req.body;

    if (!access_token || !access_token.trim()) {
      return res.status(400).json({ success: false, message: 'New access token is required.' });
    }

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to update this account.' });
    }

    // Fetch current account details
    const [rows] = await pool.query(`SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1`, [accountId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'WhatsApp account not found.' });
    }
    const account = rows[0];

    // Try to verify the new token with Meta
    let verifiedName = account.verified_name || 'WhatsApp Account';
    let qualityRating = account.quality_rating || 'GREEN';
    let newStatus = 'CONNECTED';
    let tokenExpired = false;

    try {
      const metaResult = await verifyMetaCredentials({
        phoneNumberId: account.phone_number_id,
        wabaId: account.waba_id || '',
        accessToken: access_token.trim()
      });
      verifiedName = metaResult.verifiedName || verifiedName;
      qualityRating = metaResult.qualityRating || qualityRating;
      newStatus = 'CONNECTED';
    } catch (metaErr) {
      const metaCode = metaErr.metaError?.code;
      const isExpiry = metaCode === 190 || metaCode === 102 || metaCode === 104 ||
        (metaErr.message && (metaErr.message.includes('Session has expired') || metaErr.message.includes('(190)')));

      if (isExpiry) {
        newStatus = 'TOKEN_EXPIRED';
        tokenExpired = true;
      } else {
        return res.status(400).json({ success: false, message: `Token verification failed: ${metaErr.message}`, metaError: metaErr.metaError || null });
      }
    }

    const encryptedToken = encryptToken(access_token.trim());
    await pool.query(
      `UPDATE whatsapp_accounts SET access_token = ?, verification_status = ?, verified_name = ?, quality_rating = ?, updated_at = NOW() WHERE id = ?`,
      [encryptedToken, newStatus, verifiedName, qualityRating, accountId]
    );

    return res.json({
      success: true,
      tokenExpired,
      message: tokenExpired
        ? 'Token saved but it appears expired. Please generate a new permanent token from Meta Business Manager.'
        : '✅ Access token updated and verified successfully!',
      verification_status: newStatus
    });

  } catch (err) {
    console.error('[WAController] Update token error:', err);
    res.status(500).json({ success: false, message: 'Failed to update access token.' });
  }
}

/**
 * PATCH /api/whatsapp/:id/status (or /api/numbers/:id/status)
 * Toggles or updates status of a WhatsApp account (Active / Deactive).
 */
export async function updateAccountStatus(req, res) {
  try {
    const accountId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this account.' });
    }

    const normalizedStatus = status.toLowerCase() === 'active' ? 'Active' : 'Deactive';

    await pool.query(
      `UPDATE whatsapp_accounts SET status = ?, updated_at = NOW() WHERE id = ?`,
      [normalizedStatus, accountId]
    );

    console.log(`[WAController] Updated status for WhatsApp Account ID ${accountId} to ${normalizedStatus}`);

    return res.json({
      success: true,
      message: `Account status updated to ${normalizedStatus}`,
      status: normalizedStatus
    });
  } catch (err) {
    console.error('[WAController] Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update account status' });
  }
}

/**
 * POST /api/whatsapp/:id/fetch (or /api/numbers/:id/fetch)
 * Refreshes Meta Graph API account info for an ACTIVE account.
 * If account is DEACTIVE, asks user to activate first.
 */
export async function fetchMetaAccountInfo(req, res) {
  try {
    const accountId = req.params.id;

    const isAllowed = await checkAccountOwnership(accountId, req);
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this account.' });
    }

    const [rows] = await pool.query(`SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1`, [accountId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'WhatsApp account not found.' });
    }

    const account = rows[0];
    const currentStatus = account.status ? account.status.toLowerCase() : 'active';

    // Check if account is Active before fetching from Meta
    if (currentStatus !== 'active') {
      return res.status(400).json({
        success: false,
        isDeactive: true,
        message: 'Account is currently Deactive. Please activate the number first before fetching Meta account info.'
      });
    }

    let decryptedToken = null;
    if (account.access_token) {
      try {
        decryptedToken = (await import('../utils/encryption.js')).decryptToken(account.access_token);
      } catch (_) {
        decryptedToken = account.access_token;
      }
    }

    if (!account.phone_number_id || !decryptedToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing Phone Number ID or Access Token. Please update your account credentials.'
      });
    }

    // Call Meta Graph API to verify credentials and fetch latest info
    let metaResult = null;
    try {
      metaResult = await verifyMetaCredentials({
        phoneNumberId: account.phone_number_id,
        wabaId: account.waba_id || '',
        accessToken: decryptedToken
      });
    } catch (metaErr) {
      const metaCode = metaErr.metaError?.code;
      const isExpiry = metaCode === 190 || metaCode === 102 || metaCode === 104 ||
        (metaErr.message && (metaErr.message.includes('Session has expired') || metaErr.message.includes('(190)')));

      if (isExpiry) {
        await pool.query(
          `UPDATE whatsapp_accounts SET verification_status = 'TOKEN_EXPIRED', updated_at = NOW() WHERE id = ?`,
          [accountId]
        );
        return res.status(400).json({
          success: false,
          tokenExpired: true,
          message: 'Meta access token has expired or is invalid. Please update your access token using the "Update Token" button.'
        });
      }

      return res.status(400).json({
        success: false,
        message: `Failed to fetch Meta account info: ${metaErr.message}`
      });
    }

    // Update fetched details in whatsapp_accounts
    const verifiedName = metaResult.verifiedName || account.verified_name || account.business_name || 'Official WhatsApp Account';
    const displayPhone = metaResult.displayPhoneNumber || account.display_phone_number || account.phone_number;
    const qualityRating = metaResult.qualityRating || account.quality_rating || 'GREEN';

    await pool.query(
      `UPDATE whatsapp_accounts 
       SET verified_name = ?, display_phone_number = ?, quality_rating = ?, verification_status = 'CONNECTED', updated_at = NOW() 
       WHERE id = ?`,
      [verifiedName, displayPhone, qualityRating, accountId]
    );

    return res.json({
      success: true,
      message: `Account info refreshed from Meta Facebook successfully! Status: Connected. (${verifiedName})`,
      data: {
        id: account.id,
        phone_number_id: account.phone_number_id,
        verified_name: verifiedName,
        display_phone_number: displayPhone,
        quality_rating: qualityRating,
        verification_status: 'CONNECTED',
        status: 'Active'
      }
    });

  } catch (err) {
    console.error('[WAController] Fetch Meta account info error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch Meta account info.' });
  }
}