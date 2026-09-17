import { describe, it, expect } from 'vitest';
import { calculateTotalContactActions } from '../../src/lib/business/slotEnforcement';
import {
  formatWhatsAppReport,
  formatTrialConversionMessage,
  formatRenewalReminderMessage,
  getWhatsAppLink,
} from '../../src/lib/business/reportTemplates';
import { getDataRepository } from '../../src/lib/repositories/dataRepository';

describe('Phase 2: Performance Metrics & Reporting Business Rules', () => {
  it('calculates Total Contact Actions strictly as Call + WhatsApp + Directions', () => {
    const metrics = {
      profile_views: 186,
      call_clicks: 34,
      whatsapp_clicks: 21,
      directions_clicks: 8,
      share_clicks: 6,
    };

    const total = calculateTotalContactActions(metrics);
    // 34 + 21 + 8 = 63. Profile views (186) and shares (6) must be excluded!
    expect(total).toBe(63);
  });

  it('aggregates performance report correctly for single listing', async () => {
    const repo = getDataRepository();
    const report = await repo.getListingPerformanceReport({
      vendor_id: 'v-dev-1',
      listing_id: 'l-dev-1',
      range_type: '30d',
    });

    expect(report.vendor.provider_name).toBe('राहुल रमेश पाटील');
    expect(report.listing).toBeDefined();
    expect(report.metrics.profile_views).toBe(186);
    expect(report.metrics.call_clicks).toBe(34);
    expect(report.metrics.whatsapp_clicks).toBe(21);
    expect(report.metrics.directions_clicks).toBe(8);
    expect(report.metrics.share_clicks).toBe(6);
    expect(report.metrics.total_contact_actions).toBe(63);
  });

  it('formats bilingual WhatsApp report in Marathi with neutral phrasing', () => {
    const text = formatWhatsAppReport({
      vendorName: 'राहुल रमेश पाटील',
      businessName: 'राहुल इलेक्ट्रिकल सर्व्हिसेस',
      categoryNameEn: 'Electrician',
      categoryNameMr: 'इलेक्ट्रिशियन',
      talukaNameEn: 'Sangamner',
      talukaNameMr: 'संगमनेर',
      rangeTitleEn: 'last 30 days',
      rangeTitleMr: '३० दिवस',
      metrics: {
        profile_views: 186,
        call_clicks: 34,
        whatsapp_clicks: 21,
        directions_clicks: 8,
        share_clicks: 6,
        total_contact_actions: 63,
      },
      validUntil: '30 September 2026',
      locale: 'mr',
    });

    expect(text).toContain('राहुल रमेश पाटील');
    expect(text).toContain('इलेक्ट्रिशियन — संगमनेर');
    expect(text).toContain('एकूण ग्राहक संपर्क कृती: 63');
    expect(text).toContain('थेट कॉल क्लिक्स: 34');
    expect(text).toContain('व्हॉट्सॲप चौकशी: 21');
    expect(text).toContain('Aheka — आहे का?');
    // Verifies disclaimer is present
    expect(text).toContain('प्रत्यक्षात झालेल्या कॉल्स किंवा कामांची खात्री आम्ही देत नाही');
  });

  it('formats bilingual WhatsApp report in English with neutral phrasing', () => {
    const text = formatWhatsAppReport({
      vendorName: 'Rahul Patil',
      businessName: 'Rahul Electricals',
      categoryNameEn: 'Electrician',
      categoryNameMr: 'इलेक्ट्रिशियन',
      talukaNameEn: 'Sangamner',
      talukaNameMr: 'संगमनेर',
      rangeTitleEn: 'last 30 days',
      rangeTitleMr: '३० दिवस',
      metrics: {
        profile_views: 186,
        call_clicks: 34,
        whatsapp_clicks: 21,
        directions_clicks: 8,
        share_clicks: 6,
        total_contact_actions: 63,
      },
      validUntil: '30 September 2026',
      locale: 'en',
    });

    expect(text).toContain('Total Contact Actions: 63');
    expect(text).toContain('Call Clicks: 34');
    expect(text).toContain('WhatsApp Clicks: 21');
    expect(text).toContain('Electrician — Sangamner');
    expect(text).toContain('actual completed calls or jobs cannot be guaranteed');
  });

  it('formats trial conversion message with ₹999 invitation', () => {
    const text = formatTrialConversionMessage({
      vendorName: 'Vikas Shinde',
      businessName: 'Jay Bhavani Wireman',
      categoryNameEn: 'Electrician',
      categoryNameMr: 'इलेक्ट्रिशियन',
      talukaNameEn: 'Sangamner',
      talukaNameMr: 'संगमनेर',
      trialStartsAt: '1 September 2026',
      trialEndsAt: '30 September 2026',
      metrics: {
        profile_views: 230,
        call_clicks: 31,
        whatsapp_clicks: 26,
        directions_clicks: 11,
        share_clicks: 5,
        total_contact_actions: 68,
      },
      annualFee: 999,
      locale: 'en',
    });

    expect(text).toContain('Total Contact Actions: 68');
    expect(text).toContain('₹999/year');
    expect(text).toContain('10-provider taluka limit');
  });

  it('generates wa.me prefilled click link', () => {
    const link = getWhatsAppLink('+919822011101', 'Hello Vendor');
    expect(link).toBe('https://wa.me/919822011101?text=Hello%20Vendor');
  });

  it('calculates admin trial metrics and conversion rate', async () => {
    const repo = getDataRepository();
    const metrics = await repo.getAdminTrialMetrics();

    expect(metrics.activeTrials).toBeGreaterThanOrEqual(1);
    expect(metrics.completedTrials).toBeGreaterThanOrEqual(1);
    expect(typeof metrics.trialConversionRate).toBe('number');
    expect(metrics.trialConversionRate).toBeGreaterThanOrEqual(0);
    expect(metrics.trialConversionRate).toBeLessThanOrEqual(100);
  });
});
