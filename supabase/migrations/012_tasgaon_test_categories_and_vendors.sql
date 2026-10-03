-- Public test data requested for Tasgaon. All vendor records are clearly marked
-- TEST DATA in their names/notes and use non-real contact numbers. Remove them
-- through the protected Admin > Vendors screen before the public launch.

INSERT INTO categories (
  name_en, name_mr, slug, description_en, description_mr,
  icon_key, is_visible, is_featured, sort_order
)
VALUES
  ('Electrician', 'इलेक्ट्रिशियन', 'electrician', 'Home wiring, fan, switchboard, motor and inverter work.', 'घरगुती वायरिंग, फॅन, स्विचबोर्ड, मोटार आणि इन्व्हर्टरची कामे.', 'zap', true, true, 1),
  ('Plumber', 'प्लंबर', 'plumber', 'Leak repair, pipes, taps, bathroom fittings and drainage work.', 'गळती दुरुस्ती, पाईप, नळ, बाथरूम फिटिंग आणि ड्रेनेजची कामे.', 'droplet', true, true, 2),
  ('Carpenter', 'सुतार', 'carpenter', 'Furniture, doors, cupboards, repairs and custom woodwork.', 'फर्निचर, दरवाजे, कपाटे, दुरुस्ती आणि सुतारकाम.', 'hammer', true, true, 3),
  ('Painter', 'रंगारी', 'painter', 'Interior and exterior painting, waterproofing and polish work.', 'आतील व बाहेरील रंगकाम, वॉटरप्रूफिंग आणि पॉलिशची कामे.', 'paint-bucket', true, true, 4),
  ('AC and Refrigerator Repair', 'एसी व फ्रिज दुरुस्ती', 'ac-refrigerator-repair', 'AC servicing, refrigerator repair and cooling solutions.', 'एसी सर्व्हिसिंग, फ्रिज दुरुस्ती आणि कूलिंगची कामे.', 'tv', true, true, 5),
  ('Appliance Repair', 'घरगुती उपकरण दुरुस्ती', 'appliance-repair', 'Washing machine, mixer, microwave and household appliance repair.', 'वॉशिंग मशीन, मिक्सर, मायक्रोवेव्ह व घरगुती उपकरण दुरुस्ती.', 'wrench', true, true, 6),
  ('Mason and Tile Worker', 'गवंडी व टाइल्स कारागीर', 'mason-tile-worker', 'Brickwork, plaster, tiles and small construction repairs.', 'वीटकाम, प्लास्टर, टाइल्स आणि छोट्या बांधकामाची दुरुस्ती.', 'home', true, true, 7),
  ('Cleaning Services', 'साफसफाई सेवा', 'cleaning-services', 'Home, office, deep-cleaning and water-tank cleaning.', 'घर, कार्यालय, डीप क्लिनिंग आणि पाण्याची टाकी साफसफाई.', 'sparkles', true, true, 8),
  ('Pest Control', 'कीटक नियंत्रण', 'pest-control', 'Termite, cockroach, mosquito and pest-control treatment.', 'वाळवी, झुरळ, डास व इतर कीटक नियंत्रण सेवा.', 'shield', true, true, 9),
  ('CCTV and Computer Repair', 'सीसीटीव्ही व संगणक दुरुस्ती', 'cctv-computer-repair', 'CCTV installation, computer repair, networking and Wi-Fi setup.', 'सीसीटीव्ही बसवणे, संगणक दुरुस्ती, नेटवर्किंग व वाय-फाय सेटअप.', 'camera', true, true, 10)
ON CONFLICT (slug) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_mr = EXCLUDED.name_mr,
  description_en = EXCLUDED.description_en,
  description_mr = EXCLUDED.description_mr,
  icon_key = EXCLUDED.icon_key,
  is_visible = true,
  is_featured = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO category_aliases (category_id, alias, locale)
SELECT category.id, aliases.alias, aliases.locale
FROM categories AS category
JOIN (
  VALUES
    ('electrician', 'wireman', 'en'), ('electrician', 'लाईट काम', 'mr'),
    ('plumber', 'plumbing', 'en'), ('plumber', 'नळ दुरुस्ती', 'mr'),
    ('carpenter', 'furniture repair', 'en'), ('carpenter', 'सुतारकाम', 'mr'),
    ('painter', 'painting', 'en'), ('painter', 'रंगकाम', 'mr'),
    ('ac-refrigerator-repair', 'AC repair', 'en'), ('ac-refrigerator-repair', 'फ्रिज दुरुस्ती', 'mr'),
    ('appliance-repair', 'washing machine repair', 'en'), ('appliance-repair', 'मिक्सर दुरुस्ती', 'mr'),
    ('mason-tile-worker', 'tiles worker', 'en'), ('mason-tile-worker', 'गवंडी', 'mr'),
    ('cleaning-services', 'deep cleaning', 'en'), ('cleaning-services', 'साफसफाई', 'mr'),
    ('pest-control', 'termite control', 'en'), ('pest-control', 'कीटक नियंत्रण', 'mr'),
    ('cctv-computer-repair', 'CCTV installation', 'en'), ('cctv-computer-repair', 'सीसीटीव्ही', 'mr')
) AS aliases(category_slug, alias, locale) ON aliases.category_slug = category.slug
WHERE NOT EXISTS (
  SELECT 1 FROM category_aliases existing
  WHERE existing.category_id = category.id AND existing.alias = aliases.alias AND existing.locale = aliases.locale
);

WITH test_vendors(slug, provider_name, business_name, mobile, experience_years, full_address, description_en, description_mr, category_slug) AS (
  VALUES
    ('test-tasgaon-electrician', 'TEST DATA — Ajay Patil', 'TEST DATA — Tasgaon Electricals', '+910000000001', 8, 'TEST DATA — Station Road, Tasgaon, Sangli', 'Test listing for home wiring, fans and switches. Delete before launch.', 'चाचणी नोंद — घरगुती वायरिंग, फॅन आणि स्विचची कामे. लॉन्चपूर्वी हटवा.', 'electrician'),
    ('test-tasgaon-plumber', 'TEST DATA — Ramesh Jadhav', 'TEST DATA — Tasgaon Plumbing', '+910000000002', 7, 'TEST DATA — Market Yard, Tasgaon, Sangli', 'Test listing for leakage, pipe and bathroom work. Delete before launch.', 'चाचणी नोंद — गळती, पाईप आणि बाथरूमची कामे. लॉन्चपूर्वी हटवा.', 'plumber'),
    ('test-tasgaon-carpenter', 'TEST DATA — Suresh Pawar', 'TEST DATA — Tasgaon Wood Works', '+910000000003', 10, 'TEST DATA — Vita Road, Tasgaon, Sangli', 'Test listing for furniture and carpentry work. Delete before launch.', 'चाचणी नोंद — फर्निचर आणि सुतारकाम. लॉन्चपूर्वी हटवा.', 'carpenter'),
    ('test-tasgaon-painter', 'TEST DATA — Mahesh Shinde', 'TEST DATA — Tasgaon Paint Works', '+910000000004', 6, 'TEST DATA — College Road, Tasgaon, Sangli', 'Test listing for painting and waterproofing. Delete before launch.', 'चाचणी नोंद — रंगकाम आणि वॉटरप्रूफिंग. लॉन्चपूर्वी हटवा.', 'painter'),
    ('test-tasgaon-ac-repair', 'TEST DATA — Nitin More', 'TEST DATA — Tasgaon Cooling Care', '+910000000005', 9, 'TEST DATA — Sangli Road, Tasgaon, Sangli', 'Test listing for AC and refrigerator repair. Delete before launch.', 'चाचणी नोंद — एसी व फ्रिज दुरुस्ती. लॉन्चपूर्वी हटवा.', 'ac-refrigerator-repair'),
    ('test-tasgaon-appliance-repair', 'TEST DATA — Pravin Kumbhar', 'TEST DATA — Tasgaon Appliance Care', '+910000000006', 5, 'TEST DATA — Shivaji Chowk, Tasgaon, Sangli', 'Test listing for household appliance repair. Delete before launch.', 'चाचणी नोंद — घरगुती उपकरण दुरुस्ती. लॉन्चपूर्वी हटवा.', 'appliance-repair'),
    ('test-tasgaon-mason-tiles', 'TEST DATA — Dattatray Mane', 'TEST DATA — Tasgaon Mason and Tiles', '+910000000007', 12, 'TEST DATA — Bus Stand Area, Tasgaon, Sangli', 'Test listing for masonry, plaster and tile work. Delete before launch.', 'चाचणी नोंद — गवंडी, प्लास्टर व टाइल्सची कामे. लॉन्चपूर्वी हटवा.', 'mason-tile-worker'),
    ('test-tasgaon-cleaning', 'TEST DATA — Sunita Patil', 'TEST DATA — Tasgaon Cleaning Services', '+910000000008', 4, 'TEST DATA — Ganapati Peth, Tasgaon, Sangli', 'Test listing for home and office cleaning. Delete before launch.', 'चाचणी नोंद — घर व कार्यालय साफसफाई. लॉन्चपूर्वी हटवा.', 'cleaning-services'),
    ('test-tasgaon-pest-control', 'TEST DATA — Vilas Chavan', 'TEST DATA — Tasgaon Pest Control', '+910000000009', 11, 'TEST DATA — Miraj Road, Tasgaon, Sangli', 'Test listing for termite and pest control. Delete before launch.', 'चाचणी नोंद — वाळवी व कीटक नियंत्रण. लॉन्चपूर्वी हटवा.', 'pest-control'),
    ('test-tasgaon-cctv-computer', 'TEST DATA — Kiran Jagtap', 'TEST DATA — Tasgaon CCTV Computer Care', '+910000000010', 7, 'TEST DATA — Laxmi Chowk, Tasgaon, Sangli', 'Test listing for CCTV, computer and Wi-Fi setup. Delete before launch.', 'चाचणी नोंद — सीसीटीव्ही, संगणक आणि वाय-फाय सेटअप. लॉन्चपूर्वी हटवा.', 'cctv-computer-repair')
)
INSERT INTO vendors (
  slug, provider_name, business_name, mobile, whatsapp_number, experience_years,
  full_address, description_en, description_mr, approval_status, is_suspended,
  is_verified, is_publicly_visible, portal_enabled, admin_notes
)
SELECT
  slug, provider_name, business_name, mobile, mobile, experience_years,
  full_address, description_en, description_mr, 'approved', false,
  false, true, false, 'TEST DATA — delete from Admin > Vendors before public launch.'
FROM test_vendors
ON CONFLICT (slug) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  business_name = EXCLUDED.business_name,
  mobile = EXCLUDED.mobile,
  whatsapp_number = EXCLUDED.whatsapp_number,
  experience_years = EXCLUDED.experience_years,
  full_address = EXCLUDED.full_address,
  description_en = EXCLUDED.description_en,
  description_mr = EXCLUDED.description_mr,
  approval_status = 'approved',
  is_suspended = false,
  is_publicly_visible = true,
  admin_notes = EXCLUDED.admin_notes,
  updated_at = NOW();

WITH test_pairs(vendor_slug, category_slug) AS (
  VALUES
    ('test-tasgaon-electrician', 'electrician'),
    ('test-tasgaon-plumber', 'plumber'),
    ('test-tasgaon-carpenter', 'carpenter'),
    ('test-tasgaon-painter', 'painter'),
    ('test-tasgaon-ac-repair', 'ac-refrigerator-repair'),
    ('test-tasgaon-appliance-repair', 'appliance-repair'),
    ('test-tasgaon-mason-tiles', 'mason-tile-worker'),
    ('test-tasgaon-cleaning', 'cleaning-services'),
    ('test-tasgaon-pest-control', 'pest-control'),
    ('test-tasgaon-cctv-computer', 'cctv-computer-repair')
), tasgaon AS (
  SELECT id FROM talukas WHERE LOWER(slug) = 'tasgaon' LIMIT 1
)
INSERT INTO vendor_listings (vendor_id, category_id, taluka_id, approval_status, is_visible, approved_at, first_activated_at)
SELECT vendor.id, category.id, tasgaon.id, 'approved', true, NOW(), NOW()
FROM test_pairs
JOIN vendors AS vendor ON vendor.slug = test_pairs.vendor_slug
JOIN categories AS category ON category.slug = test_pairs.category_slug
CROSS JOIN tasgaon
ON CONFLICT (vendor_id, category_id, taluka_id) DO UPDATE SET
  approval_status = 'approved',
  is_visible = true,
  approved_at = COALESCE(vendor_listings.approved_at, NOW()),
  first_activated_at = COALESCE(vendor_listings.first_activated_at, NOW()),
  updated_at = NOW();

INSERT INTO listing_trials (vendor_listing_id, starts_at, ends_at, status, override_reason)
SELECT listing.id, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 'active', 'TEST DATA — delete before public launch.'
FROM vendor_listings AS listing
JOIN vendors AS vendor ON vendor.id = listing.vendor_id
WHERE vendor.slug LIKE 'test-tasgaon-%'
  AND NOT EXISTS (
    SELECT 1 FROM listing_trials trial
    WHERE trial.vendor_listing_id = listing.id
      AND trial.status = 'active'
      AND trial.ends_at > NOW()
  );
