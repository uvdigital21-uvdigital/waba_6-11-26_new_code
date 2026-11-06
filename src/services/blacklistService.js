import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Normalizes any input mobile number with country code.
 * Rules:
 * - Remove spaces, +, -, brackets () []
 * - Remove leading zeros
 * - Attach country code prefix if 10-digit number
 */
export function normalizeMobile(mobile, countryCode = '+91') {
  if (!mobile) return '';
  let str = String(mobile).replace(/[\s\+\-\(\)\[\]]/g, '').trim();
  if (!str) return '';

  // Remove leading zero if present
  if (str.startsWith('0')) {
    str = str.slice(1);
  }

  const cleanCountryCode = String(countryCode || '91').replace(/\D/g, '') || '91';

  // If 10 digits, prepend country code
  if (str.length === 10) {
    str = cleanCountryCode + str;
  } else if (!str.startsWith(cleanCountryCode) && str.length < 12) {
    str = cleanCountryCode + str;
  }

  return str;
}

export async function checkBlacklist(phone, organizationId = null) {
  if (!phone) return false;
  const raw = String(phone).replace(/[\s\+\-\(\)\[\]]/g, '').trim();
  const normalized = normalizeMobile(raw);
  const suffix10 = normalized.length >= 10 ? normalized.slice(-10) : normalized;

  try {
    // FAST_BLACKLIST_LOOKUP_V1
    // Try direct matches first; preserve legacy normalized fallback.
    const orgFilter = organizationId
      ? ' AND (organization_id = ? OR organization_id IS NULL)'
      : '';

    const orgParams = organizationId ? [organizationId] : [];

    const exactSql = `SELECT id FROM blacklist
      WHERE (phone_number = ?
        OR normalized_mobile = ?
        OR mobile = ?
        OR phone_number = ?)
      ${orgFilter} LIMIT 1`;

    let [rows] = await pool.query(
      exactSql,
      [normalized, normalized, raw, raw, ...orgParams]
    );

    if (rows.length === 0) {
      const fallbackSql = `SELECT id FROM blacklist
        WHERE (
          RIGHT(REGEXP_REPLACE(COALESCE(phone_number, ''), '[^0-9]', ''), 10) = ?
          OR RIGHT(REGEXP_REPLACE(COALESCE(normalized_mobile, ''), '[^0-9]', ''), 10) = ?
        )
        ${orgFilter} LIMIT 1`;

      [rows] = await pool.query(
        fallbackSql,
        [suffix10, suffix10, ...orgParams]
      );
    }
    return rows.length > 0;
  } catch (err) {
    logger.warn('[BlacklistService] Check error:', err.message);
    return false;
  }
}
