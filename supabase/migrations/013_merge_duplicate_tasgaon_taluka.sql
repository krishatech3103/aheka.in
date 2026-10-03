-- A legacy manually-created `Tasgaon` record existed alongside the canonical
-- lowercase `tasgaon` record. The test listings were attached to the former,
-- while the location picker selected the latter. Consolidate them so every
-- public route and location selection reaches the same listings.
DO $$
DECLARE
  v_district_id UUID;
  v_canonical_id UUID;
  v_legacy_id UUID;
BEGIN
  SELECT id
  INTO v_district_id
  FROM districts
  WHERE slug = 'sangli';

  IF v_district_id IS NULL THEN
    RAISE EXCEPTION 'Cannot merge Tasgaon records: Sangli district is missing.';
  END IF;

  SELECT id
  INTO v_canonical_id
  FROM talukas
  WHERE district_id = v_district_id
    AND slug = 'tasgaon';

  SELECT id
  INTO v_legacy_id
  FROM talukas
  WHERE district_id = v_district_id
    AND slug = 'Tasgaon';

  -- The migration is safe to run where only one record exists.
  IF v_canonical_id IS NULL OR v_legacy_id IS NULL OR v_canonical_id = v_legacy_id THEN
    RETURN;
  END IF;

  -- Stop rather than silently dropping data if both records contain the same
  -- vendor/category listing. The current production data has no such conflict.
  IF EXISTS (
    SELECT 1
    FROM vendor_listings legacy
    JOIN vendor_listings canonical
      ON canonical.vendor_id = legacy.vendor_id
     AND canonical.category_id = legacy.category_id
     AND canonical.taluka_id = v_canonical_id
    WHERE legacy.taluka_id = v_legacy_id
  ) THEN
    RAISE EXCEPTION 'Cannot merge Tasgaon records: duplicate vendor listings need review.';
  END IF;

  -- Preserve directory settings on the canonical record when both records have
  -- a setting for the same category, then move the remaining legacy settings.
  DELETE FROM directory_page_settings legacy
  USING directory_page_settings canonical
  WHERE legacy.taluka_id = v_legacy_id
    AND canonical.taluka_id = v_canonical_id
    AND canonical.category_id = legacy.category_id;

  UPDATE directory_page_settings
  SET taluka_id = v_canonical_id
  WHERE taluka_id = v_legacy_id;

  UPDATE vendor_service_areas
  SET taluka_id = v_canonical_id
  WHERE taluka_id = v_legacy_id;

  UPDATE vendor_application_items
  SET taluka_id = v_canonical_id
  WHERE taluka_id = v_legacy_id;

  UPDATE vendor_applications
  SET taluka_id = v_canonical_id
  WHERE taluka_id = v_legacy_id;

  UPDATE vendor_listings
  SET taluka_id = v_canonical_id
  WHERE taluka_id = v_legacy_id;

  -- Keep the legacy record for audit/history but prevent duplicate selection.
  UPDATE talukas
  SET is_active = false,
      updated_at = NOW()
  WHERE id = v_legacy_id;
END
$$;
