import { describe, it, expect } from 'vitest';
import { getDataRepository } from '../../src/lib/repositories/dataRepository';

describe('Data Repository Implementation', () => {
  const repo = getDataRepository();

  it('loads active districts and talukas correctly', async () => {
    const districts = await repo.getDistricts();
    expect(districts.length).toBeGreaterThanOrEqual(2);
    expect(districts.map(d => d.slug)).toContain('ahilyanagar');
    expect(districts.map(d => d.slug)).toContain('pune');

    const talukas = await repo.getTalukas();
    expect(talukas.map(t => t.slug)).toContain('sangamner');
    expect(talukas.map(t => t.slug)).toContain('akole');
  });

  it('returns all 10 active Sangamner electricians with daily fair rotation', async () => {
    const taluka = await repo.getTalukaBySlugs('ahilyanagar', 'sangamner');
    const category = await repo.getCategoryBySlug('electrician');

    expect(taluka).not.toBeNull();
    expect(category).not.toBeNull();

    const providers = await repo.getRotatedProviders(taluka!.id, category!.id);
    expect(providers.length).toBe(10);
    expect(providers[0].display_order).toBe(0);
    expect(providers[9].display_order).toBe(9);

    // Verify all 10 have valid Indian mobiles
    providers.forEach(p => {
      expect(p.mobile).toMatch(/^\+91[6-9]\d{9}$/);
      expect(p.provider_name).toBeTruthy();
    });
  });

  it('enforces 10-slot limit and rejects activation when slots are full', async () => {
    const taluka = await repo.getTalukaBySlugs('ahilyanagar', 'sangamner');
    const category = await repo.getCategoryBySlug('electrician');

    // Attempt to activate a waitlisted listing in Sangamner + Electrician (already has 10/10 slots occupied)
    const result = await repo.activateListing({
      listing_id: 'l-wait-1',
      amount: 999.00,
      payment_method: 'upi',
      reference_number: 'TEST-SLOT-FULL',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SLOT_LIMIT_REACHED');
    expect(result.active_count).toBe(10);
  });

  it('retrieves full provider profile with active listings and eligibility flag', async () => {
    const profile = await repo.getProviderBySlug('rahul-electricals-sangamner-7k1a');
    expect(profile).not.toBeNull();
    expect(profile!.vendor.provider_name).toBe('राहुल रमेश पाटील');
    expect(profile!.isEligible).toBe(true);
    expect(profile!.listings.length).toBeGreaterThan(0);
    expect(profile!.listings[0].category.slug).toBe('electrician');
  });

  it('identifies expired listings as not publicly eligible', async () => {
    const profile = await repo.getProviderBySlug('pawar-plumbing-sangamner-4q1n');
    expect(profile).not.toBeNull();
    // Vendor has only 1 listing and its subscription is expired
    expect(profile!.isEligible).toBe(false);
  });
});
