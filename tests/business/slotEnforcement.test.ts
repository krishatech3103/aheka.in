import { describe, it, expect } from 'vitest';
import {
  normalizeIndianMobile,
  isValidIndianMobile,
  generateVendorSlug,
  calculateSubscriptionPeriod,
  isSubscriptionActive,
  shouldIndexDirectoryPage,
} from '../../src/lib/business/slotEnforcement';

describe('Slot Enforcement & Business Rules', () => {
  describe('Mobile Normalization', () => {
    it('normalizes 10-digit mobile number starting with 6-9 to +91XXXXXXXXXX', () => {
      expect(normalizeIndianMobile('9822011101')).toBe('+919822011101');
      expect(normalizeIndianMobile('8888888888')).toBe('+918888888888');
      expect(normalizeIndianMobile('7020123456')).toBe('+917020123456');
      expect(normalizeIndianMobile('6300123456')).toBe('+916300123456');
    });

    it('cleans numbers with spaces, dashes, parentheses and leading 0 or +91', () => {
      expect(normalizeIndianMobile('09822011101')).toBe('+919822011101');
      expect(normalizeIndianMobile('+91 98220 11101')).toBe('+919822011101');
      expect(normalizeIndianMobile('91-98220-11101')).toBe('+919822011101');
      expect(normalizeIndianMobile('(098220) 11101')).toBe('+919822011101');
    });

    it('rejects invalid numbers', () => {
      expect(() => normalizeIndianMobile('1234567890')).toThrow(); // starts with 1
      expect(() => normalizeIndianMobile('5555555555')).toThrow(); // starts with 5
      expect(() => normalizeIndianMobile('98220')).toThrow(); // too short
      expect(() => normalizeIndianMobile('982201110199999')).toThrow(); // too long
      expect(isValidIndianMobile('invalid')).toBe(false);
      expect(isValidIndianMobile('9822011101')).toBe(true);
    });
  });

  describe('Vendor Slug Generation', () => {
    it('generates clean URL slug with provider name, taluka, and id part', () => {
      const slug = generateVendorSlug('Rahul Ramesh Patil', 'sangamner', '7k1a');
      expect(slug).toBe('rahul-ramesh-patil-sangamner-7k1a');
    });

    it('handles special characters and Marathi names fallback gracefully', () => {
      const slug = generateVendorSlug('राहुल पाटील (इलेक्ट्रिकल)', 'sangamner', '9m2b');
      // Special characters stripped
      expect(slug).toContain('-sangamner-9m2b');
    });
  });

  describe('Subscription Period Calculation', () => {
    it('starts today and ends in 1 year for new subscriptions', () => {
      const ref = new Date('2026-09-07T10:00:00Z');
      const { startsAt, endsAt } = calculateSubscriptionPeriod(null, ref);
      expect(startsAt.toISOString()).toBe(ref.toISOString());
      expect(endsAt.getUTCFullYear()).toBe(2027);
      expect(endsAt.getUTCMonth()).toBe(ref.getUTCMonth());
    });

    it('extends from current expiry date when renewing an active subscription early', () => {
      const ref = new Date('2026-09-07T10:00:00Z');
      const futureExpiry = '2026-12-31T23:59:59Z'; // 3+ months remaining
      const { startsAt, endsAt } = calculateSubscriptionPeriod(futureExpiry, ref);

      // Does not lose the 3 remaining months!
      expect(startsAt.toISOString()).toBe(new Date(futureExpiry).toISOString());
      expect(endsAt.toISOString()).toBe(new Date('2027-12-31T23:59:59Z').toISOString());
    });

    it('resets start date to today when renewing an already-expired subscription', () => {
      const ref = new Date('2026-09-07T10:00:00Z');
      const pastExpiry = '2026-01-01T00:00:00Z'; // expired 8 months ago
      const { startsAt, endsAt } = calculateSubscriptionPeriod(pastExpiry, ref);

      expect(startsAt.toISOString()).toBe(ref.toISOString());
      expect(endsAt.getUTCFullYear()).toBe(2027);
    });
  });

  describe('Subscription Active Check', () => {
    it('correctly determines whether subscription is currently valid', () => {
      const now = new Date('2026-09-07T12:00:00Z');

      expect(isSubscriptionActive({
        status: 'active',
        starts_at: '2026-01-01T00:00:00Z',
        ends_at: '2027-01-01T00:00:00Z'
      }, now)).toBe(true);

      expect(isSubscriptionActive({
        status: 'active',
        starts_at: '2025-01-01T00:00:00Z',
        ends_at: '2026-01-01T00:00:00Z'
      }, now)).toBe(false); // Expired

      expect(isSubscriptionActive({
        status: 'cancelled',
        starts_at: '2026-01-01T00:00:00Z',
        ends_at: '2027-01-01T00:00:00Z'
      }, now)).toBe(false); // Cancelled
    });
  });

  describe('SEO Directory Indexability', () => {
    it('returns false (noindex) when active providers < threshold (default 3)', () => {
      expect(shouldIndexDirectoryPage(0)).toBe(false);
      expect(shouldIndexDirectoryPage(1)).toBe(false);
      expect(shouldIndexDirectoryPage(2)).toBe(false);
    });

    it('returns true (index) when active providers >= threshold', () => {
      expect(shouldIndexDirectoryPage(3)).toBe(true);
      expect(shouldIndexDirectoryPage(10)).toBe(true);
    });

    it('respects admin manual override regardless of count', () => {
      // Force index even with 1 provider
      expect(shouldIndexDirectoryPage(1, 3, true)).toBe(true);
      // Force noindex even with 10 providers
      expect(shouldIndexDirectoryPage(10, 3, false)).toBe(false);
    });
  });
});
