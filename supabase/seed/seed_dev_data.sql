-- supabase/seed/seed_dev_data.sql
-- DEVELOPMENT / TEST SEED DATA ONLY (Do not run in production!)
-- Execute manually with: npm run db:seed OR supabase db execute --file supabase/seed/seed_dev_data.sql

DO $$
BEGIN
  -- 1. Districts
  INSERT INTO districts (id, name_en, name_mr, slug, is_active, is_featured, sort_order)
  VALUES 
    ('d1111111-1111-1111-1111-111111111111', 'Ahilyanagar', 'अहिल्यानगर', 'ahilyanagar', true, true, 1),
    ('d2222222-2222-2222-2222-222222222222', 'Pune', 'पुणे', 'pune', true, true, 2),
    ('d3333333-3333-3333-3333-333333333333', 'Nashik', 'नाशिक', 'nashik', true, false, 3)
  ON CONFLICT (id) DO UPDATE SET
    is_featured = EXCLUDED.is_featured;

  -- 2. Talukas
  INSERT INTO talukas (id, district_id, name_en, name_mr, slug, is_active, is_featured, sort_order, center_latitude, center_longitude, location_detection_radius_km)
  VALUES
    ('t1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Sangamner', 'संगमनेर', 'sangamner', true, true, 1, 19.567840, 74.211540, 25),
    ('t2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Akole', 'अकोले', 'akole', true, true, 2, 19.540630, 74.005430, 25),
    ('t3333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 'Haveli', 'हवेली', 'haveli', true, false, 1, 18.520430, 73.856740, 25),
    ('t4444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 'Baramati', 'बारामती', 'baramati', true, false, 2, 18.144340, 74.576260, 25)
  ON CONFLICT (id) DO UPDATE SET
    is_featured = EXCLUDED.is_featured,
    center_latitude = EXCLUDED.center_latitude,
    center_longitude = EXCLUDED.center_longitude,
    location_detection_radius_km = EXCLUDED.location_detection_radius_km;

  -- 3. Categories
  INSERT INTO categories (id, name_en, name_mr, slug, description_en, description_mr, icon_key, is_visible, is_featured, sort_order)
  VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Electrician', 'इलेक्ट्रिशियन', 'electrician', 'Home wiring, motor repair, inverter & appliance connections.', 'घरातील वायरिंग, मोटार दुरुस्ती, इन्व्हर्टर आणि फिटिंग कामे.', 'zap', true, true, 1),
    ('c2222222-2222-2222-2222-222222222222', 'Plumber', 'प्लंबर', 'plumber', 'Pipe fitting, leakage repair, tap & bathroom sanitary work.', 'नळ दुरुस्ती, पाईपलाईन, लीकेज, बाथरूम व सॅनिटरी फिटिंग्ज.', 'droplet', true, true, 2),
    ('c3333333-3333-3333-3333-333333333333', 'Carpenter', 'सुतारकाम', 'carpenter', 'Furniture repair, door, window & wooden fixtures.', 'लाकडी फर्निचर, दरवाजे, खिडक्या आणि नवीन कपाट कामे.', 'hammer', true, true, 3),
    ('c4444444-4444-4444-4444-444444444444', 'Painter', 'रंगकाम', 'painter', 'Interior, exterior wall painting, waterproof coating.', 'घराचे रंगकाम, ऑइल पेंट, डिस्टेंपर आणि वॉटरप्रूफिंग.', 'paint-bucket', true, true, 4),
    ('c5555555-5555-5555-5555-555555555555', 'Appliance Repair', 'घरगुती उपकरणे दुरुस्ती', 'appliance-repair', 'Refrigerator, washing machine, TV, mixer grinder repair.', 'फ्रिज, वॉशिंग मशीन, टीव्ही आणि मिक्सर दुरुस्ती.', 'tv', true, false, 5),
    ('c6666666-6666-6666-6666-666666666666', 'Mason', 'गवंडी', 'mason', 'Brickwork, plastering, tiling and house construction renovation.', 'वीटकाम, प्लास्टर, टाइल्स बसवणे आणि बांधकाम दुरुस्ती.', 'home', true, false, 6)
  ON CONFLICT (id) DO UPDATE SET
    name_mr = EXCLUDED.name_mr,
    is_featured = EXCLUDED.is_featured;

  -- 4. Category Search Aliases
  INSERT INTO category_aliases (category_id, alias, locale)
  VALUES
    ('c1111111-1111-1111-1111-111111111111', 'इलेक्ट्रीशियन', 'mr'),
    ('c1111111-1111-1111-1111-111111111111', 'लाईट काम', 'mr'),
    ('c1111111-1111-1111-1111-111111111111', 'वायरमन', 'mr'),
    ('c1111111-1111-1111-1111-111111111111', 'wireman', 'en'),
    ('c1111111-1111-1111-1111-111111111111', 'electrical', 'en'),
    ('c2222222-2222-2222-2222-222222222222', 'प्लंबर', 'mr'),
    ('c2222222-2222-2222-2222-222222222222', 'नळ दुरुस्ती', 'mr'),
    ('c2222222-2222-2222-2222-222222222222', 'plumbing', 'en'),
    ('c3333333-3333-3333-3333-333333333333', 'सुतार', 'mr'),
    ('c3333333-3333-3333-3333-333333333333', 'furniture', 'en')
  ON CONFLICT DO NOTHING;

  -- 5. Seed 10 Active Providers for Sangamner + Electrician
  INSERT INTO vendors (id, slug, provider_name, business_name, mobile, whatsapp_number, experience_years, full_address, google_maps_url, approval_status, is_verified, is_publicly_visible)
  VALUES 
    ('v0101010-0101-0101-0101-010101010101', 'rahul-electricals-sangamner-7k1a', 'राहुल रमेश पाटील', 'राहुल इलेक्ट्रिकल सर्व्हिसेस', '+919822011101', '+919822011101', 8, 'नेहरू चौक, संगमनेर, अहिल्यानगर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v0202020-0202-0202-0202-020202020202', 'omkar-wiring-sangamner-9m2b', 'ओंकार दिलीप थोरात', 'ओमकार वायरिंग & मोटर्स', '+919822022202', '+919822022202', 6, 'अकोले बायपास रोड, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v0303030-0303-0303-0303-030303030303', 'shree-samarth-electricals-sangamner-3k8c', 'सचिन विठ्ठल तांबे', 'श्री समर्थ इलेक्ट्रिकल', '+919822033303', '+919822033303', 12, 'बाजार पेठ, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v0404040-0404-0404-0404-040404040404', 'ganesh-light-fitting-sangamner-4f9d', 'गणेश बबन गाडे', 'गणेश लाईट फिटिंग', '+919822044404', '+919822044404', 5, 'मालदाड रोड, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', false, true),
    ('v0505050-0505-0505-0505-050505050505', 'mauli-power-solutions-sangamner-5g2e', 'ज्ञानेश्वर विष्णू देशमुख', 'माऊली पॉवर सोल्युशन्स', '+919822055505', '+919822055505', 10, 'गुंजाळवाडी फाटा, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v0606060-0606-0606-0606-060606060606', 'balaji-electrical-works-sangamner-6h3f', 'बाळासाहेब अर्जुन वाकचौरे', 'बालाजी इलेक्ट्रिकल वर्क्स', '+919822066606', '+919822066606', 7, 'नवीन नगर रोड, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v0707070-0707-0707-0707-070707070707', 'sai-electricals-sangamner-7j4g', 'संदीप भास्कर नवले', 'साई इलेक्ट्रिकल सर्व्हिसेस', '+919822077707', '+919822077707', 4, 'घुलेवाडी, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', false, true),
    ('v0808080-0808-0808-0808-080808080808', 'jay-bhavani-wireman-sangamner-8k5h', 'विकास आनंदराव शिंदे', 'जय भवानी वायरमन सर्व्हिस', '+919822088808', '+919822088808', 9, 'चंदनापुरी घाट रोड, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v0909090-0909-0909-0909-090909090909', 'kisan-motor-rewinding-sangamner-9l6j', 'किरण मारुती कानवडे', 'किसान मोटर रिवाइंडिंग & वायरिंग', '+919822099909', '+919822099909', 15, 'धांदरफळ, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true),
    ('v1010101-1010-1010-1010-101010101010', 'swastik-electricals-sangamner-1m7k', 'अमित सुभाष जगताप', 'स्वस्तिक इलेक्ट्रिकल अँड हार्डवेअर', '+919822101010', '+919822101010', 3, 'संगमनेर खुर्द, संगमनेर', 'https://maps.google.com/?q=Sangamner', 'approved', true, true)
  ON CONFLICT (id) DO NOTHING;

  -- 6. Insert Listings & Subscriptions for 10 Active Sangamner Electricians
  FOR i IN 1..10 LOOP
    DECLARE
      v_curr_vendor_id UUID;
      v_curr_listing_id UUID;
      v_hex TEXT := LPAD(i::TEXT, 2, '0');
    BEGIN
      v_curr_vendor_id := ('v' || v_hex || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || v_hex || v_hex || v_hex || v_hex)::UUID;
      v_curr_listing_id := ('l' || v_hex || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || v_hex || v_hex || v_hex || v_hex)::UUID;

      INSERT INTO vendor_listings (id, vendor_id, category_id, taluka_id, approval_status, is_visible, approved_at, first_activated_at)
      VALUES (v_curr_listing_id, v_curr_vendor_id, 'c1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111111', 'approved', true, NOW() - (i || ' days')::INTERVAL, NOW() - (i || ' days')::INTERVAL)
      ON CONFLICT (id) DO NOTHING;

      -- Active 1-year subscription
      INSERT INTO subscriptions (id, vendor_listing_id, amount, currency, starts_at, ends_at, status)
      VALUES (
        ('s' || v_hex || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || v_hex || v_hex || v_hex || v_hex)::UUID,
        v_curr_listing_id,
        999.00,
        'INR',
        NOW() - (i || ' days')::INTERVAL,
        NOW() + INTERVAL '1 year' - (i || ' days')::INTERVAL,
        'active'
      ) ON CONFLICT (id) DO NOTHING;

      -- Payment record
      INSERT INTO payments (vendor_listing_id, vendor_id, subscription_id, amount, payment_method, payment_date, reference_number, notes)
      VALUES (
        v_curr_listing_id,
        v_curr_vendor_id,
        ('s' || v_hex || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || '-' || v_hex || v_hex || v_hex || v_hex || v_hex || v_hex)::UUID,
        999.00,
        'upi',
        CURRENT_DATE - i,
        'UPI-REF-' || (100000 + i),
        'Dev seed active listing payment'
      ) ON CONFLICT DO NOTHING;
    END;
  END LOOP;

  -- 7. Seed 2 Waitlisted Providers for Sangamner + Electrician
  INSERT INTO vendors (id, slug, provider_name, business_name, mobile, full_address, approval_status, is_verified, is_publicly_visible)
  VALUES 
    ('v1111111-1111-1111-1111-111111111111', 'kute-electricals-sangamner-2n8l', 'नितिन भागवत कुटे', 'कुटे इलेक्ट्रिकल', '+919822111111', 'जोर्वे रोड, संगमनेर', 'approved', true, true),
    ('v1212121-1212-1212-1212-121212121212', 'jadhav-wireman-sangamner-3p9m', 'दीपक पोपट जाधव', 'जाधव वायरमन वर्क्स', '+919822121212', 'समनापूर, संगमनेर', 'approved', false, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO vendor_listings (id, vendor_id, category_id, taluka_id, approval_status, is_visible, approved_at, created_at)
  VALUES 
    ('l1111111-1111-1111-1111-111111111111', 'v1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111111', 'waitlisted', true, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('l1212121-1212-1212-1212-121212121212', 'v1212121-1212-1212-1212-121212121212', 'c1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111111', 'waitlisted', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  -- 8. Seed 1 Expired Subscription for Sangamner + Plumber
  INSERT INTO vendors (id, slug, provider_name, business_name, mobile, full_address, approval_status, is_verified, is_publicly_visible)
  VALUES ('v1313131-1313-1313-1313-131313131313', 'pawar-plumbing-sangamner-4q1n', 'प्रशांत शंकर पवार', 'पवार प्लंबिंग वर्क्स', '+919822131313', 'कौठे कमलेश्वर, संगमनेर', 'approved', true, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO vendor_listings (id, vendor_id, category_id, taluka_id, approval_status, is_visible, approved_at, first_activated_at)
  VALUES ('l1313131-1313-1313-1313-131313131313', 'v1313131-1313-1313-1313-131313131313', 'c2222222-2222-2222-2222-222222222222', 't1111111-1111-1111-1111-111111111111', 'approved', true, NOW() - INTERVAL '400 days', NOW() - INTERVAL '400 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO subscriptions (id, vendor_listing_id, amount, currency, starts_at, ends_at, status)
  VALUES ('s1313131-1313-1313-1313-131313131313', 'l1313131-1313-1313-1313-131313131313', 999.00, 'INR', NOW() - INTERVAL '400 days', NOW() - INTERVAL '35 days', 'expired')
  ON CONFLICT (id) DO NOTHING;

  -- 9. Seed 1 Unpaid Approved Listing for Akole + Electrician
  INSERT INTO vendors (id, slug, provider_name, business_name, mobile, full_address, approval_status, is_verified, is_publicly_visible)
  VALUES ('v1414141-1414-1414-1414-141414141414', 'akole-electricals-akole-5r2p', 'मनोज बबन नवले', 'अकोले इलेक्ट्रिकल', '+919822141414', 'अगस्ति मंदिर रोड, अकोले', 'approved', true, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO vendor_listings (id, vendor_id, category_id, taluka_id, approval_status, is_visible, approved_at)
  VALUES ('l1414141-1414-1414-1414-141414141414', 'v1414141-1414-1414-1414-141414141414', 'c1111111-1111-1111-1111-111111111111', 't2222222-2222-2222-2222-222222222222', 'approved', true, NOW())
  ON CONFLICT (id) DO NOTHING;

END $$;
