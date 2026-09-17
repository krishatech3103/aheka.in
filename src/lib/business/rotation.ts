/**
 * Deterministic Daily Provider Rotation Engine for Aheka
 * 
 * Guarantees:
 * 1. Fair visibility across all active eligible providers in a Taluka + Category.
 * 2. Deterministic order based on Indian Standard Time (Asia/Kolkata, UTC+5:30).
 * 3. Rotates at midnight IST.
 * 4. In a group of N providers, every provider occupies the #1 spot exactly once over N days.
 * 5. Absolutely no paid sponsorship, no auction ranking, no random reshuffling per request.
 */

export interface RotatableProvider {
  id: string;
  first_activated_at?: string | null;
  [key: string]: unknown;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Fixed Epoch: 2026-01-01T00:00:00+05:30
const FIXED_EPOCH_IST_MS = Date.UTC(2026, 0, 1) - IST_OFFSET_MS;

/**
 * Calculates the calendar day index in Asia/Kolkata since epoch.
 */
export function getIstCalendarDayNumber(date: Date = new Date()): number {
  const utcMs = date.getTime();
  const istMs = utcMs + IST_OFFSET_MS;
  // Floor to whole calendar days since 1970 in IST
  return Math.floor(istMs / MS_PER_DAY);
}

/**
 * Stable base sort comparator:
 * Primary: first_activated_at ASC (oldest activation first)
 * Secondary: id ASC (deterministic tie-breaker)
 */
export function stableBaseSort<T extends RotatableProvider>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const timeA = a.first_activated_at ? new Date(a.first_activated_at).getTime() : 0;
    const timeB = b.first_activated_at ? new Date(b.first_activated_at).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Rotates an array of providers deterministically for the given date in IST.
 * 
 * @param providers Array of active eligible providers
 * @param date Target date to compute rotation for (defaults to current time)
 * @returns Array rotated fairly for the target calendar day
 */
export function rotateProvidersDaily<T extends RotatableProvider>(
  providers: T[],
  date: Date = new Date()
): T[] {
  const n = providers.length;
  if (n <= 1) {
    return [...providers];
  }

  // 1. Sort into deterministic stable base sequence
  const sorted = stableBaseSort(providers);

  // 2. Compute calendar day in IST
  const dayNumber = getIstCalendarDayNumber(date);

  // 3. Compute rotation offset: 0 <= offset < n
  const offset = ((dayNumber % n) + n) % n;

  if (offset === 0) {
    return sorted;
  }

  // 4. Rotate: elements from offset to end move to front, 0 to offset-1 append to back
  return sorted.slice(offset).concat(sorted.slice(0, offset));
}
