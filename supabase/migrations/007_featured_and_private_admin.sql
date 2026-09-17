-- 007_featured_and_private_admin.sql
-- Add is_featured flags for dynamic, database-driven homepage & footer highlights

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE talukas
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_districts_active_featured ON districts(is_active, is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_talukas_active_featured ON talukas(is_active, is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_visible_featured ON categories(is_visible, is_featured, sort_order);
