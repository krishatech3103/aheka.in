-- 002_rls_policies.sql
-- Row Level Security (RLS) Policies for Aheka

-- Enable RLS on all exposed tables
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE talukas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_application_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user is Super Admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check vendor ownership
CREATE OR REPLACE FUNCTION get_current_vendor_id()
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT vendor_id INTO v_id FROM app_users
  WHERE auth_user_id = auth.uid()
    AND role = 'vendor'
    AND is_active = true;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Districts
CREATE POLICY "Public read active districts" ON districts
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR is_super_admin());

CREATE POLICY "Admin manage districts" ON districts
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 2. Talukas
CREATE POLICY "Public read active talukas" ON talukas
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR is_super_admin());

CREATE POLICY "Admin manage talukas" ON talukas
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 3. Categories
CREATE POLICY "Public read visible categories" ON categories
  FOR SELECT TO anon, authenticated
  USING (is_visible = true OR is_super_admin());

CREATE POLICY "Admin manage categories" ON categories
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 4. Category Aliases
CREATE POLICY "Public read category aliases" ON category_aliases
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage category aliases" ON category_aliases
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 5. Vendors
CREATE POLICY "Public read eligible active vendors" ON vendors
  FOR SELECT TO anon, authenticated
  USING (
    (
      approval_status = 'approved'
      AND is_suspended = false
      AND is_publicly_visible = true
      AND EXISTS (
        SELECT 1 FROM vendor_listings vl
        JOIN subscriptions s ON s.vendor_listing_id = vl.id
        WHERE vl.vendor_id = vendors.id
          AND vl.approval_status = 'approved'
          AND vl.is_visible = true
          AND s.status = 'active'
          AND s.starts_at <= NOW()
          AND s.ends_at > NOW()
      )
    )
    OR is_super_admin()
    OR id = get_current_vendor_id()
  );

CREATE POLICY "Vendor update own permitted profile" ON vendors
  FOR UPDATE TO authenticated
  USING (id = get_current_vendor_id() OR is_super_admin())
  WITH CHECK (id = get_current_vendor_id() OR is_super_admin());

CREATE POLICY "Admin manage all vendors" ON vendors
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 6. Vendor Service Areas
CREATE POLICY "Public read service areas" ON vendor_service_areas
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Vendor edit own service areas" ON vendor_service_areas
  FOR ALL TO authenticated
  USING (vendor_id = get_current_vendor_id() OR is_super_admin());

-- 7. Vendor Listings
CREATE POLICY "Public read approved visible listings" ON vendor_listings
  FOR SELECT TO anon, authenticated
  USING (
    (approval_status = 'approved' AND is_visible = true)
    OR vendor_id = get_current_vendor_id()
    OR is_super_admin()
  );

CREATE POLICY "Admin manage vendor listings" ON vendor_listings
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 8. Subscriptions
CREATE POLICY "Public read active subscriptions" ON subscriptions
  FOR SELECT TO anon, authenticated
  USING (
    (status = 'active' AND starts_at <= NOW() AND ends_at > NOW())
    OR EXISTS (
      SELECT 1 FROM vendor_listings vl
      WHERE vl.id = subscriptions.vendor_listing_id
        AND vl.vendor_id = get_current_vendor_id()
    )
    OR is_super_admin()
  );

CREATE POLICY "Admin manage subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 9. Payments (STRICT: Public has NO access)
CREATE POLICY "Admin manage payments" ON payments
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 10. Vendor Applications (STRICT: Public has NO direct read access)
CREATE POLICY "Admin manage applications" ON vendor_applications
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "Admin manage application items" ON vendor_application_items
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 11. Analytics Events (Public has NO select access; insert via server API)
CREATE POLICY "Admin view analytics" ON analytics_events
  FOR SELECT TO authenticated
  USING (is_super_admin() OR vendor_id = get_current_vendor_id());

-- 12. Directory Page Settings
CREATE POLICY "Public read directory settings" ON directory_page_settings
  FOR SELECT TO anon, authenticated
  USING (is_enabled = true OR is_super_admin());

CREATE POLICY "Admin manage directory settings" ON directory_page_settings
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 13. Site Settings
CREATE POLICY "Public read site settings" ON site_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage site settings" ON site_settings
  FOR ALL TO authenticated
  USING (is_super_admin());

-- 14. App Users
CREATE POLICY "Read self or admin" ON app_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR is_super_admin());

CREATE POLICY "Admin manage app users" ON app_users
  FOR ALL TO authenticated
  USING (is_super_admin());
