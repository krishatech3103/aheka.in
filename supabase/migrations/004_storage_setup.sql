-- 004_storage_setup.sql
-- Supabase Storage Buckets and Policies for Aheka

-- Insert buckets if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('vendor-profile-images', 'vendor-profile-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('vendor-application-images', 'vendor-application-images', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 1. Public Read Policy for vendor profile images
CREATE POLICY "Public read vendor profile images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'vendor-profile-images');

-- 2. Admin full access to all storage
CREATE POLICY "Admin manage all storage objects"
ON storage.objects FOR ALL TO authenticated
USING (is_super_admin());

-- 3. Vendor manage own single profile image
CREATE POLICY "Vendor upload own profile image"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vendor-profile-images'
  AND (storage.foldername(name))[1] = get_current_vendor_id()::TEXT
);

CREATE POLICY "Vendor update own profile image"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vendor-profile-images'
  AND (storage.foldername(name))[1] = get_current_vendor_id()::TEXT
);

CREATE POLICY "Vendor delete own profile image"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vendor-profile-images'
  AND (storage.foldername(name))[1] = get_current_vendor_id()::TEXT
);
