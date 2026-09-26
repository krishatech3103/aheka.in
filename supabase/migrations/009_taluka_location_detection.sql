-- GPS centres are used only for an opt-in, conservative nearest-taluka lookup.
-- They are not administrative boundaries: ambiguous or out-of-range locations
-- deliberately fall back to the customer's manual taluka selection.
ALTER TABLE talukas
  ADD COLUMN IF NOT EXISTS center_latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS center_longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS location_detection_radius_km NUMERIC(5, 1) NOT NULL DEFAULT 25;

ALTER TABLE talukas
  ADD CONSTRAINT talukas_center_coordinates_pair_chk
  CHECK (
    (center_latitude IS NULL AND center_longitude IS NULL)
    OR (
      center_latitude BETWEEN -90 AND 90
      AND center_longitude BETWEEN -180 AND 180
    )
  );

ALTER TABLE talukas
  ADD CONSTRAINT talukas_location_detection_radius_chk
  CHECK (location_detection_radius_km > 0 AND location_detection_radius_km <= 100);

COMMENT ON COLUMN talukas.center_latitude IS 'GPS latitude of the taluka centre for opt-in nearest-taluka detection.';
COMMENT ON COLUMN talukas.center_longitude IS 'GPS longitude of the taluka centre for opt-in nearest-taluka detection.';
COMMENT ON COLUMN talukas.location_detection_radius_km IS 'Maximum distance for confident automatic taluka selection; otherwise customers choose manually.';

-- Initial centres for the locations supplied in the development fixture.
-- Add a centre and conservative radius for every new taluka in internal admin.
UPDATE talukas AS t
SET
  center_latitude = locations.latitude,
  center_longitude = locations.longitude,
  location_detection_radius_km = locations.radius_km,
  updated_at = NOW()
FROM districts AS d
JOIN (
  VALUES
    ('ahilyanagar', 'sangamner', 19.567840::NUMERIC, 74.211540::NUMERIC, 25.0::NUMERIC),
    ('ahilyanagar', 'akole', 19.540630::NUMERIC, 74.005430::NUMERIC, 25.0::NUMERIC),
    ('pune', 'haveli', 18.520430::NUMERIC, 73.856740::NUMERIC, 25.0::NUMERIC),
    ('pune', 'baramati', 18.144340::NUMERIC, 74.576260::NUMERIC, 25.0::NUMERIC)
) AS locations(district_slug, taluka_slug, latitude, longitude, radius_km)
  ON d.slug = locations.district_slug
WHERE t.district_id = d.id
  AND t.slug = locations.taluka_slug;
