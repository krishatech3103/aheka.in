-- 005_seed_dev_data.sql
-- Notice: Seed fixtures have been relocated to supabase/seed/seed_dev_data.sql
-- Production migrations do NOT load seed data.
-- To populate a local development database, run: npm run db:seed

DO $$
BEGIN
  -- No-op in migration sequence to preserve migration history
  NULL;
END $$;
