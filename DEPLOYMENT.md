# Aheka (आहे का?) — Deployment & Configuration Guide

This document covers deployment, environment configuration, secret management, database migrations, and operational workflows for running **Aheka** on Cloudflare Workers and Supabase.

---

## 1. Prerequisites & Stack

- **Node.js**: v20.x or higher
- **Framework**: Astro 4.x / 5.x (with `@astrojs/cloudflare` adapter)
- **Edge Runtime**: Cloudflare Workers
- **Database & Storage**: Supabase (PostgreSQL 15+, Storage bucket: `vendor-profile-images`)
- **Domain**: `https://aheka.in`

---

## 2. Environment Variables & Secrets Configuration

### 2.1 Configuration Matrix

| Variable | Scope | Secret? | Description / Example |
|---|---|---|---|
| `ADMIN_ENTRY_PATH` | Server-only | Yes | Unguessable admin path slug (e.g. `manage-aheka-x7k92p` in prod, `local-admin` in dev) |
| `ADMIN_PASSWORD` | Server-only | Yes | Super Admin authentication password |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Yes | Supabase service role key for privileged admin operations |
| `JWT_SECRET` | Server-only | Yes | High-entropy secret for admin session tokens |
| `TURNSTILE_SECRET_KEY` | Server-only | Yes | Cloudflare Turnstile bot verification secret |
| `PUBLIC_SUPABASE_URL` | Public / Edge | No | Public Supabase API project endpoint |
| `PUBLIC_SUPABASE_ANON_KEY` | Public / Edge | No | Supabase anon key (restricted by RLS) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Public / Edge | No | Cloudflare Turnstile public site key |

---

## 3. Local Development Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure local development variables in `.env`:
   ```env
   ADMIN_ENTRY_PATH=local-admin
   ADMIN_PASSWORD=local-dev-password
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=local-dev-secret-key-at-least-32-chars
   PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
   ```

3. Install dependencies and run the local development server:
   ```bash
   npm install
   npm run dev
   ```

4. Access the private admin panel locally at:
   ```
   http://localhost:4321/local-admin
   ```

---

## 4. Production Deployment to Cloudflare Workers

### 4.1 Configuring Production Secrets in Cloudflare
Never commit your production `ADMIN_ENTRY_PATH` or secret keys to GitHub.

Run the following commands using Wrangler CLI (or configure via Cloudflare Dashboard under **Workers & Pages → Settings → Variables and Secrets**):

```bash
# 1. Set the private admin entry path (use an unguessable string)
npx wrangler secret put ADMIN_ENTRY_PATH
# Enter: manage-aheka-x7k92p (or your chosen secret slug)

# 2. Set the Super Admin password
npx wrangler secret put ADMIN_PASSWORD

# 3. Set Supabase Service Role Key
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# 4. Set Session JWT Secret
npx wrangler secret put JWT_SECRET

# 5. Set Turnstile Bot Verification Secret
npx wrangler secret put TURNSTILE_SECRET_KEY

# 6. Set Supabase Public URL & Anon Key
npx wrangler secret put PUBLIC_SUPABASE_URL
npx wrangler secret put PUBLIC_SUPABASE_ANON_KEY
```

### 4.2 How `ADMIN_ENTRY_PATH` Operates in Production
- If `ADMIN_ENTRY_PATH=manage-aheka-x7k92p`, the entry route will be `https://aheka.in/manage-aheka-x7k92p`.
- Obvious probing paths (`/admin`, `/admin/*`, `/wp-admin*`, `/administrator*`, `/dashboard*`, `/vendor*`) automatically return **HTTP 404 Not Found**.
- The secret production path is never redirected to or revealed to unauthenticated users.
- The secret path is **never** added to `robots.txt` or `sitemap.xml`.

### 4.3 Changing the Admin Entry Path Safely
If the admin path is ever compromised or needs periodic rotation:
1. Run `npx wrangler secret put ADMIN_ENTRY_PATH` and enter a new slug.
2. Cloudflare distributes the updated secret to edge workers within seconds.
3. The new path is active immediately; the old path begins returning 404 immediately. No code redeployment or downtime is required.

---

## 5. Supabase Database Migrations

Run database migrations sequentially in the Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql` — Core tables: districts, talukas, categories, vendors, vendor_listings, payments, analytics.
2. `supabase/migrations/002_rls_policies.sql` — Row Level Security policies.
3. `supabase/migrations/003_storage_buckets.sql` — `vendor-profile-images` bucket.
4. `supabase/migrations/004_functions_and_triggers.sql` — Atomic slot limits and rotation helper functions.
5. `supabase/migrations/005_seed_dev_data.sql` — Safe no-op in production.
6. `supabase/migrations/006_phase2_trials_and_reports.sql` — `listing_trials`, `vendor_report_snapshots`.
7. `supabase/migrations/007_featured_and_private_admin.sql` — `is_featured` columns and indexes on categories and talukas.

### 5.1 Dev Seed vs. Production Zero-Seed Policy
- **Production Database**: Starts completely clean with zero pre-seeded records. All categories, districts, talukas, and vendors are created via the Super Admin panel.
- **Empty Database Resilience**: If the database is initially empty (0 districts, 0 categories, 0 vendors), the application displays friendly, localized empty states without throwing 500 errors.
- **Local Dev Seeding**: For local development or automated testing, dev fixtures are isolated in:
  ```bash
  npm run db:seed
  # Executes: supabase/seed/seed_dev_data.sql
  ```

---

## 6. Build & Deploy Commands

```bash
# 1. Type and Diagnostic Checks
npx astro check

# 2. Run All Automated Test Suites
npm test

# 3. Build Production Cloudflare Worker Bundle
npm run build

# 4. Deploy to Cloudflare Workers
npx wrangler deploy
```

---

## 7. Post-Deployment Verification Checklist

1. [ ] **Probing Check**: Navigate to `https://aheka.in/admin` and `https://aheka.in/admin/login`. Verify both return HTTP 404.
2. [ ] **Public Links Check**: Inspect Homepage, Header, Footer, and Navigation. Verify zero "Admin" links exist.
3. [ ] **SEO Check**: Inspect `https://aheka.in/robots.txt` and `https://aheka.in/sitemap.xml`. Verify secret admin path does NOT appear.
4. [ ] **Private Entry Check**: Navigate to `https://aheka.in/{ADMIN_ENTRY_PATH}`. Verify the secure login form loads.
5. [ ] **Rate Limiting Check**: Attempt 5 incorrect logins. Verify 6th attempt returns HTTP 429 Too Many Requests.
6. [ ] **Super Admin Login Check**: Log in with valid credentials. Verify access to Vendors, Categories, Locations, and Payments.
7. [ ] **Dynamic Directory Check**: Create a Category and Location in Admin. Verify they appear on the public website without redeploying.
