-- 003_functions_and_triggers.sql
-- Transaction-Safe Slot Enforcement, Daily Rotation, and Waitlist Logic

-- 1. Helper: Calculate Days Since Fixed Epoch in Asia/Kolkata
CREATE OR REPLACE FUNCTION get_ist_day_offset(p_timestamp TIMESTAMPTZ DEFAULT NOW())
RETURNS INTEGER AS $$
DECLARE
  ist_time TIMESTAMPTZ;
  epoch_date DATE := '2026-01-01';
  current_ist_date DATE;
BEGIN
  -- Convert to Asia/Kolkata timezone
  ist_time := p_timestamp AT TIME ZONE 'Asia/Kolkata';
  current_ist_date := ist_time::DATE;
  RETURN current_ist_date - epoch_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Transaction-Safe Listing Activation & Payment Recording
-- Enforces the 10-provider slot limit at the database level with row locking
CREATE OR REPLACE FUNCTION activate_vendor_listing(
  p_listing_id UUID,
  p_amount NUMERIC,
  p_payment_method payment_method_enum,
  p_reference_number TEXT,
  p_notes TEXT,
  p_admin_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW(),
  p_custom_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_listing RECORD;
  v_max_slots INTEGER;
  v_active_count INTEGER;
  v_existing_sub RECORD;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_new_sub_id UUID;
  v_payment_id UUID;
BEGIN
  -- Lock listing record for update
  SELECT vl.*, v.provider_name, v.business_name
  INTO v_listing
  FROM vendor_listings vl
  JOIN vendors v ON v.id = vl.vendor_id
  WHERE vl.id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  -- Read configured max slots (default 10)
  SELECT COALESCE(max_active_providers_per_taluka_category, 10)
  INTO v_max_slots
  FROM site_settings
  WHERE id = 1;

  -- Lock all active subscriptions for this Taluka + Category to prevent race conditions
  PERFORM s.id
  FROM subscriptions s
  JOIN vendor_listings vl ON vl.id = s.vendor_listing_id
  WHERE vl.taluka_id = v_listing.taluka_id
    AND vl.category_id = v_listing.category_id
    AND vl.approval_status = 'approved'
    AND vl.is_visible = true
    AND s.status = 'active'
    AND s.starts_at <= NOW()
    AND s.ends_at > NOW()
  FOR UPDATE;

  -- Count current active paid listings in this (Taluka + Category)
  SELECT COUNT(DISTINCT vl.id)
  INTO v_active_count
  FROM vendor_listings vl
  JOIN subscriptions s ON s.vendor_listing_id = vl.id
  JOIN vendors v ON v.id = vl.vendor_id
  WHERE vl.taluka_id = v_listing.taluka_id
    AND vl.category_id = v_listing.category_id
    AND vl.id != p_listing_id
    AND vl.approval_status = 'approved'
    AND vl.is_visible = true
    AND v.approval_status = 'approved'
    AND v.is_suspended = false
    AND s.status = 'active'
    AND s.starts_at <= NOW()
    AND s.ends_at > NOW();

  -- Check if slot is available
  IF v_active_count >= v_max_slots THEN
    -- Place in waiting list
    UPDATE vendor_listings
    SET approval_status = 'waitlisted',
        updated_at = NOW()
    WHERE id = p_listing_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'SLOT_LIMIT_REACHED',
      'message', format('All %s slots for this taluka and category are occupied. Listing placed in waiting list.', v_max_slots),
      'active_count', v_active_count,
      'max_slots', v_max_slots
    );
  END IF;

  -- Check for existing active subscription (Renewal handling)
  SELECT * INTO v_existing_sub
  FROM subscriptions
  WHERE vendor_listing_id = p_listing_id
    AND status = 'active'
    AND ends_at > NOW()
  ORDER BY ends_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Extend from current expiry date!
    v_starts_at := v_existing_sub.ends_at;
    v_ends_at := COALESCE(p_custom_end_date, v_existing_sub.ends_at + INTERVAL '1 year');
  ELSE
    -- Brand new or expired: activate from specified start date
    v_starts_at := COALESCE(p_start_date, NOW());
    v_ends_at := COALESCE(p_custom_end_date, v_starts_at + INTERVAL '1 year');
  END IF;

  -- Create new subscription
  INSERT INTO subscriptions (
    vendor_listing_id,
    amount,
    currency,
    starts_at,
    ends_at,
    status
  ) VALUES (
    p_listing_id,
    p_amount,
    'INR',
    v_starts_at,
    v_ends_at,
    'active'
  ) RETURNING id INTO v_new_sub_id;

  -- Record manual payment receipt
  INSERT INTO payments (
    vendor_listing_id,
    vendor_id,
    subscription_id,
    amount,
    currency,
    payment_method,
    payment_date,
    reference_number,
    notes,
    recorded_by_user_id
  ) VALUES (
    p_listing_id,
    v_listing.vendor_id,
    v_new_sub_id,
    p_amount,
    'INR',
    p_payment_method,
    v_starts_at::DATE,
    p_reference_number,
    p_notes,
    p_admin_user_id
  ) RETURNING id INTO v_payment_id;

  -- Update listing status to approved and active
  UPDATE vendor_listings
  SET approval_status = 'approved',
      is_visible = true,
      approved_at = COALESCE(approved_at, NOW()),
      first_activated_at = COALESCE(first_activated_at, NOW()),
      updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_new_sub_id,
    'payment_id', v_payment_id,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at,
    'active_count', v_active_count + 1,
    'max_slots', v_max_slots
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Stored Procedure: Fetch Daily Rotated Providers for Taluka + Category
CREATE OR REPLACE FUNCTION get_active_rotated_providers(
  p_taluka_id UUID,
  p_category_id UUID,
  p_target_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  listing_id UUID,
  vendor_id UUID,
  provider_name VARCHAR,
  business_name VARCHAR,
  slug VARCHAR,
  mobile VARCHAR,
  whatsapp_number VARCHAR,
  experience_years INTEGER,
  full_address TEXT,
  google_maps_url TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  profile_image_url TEXT,
  description_en TEXT,
  description_mr TEXT,
  is_verified BOOLEAN,
  first_activated_at TIMESTAMPTZ,
  display_order INTEGER
) AS $$
DECLARE
  v_count INTEGER;
  v_offset INTEGER;
  v_day_number INTEGER;
BEGIN
  -- 1. Count eligible providers
  SELECT COUNT(*)
  INTO v_count
  FROM vendor_listings vl
  JOIN vendors v ON v.id = vl.vendor_id
  JOIN subscriptions s ON s.vendor_listing_id = vl.id
  WHERE vl.taluka_id = p_taluka_id
    AND vl.category_id = p_category_id
    AND vl.approval_status = 'approved'
    AND vl.is_visible = true
    AND v.approval_status = 'approved'
    AND v.is_suspended = false
    AND v.is_publicly_visible = true
    AND s.status = 'active'
    AND s.starts_at <= p_target_timestamp
    AND s.ends_at > p_target_timestamp;

  IF v_count = 0 THEN
    RETURN;
  END IF;

  -- 2. Calculate deterministic IST calendar day offset
  v_day_number := get_ist_day_offset(p_target_timestamp);
  v_offset := v_day_number % v_count;

  -- 3. Return providers ordered by stable base index rotated by v_offset
  RETURN QUERY
  WITH base_providers AS (
    SELECT
      vl.id AS b_listing_id,
      v.id AS b_vendor_id,
      v.provider_name AS b_provider_name,
      v.business_name AS b_business_name,
      v.slug AS b_slug,
      v.mobile AS b_mobile,
      v.whatsapp_number AS b_whatsapp_number,
      v.experience_years AS b_experience_years,
      v.full_address AS b_full_address,
      v.google_maps_url AS b_google_maps_url,
      v.latitude AS b_latitude,
      v.longitude AS b_longitude,
      v.profile_image_url AS b_profile_image_url,
      v.description_en AS b_description_en,
      v.description_mr AS b_description_mr,
      v.is_verified AS b_is_verified,
      vl.first_activated_at AS b_first_activated_at,
      ROW_NUMBER() OVER (ORDER BY vl.first_activated_at ASC, vl.id ASC) - 1 AS b_idx
    FROM vendor_listings vl
    JOIN vendors v ON v.id = vl.vendor_id
    JOIN subscriptions s ON s.vendor_listing_id = vl.id
    WHERE vl.taluka_id = p_taluka_id
      AND vl.category_id = p_category_id
      AND vl.approval_status = 'approved'
      AND vl.is_visible = true
      AND v.approval_status = 'approved'
      AND v.is_suspended = false
      AND v.is_publicly_visible = true
      AND s.status = 'active'
      AND s.starts_at <= p_target_timestamp
      AND s.ends_at > p_target_timestamp
  )
  SELECT
    b_listing_id,
    b_vendor_id,
    b_provider_name,
    b_business_name,
    b_slug,
    b_mobile,
    b_whatsapp_number,
    b_experience_years,
    b_full_address,
    b_google_maps_url,
    b_latitude,
    b_longitude,
    b_profile_image_url,
    b_description_en,
    b_description_mr,
    b_is_verified,
    b_first_activated_at,
    -- Deterministic Rotated Order:
    -- Providers from v_offset to v_count-1 get positions 0, 1, 2...
    -- Providers from 0 to v_offset-1 wrap around to the end!
    ((b_idx - v_offset + v_count) % v_count)::INTEGER AS display_order
  FROM base_providers
  ORDER BY display_order ASC;
END;
$$ LANGUAGE plpgsql STABLE;
