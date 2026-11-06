// ─────────────────────────────────────────────────────────────────────────────
// src/utils/phoneUtils.js
// Standardizes phone numbers to clean digits with country code prefix.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a phone number to standard digit format.
 * E.g.: "+91 99138 47423" -> "919913847423"
 *       "9913847423"      -> "919913847423" (defaults to India 91 if 10 digits)
 *       "09913847423"     -> "919913847423"
 *
 * @param {string|number} phone
 * @param {string} [defaultCountryCode='91']
 * @returns {string} Clean digits with country code
 */
export function normalizePhone(phone, defaultCountryCode = '91') {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '').trim();
  if (!digits) return '';

  // Remove leading zero if present
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // If 10 digits, prepend default country code (e.g. 91)
  if (digits.length === 10) {
    digits = defaultCountryCode + digits;
  }

  return digits;
}

/**
 * Extract the last 10 digits of a phone number for fallback matching.
 * E.g.: "919913847423" -> "9913847423"
 *
 * @param {string|number} phone
 * @returns {string} 10-digit suffix
 */
export function get10DigitSuffix(phone) {
  const digits = String(phone).replace(/\D/g, '').trim();
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}
