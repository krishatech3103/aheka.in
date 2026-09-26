-- Return only public directory pages that meet Aheka's indexability policy.
-- This keeps the XML sitemap aligned with the page-level noindex rule.
CREATE OR REPLACE FUNCTION public.get_indexable_directory_routes()
RETURNS TABLE (
  district_slug TEXT,
  taluka_slug TEXT,
  category_slug TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible_listings AS (
    SELECT DISTINCT vl.id, vl.taluka_id, vl.category_id
    FROM vendor_listings vl
    JOIN vendors v ON v.id = vl.vendor_id
    WHERE vl.approval_status = 'approved'
      AND vl.is_visible = true
      AND v.approval_status = 'approved'
      AND v.is_suspended = false
      AND v.is_publicly_visible = true
      AND (
        EXISTS (
          SELECT 1
          FROM listing_trials lt
          WHERE lt.vendor_listing_id = vl.id
            AND lt.status = 'active'
            AND lt.starts_at <= NOW()
            AND lt.ends_at > NOW()
        )
        OR EXISTS (
          SELECT 1
          FROM subscriptions s
          WHERE s.vendor_listing_id = vl.id
            AND s.status = 'active'
            AND s.starts_at <= NOW()
            AND s.ends_at > NOW()
        )
      )
  ),
  provider_counts AS (
    SELECT taluka_id, category_id, COUNT(*)::INTEGER AS provider_count
    FROM eligible_listings
    GROUP BY taluka_id, category_id
  ),
  settings AS (
    SELECT COALESCE(seo_min_active_providers, 3) AS minimum_providers
    FROM site_settings
    WHERE id = 1
  )
  SELECT d.slug::TEXT, t.slug::TEXT, c.slug::TEXT
  FROM districts d
  JOIN talukas t ON t.district_id = d.id
  CROSS JOIN categories c
  CROSS JOIN settings global_settings
  LEFT JOIN provider_counts pc ON pc.taluka_id = t.id AND pc.category_id = c.id
  LEFT JOIN directory_page_settings dps
    ON dps.taluka_id = t.id AND dps.category_id = c.id
  WHERE d.is_active = true
    AND t.is_active = true
    AND c.is_visible = true
    AND COALESCE(dps.is_enabled, true) = true
    AND CASE
      WHEN dps.indexability_override IS NOT NULL THEN dps.indexability_override
      ELSE COALESCE(pc.provider_count, 0) >= global_settings.minimum_providers
    END = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_indexable_directory_routes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_indexable_directory_routes() TO service_role;
