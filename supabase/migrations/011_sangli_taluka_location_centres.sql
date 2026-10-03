-- Taluka headquarters used only for browser-side nearest-taluka selection.
-- The customer can always override this with the District -> Taluka controls.
-- Values are headquarters/tehsil points, not a claim that every place in the
-- taluka has the same location.

UPDATE talukas
SET
  center_latitude = source.center_latitude,
  center_longitude = source.center_longitude,
  location_detection_radius_km = 65,
  updated_at = NOW()
FROM (
  VALUES
    ('atpadi', 17.43220::NUMERIC, 74.93926::NUMERIC),
    ('jat', 17.04000::NUMERIC, 75.21000::NUMERIC),
    ('kadegaon', 17.29000::NUMERIC, 74.33000::NUMERIC),
    ('kavthe-mahankal', 17.01592::NUMERIC, 74.87482::NUMERIC),
    ('khanapur', 17.27291::NUMERIC, 74.53888::NUMERIC),
    ('miraj', 16.82243::NUMERIC, 74.65359::NUMERIC),
    ('palus', 17.09000::NUMERIC, 74.44000::NUMERIC),
    ('shirala', 16.98680::NUMERIC, 74.12987::NUMERIC),
    ('tasgaon', 17.02766::NUMERIC, 74.60738::NUMERIC),
    ('walwa', 17.05171::NUMERIC, 74.26818::NUMERIC)
) AS source(slug, center_latitude, center_longitude)
WHERE talukas.slug = source.slug
  AND talukas.district_id = (SELECT id FROM districts WHERE slug = 'sangli');
