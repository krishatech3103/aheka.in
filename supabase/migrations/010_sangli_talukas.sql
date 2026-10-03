-- Add the Sangli district and its official talukas.
-- Safe to run after a district has already been added through the admin UI.

DO $$
DECLARE
  sangli_district_id UUID;
BEGIN
  INSERT INTO districts (name_en, name_mr, slug, is_active, is_featured, sort_order)
  VALUES ('Sangli', 'सांगली', 'sangli', true, false, 4)
  ON CONFLICT (slug) DO UPDATE
    SET name_en = EXCLUDED.name_en,
        name_mr = EXCLUDED.name_mr,
        is_active = true,
        updated_at = NOW()
  RETURNING id INTO sangli_district_id;

  INSERT INTO talukas (district_id, name_en, name_mr, slug, is_active, is_featured, sort_order)
  VALUES
    (sangli_district_id, 'Atpadi', 'आटपाडी', 'atpadi', true, false, 1),
    (sangli_district_id, 'Jat', 'जत', 'jat', true, false, 2),
    (sangli_district_id, 'Kadegaon', 'कडेगाव', 'kadegaon', true, false, 3),
    (sangli_district_id, 'Kavthe Mahankal', 'कवठे महांकाळ', 'kavthe-mahankal', true, false, 4),
    (sangli_district_id, 'Khanapur', 'खानापूर', 'khanapur', true, false, 5),
    (sangli_district_id, 'Miraj', 'मिरज', 'miraj', true, false, 6),
    (sangli_district_id, 'Palus', 'पलूस', 'palus', true, false, 7),
    (sangli_district_id, 'Shirala', 'शिराळा', 'shirala', true, false, 8),
    (sangli_district_id, 'Tasgaon', 'तासगाव', 'tasgaon', true, false, 9),
    (sangli_district_id, 'Walwa', 'वाळवा', 'walwa', true, false, 10)
  ON CONFLICT (district_id, slug) DO UPDATE
    SET name_en = EXCLUDED.name_en,
        name_mr = EXCLUDED.name_mr,
        is_active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW();
END $$;
