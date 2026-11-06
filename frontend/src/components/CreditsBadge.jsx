import React from 'react';

/**
 * Format a Date or date string to Indian Standard Time (IST) readable format
 * e.g., "18 Sep 2026, 11:59 PM"
 */
function formatExpiryDateWithTime(dateInput) {
  if (!dateInput) return null;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const dateStr = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // If time is 00:00:00 or not set, default display nicely
    if (timeStr === '12:00 am' && !String(dateInput).includes('T') && !String(dateInput).includes(':')) {
      return `${dateStr}, 11:59 PM`;
    }

    return `${dateStr}, ${timeStr.toUpperCase()}`;
  } catch (_) {
    return String(dateInput);
  }
}

/**
 * Calculate precise remaining time text (days / hours)
 */
function getRemainingTimeDisplay(remainingDays, expiryDate) {
  if (remainingDays === null || remainingDays === undefined) {
    return 'Active Subscription';
  }

  if (remainingDays <= 0) {
    return '0 Days Left';
  }

  // Check if expiring within 24 hours
  if (expiryDate) {
    try {
      const now = new Date();
      const exp = new Date(expiryDate);
      // If expiry date string has no time, set to end of day 23:59:59
      if (!String(expiryDate).includes(':') && !String(expiryDate).includes('T')) {
        exp.setHours(23, 59, 59, 999);
      }
      const diffMs = exp.getTime() - now.getTime();
      if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
        const hoursLeft = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
        return `${hoursLeft} ${hoursLeft === 1 ? 'Hour' : 'Hours'} Left`;
      }
    } catch (_) {}
  }

  return `${remainingDays} ${remainingDays === 1 ? 'Day' : 'Days'} Remaining`;
}

/**
 * Unified, Dynamic CreditsBadge Component
 * Handles both Day-Based users and Credit-Based users seamlessly across all pages.
 *
 * Props:
 *  - creditsData: object from /api/credits/balance (or state containing credits/days metrics)
 *  - featureKey: 'quick' | 'csv' | 'tags' | 'group' | 'birthday' | 'general'
 *  - loading: boolean
 *  - showLabel: boolean (defaults to false)
 */
export default function CreditsBadge({ creditsData, featureKey = null, loading = false, showLabel = false }) {
  if (loading) {
    return <span style={{ fontSize: '13px', color: '#94a3b8' }}>Loading...</span>;
  }

  if (!creditsData) {
    return <span style={{ fontSize: '13px', color: '#94a3b8' }}>--</span>;
  }

  const isDaysBased = Boolean(
    creditsData.isDaysBased ||
    creditsData.accessType === 'days_based' ||
    creditsData.access_type === 'days_based'
  );

  /* ──────────────────────────────────────────────────────────────────────────
   * 1. DAY-BASED USER
   * ────────────────────────────────────────────────────────────────────────── */
  if (isDaysBased) {
    const isExpired = Boolean(
      creditsData.isExpired ||
      creditsData.is_expired ||
      creditsData.daysStatus === 'Expired' ||
      creditsData.days_status === 'Expired'
    );

    const expiryDate = creditsData.expiryDate || creditsData.expiry_date || creditsData.plan_expire_at;
    const formattedExpiry = formatExpiryDateWithTime(expiryDate);
    const remainingDays = creditsData.remainingDays ?? creditsData.remaining_days ?? (isExpired ? 0 : 0);

    if (isExpired || remainingDays <= 0) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12.5px',
            fontWeight: '700',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fca5a5'
          }}
          title={formattedExpiry ? `Plan expired on ${formattedExpiry}` : 'Plan has expired'}
        >
          <span>🔴</span>
          <span>Expired — Plan Ended</span>
          {formattedExpiry && (
            <span style={{ fontWeight: 500, opacity: 0.85, fontSize: '11.5px', marginLeft: '4px' }}>
              ({formattedExpiry})
            </span>
          )}
        </span>
      );
    }

    const timeRemainingText = getRemainingTimeDisplay(remainingDays, expiryDate);
    const isExpiringSoon = remainingDays <= 5;
    const isUrgent = remainingDays <= 2;

    const bg = isUrgent ? '#fee2e2' : isExpiringSoon ? '#fef3c7' : '#ecfdf5';
    const text = isUrgent ? '#b91c1c' : isExpiringSoon ? '#b45309' : '#059669';
    const border = isUrgent ? '#fca5a5' : isExpiringSoon ? '#fde68a' : '#86efac';
    const icon = isUrgent ? '🔴' : isExpiringSoon ? '⏳' : '📅';

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12.5px',
          fontWeight: '700',
          backgroundColor: bg,
          color: text,
          border: `1px solid ${border}`,
          whiteSpace: 'nowrap'
        }}
        title={formattedExpiry ? `Valid until ${formattedExpiry}` : undefined}
      >
        <span>{icon}</span>
        <span>{timeRemainingText}</span>
        {formattedExpiry && (
          <span style={{ fontWeight: 500, opacity: 0.9, fontSize: '11.5px', marginLeft: '4px' }}>
            (Expires: {formattedExpiry})
          </span>
        )}
      </span>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * 2. CREDIT-BASED USER
   * ────────────────────────────────────────────────────────────────────────── */
  const isUnlimited = Boolean(
    creditsData.isUnlimited ||
    creditsData.credits === 'Unlimited' ||
    (featureKey && creditsData.features && creditsData.features[featureKey] === 'Unlimited')
  );

  if (isUnlimited) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12.5px',
          fontWeight: '700',
          backgroundColor: '#dcfce7',
          color: '#15803d',
          border: '1px solid #86efac'
        }}
      >
        <span>🟢</span>
        <span>♾️ Unlimited Credits</span>
      </span>
    );
  }

  let count = 0;
  if (featureKey && creditsData.features && creditsData.features[featureKey] !== undefined) {
    const val = creditsData.features[featureKey];
    count = val === 'Unlimited' ? null : Number(val || 0);
  } else {
    const total = creditsData.credits;
    count = total === 'Unlimited' ? null : Number(total || 0);
  }

  if (count === null) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12.5px',
          fontWeight: '700',
          backgroundColor: '#dcfce7',
          color: '#15803d',
          border: '1px solid #86efac'
        }}
      >
        <span>🟢</span>
        <span>♾️ Unlimited Credits</span>
      </span>
    );
  }

  const isGood = count > 20;
  const isLow = count > 0 && count <= 20;
  const isZero = count === 0;

  const bg = isZero ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7';
  const text = isZero ? '#b91c1c' : isLow ? '#b45309' : '#15803d';
  const border = isZero ? '#fca5a5' : isLow ? '#fde68a' : '#86efac';
  const dot = isZero ? '🔴' : isLow ? '🟠' : '🟢';

  return (
    <>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12.5px',
          fontWeight: '700',
          backgroundColor: bg,
          color: text,
          border: `1px solid ${border}`
        }}
      >
        <span>{dot}</span>
        <span>{Number(count).toLocaleString()} Credits</span>
      </span>

      {isZero && (
        <div
          style={{
            display: 'block',
            marginTop: '8px',
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            borderRadius: '8px',
            fontSize: '13px'
          }}
        >
          Your credits are exhausted. Please contact the administrator to receive more credits.
        </div>
      )}
    </>
  );
}
