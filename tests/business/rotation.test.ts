import { describe, it, expect } from 'vitest';
import { rotateProvidersDaily, getIstCalendarDayNumber, stableBaseSort } from '../../src/lib/business/rotation';

describe('Deterministic Daily Provider Rotation', () => {
  const sampleProviders = [
    { id: 'p1', first_activated_at: '2026-01-01T10:00:00Z', name: 'Provider 1' },
    { id: 'p2', first_activated_at: '2026-01-02T10:00:00Z', name: 'Provider 2' },
    { id: 'p3', first_activated_at: '2026-01-03T10:00:00Z', name: 'Provider 3' },
    { id: 'p4', first_activated_at: '2026-01-04T10:00:00Z', name: 'Provider 4' },
    { id: 'p5', first_activated_at: '2026-01-05T10:00:00Z', name: 'Provider 5' },
  ];

  it('handles empty and single provider lists gracefully', () => {
    expect(rotateProvidersDaily([])).toEqual([]);
    const single = [{ id: 'p1', first_activated_at: '2026-01-01T10:00:00Z' }];
    expect(rotateProvidersDaily(single)).toEqual(single);
  });

  it('maintains deterministic sort order for same input on the same day', () => {
    const testDate = new Date('2026-09-07T12:00:00+05:30');
    const result1 = rotateProvidersDaily(sampleProviders, testDate);
    const result2 = rotateProvidersDaily(sampleProviders, testDate);
    expect(result1.map(p => p.id)).toEqual(result2.map(p => p.id));
  });

  it('rotates downward on the next calendar day in IST', () => {
    const day1 = new Date('2026-09-07T12:00:00+05:30');
    const day2 = new Date('2026-09-08T12:00:00+05:30');

    const orderDay1 = rotateProvidersDaily(sampleProviders, day1);
    const orderDay2 = rotateProvidersDaily(sampleProviders, day2);

    expect(orderDay1.map(p => p.id)).not.toEqual(orderDay2.map(p => p.id));
    // In day 2, previous top provider wraps around
    expect(orderDay2[orderDay2.length - 1].id).toBe(orderDay1[0].id);
  });

  it('gives each of N providers the #1 spot exactly once over N days', () => {
    const n = sampleProviders.length;
    const baseDate = new Date('2026-01-01T10:00:00+05:30');
    const topProviderIds: string[] = [];

    for (let day = 0; day < n; day++) {
      const currentDate = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
      const rotated = rotateProvidersDaily(sampleProviders, currentDate);
      topProviderIds.push(rotated[0].id);
    }

    // Every provider was #1 exactly once
    expect(new Set(topProviderIds).size).toBe(n);
    sampleProviders.forEach(p => {
      expect(topProviderIds).toContain(p.id);
    });
  });

  it('respects midnight IST rollover boundary, not UTC midnight', () => {
    // 23:59:50 IST (18:29:50 UTC)
    const beforeMidnightIst = new Date('2026-09-07T23:59:50+05:30');
    // 00:00:10 IST next day (18:30:10 UTC)
    const afterMidnightIst = new Date('2026-09-08T00:00:10+05:30');

    const dayNumBefore = getIstCalendarDayNumber(beforeMidnightIst);
    const dayNumAfter = getIstCalendarDayNumber(afterMidnightIst);

    expect(dayNumAfter).toBe(dayNumBefore + 1);

    const orderBefore = rotateProvidersDaily(sampleProviders, beforeMidnightIst);
    const orderAfter = rotateProvidersDaily(sampleProviders, afterMidnightIst);

    expect(orderBefore[0].id).not.toEqual(orderAfter[0].id);
  });

  it('verifies full cycle for maximum 10 providers across 10 days', () => {
    const tenProviders = Array.from({ length: 10 }, (_, i) => ({
      id: `prov-${i + 1}`,
      first_activated_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const topIds: string[] = [];
    const baseDate = new Date('2026-06-01T00:00:00+05:30');

    for (let day = 0; day < 10; day++) {
      const d = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
      const result = rotateProvidersDaily(tenProviders, d);
      topIds.push(result[0].id);
    }

    expect(new Set(topIds).size).toBe(10);
  });
});
