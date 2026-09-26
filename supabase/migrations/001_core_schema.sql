-- 001_core_schema.sql
-- Aheka Hyperlocal Platform Core Schema


-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'vendor');
CREATE TYPE vendor_approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE listing_status AS ENUM ('approved', 'waitlisted', 'suspended', 'rejected');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');
CREATE TYPE payment_method_enum AS ENUM ('upi', 'cash', 'bank_transfer', 'other');
CREATE TYPE analytics_event_type AS ENUM ('profile_view', 'call_click', 'whatsapp_click', 'directions_click', 'share_click');
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');

-- 1. Districts (e.g. Ahilyanagar, Pune, Nashik)
CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(100) NOT NULL,
  name_mr VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Talukas (e.g. Sangamner, Akole, Rahuri)
CREATE TABLE talukas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  name_en VARCHAR(100) NOT NULL,
  name_mr VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taluka_district_slug UNIQUE (district_id, slug)
);

-- 3. Categories (Admin-managed, e.g. Electrician, Plumber)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(100) NOT NULL,
  name_mr VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description_en TEXT,
  description_mr TEXT,
  icon_key VARCHAR(50) NOT NULL DEFAULT 'wrench',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Category Search Aliases (e.g. "લાઈટ काम", "wireman", "light fitting")
CREATE TABLE category_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'mr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Vendors (Service Providers)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(150) UNIQUE NOT NULL,
  provider_name VARCHAR(150) NOT NULL,
  business_name VARCHAR(200),
  mobile VARCHAR(20) NOT NULL,
  whatsapp_number VARCHAR(20),
  experience_years INTEGER NOT NULL DEFAULT 0,
  full_address TEXT NOT NULL,
  google_maps_url TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  -- Policy: Exactly ONE optional profile image in V1 (provider photo, shop facade, or logo)
  profile_image_url TEXT,
  description_en TEXT,
  description_mr TEXT,
  approval_status vendor_approval_status NOT NULL DEFAULT 'pending',
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_publicly_visible BOOLEAN NOT NULL DEFAULT true,
  portal_enabled BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Application Users (Mapping Supabase Auth to roles)
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'vendor',
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Vendor Service Areas (Villages/Localities within selected taluka)
CREATE TABLE vendor_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  taluka_id UUID NOT NULL REFERENCES talukas(id) ON DELETE RESTRICT,
  area_name_en VARCHAR(150) NOT NULL,
  area_name_mr VARCHAR(150) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Vendor Listings (Commercial unit: 1 Vendor + 1 Category + 1 Taluka)
CREATE TABLE vendor_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  taluka_id UUID NOT NULL REFERENCES talukas(id) ON DELETE RESTRICT,
  approval_status listing_status NOT NULL DEFAULT 'approved',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  approved_at TIMESTAMPTZ,
  first_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vendor_category_taluka UNIQUE (vendor_id, category_id, taluka_id)
);

-- 9. Subscriptions (Annual validity per listing)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_listing_id UUID NOT NULL REFERENCES vendor_listings(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 999.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Payments (Manual receipts recorded by Admin)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_listing_id UUID NOT NULL REFERENCES vendor_listings(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 999.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_method payment_method_enum NOT NULL DEFAULT 'upi',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number VARCHAR(100),
  notes TEXT,
  recorded_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Vendor Applications (Join Aheka submissions)
CREATE TABLE vendor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(150) NOT NULL,
  business_name VARCHAR(200),
  mobile VARCHAR(20) NOT NULL,
  whatsapp_number VARCHAR(20),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  taluka_id UUID NOT NULL REFERENCES talukas(id) ON DELETE RESTRICT,
  experience_years INTEGER NOT NULL DEFAULT 0,
  full_address TEXT NOT NULL,
  service_areas_text TEXT NOT NULL,
  google_maps_url TEXT,
  image_path TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  internal_notes TEXT,
  consent_agreed BOOLEAN NOT NULL DEFAULT false,
  turnstile_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Vendor Application Requested Categories
CREATE TABLE vendor_application_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES vendor_applications(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  taluka_id UUID NOT NULL REFERENCES talukas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Analytics Events (Privacy-first, no customer personal details)
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_listing_id UUID REFERENCES vendor_listings(id) ON DELETE SET NULL,
  event_type analytics_event_type NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'mr',
  page_path VARCHAR(255) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Directory Page Settings (Custom SEO & Introductions per Taluka + Category)
CREATE TABLE directory_page_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taluka_id UUID NOT NULL REFERENCES talukas(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  seo_title_en VARCHAR(255),
  seo_title_mr VARCHAR(255),
  seo_description_en TEXT,
  seo_description_mr TEXT,
  intro_en TEXT,
  intro_mr TEXT,
  indexability_override BOOLEAN, -- null = default based on active count, true = force index, false = force noindex
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dir_settings_taluka_category UNIQUE (taluka_id, category_id)
);

-- 15. Site Settings (Singleton table for global configuration)
CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  annual_listing_price NUMERIC(10, 2) NOT NULL DEFAULT 999.00,
  max_active_providers_per_taluka_category INTEGER NOT NULL DEFAULT 10,
  seo_min_active_providers INTEGER NOT NULL DEFAULT 3,
  support_mobile VARCHAR(20) NOT NULL DEFAULT '+919876543210',
  support_whatsapp VARCHAR(20) NOT NULL DEFAULT '+919876543210',
  business_email VARCHAR(100) NOT NULL DEFAULT 'contact@aheka.in',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default site settings
INSERT INTO site_settings (id, annual_listing_price, max_active_providers_per_taluka_category, seo_min_active_providers)
VALUES (1, 999.00, 10, 3)
ON CONFLICT (id) DO NOTHING;

-- Strategic Indexes
CREATE INDEX idx_districts_slug_active ON districts(slug, is_active);
CREATE INDEX idx_talukas_district_slug ON talukas(district_id, slug, is_active);
CREATE INDEX idx_categories_slug_visible ON categories(slug, is_visible);
CREATE INDEX idx_category_aliases_cat ON category_aliases(category_id, alias);
CREATE INDEX idx_vendors_slug ON vendors(slug);
CREATE INDEX idx_vendors_mobile ON vendors(mobile);
CREATE INDEX idx_vendors_status ON vendors(approval_status, is_suspended, is_publicly_visible);
CREATE INDEX idx_vendor_listings_lookup ON vendor_listings(taluka_id, category_id, approval_status, is_visible);
CREATE INDEX idx_vendor_listings_vendor ON vendor_listings(vendor_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(vendor_listing_id, status, starts_at, ends_at);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_analytics_vendor_occurred ON analytics_events(vendor_id, occurred_at);
CREATE INDEX idx_applications_mobile_status ON vendor_applications(mobile, status);
