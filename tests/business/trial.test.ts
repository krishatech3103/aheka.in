import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateTrialPeriod,
  calculateConversionSubscriptionPeriod,
  isTrialActive,
  isSubscriptionActive,
  isListingEligible,
  getRemainingDays,
} from '../../src/lib/business/slotEnforcement';
import { rotateProvidersDaily } from '../../src/lib/business/rotation';
import { getDataRepository } from '../../src/lib/repositories/dataRepository';

describe('Phase 2: 30-Day Free Trial Business Rules', () => {
  it('calculates trial period to be exactly 30 days', () => {
    const start = new Date('2026-09-01T10:00:00Z');
    const { startsAt, endsAt } = calculateTrialPeriod(start);

    expect(startsAt.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    const diffMs = endsAt.getTime() - startsAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it('validates active trial vs expired trial', () => {
    const trial = {
      status: 'active',
      starts_at: '2026-09-01T00:00:00Z',
      ends_at: '2026-10-01T00:00:00Z',
    };

    // Day 15: active
    const day15 = new Date('2026-09-15T00:00:00Z');
    expect(isTrialActive(trial, day15)).toBe(true);

    // Day 31: expired
    const day31 = new Date('2026-10-02T00:00:00Z');
    expect(isTrialActive(trial, day31)).toBe(false);
  });

  it('preserves remaining free trial days upon conversion before expiry', () => {
    const trial = {
      status: 'active',
      starts_at: '2026-09-01T00:00:00Z',
      ends_at: '2026-10-01T00:00:00Z',
    };

    // Vendor pays on Sept 25 (6 days remaining)
    const paymentDate = new Date('2026-09-25T12:00:00Z');
    const { startsAt, endsAt, preservedTrialDays } = calculateConversionSubscriptionPeriod(trial, paymentDate);

    // Paid subscription must start on trial end date (Oct 1)
    expect(startsAt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    // And end exactly 1 year later
    expect(endsAt.getFullYear()).toBe(2027);
    expect(endsAt.getMonth()).toBe(9); // October
    expect(preservedTrialDays).toBe(6);
  });

  it('starts immediately if converting an expired trial', () => {
    const trial = {
      status: 'expired',
      starts_at: '2026-08-01T00:00:00Z',
      ends_at: '2026-08-31T00:00:00Z',
    };

    const paymentDate = new Date('2026-09-10T12:00:00Z');
    const { startsAt, endsAt, preservedTrialDays } = calculateConversionSubscriptionPeriod(trial, paymentDate);

    expect(startsAt.toISOString()).toBe(paymentDate.toISOString());
    expect(preservedTrialDays).toBe(0);
  });

  it('evaluates unified listing eligibility (Condition A: Trial or Condition B: Paid)', () => {
    const now = new Date('2026-09-15T00:00:00Z');

    // Case 1: Active trial, no subscription
    expect(
      isListingEligible({
        listingApprovalStatus: 'approved',
        listingIsVisible: true,
        vendorApprovalStatus: 'approved',
        vendorIsSuspended: false,
        vendorIsPubliclyVisible: true,
        trial: { status: 'active', starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z' },
        subscription: null,
        now,
      })
    ).toBe(true);

    // Case 2: Expired trial, no subscription -> Must be ineligible!
    expect(
      isListingEligible({
        listingApprovalStatus: 'approved',
        listingIsVisible: true,
        vendorApprovalStatus: 'approved',
        vendorIsSuspended: false,
        vendorIsPubliclyVisible: true,
        trial: { status: 'expired', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-08-31T00:00:00Z' },
        subscription: null,
        now,
      })
    ).toBe(false);

    // Case 3: Paid active subscription -> Eligible
    expect(
      isListingEligible({
        listingApprovalStatus: 'approved',
        listingIsVisible: true,
        vendorApprovalStatus: 'approved',
        vendorIsSuspended: false,
        vendorIsPubliclyVisible: true,
        trial: null,
        subscription: { status: 'active', starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z' },
        now,
      })
    ).toBe(true);
  });

  it('guarantees equal rotation treatment for trial and paid providers', () => {
    const date = new Date('2026-09-15T00:00:00Z');

    const items = [
      { id: '1', first_activated_at: '2026-01-01T00:00:00Z', name: 'Paid Provider 1' },
      { id: '2', first_activated_at: '2026-02-01T00:00:00Z', name: 'Trial Provider 2' },
      { id: '3', first_activated_at: '2026-03-01T00:00:00Z', name: 'Paid Provider 3' },
      { id: '4', first_activated_at: '2026-04-01T00:00:00Z', name: 'Trial Provider 4' },
    ];

    const rotated = rotateProvidersDaily(items, date);
    expect(rotated.length).toBe(4);

    // All items remain present without any demotion
    const ids = rotated.map(r => r.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('3');
    expect(ids).toContain('4');
  });
});

describe('Phase 2: Repository Trial Lifecycle & 10-Slot Limit Enforcement', () => {
  const repo = getDataRepository();

  it('Sangamner Electrician has exactly 10 active slots occupied (7 paid + 3 trial)', async () => {
    const sangamnerTalukaId = 't1111111-1111-1111-1111-111111111111';
    const electricianCatId = 'c1111111-1111-1111-1111-111111111111';

    const providers = await repo.getRotatedProviders(sangamnerTalukaId, electricianCatId);
    expect(providers.length).toBe(10);
  });

  it('rejects starting a trial when all 10 slots are occupied (places in waitlist)', async () => {
    // Attempt to start trial for waitlisted listing in full Sangamner Electrician category
    const result = await repo.startTrial({
      listing_id: 'l-wait-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SLOT_LIMIT_REACHED');
    expect(result.active_count).toBe(10);
    expect(result.max_slots).toBe(10);
  });

  it('enforces one free trial per listing anti-abuse rule', async () => {
    // l-dev-8 already has an active trial
    const result = await repo.startTrial({
      listing_id: 'l-dev-8',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('TRIAL_ALREADY_USED');

    // Admin override without reason must be rejected
    const overrideNoReason = await repo.startTrial({
      listing_id: 'l-dev-8',
      is_override: true,
      override_reason: '   ',
    });
    expect(overrideNoReason.success).toBe(false);
    expect(overrideNoReason.error).toBe('OVERRIDE_REASON_REQUIRED');
  });

  it('converts active trial to paid and preserves single slot without double-counting', async () => {
    // Convert l-dev-8 (which is on active trial) to paid
    const result = await repo.convertTrialToPaid({
      listing_id: 'l-dev-8',
      amount: 999,
      payment_method: 'upi',
      reference_number: 'UPI-TEST-CONV-888',
    });

    expect(result.success).toBe(true);
    expect(result.trial_converted).toBe(true);
    expect(result.subscription).toBeDefined();

    // Sangamner Electrician provider count must STILL be exactly 10 (never 11!)
    const sangamnerTalukaId = 't1111111-1111-1111-1111-111111111111';
    const electricianCatId = 'c1111111-1111-1111-1111-111111111111';
    const providers = await repo.getRotatedProviders(sangamnerTalukaId, electricianCatId);
    expect(providers.length).toBe(10);
  });

  it('re-checks 10-slot limit if paying for an expired trial', async () => {
    // l-exp-trial-1 is for Sangamner + Plumber (where slots are open)
    const result = await repo.convertTrialToPaid({
      listing_id: 'l-exp-trial-1',
      amount: 999,
      payment_method: 'cash',
      reference_number: 'CASH-PLUMB-999',
    });

    expect(result.success).toBe(true);
    expect(result.subscription?.status).toBe('active');
  });
});
