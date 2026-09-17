/**
 * Core Business Rules for Aheka
 * 
 * Includes phone normalization, slug generation, slot calculations,
 * renewal period determination, and SEO thin-page checks.
 */

/**
 * Normalizes Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Throws an error if the number is invalid.
 */
export function normalizeIndianMobile(raw: string): string {
  if (!raw) {
    throw new Error('Mobile number is required');
  }

  // Remove spaces, hyphens, parentheses, plus
  let cleaned = raw.replace(/[\s\-\(\)\+]/g, '');

  // Strip leading 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Strip leading 91
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }

  // Must be 10 digits and start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    throw new Error('Invalid Indian mobile number. Must be a valid 10-digit number starting with 6-9.');
  }

  return `+91${cleaned}`;
}

/**
 * Checks if a mobile number string is valid without throwing.
 */
export function isValidIndianMobile(raw: string): boolean {
  try {
    normalizeIndianMobile(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates collision-safe vendor URL slug:
 * Format: {sanitized-name}-{taluka}-{shortId}
 */
export function generateVendorSlug(
  providerName: string,
  talukaSlug: string,
  shortId?: string
): string {
  const cleanName = providerName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40);

  const idPart = shortId || Math.random().toString(36).substring(2, 6);
  const baseName = cleanName || 'provider';
  return `${baseName}-${talukaSlug}-${idPart}`;
}

/**
 * Calculates start and end timestamps for a 30-day free trial.
 * Duration: exactly 30 days (30 * 24 * 60 * 60 * 1000 ms).
 */
export function calculateTrialPeriod(
  referenceDate: Date = new Date()
): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(referenceDate.getTime());
  const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  return { startsAt, endsAt };
}

/**
 * Calculates start and end timestamps for a subscription activation or renewal.
 * 
 * If renewing an active subscription before expiry:
 * Extends the existing expiry by exactly 1 year without losing remaining paid time!
 */
export function calculateSubscriptionPeriod(
  existingEndsAt?: string | null,
  referenceDate: Date = new Date()
): { startsAt: Date; endsAt: Date } {
  if (existingEndsAt) {
    const existingEnd = new Date(existingEndsAt);
    if (existingEnd.getTime() > referenceDate.getTime()) {
      // Future expiry: extend from current expiry
      const nextEnd = new Date(existingEnd.getTime());
      nextEnd.setFullYear(nextEnd.getFullYear() + 1);
      return {
        startsAt: existingEnd,
        endsAt: nextEnd,
      };
    }
  }

  // New or expired listing: starts at reference date, ends 1 year later
  const nextEnd = new Date(referenceDate.getTime());
  nextEnd.setFullYear(nextEnd.getFullYear() + 1);
  return {
    startsAt: referenceDate,
    endsAt: nextEnd,
  };
}

/**
 * Calculates subscription period when converting a trial to paid.
 * 
 * Rule: If payment is collected before trial ends:
 * The 1-year paid subscription begins seamlessly when the trial expires,
 * ensuring the provider does not lose any of their remaining 30 free trial days!
 * If trial has already expired: begins at referenceDate.
 */
export function calculateConversionSubscriptionPeriod(
  trial?: { ends_at: string; status?: string } | null,
  referenceDate: Date = new Date()
): { startsAt: Date; endsAt: Date; preservedTrialDays: number } {
  if (trial && trial.ends_at) {
    const trialEnd = new Date(trial.ends_at);
    if (trialEnd.getTime() > referenceDate.getTime()) {
      const remainingMs = trialEnd.getTime() - referenceDate.getTime();
      const preservedTrialDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      const nextEnd = new Date(trialEnd.getTime());
      nextEnd.setFullYear(nextEnd.getFullYear() + 1);
      return {
        startsAt: trialEnd,
        endsAt: nextEnd,
        preservedTrialDays,
      };
    }
  }

  // Trial expired or not present: begins immediately
  const startsAt = new Date(referenceDate.getTime());
  const nextEnd = new Date(startsAt.getTime());
  nextEnd.setFullYear(nextEnd.getFullYear() + 1);
  return {
    startsAt,
    endsAt: nextEnd,
    preservedTrialDays: 0,
  };
}

/**
 * Validates whether a listing's free trial is currently active.
 * A trial is active if status is 'active' (or 'converted') and starts_at <= now < ends_at.
 */
export function isTrialActive(
  trial: { status: string; starts_at: string; ends_at: string } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!trial) return false;
  // 'active' trials are active; 'converted' trials are also active during their trial period
  if (trial.status !== 'active' && trial.status !== 'converted') return false;
  const start = new Date(trial.starts_at).getTime();
  const end = new Date(trial.ends_at).getTime();
  const current = now.getTime();
  return start <= current && current < end;
}

/**
 * Validates whether a listing's subscription is currently active.
 */
export function isSubscriptionActive(
  subscription: { status: string; starts_at: string; ends_at: string } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  const start = new Date(subscription.starts_at).getTime();
  const end = new Date(subscription.ends_at).getTime();
  const current = now.getTime();
  return start <= current && current < end;
}

/**
 * Authoritative Unified Listing Eligibility Rule (Phase 2):
 * 
 * A listing is publicly eligible when:
 * 1. Listing approval_status is 'approved' and is_visible is true
 * 2. Vendor approval_status is 'approved', is_suspended is false, and is_publicly_visible is true
 * 3. AND EITHER:
 *    Condition A — Active non-expired free trial (isTrialActive)
 *    OR
 *    Condition B — Active paid annual subscription (isSubscriptionActive)
 */
export function isListingEligible(params: {
  listingApprovalStatus: string;
  listingIsVisible: boolean;
  vendorApprovalStatus: string;
  vendorIsSuspended: boolean;
  vendorIsPubliclyVisible: boolean;
  trial?: { status: string; starts_at: string; ends_at: string } | null;
  subscription?: { status: string; starts_at: string; ends_at: string } | null;
  now?: Date;
}): boolean {
  const now = params.now || new Date();

  if (params.listingApprovalStatus !== 'approved' || !params.listingIsVisible) {
    return false;
  }
  if (params.vendorApprovalStatus !== 'approved' || params.vendorIsSuspended || !params.vendorIsPubliclyVisible) {
    return false;
  }

  const hasActiveTrial = isTrialActive(params.trial, now);
  const hasActiveSubscription = isSubscriptionActive(params.subscription, now);

  return hasActiveTrial || hasActiveSubscription;
}

/**
 * Calculates remaining days in a trial or subscription period.
 * Returns negative number if expired.
 */
export function getRemainingDays(endsAt: string | Date, now: Date = new Date()): number {
  const end = new Date(endsAt).getTime();
  const current = now.getTime();
  const diffMs = end - current;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Authoritative Formula for Total Contact Actions:
 * Total Contact Actions = Call Clicks + WhatsApp Clicks + Directions Clicks
 * 
 * Important: Profile views and Share clicks are strictly EXCLUDED from this total.
 */
export function calculateTotalContactActions(metrics: {
  call_clicks?: number;
  whatsapp_clicks?: number;
  directions_clicks?: number;
}): number {
  return (
    Number(metrics.call_clicks || 0) +
    Number(metrics.whatsapp_clicks || 0) +
    Number(metrics.directions_clicks || 0)
  );
}

/**
 * Evaluates SEO indexability for a directory page based on the active provider threshold.
 * 
 * Rule: If active providers < SEO_MIN_ACTIVE_PROVIDERS (default 3), the page defaults
 * to "noindex, follow" to prevent thin content doorway pages.
 * Admin can manually override via indexabilityOverride.
 */
export function shouldIndexDirectoryPage(
  activeProviderCount: number,
  minThreshold: number = 3,
  indexabilityOverride?: boolean | null
): boolean {
  if (indexabilityOverride !== undefined && indexabilityOverride !== null) {
    return indexabilityOverride;
  }
  return activeProviderCount >= minThreshold;
}
