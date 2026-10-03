import { describe, it, expect, beforeEach } from 'vitest';
import { POST as submitApplication } from '../../src/pages/api/application/submit';
import { POST as activateListing } from '../../src/pages/api/internal-admin/activate-listing';
import { POST as adminLogin } from '../../src/pages/api/internal-admin/login';
import { POST as vendorLogin } from '../../src/pages/api/vendor/login';
import { POST as recordAnalytics } from '../../src/pages/api/analytics/event';
import { POST as manageCategory } from '../../src/pages/api/internal-admin/manage-category';
import { POST as manageLocation } from '../../src/pages/api/internal-admin/manage-location';
import { getDataRepository } from '../../src/lib/repositories/dataRepository';
import { adminLoginRateLimiter } from '../../src/lib/security/rateLimiter';
import { ADMIN_SESSION_COOKIE, createAdminSession } from '../../src/lib/security/adminSession';

describe('API & End-to-End Workflow Tests', () => {
  let repo = getDataRepository();

  beforeEach(() => {
    repo = getDataRepository();
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-with-sufficient-length';
  });

  async function authenticatedCookies() {
    const session = await createAdminSession();
    return {
      get: (key: string) => ({ value: key === ADMIN_SESSION_COOKIE ? session.token : undefined }),
    };
  }

  it('submits a new provider application with phone normalization and validation', async () => {
    const districts = await repo.getDistricts();
    const talukas = await repo.getTalukas();
    const categories = await repo.getCategories();

    const payload = {
      provider_name: 'अमोल शिंदे (Amol Shinde)',
      business_name: 'शिंदे प्लंबिंग वर्क्स',
      mobile: '9822998877',
      whatsapp_number: '9822998877',
      district_id: districts[0].id,
      taluka_id: talukas[0].id,
      category_ids: [categories[1].id], // plumber
      experience_years: 8,
      full_address: 'दुकान क्र. १०, बस स्टँडजवळ, संगमनेर',
      service_areas_text: 'संगमनेर शहर, चंदनापुरी, घुलेवाडी',
      google_maps_url: 'https://maps.app.goo.gl/sample',
      consent_agreed: true,
      website_honeypot: '', // empty honeypot
    };

    const req = new Request('http://localhost/api/application/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await submitApplication({ request: req } as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();

    // Verify application exists in repository
    const apps = await repo.getAdminApplications();
    const createdApp = apps.find(a => a.id === data.id);
    expect(createdApp).toBeDefined();
    expect(createdApp?.provider_name).toBe('अमोल शिंदे (Amol Shinde)');
    expect(createdApp?.mobile).toBe('+919822998877');
  });

  it('rejects bot submission when honeypot is filled', async () => {
    const payload = {
      provider_name: 'Spam Bot',
      mobile: '9999999999',
      district_id: 'any',
      website_honeypot: 'http://spam-link.ru',
    };

    const req = new Request('http://localhost/api/application/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await submitApplication({ request: req } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('app-bot-ignored');
  });

  it('authenticates admin with valid credentials', async () => {

    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-admin-password' }),
    });

    const res = await adminLogin({ request: req } as any);
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
    expect(res.headers.get('set-cookie')).toContain('SameSite=Strict');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(res.headers.get('set-cookie')).toContain('aheka_admin_session=');
  });

  it('enforces 10-slot limit during listing activation', async () => {
    const mockCookies = await authenticatedCookies();

    const vendors = await repo.getAdminVendors();
    const vendorWithListing = vendors[0];
    const listingId = vendorWithListing.listings[0].id;

    // Activate valid listing
    const req = new Request('http://localhost/api/admin/activate-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: listingId,
        amount: 999,
        payment_method: 'upi',
        reference_number: 'UPI-TEST-12345',
        notes: 'Annual listing subscription',
      }),
    });

    const res = await activateListing({ request: req, cookies: mockCookies } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.subscription).toBeDefined();
    expect(data.subscription.status).toBe('active');
  });

  it('allows vendor login via registered Indian mobile number', async () => {
    const cookiesSet: Record<string, string> = {};
    const mockCookies = {
      set: (key: string, val: string) => { cookiesSet[key] = val; },
    };

    // Use seed vendor's mobile
    const req = new Request('http://localhost/api/vendor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9822011101' }),
    });

    const res = await vendorLogin({ request: req, cookies: mockCookies } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.vendor_id).toBeDefined();
    expect(cookiesSet['aheka_vendor_id']).toBe(data.vendor_id);
  });

  it('logs direct call and whatsapp events in analytics non-blockingly', async () => {
    const vendors = await repo.getAdminVendors();
    const vendor = vendors[0];

    const req = new Request('http://localhost/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendor.id,
        vendor_listing_id: vendor.listings[0]?.id,
        event_type: 'call_click',
        page_path: `/mr/provider/${vendor.slug}`,
        locale: 'mr',
      }),
    });

    const res = await recordAnalytics({ request: req } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('rejects Phase 2 admin operations without authentication', async () => {
    const emptyCookies = {
      get: () => undefined,
    };

    const reqTrial = new Request('http://localhost/api/internal-admin/start-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: 'any' }),
    });
    const { POST: startTrial } = await import('../../src/pages/api/internal-admin/start-trial');
    const resTrial = await startTrial({ request: reqTrial, cookies: emptyCookies } as any);
    expect(resTrial.status).toBe(401);

    const reqConvert = new Request('http://localhost/api/internal-admin/convert-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: 'any' }),
    });
    const { POST: convertTrial } = await import('../../src/pages/api/internal-admin/convert-trial');
    const resConvert = await convertTrial({ request: reqConvert, cookies: emptyCookies } as any);
    expect(resConvert.status).toBe(401);

    const reqReport = new Request('http://localhost/api/internal-admin/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: 'any' }),
    });
    const { POST: getReport } = await import('../../src/pages/api/internal-admin/report');
    const resReport = await getReport({ request: reqReport, cookies: emptyCookies } as any);
    expect(resReport.status).toBe(401);
  });

  it('starts 30-day free trial via admin API for unpaid listing', async () => {
    const mockCookies = await authenticatedCookies();

    const { POST: startTrial } = await import('../../src/pages/api/internal-admin/start-trial');
    const req = new Request('http://localhost/api/internal-admin/start-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: 'l-unpaid-1', // Akole Electrician
      }),
    });

    const res = await startTrial({ request: req, cookies: mockCookies } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.trial).toBeDefined();
    expect(data.trial.status).toBe('active');
  });

  it('generates performance report and bilingual WhatsApp messages via admin API', async () => {
    const mockCookies = await authenticatedCookies();

    const { POST: getReport } = await import('../../src/pages/api/internal-admin/report');
    const req = new Request('http://localhost/api/internal-admin/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: 'v-dev-8',
        listing_id: 'l-dev-8',
        range_type: '30d',
      }),
    });

    const res = await getReport({ request: req, cookies: mockCookies } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.report.metrics.total_contact_actions).toBe(68);
    expect(data.whatsapp_mr).toContain('एकूण ग्राहक संपर्क कृती: 68');
    expect(data.whatsapp_en).toContain('Total Contact Actions: 68');
    expect(data.wa_link_mr).toContain('wa.me');
  });

  it('enforces rate limiting on repeated failed admin login attempts', async () => {
    const testIp = 'test-ip-rate-limit-1';
    adminLoginRateLimiter.reset(testIp);

    const mockCookies = {
      set: () => {},
      get: () => ({ value: undefined }),
      delete: () => {},
    };

    // Attempt 5 incorrect logins
    for (let i = 0; i < 5; i++) {
      const req = new Request('http://localhost/api/internal-admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': testIp,
        },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      const res = await adminLogin({ request: req, cookies: mockCookies } as any);
      expect(res.status).toBe(401);
    }

    // 6th attempt should be blocked with 429 Too Many Requests
    const blockedReq = new Request('http://localhost/api/internal-admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': testIp,
      },
      body: JSON.stringify({ password: 'any-password' }),
    });
    const blockedRes = await adminLogin({ request: blockedReq, cookies: mockCookies } as any);
    expect(blockedRes.status).toBe(429);
    const blockedData = await blockedRes.json();
    expect(blockedData.error).toContain('Too many failed login attempts');
  });

  it('allows admin to manage categories and locations via internal API', async () => {
    const mockCookies = await authenticatedCookies();

    // 1. Create Category
    const catReq = new Request('http://localhost/api/internal-admin/manage-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        data: {
          name_en: 'Welder',
          name_mr: 'वेल्डर',
          slug: 'welder',
          icon_key: 'tool',
          is_visible: true,
          is_featured: true,
          aliases: ['welding', 'लोहार', 'वेल्डिंग'],
          sort_order: 10,
        },
      }),
    });
    const catRes = await manageCategory({ request: catReq, cookies: mockCookies } as any);
    expect(catRes.status).toBe(200);
    const catData = await catRes.json();
    expect(catData.success).toBe(true);
    expect(catData.category.name_en).toBe('Welder');

    // 2. Create District
    const distReq = new Request('http://localhost/api/internal-admin/manage-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'district',
        action: 'create',
        data: {
          name_en: 'Satara',
          name_mr: 'सातारा',
          slug: 'satara',
          is_active: true,
          is_featured: true,
          sort_order: 4,
        },
      }),
    });
    const distRes = await manageLocation({ request: distReq, cookies: mockCookies } as any);
    expect(distRes.status).toBe(200);
    const distData = await distRes.json();
    expect(distData.success).toBe(true);
    expect(distData.district.slug).toBe('satara');
  });
});
