export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'vendor';
export type VendorApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type ListingStatus = 'approved' | 'waitlisted' | 'suspended' | 'rejected';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type PaymentMethod = 'upi' | 'cash' | 'bank_transfer' | 'other';
export type AnalyticsEventType = 'profile_view' | 'call_click' | 'whatsapp_click' | 'directions_click' | 'share_click';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface District {
  id: string;
  name_en: string;
  name_mr: string;
  slug: string;
  is_active: boolean;
  is_featured?: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Taluka {
  id: string;
  district_id: string;
  name_en: string;
  name_mr: string;
  slug: string;
  is_active: boolean;
  is_featured?: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  district?: District;
}

export interface Category {
  id: string;
  name_en: string;
  name_mr: string;
  slug: string;
  description_en: string | null;
  description_mr: string | null;
  icon_key: string;
  is_visible: boolean;
  is_featured?: boolean;
  aliases?: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryAlias {
  id: string;
  category_id: string;
  alias: string;
  locale: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  slug: string;
  provider_name: string;
  business_name: string | null;
  mobile: string;
  whatsapp_number: string | null;
  experience_years: number;
  full_address: string;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  profile_image_url: string | null;
  description_en: string | null;
  description_mr: string | null;
  approval_status: VendorApprovalStatus;
  is_suspended: boolean;
  is_verified: boolean;
  is_publicly_visible: boolean;
  portal_enabled: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TrialStatus = 'active' | 'expired' | 'converted' | 'cancelled';

export interface ListingTrial {
  id: string;
  vendor_listing_id: string;
  starts_at: string;
  ends_at: string;
  status: TrialStatus;
  converted_at: string | null;
  converted_subscription_id: string | null;
  is_override: boolean;
  override_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceMetrics {
  profile_views: number;
  call_clicks: number;
  whatsapp_clicks: number;
  directions_clicks: number;
  share_clicks: number;
  total_contact_actions: number; // call_clicks + whatsapp_clicks + directions_clicks
}

export interface VendorReportSnapshot {
  id: string;
  vendor_id: string;
  vendor_listing_id: string | null;
  from_date: string;
  to_date: string;
  generated_at: string;
  report_type: 'listing' | 'combined_vendor';
  metrics: PerformanceMetrics;
  notes: string | null;
  created_by: string | null;
}

export interface VendorListing {
  id: string;
  vendor_id: string;
  category_id: string;
  taluka_id: string;
  approval_status: ListingStatus;
  is_visible: boolean;
  approved_at: string | null;
  first_activated_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  category?: Category;
  taluka?: Taluka;
  current_subscription?: Subscription;
  current_trial?: ListingTrial;
  trials?: ListingTrial[];
}

export interface Subscription {
  id: string;
  vendor_listing_id: string;
  amount: number;
  currency: string;
  starts_at: string;
  ends_at: string;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  vendor_listing_id: string;
  vendor_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  recorded_by_user_id: string | null;
  created_at: string;
}

export interface VendorApplication {
  id: string;
  provider_name: string;
  business_name: string | null;
  mobile: string;
  whatsapp_number: string | null;
  district_id: string;
  taluka_id: string;
  experience_years: number;
  full_address: string;
  service_areas_text: string;
  google_maps_url: string | null;
  image_path: string | null;
  status: ApplicationStatus;
  rejection_reason: string | null;
  internal_notes: string | null;
  consent_agreed: boolean;
  turnstile_verified: boolean;
  created_at: string;
  updated_at: string;
  items?: VendorApplicationItem[];
}

export interface VendorApplicationItem {
  id: string;
  application_id: string;
  category_id: string;
  taluka_id: string;
  created_at: string;
}

export interface DirectoryPageSettings {
  id: string;
  taluka_id: string;
  category_id: string;
  seo_title_en: string | null;
  seo_title_mr: string | null;
  seo_description_en: string | null;
  seo_description_mr: string | null;
  intro_en: string | null;
  intro_mr: string | null;
  indexability_override: boolean | null;
  is_enabled: boolean;
}

export interface SiteSettings {
  id: number;
  annual_listing_price: number;
  max_active_providers_per_taluka_category: number;
  seo_min_active_providers: number;
  support_mobile: string;
  support_whatsapp: string;
  business_email: string;
}

export interface RotatedProviderItem {
  listing_id: string;
  vendor_id: string;
  provider_name: string;
  business_name: string | null;
  slug: string;
  mobile: string;
  whatsapp_number: string | null;
  experience_years: number;
  full_address: string;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  profile_image_url: string | null;
  description_en: string | null;
  description_mr: string | null;
  is_verified: boolean;
  first_activated_at: string | null;
  display_order: number;
}
