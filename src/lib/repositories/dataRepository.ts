import type {
  District,
  Taluka,
  Category,
  Vendor,
  VendorListing,
  Subscription,
  Payment,
  VendorApplication,
  RotatedProviderItem,
  DirectoryPageSettings,
  AnalyticsEventType,
  PaymentMethod,
  ListingTrial,
  PerformanceMetrics,
  VendorReportSnapshot,
} from '../types/database';
import { rotateProvidersDaily } from '../business/rotation';
import {
  normalizeIndianMobile,
  calculateSubscriptionPeriod,
  calculateTrialPeriod,
  calculateConversionSubscriptionPeriod,
  isSubscriptionActive,
  isTrialActive,
  isListingEligible,
  calculateTotalContactActions,
  getRemainingDays,
} from '../business/slotEnforcement';
import { getPublicSupabaseClient, getAdminSupabaseClient } from '../supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminTrialMetrics {
  activeTrials: number;
  trialsExpiring7Days: number;
  trialsExpiring3Days: number;
  expiredUnpaidTrials: number;
  convertedTrials: number;
  trialConversionRate: number; // percentage 0 - 100
  completedTrials: number;
  upcomingRenewals30Days: number;
  upcomingRenewals15Days: number;
  upcomingRenewals7Days: number;
}

export interface ListingReportResult {
  vendor: Vendor;
  listing?: VendorListing & {
    category: Category;
    taluka: Taluka;
    subscription?: Subscription;
    current_trial?: ListingTrial;
  };
  allListings?: (VendorListing & {
    category: Category;
    taluka: Taluka;
    subscription?: Subscription;
    current_trial?: ListingTrial;
  })[];
  range_type: string;
  from_date: string;
  to_date: string;
  metrics: PerformanceMetrics;
  breakdown?: {
    listing_id: string;
    category_name_en: string;
    category_name_mr: string;
    taluka_name_en: string;
    taluka_name_mr: string;
    metrics: PerformanceMetrics;
  }[];
}

export function getLocalizedCategoryName(
  category: { name_en: string; name_mr: string },
  locale: string = 'mr'
): string {
  if (locale === 'mr') {
    return category.name_mr.replace(/\s*\([A-Za-z\s/]+\)/g, '').replace(/\/.*$/, '').trim();
  }
  return category.name_en.replace(/\/.*$/, '').trim();
}

export interface DataRepository {
  getDistricts(): Promise<District[]>;
  getDistrictBySlug(slug: string): Promise<District | null>;
  getTalukas(districtId?: string): Promise<Taluka[]>;
  getTalukaBySlugs(districtSlug: string, talukaSlug: string): Promise<Taluka | null>;
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  getRotatedProviders(
    talukaId: string,
    categoryId: string,
    date?: Date
  ): Promise<RotatedProviderItem[]>;
  getProviderBySlug(slug: string): Promise<{
    vendor: Vendor;
    listings: (VendorListing & {
      category: Category;
      taluka: Taluka;
      subscription?: Subscription;
      current_trial?: ListingTrial;
    })[];
    serviceAreas: string[];
    isEligible: boolean;
  } | null>;
  getDirectoryPageSettings(talukaId: string, categoryId: string): Promise<DirectoryPageSettings | null>;
  submitVendorApplication(data: {
    provider_name: string;
    business_name?: string;
    mobile: string;
    whatsapp_number?: string;
    district_id: string;
    taluka_id: string;
    category_ids: string[];
    experience_years: number;
    full_address: string;
    service_areas_text: string;
    google_maps_url?: string;
    image_path?: string;
    consent_agreed: boolean;
    turnstile_verified?: boolean;
  }): Promise<{ id: string; success: boolean }>;
  recordAnalyticsEvent(data: {
    vendor_id: string;
    vendor_listing_id?: string;
    event_type: AnalyticsEventType;
    page_path: string;
    locale: string;
  }): Promise<void>;
  
  // Admin & Commercial Methods
  getAdminMetrics(): Promise<{
    totalVendors: number;
    activeListings: number;
    activeTrials: number;
    waitlistedListings: number;
    pendingApplications: number;
    totalRevenue: number;
  }>;
  getAdminTrialMetrics(): Promise<AdminTrialMetrics>;
  getAdminVendors(): Promise<(Vendor & {
    listings: (VendorListing & {
      category: Category;
      taluka: Taluka;
      subscription?: Subscription;
      current_trial?: ListingTrial;
      trials?: ListingTrial[];
    })[];
  })[]>;
  getAdminApplications(): Promise<VendorApplication[]>;
  
  // Trial Lifecycle
  startTrial(params: {
    listing_id: string;
    start_date?: string;
    is_override?: boolean;
    override_reason?: string;
    admin_id?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    trial?: ListingTrial;
    active_count?: number;
    max_slots?: number;
  }>;

  convertTrialToPaid(params: {
    listing_id: string;
    amount: number;
    payment_method: PaymentMethod;
    reference_number: string;
    notes?: string;
    admin_id?: string;
    custom_start_date?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    subscription?: Subscription;
    trial_converted?: boolean;
    active_count?: number;
    max_slots?: number;
  }>;

  activateListing(params: {
    listing_id: string;
    amount: number;
    payment_method: PaymentMethod;
    reference_number: string;
    notes?: string;
    admin_id?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    active_count?: number;
    max_slots?: number;
    subscription?: Subscription;
  }>;

  // Performance Reporting & Snapshots
  getListingPerformanceReport(params: {
    vendor_id: string;
    listing_id?: string;
    range_type?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<ListingReportResult>;

  saveReportSnapshot(params: {
    vendor_id: string;
    vendor_listing_id?: string;
    from_date: string;
    to_date: string;
    report_type: 'listing' | 'combined_vendor';
    metrics: PerformanceMetrics;
    notes?: string;
    admin_id?: string;
  }): Promise<VendorReportSnapshot>;

  updateVendorProfile(
    vendorId: string,
    updates: Partial<Pick<Vendor, 'provider_name' | 'business_name' | 'mobile' | 'whatsapp_number' | 'full_address' | 'google_maps_url' | 'experience_years' | 'profile_image_url' | 'description_mr' | 'description_en'>>
  ): Promise<{ success: boolean; error?: string }>;

  getPayments(): Promise<Payment[]>;

  // Admin getters (including inactive records)
  getAllDistrictsAdmin(): Promise<District[]>;
  getAllTalukasAdmin(): Promise<(Taluka & { district?: District })[]>;
  getAllCategoriesAdmin(): Promise<Category[]>;

  // Location & Category Management
  addDistrict(district: Omit<District, 'id' | 'created_at' | 'updated_at'>): Promise<District>;
  updateDistrict(id: string, updates: Partial<Pick<District, 'name_en' | 'name_mr' | 'slug' | 'is_active' | 'is_featured' | 'sort_order'>>): Promise<{ success: boolean; error?: string }>;
  addTaluka(taluka: Omit<Taluka, 'id' | 'created_at' | 'updated_at' | 'district'>): Promise<Taluka>;
  updateTaluka(id: string, updates: Partial<Pick<Taluka, 'district_id' | 'name_en' | 'name_mr' | 'slug' | 'is_active' | 'is_featured' | 'sort_order'>>): Promise<{ success: boolean; error?: string }>;
  addCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category>;
  updateCategory(id: string, updates: Partial<Pick<Category, 'name_en' | 'name_mr' | 'slug' | 'description_en' | 'description_mr' | 'icon_key' | 'is_visible' | 'is_featured' | 'aliases' | 'sort_order'>>): Promise<{ success: boolean; error?: string }>;
}

// In-Memory Dev Store
class MockDataRepository implements DataRepository {
  private districts: District[] = [
    { id: 'd1111111-1111-1111-1111-111111111111', name_en: 'Ahilyanagar', name_mr: 'अहिल्यानगर', slug: 'ahilyanagar', is_active: true, is_featured: true, sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 'd2222222-2222-2222-2222-222222222222', name_en: 'Pune', name_mr: 'पुणे', slug: 'pune', is_active: true, is_featured: true, sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 'd3333333-3333-3333-3333-333333333333', name_en: 'Nashik', name_mr: 'नाशिक', slug: 'nashik', is_active: true, is_featured: false, sort_order: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ];

  private talukas: Taluka[] = [
    { id: 't1111111-1111-1111-1111-111111111111', district_id: 'd1111111-1111-1111-1111-111111111111', name_en: 'Sangamner', name_mr: 'संगमनेर', slug: 'sangamner', is_active: true, is_featured: true, sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 't2222222-2222-2222-2222-222222222222', district_id: 'd1111111-1111-1111-1111-111111111111', name_en: 'Akole', name_mr: 'अकोले', slug: 'akole', is_active: true, is_featured: true, sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 't3333333-3333-3333-3333-333333333333', district_id: 'd2222222-2222-2222-2222-222222222222', name_en: 'Haveli', name_mr: 'हवेली', slug: 'haveli', is_active: true, is_featured: false, sort_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: 't4444444-4444-4444-4444-444444444444', district_id: 'd2222222-2222-2222-2222-222222222222', name_en: 'Baramati', name_mr: 'बारामती', slug: 'baramati', is_active: true, is_featured: false, sort_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ];

  private categories: Category[] = [
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      name_en: 'Electrician',
      name_mr: 'इलेक्ट्रिशियन',
      slug: 'electrician',
      description_en: 'Home wiring, motor repair, inverter & appliance connections.',
      description_mr: 'घरातील वायरिंग, मोटार दुरुस्ती, इन्व्हर्टर आणि फिटिंग कामे.',
      icon_key: 'zap',
      is_visible: true,
      is_featured: true,
      aliases: [
        'light', 'wiring', 'bijli', 'vidyut', 'current', 'fan', 'switch', 'motor', 'motar', 'inverter',
        'इन्व्हर्टर', 'वायरमन', 'फॅन', 'वीज', 'लाइट', 'इलेक्ट्रिक', 'इलेक्ट्रिशियन', 'मीटर', 'शॉर्ट सर्किट', 'बल्ब'
      ],
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'c2222222-2222-2222-2222-222222222222',
      name_en: 'Plumber',
      name_mr: 'प्लंबर',
      slug: 'plumber',
      description_en: 'Pipe fitting, leakage repair, tap & bathroom sanitary work.',
      description_mr: 'नळ दुरुस्ती, पाईपलाईन, लीकेज, बाथरूम व सॅनिटरी फिटिंग्ज.',
      icon_key: 'droplet',
      is_visible: true,
      is_featured: true,
      aliases: [
        'nal', 'nalka', 'pipe', 'leakage', 'tap', 'fitting', 'sanitary', 'bathroom', 'tank', 'borewell',
        'बोरवेल', 'नळ', 'पाणी', 'पाईप', 'लिकेज', 'प्लंबर', 'नल', 'फिटिंग', 'टाकी', 'सॅनिटरी', 'वॉशबेसिन'
      ],
      sort_order: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'c3333333-3333-3333-3333-333333333333',
      name_en: 'Carpenter',
      name_mr: 'सुतारकाम',
      slug: 'carpenter',
      description_en: 'Furniture repair, door, window & wooden fixtures.',
      description_mr: 'लाकडी फर्निचर, दरवाजे, खिडक्या आणि नवीन कपाट कामे.',
      icon_key: 'hammer',
      is_visible: true,
      is_featured: true,
      aliases: [
        'sutar', 'furniture', 'wood', 'door', 'lakud', 'khidki', 'table', 'cupboard', 'kapat', 'bed',
        'टेबल', 'कपाट', 'लाकूड', 'फर्निचर', 'दरवाजा', 'सुतार', 'सुतारकाम', 'कारपेंटर', 'खिडकी', 'लाकुड'
      ],
      sort_order: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'c4444444-4444-4444-4444-444444444444',
      name_en: 'Painter',
      name_mr: 'रंगकाम',
      slug: 'painter',
      description_en: 'Interior, exterior wall painting, waterproof coating.',
      description_mr: 'घराचे रंगकाम, ऑइल पेंट, डिस्टेंपर आणि वॉटरप्रूफिंग.',
      icon_key: 'paint-bucket',
      is_visible: true,
      is_featured: true,
      aliases: [
        'rang', 'rangari', 'painting', 'color', 'colour', 'varnish', 'whitewash', 'distemper', 'putty', 'paint',
        'रंग', 'रंगकाम', 'डिस्टेंपर', 'पुट्टी', 'पेंटर', 'कलर', 'वॉटरप्रूफिंग', 'रंगारी'
      ],
      sort_order: 4,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'c5555555-5555-5555-5555-555555555555',
      name_en: 'Appliance Repair',
      name_mr: 'घरगुती उपकरणे दुरुस्ती',
      slug: 'appliance-repair',
      description_en: 'Refrigerator, washing machine, TV, mixer grinder repair.',
      description_mr: 'फ्रिज, वॉशिंग मशीन, टीव्ही आणि मिक्सर दुरुस्ती.',
      icon_key: 'tv',
      is_visible: true,
      is_featured: false,
      aliases: [
        'fridge', 'freeze', 'washing machine', 'tv', 'microwave', 'cooler', 'geyser', 'repair', 'ac',
        'दुरुस्ती', 'टीव्ही', 'फ्रिज', 'कुलर', 'गिझर', 'मशीन', 'मिक्सर', 'एसी', 'ओव्हन'
      ],
      sort_order: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'c6666666-6666-6666-6666-666666666666',
      name_en: 'Mason',
      name_mr: 'गवंडी',
      slug: 'mason',
      description_en: 'Brickwork, plastering, tiling and house construction renovation.',
      description_mr: 'वीटकाम, प्लास्टर, टाइल्स बसवणे आणि बांधकाम दुरुस्ती.',
      icon_key: 'home',
      is_visible: true,
      is_featured: false,
      aliases: [
        'gavandi', 'construction', 'brick', 'tile', 'tiles', 'cement', 'plaster', 'renovation', 'house',
        'गवंडी', 'बांधकाम', 'टाईल्स', 'प्लास्टर', 'विटा', 'मेसन', 'फ्लोअरिंग', 'घराचे काम'
      ],
      sort_order: 6,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
  ];

  private vendors: Vendor[] = [];
  private vendorListings: VendorListing[] = [];
  private subscriptions: Subscription[] = [];
  private listingTrials: ListingTrial[] = [];
  private payments: Payment[] = [];
  private applications: VendorApplication[] = [];
  private analyticsEvents: any[] = [];
  private reportSnapshots: VendorReportSnapshot[] = [];

  constructor() {
    this.seedDevData();
  }

  private seedDevData() {
    const rawProviders = [
      { name: 'राहुल रमेश पाटील', biz: 'राहुल इलेक्ट्रिकल सर्व्हिसेस', mob: '+919822011101', exp: 8, addr: 'नेहरू चौक, संगमनेर, अहिल्यानगर', verified: true, slug: 'rahul-electricals-sangamner-7k1a' },
      { name: 'ओंकार दिलीप थोरात', biz: 'ओमकार वायरिंग & मोटर्स', mob: '+919822022202', exp: 6, addr: 'अकोले बायपास रोड, संगमनेर', verified: true, slug: 'omkar-wiring-sangamner-9m2b' },
      { name: 'सचिन विठ्ठल तांबे', biz: 'श्री समर्थ इलेक्ट्रिकल', mob: '+919822033303', exp: 12, addr: 'बाजार पेठ, संगमनेर', verified: true, slug: 'shree-samarth-electricals-sangamner-3k8c' },
      { name: 'गणेश बबन गाडे', biz: 'गणेश लाईट फिटिंग', mob: '+919822044404', exp: 5, addr: 'मालदाड रोड, संगमनेर', verified: false, slug: 'ganesh-light-fitting-sangamner-4f9d' },
      { name: 'ज्ञानेश्वर विष्णू देशमुख', biz: 'माऊली पॉवर सोल्युशन्स', mob: '+919822055505', exp: 10, addr: 'गुंजाळवाडी फाटा, संगमनेर', verified: true, slug: 'mauli-power-solutions-sangamner-5g2e' },
      { name: 'बाळासाहेब अर्जुन वाकचौरे', biz: 'बालाजी इलेक्ट्रिकल वर्क्स', mob: '+919822066606', exp: 7, addr: 'नवीन नगर रोड, संगमनेर', verified: true, slug: 'balaji-electrical-works-sangamner-6h3f' },
      { name: 'संदीप भास्कर नवले', biz: 'साई इलेक्ट्रिकल सर्व्हिसेस', mob: '+919822077707', exp: 4, addr: 'घुलेवाडी, संगमनेर', verified: false, slug: 'sai-electricals-sangamner-7j4g' },
      { name: 'विकास आनंदराव शिंदे', biz: 'जय भवानी वायरमन सर्व्हिस', mob: '+919822088808', exp: 9, addr: 'चंदनापुरी घाट रोड, संगमनेर', verified: true, slug: 'jay-bhavani-wireman-sangamner-8k5h' },
      { name: 'किरण मारुती कानवडे', biz: 'किसान मोटर रिवाइंडिंग & वायरिंग', mob: '+919822099909', exp: 15, addr: 'धांदरफळ, संगमनेर', verified: true, slug: 'kisan-motor-rewinding-sangamner-9l6j' },
      { name: 'अमित सुभाष जगताप', biz: 'स्वस्तिक इलेक्ट्रिकल अँड हार्डवेअर', mob: '+919822101010', exp: 3, addr: 'संगमनेर खुर्द, संगमनेर', verified: true, slug: 'swastik-electricals-sangamner-1m7k' },
    ];

    // Seed 10 Sangamner Electrician providers:
    // 7 with active paid subscriptions (idx 0..6)
    // 3 with active free trials (idx 7..9):
    //   - idx 7: Trial started 12 days ago, 18 days left
    //   - idx 8: Trial started 25 days ago, 5 days left (expiring in 7 days!)
    //   - idx 9: Trial started 28 days ago, 2 days left (expiring in 3 days!)
    rawProviders.forEach((p, idx) => {
      const vId = `v-dev-${idx + 1}`;
      const lId = `l-dev-${idx + 1}`;
      const isPaid = idx < 7;
      const isTrial = idx >= 7;

      const activatedDate = new Date(Date.now() - (idx + 1) * 86400000).toISOString();

      this.vendors.push({
        id: vId,
        slug: p.slug,
        provider_name: p.name,
        business_name: p.biz,
        mobile: p.mob,
        whatsapp_number: p.mob,
        experience_years: p.exp,
        full_address: p.addr,
        google_maps_url: 'https://maps.google.com/?q=Sangamner',
        latitude: 19.5762,
        longitude: 74.2070,
        profile_image_url: null,
        description_en: 'Experienced local technician offering electrical installations, repairs and wiring.',
        description_mr: 'घरातील वायरिंग, मोटर दुरुस्ती, इन्व्हर्टर कनेक्शन आणि सर्व प्रकारची लाईट कामे.',
        approval_status: 'approved',
        is_suspended: false,
        is_verified: p.verified,
        is_publicly_visible: true,
        portal_enabled: true,
        admin_notes: 'Verified provider profile.',
        created_at: activatedDate,
        updated_at: activatedDate,
      });

      this.vendorListings.push({
        id: lId,
        vendor_id: vId,
        category_id: 'c1111111-1111-1111-1111-111111111111',
        taluka_id: 't1111111-1111-1111-1111-111111111111',
        approval_status: 'approved',
        is_visible: true,
        approved_at: activatedDate,
        first_activated_at: activatedDate,
        created_at: activatedDate,
        updated_at: activatedDate,
      });

      if (isPaid) {
        const sId = `s-dev-${idx + 1}`;
        const oneYearLater = new Date(Date.now() + 365 * 86400000).toISOString();
        this.subscriptions.push({
          id: sId,
          vendor_listing_id: lId,
          amount: 999.00,
          currency: 'INR',
          starts_at: activatedDate,
          ends_at: oneYearLater,
          status: 'active',
          created_at: activatedDate,
          updated_at: activatedDate,
        });

        this.payments.push({
          id: `pay-dev-${idx + 1}`,
          vendor_listing_id: lId,
          vendor_id: vId,
          subscription_id: sId,
          amount: 999.00,
          currency: 'INR',
          payment_method: 'upi',
          payment_date: activatedDate.substring(0, 10),
          reference_number: `UPI-TEST-${100000 + idx + 1}`,
          notes: 'Annual subscription fee receipt',
          recorded_by_user_id: null,
          created_at: activatedDate,
        });
      } else if (isTrial) {
        // Active 30-day free trial
        let daysAgo = 12;
        if (idx === 8) daysAgo = 25; // 5 days remaining
        if (idx === 9) daysAgo = 28; // 2 days remaining

        const trialStart = new Date(Date.now() - daysAgo * 86400000).toISOString();
        const trialEnd = new Date(Date.now() + (30 - daysAgo) * 86400000).toISOString();

        this.listingTrials.push({
          id: `tr-dev-${idx + 1}`,
          vendor_listing_id: lId,
          starts_at: trialStart,
          ends_at: trialEnd,
          status: 'active',
          converted_at: null,
          converted_subscription_id: null,
          is_override: false,
          override_reason: null,
          created_by: null,
          created_at: trialStart,
          updated_at: trialStart,
        });
      }
    });

    // Seed 2 waitlisted providers for Sangamner + Electrician
    const waitlisted = [
      { name: 'नितिन भागवत कुटे', biz: 'कुटे इलेक्ट्रिकल', mob: '+919822111111', exp: 4, addr: 'जोर्वे रोड, संगमनेर', slug: 'kute-electricals-sangamner-2n8l' },
      { name: 'दीपक पोपट जाधव', biz: 'जाधव वायरमन वर्क्स', mob: '+919822121212', exp: 6, addr: 'समनापूर, संगमनेर', slug: 'jadhav-wireman-sangamner-3p9m' },
    ];

    waitlisted.forEach((p, idx) => {
      const vId = `v-wait-${idx + 1}`;
      const lId = `l-wait-${idx + 1}`;
      this.vendors.push({
        id: vId,
        slug: p.slug,
        provider_name: p.name,
        business_name: p.biz,
        mobile: p.mob,
        whatsapp_number: p.mob,
        experience_years: p.exp,
        full_address: p.addr,
        google_maps_url: null,
        latitude: null,
        longitude: null,
        profile_image_url: null,
        description_en: null,
        description_mr: null,
        approval_status: 'approved',
        is_suspended: false,
        is_verified: true,
        is_publicly_visible: true,
        portal_enabled: false,
        admin_notes: 'Awaiting slot opening (10/10 slots full).',
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      });

      this.vendorListings.push({
        id: lId,
        vendor_id: vId,
        category_id: 'c1111111-1111-1111-1111-111111111111',
        taluka_id: 't1111111-1111-1111-1111-111111111111',
        approval_status: 'waitlisted',
        is_visible: true,
        approved_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        first_activated_at: null,
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // Seed 1 expired trial for Sangamner + Plumber (trial ended 5 days ago, unpaid)
    const expTrialVendor: Vendor = {
      id: 'v-exp-trial-1',
      slug: 'pawar-plumbing-sangamner-4q1n',
      provider_name: 'प्रशांत शंकर पवार',
      business_name: 'पवार प्लंबिंग वर्क्स',
      mobile: '+919822131313',
      whatsapp_number: '+919822131313',
      experience_years: 11,
      full_address: 'कौठे कमलेश्वर, संगमनेर',
      google_maps_url: null,
      latitude: null,
      longitude: null,
      profile_image_url: null,
      description_en: 'Expert plumbing services',
      description_mr: 'नळ फिटिंग व लिकेज कामे',
      approval_status: 'approved',
      is_suspended: false,
      is_verified: true,
      is_publicly_visible: true,
      portal_enabled: true,
      admin_notes: 'Free trial expired 5 days ago without payment.',
      created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vendors.push(expTrialVendor);

    this.vendorListings.push({
      id: 'l-exp-trial-1',
      vendor_id: 'v-exp-trial-1',
      category_id: 'c2222222-2222-2222-2222-222222222222',
      taluka_id: 't1111111-1111-1111-1111-111111111111',
      approval_status: 'approved',
      is_visible: true,
      approved_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      first_activated_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.listingTrials.push({
      id: 'tr-exp-1',
      vendor_listing_id: 'l-exp-trial-1',
      starts_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      ends_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      status: 'expired',
      converted_at: null,
      converted_subscription_id: null,
      is_override: false,
      override_reason: null,
      created_by: null,
      created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed 1 converted trial for Sangamner + Carpenter
    const convVendor: Vendor = {
      id: 'v-conv-1',
      slug: 'vishwakarma-furniture-sangamner-8c3r',
      provider_name: 'सुरेश रामदास विश्वकर्मा',
      business_name: 'विश्वकर्मा फर्निचर & वर्क्स',
      mobile: '+919822161616',
      whatsapp_number: '+919822161616',
      experience_years: 14,
      full_address: 'नवीन बस स्टँड मागे, संगमनेर',
      google_maps_url: null,
      latitude: null,
      longitude: null,
      profile_image_url: null,
      description_en: 'Custom woodwork, doors, furniture crafting and polishing.',
      description_mr: 'लाकडी कामे, दरवाजे, कपाटे, नवीन फर्निचर व पॉलिश.',
      approval_status: 'approved',
      is_suspended: false,
      is_verified: true,
      is_publicly_visible: true,
      portal_enabled: true,
      admin_notes: 'Successfully converted from free trial to annual paid subscription.',
      created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vendors.push(convVendor);

    this.vendorListings.push({
      id: 'l-conv-1',
      vendor_id: 'v-conv-1',
      category_id: 'c3333333-3333-3333-3333-333333333333',
      taluka_id: 't1111111-1111-1111-1111-111111111111',
      approval_status: 'approved',
      is_visible: true,
      approved_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      first_activated_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    const trialStartDate = new Date(Date.now() - 45 * 86400000).toISOString();
    const trialEndDate = new Date(Date.now() - 15 * 86400000).toISOString();
    const subEndDate = new Date(Date.now() + 350 * 86400000).toISOString();

    this.subscriptions.push({
      id: 's-conv-1',
      vendor_listing_id: 'l-conv-1',
      amount: 999.00,
      currency: 'INR',
      starts_at: trialEndDate,
      ends_at: subEndDate,
      status: 'active',
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    });

    this.listingTrials.push({
      id: 'tr-conv-1',
      vendor_listing_id: 'l-conv-1',
      starts_at: trialStartDate,
      ends_at: trialEndDate,
      status: 'converted',
      converted_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      converted_subscription_id: 's-conv-1',
      is_override: false,
      override_reason: null,
      created_by: null,
      created_at: trialStartDate,
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    });

    // Seed 1 unpaid approved listing for Akole + Electrician
    const unpaidVendor: Vendor = {
      id: 'v-unpaid-1',
      slug: 'akole-electricals-akole-5r2p',
      provider_name: 'मनोज बबन नवले',
      business_name: 'अकोले इलेक्ट्रिकल',
      mobile: '+919822141414',
      whatsapp_number: '+919822141414',
      experience_years: 5,
      full_address: 'अगस्ति मंदिर रोड, अकोले',
      google_maps_url: null,
      latitude: null,
      longitude: null,
      profile_image_url: null,
      description_en: null,
      description_mr: null,
      approval_status: 'approved',
      is_suspended: false,
      is_verified: true,
      is_publicly_visible: true,
      portal_enabled: false,
      admin_notes: 'Approved application, ready for 30-day trial or annual payment.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vendors.push(unpaidVendor);

    this.vendorListings.push({
      id: 'l-unpaid-1',
      vendor_id: 'v-unpaid-1',
      category_id: 'c1111111-1111-1111-1111-111111111111',
      taluka_id: 't2222222-2222-2222-2222-222222222222',
      approval_status: 'approved',
      is_visible: true,
      approved_at: new Date().toISOString(),
      first_activated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed sample pending application
    this.applications.push({
      id: 'app-sample-1',
      provider_name: 'विठ्ठल एकनाथ शिंदे',
      business_name: 'शिंदे प्लंबिंग सर्व्हिस',
      mobile: '+919822151515',
      whatsapp_number: '+919822151515',
      district_id: 'd1111111-1111-1111-1111-111111111111',
      taluka_id: 't1111111-1111-1111-1111-111111111111',
      experience_years: 7,
      full_address: 'शिवाजी रोड, संगमनेर',
      service_areas_text: 'संगमनेर शहर, घुलेवाडी, धांदरफळ, जोर्वे',
      google_maps_url: null,
      image_path: null,
      status: 'pending',
      rejection_reason: null,
      internal_notes: 'Application received via website. Contact for verification.',
      consent_agreed: true,
      turnstile_verified: true,
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    });

    // Seed realistic analytics events:
    // For v-dev-1 (Rahul Ramesh Patil, listing l-dev-1):
    // Exactly matches Section 15 example: 186 views, 34 calls, 21 whatsapp, 8 directions, 6 shares (Total contact actions: 63)
    const seedEventCounts = [
      { vId: 'v-dev-1', lId: 'l-dev-1', views: 186, calls: 34, wa: 21, dir: 8, shares: 6 },
      { vId: 'v-dev-8', lId: 'l-dev-8', views: 230, calls: 31, wa: 26, dir: 11, shares: 5 }, // Section 17 example: 68 total contact actions
      { vId: 'v-conv-1', lId: 'l-conv-1', views: 112, calls: 19, wa: 14, dir: 7, shares: 3 },
    ];

    seedEventCounts.forEach(cfg => {
      const nowMs = Date.now();
      const addEvents = (type: AnalyticsEventType, count: number) => {
        for (let i = 0; i < count; i++) {
          // Spread across past 25 days
          const offsetMs = (i % 25) * 86400000 + (i * 3600000) % 86400000;
          this.analyticsEvents.push({
            id: `ev-${cfg.vId}-${type}-${i}`,
            vendor_id: cfg.vId,
            vendor_listing_id: cfg.lId,
            event_type: type,
            page_path: `/mr/provider/${cfg.vId}`,
            locale: 'mr',
            occurred_at: new Date(nowMs - offsetMs).toISOString(),
          });
        }
      };
      addEvents('profile_view', cfg.views);
      addEvents('call_click', cfg.calls);
      addEvents('whatsapp_click', cfg.wa);
      addEvents('directions_click', cfg.dir);
      addEvents('share_click', cfg.shares);
    });
  }

  private countActiveListings(talukaId: string, categoryId: string, excludeListingId?: string): number {
    const now = new Date();
    return this.vendorListings.filter(l => {
      if (excludeListingId && l.id === excludeListingId) return false;
      if (l.taluka_id !== talukaId || l.category_id !== categoryId) return false;
      const vendor = this.vendors.find(v => v.id === l.vendor_id);
      if (!vendor) return false;

      const trial = this.listingTrials.find(t => t.vendor_listing_id === l.id && (t.status === 'active' || t.status === 'converted') && isTrialActive(t, now));
      const sub = this.subscriptions.find(s => s.vendor_listing_id === l.id && s.status === 'active' && isSubscriptionActive(s, now));

      return isListingEligible({
        listingApprovalStatus: l.approval_status,
        listingIsVisible: l.is_visible,
        vendorApprovalStatus: vendor.approval_status,
        vendorIsSuspended: vendor.is_suspended,
        vendorIsPubliclyVisible: vendor.is_publicly_visible,
        trial,
        subscription: sub,
        now,
      });
    }).length;
  }

  async getDistricts(): Promise<District[]> {
    return this.districts.filter(d => d.is_active);
  }

  async getDistrictBySlug(slug: string): Promise<District | null> {
    return this.districts.find(d => d.slug === slug && d.is_active) || null;
  }

  async getTalukas(districtId?: string): Promise<Taluka[]> {
    let list = this.talukas.filter(t => t.is_active);
    if (districtId) {
      list = list.filter(t => t.district_id === districtId);
    }
    return list;
  }

  async getTalukaBySlugs(districtSlug: string, talukaSlug: string): Promise<Taluka | null> {
    const district = await this.getDistrictBySlug(districtSlug);
    if (!district) return null;
    const taluka = this.talukas.find(t => t.district_id === district.id && t.slug === talukaSlug && t.is_active);
    if (!taluka) return null;
    return { ...taluka, district };
  }

  async getCategories(): Promise<Category[]> {
    return this.categories.filter(c => c.is_visible);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.categories.find(c => c.slug === slug && c.is_visible) || null;
  }

  async getRotatedProviders(
    talukaId: string,
    categoryId: string,
    date: Date = new Date()
  ): Promise<RotatedProviderItem[]> {
    // 1. Filter eligible active listings (trial or paid)
    const eligible = this.vendorListings.filter(l => {
      if (l.taluka_id !== talukaId || l.category_id !== categoryId) return false;

      const vendor = this.vendors.find(v => v.id === l.vendor_id);
      if (!vendor) return false;

      const trial = this.listingTrials.find(t => t.vendor_listing_id === l.id && isTrialActive(t, date));
      const sub = this.subscriptions.find(s => s.vendor_listing_id === l.id && isSubscriptionActive(s, date));

      return isListingEligible({
        listingApprovalStatus: l.approval_status,
        listingIsVisible: l.is_visible,
        vendorApprovalStatus: vendor.approval_status,
        vendorIsSuspended: vendor.is_suspended,
        vendorIsPubliclyVisible: vendor.is_publicly_visible,
        trial,
        subscription: sub,
        now: date,
      });
    });

    if (eligible.length === 0) return [];

    // Map to rotatable items
    const rotatableItems = eligible.map(l => {
      const vendor = this.vendors.find(v => v.id === l.vendor_id)!;
      return {
        id: l.id,
        first_activated_at: l.first_activated_at,
        listing_id: l.id,
        vendor_id: vendor.id,
        provider_name: vendor.provider_name,
        business_name: vendor.business_name,
        slug: vendor.slug,
        mobile: vendor.mobile,
        whatsapp_number: vendor.whatsapp_number,
        experience_years: vendor.experience_years,
        full_address: vendor.full_address,
        google_maps_url: vendor.google_maps_url,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        profile_image_url: vendor.profile_image_url,
        description_en: vendor.description_en,
        description_mr: vendor.description_mr,
        is_verified: vendor.is_verified,
      };
    });

    // Equal fair deterministic rotation: trials and paid providers rotate identically
    const rotated = rotateProvidersDaily(rotatableItems, date);

    return rotated.map((item, idx) => ({
      listing_id: item.listing_id,
      vendor_id: item.vendor_id,
      provider_name: item.provider_name,
      business_name: item.business_name,
      slug: item.slug,
      mobile: item.mobile,
      whatsapp_number: item.whatsapp_number,
      experience_years: item.experience_years,
      full_address: item.full_address,
      google_maps_url: item.google_maps_url,
      latitude: item.latitude,
      longitude: item.longitude,
      profile_image_url: item.profile_image_url,
      description_en: item.description_en,
      description_mr: item.description_mr,
      is_verified: item.is_verified,
      first_activated_at: item.first_activated_at || null,
      display_order: idx,
    }));
  }

  async getProviderBySlug(slug: string): Promise<{
    vendor: Vendor;
    listings: (VendorListing & {
      category: Category;
      taluka: Taluka;
      subscription?: Subscription;
      current_trial?: ListingTrial;
    })[];
    serviceAreas: string[];
    isEligible: boolean;
  } | null> {
    const vendor = this.vendors.find(v => v.slug === slug);
    if (!vendor) return null;

    const now = new Date();
    const listings = this.vendorListings
      .filter(l => l.vendor_id === vendor.id && l.approval_status === 'approved' && l.is_visible)
      .map(l => {
        const category = this.categories.find(c => c.id === l.category_id)!;
        const taluka = this.talukas.find(t => t.id === l.taluka_id)!;
        const sub = this.subscriptions.find(s => s.vendor_listing_id === l.id && s.status === 'active' && isSubscriptionActive(s, now));
        const trial = this.listingTrials.find(t => t.vendor_listing_id === l.id && isTrialActive(t, now));
        return {
          ...l,
          category,
          taluka,
          current_subscription: sub,
          current_trial: trial,
        };
      });

    // Eligible if at least one listing satisfies Condition A or Condition B
    const isEligible =
      vendor.approval_status === 'approved' &&
      !vendor.is_suspended &&
      vendor.is_publicly_visible &&
      listings.some(l =>
        isListingEligible({
          listingApprovalStatus: l.approval_status,
          listingIsVisible: l.is_visible,
          vendorApprovalStatus: vendor.approval_status,
          vendorIsSuspended: vendor.is_suspended,
          vendorIsPubliclyVisible: vendor.is_publicly_visible,
          trial: l.current_trial,
          subscription: l.current_subscription,
          now,
        })
      );

    return {
      vendor,
      listings,
      serviceAreas: ['संगमनेर शहर', 'घुलेवाडी', 'धांदरफळ', 'अकोले बायपास'],
      isEligible,
    };
  }

  async getDirectoryPageSettings(talukaId: string, categoryId: string): Promise<DirectoryPageSettings | null> {
    return null;
  }

  async submitVendorApplication(data: {
    provider_name: string;
    business_name?: string;
    mobile: string;
    whatsapp_number?: string;
    district_id: string;
    taluka_id: string;
    category_ids: string[];
    experience_years: number;
    full_address: string;
    service_areas_text: string;
    google_maps_url?: string;
    image_path?: string;
    consent_agreed: boolean;
    turnstile_verified?: boolean;
  }): Promise<{ id: string; success: boolean }> {
    const normalizedMobile = normalizeIndianMobile(data.mobile);
    const appId = `app-${Date.now()}`;
    const newApp: VendorApplication = {
      id: appId,
      provider_name: data.provider_name.trim(),
      business_name: data.business_name?.trim() || null,
      mobile: normalizedMobile,
      whatsapp_number: data.whatsapp_number ? normalizeIndianMobile(data.whatsapp_number) : normalizedMobile,
      district_id: data.district_id,
      taluka_id: data.taluka_id,
      experience_years: data.experience_years,
      full_address: data.full_address.trim(),
      service_areas_text: data.service_areas_text.trim(),
      google_maps_url: data.google_maps_url || null,
      image_path: data.image_path || null,
      status: 'pending',
      rejection_reason: null,
      internal_notes: null,
      consent_agreed: data.consent_agreed,
      turnstile_verified: data.turnstile_verified ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.applications.unshift(newApp);
    return { id: appId, success: true };
  }

  async recordAnalyticsEvent(data: {
    vendor_id: string;
    vendor_listing_id?: string;
    event_type: AnalyticsEventType;
    page_path: string;
    locale: string;
  }): Promise<void> {
    this.analyticsEvents.push({
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...data,
      occurred_at: new Date().toISOString(),
    });
  }

  async getAdminMetrics() {
    const now = new Date();
    const activeSubs = this.subscriptions.filter(s => s.status === 'active' && isSubscriptionActive(s, now));
    const activeTrs = this.listingTrials.filter(t => t.status === 'active' && isTrialActive(t, now));
    const totalRev = this.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const waitlisted = this.vendorListings.filter(l => l.approval_status === 'waitlisted').length;
    const pendingApps = this.applications.filter(a => a.status === 'pending').length;

    return {
      totalVendors: this.vendors.length,
      activeListings: activeSubs.length + activeTrs.length,
      activeTrials: activeTrs.length,
      waitlistedListings: waitlisted,
      pendingApplications: pendingApps,
      totalRevenue: totalRev,
    };
  }

  async getAdminTrialMetrics(): Promise<AdminTrialMetrics> {
    const now = Date.now();
    const activeTrials = this.listingTrials.filter(t => t.status === 'active' && isTrialActive(t, new Date(now)));
    
    const trialsExpiring7Days = activeTrials.filter(t => {
      const remaining = new Date(t.ends_at).getTime() - now;
      return remaining > 0 && remaining <= 7 * 86400000;
    }).length;

    const trialsExpiring3Days = activeTrials.filter(t => {
      const remaining = new Date(t.ends_at).getTime() - now;
      return remaining > 0 && remaining <= 3 * 86400000;
    }).length;

    const expiredUnpaidTrials = this.listingTrials.filter(t => {
      if (t.status === 'expired') return true;
      if (t.status === 'active' && new Date(t.ends_at).getTime() <= now) return true;
      return false;
    }).length;

    const convertedTrials = this.listingTrials.filter(t => t.status === 'converted').length;
    
    // Conversion rate denominator = completed trials (converted + expired).
    // Running/active trials are excluded from the denominator.
    const completedTrials = convertedTrials + expiredUnpaidTrials;
    const trialConversionRate = completedTrials > 0
      ? Math.round((convertedTrials / completedTrials) * 100)
      : 0;

    // Renewals upcoming
    const activeSubs = this.subscriptions.filter(s => s.status === 'active' && isSubscriptionActive(s, new Date(now)));
    const upcomingRenewals30Days = activeSubs.filter(s => {
      const remaining = new Date(s.ends_at).getTime() - now;
      return remaining > 0 && remaining <= 30 * 86400000;
    }).length;

    const upcomingRenewals15Days = activeSubs.filter(s => {
      const remaining = new Date(s.ends_at).getTime() - now;
      return remaining > 0 && remaining <= 15 * 86400000;
    }).length;

    const upcomingRenewals7Days = activeSubs.filter(s => {
      const remaining = new Date(s.ends_at).getTime() - now;
      return remaining > 0 && remaining <= 7 * 86400000;
    }).length;

    return {
      activeTrials: activeTrials.length,
      trialsExpiring7Days,
      trialsExpiring3Days,
      expiredUnpaidTrials,
      convertedTrials,
      trialConversionRate,
      completedTrials,
      upcomingRenewals30Days,
      upcomingRenewals15Days,
      upcomingRenewals7Days,
    };
  }

  async getAdminVendors() {
    const now = new Date();
    return this.vendors.map(v => {
      const listings = this.vendorListings
        .filter(l => l.vendor_id === v.id)
        .map(l => {
          const cat = this.categories.find(c => c.id === l.category_id)!;
          const tal = this.talukas.find(t => t.id === l.taluka_id)!;
          const sub = this.subscriptions
            .filter(s => s.vendor_listing_id === l.id && s.status === 'active')
            .sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0];
          const allTrials = this.listingTrials
            .filter(t => t.vendor_listing_id === l.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const curTrial = allTrials[0];

          return {
            ...l,
            category: cat,
            taluka: tal,
            subscription: sub,
            current_trial: curTrial,
            trials: allTrials,
          };
        });
      return { ...v, listings };
    });
  }

  async getAdminApplications() {
    return [...this.applications];
  }

  // Phase 2: Start 30-Day Free Trial
  async startTrial(params: {
    listing_id: string;
    start_date?: string;
    is_override?: boolean;
    override_reason?: string;
    admin_id?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    trial?: ListingTrial;
    active_count?: number;
    max_slots?: number;
  }> {
    const listing = this.vendorListings.find(l => l.id === params.listing_id);
    if (!listing) return { success: false, error: 'Listing not found' };

    const vendor = this.vendors.find(v => v.id === listing.vendor_id);
    if (!vendor || vendor.approval_status !== 'approved' || vendor.is_suspended) {
      return { success: false, error: 'Vendor must be approved and active to start a trial.' };
    }

    const maxSlots = 10;

    // Anti-abuse: check if free trial has already been used
    const existingTrials = this.listingTrials.filter(t => t.vendor_listing_id === listing.id);
    if (existingTrials.length > 0 && !params.is_override) {
      return {
        success: false,
        error: 'TRIAL_ALREADY_USED',
        message: 'A free trial has already been used for this listing. Admin override required with reason.',
      };
    }

    if (params.is_override && (!params.override_reason || !params.override_reason.trim())) {
      return {
        success: false,
        error: 'OVERRIDE_REASON_REQUIRED',
        message: 'Admin override reason is required when granting an additional trial.',
      };
    }

    // 10-Slot Limit Check: count current active slots (trial + paid)
    const activeCount = this.countActiveListings(listing.taluka_id, listing.category_id, listing.id);
    if (activeCount >= maxSlots) {
      listing.approval_status = 'waitlisted';
      listing.updated_at = new Date().toISOString();
      return {
        success: false,
        error: 'SLOT_LIMIT_REACHED',
        message: `All ${maxSlots} slots are currently occupied for this taluka and category. Listing placed in waitlist.`,
        active_count: activeCount,
        max_slots: maxSlots,
      };
    }

    // Calculate 30-day IST trial period
    const refDate = params.start_date ? new Date(params.start_date) : new Date();
    const { startsAt, endsAt } = calculateTrialPeriod(refDate);

    const trialId = `tr-${Date.now()}`;
    const newTrial: ListingTrial = {
      id: trialId,
      vendor_listing_id: listing.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'active',
      converted_at: null,
      converted_subscription_id: null,
      is_override: params.is_override || false,
      override_reason: params.override_reason || null,
      created_by: params.admin_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.listingTrials.push(newTrial);

    // Listing becomes publicly active
    listing.approval_status = 'approved';
    listing.is_visible = true;
    listing.approved_at = listing.approved_at || startsAt.toISOString();
    listing.first_activated_at = listing.first_activated_at || startsAt.toISOString();
    listing.updated_at = new Date().toISOString();

    return {
      success: true,
      trial: newTrial,
      active_count: activeCount + 1,
      max_slots: maxSlots,
    };
  }

  // Phase 2: Convert Trial to Paid Subscription (₹999/yr)
  async convertTrialToPaid(params: {
    listing_id: string;
    amount: number;
    payment_method: PaymentMethod;
    reference_number: string;
    notes?: string;
    admin_id?: string;
    custom_start_date?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    subscription?: Subscription;
    trial_converted?: boolean;
    active_count?: number;
    max_slots?: number;
  }> {
    const listing = this.vendorListings.find(l => l.id === params.listing_id);
    if (!listing) return { success: false, error: 'Listing not found' };

    const maxSlots = 10;
    const now = Date.now();

    // Check if an active trial currently exists
    const activeTrial = this.listingTrials.find(
      t => t.vendor_listing_id === listing.id && (t.status === 'active' || t.status === 'converted') && new Date(t.ends_at).getTime() > now
    );

    // If trial is NOT active (e.g. trial already expired), re-verify 10-slot capacity!
    if (!activeTrial) {
      const activeCount = this.countActiveListings(listing.taluka_id, listing.category_id, listing.id);
      if (activeCount >= maxSlots) {
        listing.approval_status = 'waitlisted';
        listing.updated_at = new Date().toISOString();
        return {
          success: false,
          error: 'SLOT_LIMIT_REACHED',
          message: `Payment recorded but all ${maxSlots} slots are currently occupied. Listing placed on waiting list.`,
          active_count: activeCount,
          max_slots: maxSlots,
        };
      }
    }

    // Determine subscription dates:
    // If active trial exists, begins seamlessly when trial ends (preserves free trial days!)
    const refDate = params.custom_start_date ? new Date(params.custom_start_date) : new Date();
    const { startsAt, endsAt } = calculateConversionSubscriptionPeriod(activeTrial, refDate);

    const subId = `sub-${Date.now()}`;
    const newSub: Subscription = {
      id: subId,
      vendor_listing_id: listing.id,
      amount: params.amount,
      currency: 'INR',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.subscriptions.push(newSub);

    // Mark trial converted
    if (activeTrial) {
      activeTrial.status = 'converted';
      activeTrial.converted_at = new Date().toISOString();
      activeTrial.converted_subscription_id = subId;
      activeTrial.updated_at = new Date().toISOString();
    }

    // Record payment receipt
    this.payments.push({
      id: `pay-${Date.now()}`,
      vendor_listing_id: listing.id,
      vendor_id: listing.vendor_id,
      subscription_id: subId,
      amount: params.amount,
      currency: 'INR',
      payment_method: params.payment_method,
      payment_date: new Date().toISOString().substring(0, 10),
      reference_number: params.reference_number,
      notes: params.notes || null,
      recorded_by_user_id: params.admin_id || null,
      created_at: new Date().toISOString(),
    });

    listing.approval_status = 'approved';
    listing.is_visible = true;
    listing.approved_at = listing.approved_at || new Date().toISOString();
    listing.first_activated_at = listing.first_activated_at || new Date().toISOString();
    listing.updated_at = new Date().toISOString();

    const currentActiveCount = this.countActiveListings(listing.taluka_id, listing.category_id);

    return {
      success: true,
      subscription: newSub,
      trial_converted: Boolean(activeTrial),
      active_count: currentActiveCount,
      max_slots: maxSlots,
    };
  }

  // Activate Listing (General / Direct Annual)
  async activateListing(params: {
    listing_id: string;
    amount: number;
    payment_method: PaymentMethod;
    reference_number: string;
    notes?: string;
    admin_id?: string;
  }): Promise<{ success: boolean; error?: string; active_count?: number; max_slots?: number; subscription?: Subscription }> {
    const listing = this.vendorListings.find(l => l.id === params.listing_id);
    if (!listing) return { success: false, error: 'Listing not found' };

    const maxSlots = 10;
    const now = Date.now();

    // Check for active subscription or trial
    const existingSub = this.subscriptions.find(
      s => s.vendor_listing_id === listing.id && s.status === 'active' && new Date(s.ends_at).getTime() > now
    );
    const existingTrial = this.listingTrials.find(
      t => t.vendor_listing_id === listing.id && (t.status === 'active' || t.status === 'converted') && new Date(t.ends_at).getTime() > now
    );

    // If listing is NOT already active, check slot limit
    if (!existingSub && !existingTrial) {
      const activeCount = this.countActiveListings(listing.taluka_id, listing.category_id, listing.id);
      if (activeCount >= maxSlots) {
        listing.approval_status = 'waitlisted';
        listing.updated_at = new Date().toISOString();
        return {
          success: false,
          error: 'SLOT_LIMIT_REACHED',
          active_count: activeCount,
          max_slots: maxSlots,
        };
      }
    }

    const { startsAt, endsAt } = calculateSubscriptionPeriod(existingSub?.ends_at || existingTrial?.ends_at);

    const subId = `sub-${Date.now()}`;
    const newSub: Subscription = {
      id: subId,
      vendor_listing_id: listing.id,
      amount: params.amount,
      currency: 'INR',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.subscriptions.push(newSub);

    if (existingTrial) {
      existingTrial.status = 'converted';
      existingTrial.converted_at = new Date().toISOString();
      existingTrial.converted_subscription_id = subId;
      existingTrial.updated_at = new Date().toISOString();
    }

    this.payments.push({
      id: `pay-${Date.now()}`,
      vendor_listing_id: listing.id,
      vendor_id: listing.vendor_id,
      subscription_id: subId,
      amount: params.amount,
      currency: 'INR',
      payment_method: params.payment_method,
      payment_date: new Date().toISOString().substring(0, 10),
      reference_number: params.reference_number,
      notes: params.notes || null,
      recorded_by_user_id: params.admin_id || null,
      created_at: new Date().toISOString(),
    });

    listing.approval_status = 'approved';
    listing.is_visible = true;
    listing.approved_at = listing.approved_at || new Date().toISOString();
    listing.first_activated_at = listing.first_activated_at || new Date().toISOString();
    listing.updated_at = new Date().toISOString();

    const activeCount = this.countActiveListings(listing.taluka_id, listing.category_id);

    return {
      success: true,
      active_count: activeCount,
      max_slots: maxSlots,
      subscription: newSub,
    };
  }

  // Phase 2: Listing & Vendor Performance Reporting
  async getListingPerformanceReport(params: {
    vendor_id: string;
    listing_id?: string;
    range_type?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<ListingReportResult> {
    const vendor = this.vendors.find(v => v.id === params.vendor_id);
    if (!vendor) throw new Error('Vendor not found');

    const vendorListings = this.vendorListings.filter(l => l.vendor_id === vendor.id);
    const enrichedListings = vendorListings.map(l => {
      const cat = this.categories.find(c => c.id === l.category_id)!;
      const tal = this.talukas.find(t => t.id === l.taluka_id)!;
      const sub = this.subscriptions.find(s => s.vendor_listing_id === l.id && s.status === 'active');
      const tr = this.listingTrials.find(t => t.vendor_listing_id === l.id && t.status === 'active');
      return { ...l, category: cat, taluka: tal, subscription: sub, current_trial: tr };
    });

    const targetListing = params.listing_id
      ? enrichedListings.find(l => l.id === params.listing_id)
      : undefined;

    const now = new Date();
    let from = new Date(now.getTime() - 30 * 86400000);
    let to = now;

    const rangeType = params.range_type || '30d';

    if (rangeType === '7d') {
      from = new Date(now.getTime() - 7 * 86400000);
      to = now;
    } else if (rangeType === '30d') {
      from = new Date(now.getTime() - 30 * 86400000);
      to = now;
    } else if (rangeType === '90d') {
      from = new Date(now.getTime() - 90 * 86400000);
      to = now;
    } else if (rangeType === 'all') {
      from = new Date('2026-01-01T00:00:00Z');
      to = now;
    } else if (rangeType === 'trial') {
      const tr = targetListing?.current_trial || this.listingTrials.find(t => t.vendor_listing_id === params.listing_id);
      if (tr) {
        from = new Date(tr.starts_at);
        to = new Date(tr.ends_at) > now ? now : new Date(tr.ends_at);
      }
    } else if (rangeType === 'subscription') {
      const sub = targetListing?.subscription || this.subscriptions.find(s => s.vendor_listing_id === params.listing_id);
      if (sub) {
        from = new Date(sub.starts_at);
        to = new Date(sub.ends_at) > now ? now : new Date(sub.ends_at);
      }
    } else if (rangeType === 'custom' && params.from_date && params.to_date) {
      from = new Date(params.from_date);
      to = new Date(params.to_date);
    }

    const fromTime = from.getTime();
    const toTime = to.getTime();

    // Filter events for vendor and optional listing
    const filteredEvents = this.analyticsEvents.filter(ev => {
      if (ev.vendor_id !== vendor.id) return false;
      if (params.listing_id && ev.vendor_listing_id && ev.vendor_listing_id !== params.listing_id) {
        return false;
      }
      const evTime = new Date(ev.occurred_at).getTime();
      return evTime >= fromTime && evTime <= toTime;
    });

    const calculateMetricsForEvents = (events: any[]): PerformanceMetrics => {
      let views = 0;
      let calls = 0;
      let wa = 0;
      let dir = 0;
      let shares = 0;

      for (const e of events) {
        if (e.event_type === 'profile_view') views++;
        else if (e.event_type === 'call_click') calls++;
        else if (e.event_type === 'whatsapp_click') wa++;
        else if (e.event_type === 'directions_click') dir++;
        else if (e.event_type === 'share_click') shares++;
      }

      return {
        profile_views: views,
        call_clicks: calls,
        whatsapp_clicks: wa,
        directions_clicks: dir,
        share_clicks: shares,
        total_contact_actions: calculateTotalContactActions({ call_clicks: calls, whatsapp_clicks: wa, directions_clicks: dir }),
      };
    };

    const overallMetrics = calculateMetricsForEvents(filteredEvents);

    // Category / Taluka breakdown if multiple listings exist
    const breakdown = enrichedListings.map(l => {
      const listingEvents = filteredEvents.filter(e => e.vendor_listing_id === l.id);
      return {
        listing_id: l.id,
        category_name_en: l.category.name_en,
        category_name_mr: l.category.name_mr,
        taluka_name_en: l.taluka.name_en,
        taluka_name_mr: l.taluka.name_mr,
        metrics: calculateMetricsForEvents(listingEvents),
      };
    });

    return {
      vendor,
      listing: targetListing,
      allListings: enrichedListings,
      range_type: rangeType,
      from_date: from.toISOString(),
      to_date: to.toISOString(),
      metrics: overallMetrics,
      breakdown: enrichedListings.length > 1 ? breakdown : undefined,
    };
  }

  async saveReportSnapshot(params: {
    vendor_id: string;
    vendor_listing_id?: string;
    from_date: string;
    to_date: string;
    report_type: 'listing' | 'combined_vendor';
    metrics: PerformanceMetrics;
    notes?: string;
    admin_id?: string;
  }): Promise<VendorReportSnapshot> {
    const snapId = `snap-${Date.now()}`;
    const snap: VendorReportSnapshot = {
      id: snapId,
      vendor_id: params.vendor_id,
      vendor_listing_id: params.vendor_listing_id || null,
      from_date: params.from_date,
      to_date: params.to_date,
      generated_at: new Date().toISOString(),
      report_type: params.report_type,
      metrics: params.metrics,
      notes: params.notes || null,
      created_by: params.admin_id || null,
    };
    this.reportSnapshots.push(snap);
    return snap;
  }

  async updateVendorProfile(
    vendorId: string,
    updates: Partial<Pick<Vendor, 'provider_name' | 'business_name' | 'mobile' | 'whatsapp_number' | 'full_address' | 'google_maps_url' | 'experience_years' | 'profile_image_url' | 'description_mr' | 'description_en'>>
  ): Promise<{ success: boolean; error?: string }> {
    const vendor = this.vendors.find(v => v.id === vendorId);
    if (!vendor) return { success: false, error: 'Vendor not found' };

    Object.assign(vendor, updates, { updated_at: new Date().toISOString() });
    return { success: true };
  }

  async getPayments(): Promise<Payment[]> {
    return [...this.payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getAllDistrictsAdmin(): Promise<District[]> {
    return [...this.districts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  async getAllTalukasAdmin(): Promise<(Taluka & { district?: District })[]> {
    return this.talukas.map(t => ({
      ...t,
      district: this.districts.find(d => d.id === t.district_id),
    })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  async getAllCategoriesAdmin(): Promise<Category[]> {
    return [...this.categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  async addDistrict(district: Omit<District, 'id' | 'created_at' | 'updated_at'>): Promise<District> {
    const newDistrict: District = {
      ...district,
      id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.districts.push(newDistrict);
    return newDistrict;
  }

  async updateDistrict(id: string, updates: Partial<Pick<District, 'name_en' | 'name_mr' | 'slug' | 'is_active' | 'is_featured' | 'sort_order'>>): Promise<{ success: boolean; error?: string }> {
    const district = this.districts.find(d => d.id === id);
    if (!district) return { success: false, error: 'District not found' };
    Object.assign(district, updates, { updated_at: new Date().toISOString() });
    return { success: true };
  }

  async addTaluka(taluka: Omit<Taluka, 'id' | 'created_at' | 'updated_at' | 'district'>): Promise<Taluka> {
    const newTaluka: Taluka = {
      ...taluka,
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.talukas.push(newTaluka);
    return newTaluka;
  }

  async updateTaluka(id: string, updates: Partial<Pick<Taluka, 'district_id' | 'name_en' | 'name_mr' | 'slug' | 'is_active' | 'is_featured' | 'sort_order'>>): Promise<{ success: boolean; error?: string }> {
    const taluka = this.talukas.find(t => t.id === id);
    if (!taluka) return { success: false, error: 'Taluka not found' };
    Object.assign(taluka, updates, { updated_at: new Date().toISOString() });
    return { success: true };
  }

  async addCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    const newCategory: Category = {
      ...category,
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.categories.push(newCategory);
    return newCategory;
  }

  async updateCategory(id: string, updates: Partial<Pick<Category, 'name_en' | 'name_mr' | 'slug' | 'description_en' | 'description_mr' | 'icon_key' | 'is_visible' | 'is_featured' | 'aliases' | 'sort_order'>>): Promise<{ success: boolean; error?: string }> {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) return { success: false, error: 'Category not found' };
    Object.assign(cat, updates, { updated_at: new Date().toISOString() });
    return { success: true };
  }
}

export class SupabaseDataRepository implements DataRepository {
  private client: SupabaseClient;
  private adminClient: SupabaseClient | null;
  private fallback: MockDataRepository;

  constructor(client: SupabaseClient, env?: Record<string, any>, fallback?: MockDataRepository) {
    this.client = client;
    this.adminClient = getAdminSupabaseClient(env);
    this.fallback = fallback || new MockDataRepository();
  }

  private getPrivilegedClient(): SupabaseClient {
    return this.adminClient || this.client;
  }

  async getDistricts(): Promise<District[]> {
    try {
      const { data, error } = await this.client
        .from('districts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error || !data) return this.fallback.getDistricts();
      return data;
    } catch {
      return this.fallback.getDistricts();
    }
  }

  async getDistrictBySlug(slug: string): Promise<District | null> {
    try {
      const { data, error } = await this.client
        .from('districts')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (error) return this.fallback.getDistrictBySlug(slug);
      return data;
    } catch {
      return this.fallback.getDistrictBySlug(slug);
    }
  }

  async getTalukas(districtId?: string): Promise<Taluka[]> {
    try {
      let query = this.client
        .from('talukas')
        .select('*, district:districts(*)')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (districtId) {
        query = query.eq('district_id', districtId);
      }
      const { data, error } = await query;
      if (error || !data) return this.fallback.getTalukas(districtId);
      return data;
    } catch {
      return this.fallback.getTalukas(districtId);
    }
  }

  async getTalukaBySlugs(districtSlug: string, talukaSlug: string): Promise<Taluka | null> {
    try {
      const { data, error } = await this.client
        .from('talukas')
        .select('*, district:districts!inner(*)')
        .eq('slug', talukaSlug)
        .eq('districts.slug', districtSlug)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return this.fallback.getTalukaBySlugs(districtSlug, talukaSlug);
      return data;
    } catch {
      return this.fallback.getTalukaBySlugs(districtSlug, talukaSlug);
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      const { data, error } = await this.client
        .from('categories')
        .select('*, category_aliases(alias)')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });
      if (error || !data) return this.fallback.getCategories();
      return data.map((c: any) => ({
        ...c,
        aliases: Array.isArray(c.category_aliases)
          ? c.category_aliases.map((a: any) => a.alias)
          : (c.aliases || []),
      }));
    } catch {
      return this.fallback.getCategories();
    }
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const { data, error } = await this.client
        .from('categories')
        .select('*, category_aliases(alias)')
        .eq('slug', slug)
        .eq('is_visible', true)
        .maybeSingle();
      if (error || !data) return this.fallback.getCategoryBySlug(slug);
      return {
        ...data,
        aliases: Array.isArray(data.category_aliases)
          ? data.category_aliases.map((a: any) => a.alias)
          : (data.aliases || []),
      };
    } catch {
      return this.fallback.getCategoryBySlug(slug);
    }
  }

  async getRotatedProviders(talukaId: string, categoryId: string, date: Date = new Date()): Promise<RotatedProviderItem[]> {
    try {
      return this.fallback.getRotatedProviders(talukaId, categoryId, date);
    } catch {
      return this.fallback.getRotatedProviders(talukaId, categoryId, date);
    }
  }

  async getProviderBySlug(slug: string): Promise<any> {
    try {
      return this.fallback.getProviderBySlug(slug);
    } catch {
      return this.fallback.getProviderBySlug(slug);
    }
  }

  async getDirectoryPageSettings(talukaId: string, categoryId: string): Promise<DirectoryPageSettings | null> {
    return this.fallback.getDirectoryPageSettings(talukaId, categoryId);
  }

  async submitVendorApplication(data: any): Promise<{ id: string; success: boolean }> {
    try {
      const client = this.getPrivilegedClient();
      const { data: res, error } = await client
        .from('vendor_applications')
        .insert([{
          provider_name: data.provider_name,
          business_name: data.business_name || null,
          mobile: data.mobile,
          whatsapp_number: data.whatsapp_number || data.mobile,
          district_id: data.district_id,
          taluka_id: data.taluka_id,
          experience_years: data.experience_years,
          full_address: data.full_address,
          service_areas_text: data.service_areas_text,
          google_maps_url: data.google_maps_url || null,
          image_path: data.image_path || null,
          consent_agreed: data.consent_agreed,
          turnstile_verified: data.turnstile_verified || false,
          status: 'pending',
        }])
        .select('id')
        .single();
      if (error || !res) return this.fallback.submitVendorApplication(data);
      return { id: res.id, success: true };
    } catch {
      return this.fallback.submitVendorApplication(data);
    }
  }

  async recordAnalyticsEvent(data: any): Promise<void> {
    try {
      await this.client.from('analytics_events').insert([data]);
    } catch {
      await this.fallback.recordAnalyticsEvent(data);
    }
  }

  async getAdminMetrics() {
    return this.fallback.getAdminMetrics();
  }

  async getAdminTrialMetrics(): Promise<AdminTrialMetrics> {
    return this.fallback.getAdminTrialMetrics();
  }

  async getAdminVendors() {
    return this.fallback.getAdminVendors();
  }

  async getAdminApplications(): Promise<VendorApplication[]> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('vendor_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return this.fallback.getAdminApplications();
      return data;
    } catch {
      return this.fallback.getAdminApplications();
    }
  }

  async startTrial(params: any) {
    return this.fallback.startTrial(params);
  }

  async convertTrialToPaid(params: any) {
    return this.fallback.convertTrialToPaid(params);
  }

  async activateListing(params: any) {
    return this.fallback.activateListing(params);
  }

  async getListingPerformanceReport(params: any) {
    return this.fallback.getListingPerformanceReport(params);
  }

  async saveReportSnapshot(params: any) {
    return this.fallback.saveReportSnapshot(params);
  }

  async updateVendorProfile(vendorId: string, updates: any) {
    try {
      const client = this.getPrivilegedClient();
      const { error } = await client
        .from('vendors')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', vendorId);
      if (error) return this.fallback.updateVendorProfile(vendorId, updates);
      return { success: true };
    } catch {
      return this.fallback.updateVendorProfile(vendorId, updates);
    }
  }

  async getPayments(): Promise<Payment[]> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return this.fallback.getPayments();
      return data;
    } catch {
      return this.fallback.getPayments();
    }
  }

  async getAllDistrictsAdmin(): Promise<District[]> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('districts')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error || !data) return this.fallback.getAllDistrictsAdmin();
      return data;
    } catch {
      return this.fallback.getAllDistrictsAdmin();
    }
  }

  async getAllTalukasAdmin(): Promise<(Taluka & { district?: District })[]> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('talukas')
        .select('*, district:districts(*)')
        .order('sort_order', { ascending: true });
      if (error || !data) return this.fallback.getAllTalukasAdmin();
      return data;
    } catch {
      return this.fallback.getAllTalukasAdmin();
    }
  }

  async getAllCategoriesAdmin(): Promise<Category[]> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('categories')
        .select('*, category_aliases(alias)')
        .order('sort_order', { ascending: true });
      if (error || !data) return this.fallback.getAllCategoriesAdmin();
      return data.map((c: any) => ({
        ...c,
        aliases: Array.isArray(c.category_aliases)
          ? c.category_aliases.map((a: any) => a.alias)
          : (c.aliases || []),
      }));
    } catch {
      return this.fallback.getAllCategoriesAdmin();
    }
  }

  async addDistrict(district: Omit<District, 'id' | 'created_at' | 'updated_at'>): Promise<District> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('districts')
        .insert([district])
        .select()
        .single();
      if (error || !data) return this.fallback.addDistrict(district);
      return data;
    } catch {
      return this.fallback.addDistrict(district);
    }
  }

  async updateDistrict(id: string, updates: Partial<Pick<District, 'name_en' | 'name_mr' | 'slug' | 'is_active' | 'is_featured' | 'sort_order'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getPrivilegedClient();
      const { error } = await client
        .from('districts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return this.fallback.updateDistrict(id, updates);
      return { success: true };
    } catch {
      return this.fallback.updateDistrict(id, updates);
    }
  }

  async addTaluka(taluka: Omit<Taluka, 'id' | 'created_at' | 'updated_at' | 'district'>): Promise<Taluka> {
    try {
      const client = this.getPrivilegedClient();
      const { data, error } = await client
        .from('talukas')
        .insert([taluka])
        .select()
        .single();
      if (error || !data) return this.fallback.addTaluka(taluka);
      return data;
    } catch {
      return this.fallback.addTaluka(taluka);
    }
  }

  async updateTaluka(id: string, updates: Partial<Pick<Taluka, 'district_id' | 'name_en' | 'name_mr' | 'slug' | 'is_active' | 'is_featured' | 'sort_order'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getPrivilegedClient();
      const { error } = await client
        .from('talukas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return this.fallback.updateTaluka(id, updates);
      return { success: true };
    } catch {
      return this.fallback.updateTaluka(id, updates);
    }
  }

  async addCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    try {
      const client = this.getPrivilegedClient();
      const { aliases, ...catData } = category as any;
      const { data, error } = await client
        .from('categories')
        .insert([catData])
        .select()
        .single();
      if (error || !data) return this.fallback.addCategory(category);
      if (aliases && Array.isArray(aliases) && aliases.length > 0) {
        const aliasInserts = aliases.map(a => ({ category_id: data.id, alias: a.trim() }));
        await client.from('category_aliases').insert(aliasInserts);
      }
      return { ...data, aliases: aliases || [] };
    } catch {
      return this.fallback.addCategory(category);
    }
  }

  async updateCategory(id: string, updates: Partial<Pick<Category, 'name_en' | 'name_mr' | 'slug' | 'description_en' | 'description_mr' | 'icon_key' | 'is_visible' | 'is_featured' | 'aliases' | 'sort_order'>>): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getPrivilegedClient();
      const { aliases, ...catUpdates } = updates as any;
      const { error } = await client
        .from('categories')
        .update({ ...catUpdates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return this.fallback.updateCategory(id, updates);
      if (aliases !== undefined && Array.isArray(aliases)) {
        await client.from('category_aliases').delete().eq('category_id', id);
        if (aliases.length > 0) {
          const aliasInserts = aliases.map((a: string) => ({ category_id: id, alias: a.trim() }));
          await client.from('category_aliases').insert(aliasInserts);
        }
      }
      return { success: true };
    } catch {
      return this.fallback.updateCategory(id, updates);
    }
  }
}

// Singleton repository instance
let mockRepoInstance: MockDataRepository | null = null;
let supabaseRepoInstance: SupabaseDataRepository | null = null;

export function getDataRepository(env?: Record<string, any>): DataRepository {
  if (!mockRepoInstance) {
    mockRepoInstance = new MockDataRepository();
  }
  const supabase = getPublicSupabaseClient(env);
  if (!supabase) {
    return mockRepoInstance;
  }
  if (!supabaseRepoInstance) {
    supabaseRepoInstance = new SupabaseDataRepository(supabase, env, mockRepoInstance);
  }
  return supabaseRepoInstance;
}
