/**
 * Utility functions for Days-Based and Credit-Based Access Calculations
 */

/**
 * Format a Date or date string to YYYY-MM-DD
 */
export function formatDateToYMD(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate expiry date from start date and duration in days.
 * E.g., Start Date: 2026-08-20, Days: 30 -> Expiry Date: 2026-09-19
 */
export function calculateExpiryDate(startDateInput, days) {
  const numDays = parseInt(days, 10);
  if (isNaN(numDays) || numDays <= 0) return null;

  const start = startDateInput ? new Date(startDateInput) : new Date();
  if (isNaN(start.getTime())) return null;

  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + numDays);
  return formatDateToYMD(expiry);
}

/**
 * Calculate remaining days, expired flag, and days status for a user.
 * 
 * Statuses:
 * - 'Active': User is enabled, days_based, and remaining_days > 5
 * - 'Expiring Soon': User is enabled, days_based, and remaining_days <= 5 and > 0
 * - 'Expired': User is enabled, days_based, and remaining_days <= 0
 * - 'Disabled': User is disabled / inactive (takes priority)
 */
export function calculateDaysMetrics(user) {
  const accessType = user.access_type === 'days_based' ? 'days_based' : 'credit_based';
  const isDaysBased = accessType === 'days_based';

  if (!isDaysBased) {
    return {
      access_type: 'credit_based',
      is_days_based: false,
      days_allocated: 0,
      days_used: 0,
      start_date: null,
      expiry_date: null,
      remaining_days: null,
      days_status: null,
      is_expired: false
    };
  }

  const startDateStr = formatDateToYMD(user.start_date);
  const expiryDateStr = formatDateToYMD(user.expiry_date);
  const daysAllocated = Number(user.days_allocated || 0);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let remainingDays = 0;
  let isExpired = true;

  if (expiryDateStr) {
    const parts = expiryDateStr.split('-').map(Number);
    const expDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    const diffMs = expDate.getTime() - today.getTime();

    if (diffMs > 0) {
      remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = false;
    } else {
      remainingDays = 0;
      isExpired = true;
    }
  }

  let daysStatus = 'Active';
  if (user.status === 'Disabled' || user.status === 'Inactive') {
    daysStatus = 'Disabled';
  } else if (isExpired || remainingDays <= 0) {
    daysStatus = 'Expired';
  } else if (remainingDays <= 5) {
    daysStatus = 'Expiring Soon';
  } else {
    daysStatus = 'Active';
  }

  return {
    access_type: 'days_based',
    is_days_based: true,
    days_allocated: daysAllocated,
    days_used: Number(user.days_used || 0),
    start_date: startDateStr,
    expiry_date: expiryDateStr,
    remaining_days: remainingDays,
    days_status: daysStatus,
    is_expired: isExpired
  };
}
